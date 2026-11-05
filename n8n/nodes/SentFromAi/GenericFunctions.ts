import type {
  IDataObject,
  IExecuteFunctions,
  IHookFunctions,
  IHttpRequestMethods,
  ILoadOptionsFunctions,
} from "n8n-workflow";

export async function sentFromAiRequest(
  this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions,
  method: IHttpRequestMethods,
  path: string,
  body?: IDataObject,
  qs?: IDataObject,
): Promise<IDataObject> {
  return (await this.helpers.httpRequestWithAuthentication.call(
    this,
    "sentFromAiApi",
    {
      method,
      url: `https://api.sentfrom.ai/v1${path}`,
      ...(body === undefined ? {} : { body }),
      ...(qs === undefined ? {} : { qs }),
      json: true,
      timeout: 30000,
      // API credentials must never be forwarded to a redirect destination.
      disableFollowRedirect: true,
    },
  )) as IDataObject;
}

export function recipients(value: string): string[] {
  const addresses = value
    .split(/[;,\n]/)
    .map((address) => address.trim())
    .filter(Boolean);
  if (
    !addresses.length ||
    addresses.some(
      (address) => !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(address),
    )
  ) {
    throw new Error(
      "Enter one or more bare email addresses, separated by commas. Display names are not supported.",
    );
  }
  return [...new Set(addresses)];
}

export function nonEmpty(value: string, label: string): string {
  if (!value.trim()) throw new Error(`${label} must not be empty`);
  return value.trim();
}

export function idPath(value: string): string {
  return encodeURIComponent(nonEmpty(value, "ID"));
}

export function messageContent(text: string, html: string): IDataObject {
  if (!text.trim() && !html.trim())
    throw new Error("Provide plain text or HTML message content");
  return { ...(text ? { text } : {}), ...(html ? { html } : {}) };
}

export function responseItems(
  response: IDataObject,
  key: string,
): IDataObject[] {
  const items = response[key];
  if (
    !Array.isArray(items) ||
    items.some(
      (item) =>
        item === null || typeof item !== "object" || Array.isArray(item),
    )
  ) {
    throw new Error(`SentFromAI returned an invalid ${key} response`);
  }
  return items as IDataObject[];
}
