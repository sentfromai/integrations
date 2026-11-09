const assert = require('node:assert/strict');
const { test, before, afterEach, after } = require('node:test');
const { createHmac } = require('node:crypto');
const nock = require('nock');
const zapier = require('zapier-platform-core');
const App = require('../index');
const samples = require('../lib/samples');
const appTester = zapier.createAppTester(App);
const authData = { api_key: 'unit-test-key-not-real' };
const origin = 'https://api.sentfrom.ai';
const bundle = (inputData = {}, extra = {}) => ({ authData, inputData, ...extra });
const api = () => nock(origin, { reqheaders: { authorization: `Bearer ${authData.api_key}` } });

before(() => { nock.disableNetConnect(); });
afterEach(() => {
  const pending = nock.pendingMocks();
  nock.cleanAll();
  assert.deepEqual(pending, [], 'Every expected request was made');
});
after(() => nock.enableNetConnect());

test('authentication uses bearer key and exposes only workspace name', async () => {
  api().get('/v1/account').reply(200, { name: 'Example Workspace', tenant_id: 'internal-id', inboxes: [] });
  assert.deepEqual(await appTester(App.authentication.test, bundle()), { name: 'Example Workspace' });
});

test('invalid API key produces reconnectable auth error', async () => {
  api().get('/v1/account').reply(401, { error: 'invalid_api_key' });
  await assert.rejects(appTester(App.authentication.test, bundle()), /invalid or revoked/);
});

test('rate limit returns Zapier throttling error with retry delay', async () => {
  api().get('/v1/inboxes').reply(429, { error: 'rate_limit' }, { 'Retry-After': '45' });
  await assert.rejects(appTester(App.triggers.new_inbox.operation.perform, bundle()), (error) => {
    assert.equal(JSON.parse(error.message).delay, 45);
    assert.equal(error.name, 'ThrottledError');
    return true;
  });
});

test('New Inbox unwraps array and preserves server newest-first order', async () => {
  const rows = [{ ...samples.inbox, id: 'newer' }, samples.inbox];
  api().get('/v1/inboxes').reply(200, { inboxes: rows });
  assert.deepEqual(await appTester(App.triggers.new_inbox.operation.perform, bundle()), rows);
});

test('send handles recipients, html, optional fields and idempotency key', async () => {
  const data = { inbox_id: samples.inbox.id, to: ['recipient@example.com'], cc: ['cc@example.com'], bcc: ['private@example.com'], subject: 'Order update', html: '<p>Your order shipped.</p>', client_id: 'order-123-update' };
  api().post('/v1/messages', data).reply(201, samples.sent);
  assert.deepEqual(await appTester(App.creates.send_email.operation.perform, bundle(data)), samples.sent);
});

test('blank email body is rejected before any request', async () => {
  await assert.rejects(appTester(App.creates.send_email.operation.perform, bundle({ inbox_id: samples.inbox.id, to: ['recipient@example.com'], subject: 'Blank', text: '  ' })), /Provide a text body or an HTML body/);
});

test('send surfaces suppression and abuse API failures', async () => {
  api().post('/v1/messages').reply(422, { error: 'all_recipients_suppressed' });
  await assert.rejects(appTester(App.creates.send_email.operation.perform, bundle({ inbox_id: samples.inbox.id, to: ['recipient@example.com'], subject: 'Update', text: 'Hello' })), /all_recipients_suppressed/);
});

test('reply preserves false and encodes ID path segment', async () => {
  api().post('/v1/messages/unsafe%2Fid/reply', { text: 'Thanks', reply_all: false }).reply(201, samples.sent);
  assert.deepEqual(await appTester(App.creates.reply_to_email.operation.perform, bundle({ message_id: 'unsafe/id', text: 'Thanks', reply_all: false })), samples.sent);
});

test('reply-all explicitly forwards true', async () => {
  api().post(`/v1/messages/${samples.message.id}/reply`, { html: '<p>Thanks everyone</p>', reply_all: true }).reply(201, samples.sent);
  await appTester(App.creates.reply_to_email.operation.perform, bundle({ message_id: samples.message.id, html: '<p>Thanks everyone</p>', reply_all: true }));
});

test('reply preserves caller retry key and returns the server idempotent result', async () => {
  const input = { message_id: samples.message.id, text: 'Approved reply', reply_all: false, client_id: 'support-reply:event-123' };
  const body = { text: input.text, reply_all: false, client_id: input.client_id };
  api().post(`/v1/messages/${samples.message.id}/reply`, body).reply(201, samples.sent);
  api().post(`/v1/messages/${samples.message.id}/reply`, body).reply(201, { ...samples.sent, idempotent: true });
  const first = await appTester(App.creates.reply_to_email.operation.perform, bundle(input));
  const repeated = await appTester(App.creates.reply_to_email.operation.perform, bundle(input));
  assert.equal(repeated.id, first.id);
  assert.equal(repeated.idempotent, true);
});

test('reply surfaces content-conflict and uncertain-send errors without changing the key', async () => {
  for (const code of ['client_id_conflict', 'send_outcome_pending']) {
    const input = { message_id: samples.message.id, text: 'Approved reply', client_id: 'support-reply:event-123' };
    api().post(`/v1/messages/${samples.message.id}/reply`, { text: input.text, reply_all: false, client_id: input.client_id })
      .reply(409, { error: code });
    await assert.rejects(appTester(App.creates.reply_to_email.operation.perform, bundle(input)), (error) => {
      const detail = JSON.parse(error.message);
      assert.equal(detail.status, 409);
      assert.equal(detail.message, code);
      return true;
    });
  }
});

