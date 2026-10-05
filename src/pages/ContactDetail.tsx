import { useState } from "react";
import { Emblem } from "../components/Emblem";
import {
  ArchiveIcon, BackIcon, CloseIcon, CopyIcon, EditIcon, MailIcon, PhoneIcon, RestoreIcon, SaveContactIcon, StarIcon,
} from "../components/icons";
import { contactText, roleLine, useCardUrl, vcard } from "../lib/contact-utils";
import { dayOf, downloadFile, telHref, websiteHref } from "../lib/format";
import { useStore } from "../lib/store";
import type { Contact } from "../lib/types";

export function ContactDetail({ c, onClose, backLabel }: { c: Contact; onClose: () => void; backLabel: string }) {
  const { edit, setArchived, toast } = useStore();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(contactText(c));
      toast(`Copied ${c.name || c.company}'s details`);
    } catch {
      toast("Could not copy. Select the details and copy them instead.");
    }
  };

  const remove = async () => {
    await setArchived("contacts", c.id, true);
    onClose();
    toast(`Removed ${c.name || c.company}`, { label: "Undo", run: () => void setArchived("contacts", c.id, false) });
  };

  const restore = async () => {
    await setArchived("contacts", c.id, false);
    toast(`Restored ${c.name || c.company}`);
  };

  const facts: [string, React.ReactNode][] = [
    ["Phone", c.phone && <a className="num" href={telHref(c.phone)}>{c.phone}</a>],
    ["Other phone", c.phone_alt && <a className="num" href={telHref(c.phone_alt)}>{c.phone_alt}</a>],
    ["Email", c.email && <a href={`mailto:${c.email}`}>{c.email}</a>],
    ["Website", c.website && <a href={websiteHref(c.website)} target="_blank" rel="noreferrer">{c.website}</a>],
    ["Address", c.address],
    ["Service", c.category],
    ["Territory", c.territory],
    ["Who knows them", c.connection],
  ];

  return (
    <aside className="detail" aria-label={`${c.name} details`}>
      <div className="detail-top">
        <button className="crumb" onClick={onClose} style={{ margin: 0 }}>
          <BackIcon size={16} /> {backLabel}
        </button>
        <button className="icon-btn hide-phone" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
      </div>

      <BizCard c={c} />

      <h2>{c.name || c.company}</h2>
      {(roleLine(c) || c.category) && <p className="sub">{roleLine(c) || c.category}</p>}
      {(c.preferred || c.pays_referral || c.archived) && (
        <div className="tags">
          {c.preferred && (
            <span className="tag tag-preferred">
              <StarIcon size={14} /> Preferred
            </span>
          )}
          {c.pays_referral && <span className="tag tag-referral">Pays referrals</span>}
          {c.archived && <span className="tag tag-closed">Removed</span>}
        </div>
      )}

      <div className="actions">
        {c.phone && (
          <a className="btn btn-primary" href={telHref(c.phone)}>
            <PhoneIcon /> Call
          </a>
        )}
        {c.email && (
          <a className={c.phone ? "btn" : "btn btn-primary"} href={`mailto:${c.email}`}>
            <MailIcon /> Email
          </a>
        )}
        <button className="btn" onClick={copy}>
          <CopyIcon /> Copy
        </button>
        <button
          className="btn"
          onClick={() => downloadFile(`${(c.name || c.company || "contact").replace(/[^\w ]+/g, "")}.vcf`, vcard(c), "text/vcard")}
        >
          <SaveContactIcon /> Save to phone
        </button>
      </div>

      <dl className="facts">
        {facts
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        {c.notes && (
          <div>
            <dt>Notes</dt>
            <dd className="notes">{c.notes}</dd>
          </div>
        )}
      </dl>

      <p className="byline">
        {c.added_by === "Spreadsheet" ? "From the original spreadsheet." : `Added by ${c.added_by || "someone"} on ${dayOf(c.created_at)}.`}
        {c.updated_by && ` Last edited by ${c.updated_by} on ${dayOf(c.updated_at)}.`}
      </p>
      <div className="detail-foot">
        {c.archived ? (
          <button className="btn" onClick={restore}>
            <RestoreIcon /> Restore
          </button>
        ) : (
          <>
            <button className="btn btn-ghost" onClick={() => edit({ kind: "contact", row: c })}>
              <EditIcon /> Edit
            </button>
            <button className="btn btn-danger" onClick={remove}>
              <ArchiveIcon /> Remove
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

/** The person as a business card: their scanned card when there is one, otherwise typeset. */
export function BizCard({ c }: { c: Contact }) {
  const photo = useCardUrl(c.card_front);
  const [typed, setTyped] = useState(false);
  if (photo && !typed) {
    return (
      <div className="bizcard photo">
        <img src={photo} alt={`Business card for ${c.name}`} />
        <button className="btn btn-small card-switch" onClick={() => setTyped(true)}>
          Typed card
        </button>
      </div>
    );
  }
  return (
    <div className="bizcard">
      <span className="bc-rule" />
      <span className="bc-mark">
        <Emblem size={22} />
      </span>
      <div>
        <div className="bc-name">{c.name || c.company}</div>
        <div className="bc-title">{c.title || c.category}</div>
      </div>
      <div className="bc-foot">
        <div className="bc-company">{c.company}</div>
        <div className="bc-lines">
          {c.phone && <div className="num">{c.phone}</div>}
          {c.email && <div>{c.email}</div>}
          {!c.phone && !c.email && c.territory && <div>{c.territory}</div>}
        </div>
      </div>
      {photo && (
        <button className="btn btn-small card-switch" onClick={() => setTyped(false)}>
          Photo
        </button>
      )}
    </div>
  );
}
