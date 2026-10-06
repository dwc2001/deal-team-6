import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArchiveIcon, BackIcon, CloseIcon, DownloadIcon, EditIcon, PlusIcon, RestoreIcon, SearchIcon,
} from "../components/icons";
import { Empty } from "../components/ui";
import { dayOf, downloadFile, matches, median, monthOf, plural, rate, sqft, term, toCsv } from "../lib/format";
import { useLive, useStore } from "../lib/store";
import type { Comp } from "../lib/types";

const compDate = (c: Comp) => c.sign_date ?? c.start_date;
const area = (c: Comp) => c.submarket || c.city;
/** "Retail (Restaurant) in Adams Morgan, Call Your Mother" */
const describe = (c: Comp) => {
  const kind = [c.space_type || "Space", c.use_type && `(${c.use_type})`].filter(Boolean).join(" ");
  return `${kind}${area(c) ? ` in ${area(c)}` : ""}${c.tenant ? `, ${c.tenant}` : ""}`;
};
const TYPE_ORDER = ["Office", "Retail", "Industrial", "Flex", "Medical", "Multifamily", "Other"];
const typeRank = (t: string) => (TYPE_ORDER.includes(t) ? TYPE_ORDER.indexOf(t) : 99);

const SORTS = {
  newest: { label: "Newest", fn: (a: Comp, b: Comp) => (compDate(b) ?? "").localeCompare(compDate(a) ?? "") },
  high: { label: "Highest rate", fn: (a: Comp, b: Comp) => (b.rate_psf ?? -1) - (a.rate_psf ?? -1) },
  low: { label: "Lowest rate", fn: (a: Comp, b: Comp) => (a.rate_psf ?? 1e9) - (b.rate_psf ?? 1e9) },
  size: { label: "Largest", fn: (a: Comp, b: Comp) => (b.sf ?? 0) - (a.sf ?? 0) },
} as const;
type SortKey = keyof typeof SORTS;

