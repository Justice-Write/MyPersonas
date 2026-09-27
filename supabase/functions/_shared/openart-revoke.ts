import { OPENART } from "./openart-auth.ts";

export async function revokeOpenArtTokens(tokens: {
  access_token: string;
  refresh_token?: string | null;
  client_id: string;
}, request: typeof fetch = fetch) {
  for (const [token, hint] of [
    [tokens.refresh_token, "refresh_token"],
    [tokens.access_token, "access_token"],
  ]) {
    if (!token) continue;
    const result = await request(OPENART.revoke, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token, token_type_hint: hint!, client_id: tokens.client_id }),
    });
    await result.body?.cancel();
    if (!result.ok) throw new Error("OpenArt could not confirm disconnection. Your connection was retained so you can retry.");
  }
}

