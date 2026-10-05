// Photos straight off a phone are 3 to 12 MB. Shrink them before they go anywhere:
// 1600px on the long edge keeps card text sharp for Claude and for people.

export interface Prepared {
  blob: Blob;
  base64: string;
  url: string; // object URL for previews
}

async function decode(file: Blob): Promise<CanvasImageSource & { width: number; height: number }> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* fall back to <img>, which also handles some formats bitmap decoding rejects */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function preparePhoto(file: Blob, maxEdge = 1600, quality = 0.85): Promise<Prepared> {
  let source;
  try {
    source = await decode(file);
  } catch {
    throw new Error("That file is not a photo this browser can open. Try a JPEG or PNG.");
  }
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height));
  const w = Math.round(source.width * scale);
  const h = Math.round(source.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0, w, h);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process the photo."))), "image/jpeg", quality),
  );
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  return { blob, base64, url: URL.createObjectURL(blob) };
}
