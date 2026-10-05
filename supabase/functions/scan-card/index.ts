// Supabase Edge Function: POST a card photo, get back the details printed on it.
// Secrets (Supabase dashboard > Edge Functions > Secrets):
//   ANTHROPIC_API_KEY  required
//   TEAM_EMAIL         the shared team login, if not team@dealteam6.app
//   CARD_SCAN_MODEL    optional, e.g. claude-sonnet-5-5 to spend less per card

import Anthropic from "@anthropic-ai/sdk";
import { extractCards, type ScanRequest } from "./extract.ts";

const TEAM_EMAIL = (Deno.env.get("TEAM_EMAIL") ?? "team@dealteam6.app").toLowerCase();
const MAX_IMAGE_CHARS = 8_000_000; // about 6 MB of base64

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// Supabase has already checked the token's signature; make sure it is the team login.
function emailFromAuth(header: string | null): string {
  try {
    const payload = header?.replace(/^Bearer /i, "").split(".")[1] ?? "";
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return String(JSON.parse(json).email ?? "").toLowerCase();
  } catch {
    return "";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Use POST." }, 405);
  if (emailFromAuth(req.headers.get("Authorization")) !== TEAM_EMAIL) {
    return reply({ error: "Sign in to Deal Team 6 first." }, 401);
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return reply({ error: "The card scanner is not set up yet. Add ANTHROPIC_API_KEY in Supabase." }, 501);

  let body: ScanRequest;
  try {
    body = await req.json();
  } catch {
    return reply({ error: "Send the photo as JSON." }, 400);
  }
  if (!body?.image?.data || body.image.data.length > MAX_IMAGE_CHARS) {
    return reply({ error: "Photo missing or too large." }, 400);
  }

  const client = new Anthropic({ apiKey });
  try {
    const result = await extractCards(client, {
      image: body.image,
      categories: Array.isArray(body.categories) ? body.categories.slice(0, 200) : [],
    }, { model: Deno.env.get("CARD_SCAN_MODEL") ?? undefined });
    return reply(result);
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return reply({ error: "The scanner is busy. Try again in a minute." }, 429);
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return reply({ error: "The scanner's Anthropic API key is not valid." }, 502);
    }
    if (err instanceof Anthropic.APIError) {
      return reply({ error: `Claude returned an error (${err.status ?? "network"}). Try again.` }, 502);
    }
    return reply({ error: err instanceof Error ? err.message : "Scan failed." }, 500);
  }
});
