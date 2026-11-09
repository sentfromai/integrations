const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { prepare, validateFixture, fingerprint, parseCliResult, assertWritableStep, validatePreparedScope } = require('../scripts/hosted-smoke.cjs');

const fixture = {
  base_url: 'https://api.sentfrom.ai/v1', tenant_id: 'test-only', api_key: 'not-a-real-key',
  inboxes: [{ id: 'a', address: 'a@example.com' }, { id: 'b', address: 'b@example.com' }],
  allowed_recipient_addresses: ['a@example.com', 'b@example.com'],
};

test('preparing twice keeps the original input and retry keys with no networking', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zapier-smoke-plan-'));
  try {
    const fixtureFile = path.join(dir, 'fixture.json');
    const stateFile = path.join(dir, 'state.json');
    fs.writeFileSync(fixtureFile, JSON.stringify(fixture), { mode: 0o600 });
    const original = prepare(fixtureFile, stateFile);
    const repeated = prepare(fixtureFile, stateFile);
    assert.deepEqual(repeated, original);
    assert.notEqual(original.inputs.send.client_id, original.inputs.reply.client_id);
    assert.equal(fs.statSync(stateFile).mode & 0o777, 0o600);
    assert.equal(JSON.stringify(original).includes(fixture.api_key), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('fixture rejects unexpected origins or recipients before any execution', () => {
  assert.throws(() => validateFixture({ ...fixture, base_url: 'https://elsewhere.example' }));
  assert.throws(() => validateFixture({ ...fixture, allowed_recipient_addresses: ['a@example.com', 'outside@example.com'] }));
});

test('uncertain writes cannot be retried or bypassed with changed input', () => {
  const input = { client_id: 'stable-key', text: 'Original text' };
  assert.throws(() => assertWritableStep({ status: 'unknown', input_hash: fingerprint(input) }, input));
  assert.throws(() => assertWritableStep({ status: 'calling', input_hash: fingerprint(input) }, input));
  assert.throws(() => assertWritableStep({ status: 'verified', input_hash: fingerprint(input) }, { ...input, client_id: 'replacement-key' }));
  assert.doesNotThrow(() => assertWritableStep({ status: 'response_received', input_hash: fingerprint(input) }, input));
});

test('CLI parser accepts JSON results and rejects unstructured failures', () => {
  assert.deepEqual(parseCliResult('Preparing\n{"id":"fixture-result"}\n'), { id: 'fixture-result' });
  assert.deepEqual(parseCliResult('[{"id":"fixture-result"}]'), [{ id: 'fixture-result' }]);
  assert.throws(() => parseCliResult('The remote request failed.'));
});

test('edited run inputs cannot introduce an outside recipient or reply-all', () => {
  const state = { run_id: 'fixed-run', inputs: {
    send: { client_id: 'fixed-run:send', inbox_id: 'a', to: ['b@example.com'], subject: 'Controlled test', text: 'Test' },
    reply: { client_id: 'fixed-run:reply', reply_all: false, text: 'Reply' },
  } };
  assert.doesNotThrow(() => validatePreparedScope(state, fixture.inboxes[0], fixture.inboxes[1]));
  const outside = structuredClone(state); outside.inputs.send.to = ['outside@example.com'];
  assert.throws(() => validatePreparedScope(outside, fixture.inboxes[0], fixture.inboxes[1]));
  const all = structuredClone(state); all.inputs.reply.reply_all = true;
  assert.throws(() => validatePreparedScope(all, fixture.inboxes[0], fixture.inboxes[1]));
});
