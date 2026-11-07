import { HttpError } from '@activepieces/pieces-common';

const BEARER_PATTERN = /Bearer\s+\S+/gi;

export class SentFromAiError extends Error {
  readonly status?: number;
  readonly code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'SentFromAiError';
    this.status = status;
    this.code = code;
  }
}

export function redact(value: string, token?: string): string {
  let output = value.replace(BEARER_PATTERN, 'Bearer [redacted]');
  if (token && token.length > 0) {
    output = output.split(token).join('[redacted]');
  }
  return output;
}

function detail(summary: string, message: string | undefined, token?: string): string {
  if (!message) return summary;
  const clean = redact(message, token).trim();
  if (!clean || clean.toLowerCase() === summary.toLowerCase()) return summary;
  return `${summary} ${clean}`;
}

function explain(
  status: number,
  code: string | undefined,
  message: string | undefined,
  token?: string,
): string {
  switch (code) {
    case 'address_taken':
      return detail(
        'That inbox address is already in use. Choose a different local part.',
        message,
        token,
      );
    case 'address_reserved':
      return detail(
        'That inbox local part is reserved. Choose a different local part.',
        message,
        token,
      );
    case 'client_id_conflict':
      return detail(
        'This client ID was already used with different send content. Retry the original content with the same client ID. Do not create a new client ID for an uncertain send.',
        message,
        token,
      );
    case 'send_outcome_pending':
      return detail(
        'SentFromAI has not finished this send. Do not retry it with a new client ID. Check the thread before sending again.',
        message,
        token,
      );
    case 'inbox_limit_reached':
      return detail(
        'The SentFromAI inbox limit has been reached. Upgrade the plan or remove an inbox you no longer need.',
        message,
        token,
      );
    case 'custom_domains_require_paid_plan':
      return detail(
        'Custom domains require a paid SentFromAI plan. Upgrade, or create the inbox on the managed domain by leaving Domain ID empty.',
        message,
        token,
      );
    case 'storage_limit_reached':
      return detail(
        'The SentFromAI attachment storage limit has been reached.',
        message,
        token,
      );
    default:
      break;
  }
  if (status === 401) {
    return detail(
      'The SentFromAI API key is missing, invalid, or revoked. Create a current key in the SentFromAI console and reconnect. Do not retry this key.',
      message,
      token,
    );
  }
  if (status === 403) {
    return detail(
      'SentFromAI refused this action. Check whether the account is unclaimed, suspended, or has sending paused.',
      message,
      token,
    );
  }
  if (status === 402) {
    return detail(
      'A SentFromAI plan limit blocked this request. Review the account billing page.',
      message,
      token,
    );
  }
  if (status === 404) {
    return detail(
      'SentFromAI could not find that resource in this workspace.',
      message,
      token,
    );
  }
  if (status === 409) {
    return detail(
      'SentFromAI reported a conflict. Do not blindly retry; check whether the inbox or message was already created.',
      message,
      token,
    );
  }
  if (status === 413) {
    return detail('SentFromAI rejected the payload as too large.', message, token);
  }
  if (status === 422) {
    return detail(
      'SentFromAI found no deliverable recipients. They may be suppressed after a bounce or complaint, or blocked by a list.',
      message,
      token,
    );
  }
  if (status === 429) {
    return detail(
      'SentFromAI rate-limited the request. Wait before retrying. Do not create another key or account to avoid the limit.',
      message,
      token,
    );
  }
  if (status >= 300 && status < 400) {
    return `SentFromAI returned a redirect (HTTP ${status}). The connector does not follow redirects, so the API key stays on api.sentfrom.ai.`;
  }
  if (status >= 500) {
    return detail(
      `SentFromAI returned HTTP ${status}. Retry a send only with the same client ID and identical content; do not retry a reply until you check the thread.`,
      message,
      token,
    );
  }
  return detail(`SentFromAI returned HTTP ${status}.`, message ?? code, token);
}

function errorFields(body: unknown): { code?: string; message?: string } {
  if (typeof body === 'string') return { message: body };
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  const record = body as Record<string, unknown>;
  const code = record['error'];
  const message = record['message'];
  return {
    code: typeof code === 'string' ? code : undefined,
    message: typeof message === 'string' ? message : undefined,
  };
}

export function apiFailure(status: number, body: unknown, token?: string): SentFromAiError {
  const fields = errorFields(body);
  return new SentFromAiError(explain(status, fields.code, fields.message, token), status, fields.code);
}

export function publicError(error: unknown, token?: string): Error {
  if (error instanceof SentFromAiError) return error;
  if (error instanceof HttpError) {
    return apiFailure(error.response.status, error.response.body, token);
  }
  if (error instanceof Error) {
    return new SentFromAiError(redact(error.message, token));
  }
  return new SentFromAiError('SentFromAI request failed.');
}
