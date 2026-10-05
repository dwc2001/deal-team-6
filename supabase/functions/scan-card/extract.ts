// Reads business cards out of a photo with Claude. Shared by the Supabase Edge
// Function (index.ts, Deno) and the local dev server (vite.config.ts, Node);
// each caller passes in its own Anthropic client.

import type Anthropic from "@anthropic-ai/sdk";

export const DEFAULT_MODEL = "claude-opus-5-5";

export interface ScanImage {
  /** base64, no data: prefix */
  data: string;
  media_type: "image/jpeg" | "image/png" | "image/webp";
}

export interface ScanRequest {
  image: ScanImage;
  /** Services already in the directory, so Claude files the card under one of them. */
  categories: string[];
}

export interface ScannedCard {
  name: string;
  title: string;
  company: string;
  phone: string;
  phone_alt: string;
  email: string;
  website: string;
  address: string;
  territory: string;
  category: string;
  category_is_new: boolean;
  notes: string;
}

const FIELDS: Record<keyof ScannedCard, { type: string; description: string }> = {
  name: { type: "string", description: "Full name of the person." },
  title: { type: "string", description: "Job title as printed." },
  company: { type: "string", description: "Company name as printed." },
  phone: { type: "string", description: "Best number to reach them: mobile or direct first, formatted (301) 555-0100." },
  phone_alt: { type: "string", description: "One other number (office or main line), same format." },
  email: { type: "string", description: "Email address, lowercase." },
  website: { type: "string", description: "Website without https://." },
  address: { type: "string", description: "Mailing or office address on one line." },
  territory: { type: "string", description: "Area they cover: DC, MD, VA, DMV (the DC area), National, or a state, if the card or address makes it clear." },
  category: { type: "string", description: "The service this person provides, picked from the team's list when one fits." },
  category_is_new: { type: "boolean", description: "True when no service on the team's list fits and category is a new name." },
  notes: { type: "string", description: "One short line on specialties, licenses or services printed on the card." },
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["cards"],
  properties: {
    cards: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: Object.keys(FIELDS),
        properties: FIELDS,
      },
    },
  },
};

const SYSTEM =
  "You read photos of business cards for a commercial real estate team's shared directory of vendors " +
  "and referral partners, and return what is printed on each card as structured data.";

function instructions(categories: string[]): string {
  return [
    "Read every business card in this photo. Return one entry per card; a photo may hold several cards, or one card's back.",
    "Copy only what is printed. Use an empty string for anything not on the card, and never invent a phone number, email or website.",
    `For category, choose the best fit from the team's services: ${categories.join("; ")}.`,
    'If none fits, give a short new service name in the same style (for example "Roofing" or "Plumbing") and set category_is_new to true.',
    "If the photo has no business card in it, return an empty cards list.",
  ].join("\n");
}

function clean(card: ScannedCard): ScannedCard {
  const trim = (s: unknown) => (typeof s === "string" ? s.trim() : "");
  return {
    name: trim(card.name),
    title: trim(card.title),
    company: trim(card.company),
    phone: trim(card.phone),
    phone_alt: trim(card.phone_alt),
    email: trim(card.email).toLowerCase(),
    website: trim(card.website).replace(/^https?:\/\//i, "").replace(/\/$/, ""),
    address: trim(card.address),
    territory: trim(card.territory),
    category: trim(card.category),
    category_is_new: Boolean(card.category_is_new),
    notes: trim(card.notes),
  };
}

export async function extractCards(
  client: Anthropic,
  req: ScanRequest,
  opts: { model?: string } = {},
): Promise<{ cards: ScannedCard[] }> {
  const request = {
    model: opts.model || DEFAULT_MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { effort: "low" as const, format: { type: "json_schema" as const, schema: SCHEMA } },
    messages: [
      {
        role: "user" as const,
        content: [
          { type: "image" as const, source: { type: "base64" as const, media_type: req.image.media_type, data: req.image.data } },
          { type: "text" as const, text: instructions(req.categories) },
        ],
      },
    ],
  };

  let response;
  try {
    // If a safety classifier ever declines a card photo, retry it on the
    // model Anthropic recommends instead of failing the scan.
    response = await client.beta.messages.create({
      ...request,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
  } catch (err) {
    const e = err as { status?: number; message?: string };
    if (e.status !== 400 || !/fallback/i.test(e.message ?? "")) throw err;
    // The fallback option is not available for this model or account: scan without it.
    response = await client.beta.messages.create(request);
  }

  if (response.stop_reason === "refusal") {
    throw new Error("Claude could not read this photo. Try another shot of the card.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("That photo had more on it than the scanner could read in one go. Try fewer cards per photo.");
  }
  const text = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
  const parsed = JSON.parse(text) as { cards: ScannedCard[] };
  return { cards: (parsed.cards ?? []).map(clean) };
}
