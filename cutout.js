// ---- Cultr: item photo cutout ----
// Handles turning a raw uploaded photo into a "just the item" cutout, two
// ways, both running entirely in the browser (no API key, no server):
//
//   1. Auto — Transformers.js runs a segmentation model (briaai/RMBG-1.4)
//      client-side to lift the item out automatically. First use on a
//      device downloads the model (tens of MB, then cached by the browser).
//
//      NOTE on licensing: RMBG-1.4 is released by BRIA AI for
//      non-commercial use — fine for a personal project, but if Cultr
//      ever becomes a paid/commercial product this model would need
//      swapping for one with a permissive license (e.g. "Xenova/modnet"),
//      or a paid BRIA license. Swap the MODEL_ID constant below.
//
//      (This replaces an earlier attempt using @imgly/background-removal,
//      which pins an exact onnxruntime-web peer-dependency version —
//      likely why it silently failed when loaded via esm.sh, which
//      doesn't reliably resolve peer deps the way a bundler would.
//      Transformers.js bundles its ONNX runtime as a normal dependency,
//      sidestepping that whole class of failure.)
//
//   2. Freehand — a canvas lasso the user drags around the item by hand,
//      for when auto guesses wrong or they want more control. Works from
//      mouse or touch (pointer events).
//
// Usage:
//   import { mountCutoutPanel } from './cutout.js';
//   const panel = mountCutoutPanel(document.getElementById('cutoutMount'), {
//     photoDataUrl: someDataUrl
//   });
//   // panel.getResult() -> current best data URL (auto cutout, freehand
//   // cutout, or the original photo, whichever the user landed on).
//   // panel.destroy() to tear down when the modal closes / resets.

const MODEL_ID = "briaai/RMBG-1.4";

let segmenterPromise = null;
function loadSegmenter() {
  // Imported lazily (only once someone actually uploads a photo) since it
  // pulls in a real ML runtime, a non-trivial chunk of JS + model weights.
  if (!segmenterPromise) {
    segmenterPromise = import("https://esm.sh/@huggingface/transformers@4.2.0")
      .then(({ pipeline }) => pipeline("image-segmentation", MODEL_ID))
      .catch((err) => {
        // Don't cache a failed load — let a later retry try again
        // (e.g. if the first attempt failed only because of a flaky
        // network request for the model).
        segmenterPromise = null;
        throw err;
      });
  }
  return segmenterPromise;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Runs the segmentation model on the photo and composites its mask back
// onto the full-resolution original as an alpha channel, returning a
// transparent-background PNG data URL.
async function runAutoRemoval(photoDataUrl) {
  const segmenter = await loadSegmenter();
  const results = await segmenter(photoDataUrl);
  const segment = Array.isArray(results) ? results[0] : results;
  const mask = segment && segment.mask;
  if (!mask || !mask.data || !mask.width || !mask.height) {
    throw new Error("Cutout: segmentation model returned an unexpected result shape");
  }

  const img = await loadImage(photoDataUrl);
  const width = img.naturalWidth;
  const height = img.naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);

  // Render the (usually lower-resolution) mask onto its own canvas, then
  // scale it up to match the photo, so alpha values line up per-pixel
  // regardless of what resolution the model actually worked at.
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = mask.width;
  maskCanvas.height = mask.height;
  const maskCtx = maskCanvas.getContext("2d");
  const maskImageData = maskCtx.createImageData(mask.width, mask.height);

  // Values may come through as bytes (0-255) or floats (0-1) depending on
  // library version — detect which and normalize instead of assuming.
  let maxVal = 0;
  for (let i = 0; i < mask.data.length; i++) {
    if (mask.data[i] > maxVal) maxVal = mask.data[i];
  }
  const normalize = maxVal > 1.5 ? (v) => v : (v) => v * 255;

  for (let i = 0; i < mask.width * mask.height; i++) {
    const v = normalize(mask.data[i]);
    maskImageData.data[i * 4 + 0] = v;
    maskImageData.data[i * 4 + 1] = v;
    maskImageData.data[i * 4 + 2] = v;
    maskImageData.data[i * 4 + 3] = 255;
  }
  maskCtx.putImageData(maskImageData, 0, 0);

  const scaledMaskCanvas = document.createElement("canvas");
  scaledMaskCanvas.width = width;
  scaledMaskCanvas.height = height;
  const scaledMaskCtx = scaledMaskCanvas.getContext("2d");
  scaledMaskCtx.drawImage(maskCanvas, 0, 0, width, height);
  const scaledMask = scaledMaskCtx.getImageData(0, 0, width, height).data;

  // The mask represents "how background is this pixel" (per the model's
  // "background" segment) — invert it so the subject stays opaque and
  // the background becomes transparent.
  for (let i = 0; i < width * height; i++) {
    imageData.data[i * 4 + 3] = 255 - scaledMask[i * 4];
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

// ---- freehand lasso, drawn on a canvas over the source image ----
function buildFreehandTool(image) {
  const wrap = document.createElement("div");
  wrap.className = "cutout-canvas-wrap";

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.className = "cutout-canvas";
  wrap.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  let points = [];
  let drawing = false;

  function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    if (points.length > 1) {
      ctx.save();
      ctx.strokeStyle = "#B08A4E";
      ctx.lineWidth = Math.max(2, canvas.width / 220);
      ctx.setLineDash([Math.max(6, canvas.width / 60), Math.max(4, canvas.width / 90)]);
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      if (!drawing) ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }
  redraw();

  function toCanvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  function onDown(e) {
    canvas.setPointerCapture(e.pointerId);
    points = [toCanvasPoint(e)];
    drawing = true;
    redraw();
  }
  function onMove(e) {
    if (!drawing) return;
    points.push(toCanvasPoint(e));
    redraw();
  }
  function onUp() {
    drawing = false;
    redraw();
  }

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);

  function clear() {
    points = [];
    drawing = false;
    redraw();
  }

  // Clips the source image to the traced path and returns a transparent-
  // background PNG data URL — this is the actual "cutout" step.
  function apply() {
    if (points.length < 3) return null;
    const out = document.createElement("canvas");
    out.width = canvas.width;
    out.height = canvas.height;
    const octx = out.getContext("2d");
    octx.save();
    octx.beginPath();
    octx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) octx.lineTo(points[i].x, points[i].y);
    octx.closePath();
    octx.clip();
    octx.drawImage(image, 0, 0, out.width, out.height);
    octx.restore();
    return out.toDataURL("image/png");
  }

  return {
    el: wrap,
    clear,
    apply,
    destroy() {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    }
  };
}

