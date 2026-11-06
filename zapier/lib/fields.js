const inboxField = (required = true) => ({
  key: 'inbox_id', label: 'Inbox', required,
  dynamic: 'new_inbox.id.address',
  helpText: required ? 'Select the sending inbox.' : 'Select one inbox, or leave blank for all inboxes.',
});
const bodyFields = [
  { key: 'text', label: 'Text Body', type: 'text', helpText: 'Plain text email body. Provide this or an HTML body.' },
  { key: 'html', label: 'HTML Body', type: 'text', helpText: 'HTML email body. Provide this or a text body.' },
];
const recipientFields = (required = false) => [
  { key: 'to', label: 'To', type: 'string', list: true, required, helpText: 'Enter one recipient email address per item.' },
  { key: 'cc', label: 'Cc', type: 'string', list: true },
  { key: 'bcc', label: 'Bcc', type: 'string', list: true },
];
const inboxOutput = [
  { key: 'id', label: 'Inbox ID' }, { key: 'address', label: 'Email Address' },
  { key: 'local_part', label: 'Local Part' }, { key: 'display_name', label: 'Display Name' },
];
const messageOutput = [
  { key: 'id', label: 'Message ID' }, { key: 'thread_id', label: 'Thread ID' },
  { key: 'direction', label: 'Direction' }, { key: 'from_addr', label: 'From' },
  { key: 'to_addrs', label: 'To', type: 'string', list: true }, { key: 'subject', label: 'Subject' },
  { key: 'body_text', label: 'Text Body' }, { key: 'body_html', label: 'HTML Body' },
  { key: 'created_at', label: 'Created At', type: 'datetime' },
  { key: 'received_at', label: 'Received At', type: 'datetime' },
  { key: 'sent_at', label: 'Sent At', type: 'datetime' },
];
const sendOutput = [
  { key: 'id', label: 'Message ID' }, { key: 'thread_id', label: 'Thread ID' },
  { key: 'message_id', label: 'Email Message Header ID' },
  { key: 'ses_message_id', label: 'Provider Message ID' },
  { key: 'idempotent', label: 'Previously Sent', type: 'boolean' },
];
module.exports = { inboxField, bodyFields, recipientFields, inboxOutput, messageOutput, sendOutput };
