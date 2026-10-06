// Card photos dropped on the People page, waiting for the Add someone page to pick them up.
let pending: File[] = [];

export function setPendingPhotos(files: File[]) {
  pending = files;
}

export function takePendingPhotos(): File[] {
  const out = pending;
  pending = [];
  return out;
}
