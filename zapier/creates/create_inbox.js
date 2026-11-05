const { request } = require('../lib/api');
const { inboxOutput } = require('../lib/fields');
module.exports = {
  key: 'create_inbox', noun: 'Inbox',
  display: { label: 'Create Inbox', description: 'Creates a new email inbox for an AI agent or workflow.' },
  operation: {
    inputFields: [
      { key: 'local_part', label: 'Local Part', required: true, helpText: 'The part before @. Use letters, numbers, dots, underscores or hyphens.' },
      { key: 'display_name', label: 'Display Name' },
      { key: 'domain_id', label: 'Domain ID', helpText: 'Optional ID of your verified custom domain. Leave blank to use mail.sentfrom.ai.' },
    ],
    perform: async (z, bundle) => request(z, '/inboxes', { method: 'POST', body: {
      local_part: bundle.inputData.local_part, display_name: bundle.inputData.display_name, domain_id: bundle.inputData.domain_id,
    } }),
    sample: require('../lib/samples').inbox, outputFields: inboxOutput,
  },
};
