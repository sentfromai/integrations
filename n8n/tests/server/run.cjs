// Real n8n 2.46.6 HTTP-server QA using the packed community-node artifact.
// All SentFromAI requests go to a synthetic localhost TLS service. No production
// credentials, mail, public webhook/tunnel, browser automation or engine mocks.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const net = require("node:net");
const https = require("node:https");
const { spawn, execFileSync } = require("node:child_process");
const { randomBytes, randomUUID, createHmac } = require("node:crypto");
const { createRequire } = require("node:module");

const runtime = process.env.SENTFROMAI_QA_RUNTIME;
assert(
  runtime && path.isAbsolute(runtime),
  "Set SENTFROMAI_QA_RUNTIME to the installed n8n package directory",
);
assert.equal(
  JSON.parse(fs.readFileSync(path.join(runtime, "package.json"))).version,
  "2.46.6",
);
assert(
  Number(process.versions.node.split(".")[0]) >= 24,
  "The pinned n8n server requires Node24",
);
const database = {
  host: process.env.SENTFROMAI_QA_DB_HOST || "127.0.0.1",
  port: process.env.SENTFROMAI_QA_DB_PORT || "55439",
  name: process.env.SENTFROMAI_QA_DB_NAME || "sentfromai_n8n_qa",
  user: process.env.SENTFROMAI_QA_DB_USER || "n8n_qa",
  password: process.env.SENTFROMAI_QA_DB_PASSWORD,
};
assert(
  ["127.0.0.1", "localhost"].includes(database.host),
  "Refusing non-local database",
);
assert.equal(database.name, "sentfromai_n8n_qa");
assert.equal(database.user, "n8n_qa");
assert(database.password, "Provide the dedicated synthetic database password");
assert(/^\d+$/.test(database.port));
const packageRoot = path.resolve(__dirname, "../..");
const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), "sentfromai-n8n-server-"),
);
fs.chmodSync(directory, 0o700);
const resultsDirectory = path.resolve(
  process.env.SENTFROMAI_QA_RESULTS || path.join(directory, "results"),
);
fs.mkdirSync(resultsDirectory, { recursive: true, mode: 0o700 });
const apiKey = "qa-only-" + randomBytes(16).toString("hex");
const password = "Qa1!" + randomBytes(20).toString("hex");
const encryptionKey = randomBytes(32).toString("hex");
const secrets = [apiKey, password, encryptionKey, database.password];
const checks = [];
const browserId = randomUUID();
let server,
  apiServer,
  logs = "",
  cookie = "",
  base,
  registrationCount = 0,
  deleteCount = 0,
  syntheticDeliveries = 0;
const registrations = new Map();
const requests = [];
const idempotency = new Map();
const inboxA = "11111111-1111-4111-8111-111111111111";
const inboxB = "22222222-2222-4222-8222-222222222222";
const sourceMessage = "33333333-3333-4333-8333-333333333333";
const threadId = "44444444-4444-4444-8444-444444444444";
const addresses = ["a@synthetic.example.test", "b@synthetic.example.test"];
const initialInboxes = [
  { id: inboxA, address: addresses[0], local_part: "a" },
  { id: inboxB, address: addresses[1], local_part: "b" },
];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sanitize = (text) =>
  secrets.reduce(
    (result, value) => result.split(value).join("[redacted]"),
    String(text),
  );
