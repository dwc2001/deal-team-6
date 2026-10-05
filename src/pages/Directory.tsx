import { useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BackIcon, CloseIcon, PlusIcon, SearchIcon, StarIcon } from "../components/icons";
import { Empty } from "../components/ui";
import { ContactDetail } from "./ContactDetail";
import { initials, matches, plural } from "../lib/format";
import { roleLine, useCardUrl } from "../lib/contact-utils";
import { useLive, useStore } from "../lib/store";
import { GROUPS, type Contact } from "../lib/types";

type Quick = "preferred" | "referral" | "recent" | "removed";

const QUICK_TITLES: Record<Quick, string> = {
  preferred: "Preferred",
  referral: "Pays referrals",
  recent: "Recently added",
  removed: "Removed",
};

const MONTH = 30 * 86_400_000;
const byName = (a: Contact, b: Contact) =>
  Number(b.preferred) - Number(a.preferred) || (a.name || a.company).localeCompare(b.name || b.company);
const isNew = (c: Contact) => c.added_by !== "Spreadsheet" && Date.now() - new Date(c.created_at).getTime() < MONTH;

export function Directory() {
  const { data, edit } = useStore();
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

  const setParam = (key: string, value: string, replace = true) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "p") next.delete("p");
    setParams(next, { replace });
  };

  // "/" jumps to search from anywhere on the page.
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

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of live.contacts) m.set(c.category, (m.get(c.category) ?? 0) + 1);
    return m;
  }, [live.contacts]);

  const isHome = !category && !q && !quick;

  // Everyone in view before the territory filter.
  const pool = useMemo(() => {
    let list = quick === "removed" ? data.contacts.filter((c) => c.archived) : live.contacts;
    if (category) list = list.filter((c) => c.category === category);
    if (quick === "preferred") list = list.filter((c) => c.preferred);
    if (quick === "referral") list = list.filter((c) => c.pays_referral);
    if (quick === "recent") list = list.filter(isNew);
    if (q) {
      list = list.filter((c) =>
        matches(q, c.name, c.company, c.title, c.category, c.territory, c.notes, c.connection, c.email, c.address),
      );
    }
    return quick === "recent"
      ? [...list].sort((a, b) => b.created_at.localeCompare(a.created_at))
      : [...list].sort(byName);
  }, [data.contacts, live.contacts, category, quick, q]);

  const territories = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of pool) if (c.territory) m.set(c.territory, (m.get(c.territory) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [pool]);

  const shown = territory ? pool.filter((c) => c.territory === territory) : pool;
  const selected = picked ? data.contacts.find((c) => c.id === picked) : undefined;

  useEffect(() => {
    if (picked && window.matchMedia("(max-width: 859px)").matches) window.scrollTo(0, 0);
  }, [picked]);

  const services = counts.size;
  const recent = live.contacts.filter(isNew).length;
  const removedCount = data.contacts.filter((c) => c.archived && (!category || c.category === category)).length;

  const title = category || (quick ? QUICK_TITLES[quick] : q ? "Search" : "Directory");
  const status = (() => {
    if (isHome) {
      return (
        <>
          <b>{plural(live.contacts.length, "person", "people")}</b> across <b>{plural(services, "service")}</b>.
          {recent > 0 && (
            <>
              {" "}
              <Link to="/?f=recent" className="accent"><b className="accent">{recent} added</b></Link> in the last month.
            </>
          )}{" "}
          Search by name, company, or what you need.
        </>
      );
    }
    if (q && !shown.length) return <>Nobody matches "{q}"{category ? ` in ${category}` : ""}.</>;
    const pref = shown.filter((c) => c.preferred).length;
    const refs = shown.filter((c) => c.pays_referral).length;
    const top = territories[0];
    const areaLine =
      top && !territory && shown.length > 1
        ? top[1] === shown.length
          ? ` All cover ${top[0]}.`
          : top[1] > shown.length / 2
            ? ` Most cover ${top[0]}.`
            : ""
        : "";
    return (
      <>
        <b>{plural(shown.length, "person", "people")}</b>
        {q ? ` match "${q}"` : ""}.
        {pref > 0 && quick !== "preferred" && <> <span className="tag-preferred">{pref} preferred</span>.</>}
        {refs > 0 && quick !== "referral" && <> <span className="tag-referral">{refs} {refs === 1 ? "pays" : "pay"} referrals</span>.</>}
        {areaLine}
      </>
    );
  })();

  const addPreset = category ? { category } : undefined;

  return (
    <div className={selected ? "sheet has-pick" : "sheet"}>
      {!isHome && (
        <button className="crumb" onClick={() => navigate("/")}>
          <BackIcon size={16} /> Directory
        </button>
      )}
      <div className="head">
        <div className="head-text">
          <h1 className="title">{title}</h1>
          <p className="status">{status}</p>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={() => edit({ kind: "contact", preset: addPreset })}>
            <PlusIcon /> Add person
          </button>
        </div>
      </div>

      <div className={isHome ? "search home-search" : "search search-sm home-search"} role="search">
        <SearchIcon size={isHome ? 20 : 18} />
        <input
          ref={searchRef}
          type="search"
          value={q}
          onChange={(e) => setParam("q", e.target.value)}
          placeholder={category ? `Search ${category}` : "Who do you need?"}
          aria-label="Search the directory"
          autoComplete="off"
        />
        {q && (
          <button className="icon-btn clear" onClick={() => setParam("q", "")} aria-label="Clear search">
            <CloseIcon size={16} />
          </button>
        )}
      </div>

      {isHome ? (
        <Home counts={counts} contacts={live.contacts} recent={recent} />
      ) : (
        <div className={selected ? "split has-detail" : "split"}>
          <div className="list-col">
            {territories.length > 1 && (
              <div className="filters">
                <select
                  className="select pill-select"
                  value={territory}
                  onChange={(e) => setParam("t", e.target.value)}
                  aria-label="Territory"
                >
                  <option value="">Any territory</option>
                  {territories.map(([t, n]) => (
                    <option key={t} value={t}>
                      {t} ({n})
                    </option>
                  ))}
                </select>
              </div>
            )}
            {shown.length ? (
              <div className="rows">
                {shown.map((c) => (
                  <PersonRow
                    key={c.id}
                    c={c}
                    picked={c.id === picked}
                    showCategory={!category}
                    onPick={() => setParam("p", c.id === picked ? "" : c.id, false)}
                  />
                ))}
              </div>
            ) : (
              <Empty
                title={q ? `Nobody on the roster for "${q}" yet.` : "No one here yet."}
                action={
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn btn-primary" onClick={() => edit({ kind: "contact", preset: addPreset })}>
                      <PlusIcon /> Add someone
                    </button>
                    {category && q && (
                      <button className="btn" onClick={() => navigate(`/?q=${encodeURIComponent(q)}`)}>
                        Search everyone
                      </button>
                    )}
                  </div>
                }
              >
                Know someone good? Add them, or scan their card, so the whole team can find them.
              </Empty>
            )}
            {quick !== "removed" && removedCount > 0 && (
              <p className="more-link">
                <button onClick={() => navigate(`/?f=removed`)}>{plural(removedCount, "removed record")}</button> can be
                restored.
              </p>
            )}
          </div>
          {selected && <ContactDetail c={selected} onClose={() => setParam("p", "", false)} backLabel={title} />}
        </div>
      )}
    </div>
  );
}

