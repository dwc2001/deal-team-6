// Supabase Edge Function: POST a card photo, get back the details printed on it.
// Secrets (Supabase dashboard > Edge Functions > Secrets):
//   ANTHROPIC_API_KEY  required
//   TEAM_EMAIL         the shared team login, if not team@dealteam6.app
//   CARD_SCAN_MODEL    optional, e.g. claude-sonnet-5-5 to spend less per card
//   ANTHROPIC_WORKSPACE_ID  needed only if the API key is not tied to a workspace
//                           (an organization-level key); looks like wrkspc_...

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
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

// Ask Supabase Auth who sent this, and only let the team login through.
// (Checked here rather than at the gateway, which works with every kind of
// signing key the project might use.)
const auth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
  auth: { persistSession: false },
});

async function callerEmail(header: string | null): Promise<string> {
  const token = header?.replace(/^Bearer /i, "").trim();
  if (!token) return "";
  const { data, error } = await auth.auth.getUser(token);
  return error || !data.user ? "" : (data.user.email ?? "").toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Use POST." }, 405);
  if ((await callerEmail(req.headers.get("Authorization"))) !== TEAM_EMAIL) {
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

  const workspace = Deno.env.get("ANTHROPIC_WORKSPACE_ID")?.trim();
  const client = new Anthropic({
    apiKey,
    defaultHeaders: workspace ? { "anthropic-workspace-id": workspace } : undefined,
  });
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
      const detail = String((err.error as { error?: { message?: string } } | undefined)?.error?.message ?? err.message);
      console.error("Anthropic API error", err.status, detail);
      if (/anthropic-workspace-id|scoped to a workspace/i.test(detail)) {
        return reply({ error: "The Anthropic API key isn't tied to a workspace. Add the workspace ID (wrkspc_...) as the ANTHROPIC_WORKSPACE_ID secret in Supabase, or use a key created inside a workspace." }, 502);
      }
      if (/credit balance|billing|purchase credits/i.test(detail)) {
        return reply({ error: "The Anthropic account is out of credit. Add credit at console.anthropic.com under Billing, then try again." }, 402);
      }
      return reply({ error: `Claude could not read the card (${err.status ?? "network"}): ${detail.slice(0, 240)}` }, 502);
    }
    console.error("Scan failed", err);
    return reply({ error: err instanceof Error ? err.message : "Scan failed." }, 500);
  }
});
