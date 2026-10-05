import { useState, type FormEvent } from "react";
import { Emblem } from "../components/Emblem";
import { Field } from "../components/ui";
import { ThemeButton } from "../components/ThemeButton";
import { useStore } from "../lib/store";

export function SignIn() {
  const { signIn, me, mode } = useStore();
  const [name, setName] = useState(me);
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Add your name so teammates know who added what.");
    if (mode === "supabase" && !passcode) return setError("Enter the team passcode.");
    setBusy(true);
    setError("");
    try {
      await signIn(name, passcode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
      setBusy(false);
    }
  };

  return (
    <div className="gate">
      <div className="gate-theme">
        <ThemeButton />
      </div>
      <div className="gate-card">
        <Emblem size={76} title="Deal Team 6" />
        <h1>Deal Team 6</h1>
        <p className="lede">The people we trust, the comps we've seen, and the tools we use.</p>
        <form className="gate-form" onSubmit={submit}>
          <Field label="Your name">
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="First and last"
              autoFocus={!me}
            />
          </Field>
          {mode === "supabase" ? (
            <Field label="Team passcode">
              <input
                className="input"
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                autoComplete="current-password"
                autoFocus={Boolean(me)}
              />
            </Field>
          ) : (
            <p className="quiet" style={{ fontSize: 14 }}>
              Demo mode: no passcode needed. Data stays in this browser.
            </p>
          )}
          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-primary btn-big" disabled={busy}>
            {busy ? "Checking" : "Enter"}
          </button>
        </form>
        <p className="gate-foot">Authorized personnel only.</p>
      </div>
    </div>
  );
}
