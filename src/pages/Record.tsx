import { useEffect, useState } from "react";
import { Credential } from "../components/Credential";
import {
  ArchiveIcon, BackIcon, CopyIcon, EditIcon, MailIcon, PhoneIcon, RestoreIcon, SaveContactIcon, SendIcon, TextIcon,
} from "../components/icons";
import { Dialog } from "../components/ui";
import { contactText, vcard } from "../lib/contact-utils";
import { dayOf, downloadFile, telHref, websiteHref } from "../lib/format";
import { useStore } from "../lib/store";
import type { Contact } from "../lib/types";

/** The credential's width: 400 on a computer, the screen less its margins on a phone. */
export function useCardWidth(max = 400) {
  const calc = () => Math.min(max, Math.max(260, window.innerWidth - 32));
  const [w, setW] = useState(calc);
  useEffect(() => {
    const onResize = () => setW(calc());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [max]);
  return w;
}

export function Record({ c, onClose, backLabel }: { c: Contact; onClose: () => void; backLabel: string }) {
  const { edit, save, setArchived, toast, me } = useStore();
  const [sending, setSending] = useState(false);
  const width = useCardWidth();
  const who = c.name || c.company;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(contactText(c));
      toast(`Copied ${who}'s details`);
    } catch {
      toast("Could not copy. Select the details and copy them instead.");
    }
  };

  const remove = async () => {
    await setArchived("contacts", c.id, true);
    onClose();
    toast(`Removed ${who}`, { label: "Undo", run: () => void setArchived("contacts", c.id, false) });
  };

  const iKnowThem = async () => {
    await save("contacts", { ...c, connection: me });
    toast(`Saved: you know ${who}`);
  };

  const details: [string, React.ReactNode][] = [
    ["Territory", c.territory],
    ["Other phone", c.phone_alt && <a className="num" href={telHref(c.phone_alt)}>{c.phone_alt}</a>],
    ["Website", c.website && <a href={websiteHref(c.website)} target="_blank" rel="noreferrer">{c.website}</a>],
    ["Address", c.address],
  ];

  return (
    <aside className="rec" aria-label={`${who}, ${c.category}`}>
      <div className="rec-top">
        <button className="crumb" onClick={onClose}>
          <BackIcon size={18} /> {backLabel}
        </button>
        <button className="icon-btn" onClick={() => edit({ kind: "contact", row: c })} aria-label={`Edit ${who}`}>
          <EditIcon />
        </button>
      </div>

      <Credential c={c} width={width} />

      <div className="acts">
        {c.phone ? (
          <a className="btn btn-primary" href={telHref(c.phone)}>
            <PhoneIcon size={17} /> Call
          </a>
        ) : (
          <button className="btn btn-primary" disabled title="No phone number yet">
            <PhoneIcon size={17} /> Call
          </button>
        )}
        {c.email ? (
          <a className="btn" href={`mailto:${c.email}`}>
            <MailIcon size={17} /> Email
          </a>
        ) : (
          <button className="btn" disabled title="No email yet">
            <MailIcon size={17} /> Email
          </button>
        )}
        <button className="btn" onClick={() => setSending(true)}>
          <SendIcon size={17} /> <span className="send-full">Send to a client</span>
          <span className="send-short">Send</span>
        </button>
      </div>
      <div className="more">
        <button
          className="link-btn"
          onClick={() => downloadFile(`${who.replace(/[^\w ]+/g, "") || "contact"}.vcf`, vcard(c), "text/vcard")}
        >
          <SaveContactIcon size={16} /> Save to phone
        </button>
        <button className="link-btn" onClick={copy}>
          <CopyIcon size={16} /> Copy details
        </button>
        <button className="link-btn hide-phone" onClick={() => edit({ kind: "contact", row: c })}>
          <EditIcon size={16} /> Edit
        </button>
      </div>

      <dl className="dos">
        <div>
          <dt>Who knows them</dt>
          {c.connection ? (
            <dd className="big">{c.connection}</dd>
          ) : (
            <dd>
              <span className="byline">Nobody yet. </span>
              {!c.archived && (
                <button className="link-btn" style={{ color: "var(--olive)" }} onClick={iKnowThem}>
                  I know them
                </button>
              )}
            </dd>
          )}
        </div>
        {details
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
      <div className="rec-foot">
        {c.archived ? (
          <button className="btn btn-small" onClick={() => void setArchived("contacts", c.id, false).then(() => toast(`Restored ${who}`))}>
            <RestoreIcon size={16} /> Restore
          </button>
        ) : (
          <button className="btn btn-small btn-danger" onClick={remove}>
            <ArchiveIcon size={16} /> Remove
          </button>
        )}
      </div>

      {sending && <SendToClient c={c} onClose={() => setSending(false)} />}
    </aside>
  );
}

function introduction(c: Contact): string {
  const kind = c.category ? ` for ${c.category.toLowerCase()}` : "";
  const who = [c.name || c.company, c.name && c.title && c.company ? `${c.title} at ${c.company}` : c.name ? c.company : ""]
    .filter(Boolean)
    .join(", ");
  const reach = [c.phone, c.email].filter(Boolean).join(", ");
  return `Here is who I mentioned${kind}: ${who}${reach ? `, ${reach}` : ""}. Tell them I sent you.`;
}

function SendToClient({ c, onClose }: { c: Contact; onClose: () => void }) {
  const { toast } = useStore();
  const [text, setText] = useState(() => introduction(c));
  const canShare = typeof navigator !== "undefined" && "share" in navigator;
  const subject = `${c.name || c.company}, ${c.category}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied the introduction");
      onClose();
    } catch {
      toast("Could not copy. Select the message and copy it instead.");
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: subject, text });
      onClose();
    } catch {
      /* closed the share sheet: nothing to do */
    }
  };

  return (
    <Dialog
      title={`Send ${c.name || c.company} to a client`}
      onClose={onClose}
      narrow
      footer={
        <>
          <button className="btn btn-ghost left" onClick={copy}>
            <CopyIcon size={16} /> Copy
          </button>
          <a className="btn" href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`} onClick={onClose}>
            <MailIcon size={16} /> Email it
          </a>
          {canShare ? (
            <button className="btn btn-primary" onClick={share}>
              <SendIcon size={16} /> Share
            </button>
          ) : (
            <a className="btn btn-primary" href={`sms:?&body=${encodeURIComponent(text)}`} onClick={onClose}>
              <TextIcon size={16} /> Text it
            </a>
          )}
        </>
      }
    >
      <textarea
        className="message"
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="The introduction"
      />
      <p className="byline">Edit it before it goes. Their phone and email are already in it.</p>
    </Dialog>
  );
}
