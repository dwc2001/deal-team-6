import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CloseIcon, CopyIcon, PlusIcon } from "../components/icons";
import { Field } from "../components/ui";
import { money, pct } from "../lib/format";
import { useStore } from "../lib/store";

// ------------------------------------------------------------------- math
/** Monthly payment on a fully amortizing loan. */
export function payment(loan: number, annualRate: number, years: number): number {
  const n = years * 12;
  if (loan <= 0 || n <= 0) return 0;
  const r = annualRate / 12;
  return r === 0 ? loan / n : (loan * r) / (1 - Math.pow(1 + r, -n));
}

/** Loan a monthly payment supports. */
function principalFor(monthly: number, annualRate: number, years: number): number {
  const n = years * 12;
  if (monthly <= 0 || n <= 0) return 0;
  const r = annualRate / 12;
  return r === 0 ? monthly * n : (monthly * (1 - Math.pow(1 + r, -n))) / r;
}

// ---------------------------------------------------------- saved inputs
function useSaved<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? { ...initial, ...JSON.parse(raw) } : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [key, value]);
  return [value, setValue, () => setValue(initial)] as const;
}

// ----------------------------------------------------------------- inputs
function Num({
  value,
  onChange,
  pre,
  post,
  digits = 2,
  label,
  ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  pre?: string;
  post?: string;
  digits?: number;
  label?: string;
  ariaLabel?: string;
}) {
  const fmt = (n: number) =>
    Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: digits }) : "";
  const [text, setText] = useState(fmt(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(fmt(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused]);
  const input = (
    <div className={`money-input${pre ? " has-pre" : ""}${post ? " has-post" : ""}`}>
      {pre && <span className="affix pre">{pre}</span>}
      <input
        className="input"
        inputMode="decimal"
        aria-label={ariaLabel}
        value={text}
        onFocus={(e) => {
          setFocused(true);
          setText(Number.isFinite(value) ? String(value) : "");
          requestAnimationFrame(() => e.target.select());
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value.replace(/[$,%\s]/g, ""));
          onChange(e.target.value.trim() === "" ? 0 : Number.isFinite(n) ? n : 0);
        }}
      />
      {post && <span className="affix post">{post}</span>}
    </div>
  );
  return label ? <Field label={label}>{input}</Field> : input;
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function CopySummary({ lines }: { lines: string[] }) {
  const { toast } = useStore();
  return (
    <button
      className="btn btn-small"
      style={{ marginTop: 16 }}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(lines.join("\n"));
          toast("Copied the numbers");
        } catch {
          toast("Could not copy");
        }
      }}
    >
      <CopyIcon size={16} /> Copy summary
    </button>
  );
}

// ------------------------------------------------------------------ page
const TOOLS = {
  loan: "Loan and ROE",
  "max-loan": "Max loan",
  cap: "Cap rate",
} as const;
type Tool = keyof typeof TOOLS;

export function Calculators() {
  const { tool: param } = useParams();
  const navigate = useNavigate();
  const tool: Tool = param && param in TOOLS ? (param as Tool) : "loan";
  const blurbs: Record<Tool, string> = {
    loan: "Price, financing and income in; debt service, cash flow and return out.",
    "max-loan": "How much a property can borrow, held to a DSCR and an LTV.",
    cap: "Any two of value, NOI and cap rate gives you the third.",
  };
  return (
    <div className="sheet">
      <div className="head">
        <div className="head-text">
          <h1 className="title">Calculators</h1>
          <p className="status">{blurbs[tool]}</p>
        </div>
      </div>
      <div className="seg" role="tablist" aria-label="Calculator" style={{ marginBottom: 28 }}>
        {(Object.keys(TOOLS) as Tool[]).map((t) => (
          <button key={t} role="tab" aria-selected={tool === t} className={tool === t ? "on" : ""} onClick={() => navigate(`/calculators/${t}`)}>
            {TOOLS[t]}
          </button>
        ))}
      </div>
      {tool === "loan" && <LoanRoe />}
      {tool === "max-loan" && <MaxLoan />}
      {tool === "cap" && <CapRate />}
    </div>
  );
}

// --------------------------------------------------------- Loan and ROE
interface Unit { label: string; count: number; rent: number }
interface Expense { label: string; amount: number }

