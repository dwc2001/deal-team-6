import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MiniCred } from "../components/Credential";
import { BackIcon, CameraIcon, CloseIcon, PlusIcon, SearchIcon, StarIcon } from "../components/icons";
import { Empty } from "../components/ui";
import { Record } from "./Record";
import { matches, plural, when } from "../lib/format";
import { roleLine } from "../lib/contact-utils";
import { setPendingPhotos } from "../lib/pending";
import { useLive, useStore } from "../lib/store";
import { GROUPS, type Contact } from "../lib/types";

type Quick = "preferred" | "referral" | "recent" | "removed";
const QUICK_TITLES: Record<Quick, string> = {
  preferred: "Preferred",
  referral: "Pays referrals",
  recent: "Added this month",
  removed: "Removed",
};
const MONTH = 30 * 86_400_000;
const isNew = (c: Contact) => c.added_by !== "Spreadsheet" && Date.now() - new Date(c.created_at).getTime() < MONTH;
const byName = (a: Contact, b: Contact) =>
  Number(b.preferred) - Number(a.preferred) || (a.name || a.company).localeCompare(b.name || b.company);
const groupOf = (grp: string | undefined) => (grp && (GROUPS as readonly string[]).includes(grp) ? grp : "Everything else");
export const servicePath = (category: string) => `/directory/${encodeURIComponent(category)}`;

export function People() {
  const { data } = useStore();
  const live = useLive();
  const navigate = useNavigate();
  const { category: catParam } = useParams();
  const category = catParam ? decodeURIComponent(catParam) : "";
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const quick = (params.get("f") as Quick | null) ?? null;
  const territory = params.get("t") ?? "";
  const picked = params.get("p") ?? "";
  const searchRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const setParam = (key: string, value: string, replace = true) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "p") next.delete("p");
    setParams(next, { replace });
  };

  // "/" jumps to the search from anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest("input, textarea, select");
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (picked && window.matchMedia("(max-width: 859px)").matches) window.scrollTo(0, 0);
  }, [picked]);

  const isHome = !q && !category && !quick;

  // Drop a card photo anywhere on the page to add someone.
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/"));
    if (files.length) {
      setPendingPhotos(files);
      navigate("/scan");
    }
  };

  return (
    <div
      className="sheet"
      onDragOver={(e) => {
        if ([...e.dataTransfer.types].includes("Files")) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setOver(false)}
      onDrop={onDrop}
      style={over ? { outline: "2px dashed var(--olive)", outlineOffset: 8, borderRadius: 16 } : undefined}
    >
      <div className={picked ? "find has-pick" : "find"}>
        {!isHome && (
          <button className="crumb" onClick={() => navigate("/")} style={{ marginBottom: 2 }}>
            <BackIcon size={16} /> Everyone
          </button>
        )}
        <label className="ask" role="search">
          <SearchIcon size={24} />
          <input
            ref={searchRef}
            type="search"
            value={q}
            onChange={(e) => {
              const v = e.target.value;
              if (category || quick) {
                navigate(v ? `/?q=${encodeURIComponent(v)}` : "/", { replace: true });
              } else setParam("q", v);
            }}
            placeholder="Who do you need?"
            aria-label="Search people, companies and services"
            autoComplete="off"
          />
          {q && (
            <button className="icon-btn" onClick={() => setParam("q", "")} aria-label="Clear the search">
              <CloseIcon size={18} />
            </button>
          )}
        </label>
        {isHome && <FindStrip />}
      </div>

      {isHome ? (
        <>
          <Board />
          <PhoneWords />
        </>
      ) : (
        <Results
          q={q}
          category={category}
          quick={quick}
          territory={territory}
          picked={picked}
          setParam={setParam}
          contacts={quick === "removed" ? data.contacts.filter((c) => c.archived) : live.contacts}
        />
      )}
    </div>
  );
}

function FindStrip() {
  const live = useLive();
  const navigate = useNavigate();
  const recent = useMemo(
    () => live.contacts.filter((c) => c.added_by !== "Spreadsheet").sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 2),
    [live.contacts],
  );
  return (
    <div className="find-strip">
      <span>
        <CameraIcon size={16} /> Met someone? Drop a photo of their card anywhere on this page, or use Add someone.
      </span>
      {recent.length > 0 && (
        <span className="jl">
          Just added
          {recent.map((c) => (
            <button key={c.id} onClick={() => navigate(`${servicePath(c.category)}?p=${c.id}`)}>
              <MiniCred c={c} />
              <b>{c.name || c.company}</b> by {c.added_by || "someone"}, {when(c.created_at)}
            </button>
          ))}
        </span>
      )}
    </div>
  );
}

