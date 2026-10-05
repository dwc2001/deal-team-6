import { useState } from "react";
import { ArchiveIcon, CloseIcon, PlusIcon } from "../components/icons";
import { Dialog, Field } from "../components/ui";
import { useLive, useStore } from "../lib/store";
import { LINK_SECTIONS, type Draft, type LinkItem } from "../lib/types";

type LinkDraft = Draft<LinkItem>;

const withScheme = (u: string) => (u.trim() && !/^https?:\/\//i.test(u.trim()) ? `https://${u.trim()}` : u.trim());

export function LinkEditor({ row, preset }: { row?: LinkItem; preset?: Partial<LinkItem> }) {
  const { edit, save, setArchived, toast } = useStore();
  const { links } = useLive();
  const [d, setD] = useState<LinkDraft>(() =>
    row
      ? { ...row, more: [...row.more] }
      : {
          section: LINK_SECTIONS[1], jurisdiction: "", title: "", url: "", description: "", status: "", more: [],
          sort: links.length + 1, ...preset,
        },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (patch: Partial<LinkDraft>) => setD((x) => ({ ...x, ...patch }));
  const close = () => edit(null);
  const isGrant = d.section === "Grants and incentives";

  const submit = async () => {
    if (!d.title.trim()) return setError("Give it a name.");
    if (!d.url.trim()) return setError("Add the web address.");
    setBusy(true);
    try {
      const saved = await save("links", {
        ...d,
        title: d.title.trim(),
        url: withScheme(d.url),
        more: d.more.filter((m) => m.url.trim()).map((m) => ({ label: m.label.trim() || "Link", url: withScheme(m.url) })),
      });
      toast(row ? `Saved ${saved.title}` : `Added ${saved.title}`);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!row) return;
    await setArchived("links", row.id, true);
    close();
    toast(`Removed ${row.title}`, { label: "Undo", run: () => void setArchived("links", row.id, false) });
  };

  return (
    <Dialog
      title={row ? `Edit ${row.title}` : "Add a link"}
      onClose={close}
      footer={
        <>
          {row && (
            <button className="btn btn-danger left" onClick={remove}>
              <ArchiveIcon /> Remove
            </button>
          )}
          {error && <span className="error-text">{error}</span>}
          <button className="btn btn-ghost" onClick={close}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? "Saving" : row ? "Save" : "Add link"}</button>
        </>
      }
    >
      <section className="form-section">
        <div className="grid-2">
          <Field label="Section">
            <select className="select" value={d.section} onChange={(e) => set({ section: e.target.value })}>
              {LINK_SECTIONS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Where it applies" hint="DC, MD, Montgomery County. Blank if anywhere.">
            <input className="input" value={d.jurisdiction} onChange={(e) => set({ jurisdiction: e.target.value })} />
          </Field>
          <div className="span-2">
            <Field label="Name">
              <input className="input" value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="Office to Anything Program" />
            </Field>
          </div>
          <div className="span-2">
            <Field label="Web address">
              <input className="input" type="url" value={d.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://" />
            </Field>
          </div>
          <div className="span-2">
            <Field label="What it's for">
              <input className="input" value={d.description} onChange={(e) => set({ description: e.target.value })} placeholder="One line so people know when to use it" />
            </Field>
          </div>
          {isGrant && (
            <Field label="Status">
              <select className="select" value={d.status} onChange={(e) => set({ status: e.target.value })}>
                <option value="">Not sure</option>
                <option>Open</option>
                <option>Closed</option>
              </select>
            </Field>
          )}
        </div>
      </section>
      <section className="form-section">
        <h3>More links</h3>
        {d.more.map((m, i) => (
          <div className="line-item" key={i} style={{ gridTemplateColumns: "140px minmax(0,1fr) 40px" }}>
            <input
              className="input"
              value={m.label}
              placeholder="Brochure"
              aria-label="Label"
              onChange={(e) => set({ more: d.more.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
            />
            <input
              className="input"
              value={m.url}
              placeholder="https://"
              aria-label="Address"
              onChange={(e) => set({ more: d.more.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })}
            />
            <button className="icon-btn" aria-label="Remove link" onClick={() => set({ more: d.more.filter((_, j) => j !== i) })}>
              <CloseIcon size={16} />
            </button>
          </div>
        ))}
        <button className="btn btn-small add-line" onClick={() => set({ more: [...d.more, { label: "", url: "" }] })}>
          <PlusIcon size={16} /> Add a brochure, map or form
        </button>
      </section>
    </Dialog>
  );
}
