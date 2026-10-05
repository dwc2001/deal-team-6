import { useMemo, useState } from "react";
import { Dialog, Field } from "../components/ui";
import { term } from "../lib/format";
import { useLive, useStore } from "../lib/store";
import { LEASE_TYPES, SPACE_TYPES, type Comp, type Draft } from "../lib/types";

type CompDraft = Draft<Comp>;

const blank = (): CompDraft => ({
  address: "", center_name: "", submarket: "", city: "Washington", state: "DC", county: "", space_type: "Retail",
  use_type: "", tenant: "", year_built: null, year_renovated: null, sign_date: null, start_date: null, sf: null,
  floor: "", rate_psf: null, term_months: null, lease_type: "NNN", deal_type: "New", escalations: "3%", options: "",
  ti: "", free_rent: "", notes: "",
});

const toNum = (v: string) => (v.trim() === "" ? null : Number(v.replace(/[$,\s]/g, "")));

export function CompEditor({ row }: { row?: Comp }) {
  const { edit, save, toast } = useStore();
  const live = useLive();
  const [d, setD] = useState<CompDraft>(() => (row ? { ...row } : blank()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (patch: Partial<CompDraft>) => setD((x) => ({ ...x, ...patch }));
  const close = () => edit(null);
  const areas = useMemo(() => [...new Set(live.comps.map((c) => c.submarket).filter(Boolean))].sort(), [live.comps]);

  const text = (key: keyof CompDraft, label: string, placeholder?: string) => (
    <Field label={label}>
      <input className="input" value={String(d[key] ?? "")} placeholder={placeholder} onChange={(e) => set({ [key]: e.target.value })} />
    </Field>
  );
  const number = (key: keyof CompDraft, label: string, opts: { hint?: string; placeholder?: string } = {}) => (
    <Field label={label} hint={opts.hint}>
      <input
        className="input num"
        inputMode="decimal"
        value={d[key] == null ? "" : String(d[key])}
        placeholder={opts.placeholder}
        onChange={(e) => set({ [key]: toNum(e.target.value) })}
      />
    </Field>
  );
  const date = (key: "sign_date" | "start_date", label: string) => (
    <Field label={label}>
      <input className="input" type="date" value={d[key] ?? ""} onChange={(e) => set({ [key]: e.target.value || null })} />
    </Field>
  );

  const submit = async () => {
    if (!d.address.trim()) return setError("Add the address.");
    for (const k of ["sf", "rate_psf", "term_months", "year_built", "year_renovated"] as const) {
      if (d[k] != null && !Number.isFinite(d[k])) return setError("Check the numbers: one of them is not a number.");
    }
    setBusy(true);
    setError("");
    try {
      const saved = await save("comps", {
        ...d,
        address: d.address.trim(),
        term_months: d.term_months == null ? null : Math.round(d.term_months),
      });
      toast(row ? `Saved ${saved.address}` : `Added ${saved.address} to comps`);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={row ? `Edit ${row.address}` : "Add a lease comp"}
      onClose={close}
      footer={
        <>
          {error && <span className="error-text">{error}</span>}
          <button className="btn btn-ghost" onClick={close}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? "Saving" : row ? "Save" : "Add comp"}</button>
        </>
      }
    >
      <section className="form-section">
        <h3>Where</h3>
        <div className="grid-2">
          <div className="span-2">{text("address", "Address", "1300 4th Street NE")}</div>
          <Field label="Neighborhood or submarket">
            <input className="input" list="dt6-areas" value={d.submarket} onChange={(e) => set({ submarket: e.target.value })} placeholder="Union Market" />
            <datalist id="dt6-areas">{areas.map((a) => <option key={a} value={a} />)}</datalist>
          </Field>
          {text("center_name", "Center or building name")}
          {text("city", "City")}
          <div className="grid-2">
            {text("state", "State")}
            {text("county", "County")}
          </div>
        </div>
      </section>

      <section className="form-section">
        <h3>The space</h3>
        <div className="grid-3">
          <Field label="Type">
            <select className="select" value={d.space_type} onChange={(e) => set({ space_type: e.target.value })}>
              {[...new Set([...SPACE_TYPES, d.space_type].filter(Boolean))].map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          {text("use_type", "Use", "Restaurant")}
          {text("tenant", "Tenant")}
          {number("sf", "Square feet", { placeholder: "2,400" })}
          {text("floor", "Floor", "Street level")}
          <div className="grid-2">
            {number("year_built", "Built")}
            {number("year_renovated", "Renovated")}
          </div>
        </div>
      </section>

      <section className="form-section">
        <h3>The deal</h3>
        <div className="grid-3">
          {number("rate_psf", "Starting rate ($/SF/yr)", { placeholder: "55.00" })}
          <Field label="Lease type">
            <select className="select" value={d.lease_type} onChange={(e) => set({ lease_type: e.target.value })}>
              <option value="">Not recorded</option>
              {[...new Set([...LEASE_TYPES, d.lease_type].filter(Boolean))].map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          {number("term_months", "Term (months)", { hint: d.term_months ? `${term(d.term_months)}` : "120 for 10 years" })}
          {date("sign_date", "Signed")}
          {date("start_date", "Starts")}
          <Field label="New or renewal">
            <select className="select" value={d.deal_type} onChange={(e) => set({ deal_type: e.target.value })}>
              <option value="">Not recorded</option>
              <option>New</option>
              <option>Renewal</option>
              <option>Expansion</option>
            </select>
          </Field>
          {text("escalations", "Escalations", "3%")}
          {text("ti", "TI allowance", "$100/SF")}
          {text("free_rent", "Free rent", "6 months")}
          <div className="span-3">{text("options", "Options", "Two 5-year options")}</div>
        </div>
        <Field label="Notes">
          <textarea className="textarea" value={d.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Source, concessions, anything unusual" />
        </Field>
      </section>
    </Dialog>
  );
}
