// ---- Cultr: item photo cutout ----
// Handles turning a raw uploaded photo into a "just the item" cutout, two
// ways, both running entirely in the browser (no API key, no server):
//
//   1. Auto — @imgly/background-removal runs a small segmentation model
//      client-side (WebAssembly/ONNX) to lift the item out automatically.
//      First use on a device downloads the model (a few MB, then cached).
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

let removeBackgroundPromise = null;
function loadRemoveBackground() {
  // Imported lazily (only once someone actually uploads a photo) since it
  // pulls in onnxruntime-web, which is a non-trivial chunk of JS.
  if (!removeBackgroundPromise) {
    removeBackgroundPromise = import("https://esm.sh/@imgly/background-removal@1.7.0").then(
      (mod) => mod.default
    );
  }
  return removeBackgroundPromise;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
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
    status.textContent = "Automatic cutout wasn't available on this device.";
    actions.innerHTML = "";
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
    status.textContent = "Removing background… (first time may take a few seconds while the model downloads)";
    actions.innerHTML = "";
    actions.appendChild(button("Use full photo instead", useOriginal, "quiet"));

    try {
      const removeBackground = await loadRemoveBackground();
      const blob = await removeBackground(photoDataUrl, {
        model: "isnet_quint8",
        output: { format: "image/png", quality: 0.8, type: "foreground" }
      });
      if (destroyed) return;
      const dataUrl = await blobToDataUrl(blob);
      if (destroyed) return;
      renderAutoReadyState(dataUrl);
    } catch (err) {
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
