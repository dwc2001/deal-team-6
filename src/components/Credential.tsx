// The credential: Deal Team 6's signature piece. A person's record opens on a
// business card turned credential; when they were scanned, their real card is
// on the back. The switch sits under the card, never on it.
import { useState } from "react";
import { Emblem } from "./Emblem";
import { StarIcon } from "./icons";
import { initials } from "../lib/format";
import { roleLine, useCardUrl } from "../lib/contact-utils";
import type { Contact } from "../lib/types";

type CardPerson = Pick<Contact, "category" | "name" | "company" | "title" | "phone" | "email" | "territory" | "preferred" | "pays_referral">;

export function CredentialFront({ c, width = 400 }: { c: CardPerson; width?: number }) {
  const lines = [c.phone, c.email].filter(Boolean);
  const seals = c.preferred || c.pays_referral;
  return (
    <div className="cred" style={{ ["--w" as string]: `${width}px` }} aria-label={`Credential for ${c.name || c.company}`}>
      <div className="cr-top">
        <span className="cr-svc">{c.category || "Service not set"}</span>
        <Emblem size={Math.round(width * 0.075)} />
      </div>
      <div className="cr-mid">
        <div className="cr-name">{c.name || c.company || "Unnamed"}</div>
        <div className="cr-role">{(c.name ? roleLine(c) : "") || c.territory || "\u00a0"}</div>
      </div>
      <div className="cr-foot">
        <div className="cr-lines">
          {lines.length ? lines.map((l) => <div key={l} className="num">{l}</div>) : <div>{c.territory || "No phone or email yet"}</div>}
        </div>
        {seals && (
          <div className="cr-seals">
            {c.preferred && (
              <span className="cr-seal">
                <StarIcon size={13} /> Preferred
              </span>
            )}
            {c.pays_referral && <span className="cr-seal good">Pays referrals</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/** The credential with its back (their card photo) when there is one. */
export function Credential({ c, width = 400 }: { c: Contact; width?: number }) {
  const photo = useCardUrl(c.card_front);
  const [side, setSide] = useState<"front" | "back">("front");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {photo && side === "back" ? (
        <div className="cred photo" style={{ ["--w" as string]: `${width}px` }}>
          <img src={photo} alt={`The business card ${c.name || c.company} gave the team`} />
        </div>
      ) : (
        <CredentialFront c={c} width={width} />
      )}
      {photo && (
        <div className="cred-tabs" role="tablist" aria-label="Card side">
          <button role="tab" aria-selected={side === "front"} className={side === "front" ? "on" : ""} onClick={() => setSide("front")}>
            Credential
          </button>
          <button role="tab" aria-selected={side === "back"} className={side === "back" ? "on" : ""} onClick={() => setSide("back")}>
            Their card
          </button>
        </div>
      )}
    </div>
  );
}

/** The small credential used in lists: initials, or their card photo. */
export function MiniCred({ c }: { c: Pick<Contact, "name" | "company" | "card_front"> }) {
  const photo = useCardUrl(c.card_front);
  return photo ? (
    <span className="mini has-photo">
      <img src={photo} alt="" />
    </span>
  ) : (
    <span className="mini">{initials(c.name, c.company)}</span>
  );
}
