const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const https = require('node:https');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const originalRequest = https.request;
const originalConsole = console.error;
const originalTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
let directory, server, cert, port;
let optionsForFixture = {}, received = 0, redirectRequests = 0;
const token = 'synthetic-tls-test-key';

// Only the destination is routed to a local TLS server. The connector's TLS
// verification and redirect behavior remain untouched and use real sockets.
https.request = (url, options, callback) => {
  assert.equal(new URL(url).origin, 'https://api.sentfrom.ai');
  assert.equal(options.rejectUnauthorized, true);
  assert.equal(options.agent, false);
  return originalRequest.call(https, new URL(new URL(url).pathname, `https://127.0.0.1:${port}`), {
    ...options, servername: 'localhost', ...optionsForFixture,
  }, callback);
};
const { sentFromAiRequest } = require('../dist/src/lib/common/client.js');
const read = () => sentFromAiRequest({ token, method: 'GET', segments: ['account'] });

before(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sentfromai-activepieces-tls-'));
  const keyPath = path.join(directory, 'key.pem'), certPath = path.join(directory, 'cert.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost', '-keyout', keyPath, '-out', certPath],
    { stdio: 'ignore' });
  cert = fs.readFileSync(certPath);
  server = https.createServer({ key: fs.readFileSync(keyPath), cert }, (req, res) => {
    received++;
    assert.equal(req.headers.authorization, `Bearer ${token}`);
    if (req.url === '/v1/redirect') {
      redirectRequests++;
      res.writeHead(302, { Location: `https://localhost:${port}/should-not-follow` });
      res.end();
      return;
    }
    assert.equal(req.url, '/v1/account');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ name: 'Synthetic TLS workspace' }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
});
after(async () => {
  https.request = originalRequest;
  if (originalTls === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  else process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTls;
  if (server) await new Promise(resolve => server.close(resolve));
  if (directory) fs.rmSync(directory, { recursive: true, force: true });
});

test('untrusted certificates fail even if another piece disabled global TLS checks', async () => {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  optionsForFixture = {};
  const before = received;
  await assert.rejects(read, /self.signed|certificate/i);
  assert.equal(received, before, 'No HTTP data reached an untrusted TLS endpoint');
  assert.equal(process.env.NODE_TLS_REJECT_UNAUTHORIZED, '0');
  assert.equal(console.error, originalConsole);
});

test('trusted certificates still require the correct hostname', async () => {
  optionsForFixture = { ca: cert, servername: 'wrong.example' };
  const before = received;
  await assert.rejects(read, /hostname|altnames|does not match/i);
  assert.equal(received, before);
});

test('concurrent trusted requests work without changing process TLS or logging globals', async () => {
  delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  optionsForFixture = { ca: cert };
  const results = await Promise.all([read(), read()]);
  assert.deepEqual(results, [{ name: 'Synthetic TLS workspace' }, { name: 'Synthetic TLS workspace' }]);
  assert.equal(process.env.NODE_TLS_REJECT_UNAUTHORIZED, undefined);
  assert.equal(console.error, originalConsole);
});

test('real HTTPS redirects fail without forwarding the key to the redirect destination', async () => {
  optionsForFixture = { ca: cert };
  const before = received;
  await assert.rejects(() => sentFromAiRequest({ token, method: 'GET', segments: ['redirect'] }), /does not follow redirects/);
  assert.equal(received, before + 1);
  assert.equal(redirectRequests, 1);
});
