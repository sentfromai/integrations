const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createHmac } = require("node:crypto");
const { SentFromAi } = require("../dist/nodes/SentFromAi/SentFromAi.node.js");
const {
  SentFromAiTrigger,
} = require("../dist/nodes/SentFromAi/SentFromAiTrigger.node.js");
const {
  SentFromAiApi,
} = require("../dist/credentials/SentFromAiApi.credentials.js");
const {
  validSignature,
} = require("../dist/nodes/SentFromAi/WebhookFunctions.js");

// Use actual compiled nodes and n8n error classes; only the HTTP helper is mocked.
function execution(parameters, responses = [{}], continueOnFail = false) {
  const rows = Array.isArray(parameters) ? parameters : [parameters];
  const calls = [];
  const context = {
    getInputData: () => rows.map(() => ({ json: {} })),
    getNodeParameter: (key, index, fallback) => rows[index][key] ?? fallback,
    getNode: () => ({
      id: "test",
      name: "SentFromAI",
      type: "sentFromAi",
      typeVersion: 1,
      position: [0, 0],
      parameters: {},
    }),
    continueOnFail: () => continueOnFail,
    helpers: {
      async httpRequestWithAuthentication(credential, options) {
        assert.equal(this, context);
        assert.equal(credential, "sentFromAiApi");
        calls.push(options);
        const response = responses[calls.length - 1];
        if (response instanceof Error) throw response;
        return response;
      },
    },
  };
  return { context, calls };
}
const node = new SentFromAi();
const send = {
  resource: "message",
  operation: "send",
  inboxId: "inbox-1",
  to: "a@example.com",
  subject: "Hello",
  text: "A message",
  html: "",
  additionalFields: {},
};

test("credential masks key, uses bearer authentication and read-only connection test", () => {
  const credential = new SentFromAiApi();
  assert.equal(credential.properties[0].typeOptions.password, true);
  assert.equal(
    credential.authenticate.properties.headers.Authorization,
    "=Bearer {{$credentials.apiKey}}",
  );
  assert.deepEqual(credential.test.request, {
    baseURL: "https://api.sentfrom.ai/v1",
    url: "/inboxes",
    method: "GET",
  });
});

test("send maps recipients and optional fields, preserves client id, disables redirects", async () => {
  const { context, calls } = execution(
    {
      ...send,
      to: "a@example.com, b@example.com; a@example.com",
      additionalFields: {
        cc: "c@example.com",
        bcc: "d@example.com",
        clientId: "order-42-notice",
      },
    },
    [{ id: "message-1", idempotent: false }],
  );
  const result = await node.execute.call(context);
  assert.deepEqual(calls[0].body, {
    text: "A message",
    inbox_id: "inbox-1",
    to: ["a@example.com", "b@example.com"],
    subject: "Hello",
    cc: ["c@example.com"],
    bcc: ["d@example.com"],
    client_id: "order-42-notice",
  });
  assert.equal(calls[0].url, "https://api.sentfrom.ai/v1/messages");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].disableFollowRedirect, true);
  assert.deepEqual(result, [
    [{ json: { id: "message-1", idempotent: false }, pairedItem: { item: 0 } }],
  ]);
});

test("HTML-only send omits empty text", async () => {
  const { context, calls } = execution({
    ...send,
    text: "",
    html: "<p>Hello</p>",
  });
  await node.execute.call(context);
  assert.equal(calls[0].body.html, "<p>Hello</p>");
  assert.equal("text" in calls[0].body, false);
});

test("invalid recipients, empty body, and blank subject never reach API", async () => {
  for (const values of [
    { to: "not-an-address" },
    { text: " ", html: "" },
    { subject: " " },
  ]) {
    const { context, calls } = execution({ ...send, ...values });
    await assert.rejects(node.execute.call(context));
    assert.equal(calls.length, 0);
  }
});

