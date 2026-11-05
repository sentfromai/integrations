import {
  NodeApiError,
  NodeConnectionType,
  NodeOperationError,
  type IDataObject,
  type IExecuteFunctions,
  type ILoadOptionsFunctions,
  type INodeExecutionData,
  type INodeProperties,
  type INodePropertyOptions,
  type INodeType,
  type INodeTypeDescription,
  type JsonObject,
} from "n8n-workflow";
import {
  idPath,
  messageContent,
  nonEmpty,
  recipients,
  responseItems,
  sentFromAiRequest,
} from "./GenericFunctions";

const messageFields: INodeProperties[] = [
  {
    displayName: "Message ID",
    name: "messageId",
    type: "string",
    default: "",
    required: true,
    displayOptions: {
      show: { resource: ["message"], operation: ["get", "reply"] },
    },
    description: "SentFromAI message ID, not the RFC Message-ID header",
  },
  {
    displayName: "Inbox Name or ID",
    name: "inboxId",
    type: "options",
    default: "",
    required: true,
    typeOptions: { loadOptionsMethod: "getInboxes" },
    displayOptions: { show: { resource: ["message"], operation: ["send"] } },
    description:
      'Choose from the list, or specify an ID using an expression. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
  },
  {
    displayName: "To",
    name: "to",
    type: "string",
    default: "",
    required: true,
    placeholder: "person@example.com",
    displayOptions: { show: { resource: ["message"], operation: ["send"] } },
    description:
      "Bare email addresses separated by commas; display names are not supported",
  },
  {
    displayName: "Subject",
    name: "subject",
    type: "string",
    default: "",
    required: true,
    displayOptions: { show: { resource: ["message"], operation: ["send"] } },
  },
  {
    displayName: "Text",
    name: "text",
    type: "string",
    default: "",
    typeOptions: { rows: 5 },
    displayOptions: {
      show: { resource: ["message"], operation: ["send", "reply"] },
    },
    description: "Plain text body. Provide Text, HTML, or both.",
  },
  {
    displayName: "HTML",
    name: "html",
    type: "string",
    default: "",
    typeOptions: { rows: 5 },
    displayOptions: {
      show: { resource: ["message"], operation: ["send", "reply"] },
    },
    description: "HTML body. Provide Text, HTML, or both.",
  },
  {
    displayName: "Additional Fields",
    name: "additionalFields",
    type: "collection",
    default: {},
    placeholder: "Add Field",
    displayOptions: { show: { resource: ["message"], operation: ["send"] } },
    options: [
      {
        displayName: "BCC",
        name: "bcc",
        type: "string",
        default: "",
        description: "Bare email addresses separated by commas",
      },
      {
        displayName: "CC",
        name: "cc",
        type: "string",
        default: "",
        description: "Bare email addresses separated by commas",
      },
      {
        displayName: "Client ID",
        name: "clientId",
        type: "string",
        default: "",
        description:
          "Stable unique identifier for this logical send. Reuse it when retrying the same message to avoid duplicate sends.",
      },
    ],
  },
  {
    displayName: "Reply All",
    name: "replyAll",
    type: "boolean",
    default: false,
    displayOptions: { show: { resource: ["message"], operation: ["reply"] } },
    description:
      "Whether to include all original recipients except the sending inbox",
  },
  {
    displayName: "Query",
    name: "query",
    type: "string",
    default: "",
    displayOptions: { show: { resource: ["message"], operation: ["search"] } },
    description: "Search query. Leave empty to get recent messages.",
  },
  {
    displayName: "Limit",
    name: "limit",
    type: "number",
    default: 50,
    typeOptions: { minValue: 1, maxValue: 100 },
    displayOptions: { show: { resource: ["message"], operation: ["search"] } },
    description: "Max number of results to return",
  },
  {
    displayName: "Options",
    name: "searchOptions",
    type: "collection",
    default: {},
    placeholder: "Add Option",
    displayOptions: { show: { resource: ["message"], operation: ["search"] } },
    options: [
      {
        displayName: "Inbox Name or ID",
        name: "inboxId",
        type: "options",
        default: "",
        typeOptions: { loadOptionsMethod: "getInboxes" },
        description:
          'Choose from the list, or specify an ID using an expression. Leave unset to search all inboxes. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
      },
      {
        displayName: "Mode",
        name: "mode",
        type: "options",
        default: "keyword",
        options: [
          { name: "Hybrid", value: "hybrid" },
          { name: "Keyword", value: "keyword" },
          { name: "Semantic", value: "semantic" },
        ],
        description:
          "Semantic and hybrid search require an eligible plan; the API may fall back to keyword search",
      },
    ],
  },
];

