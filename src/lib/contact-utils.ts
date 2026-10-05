import { useEffect, useState } from "react";
import { backend } from "./backend";
import { websiteHref } from "./format";
import type { Contact } from "./types";

/** Signed link (or data URL in demo mode) for a stored card photo. */
export function useCardUrl(ref: string | null | undefined): string {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let live = true;
    setUrl("");
    if (ref) {
      backend.cardUrl(ref).then((u) => live && setUrl(u)).catch(() => live && setUrl(""));
    }
    return () => {
      live = false;
    };
  }, [ref]);
  return url;
}

export function roleLine(c: Pick<Contact, "title" | "company">): string {
  return [c.title, c.company].filter(Boolean).join(", ");
}

export function contactText(c: Contact): string {
  return [
    c.name,
    [c.category, c.company].filter(Boolean).join(", "),
    c.phone,
    c.phone_alt,
    c.email,
    c.website,
  ]
    .filter(Boolean)
    .join("\n");
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (m) => `\\${m}`);

export function vcard(c: Contact): string {
  const parts = c.name.trim().split(/\s+/);
  const last = parts.length > 1 ? parts.pop()! : "";
  const first = parts.join(" ");
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${esc(last)};${esc(first)};;;`,
    `FN:${esc(c.name || c.company)}`,
    c.company && `ORG:${esc(c.company)}`,
    c.title && `TITLE:${esc(c.title)}`,
    c.phone && `TEL;TYPE=CELL,VOICE:${c.phone}`,
    c.phone_alt && `TEL;TYPE=WORK,VOICE:${c.phone_alt}`,
    c.email && `EMAIL;TYPE=INTERNET:${c.email}`,
    c.website && `URL:${websiteHref(c.website)}`,
    c.address && `ADR;TYPE=WORK:;;${esc(c.address)};;;;`,
    `NOTE:${esc([`${c.category} (Deal Team 6)`, c.notes].filter(Boolean).join("\n"))}`,
    "END:VCARD",
  ];
  return lines.filter(Boolean).join("\r\n");
}

/** Possible duplicates: same email, same phone digits, or same name. */
export function findDuplicates(contacts: Contact[], c: Partial<Contact>): Contact[] {
  const digits = (s = "") => s.replace(/\D/g, "").slice(-10);
  const email = (c.email ?? "").trim().toLowerCase();
  const phone = digits(c.phone);
  const name = (c.name ?? "").trim().toLowerCase();
  return contacts.filter(
    (x) =>
      x.id !== c.id &&
      ((email && x.email.toLowerCase() === email) ||
        (phone.length === 10 && (digits(x.phone) === phone || digits(x.phone_alt) === phone)) ||
        (name.length > 3 && x.name.trim().toLowerCase() === name)),
  );
}
