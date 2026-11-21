// Photo → canvas, détourage, caméra. Tout reste sur l'appareil.
import { segmentGarment, cutOut, dominantColors, guessPattern } from "../scan.js";

export async function fileToCanvas(file, maxSide = 720) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch {
    bmp = await new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = URL.createObjectURL(file); });
  }
  const w0 = bmp.width, h0 = bmp.height, k = Math.min(1, maxSide / Math.max(w0, h0));
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(w0 * k)); cv.height = Math.max(1, Math.round(h0 * k));
  cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
  bmp.close?.();
  return cv;
}

export function analyzeCanvas(cv, { tolerance = 40, bg = null } = {}) {
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, cv.width, cv.height);
  const seg = segmentGarment(img.data, cv.width, cv.height, { tolerance, bg });
  const cut = seg.bbox ? cutOut(img.data, cv.width, cv.height, seg.mask, seg.bbox) : null;
  const colors = dominantColors(img.data, cv.width, cv.height, seg.bbox ? seg.mask : null);
  let out = null;
  if (cut) {
    out = document.createElement("canvas");
    out.width = cut.w; out.height = cut.h;
    out.getContext("2d").putImageData(new ImageData(cut.data, cut.w, cut.h), 0, 0);
  }
  return { seg, cut: out, colors, pattern: guessPattern(colors) };
}

export function pixelAt(cv, x, y) {
  const d = cv.getContext("2d", { willReadFrequently: true }).getImageData(Math.max(0, Math.min(cv.width - 1, x | 0)), Math.max(0, Math.min(cv.height - 1, y | 0)), 1, 1).data;
  return [d[0], d[1], d[2]];
}

// Réduit encore la découpe avant stockage (WebP si possible, sinon PNG) pour garder la base légère.
export function packCutout(cv, maxSide = 560) {
  const k = Math.min(1, maxSide / Math.max(cv.width, cv.height));
  const out = document.createElement("canvas");
  out.width = Math.round(cv.width * k); out.height = Math.round(cv.height * k);
  out.getContext("2d").drawImage(cv, 0, 0, out.width, out.height);
  const webp = out.toDataURL("image/webp", 0.85);
  return webp.startsWith("data:image/webp") ? webp : out.toDataURL("image/png");
}
export function packPhoto(cv, maxSide = 560) {
  const k = Math.min(1, maxSide / Math.max(cv.width, cv.height));
  const out = document.createElement("canvas");
  out.width = Math.round(cv.width * k); out.height = Math.round(cv.height * k);
  out.getContext("2d").drawImage(cv, 0, 0, out.width, out.height);
  return out.toDataURL("image/jpeg", 0.82);
}

export async function startCamera(video) {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false });
  video.srcObject = stream;
  video.setAttribute("playsinline", "");
  await video.play();
  return stream;
}
export function stopCamera(stream) { stream?.getTracks().forEach((t) => t.stop()); }
export function frameToCanvas(video, maxSide = 720) {
  const k = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
  const cv = document.createElement("canvas");
  cv.width = Math.round(video.videoWidth * k); cv.height = Math.round(video.videoHeight * k);
  cv.getContext("2d").drawImage(video, 0, 0, cv.width, cv.height);
  return cv;
}
