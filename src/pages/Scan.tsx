import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CredentialFront } from "../components/Credential";
import { CameraIcon, CheckIcon, EditIcon, ImagesIcon, PlusIcon } from "../components/icons";
import { backend, type ScannedCard } from "../lib/backend";
import { findDuplicates } from "../lib/contact-utils";
import { formatPhone, plural } from "../lib/format";
import { preparePhoto, type Prepared } from "../lib/image";
import { takePendingPhotos } from "../lib/pending";
import { useLive, useStore } from "../lib/store";
import { blankContact, ContactFields, type ContactDraft } from "./ContactEditor";
import { servicePath } from "./People";
import { useCardWidth } from "./Record";

interface Photo {
  id: string;
  prepared: Prepared;
  status: "reading" | "done" | "failed";
  error?: string;
  cardCount: number;
}

interface Entry {
  id: string;
  photoId: string;
  draft: ContactDraft;
  newGroup: string;
  status: "review" | "saving" | "saved" | "skipped";
  savedId?: string;
  error?: string;
}

const PARALLEL = 3;
let seq = 0;
const nextId = () => `s${++seq}`;
const today = () => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date());

function toDraft(card: ScannedCard, me: string): ContactDraft {
  return blankContact({
    name: card.name,
    title: card.title,
    company: card.company,
    phone: formatPhone(card.phone),
    phone_alt: formatPhone(card.phone_alt),
    email: card.email,
    website: card.website,
    address: card.address,
    territory: card.territory,
    category: card.category,
    notes: card.notes,
    // Whoever scans the card met them: that is the team's warm introduction.
    connection: me ? `${me}, met ${today()}` : "",
  });
}

