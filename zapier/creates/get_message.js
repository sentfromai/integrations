const { request } = require('../lib/api');
const { messageOutput } = require('../lib/fields');
module.exports = {
  key: 'get_message', noun: 'Message',
  display: { label: 'Get Message', description: 'Retrieves an email by ID, including its body, labels and attachment links.' },
  operation: {
    inputFields: [{ key: 'message_id', label: 'Message ID', required: true }],
    perform: async (z, bundle) => request(z, `/messages/${encodeURIComponent(bundle.inputData.message_id)}`),
    sample: require('../lib/samples').message, outputFields: messageOutput,
  },
};
