const { addAuth, handleResponse } = require('./lib/api');
const newInbox = require('./triggers/new_inbox');
const newEmail = require('./triggers/new_email');
const sendEmail = require('./creates/send_email');
const replyToEmail = require('./creates/reply_to_email');
const createInbox = require('./creates/create_inbox');
const createDraft = require('./creates/create_draft');
const getMessage = require('./creates/get_message');
const findMessage = require('./searches/find_message');

module.exports = {
  version: require('./package.json').version,
  platformVersion: require('zapier-platform-core').version,
  authentication: require('./authentication'),
  beforeRequest: [addAuth], afterResponse: [handleResponse],
  flags: { cleanInputData: true },
  triggers: { [newInbox.key]: newInbox, [newEmail.key]: newEmail },
  creates: {
    [sendEmail.key]: sendEmail, [replyToEmail.key]: replyToEmail, [createInbox.key]: createInbox,
    [createDraft.key]: createDraft, [getMessage.key]: getMessage,
  },
  searches: { [findMessage.key]: findMessage },
};
