import { useMemo } from "react";
import { EditIcon, ExternalIcon, PlusIcon } from "../components/icons";
import { Empty } from "../components/ui";
import { plural } from "../lib/format";
import { useLive, useStore } from "../lib/store";
import { LINK_SECTIONS, type LinkItem } from "../lib/types";

const BLURBS: Record<string, string> = {
  "Grants and incentives": "Programs that can help a deal pencil.",
  "Tools and websites": "Lookups and calculators the team uses.",
};

export function Resources() {
  const { edit } = useStore();
  const { links } = useLive();

  const sections = useMemo(() => {
    const names = [...new Set([...LINK_SECTIONS, ...links.map((l) => l.section)])];
    return names
      .map((name) => {
        const items = links.filter((l) => l.section === name).sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title));
        const byPlace = new Map<string, LinkItem[]>();
        for (const l of items) byPlace.set(l.jurisdiction, [...(byPlace.get(l.jurisdiction) ?? []), l]);
        return { name, items, byPlace: [...byPlace.entries()] };
      })
      .filter((s) => s.items.length);
  }, [links]);

  const closed = links.filter((l) => l.status === "Closed").length;

  return (
    <div className="sheet">
      <div className="head">
        <div className="head-text">
          <h1 className="title">Resources</h1>
          <p className="status">
            <b>{plural(links.length, "link")}</b>.{" "}
            {closed > 0 && (
              <>
                <span className="tag-closed">{plural(closed, "program")} closed</span> to new applications.{" "}
              </>
            )}
            Add anything the team keeps looking up.
          </p>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={() => edit({ kind: "link" })}>
            <PlusIcon /> Add link
          </button>
        </div>
      </div>

      {sections.length === 0 && (
        <Empty title="No links yet.">Save the sites and programs the team keeps looking up.</Empty>
      )}

      {sections.map((s) => (
        <section className="res-section" key={s.name}>
          <h2>{s.name}</h2>
          {BLURBS[s.name] && <p>{BLURBS[s.name]}</p>}
          {s.byPlace.map(([place, items]) => (
            <div key={place || "any"} style={{ marginTop: place ? 10 : 0 }}>
              {place && <p className="label" style={{ margin: "8px 0 2px" }}>{place}</p>}
              {items.map((l) => (
                <div className="link-row" key={l.id}>
                  <div style={{ minWidth: 0 }}>
                    <div className="link-title">
                      <span>{l.title}</span>
                      {l.status === "Closed" && <span className="tag tag-closed">Closed</span>}
                      {l.status === "Open" && <span className="tag tag-open">Open</span>}
                    </div>
                    {l.description && <p className="link-desc">{l.description}</p>}
                  </div>
                  <div className="link-actions">
                    {l.url && (
                      <a className="btn btn-small" href={l.url} target="_blank" rel="noreferrer">
                        {s.name === "Grants and incentives" ? "Website" : "Open"} <ExternalIcon size={15} />
                      </a>
                    )}
                    {l.more.map((m) => (
                      <a key={m.url} className="btn btn-small btn-ghost" href={m.url} target="_blank" rel="noreferrer">
                        {m.label} <ExternalIcon size={15} />
                      </a>
                    ))}
                    <button className="icon-btn" aria-label={`Edit ${l.title}`} onClick={() => edit({ kind: "link", row: l })}>
                      <EditIcon size={17} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