function useServices() {
  const { data } = useStore();
  const live = useLive();
  return useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of live.contacts) counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
    const grpOf = new Map(data.categories.map((c) => [c.name, groupOf(c.grp)]));
    return GROUPS.map((g) => ({
      name: g,
      services: [...counts.entries()]
        .filter(([c]) => (grpOf.get(c) ?? "Everything else") === g)
        .map(([c, n]) => ({ name: c, count: n }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
      .filter((g) => g.services.length)
      .map((g) => ({ ...g, people: g.services.reduce((t, s) => t + s.count, 0) }));
  }, [data.categories, live.contacts]);
}

/** Every service on one screen: groups packed into balanced columns. */
function Board() {
  const groups = useServices();
  const live = useLive();
  const { data } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(4);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      setCols(w >= 1000 ? 4 : w >= 720 ? 3 : w >= 480 ? 2 : 1);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const columns = useMemo(() => {
    const out = Array.from({ length: cols }, () => ({ h: 0, groups: [] as typeof groups }));
    const order = [...groups].sort((a, b) => b.services.length - a.services.length);
    for (const g of order) {
      const target = out.reduce((min, c) => (c.h < min.h ? c : min), out[0]);
      target.groups.push(g);
      target.h += g.services.length * 48 + 40;
    }
    const rank = (n: string) => (GROUPS as readonly string[]).indexOf(n);
    // Columns read in the groups' own order, left to right.
    return out
      .map((c) => c.groups.sort((a, b) => rank(a.name) - rank(b.name)))
      .sort((a, b) => (a.length ? rank(a[0].name) : 99) - (b.length ? rank(b[0].name) : 99));
  }, [groups, cols]);

  const preferred = live.contacts.filter((c) => c.preferred).length;
  const referral = live.contacts.filter((c) => c.pays_referral).length;
  const recent = live.contacts.filter(isNew).length;
  const removed = data.contacts.filter((c) => c.archived).length;
  const services = groups.reduce((t, g) => t + g.services.length, 0);

  if (!groups.length) {
    return (
      <Empty
        title="Nobody on the list yet."
        action={
          <Link className="btn btn-primary" to="/scan">
            <PlusIcon size={17} /> Add someone
          </Link>
        }
      >
        Scan the first business card, or type someone in.
      </Empty>
    );
  }

  return (
    <section aria-label="Every service">
      <div className="board-head">
        <h2>Everything we have</h2>
        <div className="links">
          <span>{plural(services, "service")}, {plural(live.contacts.length, "person", "people")}</span>
          {preferred > 0 && <Link to="/?f=preferred"><b>{preferred}</b> preferred</Link>}
          {referral > 0 && <Link to="/?f=referral"><b>{referral}</b> pay referrals</Link>}
          {recent > 0 && <Link to="/?f=recent"><b>{recent}</b> added this month</Link>}
          {removed > 0 && <Link to="/?f=removed"><b>{removed}</b> removed</Link>}
        </div>
      </div>
      <div className="board" ref={ref} style={{ ["--cols" as string]: cols }}>
        {columns.map((col, i) => (
          <div className="bcol" key={i}>
            {col.map((g) => (
              <div className="bgroup" key={g.name}>
                <h3>
                  {g.name}
                  <span>{plural(g.people, "person", "people")}</span>
                </h3>
                <div className="tiles">
                  {g.services.map((s) => (
                    <Link key={s.name} className="tile" to={servicePath(s.name)}>
                      <span>{s.name}</span>
                      <i>{s.count}</i>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

/** On a phone: every service, grouped, as words. */
function PhoneWords() {
  const groups = useServices();
  return (
    <div className="pwords">
      {groups.map((g) => (
        <div key={g.name}>
          <h3>{g.name}</h3>
          <p>
            {g.services.map((s) => (
              <Link key={s.name} to={servicePath(s.name)}>
                {s.name}
                <i>{s.count}</i>
              </Link>
            ))}
          </p>
        </div>
      ))}
    </div>
  );
}

function Results({
  q, category, quick, territory, picked, setParam, contacts,
}: {
  q: string;
  category: string;
  quick: Quick | null;
  territory: string;
  picked: string;
  setParam: (k: string, v: string, replace?: boolean) => void;
  contacts: Contact[];
}) {
  const { data } = useStore();
  const navigate = useNavigate();

  const pool = useMemo(() => {
    let list = contacts;
    if (category) list = list.filter((c) => c.category === category);
    if (quick === "preferred") list = list.filter((c) => c.preferred);
    if (quick === "referral") list = list.filter((c) => c.pays_referral);
    if (quick === "recent") list = list.filter(isNew);
    if (q) list = list.filter((c) => matches(q, c.name, c.company, c.title, c.category, c.territory, c.notes, c.connection, c.email));
    return quick === "recent" ? [...list].sort((a, b) => b.created_at.localeCompare(a.created_at)) : [...list].sort(byName);
  }, [contacts, category, quick, q]);

  const territories = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of pool) if (c.territory) m.set(c.territory, (m.get(c.territory) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [pool]);
  const shown = territory ? pool.filter((c) => c.territory === territory) : pool;

  // Searching groups people by service, services whose name matches first.
  const sections = useMemo(() => {
    if (!q || category || quick) return [{ name: "", people: shown }];
    const by = new Map<string, Contact[]>();
    for (const c of shown) by.set(c.category, [...(by.get(c.category) ?? []), c]);
    return [...by.entries()]
      .map(([name, people]) => ({ name, people }))
      .sort((a, b) => Number(matches(q, b.name)) - Number(matches(q, a.name)) || b.people.length - a.people.length || a.name.localeCompare(b.name));
  }, [shown, q, category, quick]);

  const selected = picked ? data.contacts.find((c) => c.id === picked) : undefined;
  const title = category || (quick ? QUICK_TITLES[quick] : "");
  const backLabel = title || "Results";

  const summary = (() => {
    const pref = shown.filter((c) => c.preferred).length;
    const refs = shown.filter((c) => c.pays_referral).length;
    const top = territories[0];
    const parts = [plural(shown.length, "person", "people")];
    if (pref && quick !== "preferred") parts.push(`${pref} preferred`);
    if (refs && quick !== "referral") parts.push(`${refs} ${refs === 1 ? "pays" : "pay"} referrals`);
    if (top && !territory && shown.length > 1 && top[1] === shown.length) parts.push(`all cover ${top[0]}`);
    return parts.join(". ").replace(/^./, (m) => m.toUpperCase()) + ".";
  })();

  return (
    <div className={selected ? "results has-pick" : "results"}>
      <div className="res-col">
        {title && (
          <div className="res-title">
            <h1>{title}</h1>
            <p>{summary}</p>
          </div>
        )}
        {territories.length > 1 && (
          <div className="res-filter">
            <select className="select pill-select" value={territory} onChange={(e) => setParam("t", e.target.value)} aria-label="Territory">
              <option value="">Any territory</option>
              {territories.map(([t, n]) => (
                <option key={t} value={t}>
                  {t} ({n})
                </option>
              ))}
            </select>
          </div>
        )}
        {shown.length === 0 ? (
          <Empty
            title={q ? `Nobody on the list for "${q}" yet.` : "Nobody here yet."}
            action={
              <Link className="btn btn-primary" to="/scan">
                <PlusIcon size={17} /> Add someone
              </Link>
            }
          >
            Know someone good? Scan their card or type them in, so the whole team can find them.
          </Empty>
        ) : (
          sections.map((s) => (
            <section key={s.name || "all"} aria-label={s.name || title || "Results"}>
              {s.name && (
                <div className="res-h">
                  <b>{s.name}</b>
                  <span>{plural(s.people.length, "person", "people")}</span>
                </div>
              )}
              {s.people.map((c) => (
                <button
                  key={c.id}
                  className={c.id === picked ? "prow on" : "prow"}
                  onClick={() => setParam("p", c.id === picked ? "" : c.id, false)}
                  aria-pressed={c.id === picked}
                >
                  <MiniCred c={c} />
                  <span className="pm">
                    <span className="pn">
                      <span>{c.name || c.company}</span>
                      {c.preferred && (
                        <span className="tag tag-preferred">
                          <StarIcon size={13} /> Preferred
                        </span>
                      )}
                    </span>
                    <span className="ps">
                      {(c.name ? roleLine(c) : c.territory) || <span className="empty-sub">{c.name ? "Name only so far" : "Company only so far"}</span>}
                    </span>
                  </span>
                  <span className="pr hide-phone">
                    <span>{c.territory || " "}</span>
                    <span className="num">{c.phone || " "}</span>
                  </span>
                </button>
              ))}
            </section>
          ))
        )}
        {quick !== "removed" && category && data.contacts.some((c) => c.archived && c.category === category) && (
          <p className="more-link">
            <button onClick={() => navigate("/?f=removed")}>Removed people</button> can be restored.
          </p>
        )}
      </div>
      {selected ? (
        <Record key={selected.id} c={selected} onClose={() => setParam("p", "", false)} backLabel={backLabel} />
      ) : (
        <div className="rec-empty" aria-hidden="true">
          <div className="ghost">Pick someone to open their credential.</div>
        </div>
      )}
    </div>
  );
}
