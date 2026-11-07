const assert = require('node:assert/strict');
const { test, before, afterEach, after } = require('node:test');
const nock = require('nock');
const { sentfromai } = require('../dist/src/index.js');

const KEY = 'unit-test-key';
const origin = 'https://api.sentfrom.ai';
const auth = { type: 'SECRET_TEXT', secret_text: KEY };
const account = {
  name: 'Example Workspace',
  tenant_id: 'tenant-1',
  onboarding_state: 'claimed',
  capabilities: { receive: true, read: true, send: true, manage: true },
};

function memoryStore(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    async get(key) {
      return data.has(key) ? data.get(key) : null;
    },
    async put(key, value) {
      data.set(key, value);
      return value;
    },
    async delete(key) {
      data.delete(key);
    },
    data,
  };
}

function api() {
  return nock(origin, { reqheaders: { authorization: `Bearer ${KEY}` } });
}

function run(actionName, propsValue) {
  return sentfromai.getAction(actionName).run({ auth, propsValue });
}

before(() => {
  nock.disableNetConnect();
});
afterEach(() => {
  const pending = nock.pendingMocks();
  nock.cleanAll();
  assert.deepEqual(pending, [], `Unexpected unused mocks: ${pending.join(', ')}`);
});
after(() => {
  nock.enableNetConnect();
});

test('piece metadata uses bearer secret text and the supported operations', () => {
  assert.equal(sentfromai.displayName, 'SentFromAI');
  assert.equal(sentfromai.auth.type, 'SECRET_TEXT');
  assert.equal(sentfromai.auth.required, true);
  assert.equal(typeof sentfromai.auth.validate, 'function');
  assert.equal(sentfromai.minimumSupportedRelease, '0.82.0');
  assert.deepEqual(Object.keys(sentfromai.actions()).sort(), [
    'create_inbox',
    'get_email',
    'list_inboxes',
    'reply_to_email',
    'search_emails',
    'send_email',
  ]);
  assert.deepEqual(Object.keys(sentfromai.triggers()), ['email_received']);
  for (const name of ['create_inbox', 'send_email', 'reply_to_email']) {
    assert.equal(sentfromai.getAction(name).errorHandlingOptions.retryOnFailure.hide, true);
    assert.equal(sentfromai.getAction(name).aiMetadata.idempotent, false);
  }
  assert.equal(sentfromai.getAction('list_inboxes').aiMetadata.idempotent, true);
  assert.equal(sentfromai.getTrigger('email_received').type, 'POLLING');
});

test('connection check reads the account with a bearer key and does not follow redirects', async () => {
  const seen = [];
  api()
    .get('/v1/account')
    .reply(function () {
      seen.push({
        authorization: this.req.headers.authorization,
        url: this.req.path,
      });
      return [200, account];
    });
  assert.deepEqual(await sentfromai.auth.validate({ auth: KEY }), { valid: true });
  assert.deepEqual(seen, [{ authorization: `Bearer ${KEY}`, url: '/v1/account' }]);
});

test('connection check rejects a bearer prefix and a bad key without exposing the key', async () => {
  assert.deepEqual(await sentfromai.auth.validate({ auth: `Bearer ${KEY}` }), {
    valid: false,
    error: 'Paste the SentFromAI API key by itself. Do not add an authorization scheme or extra spaces.',
  });
  const logs = [];
  const original = console.error;
  console.error = (...args) => logs.push(args);
  try {
    api().get('/v1/account').reply(401, { error: 'invalid token', message: `rejected ${KEY}` });
    const result = await sentfromai.auth.validate({ auth: KEY });
    assert.equal(result.valid, false);
    assert.match(result.error, /invalid, or revoked/);
    assert.equal(result.error.includes(KEY), false);
    const logged = logs
      .map((args) => args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' '))
      .join('\n');
    assert.equal(logged.includes(KEY), false);
    assert.match(logged, /Request failed/);
  } finally {
    console.error = original;
  }
});

test('redirects are not followed', async () => {
  api().get('/v1/account').reply(302, 'redirected', { Location: 'https://evil.example/collect' });
  const result = await sentfromai.auth.validate({ auth: KEY });
  assert.equal(result.valid, false);
  assert.match(result.error, /does not follow redirects/);
  assert.equal(result.error.includes(KEY), false);
});

test('list inboxes returns the collection and dropdown labels', async () => {
  const inboxes = [{ id: 'inbox-1', address: 'agent@mail.sentfrom.ai', local_part: 'agent' }];
  api().get('/v1/inboxes').reply(200, { inboxes });
  assert.deepEqual(await run('list_inboxes', {}), inboxes);
  api().get('/v1/inboxes').reply(200, { inboxes });
  const dropdown = sentfromai.getAction('send_email').props.inboxId;
  assert.deepEqual(await dropdown.options({ auth }), {
    disabled: false,
    options: [{ label: 'agent@mail.sentfrom.ai', value: 'inbox-1' }],
  });
});

