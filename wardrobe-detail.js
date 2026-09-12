// ---- Cultr: Wardrobe detail page ----
// Shows one wardrobe's items grouped into rows by section (Tops,
// Bottoms, Jeans, Accessories by default — but sections are per-wardrobe
// and editable here: add a new one, rename one, or delete an empty one).
// Adding items goes through the shared Add Item modal in add-item.js.
//
// Storage lives in wardrobe-data.js.

import { mountAddItemModal } from "./add-item.js";
import {
  loadWardrobes,
  saveWardrobes,
  loadItems,
  saveItems,
  renameCategoryOnItems,
  DEFAULT_CATEGORIES
} from "./wardrobe-data.js";

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
  const addSectionBtn = document.getElementById("addSectionBtn");

  let items = loadItems();
  const rowEls = {};

  function currentCategories() {
    if (!currentWardrobe) return DEFAULT_CATEGORIES.slice();
    if (!Array.isArray(currentWardrobe.categories) || currentWardrobe.categories.length === 0) {
      currentWardrobe.categories = DEFAULT_CATEGORIES.slice();
    }
    return currentWardrobe.categories;
  }

  function persistWardrobes() {
    saveWardrobes(wardrobes);
  }

  function deleteItem(itemId) {
    items = items.filter((it) => it.id !== itemId);
    saveItems(items);
    renderAllRows();
  }

  function buildRow(category) {
    const section = document.createElement("div");
    section.className = "item-row-section";

    const titleRow = document.createElement("div");
    titleRow.className = "item-row-title-bar";

    const title = document.createElement("span");
    title.className = "item-row-title";
    title.textContent = category;
    title.title = "Double-click to rename";
    title.addEventListener("dblclick", () => startRename(category, title, section));
    titleRow.appendChild(title);

    const removeSectionBtn = document.createElement("button");
    removeSectionBtn.type = "button";
    removeSectionBtn.className = "item-row-remove";
    removeSectionBtn.innerHTML = "&times;";
    removeSectionBtn.setAttribute("aria-label", 'Remove "' + category + '" section');
    removeSectionBtn.addEventListener("click", () => removeSection(category, section));
    titleRow.appendChild(removeSectionBtn);

    section.appendChild(titleRow);

    const row = document.createElement("div");
    row.className = "item-row";
    section.appendChild(row);

    rowEls[category] = row;
    itemRowsMount.insertBefore(section, addSectionBtn);
    return section;
  }

  function startRename(oldName, titleEl, section) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "item-row-title-input";
    input.value = oldName;
    titleEl.replaceWith(input);
    input.focus();
    input.select();

    function commit() {
      const newName = input.value.trim();
      if (!newName || newName === oldName) {
        input.replaceWith(titleEl);
        return;
      }
      const cats = currentCategories();
      const idx = cats.indexOf(oldName);
      if (idx !== -1) cats[idx] = newName;
      persistWardrobes();
      renameCategoryOnItems(wardrobeId, oldName, newName);
      items = loadItems();

      rowEls[newName] = rowEls[oldName];
      delete rowEls[oldName];
      titleEl.textContent = newName;
      titleEl.title = "Double-click to rename";
      input.replaceWith(titleEl);
      renderRow(newName);
    }

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") input.blur();
      if (e.key === "Escape") {
        input.value = oldName;
        input.blur();
      }
    });
  }

  function removeSection(category, section) {
    const hasItems = items.some((it) => it.wardrobeId === wardrobeId && it.category === category);
    if (hasItems) {
      window.alert('Move or remove everything in "' + category + '" before deleting the section.');
      return;
    }
    if (!window.confirm('Remove the "' + category + '" section?')) return;
    const cats = currentCategories();
    const idx = cats.indexOf(category);
    if (idx !== -1) cats.splice(idx, 1);
    persistWardrobes();
    delete rowEls[category];
    section.remove();
  }

  function renderRow(category) {
    const row = rowEls[category];
    if (!row) return;
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
      const tags = [it.color, ...(it.style || [])].filter(Boolean);
      if (tags.length) img.title = tags.join(" · ");
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
    // Rebuild from scratch so sections added/renamed/removed elsewhere
    // (or items whose section no longer exists) stay in sync.
    itemRowsMount.querySelectorAll(".item-row-section").forEach((el) => el.remove());
    Object.keys(rowEls).forEach((k) => delete rowEls[k]);
    currentCategories().forEach((category) => {
      buildRow(category);
      renderRow(category);
    });
  }
  renderAllRows();

  addSectionBtn.addEventListener("click", () => {
    const name = window.prompt("Name this section (e.g. Scarves, Bags, Shoes):");
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const cats = currentCategories();
    if (cats.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      window.alert('A section called "' + trimmed + '" already exists.');
      return;
    }
    cats.push(trimmed);
    persistWardrobes();
    buildRow(trimmed);
    renderRow(trimmed);
  });

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
