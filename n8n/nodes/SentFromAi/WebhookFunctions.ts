import { createHmac, timingSafeEqual } from "crypto";

export const webhookEvents = [
  "message.received",
  "message.delivered",
  "message.bounced",
  "message.complained",
  "message.rejected",
] as const;

export function validSignature(
  rawBody: Buffer,
  signature: unknown,
  secret: string,
): boolean {
  if (typeof signature !== "string" || !/^sha256=[a-f0-9]{64}$/.test(signature))
    return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const actual = Buffer.from(signature.slice(7), "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function isNotFound(error: unknown): boolean {
  const detail = error as {
    statusCode?: number;
    httpCode?: string;
    response?: { status?: number; statusCode?: number };
  };
  return (
    detail.statusCode === 404 ||
    detail.httpCode === "404" ||
    detail.response?.status === 404 ||
    detail.response?.statusCode === 404
  );
}
