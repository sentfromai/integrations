const { request } = require('./lib/api');

module.exports = {
  type: 'custom',
  fields: [{
    key: 'api_key', label: 'API Key', type: 'password', required: true,
    helpText: 'Create an API key on the [SentFromAI API keys page](https://console.sentfrom.ai/keys). Paste the key without the Bearer prefix.',
  }],
  test: async (z) => {
    const account = await request(z, '/account');
    return { name: account.name };
  },
  connectionLabel: '{{bundle.inputData.name}}',
};
