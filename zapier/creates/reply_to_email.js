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
    ],
    perform: async (z, bundle) => {
      const data = bundle.inputData;
      requireBody(z, data);
      return request(z, `/messages/${encodeURIComponent(data.message_id)}/reply`, { method: 'POST', body: {
        text: data.text, html: data.html, reply_all: data.reply_all ?? false,
      } });
    },
    sample: require('../lib/samples').sent, outputFields: sendOutput,
  },
};
