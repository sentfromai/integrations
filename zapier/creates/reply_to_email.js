const { request, requireBody } = require('../lib/api');
const { bodyFields, sendOutput } = require('../lib/fields');
module.exports = {
  key: 'reply_to_email', noun: 'Reply',
  display: { label: 'Reply to Email', description: 'Sends a reply in an existing email thread.' },
  operation: {
    inputFields: [
      { key: 'message_id', label: 'Message ID', required: true, helpText: 'Map the SentFromAI message ID from a trigger or search.' },
      ...bodyFields,
      { key: 'reply_all', label: 'Reply to All', type: 'boolean', default: 'false', helpText: 'Include the original recipients and Cc addresses, excluding your sending inbox.' },
      { key: 'client_id', label: 'Unique Reply ID', helpText: 'Optional retry key (1–255 UTF-8 bytes), unique to this intended reply in your workspace. Keep the same key and content for retries. Do not use a new key after an uncertain send.' },
    ],
    perform: async (z, bundle) => {
      const data = bundle.inputData;
      requireBody(z, data);
      return request(z, `/messages/${encodeURIComponent(data.message_id)}/reply`, { method: 'POST', body: {
        text: data.text, html: data.html, reply_all: data.reply_all ?? false, client_id: data.client_id,
      } });
    },
    sample: require('../lib/samples').sent, outputFields: sendOutput,
  },
};