test('create inbox normalizes the local part and explains address_taken', async () => {
  let body;
  api()
    .post('/v1/inboxes', (value) => {
      body = value;
      return true;
    })
    .reply(201, { id: 'inbox-1', local_part: 'my-agent', address: 'my-agent@mail.sentfrom.ai' });
  const created = await run('create_inbox', {
    localPart: ' My-Agent ',
    displayName: 'Agent',
    domainId: 'domain-1',
  });
  assert.equal(created.local_part, 'my-agent');
  assert.deepEqual(body, {
    local_part: 'my-agent',
    display_name: 'Agent',
    domain_id: 'domain-1',
  });

  api().post('/v1/inboxes').reply(409, { error: 'address_taken', message: `taken by ${KEY}` });
  await assert.rejects(run('create_inbox', { localPart: 'taken' }), (error) => {
    assert.equal(error.code, 'address_taken');
    assert.match(error.message, /different local part/);
    assert.equal(error.message.includes(KEY), false);
    return true;
  });
});

test('invalid inbox names and empty send fields never reach the API', async () => {
  await assert.rejects(run('create_inbox', { localPart: 'has space' }), /letters, numbers/);
  await assert.rejects(
    run('send_email', {
      inboxId: 'inbox-1',
      to: [{ address: 'not-an-address' }],
      subject: 'Hello',
      text: 'Body',
    }),
    /bare email addresses/,
  );
  await assert.rejects(
    run('send_email', {
      inboxId: 'inbox-1',
      to: [{ address: 'a@example.com' }],
      subject: ' ',
      text: 'Body',
    }),
    /Subject is required/,
  );
  await assert.rejects(
    run('reply_to_email', { messageId: 'message-1', text: ' ', html: '', replyAll: false }),
    /plain-text body/,
  );
});

test('send maps recipients and client id, and preserves an idempotent result', async () => {
  let body;
  api()
    .post('/v1/messages', (value) => {
      body = value;
      return true;
    })
    .reply(201, { id: 'message-1', thread_id: 'thread-1', idempotent: false });
  const sent = await run('send_email', {
    inboxId: 'inbox-1',
    to: [{ address: 'a@example.com, b@example.com' }, { address: 'a@example.com' }],
    cc: [{ address: 'c@example.com' }],
    bcc: [],
    subject: 'Hello',
    text: 'A message',
    html: '',
    clientId: 'order-42-notice',
  });
  assert.deepEqual(body, {
    inbox_id: 'inbox-1',
    to: ['a@example.com', 'b@example.com'],
    subject: 'Hello',
    text: 'A message',
    cc: ['c@example.com'],
    client_id: 'order-42-notice',
  });
  assert.equal(sent.idempotent, false);

  api().post('/v1/messages').reply(201, { id: 'message-1', idempotent: true });
  assert.equal((await run('send_email', {
    inboxId: 'inbox-1',
    to: [{ address: 'a@example.com' }],
    subject: 'Hello',
    text: '',
    html: '<p>Hello</p>',
    clientId: 'order-42-notice',
  })).idempotent, true);
});

test('client id conflict tells the caller not to mint a new key', async () => {
  api().post('/v1/messages').reply(409, {
    error: 'client_id_conflict',
    message: `different body for ${KEY}`,
  });
  await assert.rejects(
    run('send_email', {
      inboxId: 'inbox-1',
      to: [{ address: 'a@example.com' }],
      subject: 'Hello',
      text: 'Changed',
      clientId: 'order-42-notice',
    }),
    (error) => {
      assert.match(error.message, /Do not create a new client ID/);
      assert.equal(error.message.includes(KEY), false);
      return true;
    },
  );
});

test('reply stays on the documented path and does not send client_id', async () => {
  let body;
  let path;
  api()
    .post(/\/v1\/messages\/.*\/reply$/, (value) => {
      body = value;
      return true;
    })
    .reply(function () {
      path = this.req.path;
      return [201, { id: 'reply-1', thread_id: 'thread-1', idempotent: false }];
    });
  await run('reply_to_email', {
    messageId: 'id/with?special',
    text: 'Thanks',
    html: '',
    replyAll: true,
    clientId: 'must-not-be-sent',
  });
  assert.equal(path, '/v1/messages/id%2Fwith%3Fspecial/reply');
  assert.deepEqual(body, { text: 'Thanks', reply_all: true });
  assert.equal('client_id' in body, false);
});

test('get email reads one message and preserves returned fields', async () => {
  const message = {
    id: 'message-1',
    body_text: 'Hello',
    body_html: '<p>Hello</p>',
    attachments: [{ url: 'https://files.example.com/signed' }],
    labels: [{ name: 'Support' }],
  };
  api().get('/v1/messages/message-1').reply(200, message);
  assert.deepEqual(await run('get_email', { messageId: 'message-1' }), message);
});

