// ---- Cultr: Wardrobe detail page ----
// Shows one wardrobe's items grouped into rows by category, and lets you
// add a new item (photo + category + which wardrobe(s) it belongs to,
// via the shared Add Item modal in add-item.js).
//
// Storage (localStorage, same no-backend-yet approach as wardrobe.js):
//   cultr:wardrobes       -> [{ id, name, coverImage }, ...]  (written by wardrobe.js)
//   cultr:wardrobe-items  -> [{ id, wardrobeId, category, image, createdAt }, ...]
//
// Swapping this for Firestore later is a matter of replacing the load/
// save helpers below with getDocs/addDoc/onSnapshot, the same shape
// journal.js and clothes.js already use for their collections.

import { mountAddItemModal } from "./add-item.js";

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
  const addItemMount = document.getElementById("addItemMount");

  let items = loadItems();
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

  function deleteItem(itemId) {
    items = items.filter((it) => it.id !== itemId);
    saveItems(items);
    renderAllRows();
  }

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

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "item-box-delete";
      deleteBtn.innerHTML = "&times;";
      deleteBtn.setAttribute("aria-label", "Remove item");
      deleteBtn.addEventListener("click", () => {
        if (window.confirm("Remove this item?")) deleteItem(it.id);
      });
      box.appendChild(deleteBtn);

      row.appendChild(box);
    });
  }

  function renderAllRows() {
    CATEGORIES.forEach(renderRow);
  }
  renderAllRows();

  // ---- Add Item modal (shared with the Wardrobe overview page) ----
  const addItemModal = mountAddItemModal(addItemMount, {
    getWardrobes: () => loadWardrobes(),
    defaultWardrobeIds: wardrobeId ? [wardrobeId] : [],
    onSaved: () => {
      items = loadItems();
      renderAllRows();
    }
  });
  addItemBtn.addEventListener("click", () => addItemModal.open());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