function report(name) {
  checks.push(name);
  process.stdout.write("PASS: " + name + "\n");
}
function stopped() {
  return !server || server.exitCode !== null || server.signalCode !== null;
}
async function stopServer() {
  if (stopped()) return;
  server.kill("SIGTERM");
  for (let i = 0; i < 40 && !stopped(); i++) await wait(250);
  if (!stopped()) {
    server.kill("SIGKILL");
    await new Promise((resolve) => server.once("exit", resolve));
  }
}
async function freePort() {
  const listener = net.createServer();
  await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  return port;
}
async function request(method, route, body, expected = 200) {
  const response = await fetch(base + route, {
    method,
    redirect: "error",
    signal: AbortSignal.timeout(30000),
    headers: {
      "content-type": "application/json",
      "browser-id": browserId,
      origin: base,
      ...(cookie ? { cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  for (const value of response.headers.getSetCookie()) {
    const pair = value.split(";")[0];
    if (pair.startsWith("n8n-auth=")) {
      cookie = pair;
      secrets.push(pair);
    }
  }
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  assert.equal(
    response.status,
    expected,
    method + " " + route + ": " + sanitize(text).slice(0, 600),
  );
  return parsed && typeof parsed === "object" && Object.hasOwn(parsed, "data")
    ? parsed.data
    : parsed;
}
async function execution(id) {
  for (let i = 0; i < 120; i++) {
    const result = await request(
      "GET",
      "/rest/executions/" +
        encodeURIComponent(id) +
        "?includeData=true&unflatten=true",
    );
    if (
      result.status === "success" ||
      result.status === "error" ||
      result.status === "crashed"
    ) {
      assert.equal(
        result.status,
        "success",
        "execution failed: " +
          sanitize(
            JSON.stringify(result.data?.resultData?.error || result.status),
          ).slice(0, 700),
      );
      let data = result.data;
      if (typeof data === "string")
        data = createRequire(path.join(runtime, "package.json"))(
          "flatted",
        ).parse(data);
      assert(
        data?.resultData?.runData,
        "execution response must include persisted run data",
      );
      return data.resultData.runData;
    }
    await wait(250);
  }
  throw new Error("Timed out waiting for persisted workflow execution");
}
function output(runData, name) {
  const items = runData[name]?.at(-1)?.data?.main?.[0];
  assert(Array.isArray(items), "Expected node output items for " + name);
  return items.map((item) => item.json);
}
function table(value) {
  if (Array.isArray(value)) return value;
  assert(
    value && typeof value === "object",
    "Expected registered type metadata",
  );
  return Object.values(value);
}
async function createWorkflow(name, nodes, connections = {}) {
  return request("POST", "/rest/workflows", {
    name,
    nodes,
    connections,
    settings: { executionOrder: "v1" },
  });
}
async function runAction(name, type, credential, parameters) {
  const workflow = await createWorkflow(
    "Synthetic SentFromAI QA " + name,
    [
      {
        id: randomUUID(),
        name: "Manual",
        type: "n8n-nodes-base.manualTrigger",
        typeVersion: 1,
        position: [0, 0],
        parameters: {},
      },
      {
        id: randomUUID(),
        name: "Action",
        type,
        typeVersion: 1,
        position: [240, 0],
        parameters,
        credentials: {
          sentFromAiApi: { id: credential.id, name: credential.name },
        },
      },
    ],
    { Manual: { main: [[{ node: "Action", type: "main", index: 0 }]] } },
  );
  const started = await request(
    "POST",
    "/rest/workflows/" + workflow.id + "/run",
    { triggerToStartFrom: { name: "Manual" } },
  );
  assert(started.executionId, "Manual execution must return an execution ID");
  return output(await execution(started.executionId), "Action");
}
function apiReply(response, status, value) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(value === undefined ? "" : JSON.stringify(value));
}
async function startApiFixture() {
  const ca = path.join(directory, "qa.crt"),
    key = path.join(directory, "qa.key");
  const opensslConfig = path.join(directory, "openssl.cnf");
  fs.writeFileSync(
    opensslConfig,
    "[req]\ndistinguished_name=dn\nx509_extensions=ext\nprompt=no\n[dn]\nCN=localhost\n[ext]\nsubjectAltName=DNS:localhost,IP:127.0.0.1\nbasicConstraints=critical,CA:TRUE\n",
    { mode: 0o600 },
  );
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "1",
      "-keyout",
      key,
      "-out",
      ca,
      "-config",
      opensslConfig,
    ],
    { stdio: "ignore" },
  );
  fs.chmodSync(key, 0o600);
  apiServer = https.createServer(
    { key: fs.readFileSync(key), cert: fs.readFileSync(ca) },
    async (req, res) => {
      try {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const raw = Buffer.concat(chunks).toString("utf8"),
          body = raw ? JSON.parse(raw) : null;
        const url = new URL(req.url, "https://api.sentfrom.ai");
        requests.push({ method: req.method, path: url.pathname });
        if (req.headers.authorization !== "Bearer " + apiKey)
          return apiReply(res, 401, { error: "unauthorized" });
        if (req.method === "GET" && url.pathname === "/v1/inboxes")
          return apiReply(res, 200, { inboxes: initialInboxes });
        if (req.method === "POST" && url.pathname === "/v1/inboxes") {
          assert.equal(body.local_part, "synthetic-created");
          return apiReply(res, 201, {
            id: randomUUID(),
            local_part: body.local_part,
            address: "synthetic-created@synthetic.example.test",
          });
        }
        if (req.method === "GET" && url.pathname === "/v1/messages")
          return apiReply(res, 200, {
            mode_used: "keyword",
            messages: [
              {
                id: sourceMessage,
                thread_id: threadId,
                direction: "inbound",
                subject: "Synthetic incoming",
              },
            ],
          });
        if (
          req.method === "GET" &&
          url.pathname === "/v1/messages/" + sourceMessage
        )
          return apiReply(res, 200, {
            id: sourceMessage,
            thread_id: threadId,
            direction: "inbound",
            subject: "Synthetic incoming",
            text: "Synthetic body only",
            attachments: [],
          });
        if (
          req.method === "POST" &&
          (url.pathname === "/v1/messages" ||
            url.pathname === "/v1/messages/" + sourceMessage + "/reply")
        ) {
          if (url.pathname === "/v1/messages") {
            assert.equal(body.inbox_id, inboxA);
            assert.deepEqual(body.to, [addresses[1]]);
          }
          assert.equal(typeof body.client_id, "string");
          const identity = url.pathname + ":" + body.client_id,
            serialized = JSON.stringify(body),
            previous = idempotency.get(identity);
          if (previous) {
            if (previous.request !== serialized)
              return apiReply(res, 409, { error: "idempotency_conflict" });
            return apiReply(res, 201, { ...previous.result, idempotent: true });
          }
          syntheticDeliveries++;
          const result = {
            id: randomUUID(),
            thread_id: threadId,
            idempotent: false,
          };
          idempotency.set(identity, { request: serialized, result });
          return apiReply(res, 201, result);
        }
        if (req.method === "GET" && url.pathname === "/v1/webhooks")
          return apiReply(res, 200, {
            webhooks: [...registrations.values()].map(
              ({ secret, ...rest }) => rest,
            ),
          });
        if (req.method === "POST" && url.pathname === "/v1/webhooks") {
          assert.equal(
            new URL(body.url).origin,
            "https://sentfromai-n8n-qa.invalid",
          );
          assert.deepEqual(body.events, ["message.received"]);
          const item = {
            id: randomUUID(),
            url: body.url,
            events: body.events,
            secret: randomBytes(32).toString("hex"),
          };
          secrets.push(item.secret);
          registrations.set(item.id, item);
          registrationCount++;
          return apiReply(res, 201, item);
        }
        if (
          req.method === "DELETE" &&
          url.pathname.startsWith("/v1/webhooks/")
        ) {
          const id = url.pathname.slice("/v1/webhooks/".length);
          if (!registrations.has(id))
            return apiReply(res, 404, { error: "not_found" });
          registrations.delete(id);
          deleteCount++;
          return apiReply(res, 200, { deleted: true });
        }
        return apiReply(res, 404, { error: "synthetic_not_found" });
      } catch (error) {
        logs += "\nFixture error: " + sanitize(error.stack);
        apiReply(res, 500, { error: "synthetic_fixture_failure" });
      }
    },
  );
  await new Promise((resolve) => apiServer.listen(0, "127.0.0.1", resolve));
  const config = path.join(directory, "transport.json");
  fs.writeFileSync(
    config,
    JSON.stringify({ port: apiServer.address().port, ca }),
    { mode: 0o600 },
  );
  return { config, ca };
}
async function startServer(artifact, transport, port) {
  base = "http://127.0.0.1:" + port;
  const environment = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    LANG: "C.UTF-8",
    TZ: "UTC",
    N8N_USER_FOLDER: path.join(directory, "user"),
    N8N_CUSTOM_EXTENSIONS: path.join(artifact, "dist"),
    NODE_PATH: path.dirname(runtime),
    NODE_OPTIONS:
      "--require " + JSON.stringify(path.join(__dirname, "transport.cjs")),
    NODE_EXTRA_CA_CERTS: transport.ca,
    SENTFROMAI_QA_TRANSPORT: transport.config,
    N8N_HOST: "127.0.0.1",
    N8N_LISTEN_ADDRESS: "127.0.0.1",
    N8N_PORT: String(port),
    N8N_PROTOCOL: "http",
    N8N_EDITOR_BASE_URL: base,
    N8N_SECURE_COOKIE: "false",
    WEBHOOK_URL: "https://sentfromai-n8n-qa.invalid/",
    N8N_ENCRYPTION_KEY: encryptionKey,
    N8N_DIAGNOSTICS_ENABLED: "false",
    N8N_PERSONALIZATION_ENABLED: "false",
    N8N_VERSION_NOTIFICATIONS_ENABLED: "false",
    N8N_LICENSE_AUTO_RENEW_ENABLED: "false",
    N8N_RUNNERS_ENABLED: "false",
    N8N_COMMUNITY_PACKAGES_ENABLED: "false",
    N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS: "true",
    N8N_LOG_LEVEL: "warn",
    DB_TYPE: "postgresdb",
    DB_POSTGRESDB_HOST: database.host,
    DB_POSTGRESDB_PORT: database.port,
    DB_POSTGRESDB_DATABASE: database.name,
    DB_POSTGRESDB_USER: database.user,
    DB_POSTGRESDB_PASSWORD: database.password,
    EXECUTIONS_DATA_SAVE_ON_SUCCESS: "all",
    EXECUTIONS_DATA_SAVE_MANUAL_EXECUTIONS: "true",
  };
  server = spawn(process.execPath, [path.join(runtime, "bin/n8n"), "start"], {
    cwd: directory,
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [server.stdout, server.stderr])
    stream.on("data", (data) => {
      logs = (logs + data.toString()).slice(-2_000_000);
    });
  for (let i = 0; i < 180; i++) {
    if (stopped())
      throw new Error(
        "n8n exited during startup: " + sanitize(logs).slice(-2500),
      );
    try {
      const response = await fetch(base + "/healthz/readiness", {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) return;
    } catch {}
    await wait(500);
  }
  throw new Error("n8n readiness timed out: " + sanitize(logs).slice(-2500));
}
async function webhookRequest(registration, body, signature, expected) {
  const target = new URL(registration.url);
  const response = await fetch(base + target.pathname, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-sentfromai-signature": signature,
    },
    body,
    redirect: "error",
  });
  const text = await response.text();
  assert.equal(
    response.status,
    expected,
    "webhook response: " + sanitize(text).slice(0, 400),
  );
  return text;
}
(async () => {
  let failure;
  try {
    const packed = JSON.parse(
      execFileSync(
        "npm",
        [
          "pack",
          "--json",
          "--pack-destination",
          directory,
          "--cache",
          path.join(directory, "npm-cache"),
        ],
        { cwd: packageRoot, encoding: "utf8" },
      ),
    )[0];
    const artifact = path.join(directory, "artifact");
    fs.mkdirSync(artifact);
    execFileSync("tar", [
      "-xzf",
      path.join(directory, packed.filename),
      "-C",
      artifact,
      "--strip-components=1",
    ]);
    assert(
      packed.files.every(
        (file) =>
          !/(?:^|\/)(?:node_modules|tests|\.env|private)(?:\/|$)/.test(
            file.path,
          ),
      ),
    );
    report(
      "packed artifact contains only published source outputs and documentation",
    );
    const transport = await startApiFixture();
    await startServer(artifact, transport, await freePort());
    report(
      "real n8n2.46.6 HTTP server is ready with isolated PostgreSQL state",
    );
    await request("POST", "/rest/owner/setup", {
      email: "owner@synthetic.example.test",
      firstName: "Synthetic",
      lastName: "QA",
      password,
    });
    assert(cookie, "owner setup must issue an authenticated session");
    const nodes = table(await request("GET", "/types/nodes.json"));
    const action = nodes.find((node) => node.displayName === "SentFromAI"),
      trigger = nodes.find((node) => node.displayName === "SentFromAI Trigger");
    assert(action && trigger, "server must register both packed nodes");
    assert(action.properties.some((field) => field.name === "replyFields"));
    const credentials = table(await request("GET", "/types/credentials.json"));
    const credentialType = credentials.find(
      (item) => item.name === "sentFromAiApi",
    );
    assert(
      credentialType?.properties.some(
        (field) =>
          field.name === "apiKey" && field.typeOptions?.password === true,
      ),
    );
    report(
      "server exposes both node descriptions and masked credential field metadata",
    );
    const credential = await request("POST", "/rest/credentials", {
      name: "Synthetic SentFromAI credential",
      type: "sentFromAiApi",
      data: { apiKey },
    });
    const tested = await request("POST", "/rest/credentials/test", {
      credentials: {
        id: credential.id,
        name: credential.name,
        type: "sentFromAiApi",
      },
    });
    assert.equal(tested.status, "OK");
    const invalid = await request("POST", "/rest/credentials", {
      name: "Synthetic invalid credential",
      type: "sentFromAiApi",
      data: { apiKey: "invalid-synthetic-key" },
    });
    assert.equal(
      (
        await request("POST", "/rest/credentials/test", {
          credentials: {
            id: invalid.id,
            name: invalid.name,
            type: "sentFromAiApi",
          },
        })
      ).status,
      "Error",
    );
    report(
      "persisted credentials pass a real server connection test and reject invalid authentication",
    );
    assert.equal(
      (
        await runAction("list", action.name, credential, {
          resource: "inbox",
          operation: "getAll",
        })
      ).length,
      2,
    );
    assert.equal(
      (
        await runAction("create", action.name, credential, {
          resource: "inbox",
          operation: "create",
          localPart: "synthetic-created",
          inboxFields: {},
        })
      )[0].local_part,
      "synthetic-created",
    );
    assert.equal(
      (
        await runAction("read", action.name, credential, {
          resource: "message",
          operation: "get",
          messageId: sourceMessage,
        })
      )[0].id,
      sourceMessage,
    );
    const found = await runAction("search", action.name, credential, {
      resource: "message",
      operation: "search",
      query: "Synthetic",
      limit: 10,
      searchOptions: { mode: "keyword", inboxId: inboxB },
    });
    assert.equal(found[0].mode_used, "keyword");
    report(
      "create/list/read/search execute through server HTTP workflow execution and persisted credentials",
    );
    const send = {
      resource: "message",
      operation: "send",
      inboxId: inboxA,
      to: addresses[1],
      subject: "Synthetic server QA",
      text: "Synthetic body",
      html: "",
      additionalFields: { clientId: "qa-send-1" },
    };
    const firstSend = (
      await runAction("send", action.name, credential, send)
    )[0];
    const repeatedSend = (
      await runAction("send retry", action.name, credential, send)
    )[0];
    assert.equal(repeatedSend.id, firstSend.id);
    assert.equal(repeatedSend.idempotent, true);
    const reply = {
      resource: "message",
      operation: "reply",
      messageId: sourceMessage,
      text: "Synthetic reply",
      html: "",
      replyAll: false,
      replyFields: { clientId: "qa-reply-1" },
    };
    const firstReply = (
      await runAction("reply", action.name, credential, reply)
    )[0];
    const repeatedReply = (
      await runAction("reply retry", action.name, credential, reply)
    )[0];
    assert.equal(repeatedReply.id, firstReply.id);
    assert.equal(repeatedReply.idempotent, true);
    assert.equal(syntheticDeliveries, 2);
    report(
      "send/reply caller retry keys and duplicate receipts survive real server execution",
    );
    const webhookId = randomUUID();
    const workflow = await createWorkflow(
      "Synthetic SentFromAI webhook lifecycle",
      [
        {
          id: randomUUID(),
          name: "Incoming",
          type: trigger.name,
          typeVersion: 1,
          position: [0, 0],
          parameters: { events: ["message.received"] },
          webhookId,
          credentials: {
            sentFromAiApi: { id: credential.id, name: credential.name },
          },
        },
        {
          id: randomUUID(),
          name: "Capture",
          type: "n8n-nodes-base.noOp",
          typeVersion: 1,
          position: [240, 0],
          parameters: {},
        },
      ],
      { Incoming: { main: [[{ node: "Capture", type: "main", index: 0 }]] } },
    );
    await request("POST", "/rest/workflows/" + workflow.id + "/activate", {
      versionId: workflow.versionId,
      name: "Synthetic activation",
      description: "Local HTTP QA only",
    });
    assert.equal(registrations.size, 1);
    assert.equal(registrationCount, 1);
    const registration = [...registrations.values()][0];
    report(
      "workflow activation registers exactly one synthetic HTTPS endpoint",
    );
    const payload = JSON.stringify({
      event: "message.received",
      inbox_id: inboxB,
      thread_id: threadId,
      message: { id: sourceMessage, subject: "Synthetic incoming" },
    });
    const signature =
      "sha256=" +
      createHmac("sha256", registration.secret).update(payload).digest("hex");
    await webhookRequest(registration, payload + " ", signature, 401);
    await webhookRequest(registration, payload, "bad-signature", 401);
    assert.equal(
      await request(
        "GET",
        "/rest/workflows/" + workflow.id + "/executions/last-successful",
      ),
      null,
    );
    report(
      "real server webhook rejects tampered raw bytes and invalid signatures without a workflow execution",
    );
    await webhookRequest(registration, payload, signature, 200);
    let successful;
    for (let i = 0; i < 100; i++) {
      successful = await request(
        "GET",
        "/rest/workflows/" + workflow.id + "/executions/last-successful",
      );
      if (successful) break;
      await wait(200);
    }
    assert(
      successful?.id,
      "signed event must create a successful persisted execution",
    );
    const eventOutput = output(await execution(successful.id), "Capture");
    assert.equal(eventOutput[0].message.id, sourceMessage);
    assert(!JSON.stringify(eventOutput).includes(registration.secret));
    report(
      "valid raw-body HMAC event reaches workflow output without exposing its signing secret",
    );
    await request("POST", "/rest/workflows/" + workflow.id + "/deactivate", {});
    assert.equal(registrations.size, 0);
    assert.equal(deleteCount, 1);
    report("deactivation deletes exactly the endpoint owned by this workflow");
  } catch (error) {
    failure = error;
    process.stderr.write(sanitize(error.stack) + "\n");
  } finally {
    await stopServer();
    if (apiServer) await new Promise((resolve) => apiServer.close(resolve));
    const result = {
      passed: !failure,
      n8n_version: "2.46.6",
      node_version: process.versions.node,
      checks,
      service_backend: "synthetic localhost TLS fixture",
      browser_editor_tested: false,
      production_api_called: false,
      public_tunnel_created: false,
      real_emails_sent: 0,
      remaining_registrations: registrations.size,
      api_request_count: requests.length,
      ...(failure ? { error: sanitize(failure.message) } : {}),
    };
    fs.writeFileSync(
      path.join(resultsDirectory, "result.json"),
      JSON.stringify(result, null, 2) + "\n",
    );
    fs.writeFileSync(path.join(resultsDirectory, "server.log"), sanitize(logs));
    // Preserve only sanitized evidence. Credentials/database pointers stay out of artifacts.
    if (!resultsDirectory.startsWith(directory + path.sep))
      fs.rmSync(directory, { recursive: true, force: true });
    if (failure) process.exitCode = 1;
  }
})();
