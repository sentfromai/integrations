#!/usr/bin/env node
// Explicitly prepared, resumable hosted checks. No network activity on import
// or during `prepare`. Never use this with a customer account or recipient.
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');

const PROJECT = path.resolve(__dirname, '..');
const APP_ID = 249349;
const VERSION = '1.0.1';
const API_BASE = 'https://api.sentfrom.ai/v1';
const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function secureJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
  fs.chmodSync(temporary, 0o600);
  fs.renameSync(temporary, file);
}

function readPrivate(file) {
  assert.equal(fs.statSync(file).mode & 0o077, 0, 'Fixture/state must not be readable by other users.');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function validateFixture(fixture) {
  assert(['https://api.sentfrom.ai', API_BASE].includes(fixture.base_url), 'Unexpected API origin.');
  assert.equal(typeof fixture.api_key, 'string', 'Missing fixture API key.');
  assert.equal(typeof fixture.tenant_id, 'string', 'Missing fixture tenant.');
  assert.equal(fixture.inboxes?.length, 2, 'Exactly two existing test inboxes are required.');
  assert.equal(fixture.allowed_recipient_addresses?.length, 2, 'Exactly two approved recipients are required.');
  const addresses = fixture.inboxes.map(inbox => inbox.address);
  assert.equal(new Set(addresses).size, 2, 'Test inboxes must be distinct.');
  assert.equal(new Set(fixture.inboxes.map(inbox => inbox.id)).size, 2, 'Test inbox IDs must be distinct.');
  assert.deepEqual([...addresses].sort(), [...fixture.allowed_recipient_addresses].sort(), 'Inbox addresses must match the approved recipient list.');
  return { sender: fixture.inboxes[0], receiver: fixture.inboxes[1] };
}

function prepare(fixturePath, statePath) {
  fixturePath = path.resolve(fixturePath);
  statePath = path.resolve(statePath);
  const fixture = readPrivate(fixturePath);
  const { sender, receiver } = validateFixture(fixture);
  if (fs.existsSync(statePath)) {
    const existing = readPrivate(statePath);
    assert.equal(existing.fixture_path, fixturePath, 'Never replace the fixture for a prepared run.');
    assert.equal(existing.version, VERSION);
    assert.equal(existing.app_id, APP_ID);
    return existing;
  }
  const runId = `zapier-${VERSION}-${randomUUID()}`;
  const state = {
    schema: 1, app_id: APP_ID, version: VERSION, fixture_path: fixturePath,
    prepared_at: new Date().toISOString(), run_id: runId,
    fixture_scope_hash: fingerprint({ tenant: fixture.tenant_id, sender, receiver }),
    inputs: {
      send: {
        inbox_id: sender.id, to: [receiver.address], subject: `Controlled ${runId}`,
        text: `Controlled hosted connector check ${runId}. Recipient is the other approved test inbox.`,
        client_id: `${runId}:send`,
      },
      reply: {
        text: `Controlled hosted reply check ${runId}.`, reply_all: false,
        client_id: `${runId}:reply`,
      },
    },
    steps: {},
    limits: [
      'At most one intended new email and one intended reply, only between the existing two approved test inboxes.',
      'Separate same-key replay calls verify idempotency; no replacement retry keys are generated.',
      'No account/inbox/draft creation, webhook registration, or invitation changes.',
      'Hosted CLI invocation does not itself establish enabled-Zap history or publishing approval.',
    ],
  };
  secureJson(statePath, state);
  return state;
}

function parseCliResult(output) {
  const clean = output.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '').trim();
  try { return JSON.parse(clean); } catch {}
  for (const line of clean.split('\n').keys()) {
    const tail = clean.split('\n').slice(line).join('\n').trim();
    if (!/^[\[{]/.test(tail)) continue;
    try { return JSON.parse(tail); } catch {}
  }
  throw new Error('CLI response was not parseable JSON; inspect the private invocation log.');
}

function assertWritableStep(previous, input) {
  if (!previous) return;
  assert.equal(previous.input_hash, fingerprint(input), 'Prepared write input changed; do not switch retry keys or content.');
  assert(['response_received', 'verified'].includes(previous.status), 'Prior write outcome is uncertain. Reconcile it before any further attempt; do not prepare a new run.');
}

function validatePreparedScope(state, sender, receiver) {
  assert.deepEqual(Object.keys(state.inputs.send).sort(), ['client_id', 'inbox_id', 'subject', 'text', 'to']);
  assert.deepEqual(state.inputs.send.to, [receiver.address], 'Prepared send must target only the second test inbox.');
  assert.equal(state.inputs.send.inbox_id, sender.id);
  assert.equal(state.inputs.send.client_id, `${state.run_id}:send`);
  assert.equal(state.inputs.reply.client_id, `${state.run_id}:reply`);
  assert.equal(state.inputs.reply.reply_all, false);
  assert(Object.keys(state.inputs.reply).every(key => ['client_id', 'message_id', 'reply_all', 'text'].includes(key)));
}

async function run(statePath, authenticationId) {
  statePath = path.resolve(statePath);
  const state = readPrivate(statePath);
  const fixture = readPrivate(state.fixture_path);
  const { sender, receiver } = validateFixture(fixture);
  assert.equal(state.app_id, APP_ID);
  assert.equal(state.version, VERSION);
  assert.equal(state.fixture_scope_hash, fingerprint({ tenant: fixture.tenant_id, sender, receiver }), 'Fixture scope changed.');
  validatePreparedScope(state, sender, receiver);
  assert(/^\d+$/.test(authenticationId) && Number(authenticationId) > 0, 'Choose an existing Zapier test-account connection.');
  if (state.authentication_id) assert.equal(state.authentication_id, authenticationId, 'Do not change connections mid-run.');
  state.authentication_id = authenticationId;
  const save = () => secureJson(statePath, state);
  save();

  const appLink = JSON.parse(fs.readFileSync(path.join(PROJECT, '.zapierapprc'), 'utf8'));
  assert.equal(Number(appLink.id), APP_ID, 'Link this project to existing app 249349 first.');
  assert.equal(require('../package.json').version, VERSION, 'Source version must match the tested hosted version.');
  const logs = `${statePath}.logs`;
  fs.mkdirSync(logs, { recursive: true, mode: 0o700 });

  async function apiRead(route) {
    const response = await fetch(`${API_BASE}${route}`, {
      headers: { Authorization: `Bearer ${fixture.api_key}`, Accept: 'application/json' },
      redirect: 'error', signal: AbortSignal.timeout(20_000),
    });
    assert.equal(response.status, 200, 'Read-only fixture verification failed.');
    return response.json();
  }

  function invoke(type, key, input, label) {
    const inputFile = path.join(logs, `${label}.input.json`);
    secureJson(inputFile, input);
    const env = { ...process.env, NO_COLOR: '1', CI: '1' };
    delete env.DEBUG;
    const result = spawnSync(path.join(PROJECT, 'node_modules/.bin/zapier-platform'), [
      'invoke', type, key, '--remote', '--version', VERSION,
      '--authentication-id', authenticationId, '--non-interactive', '--inputData', `@${inputFile}`,
    ], { cwd: PROJECT, env, encoding: 'utf8', timeout: 55_000, maxBuffer: 4 * 1024 * 1024 });
    const log = path.join(logs, `${label}.${Date.now()}.json`);
    secureJson(log, { exit_status: result.status, signal: result.signal, stdout: result.stdout, stderr: result.stderr });
    assert(!result.error && result.status === 0, 'Hosted invocation failed or timed out; inspect private logs.');
    return parseCliResult(result.stdout);
  }

  function writeOnce(label, key, input) {
    const previous = state.steps[label];
    assertWritableStep(previous, input);
    if (previous) return previous.result;
    state.steps[label] = { status: 'calling', input_hash: fingerprint(input), started_at: new Date().toISOString() };
    save(); // Marker and exact prepared input are durable before the write.
    try {
      const result = invoke('create', key, input, label);
      state.steps[label] = { ...state.steps[label], status: 'response_received', result };
      save();
      return result;
    } catch (error) {
      state.steps[label].status = 'unknown';
      save();
      throw error;
    }
  }

  function verified(label) {
    state.steps[label].status = 'verified';
    state.steps[label].verified_at = new Date().toISOString();
    save();
    console.log(JSON.stringify({ step: label, status: 'verified' }));
  }

  // Prove both the saved key and hosted Zapier connection belong to the exact
  // existing fixture before any email action is invoked.
  const account = await apiRead('/account');
  assert.equal(account.tenant_id, fixture.tenant_id);
  assert.equal(account.capabilities?.send, true, 'Test workspace cannot send.');
  const hostedInboxes = invoke('trigger', 'new_inbox', {}, 'connection_scope');
  assert(Array.isArray(hostedInboxes));
  assert(hostedInboxes.some(i => i.id === sender.id && i.address === sender.address));
  assert(hostedInboxes.some(i => i.id === receiver.id && i.address === receiver.address));
  console.log(JSON.stringify({ step: 'connection_scope', status: 'verified' }));

  const sent = writeOnce('send', 'send_email', state.inputs.send);
  assert.equal(typeof sent.id, 'string');
  const storedSend = await apiRead(`/messages/${encodeURIComponent(sent.id)}`);
  assert.equal(storedSend.client_id, state.inputs.send.client_id, 'Retry key was not stored: do not issue the replay.');
  assert.equal(storedSend.direction, 'outbound');
  assert.equal(storedSend.from_addr, sender.address);
  assert.deepEqual(storedSend.to_addrs, [receiver.address]);
  assert.equal(storedSend.body_text, state.inputs.send.text);
  verified('send');
  const sentReplay = writeOnce('send_replay', 'send_email', state.inputs.send);
  assert.equal(sentReplay.id, sent.id);
  assert.equal(sentReplay.idempotent, true);
  verified('send_replay');

  let inbound;
  for (let attempt = 0; attempt < 12; attempt++) {
    const params = new URLSearchParams({ inbox_id: receiver.id, query: state.run_id, mode: 'keyword', limit: '100' });
    const candidates = await apiRead(`/messages?${params}`);
    const candidate = candidates.messages.find(m => m.direction === 'inbound' && m.subject === state.inputs.send.subject);
    if (candidate) { inbound = await apiRead(`/messages/${encodeURIComponent(candidate.id)}`); break; }
    if (attempt < 11) await new Promise(resolve => setTimeout(resolve, 5000));
  }
  if (!inbound) {
    state.pending = 'inbound_delivery'; save();
    console.log(JSON.stringify({ status: 'pending_inbound', safe_to_resume_same_state: true }));
    return;
  }
  assert.equal(inbound.from_addr, sender.address);
  assert.deepEqual(inbound.to_addrs, [receiver.address]);
  if (state.inputs.reply.message_id) assert.equal(state.inputs.reply.message_id, inbound.id);
  state.inputs.reply.message_id = inbound.id;
  delete state.pending;
  save(); // Save source message ID before the first reply.

  const fullMessage = invoke('create', 'get_message', { message_id: inbound.id }, 'get_inbound');
  assert.equal(fullMessage.id, inbound.id);
  const matches = invoke('search', 'find_message', { query: state.run_id, inbox_id: receiver.id, mode: 'keyword' }, 'find_inbound');
  assert(Array.isArray(matches) && matches.some(m => m.id === inbound.id));

  const reply = writeOnce('reply', 'reply_to_email', state.inputs.reply);
  assert.equal(typeof reply.id, 'string');
  const storedReply = await apiRead(`/messages/${encodeURIComponent(reply.id)}`);
  assert.equal(storedReply.client_id, state.inputs.reply.client_id, 'Hosted reply did not retain the key: do not issue the replay.');
  assert.equal(storedReply.from_addr, receiver.address);
  assert.deepEqual(storedReply.to_addrs, [sender.address]);
  assert.equal(storedReply.thread_id, inbound.thread_id);
  assert.equal(storedReply.body_text, state.inputs.reply.text);
  verified('reply');
  const replyReplay = writeOnce('reply_replay', 'reply_to_email', state.inputs.reply);
  assert.equal(replyReplay.id, reply.id);
  assert.equal(replyReplay.idempotent, true);
  verified('reply_replay');
  state.completed_at = new Date().toISOString(); save();
  console.log(JSON.stringify({ status: 'hosted_smoke_passed', version: VERSION, intended_messages: 2,
    limits: 'Not enabled-Zap history, webhook lifecycle, all-eight-operation coverage, or App Directory approval.' }));
}

function argumentsOf(args) {
  const result = { command: args[0] };
  for (let i = 1; i < args.length; i += 2) {
    assert(args[i]?.startsWith('--') && args[i + 1], 'Options require a value.');
    result[args[i].slice(2)] = args[i + 1];
  }
  return result;
}

async function main(args) {
  const options = argumentsOf(args);
  if (options.command === 'prepare') {
    assert(options.fixture && options.state, 'prepare requires --fixture and --state.');
    prepare(options.fixture, options.state);
    console.log(JSON.stringify({ status: 'prepared_only', state_path: path.resolve(options.state), version: VERSION,
      network_calls: 0, planned_intended_messages: 2 }));
  } else if (options.command === 'run') {
    assert(options.state && options['authentication-id'], 'run requires --state and --authentication-id.');
    await run(options.state, options['authentication-id']);
  } else {
    console.log('Prepare only: node scripts/hosted-smoke.cjs prepare --fixture PRIVATE_FIXTURE --state PRIVATE_STATE');
    console.log('After deployment and authorization: node scripts/hosted-smoke.cjs run --state PRIVATE_STATE --authentication-id EXISTING_TEST_CONNECTION_ID');
  }
}

module.exports = { validateFixture, fingerprint, prepare, parseCliResult, assertWritableStep, validatePreparedScope };
if (require.main === module) main(process.argv.slice(2)).catch(() => {
  // Detailed invocation output stays in private files. Never echo API keys,
  // recipient addresses, message bodies, or credential-bearing CLI responses.
  console.error('Stopped. Inspect the private state/log files. Do not replace retry keys or create a new state to bypass an uncertain send.');
  process.exitCode = 1;
});