test('search uses documented parameters once and copies mode_used', async () => {
  let query;
  api()
    .get('/v1/messages')
    .query((value) => {
      query = value;
      return true;
    })
    .reply(200, { mode_used: 'keyword', messages: [{ id: 'message-1' }, { id: 'message-2' }] });
  const result = await run('search_emails', {
    query: 'invoice',
    inboxId: 'inbox-1',
    mode: 'semantic',
    limit: 50,
  });
  assert.deepEqual({ ...query }, {
    query: 'invoice',
    inbox_id: 'inbox-1',
    mode: 'semantic',
    limit: '50',
  });
  assert.equal(Object.hasOwn(query, 'cursor'), false);
  assert.equal(Object.hasOwn(query, 'page'), false);
  assert.equal(result[0].mode_used, 'keyword');
  assert.equal(result.length, 2);

  let recent;
  api()
    .get('/v1/messages')
    .query((value) => {
      recent = value;
      return true;
    })
    .reply(200, { mode_used: 'recent', messages: [] });
  assert.deepEqual(await run('search_emails', { query: ' ', mode: 'keyword', limit: 100 }), []);
  assert.equal(Object.hasOwn(recent, 'query'), false);
  await assert.rejects(
    run('search_emails', { query: 'invoice', mode: 'keyword', limit: 101 }),
    /no cursor/,
  );
});

test('received-email poll deduplicates inside the single 100-message window', async () => {
  const trigger = sentfromai.getTrigger('email_received');
  const state = memoryStore();
  const context = {
    auth,
    propsValue: { inboxId: 'inbox-1' },
    store: state,
    files: {},
    server: {},
  };
  const calls = [];
  const page = (extra = []) => [
    { id: 'old', direction: 'inbound', received_at: '2026-01-01T00:00:00.000Z' },
    { id: 'same', direction: 'inbound', received_at: '2026-01-02T00:00:00.000Z' },
    { id: 'outbound', direction: 'outbound', received_at: '2026-01-03T00:00:00.000Z' },
    { id: 'new', direction: 'inbound', received_at: '2026-01-02T00:00:00.001Z' },
    ...extra,
  ];
  api()
    .get('/v1/messages')
    .query((value) => {
      calls.push(value);
      return true;
    })
    .reply(200, { mode_used: 'recent', messages: page() });
  await trigger.onEnable(context);
  assert.equal(typeof state.data.get('lastPoll'), 'number');
  const baseline = Date.parse('2026-01-02T00:00:00.000Z');
  state.data.set('lastPoll', baseline);
  const first = await trigger.run(context);
  assert.deepEqual(calls.map((query) => ({ ...query })), [{ inbox_id: 'inbox-1', limit: '100' }]);
  assert.equal(Object.hasOwn(calls[0], 'cursor'), false);
  assert.equal(Object.hasOwn(calls[0], 'page'), false);
  assert.equal(Object.hasOwn(calls[0], 'offset'), false);
  assert.deepEqual(first.map((item) => item.id), ['new']);
  assert.equal(state.data.get('lastPoll'), Date.parse('2026-01-02T00:00:00.001Z'));
  assert.ok(state.data.get('lastPoll') > baseline);

  api()
    .get('/v1/messages')
    .query(true)
    .reply(200, { messages: page() });
  assert.deepEqual(await trigger.run(context), []);

  api()
    .get('/v1/messages')
    .query(true)
    .reply(200, {
      messages: page([{ id: 'newer', direction: 'inbound', received_at: '2026-01-04T00:00:00.000Z' }]),
    });
  assert.deepEqual((await trigger.run(context)).map((item) => item.id), ['newer']);
});

test('poll hydrates a missing timestamp once and does not advance without one', async () => {
  const trigger = sentfromai.getTrigger('email_received');
  const state = memoryStore({ lastPoll: Date.parse('2026-01-01T00:00:00.000Z') });
  const context = { auth, propsValue: { inboxId: 'inbox-1' }, store: state, files: {}, server: {} };
  api().get('/v1/messages').query(true).reply(200, {
    messages: [{ id: 'bare', direction: 'inbound' }, { id: 'sent', direction: 'outbound' }],
  });
  api().get('/v1/messages/bare').reply(200, { id: 'bare', received_at: '2026-01-03T00:00:00.000Z' });
  const emitted = await trigger.run(context);
  assert.equal(emitted[0].id, 'bare');
  assert.equal(emitted[0].received_at, '2026-01-03T00:00:00.000Z');

  const frozen = state.data.get('lastPoll');
  api().get('/v1/messages').query(true).reply(200, {
    messages: [{ id: 'untimed', direction: 'inbound' }],
  });
  api().get('/v1/messages/untimed').reply(200, { id: 'untimed' });
  await assert.rejects(trigger.run(context), /was not advanced/);
  assert.equal(state.data.get('lastPoll'), frozen);
});

test('trigger test returns at most five newest inbound messages', async () => {
  const trigger = sentfromai.getTrigger('email_received');
  const messages = Array.from({ length: 6 }, (_, index) => ({
    id: `message-${index}`,
    direction: 'inbound',
    received_at: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
  }));
  api().get('/v1/messages').query(true).reply(200, { messages });
  const sample = await trigger.test({
    auth,
    propsValue: {},
    store: memoryStore(),
    files: {},
    server: {},
  });
  assert.equal(sample.length, 5);
  assert.equal(sample[0].id, 'message-5');
});