test('create inbox uses optional verified domain', async () => {
  const data = { local_part: 'assistant', display_name: 'Order Assistant', domain_id: 'domain-id' };
  api().post('/v1/inboxes', data).reply(201, samples.inbox);
  assert.deepEqual(await appTester(App.creates.create_inbox.operation.perform, bundle(data)), samples.inbox);
});

test('draft remains unscheduled and never invokes send', async () => {
  const data = { inbox_id: samples.inbox.id, text: 'Review this response', reply_to_message_id: samples.message.id };
  api().post('/v1/drafts', data).reply(201, samples.draft);
  assert.deepEqual(await appTester(App.creates.create_draft.operation.perform, bundle({ ...data, scheduled_at: '2030-01-01T00:00:00Z' })), samples.draft);
});

test('Get Message returns full body and signed attachment data', async () => {
  const data = { ...samples.message, attachments: [{ id: 'attachment-id', filename: 'receipt.pdf', download_url: 'https://example.com/signed-example' }] };
  api().get(`/v1/messages/${samples.message.id}`).reply(200, data);
  assert.deepEqual(await appTester(App.creates.get_message.operation.perform, bundle({ message_id: samples.message.id })), data);
});

test('Find Message exposes actual search mode and hydrates best match', async () => {
  api().get('/v1/messages').query({ query: 'order', mode: 'hybrid', inbox_id: samples.inbox.id, limit: 1 }).reply(200, { mode_used: 'keyword', messages: [{ id: samples.message.id }] });
  api().get(`/v1/messages/${samples.message.id}`).reply(200, samples.message);
  assert.deepEqual(await appTester(App.searches.find_message.operation.perform, bundle({ query: 'order', mode: 'hybrid', inbox_id: samples.inbox.id })), [{ ...samples.message, mode_used: 'keyword' }]);
});

test('Find Message returns an empty array for no match', async () => {
  api().get('/v1/messages').query({ query: 'absent', mode: 'keyword', limit: 1 }).reply(200, { mode_used: 'keyword', messages: [] });
  assert.deepEqual(await appTester(App.searches.find_message.operation.perform, bundle({ query: 'absent' })), []);
});

test('REST hook subscription persists server signing secret', async () => {
  const targetUrl = 'https://hooks.zapier.com/hooks/standard/example/';
  const result = { id: 'webhook-id', url: targetUrl, events: ['message.received'], secret: 'whsec_not-real' };
  api().post('/v1/webhooks', { url: targetUrl, events: ['message.received'] }).reply(201, result);
  assert.deepEqual(await appTester(App.triggers.new_email.operation.performSubscribe, bundle({}, { targetUrl })), result);
});

test('REST hook unsubscribe deletes only the subscribed endpoint', async () => {
  api().delete('/v1/webhooks/webhook-id').reply(204);
  assert.deepEqual(await appTester(App.triggers.new_email.operation.performUnsubscribe, bundle({}, { subscribeData: { id: 'webhook-id' } })), {});
});

const hookBundle = (event, overrides = {}) => {
  const secret = 'whsec_not-real';
  const content = JSON.stringify(event);
  return bundle({}, {
    subscribeData: { id: 'webhook-id', secret },
    rawRequest: { content, headers: { 'Http-X-Sentfromai-Signature': `sha256=${createHmac('sha256', secret).update(content).digest('hex')}` } },
    ...overrides,
  });
};
const event = { event: 'message.received', inbox_id: samples.inbox.id, thread_id: samples.message.thread_id, message: { id: samples.message.id, from: samples.message.from_addr, html_truncated: true } };

test('valid signed hook fetches complete canonical message and stable ID', async () => {
  api().get(`/v1/messages/${samples.message.id}`).reply(200, samples.message);
  assert.deepEqual(await appTester(App.triggers.new_email.operation.perform, hookBundle(event)), [samples.message]);
});

test('tampered webhook rejected before any API request', async () => {
  const data = hookBundle(event);
  data.rawRequest.content += ' ';
  await assert.rejects(appTester(App.triggers.new_email.operation.perform, data), /Invalid SentFromAI webhook signature/);
});

test('missing signature or missing saved secret cannot bypass validation', async () => {
  await assert.rejects(appTester(App.triggers.new_email.operation.perform, hookBundle(event, { subscribeData: {} })), /Missing or invalid/);
  await assert.rejects(appTester(App.triggers.new_email.operation.perform, hookBundle(event, { rawRequest: { content: JSON.stringify(event), headers: {} } })), /Missing or invalid/);
});

test('hook ignores other inboxes and event types without reading data', async () => {
  assert.deepEqual(await appTester(App.triggers.new_email.operation.perform, hookBundle(event, { inputData: { inbox_id: 'other-inbox' } })), []);
  assert.deepEqual(await appTester(App.triggers.new_email.operation.perform, hookBundle({ ...event, event: 'message.sent' })), []);
});

test('editor samples hydrate only recent inbound email with same live schema', async () => {
  api().get('/v1/messages').query({ inbox_id: samples.inbox.id, limit: 100 }).reply(200, { mode_used: 'recent', messages: [{ id: 'outbound', direction: 'outbound' }, { id: samples.message.id, direction: 'inbound' }] });
  api().get(`/v1/messages/${samples.message.id}`).reply(200, samples.message);
  assert.deepEqual(await appTester(App.triggers.new_email.operation.performList, bundle({ inbox_id: samples.inbox.id })), [samples.message]);
});

test('auth middleware never attaches API key to another origin', () => {
  const request = App.beforeRequest[0]({ url: 'https://example.com/file', headers: {} }, {}, bundle());
  assert.equal(request.headers.Authorization, undefined);
});
