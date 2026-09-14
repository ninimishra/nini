// ---- Cultr: Build an outfit ----
// Search across every wardrobe by wardrobe / category / style, drag a
// piece onto the mannequin, drag it around (or resize it via the corner
// handle) once it's there, then save the whole arrangement to Looks.
// Each saved placement stores the item's image directly (not just its
// id) so a Look stays intact even if the original wardrobe item is later
// edited or removed.

import {
  loadWardrobes,
  loadItems,
  loadLooks,
  saveLooks,
  allCategories,
  STYLES,
  onAuthChange,
  ensureUserData
} from "./wardrobe-data.js";
import { mountAcidSquares } from "./acid-squares.js";

const MIN_WIDTH_PERCENT = 12;
const MAX_WIDTH_PERCENT = 90;

function init() {
  const wardrobes = loadWardrobes();
  const items = loadItems();

  const filterWardrobe = document.getElementById("filterWardrobe");
  const filterCategory = document.getElementById("filterCategory");
  const filterStyle = document.getElementById("filterStyle");
  const searchGrid = document.getElementById("searchGrid");
  const stage = document.getElementById("mannequinStage");
  const dropHint = document.getElementById("dropHint");
  const saveBtn = document.getElementById("saveLookBtn");
  const clearBtn = document.getElementById("clearStageBtn");
  const saveStatus = document.getElementById("saveStatus");
  const acidMount = document.getElementById("acidBgMount");

  // ---- soft animated backdrop behind the mannequin ----
  mountAcidSquares(acidMount, {
    color1: "#5b21b6",
    color2: "#ec4899",
    color3: "#06b6d4",
    detail: "medium",
    speed: 0.7,
    waveDepth: 1,
    zoom: 1.3,
    density: 10.0,
    glow: 0.48,
    exposure: 2250,
    spread: 0.3,
    stepSize: 0.002,
    colorShift: 0,
    contrast: 1,
    brightness: 1.0,
    opacity: 1.0,
    mouseInteraction: true,
    mouseStrength: 0.1,
    mouseRadius: 0.35,
    blur: 0,
    grain: true,
    grainIntensity: 0.025,
    lightMode: true
  });

  // ---- filters ----
  wardrobes.forEach((w) => {
    const opt = document.createElement("option");
    opt.value = w.id;
    opt.textContent = w.name;
    filterWardrobe.appendChild(opt);
  });
  allCategories(wardrobes).forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    filterCategory.appendChild(opt);
  });
  STYLES.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    filterStyle.appendChild(opt);
  });

  function renderSearchGrid() {
    const wardrobeId = filterWardrobe.value;
    const category = filterCategory.value;
    const style = filterStyle.value;

    const filtered = items.filter((it) => {
      if (wardrobeId && it.wardrobeId !== wardrobeId) return false;
      if (category && it.category !== category) return false;
      if (style && !(it.style || []).includes(style)) return false;
      return true;
    });

    searchGrid.innerHTML = "";
    if (filtered.length === 0) {
      const empty = document.createElement("p");
      empty.className = "builder-search-empty";
      empty.textContent = "No items match. Try different filters, or add some items first.";
      searchGrid.appendChild(empty);
      return;
    }

    filtered.forEach((it) => {
      const cell = document.createElement("div");
      cell.className = "builder-search-item";
      cell.draggable = true;
      const img = document.createElement("img");
      img.src = it.image;
      img.alt = it.category;
      cell.appendChild(img);

      cell.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", it.image);
        e.dataTransfer.effectAllowed = "copy";
      });

      searchGrid.appendChild(cell);
    });
  }

  [filterWardrobe, filterCategory, filterStyle].forEach((el) => el.addEventListener("change", renderSearchGrid));
  renderSearchGrid();

  // ---- mannequin stage: drop new items, drag placed items around, resize them ----
  let placedItems = []; // { image, xPercent, yPercent, widthPercent, el }

  function updateHintVisibility() {
    dropHint.style.display = placedItems.length === 0 ? "flex" : "none";
  }

  function placeItem(image, xPercent, yPercent, widthPercent) {
    const el = document.createElement("div");
    el.className = "placed-item";
    const w = widthPercent || 40;
    el.style.width = w + "%";
    el.style.left = xPercent + "%";
    el.style.top = yPercent + "%";

    const img = document.createElement("img");
    img.src = image;
    el.appendChild(img);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "placed-item-remove";
    removeBtn.innerHTML = "&times;";
    removeBtn.setAttribute("aria-label", "Remove from outfit");
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      placedItems = placedItems.filter((p) => p.el !== el);
      el.remove();
      updateHintVisibility();
    });
    el.appendChild(removeBtn);

    const resizeHandle = document.createElement("div");
    resizeHandle.className = "placed-item-resize";
    resizeHandle.setAttribute("aria-label", "Resize");
    el.appendChild(resizeHandle);

    const record = { image, xPercent, yPercent, widthPercent: w, el };
    makeDraggable(el, record);
    makeResizable(resizeHandle, el, record);

    stage.appendChild(el);
    placedItems.push(record);
    updateHintVisibility();
  }

  function makeDraggable(el, record) {
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    el.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".placed-item-resize") || e.target.closest(".placed-item-remove")) return;
      dragging = true;
      el.classList.add("is-dragging");
      el.setPointerCapture(e.pointerId);
      const rect = el.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
    });

    el.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const stageRect = stage.getBoundingClientRect();
      let x = e.clientX - stageRect.left - offsetX;
      let y = e.clientY - stageRect.top - offsetY;
      x = Math.max(0, Math.min(x, stageRect.width - el.offsetWidth));
      y = Math.max(0, Math.min(y, stageRect.height - el.offsetHeight));
      record.xPercent = (x / stageRect.width) * 100;
      record.yPercent = (y / stageRect.height) * 100;
      el.style.left = record.xPercent + "%";
      el.style.top = record.yPercent + "%";
    });

    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      el.classList.remove("is-dragging");
      try {
        el.releasePointerCapture(e.pointerId);
      } catch (err) {
        // ignore
      }
    }
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
  }

  // Drag the bottom-right handle to make a placed item bigger or smaller,
  // so it can actually be scaled to fit the mannequin.
  function makeResizable(handle, el, record) {
    let resizing = false;
    let startX = 0;
    let startWidthPx = 0;

    handle.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      resizing = true;
      handle.setPointerCapture(e.pointerId);
      startX = e.clientX;
      startWidthPx = el.getBoundingClientRect().width;
    });

    handle.addEventListener("pointermove", (e) => {
      if (!resizing) return;
      const stageRect = stage.getBoundingClientRect();
      const deltaPx = e.clientX - startX;
      const newWidthPx = Math.max(20, startWidthPx + deltaPx);
      let widthPercent = (newWidthPx / stageRect.width) * 100;
      widthPercent = Math.max(MIN_WIDTH_PERCENT, Math.min(MAX_WIDTH_PERCENT, widthPercent));
      record.widthPercent = widthPercent;
      el.style.width = widthPercent + "%";
    });

    function endResize(e) {
      if (!resizing) return;
      resizing = false;
      try {
        handle.releasePointerCapture(e.pointerId);
      } catch (err) {
        // ignore
      }
    }
    handle.addEventListener("pointerup", endResize);
    handle.addEventListener("pointercancel", endResize);
  }

  stage.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });
  stage.addEventListener("drop", (e) => {
    e.preventDefault();
    const image = e.dataTransfer.getData("text/plain");
    if (!image) return;
    const rect = stage.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100 - 15;
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100 - 15;
    placeItem(image, Math.max(0, xPercent), Math.max(0, yPercent));
  });

  updateHintVisibility();

  clearBtn.addEventListener("click", () => {
    if (placedItems.length === 0) return;
    if (!window.confirm("Clear everything off the mannequin?")) return;
    placedItems.forEach((p) => p.el.remove());
    placedItems = [];
    updateHintVisibility();
    saveStatus.innerHTML = "";
  });

  saveBtn.addEventListener("click", () => {
    if (placedItems.length === 0) {
      saveStatus.textContent = "Add at least one item to the mannequin first.";
      return;
    }
    const name = window.prompt("Name this look:", "My look");
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    const looks = loadLooks();
    looks.push({
      id: "look-" + Date.now(),
      name: trimmed,
      placements: placedItems.map((p) => ({
        image: p.image,
        x: p.xPercent,
        y: p.yPercent,
        width: p.widthPercent
      })),
      createdAt: Date.now()
    });
    saveLooks(looks);

    saveStatus.innerHTML = 'Saved "' + trimmed + '" — <a href="looks.html">view it in Looks</a>.';
  });
}

// ---- auth gate: this page requires login, and loads that account's data ----
function boot() {
  const gate = document.getElementById("authGate");
  const main = document.querySelector("main");
  const loginBtn = document.getElementById("authGateLoginBtn");
  let started = false;

  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      if (window.requireCultrAuth) window.requireCultrAuth(() => {});
    });
  }

  onAuthChange(async (user) => {
    if (!user) {
      started = false;
      if (gate) gate.style.display = "flex";
      if (main) main.style.display = "none";
      return;
    }
    await ensureUserData();
    if (gate) gate.style.display = "none";
    if (main) main.style.display = "";
    if (!started) {
      started = true;
      init();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