function Home({ counts, contacts, recent }: { counts: Map<string, number>; contacts: Contact[]; recent: number }) {
  const { data } = useStore();
  const preferred = contacts.filter((c) => c.preferred).length;
  const referral = contacts.filter((c) => c.pays_referral).length;
  // Every service in use, even one missing from the categories table.
  const known = new Map(data.categories.map((c) => [c.name, c.grp]));
  const inUse = [...counts.keys()].map((name) => {
    const grp = known.get(name) ?? "";
    return { name, grp: GROUPS.includes(grp as never) ? grp : "Everything else" };
  });
  const groups = GROUPS.map((g) => ({
    name: g,
    cats: inUse.filter((c) => c.grp === g).sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.cats.length);

  return (
    <>
      <div className="quick">
        {preferred > 0 && (
          <Link className="chip" to="/?f=preferred">
            <StarIcon size={15} /> Preferred <span className="n">{preferred}</span>
          </Link>
        )}
        {referral > 0 && (
          <Link className="chip" to="/?f=referral">
            Pays referrals <span className="n">{referral}</span>
          </Link>
        )}
        {recent > 0 && (
          <Link className="chip" to="/?f=recent">
            Added recently <span className="n">{recent}</span>
          </Link>
        )}
      </div>
      {groups.length ? (
        <div className="groups">
          {groups.map((g) => (
            <section className="group" key={g.name}>
              <h2>{g.name}</h2>
              {g.cats.map((c) => (
                <Link key={c.name} className="cat" to={`/directory/${encodeURIComponent(c.name)}`}>
                  <span>{c.name}</span>
                  <span className="n">{counts.get(c.name)}</span>
                </Link>
              ))}
            </section>
          ))}
        </div>
      ) : (
        <Empty title="The roster is empty.">Add the first person, or scan a stack of business cards.</Empty>
      )}
    </>
  );
}

function PersonRow({
  c,
  picked,
  showCategory,
  onPick,
}: {
  c: Contact;
  picked: boolean;
  showCategory: boolean;
  onPick: () => void;
}) {
  const photo = useCardUrl(c.card_front);
  return (
    <button className={picked ? "row picked" : "row"} onClick={onPick} aria-pressed={picked}>
      <span className="avatar">{photo ? <img src={photo} alt="" /> : initials(c.name, c.company)}</span>
      <span className="row-main">
        <span className="row-name">
          <span>{c.name || c.company || "Unnamed"}</span>
          {c.preferred && (
            <span className="tag tag-preferred" title="Preferred">
              <StarIcon size={14} />
              <span className="sr-only">Preferred</span>
            </span>
          )}
        </span>
        <span className="row-sub" style={{ display: "block" }}>
          {roleLine(c) || (showCategory ? c.category : c.territory) || " "}
        </span>
      </span>
      <span className="row-meta">
        {showCategory ? (
          <>
            <div className="strong">{c.category}</div>
            <div>{c.territory}</div>
          </>
        ) : (
          <>
            <div className="strong">{c.territory || " "}</div>
            <div>{c.connection ? `Knows: ${c.connection}` : c.pays_referral ? <span className="tag-referral">Pays referrals</span> : " "}</div>
          </>
        )}
      </span>
      <span className="row-meta row-contact">
        <div className="num">{c.phone || " "}</div>
        <div>{c.email || " "}</div>
      </span>
    </button>
  );
}
