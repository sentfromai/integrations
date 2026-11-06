const { createHmac, timingSafeEqual } = require('node:crypto');
const { request } = require('../lib/api');
const { inboxField, messageOutput } = require('../lib/fields');

const getMessage = (z, id) => request(z, `/messages/${encodeURIComponent(id)}`);

const perform = async (z, bundle) => {
  const raw = bundle.rawRequest;
  const headers = raw?.headers || {};
  // Zapier prefixes custom raw headers with Http- in production.
  const signatureKey = Object.keys(headers).find((key) => key.toLowerCase().replace(/^http-/, '') === 'x-sentfromai-signature');
  const signature = signatureKey ? headers[signatureKey] : '';
  const secret = bundle.subscribeData?.secret;
  // Verify exact bytes; re-serializing cleanedRequest changes signed content.
  if (typeof raw?.content !== 'string' || typeof secret !== 'string' || !/^sha256=[a-f0-9]{64}$/.test(signature)) {
    throw new z.errors.Error('Missing or invalid SentFromAI webhook signature.', 'InvalidWebhookSignature', 401);
  }
  const expected = `sha256=${createHmac('sha256', secret).update(raw.content).digest('hex')}`;
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new z.errors.Error('Invalid SentFromAI webhook signature.', 'InvalidWebhookSignature', 401);
  }
  const event = JSON.parse(raw.content);
  if (event.event !== 'message.received') return [];
  if (bundle.inputData.inbox_id && event.inbox_id !== bundle.inputData.inbox_id) return [];
  if (!event.message?.id) throw new z.errors.Error('Received an email event without a message ID.', 'InvalidWebhookPayload', 400);
  // Canonical API output matches editor samples, including full untruncated body.
  const message = await getMessage(z, event.message.id);
  return message.direction === 'inbound' ? [message] : [];
};

module.exports = {
  key: 'new_email', noun: 'Email',
  display: { label: 'New Email Received', description: 'Triggers when an email is received in a SentFromAI inbox.' },
  operation: {
    type: 'hook', inputFields: [inboxField(false)], perform,
    performSubscribe: async (z, bundle) => request(z, '/webhooks', {
      method: 'POST', body: { url: bundle.targetUrl, events: ['message.received'] },
    }),
    performUnsubscribe: async (z, bundle) => {
      await request(z, `/webhooks/${encodeURIComponent(bundle.subscribeData.id)}`, { method: 'DELETE' });
      return {};
    },
    performList: async (z, bundle) => {
      const result = await request(z, '/messages', { params: { inbox_id: bundle.inputData.inbox_id, limit: 100 } });
      const recent = result.messages.filter((message) => message.direction === 'inbound').slice(0, 3);
      return Promise.all(recent.map((message) => getMessage(z, message.id)));
    },
    sample: require('../lib/samples').message, outputFields: messageOutput,
  },
};