test("reply keeps threading on API endpoint and omits an unset optional client_id", async () => {
  const { context, calls } = execution(
    {
      resource: "message",
      operation: "reply",
      messageId: "id/with?special",
      text: "Thanks",
      html: "",
      replyAll: true,
    },
    [{ id: "reply-1", thread_id: "thread-1" }],
  );
  await node.execute.call(context);
  assert.equal(
    calls[0].url,
    "https://api.sentfrom.ai/v1/messages/id%2Fwith%3Fspecial/reply",
  );
  assert.deepEqual(calls[0].body, { text: "Thanks", reply_all: true });
});

test("reply passes a stable caller retry key and returns API duplicate-suppression evidence", async () => {
  const { context, calls } = execution(
    {
      resource: "message",
      operation: "reply",
      messageId: "source-message",
      text: "Thanks",
      replyFields: { clientId: "case-42-reply" },
    },
    [{ id: "existing-reply", thread_id: "thread-1", idempotent: true }],
  );
  const result = await node.execute.call(context);
  assert.deepEqual(calls[0].body, {
    text: "Thanks",
    reply_all: false,
    client_id: "case-42-reply",
  });
  assert.equal(calls.length, 1);
  assert.equal(result[0][0].json.idempotent, true);
  assert.equal(result[0][0].json.id, "existing-reply");
});

test("search uses documented query parameter and exposes server fallback mode", async () => {
  const { context, calls } = execution(
    {
      resource: "message",
      operation: "search",
      query: "invoice",
      limit: 50,
      searchOptions: { mode: "semantic", inboxId: "inbox-1" },
    },
    [
      {
        mode_used: "keyword",
        messages: [{ id: "message-1" }, { id: "message-2" }],
      },
    ],
  );
  const result = await node.execute.call(context);
  assert.deepEqual(calls[0].qs, {
    query: "invoice",
    limit: 50,
    mode: "semantic",
    inbox_id: "inbox-1",
  });
  assert.equal(result[0].length, 2);
  assert.equal(result[0][0].json.mode_used, "keyword");
  assert.deepEqual(result[0][1].pairedItem, { item: 0 });
});

test("recent search omits blank query; no invented pagination or unlimited result option", async () => {
  const { context, calls } = execution(
    {
      resource: "message",
      operation: "search",
      query: " ",
      limit: 100,
      searchOptions: {},
    },
    [{ mode_used: "recent", messages: [] }],
  );
  assert.deepEqual(await node.execute.call(context), [[]]);
  assert.equal("query" in calls[0].qs, false);
  assert.equal(calls.length, 1);
});

test("search validates expression-provided bounds and modes", async () => {
  for (const values of [
    { limit: 101 },
    { limit: 0 },
    { limit: 1.5 },
    { searchOptions: { mode: "invalid" } },
  ]) {
    const { context, calls } = execution({
      resource: "message",
      operation: "search",
      limit: 25,
      query: "",
      searchOptions: {},
      ...values,
    });
    await assert.rejects(node.execute.call(context));
    assert.equal(calls.length, 0);
  }
});

test("inbox create normalizes name and maps verified domain fields", async () => {
  const { context, calls } = execution(
    {
      resource: "inbox",
      operation: "create",
      localPart: " My-Agent ",
      inboxFields: { displayName: "Agent", domainId: "domain-1" },
    },
    [{ id: "inbox-1", address: "my-agent@example.com" }],
  );
  await node.execute.call(context);
  assert.deepEqual(calls[0].body, {
    local_part: "my-agent",
    display_name: "Agent",
    domain_id: "domain-1",
  });
});

test("inbox list flattens collection and preserves input item links", async () => {
  const { context } = execution(
    [
      { resource: "inbox", operation: "getAll" },
      { resource: "inbox", operation: "getAll" },
    ],
    [{ inboxes: [{ id: "a" }] }, { inboxes: [{ id: "b" }, { id: "c" }] }],
  );
  const result = await node.execute.call(context);
  assert.deepEqual(
    result[0].map((item) => item.pairedItem.item),
    [0, 1, 1],
  );
});

test("read preserves attachment URLs and labels", async () => {
  const message = {
    id: "m1",
    body_text: "Hello",
    attachments: [{ url: "https://files.example.com/signed" }],
    labels: [{ name: "Support" }],
  };
  const { context, calls } = execution(
    { resource: "message", operation: "get", messageId: "m1" },
    [message],
  );
  assert.deepEqual((await node.execute.call(context))[0][0].json, message);
  assert.equal(calls[0].method, "GET");
});

