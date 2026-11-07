const EMAIL = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
const LOCAL_PART = /^[a-z0-9._-]+$/;
const SEARCH_MODES = ['keyword', 'semantic', 'hybrid'] as const;

export type SearchMode = (typeof SEARCH_MODES)[number];

export function apiKey(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error(
      'Enter the SentFromAI API key from the API keys page. Do not include the Bearer prefix.',
    );
  }
  const key = value.trim();
  if (!key || /\s/.test(key) || key.toLowerCase().startsWith('bearer')) {
    throw new Error(
      'Paste the SentFromAI API key by itself. Do not add an authorization scheme or extra spaces.',
    );
  }
  return key;
}

export function requiredText(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

export function optionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function localPart(value: unknown): string {
  const normalized = requiredText(value, 'Local part').toLowerCase();
  if (!LOCAL_PART.test(normalized)) {
    throw new Error(
      'Local part may contain only letters, numbers, dots, underscores, and hyphens.',
    );
  }
  return normalized;
}

export function clientId(value: unknown): string | undefined {
  const id = optionalText(value);
  if (!id) return undefined;
  const bytes = Buffer.byteLength(id, 'utf8');
  if (bytes < 1 || bytes > 255) {
    throw new Error('Client ID must be 1 to 255 UTF-8 bytes.');
  }
  return id;
}

export function searchLimit(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 100) {
    throw new Error(
      'Limit must be an integer from 1 to 100. GET /messages has no cursor or offset, so a larger page cannot be requested.',
    );
  }
  return value;
}

export function searchMode(value: unknown): SearchMode {
  const mode = value === undefined || value === '' ? 'keyword' : value;
  if (mode !== 'keyword' && mode !== 'semantic' && mode !== 'hybrid') {
    throw new Error('Search mode must be keyword, semantic, or hybrid.');
  }
  return mode;
}

function addressItems(value: unknown): string[] {
  if (typeof value === 'string') return value.split(/[;,\n]/);
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === 'string') return addressItems(item);
      if (item && typeof item === 'object' && 'address' in item) {
        return addressItems((item as { address?: unknown }).address);
      }
      return [];
    });
  }
  return [];
}

export function recipients(value: unknown, label: string, required: boolean): string[] | undefined {
  const addresses = [...new Set(addressItems(value).map((address) => address.trim()).filter(Boolean))];
  if (!addresses.length) {
    if (required) {
      throw new Error(
        `${label} needs at least one bare email address. Display names are not supported.`,
      );
    }
    return undefined;
  }
  if (addresses.some((address) => !EMAIL.test(address))) {
    throw new Error(
      `${label} must be bare email addresses, separated by commas. Display names are not supported.`,
    );
  }
  return addresses;
}

export function messageContent(text: unknown, html: unknown): { text?: string; html?: string } {
  const textBody = typeof text === 'string' && text.trim() ? text : undefined;
  const htmlBody = typeof html === 'string' && html.trim() ? html : undefined;
  if (!textBody && !htmlBody) {
    throw new Error('Provide a plain-text body, an HTML body, or both.');
  }
  return {
    ...(textBody ? { text: textBody } : {}),
    ...(htmlBody ? { html: htmlBody } : {}),
  };
}

export function objectCollection<T extends Record<string, unknown>>(
  body: unknown,
  key: string,
): T[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error(`SentFromAI returned an invalid ${key} response.`);
  }
  const items = (body as Record<string, unknown>)[key];
  if (
    !Array.isArray(items) ||
    items.some((item) => !item || typeof item !== 'object' || Array.isArray(item))
  ) {
    throw new Error(`SentFromAI returned an invalid ${key} response.`);
  }
  return items as T[];
}
