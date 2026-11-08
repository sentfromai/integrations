// Test-only transport boundary for the real n8n server. The packed connector is
// unchanged: its fixed API destination is redirected to a localhost TLS fixture.
// Never load this file into a production n8n process.
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const { urlToHttpOptions } = require("node:url");
const configuration = JSON.parse(
  fs.readFileSync(process.env.SENTFROMAI_QA_TRANSPORT, "utf8"),
);
const ca = fs.readFileSync(configuration.ca);
const allowed = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
function destination(input, overrides) {
  const base =
    typeof input === "string" || input instanceof URL
      ? urlToHttpOptions(new URL(input))
      : { ...input };
  return { ...base, ...overrides };
}
function wrap(original, protocol) {
  return function request(input, options, callback) {
    const opts = destination(
      input,
      typeof options === "object" ? options : undefined,
    );
    const cb = typeof options === "function" ? options : callback;
    const hostname = String(opts.hostname || opts.host || "localhost").split(
      ":",
    )[0];
    if (hostname === "api.sentfrom.ai") {
      if (protocol !== "https:")
        throw new Error("QA refuses a plaintext SentFromAI API request");
      return original.call(
        this,
        {
          ...opts,
          hostname: "127.0.0.1",
          host: "127.0.0.1",
          port: configuration.port,
          protocol: "https:",
          servername: "localhost",
          ca,
          rejectUnauthorized: true,
          lookup: undefined,
          agent: false,
        },
        cb,
      );
    }
    if (!allowed.has(hostname))
      throw new Error("External networking is disabled in isolated n8n QA");
    return original.call(this, opts, cb);
  };
}
https.request = wrap(https.request, "https:");
http.request = wrap(http.request, "http:");
for (const transport of [http, https])
  transport.get = function get(...args) {
    const request = transport.request(...args);
    request.end();
    return request;
  };
const originalFetch = globalThis.fetch;
if (originalFetch)
  globalThis.fetch = async function fetch(input, init) {
    const url = new URL(
      typeof input === "string" || input instanceof URL ? input : input.url,
    );
    if (url.hostname === "api.sentfrom.ai") {
      if (url.protocol !== "https:")
        throw new Error("QA refuses plaintext API fetch");
      url.hostname = "127.0.0.1";
      url.port = String(configuration.port);
      return originalFetch(
        input instanceof Request ? new Request(url, input) : url,
        init,
      );
    }
    if (!allowed.has(url.hostname))
      throw new Error("External networking is disabled in isolated n8n QA");
    return originalFetch(input, init);
  };
