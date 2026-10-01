// Twilio transport for the SMS approval channel.
//
// Inbound: X-Twilio-Signature = base64(HMAC-SHA1(authToken, url + sorted(key+value)…))
// over the exact public URL Twilio was configured with plus every POST field,
// sorted by key, concatenated as key then value with no separators.
// (Twilio "Secure webhooks" reference.) Any header, path, or query drift
// therefore fails validation, which is the point.
//
// Outbound: POST https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json
// with basic auth, form fields To, Body and either From or MessagingServiceSid.

const encoder = new TextEncoder();

async function hmacSha1Base64(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export function twilioSignedPayload(url: string, params: Record<string, string>): string {
  const keys = Object.keys(params).sort();
  return url + keys.map((key) => key + params[key]).join("");
}

export async function computeTwilioSignature(
  authToken: string, url: string, params: Record<string, string>,
): Promise<string> {
  return await hmacSha1Base64(authToken, twilioSignedPayload(url, params));
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

// Twilio may sign with or without the trailing port (":443"); accept both
// spellings of the same HTTPS URL, nothing else.
export async function verifyTwilioSignature(input: {
  authToken: string;
  url: string;
  params: Record<string, string>;
  signature: string | null;
}): Promise<boolean> {
  const provided = String(input.signature || "").trim();
  if (!provided || !input.authToken) return false;
  const candidates = new Set<string>([input.url]);
  try {
    const parsed = new URL(input.url);
    if (parsed.protocol === "https:" && !parsed.port) {
      candidates.add(`${parsed.protocol}//${parsed.hostname}:443${parsed.pathname}${parsed.search}`);
    }
  } catch {
    return false;
  }
  for (const candidate of candidates) {
    const expected = await computeTwilioSignature(input.authToken, candidate, input.params);
    if (constantTimeEqual(expected, provided)) return true;
  }
  return false;
}

export function formToRecord(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

export type TwilioSendConfig = {
  accountSid: string;
  authToken: string;
  from?: string;
  messagingServiceSid?: string;
};

export type TwilioSendResult =
  | { ok: true; sid: string; status: string }
  | { ok: false; error: string; retryable: boolean };

export async function sendTwilioSms(
  config: TwilioSendConfig,
  to: string,
  body: string,
  statusCallback?: string,
): Promise<TwilioSendResult> {
  if (!config.accountSid || !config.authToken) {
    return { ok: false, error: "Twilio credentials are not configured", retryable: false };
  }
  if (!config.from && !config.messagingServiceSid) {
    return { ok: false, error: "Twilio sender is not configured", retryable: false };
  }
  const form = new URLSearchParams();
  form.set("To", to);
  form.set("Body", body);
  if (config.messagingServiceSid) form.set("MessagingServiceSid", config.messagingServiceSid);
  else form.set("From", config.from!);
  if (statusCallback) form.set("StatusCallback", statusCallback);

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${config.accountSid}:${config.authToken}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    return { ok: false, error: `Twilio request failed: ${(error as Error).message}`, retryable: true };
  }
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const message = typeof payload.message === "string" ? payload.message : `HTTP ${response.status}`;
    // 4xx from Twilio is a bad number, opt-out, or config problem: do not loop.
    return { ok: false, error: `Twilio ${payload.code ?? response.status}: ${message}`, retryable: response.status >= 500 || response.status === 429 };
  }
  return {
    ok: true,
    sid: typeof payload.sid === "string" ? payload.sid : "",
    status: typeof payload.status === "string" ? payload.status : "queued",
  };
}

export function twiml(message?: string): Response {
  const escaped = message
    ? message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    : "";
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8", "Cache-Control": "no-store" },
  });
}
