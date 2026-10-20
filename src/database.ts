import { captureDate } from "./exif";
import type { Photo } from "./types";
const open = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("photo-vj-studio", 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore("photos", { keyPath: "id" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
export async function allPhotos(): Promise<Photo[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("photos");
    const r = tx.objectStore("photos").getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    tx.oncomplete = () => db.close();
  });
}
export async function savePhoto(photo: Photo) {
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("photos", "readwrite");
    tx.objectStore("photos").put(photo);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export async function clearPhotos() {
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("photos", "readwrite");
    tx.objectStore("photos").clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}
// Original full-size images are decoded one at a time and discarded after thumbnail generation.
export async function analyze(file: File): Promise<Photo> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const w = bitmap.width,
    h = bitmap.height;
  const canvas = new OffscreenCanvas(
    Math.max(1, Math.round(w * Math.min(1, 256 / Math.max(w, h)))),
    Math.max(1, Math.round(h * Math.min(1, 256 / Math.max(w, h)))),
  );
  const c = canvas.getContext("2d")!;
  c.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const pixels = c.getImageData(0, 0, canvas.width, canvas.height).data;
  const sum = [0, 0, 0],
    histogram = Array(24).fill(0);
  let saturation = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const vals = [pixels[i], pixels[i + 1], pixels[i + 2]];
    vals.forEach((v, j) => {
      sum[j] += v;
      histogram[j * 8 + Math.min(7, v >> 5)]++;
    });
    const max = Math.max(...vals);
    saturation += max ? (max - Math.min(...vals)) / max : 0;
  }
  const count = pixels.length / 4;
  const rgb = sum.map((v) => Math.round(v / count)) as [number, number, number];
  const brightness =
    (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  return {
    id: crypto.randomUUID(),
    name: file.name,
    blob: await canvas.convertToBlob({ type: "image/webp", quality: 0.85 }),
    width: w,
    height: h,
    rgb,
    brightness,
    saturation: saturation / count,
    histogram: histogram.map((v) => v / count),
    capturedAt: await captureDate(file),
    timeOfDay:
      brightness > 0.65
        ? "day (estimated)"
        : brightness > 0.3
          ? "evening (estimated)"
          : "night (estimated)",
    excluded: false,
    faceStatus: "not-analyzed",
  };
}