test("continue on fail attaches error to failed item and processes next item", async () => {
  const { context, calls } = execution(
    [{ ...send, to: "bad" }, send],
    [{ id: "ok" }],
    true,
  );
  const result = await node.execute.call(context);
  assert.match(result[0][0].json.error, /email addresses/);
  assert.deepEqual(result[0][0].pairedItem, { item: 0 });
  assert.equal(result[0][1].json.id, "ok");
  assert.deepEqual(result[0][1].pairedItem, { item: 1 });
  assert.equal(calls.length, 1);
});

test("HTTP failure surfaces an n8n API error without retrying send", async () => {
  const failure = Object.assign(new Error("Sending is paused"), {
    statusCode: 403,
  });
  const { context, calls } = execution(send, [failure]);
  await assert.rejects(
    node.execute.call(context),
    (error) => error.name === "NodeApiError",
  );
  assert.equal(calls.length, 1);
});

test("inbox dropdown returns address labels", async () => {
  const { context } = execution({}, [
    { inboxes: [{ id: "inbox-1", address: "agent@example.com" }] },
  ]);
  assert.deepEqual(await node.methods.loadOptions.getInboxes.call(context), [
    { name: "agent@example.com", value: "inbox-1" },
  ]);
});

const trigger = new SentFromAiTrigger();
const lifecycle = trigger.webhookMethods.default;
function hook(
  responses = [],
  storage = {},
  mode = "trigger",
  url = "https://n8n.example.com/webhook/test",
  events = ["message.received"],
) {
  const { context, calls } = execution({}, responses);
  Object.assign(context, {
    getMode: () => mode,
    getWorkflowStaticData: () => storage,
    getNodeWebhookUrl: () => url,
    getNodeParameter: () => events,
  });
  return { context, calls, storage };
}

test("trigger registers selected events and retains one-time secret only in node state", async () => {
  const { context, calls, storage } = hook([
    { id: "webhook-1", secret: "whsec_test" },
  ]);
  assert.equal(await lifecycle.create.call(context), true);
  assert.deepEqual(calls[0].body, {
    url: "https://n8n.example.com/webhook/test",
    events: ["message.received"],
  });
  assert.deepEqual(storage.productionWebhook, {
    id: "webhook-1",
    secret: "whsec_test",
  });
});

test("trigger checks stored endpoint URL and selected events, not just endpoint presence", async () => {
  const state = { productionWebhook: { id: "w1", secret: "whsec_test" } };
  const valid = hook(
    [
      {
        webhooks: [
          {
            id: "w1",
            url: "https://n8n.example.com/webhook/test",
            events: ["message.received"],
          },
        ],
      },
    ],
    state,
  );
  assert.equal(await lifecycle.checkExists.call(valid.context), true);
  const changed = hook(
    [
      {
        webhooks: [
          {
            id: "w1",
            url: "https://other.example.com",
            events: ["message.received"],
          },
        ],
      },
    ],
    state,
  );
  assert.equal(await lifecycle.checkExists.call(changed.context), false);
});

test("trigger requires HTTPS and events before registration", async () => {
  for (const config of [
    { url: "http://localhost:5678/webhook" },
    { events: [] },
    { events: ["unknown"] },
  ]) {
    const { context, calls } = hook(
      [],
      {},
      "trigger",
      config.url,
      config.events,
    );
    await assert.rejects(lifecycle.create.call(context));
    assert.equal(calls.length, 0);
  }
});

test("trigger replacement deletes only its previously saved endpoint", async () => {
  const { context, calls, storage } = hook(
    [{}, { id: "new", secret: "new-secret" }],
    { productionWebhook: { id: "old", secret: "old-secret" } },
  );
  await lifecycle.create.call(context);
  assert.equal(calls[0].url, "https://api.sentfrom.ai/v1/webhooks/old");
  assert.equal(calls[0].method, "DELETE");
  assert.equal(calls[1].method, "POST");
  assert.equal(storage.productionWebhook.id, "new");
});

