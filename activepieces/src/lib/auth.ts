import { PieceAuth } from '@activepieces/pieces-framework';
import { HttpMethod } from '@activepieces/pieces-common';
import { sentFromAiRequest } from './common/client';
import { publicError } from './common/errors';

export const sentFromAiAuth = PieceAuth.SecretText({
  displayName: 'API Key',
  description: `Create a key in the [SentFromAI API keys page](https://console.sentfrom.ai/keys) and paste it here without the Bearer prefix.

The key is sent only as \`Authorization: Bearer\` to \`https://api.sentfrom.ai\`. Connecting checks \`GET /account\` and does not send email.`,
  required: true,
  validate: async ({ auth }) => {
    try {
      await sentFromAiRequest({
        token: auth,
        method: HttpMethod.GET,
        segments: ['account'],
      });
      return { valid: true };
    } catch (error) {
      const message = publicError(error).message;
      return {
        valid: false,
        error: message,
      };
    }
  },
});