const LOAN_DEFAULTS = {
  price: 1_100_000,
  credits: 0,
  downPct: 25,
  closingPct: 1.5,
  ratePct: 6,
  years: 25,
  noiMode: "enter" as "enter" | "build",
  noi: 70_000,
  units: [
    { label: "4-bed", count: 1, rent: 2324 },
    { label: "2-bed", count: 1, rent: 1453 },
    { label: "1-bed", count: 1, rent: 1238 },
  ] as Unit[],
  vacancyPct: 0,
  taxPct: 0.85,
  mgmtPct: 0,
  expenses: [
    { label: "Insurance", amount: 1440 },
    { label: "Water", amount: 1800 },
    { label: "Landscaping", amount: 2400 },
    { label: "Maintenance", amount: 2400 },
    { label: "Misc", amount: 1200 },
  ] as Expense[],
};

function LoanRoe() {
  const [s, setS, reset] = useSaved("dt6-calc-loan", LOAN_DEFAULTS);
  const set = (patch: Partial<typeof LOAN_DEFAULTS>) => setS((x) => ({ ...x, ...patch }));

  const grossMonthly = s.units.reduce((t, u) => t + u.count * u.rent, 0);
  const grossAnnual = grossMonthly * 12;
  const effective = grossAnnual * (1 - s.vacancyPct / 100);
  const taxes = s.price * (s.taxPct / 100);
  const mgmt = effective * (s.mgmtPct / 100);
  const otherExp = s.expenses.reduce((t, e) => t + e.amount, 0);
  const totalExp = taxes + mgmt + otherExp;
  const noi = s.noiMode === "build" ? effective - totalExp : s.noi;

  const netPrice = s.price - s.credits;
  const down = (s.downPct / 100) * s.price - s.credits;
  const closing = (s.closingPct / 100) * s.price;
  const allIn = down + closing;
  const loan = Math.max(0, (1 - s.downPct / 100) * s.price);
  const monthly = payment(loan, s.ratePct / 100, s.years);
  const annualDs = monthly * 12;
  const cashflow = noi - annualDs;
  const roe = down > 0 ? cashflow / down : NaN;
  const coc = allIn > 0 ? cashflow / allIn : NaN;
  const cap = s.price > 0 ? noi / s.price : NaN;
  const capNet = netPrice > 0 ? noi / netPrice : NaN;
  const dscr = annualDs > 0 ? noi / annualDs : NaN;

  return (
    <div className="calc">
      <div className="calc-inputs">
        <section className="calc-group">
          <h3>Purchase</h3>
          <div className="grid-2">
            <Num label="Contract price" pre="$" digits={0} value={s.price} onChange={(price) => set({ price })} />
            <Num label="Credits to buyer" pre="$" digits={0} value={s.credits} onChange={(credits) => set({ credits })} />
            <Num label="Closing costs" post="%" value={s.closingPct} onChange={(closingPct) => set({ closingPct })} />
          </div>
        </section>
        <section className="calc-group">
          <h3>Financing</h3>
          <div className="grid-3">
            <Num label="Down payment" post="%" value={s.downPct} onChange={(downPct) => set({ downPct })} />
            <Num label="Interest rate" post="%" digits={3} value={s.ratePct} onChange={(ratePct) => set({ ratePct })} />
            <Num label="Amortization" post="yrs" digits={0} value={s.years} onChange={(years) => set({ years })} />
          </div>
        </section>
        <section className="calc-group">
          <h3>
            Income
            <span className="seg" role="group" aria-label="How to set NOI">
              <button className={s.noiMode === "enter" ? "on" : ""} onClick={() => set({ noiMode: "enter" })}>Enter NOI</button>
              <button className={s.noiMode === "build" ? "on" : ""} onClick={() => set({ noiMode: "build" })}>Build from rents</button>
            </span>
          </h3>
          {s.noiMode === "enter" ? (
            <div className="grid-2">
              <Num label="NOI (annual)" pre="$" digits={0} value={s.noi} onChange={(noi) => set({ noi })} />
            </div>
          ) : (
            <BuildNoi s={s} set={set} gross={grossAnnual} taxes={taxes} mgmt={mgmt} totalExp={totalExp} noi={noi} />
          )}
        </section>
        <button className="btn btn-ghost" style={{ alignSelf: "flex-start" }} onClick={reset}>Reset to the example</button>
      </div>

      <aside className="result" aria-live="polite">
        <div className="big-label">Cash flow after debt service</div>
        <div className="big" style={{ color: cashflow < 0 ? "var(--bad)" : undefined }}>{money(cashflow)}</div>
        <p className="say">
          <b>{money(cashflow / 12)} a month</b>. Return on equity <b>{pct(roe)}</b>
          {Number.isFinite(dscr) && <>, DSCR <b>{dscr.toFixed(2)}x</b></>}.
        </p>
        <dl>
          <Result label="NOI" value={money(noi)} />
          <Result label="Down payment" value={money(down)} />
          <Result label={`Closing costs (${s.closingPct}%)`} value={money(closing)} />
          <Result label="All in (down plus closing)" value={money(allIn)} />
          <Result label="Loan amount" value={money(loan)} />
          <Result label="Debt service, monthly" value={money(monthly)} />
          <Result label="Debt service, annual" value={money(annualDs)} />
          <Result label="Return on equity (on down payment)" value={pct(roe)} />
          <Result label="Cash on cash (on all in)" value={pct(coc)} />
          <Result label="Cap rate on price" value={pct(cap)} />
          {s.credits > 0 && <Result label="Cap rate on net price" value={pct(capNet)} />}
          <Result label="DSCR" value={Number.isFinite(dscr) ? `${dscr.toFixed(2)}x` : "No loan"} />
        </dl>
        <CopySummary
          lines={[
            `Price ${money(s.price)}${s.credits ? `, credits ${money(s.credits)}` : ""}`,
            `${s.downPct}% down (${money(down)}), loan ${money(loan)} at ${s.ratePct}% over ${s.years} years`,
            `NOI ${money(noi)}, debt service ${money(annualDs)} a year (${money(monthly)} a month)`,
            `Cash flow ${money(cashflow)} a year (${money(cashflow / 12)} a month)`,
            `ROE ${pct(roe)}, cash on cash ${pct(coc)}, cap rate ${pct(cap)}, DSCR ${Number.isFinite(dscr) ? dscr.toFixed(2) + "x" : "n/a"}`,
          ]}
        />
      </aside>
    </div>
  );
}

