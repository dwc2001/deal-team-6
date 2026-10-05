// Where the data lives. With Supabase settings present the app reads and writes
// the shared database; without them it runs in demo mode, keeping everything in
// this browser so the app can be tried before Supabase is set up.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ScannedCard, ScanImage } from "../../supabase/functions/scan-card/extract";
import type { Category, Dataset, Draft, RowOf, Table } from "./types";
import { SAMPLE_DATA } from "./sample";

export type { ScannedCard, ScanImage };

export interface Backend {
  mode: "supabase" | "demo";
  hasSession(): Promise<boolean>;
  signIn(passcode: string): Promise<void>;
  signOut(): Promise<void>;
  loadAll(): Promise<Dataset>;
  save<T extends Table>(table: T, row: Draft<RowOf<T>> & Partial<RowOf<T>>, by: string): Promise<RowOf<T>>;
  setArchived(table: Table, id: string, archived: boolean, by: string): Promise<void>;
  addCategory(category: Category): Promise<void>;
  uploadCard(photo: Blob): Promise<string>;
  cardUrl(ref: string): Promise<string>;
  scan(image: ScanImage, categories: string[]): Promise<ScannedCard[]>;
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const TEAM_EMAIL = ((import.meta.env.VITE_TEAM_EMAIL as string | undefined) || "team@dealteam6.app").toLowerCase();

const now = () => new Date().toISOString();

// ------------------------------------------------------------------ Supabase
function supabaseBackend(client: SupabaseClient): Backend {
  const signed = new Map<string, { url: string; expires: number }>();

  async function scanError(error: unknown): Promise<Error> {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const body = await ctx.json();
        if (body?.error) return new Error(body.error);
      } catch {
        /* fall through */
      }
    }
    return new Error("The scanner could not be reached. Check your connection and try again.");
  }

  return {
    mode: "supabase",
    async hasSession() {
      const { data } = await client.auth.getSession();
      return Boolean(data.session);
    },
    async signIn(passcode) {
      const { error } = await client.auth.signInWithPassword({ email: TEAM_EMAIL, password: passcode });
      if (error) {
        throw new Error(/invalid/i.test(error.message) ? "That passcode is not right." : error.message);
      }
    },
    async signOut() {
      await client.auth.signOut();
    },
    async loadAll() {
      const [categories, contacts, comps, links] = await Promise.all([
        client.from("categories").select("name, grp").order("name"),
        client.from("contacts").select("*").order("name"),
        client.from("comps").select("*").order("sign_date", { ascending: false, nullsFirst: false }),
        client.from("links").select("*").order("sort"),
      ]);
      const failed = [categories, contacts, comps, links].find((r) => r.error);
      if (failed?.error) throw new Error(failed.error.message);
      return {
        categories: categories.data ?? [],
        contacts: contacts.data ?? [],
        comps: comps.data ?? [],
        links: links.data ?? [],
      } as Dataset;
    },
    async save(table, row, by) {
      const { id, created_at: _c, updated_at: _u, ...fields } = row as Record<string, unknown>;
      const query = id
        ? client.from(table).update({ ...fields, updated_by: by }).eq("id", id as string)
        : client.from(table).insert({ ...fields, added_by: by });
      const { data, error } = await query.select().single();
      if (error) throw new Error(error.message);
      return data;
    },
    async setArchived(table, id, archived, by) {
      const { error } = await client.from(table).update({ archived, updated_by: by }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    async addCategory(category) {
      const { error } = await client.from("categories").upsert(category, { onConflict: "name", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    },
    async uploadCard(photo) {
      const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.jpg`;
      const { error } = await client.storage.from("cards").upload(path, photo, { contentType: "image/jpeg" });
      if (error) throw new Error(error.message);
      return path;
    },
    async cardUrl(ref) {
      const hit = signed.get(ref);
      if (hit && hit.expires > Date.now()) return hit.url;
      const { data, error } = await client.storage.from("cards").createSignedUrl(ref, 3600);
      if (error || !data) throw new Error(error?.message ?? "Card photo unavailable.");
      signed.set(ref, { url: data.signedUrl, expires: Date.now() + 50 * 60_000 });
      return data.signedUrl;
    },
    async scan(image, categories) {
      const { data, error } = await client.functions.invoke("scan-card", { body: { image, categories } });
      if (error) throw await scanError(error);
      return (data?.cards ?? []) as ScannedCard[];
    },
  };
}

// ---------------------------------------------------------------------- Demo
const DEMO_KEY = "dt6-demo-data-v1";
const DEMO_SESSION = "dt6-demo-session";

async function demoSeed(): Promise<Dataset> {
  // On a developer's machine, demo mode starts from the imported spreadsheet
  // (data/seed.local.json, never committed). Production builds only ever
  // contain the made-up sample records.
  if (import.meta.env.DEV) {
    const found = import.meta.glob<Dataset>("../../data/seed.local.json", { import: "default" });
    const load = Object.values(found)[0];
    if (load) return structuredClone(await load());
  }
  return structuredClone(SAMPLE_DATA);
}

function demoBackend(): Backend {
  let cache: Dataset | null = null;

  const read = async (): Promise<Dataset> => {
    if (cache) return cache;
    try {
      const stored = localStorage.getItem(DEMO_KEY);
      if (stored) return (cache = JSON.parse(stored));
    } catch {
      /* storage blocked: fall back to the seed */
    }
    return (cache = await demoSeed());
  };
  const write = (data: Dataset) => {
    cache = data;
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify(data));
    } catch {
      /* full or blocked: keep the in-memory copy */
    }
  };

  return {
    mode: "demo",
    async hasSession() {
      try {
        return localStorage.getItem(DEMO_SESSION) === "1";
      } catch {
        return false;
      }
    },
    async signIn() {
      try {
        localStorage.setItem(DEMO_SESSION, "1");
      } catch {
        /* ignore */
      }
    },
    async signOut() {
      try {
        localStorage.removeItem(DEMO_SESSION);
      } catch {
        /* ignore */
      }
    },
    async loadAll() {
      return structuredClone(await read());
    },
    async save(table, row, by) {
      const data = await read();
      const list = data[table] as unknown as RowOf<typeof table>[];
      const existing = row.id ? list.find((r) => r.id === row.id) : undefined;
      const saved = existing
        ? { ...existing, ...row, updated_by: by, updated_at: now() }
        : { ...row, id: crypto.randomUUID(), added_by: by, updated_by: "", archived: false, created_at: now(), updated_at: now() };
      const next = existing ? list.map((r) => (r.id === saved.id ? saved : r)) : [...list, saved];
      write({ ...data, [table]: next });
      return structuredClone(saved) as never;
    },
    async setArchived(table, id, archived, by) {
      const data = await read();
      const list = data[table] as { id: string }[];
      write({ ...data, [table]: list.map((r) => (r.id === id ? { ...r, archived, updated_by: by, updated_at: now() } : r)) });
    },
    async addCategory(category) {
      const data = await read();
      if (data.categories.some((c) => c.name === category.name)) return;
      write({ ...data, categories: [...data.categories, category] });
    },
    async uploadCard(photo) {
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(photo);
      });
    },
    async cardUrl(ref) {
      return ref;
    },
    async scan(image, categories) {
      const res = await fetch("./api/scan-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, categories }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error ?? "Scanning needs the Supabase setup (or npm run dev with an API key).");
      }
      return (body?.cards ?? []) as ScannedCard[];
    },
  };
}

export const backend: Backend = url && anonKey ? supabaseBackend(createClient(url, anonKey)) : demoBackend();

export function resetDemoData() {
  try {
    localStorage.removeItem(DEMO_KEY);
  } catch {
    /* ignore */
  }
}
