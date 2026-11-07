import {
  AuthenticationType,
  HttpMethod,
  httpClient,
  type HttpMessageBody,
} from '@activepieces/pieces-common';
import { SentFromAiError, apiFailure, publicError, redact } from './errors';
import { apiKey, objectCollection } from './validate';

export const SENTFROMAI_API_ORIGIN = 'https://api.sentfrom.ai';
export const SENTFROMAI_API_BASE = `${SENTFROMAI_API_ORIGIN}/v1`;
/** Largest page the messages endpoint is known to return. The live OpenAPI document has no cursor, offset, or page parameter. */
export const MESSAGE_WINDOW = 100;

const activeTokens = new Map<string, number>();
let consoleDepth = 0;
let originalConsoleError: typeof console.error | undefined;

function redactSecrets(value: string): string {
  return [...activeTokens.keys()].reduce((output, token) => redact(output, token), value);
}

function redactLogArg(value: unknown): unknown {
  if (typeof value === 'string') return redactSecrets(value);
  if (value instanceof Error) {
    const copy = new Error(redactSecrets(value.message));
    copy.name = value.name;
    return copy;
  }
  return value;
}

function pushRedaction(token: string): () => void {
  activeTokens.set(token, (activeTokens.get(token) ?? 0) + 1);
  if (consoleDepth === 0) {
    originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      originalConsoleError?.(...args.map(redactLogArg));
    };
  }
  consoleDepth += 1;
  return () => {
    consoleDepth -= 1;
    const remaining = (activeTokens.get(token) ?? 1) - 1;
    if (remaining <= 0) activeTokens.delete(token);
    else activeTokens.set(token, remaining);
    if (consoleDepth === 0 && originalConsoleError) {
      console.error = originalConsoleError;
      originalConsoleError = undefined;
    }
  };
}

function resourcePath(segments: string[]): string {
  return `/${segments.map((segment) => encodeURIComponent(segment)).join('/')}`;
}

export async function sentFromAiRequest<T extends HttpMessageBody>(options: {
  token: string;
  method: HttpMethod;
  segments: string[];
  query?: Record<string, string>;
  body?: Record<string, unknown>;
}): Promise<T> {
  const key = apiKey(options.token);
  const restoreLog = pushRedaction(key);
  const previousTls = process.env['NODE_TLS_REJECT_UNAUTHORIZED'];
  try {
    const response = await httpClient.sendRequest<T>({
      method: options.method,
      url: `${SENTFROMAI_API_BASE}${resourcePath(options.segments)}`,
      authentication: {
        type: AuthenticationType.BEARER_TOKEN,
        token: key,
      },
      headers: { 'User-Agent': 'SentFromAI-Activepieces/0.0.1' },
      queryParams: options.query,
      body: options.body,
      timeout: 30000,
      // A redirect must not receive the bearer key.
      followRedirects: false,
    });
    if (response.status < 200 || response.status >= 300) {
      throw apiFailure(response.status, response.body, key);
    }
    return response.body;
  } catch (error) {
    if (error instanceof SentFromAiError) throw error;
    throw publicError(error, key);
  } finally {
    if (previousTls === undefined) delete process.env['NODE_TLS_REJECT_UNAUTHORIZED'];
    else process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = previousTls;
    restoreLog();
  }
}

export type Inbox = {
  id: string;
  local_part?: string;
  display_name?: string | null;
  address?: string;
};

export async function listInboxes(token: string): Promise<Inbox[]> {
  const body = await sentFromAiRequest<Record<string, unknown>>({
    token,
    method: HttpMethod.GET,
    segments: ['inboxes'],
  });
  const inboxes = objectCollection<Inbox>(body, 'inboxes');
  if (inboxes.some((inbox) => typeof inbox.id !== 'string' || !inbox.id)) {
    throw new SentFromAiError('SentFromAI returned an inbox without an ID.');
  }
  return inboxes;
}

export type MessageSummary = Record<string, unknown> & {
  id?: unknown;
  direction?: unknown;
  received_at?: unknown;
  created_at?: unknown;
};

export function messageEpoch(message: MessageSummary): number | undefined {
  for (const value of [message.received_at, message.created_at]) {
    if (typeof value !== 'string' || !value) continue;
    const epoch = Date.parse(value);
    if (Number.isFinite(epoch)) return epoch;
  }
  return undefined;
}

/**
 * Read the only page GET /messages documents: one limit, no cursor.
 * Inbound messages without a timestamp are read once by ID so dedupe has a time.
 */
export async function listInboundForPoll(
  token: string,
  inboxId: string | undefined,
): Promise<{ epochMilliSeconds: number; data: MessageSummary }[]> {
  const query: Record<string, string> = { limit: String(MESSAGE_WINDOW) };
  if (inboxId) query['inbox_id'] = inboxId;
  const body = await sentFromAiRequest<Record<string, unknown>>({
    token,
    method: HttpMethod.GET,
    segments: ['messages'],
    query,
  });
  const messages = objectCollection<MessageSummary>(body, 'messages');
  const inbound = messages.filter((message) => message.direction === 'inbound');
  const stamped: { epochMilliSeconds: number; data: MessageSummary }[] = [];
  for (const message of inbound) {
    if (typeof message.id !== 'string' || !message.id) {
      throw new SentFromAiError(
        'SentFromAI returned an inbound message without an ID, so the poll cannot deduplicate it. The cursor was not moved.',
      );
    }
    let epoch = messageEpoch(message);
    let data = message;
    if (epoch === undefined) {
      const full = await sentFromAiRequest<MessageSummary>({
        token,
        method: HttpMethod.GET,
        segments: ['messages', message.id],
      });
      epoch = messageEpoch(full);
      if (epoch === undefined) {
        throw new SentFromAiError(
          `Inbound message ${message.id} has no received_at or created_at. The poll was not advanced, so it can be retried when the message has a timestamp.`,
        );
      }
      data = {
        ...message,
        ...(typeof full.received_at === 'string' ? { received_at: full.received_at } : {}),
        ...(typeof full.created_at === 'string' ? { created_at: full.created_at } : {}),
      };
    }
    stamped.push({ epochMilliSeconds: epoch, data });
  }
  stamped.sort((left, right) => right.epochMilliSeconds - left.epochMilliSeconds);
  return stamped;
}
