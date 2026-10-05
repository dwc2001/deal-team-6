import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog, Field, Toggle } from "../components/ui";
import { ImagesIcon } from "../components/icons";
import { backend } from "../lib/backend";
import { findDuplicates } from "../lib/contact-utils";
import { formatPhone } from "../lib/format";
import { preparePhoto, type Prepared } from "../lib/image";
import { useLive, useStore } from "../lib/store";
import { GROUPS, type Contact, type Draft } from "../lib/types";

export type ContactDraft = Draft<Contact>;

export const blankContact = (preset: Partial<Contact> = {}): ContactDraft => ({
  category: "", name: "", company: "", title: "", phone: "", phone_alt: "", email: "", website: "",
  address: "", territory: "", notes: "", connection: "", preferred: false, pays_referral: false,
  card_front: null, ...preset,
});

/** The fields shared by the editor dialog and the card scanner's review step. */
export function ContactFields({
  draft,
  set,
  newGroup,
  setNewGroup,
}: {
  draft: ContactDraft;
  set: (patch: Partial<ContactDraft>) => void;
  newGroup: string;
  setNewGroup: (g: string) => void;
}) {
  const live = useLive();
  const categories = useMemo(() => live.categories.map((c) => c.name).sort(), [live.categories]);
  const territories = useMemo(
    () => [...new Set(live.contacts.map((c) => c.territory).filter(Boolean))].sort(),
    [live.contacts],
  );
  const isNewCategory = draft.category.trim() !== "" && !categories.includes(draft.category.trim());
  const text = (key: keyof ContactDraft, label: string, opts: { type?: string; placeholder?: string; phone?: boolean } = {}) => (
    <Field label={label}>
      <input
        className="input"
        type={opts.type ?? "text"}
        value={String(draft[key] ?? "")}
        placeholder={opts.placeholder}
        onChange={(e) => set({ [key]: e.target.value })}
        onBlur={opts.phone ? (e) => set({ [key]: formatPhone(e.target.value) }) : undefined}
      />
    </Field>
  );

  return (
    <>
      <section className="form-section">
        <div className="grid-2">
          <Field label="Service" hint={isNewCategory ? undefined : "Pick one or type a new one, like Roofing"}>
            <input
              className="input"
              list="dt6-categories"
              value={draft.category}
              onChange={(e) => set({ category: e.target.value })}
              placeholder="Leasing, Attorney, Plumbing"
            />
            <datalist id="dt6-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Territory">
            <input
              className="input"
              list="dt6-territories"
              value={draft.territory}
              onChange={(e) => set({ territory: e.target.value })}
              placeholder="DMV, DC, MD, National"
            />
            <datalist id="dt6-territories">
              {territories.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
          {isNewCategory && (
            <Field label={`"${draft.category.trim()}" is a new service. List it under`}>
              <select className="select" value={newGroup} onChange={(e) => setNewGroup(e.target.value)}>
                {GROUPS.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </Field>
          )}
        </div>
      </section>

      <section className="form-section">
        <h3>Who</h3>
        <div className="grid-2">
          {text("name", "Name")}
          {text("title", "Title")}
          <div className="span-2">{text("company", "Company")}</div>
        </div>
      </section>

      <section className="form-section">
        <h3>How to reach them</h3>
        <div className="grid-2">
          {text("phone", "Phone", { type: "tel", phone: true })}
          {text("phone_alt", "Other phone", { type: "tel", phone: true })}
          {text("email", "Email", { type: "email" })}
          {text("website", "Website", { placeholder: "example.com" })}
          <div className="span-2">{text("address", "Address")}</div>
        </div>
      </section>

      <section className="form-section">
        <h3>What the team should know</h3>
        <Field label="Who knows them" hint="Who on the team has the relationship, so others can ask for an intro">
          <input
            className="input"
            value={draft.connection}
            onChange={(e) => set({ connection: e.target.value })}
            placeholder="Don, college roommate"
          />
        </Field>
        <Field label="Notes">
          <textarea
            className="textarea"
            value={draft.notes}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="What they're good at, deal sizes, how they've performed for us"
          />
        </Field>
        <div className="grid-2">
          <Toggle
            checked={draft.preferred}
            onChange={(v) => set({ preferred: v })}
            label="Preferred"
            hint="A go-to the team trusts"
          />
          <Toggle
            checked={draft.pays_referral}
            onChange={(v) => set({ pays_referral: v })}
            label="Pays referrals"
            hint="Pays a fee for business we send"
          />
        </div>
      </section>
    </>
  );
}

export function ContactEditor({ row, preset }: { row?: Contact; preset?: Partial<Contact> }) {
  const { edit, save, addCategory, toast } = useStore();
  const live = useLive();
  const [draft, setDraft] = useState<ContactDraft>(() => (row ? { ...row } : blankContact(preset)));
  const [newGroup, setNewGroup] = useState<string>(GROUPS[GROUPS.length - 1]);
  const [photo, setPhoto] = useState<Prepared | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (patch: Partial<ContactDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const close = () => edit(null);
  const dupes = row ? [] : findDuplicates(live.contacts, draft);

  const submit = async () => {
    const category = draft.category.trim();
    if (!category) return setError("Pick the service they provide.");
    if (!draft.name.trim() && !draft.company.trim()) return setError("Add a name or a company.");
    setBusy(true);
    setError("");
    try {
      if (!live.categories.some((c) => c.name === category)) await addCategory(category, newGroup);
      const card_front = photo ? await backend.uploadCard(photo.blob) : draft.card_front;
      const saved = await save("contacts", { ...draft, category, card_front, name: draft.name.trim() });
      toast(row ? `Saved ${saved.name || saved.company}` : `Added ${saved.name || saved.company} to ${category}`);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={row ? `Edit ${row.name || row.company}` : "Add a person"}
      onClose={close}
      footer={
        <>
          {!row && (
            <Link to="/scan" className="btn btn-ghost left" onClick={close}>
              Scan their card instead
            </Link>
          )}
          {error && <span className="error-text">{error}</span>}
          <button className="btn btn-ghost" onClick={close}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? "Saving" : row ? "Save" : "Add to directory"}
          </button>
        </>
      }
    >
      {dupes.length > 0 && (
        <p className="notice warn">
          Already in the directory: <b>{dupes.map((d) => `${d.name || d.company} (${d.category})`).join(", ")}</b>.
        </p>
      )}
      <ContactFields draft={draft} set={set} newGroup={newGroup} setNewGroup={setNewGroup} />
      <section className="form-section">
        <h3>Card photo</h3>
        <label className="btn" style={{ alignSelf: "flex-start" }}>
          <ImagesIcon /> {photo || draft.card_front ? "Replace photo" : "Attach a photo of their card"}
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                setPhoto(await preparePhoto(f));
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not read that photo.");
              }
            }}
          />
        </label>
        {photo && <img src={photo.url} alt="New card photo" style={{ maxWidth: 260, borderRadius: 12 }} />}
      </section>
    </Dialog>
  );
}
