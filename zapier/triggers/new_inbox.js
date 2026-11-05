const { request } = require('../lib/api');
const { inboxOutput } = require('../lib/fields');
module.exports = {
  key: 'new_inbox', noun: 'Inbox',
  display: { label: 'New Inbox', description: 'Triggers when a new email inbox is created.' },
  operation: {
    type: 'polling',
    perform: async (z) => (await request(z, '/inboxes')).inboxes,
    sample: require('../lib/samples').inbox, outputFields: inboxOutput,
  },
};