export function Comps() {
  const { data, edit } = useStore();
  const live = useLive();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const type = params.get("type") ?? "";
  const where = params.get("area") ?? "";
  const lease = params.get("lease") ?? "";
  const since = params.get("since") ?? "";
  const sort = (params.get("sort") as SortKey) || "newest";
  const picked = params.get("c") ?? "";
  const [hover, setHover] = useState("");

  const setParam = (key: string, value: string, replace = true) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "c") next.delete("c");
    setParams(next, { replace });
  };

  const options = useMemo(() => {
    const uniq = (f: (c: Comp) => string) =>
      [...new Set(live.comps.map(f).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const years = [...new Set(live.comps.map((c) => compDate(c)?.slice(0, 4)).filter(Boolean) as string[])].sort().reverse();
    return {
      types: uniq((c) => c.space_type).sort((a, b) => typeRank(a) - typeRank(b)),
      areas: uniq(area),
      leases: uniq((c) => c.lease_type),
      years,
    };
  }, [live.comps]);

  const shown = useMemo(() => {
    const list = live.comps.filter(
      (c) =>
        (!type || c.space_type === type) &&
        (!where || area(c) === where) &&
        (!lease || c.lease_type === lease) &&
        (!since || (compDate(c) ?? "") >= `${since}-01-01`) &&
        matches(q, c.address, c.tenant, c.submarket, c.city, c.county, c.center_name, c.use_type, c.space_type),
    );
    return list.sort(SORTS[sort]?.fn ?? SORTS.newest.fn);
  }, [live.comps, type, where, lease, since, q, sort]);

  const selected = picked ? data.comps.find((c) => c.id === picked) : undefined;

  useEffect(() => {
    if (picked && window.matchMedia("(max-width: 859px)").matches) window.scrollTo(0, 0);
  }, [picked]);

  const lanes = useMemo(() => {
    const by = new Map<string, Comp[]>();
    for (const c of shown) {
      if (c.rate_psf == null) continue;
      const k = c.space_type || "Other";
      by.set(k, [...(by.get(k) ?? []), c]);
    }
    return [...by.entries()]
      .sort((a, b) => typeRank(a[0]) - typeRank(b[0]))
      .map(([name, comps]) => ({ name, comps, median: median(comps.map((c) => c.rate_psf!)) }));
  }, [shown]);

  const filtered = Boolean(q || type || where || lease || since);
  const status = shown.length ? (
    <>
      <b>{plural(shown.length, "comp")}</b>
      {filtered ? " match" : ""}.{" "}
      {lanes.map((l, i) => (
        <span key={l.name}>
          {i > 0 && (i === lanes.length - 1 ? " and " : ", ")}
          {i === 0 ? l.name : l.name.toLowerCase()} median <b className="num">{rate(l.median)}/SF</b>
          {lanes.length === 1 && ` across ${plural(l.comps.length, "lease")}`}
        </span>
      ))}
      {lanes.length ? "." : ""}
    </>
  ) : (
    <>No comps match these filters.</>
  );

  const exportCsv = () => {
    const header = [
      "Address", "Area", "City", "State", "County", "Center", "Type", "Use", "Tenant", "Built", "Renovated",
      "Signed", "Start", "SF", "Floor", "Rate $/SF", "Term (months)", "Lease type", "New or renewal",
      "Escalations", "Options", "TI", "Free rent", "Notes",
    ];
    const rows = shown.map((c) => [
      c.address, c.submarket, c.city, c.state, c.county, c.center_name, c.space_type, c.use_type, c.tenant,
      c.year_built, c.year_renovated, c.sign_date, c.start_date, c.sf, c.floor, c.rate_psf, c.term_months,
      c.lease_type, c.deal_type, c.escalations, c.options, c.ti, c.free_rent, c.notes,
    ]);
    downloadFile("deal-team-6-lease-comps.csv", toCsv([header, ...rows]), "text/csv");
  };

  return (
    <div className={selected ? "sheet has-pick" : "sheet"}>
      <div className="head">
        <div className="head-text">
          <h1 className="title">Lease Comps</h1>
          <p className="status">{status}</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-ghost" onClick={exportCsv} disabled={!shown.length}>
            <DownloadIcon /> Export
          </button>
          <button className="btn" onClick={() => edit({ kind: "comp" })}>
            <PlusIcon /> Add comp
          </button>
        </div>
      </div>

      <div className="filters">
        <div className="search search-sm" role="search">
          <SearchIcon size={18} />
          <input
            type="search"
            value={q}
            onChange={(e) => setParam("q", e.target.value)}
            placeholder="Address, tenant, or neighborhood"
            aria-label="Search comps"
          />
        </div>
        {options.types.length > 1 && (
          <div className="seg" role="group" aria-label="Space type">
            <button className={!type ? "on" : ""} onClick={() => setParam("type", "")}>All</button>
            {options.types.map((t) => (
              <button key={t} className={type === t ? "on" : ""} onClick={() => setParam("type", t)}>{t}</button>
            ))}
          </div>
        )}
        <select className="select pill-select" value={where} onChange={(e) => setParam("area", e.target.value)} aria-label="Area">
          <option value="">Any area</option>
          {options.areas.map((a) => <option key={a}>{a}</option>)}
        </select>
        <select className="select pill-select" value={lease} onChange={(e) => setParam("lease", e.target.value)} aria-label="Lease type">
          <option value="">Any lease type</option>
          {options.leases.map((a) => <option key={a}>{a}</option>)}
        </select>
        <select className="select pill-select" value={since} onChange={(e) => setParam("since", e.target.value)} aria-label="Signed since">
          <option value="">Any date</option>
          {options.years.map((y) => <option key={y} value={y}>Since {y}</option>)}
        </select>
        <select className="select pill-select sort-note" value={sort} onChange={(e) => setParam("sort", e.target.value)} aria-label="Sort">
          {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
        </select>
      </div>

      {lanes.length > 0 && (
        <RateStrip lanes={lanes} picked={picked} hover={hover} setHover={setHover} onPick={(id) => setParam("c", id, false)} />
      )}

      <div className={selected ? "split has-detail" : "split"}>
        <div className="list-col">
          {shown.length ? (
            <div className="rows">
              {shown.map((c) => (
                <button
                  key={c.id}
                  className={`row comp-row${c.id === picked ? " picked" : ""}`}
                  onClick={() => setParam("c", c.id === picked ? "" : c.id, false)}
                  onMouseEnter={() => setHover(c.id)}
                  onMouseLeave={() => setHover("")}
                  aria-pressed={c.id === picked}
                >
                  <span className="row-main">
                    <span className="row-name"><span>{c.address}</span></span>
                    <span className="row-sub" style={{ display: "block" }}>{describe(c)}</span>
                  </span>
                  <span className="row-rate">
                    <span className="rate-big">
                      {c.rate_psf != null ? rate(c.rate_psf) : <span className="faint">No rate</span>}
                      {c.rate_psf != null && <small>/SF</small>}
                    </span>
                    <span className="row-sub" style={{ display: "block" }}>{c.lease_type || " "}</span>
                  </span>
                  <span className="row-meta">
                    <div className="strong num">{sqft(c.sf)}</div>
                    <div>{term(c.term_months)}</div>
                  </span>
                  <span className="row-meta row-contact">
                    <div className="strong">{monthOf(compDate(c)) || "Date not recorded"}</div>
                    <div>{c.sign_date ? "Signed" : c.start_date ? "Started" : " "}</div>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <Empty
              title="No comps match."
              action={
                <button className="btn" onClick={() => setParams({}, { replace: true })}>
                  Clear filters
                </button>
              }
            >
              Loosen a filter, or add the comp you have in hand.
            </Empty>
          )}
        </div>
        {selected && <CompDetail c={selected} onClose={() => setParam("c", "", false)} />}
      </div>
    </div>
  );
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Every comp as a dot on a $/SF line, one lane per space type, the median said on the line. */
function RateStrip({
  lanes,
  picked,
  hover,
  setHover,
  onPick,
}: {
  lanes: { name: string; comps: Comp[]; median: number }[];
  picked: string;
  hover: string;
  setHover: (id: string) => void;
  onPick: (id: string) => void;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const rates = lanes.flatMap((l) => l.comps.map((c) => c.rate_psf!));
  const step = Math.max(...rates) - Math.min(...rates) > 60 ? 20 : 10;
  const lo = Math.floor(Math.min(...rates) / step) * step;
  const hi = Math.max(lo + step, Math.ceil(Math.max(...rates) / step) * step);
  const left = width < 520 ? 12 : 88;
  const right = 16;
  const laneH = 58;
  const top = 26;
  const height = top + lanes.length * laneH + 22;
  const x = (v: number) => left + ((v - lo) / (hi - lo)) * Math.max(1, width - left - right);
  const ticks: number[] = [];
  for (let t = lo; t <= hi; t += step) ticks.push(t);

  const focus = [...lanes.flatMap((l) => l.comps)].find((c) => c.id === (hover || picked));

  return (
    <div className="strip" ref={ref}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Lease rates per square foot, one dot per comp">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={top - 6} y2={height - 22} stroke="var(--rule)" />
              <text x={x(t)} y={height - 6} textAnchor="middle" className="num">${t}</text>
            </g>
          ))}
          {lanes.map((lane, i) => {
            const cy = top + i * laneH + laneH / 2;
            const sorted = [...lane.comps].sort((a, b) => a.rate_psf! - b.rate_psf!);
            let lastX = -99;
            let flip = 0;
            const mx = x(lane.median);
            return (
              <g key={lane.name}>
                {width >= 520 ? (
                  <text x={0} y={cy + 4} className="lane-label">{lane.name}</text>
                ) : (
                  <text x={left} y={cy - 20} className="lane-label">{lane.name}</text>
                )}
                <line x1={left} x2={width - right} y1={cy} y2={cy} stroke="var(--panel-2)" strokeWidth={2} strokeLinecap="round" />
                <line x1={mx} x2={mx} y1={cy - 16} y2={cy + 16} stroke="var(--ink-1)" strokeWidth={2} strokeLinecap="round" />
                <text
                  x={Math.min(Math.max(mx, left + 60), width - right - 60)}
                  y={cy - 21}
                  textAnchor="middle"
                  className="median-label"
                >
                  median ${lane.median.toFixed(2)}
                </text>
                {sorted.map((c) => {
                  const cx = x(c.rate_psf!);
                  flip = cx - lastX < 9 ? (flip + 1) % 3 : 0;
                  lastX = cx;
                  const dy = [0, -7, 7][flip];
                  const on = c.id === picked || c.id === hover;
                  return (
                    <circle
                      key={c.id}
                      className="dot"
                      cx={cx}
                      cy={cy + dy}
                      r={on ? 7 : 5}
                      fill={on ? "var(--ink-1)" : "var(--olive)"}
                      fillOpacity={on ? 1 : 0.62}
                      stroke="var(--bg)"
                      strokeWidth={1.5}
                      onMouseEnter={() => setHover(c.id)}
                      onMouseLeave={() => setHover("")}
                      onClick={() => onPick(c.id)}
                    >
                      <title>{`${c.address}: ${rate(c.rate_psf)}/SF`}</title>
                    </circle>
                  );
                })}
              </g>
            );
          })}
          {focus && (
            <text
              x={Math.min(Math.max(x(focus.rate_psf!), left + 110), width - right - 110)}
              y={14}
              textAnchor="middle"
              className="median-label"
            >
              {focus.address}, {rate(focus.rate_psf)}/SF
            </text>
          )}
        </svg>
      )}
    </div>
  );
}

function CompDetail({ c, onClose }: { c: Comp; onClose: () => void }) {
  const { edit, setArchived, toast } = useStore();
  const place = [c.center_name, [c.city, c.state].filter(Boolean).join(", "), c.county && `${c.county} County`]
    .filter(Boolean)
    .join(". ");
  const facts: [string, string][] = [
    ["Area", c.submarket],
    ["Where", place],
    ["Type", [c.space_type, c.use_type].filter(Boolean).join(", ")],
    ["Tenant", c.tenant],
    ["Size", sqft(c.sf)],
    ["Floor", c.floor],
    ["Rate", c.rate_psf != null ? `${rate(c.rate_psf)}/SF ${c.lease_type}`.trim() : ""],
    ["Term", c.term_months != null ? `${term(c.term_months)} (${c.term_months} months)` : ""],
    ["Signed", monthOf(c.sign_date)],
    ["Starts", monthOf(c.start_date)],
    ["New or renewal", c.deal_type],
    ["Escalations", c.escalations],
    ["Options", c.options],
    ["TI allowance", c.ti],
    ["Free rent", c.free_rent],
    ["Built", [c.year_built, c.year_renovated && `renovated ${c.year_renovated}`].filter(Boolean).join(", ")],
  ];
  const remove = async () => {
    await setArchived("comps", c.id, true);
    onClose();
    toast(`Removed ${c.address}`, { label: "Undo", run: () => void setArchived("comps", c.id, false) });
  };
  return (
    <aside className="detail" aria-label={`${c.address} details`}>
      <div className="detail-top">
        <button className="crumb" onClick={onClose} style={{ margin: 0 }}>
          <BackIcon size={16} /> Lease Comps
        </button>
        <button className="icon-btn hide-phone" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
      </div>
      <h2>{c.address}</h2>
      <p className="sub">{describe(c)}</p>
      {c.rate_psf != null && (
        <p style={{ marginTop: 14 }}>
          <span style={{ fontSize: 44, fontWeight: 300, letterSpacing: "-0.02em" }} className="num">{rate(c.rate_psf)}</span>
          <span className="quiet"> per SF, {c.lease_type || "lease type not recorded"}</span>
        </p>
      )}
      <dl className="facts">
        {facts.filter(([, v]) => v).map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
        {c.notes && <div><dt>Notes</dt><dd className="notes">{c.notes}</dd></div>}
      </dl>
      <p className="byline">
        {c.added_by === "Spreadsheet" ? "From the original spreadsheet." : `Added by ${c.added_by || "someone"} on ${dayOf(c.created_at)}.`}
        {c.updated_by && ` Last edited by ${c.updated_by} on ${dayOf(c.updated_at)}.`}
      </p>
      <div className="detail-foot">
        {c.archived ? (
          <button className="btn" onClick={() => void setArchived("comps", c.id, false)}><RestoreIcon /> Restore</button>
        ) : (
          <>
            <button className="btn btn-ghost" onClick={() => edit({ kind: "comp", row: c })}><EditIcon /> Edit</button>
            <button className="btn btn-danger" onClick={remove}><ArchiveIcon /> Remove</button>
          </>
        )}
      </div>
    </aside>
  );
}
