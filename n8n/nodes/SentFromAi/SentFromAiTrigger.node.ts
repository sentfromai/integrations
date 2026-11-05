import {
  NodeConnectionType,
  NodeOperationError,
  type IHookFunctions,
  type IDataObject,
  type INodeType,
  type INodeTypeDescription,
  type IWebhookFunctions,
  type IWebhookResponseData,
} from "n8n-workflow";
import { idPath, responseItems, sentFromAiRequest } from "./GenericFunctions";
import { isNotFound, validSignature, webhookEvents } from "./WebhookFunctions";

interface WebhookState {
  id: string;
  secret: string;
}

function stateKey(mode: string): string {
  return mode === "manual" ? "testWebhook" : "productionWebhook";
}

export class SentFromAiTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: "SentFromAI Trigger",
    name: "sentFromAiTrigger",
    icon: "file:sentfromai.svg",
    group: ["trigger"],
    version: 1,
    usableAsTool: undefined,
    description: "Start a workflow from signed SentFromAI email events",
    defaults: { name: "SentFromAI Trigger" },
    inputs: [],
    outputs: [NodeConnectionType.Main],
    credentials: [{ name: "sentFromAiApi", required: true }],
    webhooks: [
      {
        name: "default",
        httpMethod: "POST",
        responseMode: "onReceived",
        path: "webhook",
        rawBody: true,
      },
    ],
    properties: [
      {
        displayName: "Events",
        name: "events",
        type: "multiOptions",
        required: true,
        default: ["message.received"],
        options: [
          { name: "Message Bounced", value: "message.bounced" },
          { name: "Message Complained", value: "message.complained" },
          { name: "Message Delivered", value: "message.delivered" },
          { name: "Message Received", value: "message.received" },
          { name: "Message Rejected", value: "message.rejected" },
        ],
        description:
          "Workspace-wide events to receive. Use a Filter node on inbox_id for a specific incoming inbox.",
      },
    ],
  };

  webhookMethods = {
    default: {
      async checkExists(this: IHookFunctions): Promise<boolean> {
        const state = this.getWorkflowStaticData("node")[
          stateKey(this.getMode())
        ] as WebhookState | undefined;
        if (!state?.id || !state.secret) return false;
        const url = this.getNodeWebhookUrl("default");
        const events = this.getNodeParameter("events") as string[];
        const response = await sentFromAiRequest.call(this, "GET", "/webhooks");
        return responseItems(response, "webhooks").some(
          (endpoint) =>
            endpoint.id === state.id &&
            endpoint.url === url &&
            Array.isArray(endpoint.events) &&
            endpoint.events.length === events.length &&
            events.every((event) =>
              (endpoint.events as string[]).includes(event),
            ),
        );
      },
      async create(this: IHookFunctions): Promise<boolean> {
        const url = this.getNodeWebhookUrl("default");
        if (!url?.startsWith("https://"))
          throw new NodeOperationError(
            this.getNode(),
            "A publicly accessible HTTPS n8n webhook URL is required",
          );
        const events = this.getNodeParameter("events") as string[];
        if (
          !events.length ||
          events.some(
            (event) => !(webhookEvents as readonly string[]).includes(event),
          )
        ) {
          throw new NodeOperationError(
            this.getNode(),
            "Select at least one supported event",
          );
        }
        const storage = this.getWorkflowStaticData("node");
        const key = stateKey(this.getMode());
        const old = storage[key] as WebhookState | undefined;
        if (old?.id) {
          try {
            await sentFromAiRequest.call(
              this,
              "DELETE",
              `/webhooks/${idPath(old.id)}`,
            );
          } catch (error) {
            if (!isNotFound(error)) throw error;
          }
          delete storage[key];
        }
        const response = await sentFromAiRequest.call(
          this,
          "POST",
          "/webhooks",
          { url, events },
        );
        if (
          typeof response.id !== "string" ||
          typeof response.secret !== "string" ||
          !response.secret
        ) {
          throw new NodeOperationError(
            this.getNode(),
            "SentFromAI did not return a webhook ID and signing secret",
          );
        }
        // The API returns the signing secret only at creation; never emit it as workflow output.
        storage[key] = { id: response.id, secret: response.secret };
        return true;
      },
      async delete(this: IHookFunctions): Promise<boolean> {
        const storage = this.getWorkflowStaticData("node");
        const key = stateKey(this.getMode());
        const state = storage[key] as WebhookState | undefined;
        if (state?.id) {
          try {
            await sentFromAiRequest.call(
              this,
              "DELETE",
              `/webhooks/${idPath(state.id)}`,
            );
          } catch (error) {
            if (!isNotFound(error)) throw error;
          }
        }
        delete storage[key];
        return true;
      },
    },
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const state = this.getWorkflowStaticData("node")[
      stateKey(this.getMode())
    ] as WebhookState | undefined;
    const rawBody = this.getRequestObject().rawBody;
    const signature = this.getHeaderData()["x-sentfromai-signature"];
    if (
      !state?.secret ||
      !Buffer.isBuffer(rawBody) ||
      !validSignature(rawBody, signature, state.secret)
    ) {
      this.getResponseObject()
        .status(401)
        .json({ error: "Invalid webhook signature" });
      return { noWebhookResponse: true };
    }
    // Parse the verified bytes rather than trusting independently parsed request data.
    let body: IDataObject;
    try {
      body = JSON.parse(rawBody.toString("utf8")) as IDataObject;
    } catch {
      this.getResponseObject().status(400).json({ error: "Invalid JSON" });
      return { noWebhookResponse: true };
    }
    const events = this.getNodeParameter("events") as string[];
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      typeof body.event !== "string" ||
      !events.includes(body.event)
    ) {
      return { webhookResponse: { received: true }, workflowData: [] };
    }
    return {
      webhookResponse: { received: true },
      workflowData: [this.helpers.returnJsonArray(body)],
    };
  }
}
