const { request, requireBody } = require('../lib/api');
const { inboxField, recipientFields, bodyFields, sendOutput } = require('../lib/fields');
module.exports = {
  key: 'send_email', noun: 'Email',
  display: { label: 'Send Email', description: 'Sends an email from a SentFromAI inbox.' },
  operation: {
    inputFields: [
      inboxField(), ...recipientFields(true),
      { key: 'subject', label: 'Subject', required: true }, ...bodyFields,
      { key: 'client_id', label: 'Unique Send ID', helpText: 'Map a unique ID from the trigger to avoid duplicate sends when Zapier retries. Use a different value for each intended email.' },
    ],
    perform: async (z, bundle) => {
      const data = bundle.inputData;
      requireBody(z, data);
      return request(z, '/messages', { method: 'POST', body: {
        inbox_id: data.inbox_id, to: data.to, cc: data.cc, bcc: data.bcc,
        subject: data.subject, text: data.text, html: data.html, client_id: data.client_id,
      } });
    },
    sample: require('../lib/samples').sent, outputFields: sendOutput,
  },
};
