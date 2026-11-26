// Covers, as pictures to paste in.
//
// Every cover that the page shows (the playing loop's on the card, an
// album's on the card and in the lists) comes from here. js/cover-worker.js
// draws it on a thread of its own, so that no cover holds the main thread
// (and the music's clock) for the hundreds of ms that it costs on a slow
// phone. What comes back is an ImageBitmap. The page draws it into its
// canvas, and never reads a pixel back.
//
// A browser without module workers or OffscreenCanvas (Safari before 16.4)
// draws on the main thread, one task for each cover, on a canvas made for
// reading.
//
// The last few dozen covers are kept, by what they show and their size, so
// going back to a cover costs nothing.

import { drawCover } from './cover.js';

const KEEP = 48;
const kept = new Map();
let worker = null;
let workerFailed = typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined';
let nextId = 0;
const waiting = new Map();

function startWorker() {
  if (worker || workerFailed) return worker;
  try {
    worker = new Worker(new URL('./cover-worker.js', import.meta.url), { type: 'module' });
  } catch {
    workerFailed = true;
    return null;
  }
  worker.onmessage = (e) => {
    const { id, bitmap, blob, error } = e.data;
    const w = waiting.get(id);
    if (!w) return;
    waiting.delete(id);
    if (bitmap || blob) w.resolve(bitmap || blob);
    else w.reject(new Error(error || 'no cover'));
  };
  // The worker could not load (no module workers, say): everything waiting
  // and everything after is drawn on the main thread.
  worker.onerror = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    workerFailed = true;
    worker = null;
    const all = [...waiting.values()];
    waiting.clear();
    for (const w of all) w.fallback();
  };
  return worker;
}

// On the main thread, a task of its own, when there is no worker.
function drawHere(spec, size) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const canvas = document.createElement('canvas');
        drawCover(canvas, spec, size);
        resolve(canvas);
      } catch (err) {
        reject(err);
      }
    }, 0);
  });
}

function request(spec, size) {
  const w = startWorker();
  if (!w) return drawHere(spec, size);
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    waiting.set(id, {
      resolve,
      reject,
      fallback: () => drawHere(spec, size).then(resolve, reject),
    });
    w.postMessage({ id, spec, size });
  });
}

// The cover of `spec` at `size` px: a promise of something to drawImage
// (an ImageBitmap, or a canvas where there is no worker).
export function coverImage(spec, size = 320) {
  const key = `${size}|${JSON.stringify(spec)}`;
  let p = kept.get(key);
  if (p) {
    // Most recently used last.
    kept.delete(key);
    kept.set(key, p);
    return p;
  }
  p = request(spec, size);
  // A cover that failed is not kept: asked again, it is drawn again.
  p.catch(() => { if (kept.get(key) === p) kept.delete(key); });
  kept.set(key, p);
  while (kept.size > KEEP) kept.delete(kept.keys().next().value);
  return p;
}

// The cover of `spec` as a PNG's Blob, for the phone's lock screen (session
// 30f): the picture `coverImage` keeps, encoded on the covers' thread.
export function coverPng(spec, size = 320) {
  return coverFile(spec, size, 'image/png');
}

// The cover of `spec` as an image file's Blob of `type`, drawn as the
// Library draws it. The type is PNG, or JPEG for an exported file's picture
// (a tenth of the PNG's bytes for this grain, and every player reads it).
export async function coverFile(spec, size = 320, type = 'image/png', quality = 0.9) {
  const image = await coverImage(spec, size);
  const here = () => fileHere(image, size, type, quality);
  if (!startWorker()) return here();
  // A copy to send: the kept picture stays the page's.
  const copy = await createImageBitmap(image);
  const w = startWorker();
  if (!w) return here();
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    waiting.set(id, { resolve, reject, fallback: () => here().then(resolve, reject) });
    w.postMessage({ id, image: copy, size, type, quality }, [copy]);
  });
}

// With no worker, the browser's own encoder, which calls back when it's done.
function fileHere(image, size, type, quality) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    paint(canvas, image);
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('no picture'))), type, quality);
  });
}

// The picture into `canvas`, scaled to fill it. Drawing a bitmap in reads
// nothing back.
export function paint(canvas, image) {
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
}