export class SentFromAi implements INodeType {
  description: INodeTypeDescription = {
    displayName: "SentFromAI",
    name: "sentFromAi",
    icon: "file:sentfromai.svg",
    group: ["transform"],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description:
      "Create email inboxes and send, reply to, read, and search email messages",
    defaults: { name: "SentFromAI" },
    inputs: [NodeConnectionType.Main],
    outputs: [NodeConnectionType.Main],
    usableAsTool: true,
    credentials: [{ name: "sentFromAiApi", required: true }],
    properties: [
      {
        displayName: "Resource",
        name: "resource",
        type: "options",
        noDataExpression: true,
        default: "message",
        options: [
          { name: "Inbox", value: "inbox" },
          { name: "Message", value: "message" },
        ],
      },
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        default: "getAll",
        displayOptions: { show: { resource: ["inbox"] } },
        options: [
          {
            name: "Create",
            value: "create",
            description: "Create an email inbox",
            action: "Create an inbox",
          },
          {
            name: "Get Many",
            value: "getAll",
            description: "List many available inboxes",
            action: "Get many inboxes",
          },
        ],
      },
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        default: "search",
        displayOptions: { show: { resource: ["message"] } },
        options: [
          {
            name: "Get",
            value: "get",
            description: "Read a message and its attachment download links",
            action: "Get a message",
          },
          {
            name: "Reply",
            value: "reply",
            description: "Reply in the original email thread",
            action: "Reply to a message",
          },
          {
            name: "Search",
            value: "search",
            description: "Search or get up to 100 recent messages",
            action: "Search messages",
          },
          {
            name: "Send",
            value: "send",
            description: "Send an email from an inbox",
            action: "Send a message",
          },
        ],
      },
      {
        displayName: "Local Part",
        name: "localPart",
        type: "string",
        default: "",
        required: true,
        displayOptions: {
          show: { resource: ["inbox"], operation: ["create"] },
        },
        placeholder: "my-agent",
        description:
          "Mailbox name before @. Only letters, numbers, dots, underscores and hyphens are accepted.",
      },
      {
        displayName: "Additional Fields",
        name: "inboxFields",
        type: "collection",
        default: {},
        placeholder: "Add Field",
        displayOptions: {
          show: { resource: ["inbox"], operation: ["create"] },
        },
        options: [
          {
            displayName: "Display Name",
            name: "displayName",
            type: "string",
            default: "",
          },
          {
            displayName: "Domain ID",
            name: "domainId",
            type: "string",
            default: "",
            description:
              "Verified custom domain ID. Leave unset for the managed mail.sentfrom.ai domain.",
          },
        ],
      },
      ...messageFields,
    ],
  };

  methods = {
    loadOptions: {
      async getInboxes(
        this: ILoadOptionsFunctions,
      ): Promise<INodePropertyOptions[]> {
        const response = await sentFromAiRequest.call(this, "GET", "/inboxes");
        return responseItems(response, "inboxes").map((inbox) => ({
          name: String(inbox.address || inbox.local_part || inbox.id),
          value: String(inbox.id),
        }));
      },
    },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const input = this.getInputData();
    const output: INodeExecutionData[] = [];
    for (let itemIndex = 0; itemIndex < input.length; itemIndex++) {
      let apiRequest = false;
      try {
        const resource = this.getNodeParameter("resource", itemIndex) as string;
        const operation = this.getNodeParameter(
          "operation",
          itemIndex,
        ) as string;
        let path: string;
        let method: "GET" | "POST" = "GET";
        let body: IDataObject | undefined;
        let qs: IDataObject | undefined;
        let collection: string | undefined;
        if (resource === "inbox" && operation === "getAll") {
          path = "/inboxes";
          collection = "inboxes";
        } else if (resource === "inbox" && operation === "create") {
          path = "/inboxes";
          method = "POST";
          const localPart = nonEmpty(
            this.getNodeParameter("localPart", itemIndex) as string,
            "Local Part",
          ).toLowerCase();
          if (!/^[a-z0-9._-]+$/.test(localPart))
            throw new NodeOperationError(
              this.getNode(),
              "Local Part may contain only letters, numbers, dots, underscores and hyphens",
            );
          const fields = this.getNodeParameter(
            "inboxFields",
            itemIndex,
            {},
          ) as IDataObject;
          body = {
            local_part: localPart,
            ...(fields.displayName ? { display_name: fields.displayName } : {}),
            ...(fields.domainId ? { domain_id: fields.domainId } : {}),
          };
        } else if (resource === "message" && operation === "get") {
          path = `/messages/${idPath(this.getNodeParameter("messageId", itemIndex) as string)}`;
        } else if (resource === "message" && operation === "search") {
          path = "/messages";
          collection = "messages";
          const limit = this.getNodeParameter("limit", itemIndex) as number;
          if (!Number.isInteger(limit) || limit < 1 || limit > 100)
            throw new NodeOperationError(
              this.getNode(),
              "Limit must be an integer from 1 to 100",
            );
          const options = this.getNodeParameter(
            "searchOptions",
            itemIndex,
            {},
          ) as IDataObject;
          const mode = String(options.mode || "keyword");
          if (!["keyword", "semantic", "hybrid"].includes(mode))
            throw new NodeOperationError(
              this.getNode(),
              "Unsupported search mode",
            );
          qs = {
            limit,
            mode,
            ...(options.inboxId ? { inbox_id: options.inboxId } : {}),
          };
          const query = (
            this.getNodeParameter("query", itemIndex, "") as string
          ).trim();
          if (query) qs.query = query;
        } else if (
          resource === "message" &&
          (operation === "send" || operation === "reply")
        ) {
          method = "POST";
          body = messageContent(
            this.getNodeParameter("text", itemIndex, "") as string,
            this.getNodeParameter("html", itemIndex, "") as string,
          );
          if (operation === "send") {
            path = "/messages";
            body.inbox_id = nonEmpty(
              this.getNodeParameter("inboxId", itemIndex) as string,
              "Inbox ID",
            );
            body.to = recipients(
              this.getNodeParameter("to", itemIndex) as string,
            );
            body.subject = nonEmpty(
              this.getNodeParameter("subject", itemIndex) as string,
              "Subject",
            );
            const fields = this.getNodeParameter(
              "additionalFields",
              itemIndex,
              {},
            ) as IDataObject;
            if (fields.cc) body.cc = recipients(String(fields.cc));
            if (fields.bcc) body.bcc = recipients(String(fields.bcc));
            if (fields.clientId)
              body.client_id = nonEmpty(String(fields.clientId), "Client ID");
          } else {
            path = `/messages/${idPath(this.getNodeParameter("messageId", itemIndex) as string)}/reply`;
            body.reply_all = this.getNodeParameter(
              "replyAll",
              itemIndex,
              false,
            ) as boolean;
          }
        } else {
          throw new NodeOperationError(
            this.getNode(),
            `Unsupported resource or operation: ${resource}/${operation}`,
          );
        }
        apiRequest = true;
        const response = await sentFromAiRequest.call(
          this,
          method,
          path,
          body,
          qs,
        );
        apiRequest = false;
        const items = collection
          ? responseItems(response, collection)
          : [response];
        for (const item of items) {
          output.push({
            json:
              collection === "messages"
                ? { ...item, mode_used: response.mode_used }
                : item,
            pairedItem: { item: itemIndex },
          });
        }
      } catch (error) {
        if (this.continueOnFail()) {
          output.push({
            json: { error: (error as Error).message },
            pairedItem: { item: itemIndex },
          });
          continue;
        }
        if (error instanceof NodeOperationError) throw error;
        if (apiRequest)
          throw new NodeApiError(this.getNode(), error as JsonObject, {
            itemIndex,
          });
        throw new NodeOperationError(this.getNode(), error as Error, {
          itemIndex,
        });
      }
    }
    return [output];
  }
}
