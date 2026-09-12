// ---- Cultr: Build an outfit ----
// Search across every wardrobe by wardrobe / category / style, drag a
// piece onto the mannequin, drag it around once it's there, then save
// the whole arrangement to Looks. Each saved placement stores the
// item's image directly (not just its id) so a Look stays intact even
// if the original wardrobe item is later edited or removed.

import { loadWardrobes, loadItems, loadLooks, saveLooks, allCategories, STYLES } from "./wardrobe-data.js";

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

  // ---- mannequin stage: drop new items, drag placed items around ----
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

    const record = { image, xPercent, yPercent, widthPercent: w, el };
    makeDraggable(el, record);

    stage.appendChild(el);
    placedItems.push(record);
    updateHintVisibility();
  }

  function makeDraggable(el, record) {
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    el.addEventListener("pointerdown", (e) => {
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