test("trigger deletion tolerates 404 but preserves state on permission failure", async () => {
  const missing = hook(
    [Object.assign(new Error("Gone"), { statusCode: 404 })],
    { productionWebhook: { id: "w1", secret: "s" } },
  );
  assert.equal(await lifecycle.delete.call(missing.context), true);
  assert.equal(missing.storage.productionWebhook, undefined);
  const forbidden = hook(
    [Object.assign(new Error("Forbidden"), { statusCode: 403 })],
    { productionWebhook: { id: "w1", secret: "s" } },
  );
  await assert.rejects(lifecycle.delete.call(forbidden.context));
  assert.equal(forbidden.storage.productionWebhook.id, "w1");
});

test("manual webhook setup does not overwrite active webhook state", async () => {
  const { context, calls, storage } = hook(
    [{ id: "test", secret: "test-secret" }],
    { productionWebhook: { id: "live", secret: "live-secret" } },
    "manual",
  );
  await lifecycle.create.call(context);
  assert.equal(calls.length, 1);
  assert.equal(storage.productionWebhook.id, "live");
  assert.equal(storage.testWebhook.id, "test");
});

function delivery(rawBody, signature, events = ["message.received"]) {
  const response = {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  const { context } = hook(
    [],
    { productionWebhook: { id: "w1", secret: "whsec_test" } },
    "webhook",
    undefined,
    events,
  );
  Object.assign(context, {
    getRequestObject: () => ({ rawBody }),
    getHeaderData: () => ({ "x-sentfromai-signature": signature }),
    getResponseObject: () => response,
  });
  context.helpers.returnJsonArray = (json) => [{ json }];
  return { context, response };
}
const sign = (raw) =>
  "sha256=" + createHmac("sha256", "whsec_test").update(raw).digest("hex");

test("trigger verifies the exact raw bytes before emitting payload", async () => {
  const raw = Buffer.from(
    '{ "event": "message.received", "message": { "id": "m1" } }',
  );
  const { context, response } = delivery(raw, sign(raw));
  const result = await trigger.webhook.call(context);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(result.workflowData, [
    [{ json: { event: "message.received", message: { id: "m1" } } }],
  ]);
  assert.equal(JSON.stringify(result).includes("whsec_test"), false);
});

test("tampered body and missing, malformed, or repeated signature headers reject with 401", async () => {
  const raw = Buffer.from('{"event":"message.received"}');
  for (const signature of [
    undefined,
    "",
    "sha256=xyz",
    [sign(raw), sign(raw)],
    sign(Buffer.from("{}")),
  ]) {
    const { context, response } = delivery(raw, signature);
    const result = await trigger.webhook.call(context);
    assert.equal(response.statusCode, 401);
    assert.equal(result.noWebhookResponse, true);
    assert.equal(result.workflowData, undefined);
  }
});

test("unavailable raw body rejects rather than checking reserialized JSON", async () => {
  const { context, response } = delivery(undefined, "sha256=" + "a".repeat(64));
  await trigger.webhook.call(context);
  assert.equal(response.statusCode, 401);
});

test("valid signature on invalid JSON returns 400 and does not execute workflow", async () => {
  const raw = Buffer.from("{");
  const { context, response } = delivery(raw, sign(raw));
  const result = await trigger.webhook.call(context);
  assert.equal(response.statusCode, 400);
  assert.equal(result.workflowData, undefined);
});

test("unselected event is acknowledged without running workflow", async () => {
  const raw = Buffer.from('{"event":"message.bounced"}');
  const { context } = delivery(raw, sign(raw));
  assert.deepEqual((await trigger.webhook.call(context)).workflowData, []);
});

test("signature verification rejects altered payload even when JSON semantics match", () => {
  const raw = Buffer.from('{"event":"message.received"}');
  assert.equal(validSignature(raw, sign(raw), "whsec_test"), true);
  assert.equal(
    validSignature(
      Buffer.from('{ "event": "message.received" }'),
      sign(raw),
      "whsec_test",
    ),
    false,
  );
});