export function Scan() {
  const { save, addCategory, me, edit } = useStore();
  const live = useLive();
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [current, setCurrent] = useState("");
  const [over, setOver] = useState(false);
  const queue = useRef<string[]>([]);
  const active = useRef(0);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const categories = useMemo(() => live.categories.map((c) => c.name), [live.categories]);
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;
  const meRef = useRef(me);
  meRef.current = me;

  useEffect(() => () => photosRef.current.forEach((p) => p.prepared.url && URL.revokeObjectURL(p.prepared.url)), []);

  const pump = useCallback(() => {
    while (active.current < PARALLEL && queue.current.length) {
      const id = queue.current.shift()!;
      const photo = photosRef.current.find((p) => p.id === id);
      if (!photo) continue;
      active.current++;
      backend
        .scan({ data: photo.prepared.base64, media_type: "image/jpeg" }, categoriesRef.current)
        .then((cards) => {
          if (!cards.length) throw new Error("No business card found in this photo.");
          const made = cards.map<Entry>((card) => ({
            id: nextId(),
            photoId: id,
            draft: toDraft(card, meRef.current),
            newGroup: "Property services",
            status: "review",
          }));
          setEntries((e) => [...e, ...made]);
          setCurrent((c) => c || made[0].id);
          setPhotos((ps) => ps.map((p) => (p.id === id ? { ...p, status: "done", cardCount: cards.length } : p)));
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : "Could not read this photo.";
          setPhotos((ps) => ps.map((p) => (p.id === id ? { ...p, status: "failed", error: message } : p)));
        })
        .finally(() => {
          active.current--;
          pump();
        });
    }
  }, []);

  const addFiles = useCallback(
    async (files: FileList | File[] | null) => {
      const list = [...(files ?? [])].filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
      for (const file of list) {
        try {
          const prepared = await preparePhoto(file);
          const photo: Photo = { id: nextId(), prepared, status: "reading", cardCount: 0 };
          photosRef.current = [...photosRef.current, photo];
          setPhotos(photosRef.current);
          queue.current.push(photo.id);
          pump();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Could not open that file.";
          setPhotos((ps) => [...ps, { id: nextId(), prepared: { blob: file, base64: "", url: "" }, status: "failed", error: message, cardCount: 0 }]);
        }
      }
    },
    [pump],
  );

  // Photos dropped on the People page arrive here.
  useEffect(() => {
    const waiting = takePendingPhotos();
    if (waiting.length) void addFiles(waiting);
  }, [addFiles]);

  const enterByHand = (photo: Photo) => {
    const entry: Entry = {
      id: nextId(), photoId: photo.id, newGroup: "Property services", status: "review",
      draft: blankContact({ connection: me ? `${me}, met ${today()}` : "" }),
    };
    setEntries((e) => [...e, entry]);
    setPhotos((ps) => ps.map((p) => (p.id === photo.id ? { ...p, status: "done", cardCount: 1, error: undefined } : p)));
    setCurrent(entry.id);
  };

  const update = (id: string, patch: Partial<Entry>) => setEntries((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const saveEntry = async (entry: Entry) => {
    const d = entry.draft;
    const category = d.category.trim();
    if (!category) return update(entry.id, { error: "Pick the service they provide." });
    if (!d.name.trim() && !d.company.trim()) return update(entry.id, { error: "Add a name or a company." });
    update(entry.id, { status: "saving", error: undefined });
    try {
      if (!live.categories.some((c) => c.name === category)) await addCategory(category, entry.newGroup);
      const photo = photos.find((p) => p.id === entry.photoId);
      const card_front = photo && photo.cardCount === 1 && photo.prepared.base64 ? await backend.uploadCard(photo.prepared.blob) : null;
      const saved = await save("contacts", { ...d, category, card_front, name: d.name.trim() });
      update(entry.id, { status: "saved", savedId: saved.id });
    } catch (err) {
      update(entry.id, { status: "review", error: err instanceof Error ? err.message : "Could not save." });
    }
  };

  const next = (fromId: string) => {
    const idx = entries.findIndex((e) => e.id === fromId);
    const nextOne = [...entries.slice(idx + 1), ...entries.slice(0, idx)].find((e) => e.status === "review");
    setCurrent(nextOne ? nextOne.id : "");
  };

  const entry = entries.find((e) => e.id === current);
  const entryPhoto = entry ? photos.find((p) => p.id === entry.photoId) : undefined;
  const reading = photos.filter((p) => p.status === "reading").length;
  const failed = photos.filter((p) => p.status === "failed");
  const saved = entries.filter((e) => e.status === "saved").length;
  const toReview = entries.filter((e) => e.status === "review" || e.status === "saving").length;
  const started = photos.length > 0;
  const multi = entries.length > 1 || photos.length > 1;

  // On a phone the camera leads; on a computer, choosing photos does.
  const pickers = (
    <>
      <label className="btn btn-big pick-take">
        <CameraIcon /> Take a photo
        <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
      </label>
      <label className="btn btn-big pick-choose">
        <ImagesIcon /> Choose photos
        <input type="file" accept="image/*" multiple hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
      </label>
    </>
  );

  return (
    <div
      className="sheet"
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setOver(false); }}
      onDrop={(e) => { e.preventDefault(); setOver(false); void addFiles(e.dataTransfer.files); }}
    >
      <div className="head">
        <div className="head-text">
          <h1 className="title">Add someone</h1>
          <p className="status">
            {!started ? (
              <>Photograph their business card. Claude reads it, you check it, and the whole team can find them.</>
            ) : (
              <>
                {reading > 0 && <><b>Reading {plural(reading, "photo")}.</b> </>}
                {toReview > 0 && <><b>{plural(toReview, "card")}</b> to check. </>}
                {saved > 0 && <span className="tag-referral">{plural(saved, "person", "people")} added. </span>}
                {failed.length > 0 && <span className="tag-closed">{plural(failed.length, "photo")} could not be read.</span>}
              </>
            )}
          </p>
        </div>
        {started && (
          <div className="head-actions">
            <label className="btn">
              <PlusIcon size={17} /> More photos
              <input type="file" accept="image/*" multiple hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
            </label>
          </div>
        )}
      </div>

      {!started && (
        <div className="add-hero">
          <div className={over ? "drop over" : "drop"}>
            <h2>Their card, in one photo</h2>
            <p>Fill the frame with the card and avoid glare. A few cards laid flat in one photo works too. On a computer, drop the photos here.</p>
            <div className="btns">{pickers}</div>
            <button className="link-btn" onClick={() => edit({ kind: "contact", preset: { connection: me ? `${me}, met ${today()}` : "" } })}>
              <EditIcon size={16} /> No card? Type them in
            </button>
          </div>
          <div className="add-side">
            <b>How it works</b>
            <ol>
              <li>Take or choose a photo of their card.</li>
              <li>Claude reads the name, company, phone, email and what they do. You check every field.</li>
              <li>They are saved for the whole team, with you as someone who knows them.</li>
            </ol>
          </div>
        </div>
      )}

      {started && multi && (
        <div className="strip-thumbs" aria-label="Photos">
          {photos.filter((p) => p.status !== "done").map((p) => (
            <div className="thumb" key={p.id}>
              <div className="pic">{p.prepared.url && <img src={p.prepared.url} alt="" />}</div>
              <div className={`cap ${p.status === "failed" ? "failed" : "reading"}`}>{p.status === "reading" ? "Reading" : "Not read"}</div>
            </div>
          ))}
          {entries.map((e) => {
            const p = photos.find((x) => x.id === e.photoId);
            return (
              <button key={e.id} className={e.id === current ? "thumb on" : "thumb"} onClick={() => setCurrent(e.id)}>
                <div className="pic">{p?.prepared.url && <img src={p.prepared.url} alt="" />}</div>
                <div className={`cap ${e.status === "saved" ? "saved" : ""}`}>
                  {e.status === "saved" ? "Added: " : e.status === "skipped" ? "Skipped: " : ""}
                  {e.draft.name || e.draft.company || "Unnamed"}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {failed.map((p) => (
        <div className="notice bad" key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
          <span style={{ flex: 1, minWidth: 200 }}>{p.error}</span>
          {p.prepared.url && <button className="btn btn-small" onClick={() => enterByHand(p)}>Type it in instead</button>}
          <button className="btn btn-small btn-ghost" onClick={() => setPhotos((ps) => ps.filter((x) => x.id !== p.id))}>Dismiss</button>
        </div>
      ))}

      {!entry && reading > 0 && (
        <div className="notice" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="spinner" />
          <span>Claude is reading {reading === 1 ? "the card" : `${reading} photos`}. This takes a few seconds.</span>
        </div>
      )}

      {entry && entryPhoto && entry.status === "saved" && (
        <Added
          entry={entry}
          onNext={toReview > 0 ? () => next(entry.id) : undefined}
          onOpen={() => navigate(`${servicePath(entry.draft.category.trim())}?p=${entry.savedId}`)}
          pickers={pickers}
        />
      )}

      {entry && entryPhoto && (entry.status === "review" || entry.status === "saving") && (
        <Check
          key={entry.id}
          entry={entry}
          photo={entryPhoto}
          onChange={(patch) => update(entry.id, patch)}
          onSave={() => void saveEntry(entry)}
          onSkip={() => {
            update(entry.id, { status: "skipped" });
            next(entry.id);
          }}
        />
      )}

      {entry && entry.status === "skipped" && (
        <div className="notice">
          Skipped <b>{entry.draft.name || entry.draft.company}</b>.{" "}
          <button className="link-btn" onClick={() => update(entry.id, { status: "review" })}>Check it again</button>
        </div>
      )}

      {!started && (
        <p className="more-link">
          Looking for someone instead? <Link to="/">Go to People</Link>.
        </p>
      )}
    </div>
  );
}

function Check({
  entry,
  photo,
  onChange,
  onSave,
  onSkip,
}: {
  entry: Entry;
  photo: Photo;
  onChange: (patch: Partial<Entry>) => void;
  onSave: () => void;
  onSkip: () => void;
}) {
  const live = useLive();
  const width = useCardWidth();
  const dupes = findDuplicates(live.contacts, entry.draft);
  const who = entry.draft.name.trim().split(/\s+/)[0] || entry.draft.company || "them";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onSave();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onSave]);

  return (
    <div className="review">
      <div className="review-side">
        <CredentialFront c={entry.draft} width={width} />
        <p className="byline">Their credential updates as you fix the fields.</p>
        {photo.prepared.url && <img className="photo-small" src={photo.prepared.url} alt="The photo being read" />}
        {photo.cardCount > 1 && (
          <p className="byline">This photo had {photo.cardCount} cards, so it is not kept with each person.</p>
        )}
      </div>
      <div className="review-form">
        {dupes.length > 0 && (
          <p className="notice warn">
            Already on the list: <b>{dupes.map((d) => `${d.name || d.company} (${d.category})`).join(", ")}</b>. Skip this one, or add
            it anyway if it is someone different.
          </p>
        )}
        <ContactFields
          draft={entry.draft}
          set={(patch) => onChange({ draft: { ...entry.draft, ...patch } })}
          newGroup={entry.newGroup}
          setNewGroup={(newGroup) => onChange({ newGroup })}
        />
        <div className="review-actions">
          <button className="btn btn-primary btn-big" onClick={onSave} disabled={entry.status === "saving"}>
            <CheckIcon /> {entry.status === "saving" ? "Adding" : `Add ${who} to Deal Team 6`}
          </button>
          <button className="btn btn-big btn-ghost" onClick={onSkip}>Skip</button>
          {entry.error && <span className="error-text">{entry.error}</span>}
        </div>
      </div>
    </div>
  );
}

function Added({ entry, onNext, onOpen, pickers }: { entry: Entry; onNext?: () => void; onOpen: () => void; pickers: React.ReactNode }) {
  const width = useCardWidth(360);
  const who = entry.draft.name || entry.draft.company;
  return (
    <div className="done-card">
      <CredentialFront c={entry.draft} width={width} />
      <h2>{who} is on the team&#x27;s list</h2>
      <p>Anyone can find them under {entry.draft.category}. You are saved as someone who knows them.</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        {onNext ? (
          <button className="btn btn-primary btn-big" onClick={onNext}>Next card</button>
        ) : (
          pickers
        )}
        <button className="btn btn-big" onClick={onOpen}>Open their credential</button>
      </div>
    </div>
  );
}
