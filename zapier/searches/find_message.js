const { request } = require('../lib/api');
const { inboxField, messageOutput } = require('../lib/fields');
module.exports = {
  key: 'find_message', noun: 'Message',
  display: { label: 'Find Message', description: 'Finds the best matching email using a search query.' },
  operation: {
    inputFields: [
      { key: 'query', label: 'Search Query', required: true, helpText: 'Search email content and subjects.' },
      inboxField(false),
      { key: 'mode', label: 'Search Mode', choices: ['keyword', 'semantic', 'hybrid'], default: 'keyword', helpText: 'Semantic and hybrid modes depend on your plan and fall back to keyword when unavailable.' },
    ],
    perform: async (z, bundle) => {
      const data = bundle.inputData;
      const result = await request(z, '/messages', { params: { query: data.query, inbox_id: data.inbox_id, mode: data.mode || 'keyword', limit: 1 } });
      if (!result.messages.length) return [];
      const message = await request(z, `/messages/${encodeURIComponent(result.messages[0].id)}`);
      return [{ ...message, mode_used: result.mode_used }];
    },
    sample: { ...require('../lib/samples').message, mode_used: 'keyword' },
    outputFields: [...messageOutput, { key: 'mode_used', label: 'Search Mode Used' }],
  },
};
