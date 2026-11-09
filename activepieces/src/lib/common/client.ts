import { request } from 'node:https';
import { HttpMethod, type HttpMessageBody } from '@activepieces/pieces-common';
import { SentFromAiError, apiFailure, publicError } from './errors';
import { apiKey, objectCollection } from './validate';

export const SENTFROMAI_API_ORIGIN = 'https://api.sentfrom.ai';
export const SENTFROMAI_API_BASE = `${SENTFROMAI_API_ORIGIN}/v1`;
/** Largest page the messages endpoint is known to return. The live OpenAPI document has no cursor, offset, or page parameter. */
export const MESSAGE_WINDOW = 100;

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
  const url = new URL(`${SENTFROMAI_API_BASE}${resourcePath(options.segments)}`);
  for (const [name, value] of Object.entries(options.query ?? {})) url.searchParams.set(name, value);
  const body = options.body === undefined ? undefined : JSON.stringify(options.body);
  try {
    const response = await new Promise<{ status: number; body: T }>((resolve, reject) => {
      const req = request(url, {
        method: options.method,
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: 'application/json',
          'User-Agent': 'SentFromAI-Activepieces/0.0.1',
          ...(body === undefined ? {} : {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          }),
        },
        // Explicit verification also protects this call if another piece changes
        // NODE_TLS_REJECT_UNAUTHORIZED or the process-wide default HTTPS agent.
        rejectUnauthorized: true,
        agent: false,
        signal: AbortSignal.timeout(30000),
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('error', reject);
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let parsed;
          try { parsed = text.length ? JSON.parse(text) : undefined; }
          catch { parsed = text; }
          resolve({ status: res.statusCode ?? 0, body: parsed });
        });
      });
      req.on('error', reject);
      req.end(body);
    });
    if (response.status < 200 || response.status >= 300) {
      throw apiFailure(response.status, response.body, key);
    }
    return response.body;
  } catch (error) {
    if (error instanceof SentFromAiError) throw error;
    throw publicError(error, key);
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
