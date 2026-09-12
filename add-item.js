// ---- Cultr: Add Item modal (shared) ----
// One modal, mounted from both wardrobe.html (no wardrobe preselected —
// pick one or several from the list) and wardrobe-detail.html (the
// wardrobe you're currently viewing comes pre-checked, but you can still
// add to others at the same time). Creates one item per selected
// wardrobe so "add to multiple" really does file separate copies.
//
// The category dropdown is built from whichever wardrobes are currently
// checked (union of their sections) — since sections are per-wardrobe
// (see wardrobe-data.js / wardrobe-detail.js's "Add section"), picking
// different wardrobes can change what categories are on offer.
//
// Usage:
//   import { mountAddItemModal } from './add-item.js';
//   const modal = mountAddItemModal(document.getElementById('addItemMount'), {
//     getWardrobes: () => loadWardrobes(),      // fresh list each open
//     defaultWardrobeIds: [wardrobeId],          // optional, pre-checked
//     onSaved: (createdItems) => { ... }         // one entry per wardrobe
//   });
//   modal.open();   // e.g. from a button's click handler

import { mountCutoutPanel } from "./cutout.js";
import { loadItems, saveItems, allCategories, STYLES, COLORS } from "./wardrobe-data.js";

function resizeImage(file, maxSize) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export function mountAddItemModal(mount, opts = {}) {
  const { getWardrobes = () => [], defaultWardrobeIds = [], onSaved = () => {} } = opts;

  mount.innerHTML = "";

  const overlay = document.createElement("div");
  overlay.className = "add-item-overlay";

  const modal = document.createElement("div");
  modal.className = "add-item-modal";

  modal.innerHTML = `
    <button type="button" class="add-item-close" aria-label="Close">&times;</button>
    <h3>Add an item</h3>
    <form>
      <div class="add-item-field">
        <label>Photo</label>
        <div class="photo-drop">
          <input type="file" accept="image/*" class="js-photo-input">
          <span class="photo-drop-text">Tap to choose a photo</span>
        </div>
        <div class="js-cutout-mount"></div>
      </div>

      <div class="add-item-field">
        <label>Wardrobes</label>
        <div class="multiselect js-multiselect">
          <button type="button" class="multiselect-trigger">Select wardrobes ▾</button>
          <div class="multiselect-panel js-multiselect-panel"></div>
        </div>
      </div>

      <div class="add-item-field">
        <label>Category</label>
        <select class="js-category-select"></select>
      </div>

      <div class="add-item-field">
        <label>Colour</label>
        <select class="js-color-select">
          ${COLORS.map((c) => '<option value="' + c + '">' + c + "</option>").join("")}
        </select>
      </div>

      <div class="add-item-field">
        <label>Style</label>
        <div class="tag-group js-style-group">
          ${STYLES.map(
            (s) =>
              '<label class="tag-option"><input type="checkbox" value="' +
              s +
              '"><span>' +
              s +
              "</span></label>"
          ).join("")}
        </div>
      </div>

      <p class="add-item-error js-error"></p>

      <button type="submit" class="add-item-submit">Add to wardrobe</button>
    </form>
  `;

  overlay.appendChild(modal);
  mount.appendChild(overlay);

  const closeBtn = modal.querySelector(".add-item-close");
  const form = modal.querySelector("form");
  const photoInput = modal.querySelector(".js-photo-input");
  const photoDropText = modal.querySelector(".photo-drop-text");
  const cutoutMount = modal.querySelector(".js-cutout-mount");
  const categorySelect = modal.querySelector(".js-category-select");
  const colorSelect = modal.querySelector(".js-color-select");
  const styleGroup = modal.querySelector(".js-style-group");
  const multiselect = modal.querySelector(".js-multiselect");
  const multiselectTrigger = modal.querySelector(".multiselect-trigger");
  const multiselectPanel = modal.querySelector(".js-multiselect-panel");
  const errorEl = modal.querySelector(".js-error");

  let selectedPhotoData = null;
  let cutoutPanel = null;
  let selectedWardrobeIds = [];

  function refreshMultiselectLabel() {
    if (selectedWardrobeIds.length === 0) {
      multiselectTrigger.textContent = "Select wardrobes ▾";
    } else {
      const wardrobes = getWardrobes();
      const names = wardrobes.filter((w) => selectedWardrobeIds.includes(w.id)).map((w) => w.name);
      multiselectTrigger.textContent = (names.join(", ") || selectedWardrobeIds.length + " selected") + " ▾";
    }
  }

  // Category options reflect whichever wardrobes are currently checked
  // (union of their sections). With nothing checked yet, show the union
  // across every wardrobe so the field isn't empty before you've picked one.
  function refreshCategoryOptions() {
    const wardrobes = getWardrobes();
    const relevant =
      selectedWardrobeIds.length > 0
        ? wardrobes.filter((w) => selectedWardrobeIds.includes(w.id))
        : wardrobes;
    const cats = allCategories(relevant);
    const previous = categorySelect.value;
    categorySelect.innerHTML = cats.map((c) => '<option value="' + c + '">' + c + "</option>").join("");
    if (cats.includes(previous)) categorySelect.value = previous;
  }

  function buildMultiselectPanel() {
    const wardrobes = getWardrobes();
    multiselectPanel.innerHTML = "";
    wardrobes.forEach((w) => {
      const row = document.createElement("label");
      row.className = "multiselect-option";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = w.id;
      checkbox.checked = selectedWardrobeIds.includes(w.id);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          if (!selectedWardrobeIds.includes(w.id)) selectedWardrobeIds.push(w.id);
        } else {
          selectedWardrobeIds = selectedWardrobeIds.filter((id) => id !== w.id);
        }
        refreshMultiselectLabel();
        refreshCategoryOptions();
      });
      const span = document.createElement("span");
      span.textContent = w.name;
      row.appendChild(checkbox);
      row.appendChild(span);
      multiselectPanel.appendChild(row);
    });
  }

  multiselectTrigger.addEventListener("click", () => {
    multiselect.classList.toggle("is-open");
  });
  document.addEventListener("click", (e) => {
    if (!multiselect.contains(e.target)) multiselect.classList.remove("is-open");
  });

  photoInput.addEventListener("change", () => {
    const file = photoInput.files[0];
    if (!file) return;
    resizeImage(file, 700).then((dataUrl) => {
      selectedPhotoData = dataUrl;
      photoDropText.style.display = "none";
      if (cutoutPanel) cutoutPanel.destroy();
      cutoutPanel = mountCutoutPanel(cutoutMount, { photoDataUrl: dataUrl });
    });
  });

  function resetForm() {
    form.reset();
    selectedPhotoData = null;
    if (cutoutPanel) {
      cutoutPanel.destroy();
      cutoutPanel = null;
    }
    photoDropText.style.display = "block";
    errorEl.style.display = "none";
    selectedWardrobeIds = defaultWardrobeIds.slice();
    buildMultiselectPanel();
    refreshMultiselectLabel();
    refreshCategoryOptions();
    multiselect.classList.remove("is-open");
    styleGroup.querySelectorAll("input[type=checkbox]").forEach((cb) => (cb.checked = false));
  }

  function open() {
    resetForm();
    overlay.classList.add("is-open");
  }
  function close() {
    overlay.classList.remove("is-open");
  }

  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    errorEl.style.display = "none";

    if (!selectedPhotoData) {
      errorEl.textContent = "Add a photo first.";
      errorEl.style.display = "block";
      return;
    }
    if (selectedWardrobeIds.length === 0) {
      errorEl.textContent = "Choose at least one wardrobe to add this to.";
      errorEl.style.display = "block";
      return;
    }

    const category = categorySelect.value;
    const color = colorSelect.value;
    const style = Array.from(styleGroup.querySelectorAll("input[type=checkbox]:checked")).map((cb) => cb.value);
    const finalImage = cutoutPanel ? cutoutPanel.getResult() : selectedPhotoData;

    const items = loadItems();
    const created = [];
    selectedWardrobeIds.forEach((wardrobeId) => {
      const newItem = {
        id: "item-" + Date.now() + "-" + wardrobeId,
        wardrobeId,
        category,
        color,
        style,
        image: finalImage,
        createdAt: Date.now()
      };
      items.push(newItem);
      created.push(newItem);
    });
    saveItems(items);

    close();
    onSaved(created);
  });

  return { open, close };
}
