const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const https = require("node:https");
const { execFileSync, spawn } = require("node:child_process");

test("QA transport uses trusted localhost TLS and refuses external, plaintext, or redirected traffic", async () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "sentfromai-qa-transport-"),
  );
  const ca = path.join(directory, "cert.pem"),
    key = path.join(directory, "key.pem");
  const config = path.join(directory, "openssl.cnf");
  fs.writeFileSync(
    config,
    "[req]\ndistinguished_name=dn\nx509_extensions=ext\nprompt=no\n[dn]\nCN=localhost\n[ext]\nsubjectAltName=DNS:localhost,IP:127.0.0.1\nbasicConstraints=critical,CA:TRUE\n",
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
      config,
    ],
    { stdio: "ignore" },
  );
  let calls = 0,
    redirectTargetCalls = 0;
  const target = https.createServer(
    { key: fs.readFileSync(key), cert: fs.readFileSync(ca) },
    (_req, res) => {
      redirectTargetCalls++;
      res.writeHead(200, { "content-type": "application/json" });
      res.end('{"unexpected_redirect_hop":true}');
    },
  );
  const server = https.createServer(
    { key: fs.readFileSync(key), cert: fs.readFileSync(ca) },
    (req, res) => {
      calls++;
      assert.equal(req.headers.authorization, "Bearer synthetic-test-only");
      if (req.url === "/redirect") {
        res.writeHead(302, {
          location: "https://127.0.0.1:" + target.address().port + "/hop",
        });
        res.end();
        return;
      }
      assert.equal(req.url, "/v1/inboxes");
      res.writeHead(200, { "content-type": "application/json" });
      res.end('{"inboxes":[]}');
    },
  );
  try {
    await new Promise((resolve) => target.listen(0, "127.0.0.1", resolve));
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const transportConfig = path.join(directory, "transport.json");
    fs.writeFileSync(
      transportConfig,
      JSON.stringify({ port: server.address().port, ca }),
    );
    const code = `const assert=require('node:assert/strict');const https=require('node:https');const http=require('node:http');
      (async()=>{
        await new Promise((resolve,reject)=>https.get('https://api.sentfrom.ai/v1/inboxes',{headers:{authorization:'Bearer synthetic-test-only'}},res=>{assert.equal(res.statusCode,200);res.resume();res.on('end',resolve)}).on('error',reject));
        const response=await fetch('https://api.sentfrom.ai/v1/inboxes',{headers:{authorization:'Bearer synthetic-test-only'}});assert.equal(response.status,200);await response.json();
        assert.throws(()=>https.get('https://unauthorized.example.test/'),/External networking/);
        assert.throws(()=>http.get('http://api.sentfrom.ai/v1/inboxes'),/plaintext/);
        await assert.rejects(fetch('https://unauthorized.example.test/'),/External networking/);
        const headers={authorization:'Bearer synthetic-test-only'};
        await assert.rejects(fetch('https://api.sentfrom.ai/redirect',{headers,redirect:'follow',signal:AbortSignal.timeout(3000)}));
        await assert.rejects(fetch(new Request('https://api.sentfrom.ai/redirect',{headers,redirect:'follow'}),{redirect:'follow',signal:AbortSignal.timeout(3000)}));
        await assert.rejects(fetch(new Request('https://127.0.0.1:${server.address().port}/redirect',{headers,redirect:'follow'}),{redirect:'follow',signal:AbortSignal.timeout(3000)}));
      })().catch(error=>{console.error(error);process.exitCode=1});`;
    const child = spawn(
      process.execPath,
      ["--require", path.join(__dirname, "transport.cjs"), "-e", code],
      {
        env: {
          PATH: process.env.PATH,
          NODE_EXTRA_CA_CERTS: ca,
          SENTFROMAI_QA_TRANSPORT: transportConfig,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let diagnostic = "";
    child.stderr.on("data", (data) => {
      diagnostic += data.toString();
    });
    const result = await new Promise((resolve) =>
      child.on("exit", (code, signal) => resolve({ code, signal })),
    );
    assert.equal(result.code, 0, diagnostic);
    assert.equal(calls, 5);
    assert.equal(redirectTargetCalls, 0, "Fetch must not follow any redirect hop");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => target.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