function BuildNoi({
  s,
  set,
  gross,
  taxes,
  mgmt,
  totalExp,
  noi,
}: {
  s: typeof LOAN_DEFAULTS;
  set: (p: Partial<typeof LOAN_DEFAULTS>) => void;
  gross: number;
  taxes: number;
  mgmt: number;
  totalExp: number;
  noi: number;
}) {
  const setUnit = (i: number, patch: Partial<Unit>) => set({ units: s.units.map((u, j) => (j === i ? { ...u, ...patch } : u)) });
  const setExp = (i: number, patch: Partial<Expense>) => set({ expenses: s.expenses.map((e, j) => (j === i ? { ...e, ...patch } : e)) });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div className="line-items">
        <span className="label">Rents (monthly, per unit)</span>
        {s.units.map((u, i) => (
          <div className="line-item units" key={i}>
            <input className="input" value={u.label} onChange={(e) => setUnit(i, { label: e.target.value })} aria-label="Unit type" />
            <Num value={u.count} digits={0} post="x" ariaLabel="Units" onChange={(count) => setUnit(i, { count })} />
            <Num value={u.rent} digits={0} pre="$" ariaLabel="Rent per month" onChange={(rent) => setUnit(i, { rent })} />
            <button className="icon-btn" aria-label="Remove unit" onClick={() => set({ units: s.units.filter((_, j) => j !== i) })}><CloseIcon size={16} /></button>
          </div>
        ))}
        <button className="btn btn-small add-line" onClick={() => set({ units: [...s.units, { label: "Unit", count: 1, rent: 0 }] })}>
          <PlusIcon size={16} /> Add unit type
        </button>
        <p className="faint" style={{ fontSize: 14 }}>Gross rent {money(gross)} a year.</p>
      </div>
      <div className="grid-3">
        <Num label="Vacancy" post="%" value={s.vacancyPct} onChange={(vacancyPct) => set({ vacancyPct })} />
        <Num label="Property tax rate" post="%" digits={3} value={s.taxPct} onChange={(taxPct) => set({ taxPct })} />
        <Num label="Management" post="%" value={s.mgmtPct} onChange={(mgmtPct) => set({ mgmtPct })} />
      </div>
      <div className="line-items">
        <span className="label">Other expenses (annual)</span>
        {s.expenses.map((e, i) => (
          <div className="line-item" key={i}>
            <input className="input" value={e.label} onChange={(ev) => setExp(i, { label: ev.target.value })} aria-label="Expense" />
            <Num value={e.amount} digits={0} pre="$" ariaLabel="Annual amount" onChange={(amount) => setExp(i, { amount })} />
            <button className="icon-btn" aria-label="Remove expense" onClick={() => set({ expenses: s.expenses.filter((_, j) => j !== i) })}><CloseIcon size={16} /></button>
          </div>
        ))}
        <button className="btn btn-small add-line" onClick={() => set({ expenses: [...s.expenses, { label: "Expense", amount: 0 }] })}>
          <PlusIcon size={16} /> Add expense
        </button>
        <p className="faint" style={{ fontSize: 14 }}>
          Taxes {money(taxes)}{mgmt > 0 ? `, management ${money(mgmt)}` : ""}. Expenses {money(totalExp)} in all, leaving NOI of {money(noi)}.
        </p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- Max loan
const MAX_DEFAULTS = { noi: 70_000, value: 1_100_000, ratePct: 6.5, years: 25, dscr: 1.25, ltvPct: 75 };

function MaxLoan() {
  const [s, setS, reset] = useSaved("dt6-calc-maxloan", MAX_DEFAULTS);
  const set = (patch: Partial<typeof MAX_DEFAULTS>) => setS((x) => ({ ...x, ...patch }));
  const byDscr = principalFor(s.noi / Math.max(s.dscr, 0.01) / 12, s.ratePct / 100, s.years);
  const byLtv = (s.ltvPct / 100) * s.value;
  const loan = Math.max(0, Math.min(byDscr, byLtv));
  const dscrBinds = byDscr <= byLtv;
  const monthly = payment(loan, s.ratePct / 100, s.years);
  const actualDscr = monthly > 0 ? s.noi / (monthly * 12) : NaN;
  const actualLtv = s.value > 0 ? loan / s.value : NaN;

  return (
    <div className="calc">
      <div className="calc-inputs">
        <section className="calc-group">
          <h3>Property</h3>
          <div className="grid-2">
            <Num label="NOI (annual)" pre="$" digits={0} value={s.noi} onChange={(noi) => set({ noi })} />
            <Num label="Value or price" pre="$" digits={0} value={s.value} onChange={(value) => set({ value })} />
          </div>
        </section>
        <section className="calc-group">
          <h3>Lender terms</h3>
          <div className="grid-2">
            <Num label="Interest rate" post="%" digits={3} value={s.ratePct} onChange={(ratePct) => set({ ratePct })} />
            <Num label="Amortization" post="yrs" digits={0} value={s.years} onChange={(years) => set({ years })} />
            <Num label="Minimum DSCR" post="x" value={s.dscr} onChange={(dscr) => set({ dscr })} />
            <Num label="Maximum LTV" post="%" value={s.ltvPct} onChange={(ltvPct) => set({ ltvPct })} />
          </div>
        </section>
        <button className="btn btn-ghost" style={{ alignSelf: "flex-start" }} onClick={reset}>Reset</button>
      </div>
      <aside className="result" aria-live="polite">
        <div className="big-label">Most this property can borrow</div>
        <div className="big">{money(loan)}</div>
        <p className="say">
          <b>{dscrBinds ? "The DSCR is the limit." : "The LTV is the limit."}</b>{" "}
          {dscrBinds
            ? `At ${s.dscr.toFixed(2)}x the NOI carries ${money(byDscr)}; ${s.ltvPct}% LTV would allow ${money(byLtv)}.`
            : `${s.ltvPct}% of value is ${money(byLtv)}; the NOI could carry ${money(byDscr)} at ${s.dscr.toFixed(2)}x.`}
        </p>
        <dl>
          <Result label="Loan held to DSCR" value={money(byDscr)} />
          <Result label="Loan held to LTV" value={money(byLtv)} />
          <Result label="Debt service, monthly" value={money(monthly)} />
          <Result label="Debt service, annual" value={money(monthly * 12)} />
          <Result label="DSCR at this loan" value={Number.isFinite(actualDscr) ? `${actualDscr.toFixed(2)}x` : "-"} />
          <Result label="LTV at this loan" value={pct(actualLtv, 1)} />
          <Result label="Equity needed" value={money(Math.max(0, s.value - loan))} />
        </dl>
        <CopySummary
          lines={[
            `Max loan ${money(loan)} (${dscrBinds ? "DSCR" : "LTV"} constrained)`,
            `NOI ${money(s.noi)}, value ${money(s.value)}, ${s.ratePct}% over ${s.years} years`,
            `Held to ${s.dscr.toFixed(2)}x DSCR: ${money(byDscr)}. Held to ${s.ltvPct}% LTV: ${money(byLtv)}`,
            `Debt service ${money(monthly)} a month; equity needed ${money(Math.max(0, s.value - loan))}`,
          ]}
        />
      </aside>
    </div>
  );
}

// ------------------------------------------------------------- Cap rate
const CAP_DEFAULTS = { solve: "value" as "value" | "cap" | "noi", value: 1_100_000, noi: 70_000, capPct: 6.5 };

function CapRate() {
  const [s, setS, reset] = useSaved("dt6-calc-cap", CAP_DEFAULTS);
  const set = (patch: Partial<typeof CAP_DEFAULTS>) => setS((x) => ({ ...x, ...patch }));
  const value = s.solve === "value" ? (s.capPct > 0 ? s.noi / (s.capPct / 100) : NaN) : s.value;
  const noi = s.solve === "noi" ? s.value * (s.capPct / 100) : s.noi;
  const cap = s.solve === "cap" ? (s.value > 0 ? s.noi / s.value : NaN) : s.capPct / 100;
  const answer = s.solve === "value" ? money(value) : s.solve === "noi" ? money(noi) : pct(cap);
  const answerLabel = s.solve === "value" ? "Value" : s.solve === "noi" ? "NOI" : "Cap rate";

  return (
    <div className="calc">
      <div className="calc-inputs">
        <section className="calc-group">
          <h3>Solve for</h3>
          <div className="seg" role="group" aria-label="Solve for">
            <button className={s.solve === "value" ? "on" : ""} onClick={() => set({ solve: "value" })}>Value</button>
            <button className={s.solve === "cap" ? "on" : ""} onClick={() => set({ solve: "cap" })}>Cap rate</button>
            <button className={s.solve === "noi" ? "on" : ""} onClick={() => set({ solve: "noi" })}>NOI</button>
          </div>
        </section>
        <section className="calc-group">
          <h3>Known</h3>
          <div className="grid-2">
            {s.solve !== "value" && <Num label="Value or price" pre="$" digits={0} value={s.value} onChange={(v) => set({ value: v })} />}
            {s.solve !== "noi" && <Num label="NOI (annual)" pre="$" digits={0} value={s.noi} onChange={(v) => set({ noi: v })} />}
            {s.solve !== "cap" && <Num label="Cap rate" post="%" digits={3} value={s.capPct} onChange={(v) => set({ capPct: v })} />}
          </div>
        </section>
        <button className="btn btn-ghost" style={{ alignSelf: "flex-start" }} onClick={reset}>Reset</button>
      </div>
      <aside className="result" aria-live="polite">
        <div className="big-label">{answerLabel}</div>
        <div className="big">{answer}</div>
        <p className="say">
          {money(noi)} of NOI at a <b>{pct(cap)}</b> cap is worth <b>{money(value)}</b>.
        </p>
        <dl>
          <Result label="Value" value={money(value)} />
          <Result label="NOI" value={money(noi)} />
          <Result label="Cap rate" value={pct(cap, 3)} />
          <Result label="Value per $1 of NOI" value={Number.isFinite(cap) && cap > 0 ? `${(1 / cap).toFixed(1)}x` : "-"} />
        </dl>
      </aside>
    </div>
  );
}
