// Covers drawn off the main thread (queue item 41).
//
// A cover is a few hundred ms of arithmetic on a slow phone -- noise fields,
// masks, auto-levels and grain over every pixel -- and on the main thread
// that held the clock back while the music needed it: the Pixel 10a's
// Library and Save / Share stalled the page for 1.3-1.8 s. Here it runs on
// a thread of its own, on an OffscreenCanvas made for reading
// (willReadFrequently: a CPU canvas, so no pixel is read back from a GPU),
// and the finished picture goes to the page as an ImageBitmap, moved, not
// copied. The page only pastes it in.
//
// Messages: { id, spec, size } in; { id, bitmap } or { id, error } out. And
// { id, image, size } in, a picture already drawn, for the PNG the lock
// screen takes (session 30f): { id, blob } out, made here too, so the page
// never reads a pixel back or waits for an encoder.

import { drawCover } from './cover.js';

self.onmessage = async (e) => {
  const { id, spec, size, image } = e.data;
  if (image) {
    try {
      const canvas = new OffscreenCanvas(size, size);
      canvas.getContext('2d', { willReadFrequently: true }).drawImage(image, 0, 0, size, size);
      image.close();
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      self.postMessage({ id, blob });
    } catch (err) {
      self.postMessage({ id, error: String((err && err.message) || err) });
    }
    return;
  }
  try {
    const canvas = new OffscreenCanvas(size, size);
    drawCover(canvas, spec, size);
    const bitmap = canvas.transferToImageBitmap();
    self.postMessage({ id, bitmap }, [bitmap]);
  } catch (err) {
    self.postMessage({ id, error: String((err && err.message) || err) });
  }
};
