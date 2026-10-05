import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { backend } from "./backend";
import type { Comp, Contact, Dataset, Draft, LinkItem, RowOf, Table } from "./types";

type Status = "checking" | "signed-out" | "loading" | "ready" | "error";

export type Editing =
  | { kind: "contact"; row?: Contact; preset?: Partial<Contact> }
  | { kind: "comp"; row?: Comp }
  | { kind: "link"; row?: LinkItem; preset?: Partial<LinkItem> };

export interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

interface Store {
  status: Status;
  error: string;
  mode: "supabase" | "demo";
  me: string;
  setMe(name: string): void;
  data: Dataset;
  signIn(name: string, passcode: string): Promise<void>;
  signOut(): Promise<void>;
  reload(): Promise<void>;
  save<T extends Table>(table: T, row: Draft<RowOf<T>> & Partial<RowOf<T>>): Promise<RowOf<T>>;
  setArchived(table: Table, id: string, archived: boolean): Promise<void>;
  addCategory(name: string, grp: string): Promise<void>;
  editing: Editing | null;
  edit(editing: Editing | null): void;
  toasts: Toast[];
  toast(message: string, action?: Toast["action"]): void;
  dismissToast(id: number): void;
}

const EMPTY: Dataset = { categories: [], contacts: [], comps: [], links: [] };
const NAME_KEY = "dt6-name";

function storedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState("");
  const [me, setMeState] = useState(storedName);
  const [data, setData] = useState<Dataset>(EMPTY);
  const [editing, edit] = useState<Editing | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const loadedAt = useRef(0);
  const toastId = useRef(0);

  const setMe = useCallback((name: string) => {
    setMeState(name);
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch {
      /* ignore */
    }
  }, []);

  const reload = useCallback(async () => {
    try {
      const next = await backend.loadAll();
      setData(next);
      loadedAt.current = Date.now();
      setStatus("ready");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (/jwt|token|auth/i.test(message)) {
        setStatus("signed-out");
        return;
      }
      setError(message);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    (async () => {
      const ok = (await backend.hasSession()) && Boolean(storedName());
      if (!ok) return setStatus("signed-out");
      setStatus("loading");
      await reload();
    })();
  }, [reload]);

  // Pick up teammates' additions when coming back to the tab.
  useEffect(() => {
    const onFocus = () => {
      if (status === "ready" && Date.now() - loadedAt.current > 60_000) void reload();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [status, reload]);

  const signIn = useCallback(
    async (name: string, passcode: string) => {
      await backend.signIn(passcode);
      setMe(name.trim());
      setStatus("loading");
      await reload();
    },
    [reload, setMe],
  );

  const signOut = useCallback(async () => {
    await backend.signOut();
    setData(EMPTY);
    setStatus("signed-out");
  }, []);

  const save = useCallback(
    async <T extends Table>(table: T, row: Draft<RowOf<T>> & Partial<RowOf<T>>) => {
      const saved = await backend.save(table, row, me || "Someone");
      setData((d) => {
        const list = d[table] as unknown as RowOf<T>[];
        const exists = list.some((r) => r.id === saved.id);
        return { ...d, [table]: exists ? list.map((r) => (r.id === saved.id ? saved : r)) : [...list, saved] };
      });
      return saved;
    },
    [me],
  );

  const setArchived = useCallback(
    async (table: Table, id: string, archived: boolean) => {
      await backend.setArchived(table, id, archived, me || "Someone");
      setData((d) => ({
        ...d,
        [table]: (d[table] as { id: string }[]).map((r) => (r.id === id ? { ...r, archived } : r)),
      }));
    },
    [me],
  );

  const addCategory = useCallback(async (name: string, grp: string) => {
    if (!name) return;
    await backend.addCategory({ name, grp });
    setData((d) => (d.categories.some((c) => c.name === name) ? d : { ...d, categories: [...d.categories, { name, grp }] }));
  }, []);

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (message: string, action?: Toast["action"]) => {
      const id = ++toastId.current;
      setToasts((t) => [...t.slice(-2), { id, message, action }]);
      setTimeout(() => dismissToast(id), action ? 7000 : 3500);
    },
    [dismissToast],
  );

  const value = useMemo<Store>(
    () => ({
      status, error, mode: backend.mode, me, setMe, data, signIn, signOut, reload, save, setArchived,
      addCategory, editing, edit, toasts, toast, dismissToast,
    }),
    [status, error, me, setMe, data, signIn, signOut, reload, save, setArchived, addCategory, editing, toasts, toast, dismissToast],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}

/** Live (not removed) records. */
export function useLive() {
  const { data } = useStore();
  return useMemo(
    () => ({
      contacts: data.contacts.filter((c) => !c.archived),
      comps: data.comps.filter((c) => !c.archived),
      links: data.links.filter((l) => !l.archived),
      categories: data.categories,
    }),
    [data],
  );
}