export function mountCutoutPanel(mount, opts = {}) {
  const { photoDataUrl } = opts;
  if (!mount || !photoDataUrl) return { getResult: () => photoDataUrl, destroy() {} };

  let currentResult = photoDataUrl;
  let freehandTool = null;
  let destroyed = false;

  mount.innerHTML = "";
  mount.className = "cutout-panel";

  const stage = document.createElement("div");
  stage.className = "cutout-stage";
  const status = document.createElement("div");
  status.className = "cutout-status";
  const actions = document.createElement("div");
  actions.className = "cutout-actions";

  mount.appendChild(stage);
  mount.appendChild(status);
  mount.appendChild(actions);

  function showPreview(src) {
    stage.innerHTML = "";
    const img = document.createElement("img");
    img.className = "cutout-preview-img";
    img.src = src;
    stage.appendChild(img);
  }

  function button(label, onClick, variant) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cutout-btn" + (variant ? " cutout-btn--" + variant : "");
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }

  function renderAutoReadyState(autoDataUrl) {
    currentResult = autoDataUrl;
    showPreview(autoDataUrl);
    status.textContent = "Background removed automatically. Doesn't look right?";
    actions.innerHTML = "";
    actions.appendChild(button("Touch up manually", enterFreehand));
    actions.appendChild(button("Use full photo instead", useOriginal, "quiet"));
  }

  function renderAutoFailedState() {
    currentResult = photoDataUrl;
    showPreview(photoDataUrl);
    status.textContent = "Automatic cutout couldn't run just now — see the browser console for details.";
    actions.innerHTML = "";
    actions.appendChild(button("Try again", runAuto, "quiet"));
    actions.appendChild(button("Cut out manually", enterFreehand));
    actions.appendChild(button("Use full photo", useOriginal, "quiet"));
  }

  function useOriginal() {
    currentResult = photoDataUrl;
    showPreview(photoDataUrl);
    status.textContent = "Using the full photo.";
    actions.innerHTML = "";
    actions.appendChild(button("Cut out manually", enterFreehand));
    actions.appendChild(button("Try automatic cutout again", runAuto, "quiet"));
  }

  async function enterFreehand() {
    if (freehandTool) freehandTool.destroy();
    const img = await loadImage(currentResult || photoDataUrl);
    freehandTool = buildFreehandTool(img);
    stage.innerHTML = "";
    stage.appendChild(freehandTool.el);
    status.textContent = "Trace around the item, then hit Apply.";
    actions.innerHTML = "";
    actions.appendChild(button("Clear", () => freehandTool.clear(), "quiet"));
    actions.appendChild(
      button("Apply", () => {
        const result = freehandTool.apply();
        if (!result) {
          status.textContent = "Trace a shape first, then hit Apply.";
          return;
        }
        currentResult = result;
        freehandTool.destroy();
        freehandTool = null;
        showPreview(result);
        status.textContent = "Cutout applied.";
        actions.innerHTML = "";
        actions.appendChild(button("Touch up again", enterFreehand));
        actions.appendChild(button("Use full photo instead", useOriginal, "quiet"));
      })
    );
    actions.appendChild(
      button("Cancel", () => {
        freehandTool.destroy();
        freehandTool = null;
        showPreview(currentResult);
        status.textContent = "";
        actions.innerHTML = "";
        actions.appendChild(button("Touch up manually", enterFreehand));
        actions.appendChild(button("Use full photo instead", useOriginal, "quiet"));
      }, "quiet")
    );
  }

  async function runAuto() {
    showPreview(photoDataUrl);
    status.textContent = "Removing background… (first time on this device downloads the model, up to a minute on a slow connection)";
    actions.innerHTML = "";
    actions.appendChild(button("Use full photo instead", useOriginal, "quiet"));

    try {
      const dataUrl = await runAutoRemoval(photoDataUrl);
      if (destroyed) return;
      renderAutoReadyState(dataUrl);
    } catch (err) {
      // Logged (not just swallowed) so the actual cause — a blocked
      // network request for the model, an unsupported browser, a bad
      // esm.sh bundle, etc. — shows up in devtools instead of just a
      // generic "didn't work" message.
      console.error("Cutout: automatic background removal failed —", err);
      if (destroyed) return;
      renderAutoFailedState();
    }
  }

  runAuto();

  return {
    getResult() {
      return currentResult;
    },
    destroy() {
      destroyed = true;
      if (freehandTool) freehandTool.destroy();
      mount.innerHTML = "";
    }
  };
}
