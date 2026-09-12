// ---- Cultr: Wardrobe detail page ----
// Shows one wardrobe's items grouped into rows by category, and lets you
// add a new item (photo + category + which wardrobe it belongs to).
//
// Storage (localStorage, same no-backend-yet approach as wardrobe.js):
//   cultr:wardrobes       -> [{ id, name }, ...]            (written by wardrobe.js)
//   cultr:wardrobe-items  -> [{ id, wardrobeId, category, image, createdAt }, ...]
//
// Swapping this for Firestore later is a matter of replacing the load/
// save helpers below with getDocs/addDoc/onSnapshot, the same shape
// journal.js and clothes.js already use for their collections.

import { mountCutoutPanel } from "./cutout.js";

const WARDROBES_KEY = "cultr:wardrobes";
const ITEMS_KEY = "cultr:wardrobe-items";

const CATEGORIES = ["Tops", "Bottoms", "Jeans", "Accessories"];

// ---- storage helpers ----
function loadWardrobes() {
  try {
    const raw = localStorage.getItem(WARDROBES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function loadItems() {
  try {
    const raw = localStorage.getItem(ITEMS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveItems(items) {
  localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
}

// ---- image resize (same trick journal.js uses: shrink + re-encode via
// canvas before it ever touches storage, so items don't bloat localStorage) ----
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

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function init() {
  const wardrobeId = getQueryParam("id") || "";
  const wardrobes = loadWardrobes();
  const currentWardrobe = wardrobes.find((w) => w.id === wardrobeId);
  const wardrobeName = currentWardrobe ? currentWardrobe.name : getQueryParam("name") || "Wardrobe";

  document.title = wardrobeName + " — Cultr";
  document.getElementById("wardrobeTitle").textContent = wardrobeName;

  const itemRowsMount = document.getElementById("itemRows");
  const addItemBtn = document.getElementById("addItemBtn");
  const overlay = document.getElementById("addItemOverlay");
  const closeBtn = document.getElementById("addItemClose");
  const form = document.getElementById("addItemForm");
  const photoInput = document.getElementById("itemPhotoInput");
  const photoDropText = document.getElementById("photoDropText");
  const cutoutMount = document.getElementById("cutoutMount");
  const categorySelect = document.getElementById("itemCategorySelect");
  const wardrobeSelect = document.getElementById("itemWardrobeSelect");
  const errorEl = document.getElementById("addItemError");

  let items = loadItems();
  let selectedPhotoData = null;
  let cutoutPanel = null;

  const rowEls = {};

  // ---- build the four category rows ----
  CATEGORIES.forEach((category) => {
    const section = document.createElement("div");
    section.className = "item-row-section";

    const title = document.createElement("div");
    title.className = "item-row-title";
    title.textContent = category;
    section.appendChild(title);

    const row = document.createElement("div");
    row.className = "item-row";
    section.appendChild(row);

    itemRowsMount.appendChild(section);
    rowEls[category] = row;
  });

  function renderRow(category) {
    const row = rowEls[category];
    row.innerHTML = "";
    const inCategory = items.filter((it) => it.wardrobeId === wardrobeId && it.category === category);

    if (inCategory.length === 0) {
      const empty = document.createElement("p");
      empty.className = "item-row-empty";
      empty.textContent = "Nothing added yet.";
      row.appendChild(empty);
      return;
    }

    inCategory.forEach((it) => {
      const box = document.createElement("div");
      box.className = "item-box";
      const img = document.createElement("img");
      img.src = it.image;
      img.alt = category;
      img.loading = "lazy";
      box.appendChild(img);
      row.appendChild(box);
    });
  }

  function renderAllRows() {
    CATEGORIES.forEach(renderRow);
  }
  renderAllRows();

  // ---- wardrobe <select> in the modal ----
  function populateWardrobeSelect() {
    wardrobeSelect.innerHTML = "";
    wardrobes.forEach((w) => {
      const option = document.createElement("option");
      option.value = w.id;
      option.textContent = w.name;
      if (w.id === wardrobeId) option.selected = true;
      wardrobeSelect.appendChild(option);
    });
  }
  populateWardrobeSelect();

  // ---- modal open/close ----
  function resetForm() {
    form.reset();
    selectedPhotoData = null;
    if (cutoutPanel) {
      cutoutPanel.destroy();
      cutoutPanel = null;
    }
    photoDropText.style.display = "block";
    errorEl.style.display = "none";
    populateWardrobeSelect();
  }

  function openModal() {
    resetForm();
    overlay.classList.add("is-open");
  }
  function closeModal() {
    overlay.classList.remove("is-open");
  }

  addItemBtn.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
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

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.style.display = "none";

    if (!selectedPhotoData) {
      errorEl.textContent = "Add a photo first.";
      errorEl.style.display = "block";
      return;
    }
    const targetWardrobeId = wardrobeSelect.value;
    if (!targetWardrobeId) {
      errorEl.textContent = "Choose a wardrobe to add this to.";
      errorEl.style.display = "block";
      return;
    }
    const category = categorySelect.value;
    const finalImage = cutoutPanel ? cutoutPanel.getResult() : selectedPhotoData;

    const newItem = {
      id: "item-" + Date.now(),
      wardrobeId: targetWardrobeId,
      category,
      image: finalImage,
      createdAt: Date.now()
    };
    items.push(newItem);
    saveItems(items);

    if (targetWardrobeId === wardrobeId) {
      renderRow(category);
    }

    closeModal();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
