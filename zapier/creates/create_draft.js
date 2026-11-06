const { request } = require('../lib/api');
const { inboxField, recipientFields, bodyFields } = require('../lib/fields');
module.exports = {
  key: 'create_draft', noun: 'Draft',
  display: { label: 'Create Draft', description: 'Creates an unsent email draft for review.' },
  operation: {
    inputFields: [
      inboxField(), ...recipientFields(), { key: 'subject', label: 'Subject' }, ...bodyFields,
      { key: 'reply_to_message_id', label: 'Reply to Message ID', helpText: 'Optional message ID to inherit its email thread, recipients and subject.' },
    ],
    perform: async (z, bundle) => {
      const data = bundle.inputData;
      return request(z, '/drafts', { method: 'POST', body: {
        inbox_id: data.inbox_id, to: data.to, cc: data.cc, bcc: data.bcc,
        subject: data.subject, text: data.text, html: data.html, reply_to_message_id: data.reply_to_message_id,
      } });
    },
    sample: require('../lib/samples').draft,
    outputFields: [
      { key: 'id', label: 'Draft ID' }, { key: 'inbox_id', label: 'Inbox ID' },
      { key: 'to_addrs', label: 'To', type: 'string', list: true }, { key: 'subject', label: 'Subject' },
      { key: 'status', label: 'Status' }, { key: 'scheduled_at', label: 'Scheduled At', type: 'datetime' },
    ],
  },
};
