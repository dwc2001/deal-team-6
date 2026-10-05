import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CameraIcon, CheckIcon, ImagesIcon, PlusIcon } from "../components/icons";
import { backend, type ScannedCard } from "../lib/backend";
import { findDuplicates } from "../lib/contact-utils";
import { formatPhone, plural } from "../lib/format";
import { preparePhoto, type Prepared } from "../lib/image";
import { useLive, useStore } from "../lib/store";
import { blankContact, ContactFields, type ContactDraft } from "./ContactEditor";

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
  error?: string;
}

const PARALLEL = 3;
let seq = 0;
const nextId = () => `s${++seq}`;

function toDraft(card: ScannedCard): ContactDraft {
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
  });
}

export function Scan() {
  const { save, addCategory } = useStore();
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

  // Free the preview URLs when leaving the page.
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.prepared.url)), []);

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
            draft: toDraft(card),
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

  const addFiles = async (files: FileList | File[] | null) => {
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
        const photo: Photo = {
          id: nextId(),
          prepared: { blob: file, base64: "", url: "" },
          status: "failed",
          error: message,
          cardCount: 0,
        };
        setPhotos((ps) => [...ps, photo]);
      }
    }
  };

  const enterByHand = (photo: Photo) => {
    const entry: Entry = { id: nextId(), photoId: photo.id, draft: blankContact(), newGroup: "Property services", status: "review" };
    setEntries((e) => [...e, entry]);
    setPhotos((ps) => ps.map((p) => (p.id === photo.id ? { ...p, status: "done", cardCount: 1, error: undefined } : p)));
    setCurrent(entry.id);
  };

  const update = (id: string, patch: Partial<Entry>) => setEntries((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const advance = (fromId: string) => {
    setEntries((es) => {
      const idx = es.findIndex((e) => e.id === fromId);
      const next = [...es.slice(idx + 1), ...es.slice(0, idx)].find((e) => e.status === "review");
      setCurrent(next ? next.id : "");
      return es;
    });
  };

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
      await save("contacts", { ...d, category, card_front, name: d.name.trim() });
      update(entry.id, { status: "saved" });
      advance(entry.id);
    } catch (err) {
      update(entry.id, { status: "review", error: err instanceof Error ? err.message : "Could not save." });
    }
  };

  const skip = (entry: Entry) => {
    update(entry.id, { status: "skipped" });
    advance(entry.id);
  };

  const entry = entries.find((e) => e.id === current);
  const entryPhoto = entry ? photos.find((p) => p.id === entry.photoId) : undefined;
  const reading = photos.filter((p) => p.status === "reading").length;
  const failed = photos.filter((p) => p.status === "failed");
  const saved = entries.filter((e) => e.status === "saved").length;
  const toReview = entries.filter((e) => e.status === "review" || e.status === "saving").length;
  const started = photos.length > 0;
  const finished = started && !reading && !toReview;

  const pickers = (
    <>
      <label className="btn btn-primary btn-big">
        <CameraIcon /> Take a photo
        <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
      </label>
      <label className="btn btn-big">
        <ImagesIcon /> Choose photos
        <input type="file" accept="image/*" multiple hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
      </label>
    </>
  );

  const status = !started ? (
    <>Photograph a card, or a stack of them. Claude reads each one and fills in the details for you to check before anything is saved.</>
  ) : (
    <>
      {reading > 0 && <><b>Reading {plural(reading, "photo")}.</b> </>}
      {toReview > 0 && <><b>{plural(toReview, "card")}</b> to check. </>}
      {saved > 0 && <span className="tag-referral">{plural(saved, "person", "people")} saved.</span>}
      {failed.length > 0 && <> <span className="tag-closed">{plural(failed.length, "photo")} could not be read.</span></>}
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
          <h1 className="title">Scan business cards</h1>
          <p className="status">{status}</p>
        </div>
        {started && (
          <div className="head-actions">
            <label className="btn">
              <PlusIcon /> More photos
              <input type="file" accept="image/*" multiple hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
            </label>
          </div>
        )}
      </div>

      {!started && (
        <div className={over ? "drop over" : "drop"}>
          <div>
            <h2>Drop card photos here</h2>
            <p>
              Several cards in one photo works too: lay them flat, fill the frame, and avoid glare.
              Each card becomes a draft you check before it is saved.
            </p>
            <div className="btns">{pickers}</div>
          </div>
        </div>
      )}

      {started && (
        <div className="strip-thumbs" aria-label="Scanned cards">
          {photos.filter((p) => p.status !== "done").map((p) => (
            <div className="thumb" key={p.id}>
              <div className="pic">{p.prepared.url && <img src={p.prepared.url} alt="" />}</div>
              <div className={`cap ${p.status === "failed" ? "failed" : "reading"}`} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {p.status === "reading" ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Reading</> : "Not read"}
              </div>
            </div>
          ))}
          {entries.map((e) => {
            const p = photos.find((x) => x.id === e.photoId);
            return (
              <button key={e.id} className={e.id === current ? "thumb on" : "thumb"} onClick={() => setCurrent(e.id)}>
                <div className="pic">{p?.prepared.url && <img src={p.prepared.url} alt="" />}</div>
                <div className={`cap ${e.status === "saved" ? "saved" : ""}`}>
                  {e.status === "saved" ? "Saved: " : e.status === "skipped" ? "Skipped: " : ""}
                  {e.draft.name || e.draft.company || "Unnamed"}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {failed.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
          {failed.map((p) => (
            <div className="notice bad" key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 0 }}>
              <span style={{ flex: 1, minWidth: 200 }}>{p.error}</span>
              {p.prepared.url && <button className="btn btn-small" onClick={() => enterByHand(p)}>Type it in instead</button>}
              <button className="btn btn-small btn-ghost" onClick={() => setPhotos((ps) => ps.filter((x) => x.id !== p.id))}>Dismiss</button>
            </div>
          ))}
        </div>
      )}

      {entry && entry.status !== "saved" && entry.status !== "skipped" && entryPhoto ? (
        <ReviewCard
          key={entry.id}
          entry={entry}
          photo={entryPhoto}
          onChange={(patch) => update(entry.id, patch)}
          onSave={() => void saveEntry(entry)}
          onSkip={() => skip(entry)}
        />
      ) : entry && entryPhoto ? (
        <div className="notice">
          <b>{entry.draft.name || entry.draft.company}</b> was {entry.status === "saved" ? "saved to the directory" : "skipped"}.
          {entry.status === "skipped" && (
            <button className="btn btn-small" style={{ marginLeft: 12 }} onClick={() => update(entry.id, { status: "review" })}>Review again</button>
          )}
        </div>
      ) : null}

      {!entry && reading > 0 && (
        <div className="notice" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="spinner" />
          <span>Claude is reading {reading === 1 ? "the card" : `${reading} photos`}. This takes a few seconds.</span>
        </div>
      )}

      {finished && (
        <div className="empty">
          <h3>{saved ? `Saved ${plural(saved, "person", "people")}.` : "Nothing saved yet."}</h3>
          <p>{saved ? "They're in the directory now for the whole team." : "Try another photo, or add someone by hand."}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {pickers}
            {saved > 0 && <button className="btn btn-big" onClick={() => navigate("/?f=recent")}>See who was added</button>}
          </div>
        </div>
      )}

      {!started && (
        <p className="more-link">
          No card? <Link to="/">Go to the directory</Link> and use Add person.
        </p>
      )}
    </div>
  );
}

function ReviewCard({
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
  const dupes = findDuplicates(live.contacts, entry.draft);

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
      <div className="review-photo">
        <img src={photo.prepared.url} alt="The card being reviewed" />
        {photo.cardCount > 1 && (
          <p className="faint" style={{ fontSize: 13.5, marginTop: 8 }}>
            This photo had {photo.cardCount} cards, so it is not attached to each person.
          </p>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {dupes.length > 0 && (
          <p className="notice warn">
            Already in the directory: <b>{dupes.map((d) => `${d.name || d.company} (${d.category})`).join(", ")}</b>. Skip this one, or
            save it anyway if it is someone different.
          </p>
        )}
        <ContactFields
          draft={entry.draft}
          set={(patch) => onChange({ draft: { ...entry.draft, ...patch } })}
          newGroup={entry.newGroup}
          setNewGroup={(newGroup) => onChange({ newGroup })}
        />
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn btn-primary btn-big" onClick={onSave} disabled={entry.status === "saving"}>
            <CheckIcon /> {entry.status === "saving" ? "Saving" : "Save to directory"}
          </button>
          <button className="btn btn-big btn-ghost" onClick={onSkip}>Skip</button>
          {entry.error && <span className="error-text">{entry.error}</span>}
        </div>
      </div>
    </div>
  );
}
