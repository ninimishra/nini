// ---- Cultr: shared wardrobe data layer ----
// Centralizes localStorage keys, constants, and CRUD helpers used across
// every wardrobe-related page (overview, detail, the Add Item modal, the
// category browser, the outfit builder, and Looks). No backend yet — see
// the README — but keeping all of this in one file means swapping it for
// real Firestore calls later is a single-file change instead of hunting
// through six pages for duplicated logic.

export const WARDROBES_KEY = "cultr:wardrobes";
export const ITEMS_KEY = "cultr:wardrobe-items";
export const LOOKS_KEY = "cultr:looks";

// Seeded onto any wardrobe that doesn't have its own sections yet.
// Wardrobes can add/rename/remove sections from here (see wardrobe-detail.js).
export const DEFAULT_CATEGORIES = ["Tops", "Bottoms", "Jeans", "Accessories"];

export const STYLES = ["Casual", "Going out", "Work", "Formal", "Sport", "Loungewear"];

export const COLORS = [
  "Black", "White", "Grey", "Beige", "Brown", "Red", "Pink",
  "Orange", "Yellow", "Green", "Blue", "Purple", "Multicolor"
];

export const DEFAULT_WARDROBES = [
  { id: "everyday-edit", name: "Everyday Edit", categories: DEFAULT_CATEGORIES.slice() },
  { id: "workwear", name: "Workwear", categories: DEFAULT_CATEGORIES.slice() },
  { id: "date-night", name: "Date Night", categories: DEFAULT_CATEGORIES.slice() },
  { id: "off-duty", name: "Off-Duty", categories: DEFAULT_CATEGORIES.slice() }
];

export function slugify(name) {
  return (
    (name || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "item"
  );
}

// ---- wardrobes ----
export function loadWardrobes() {
  try {
    const raw = localStorage.getItem(WARDROBES_KEY);
    if (!raw) throw new Error("no data yet");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("empty");

    // Migrate wardrobes saved before per-wardrobe sections existed.
    let changed = false;
    parsed.forEach((w) => {
      if (!Array.isArray(w.categories) || w.categories.length === 0) {
        w.categories = DEFAULT_CATEGORIES.slice();
        changed = true;
      }
    });
    if (changed) saveWardrobes(parsed);
    return parsed;
  } catch (e) {
    const seed = DEFAULT_WARDROBES.map((w) => Object.assign({}, w, { categories: w.categories.slice() }));
    saveWardrobes(seed);
    return seed;
  }
}

export function saveWardrobes(list) {
  localStorage.setItem(WARDROBES_KEY, JSON.stringify(list));
}

// The union of every wardrobe's sections — used for the overview page's
// "browse by category" sidebar and for populating the Add Item category
// picker before a specific wardrobe is chosen.
export function allCategories(wardrobes) {
  const set = new Set();
  (wardrobes || []).forEach((w) => (w.categories || DEFAULT_CATEGORIES).forEach((c) => set.add(c)));
  if (set.size === 0) DEFAULT_CATEGORIES.forEach((c) => set.add(c));
  return Array.from(set);
}

// ---- items ----
export function loadItems() {
  try {
    const raw = localStorage.getItem(ITEMS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveItems(items) {
  localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
}

// Items belong to a wardrobe by id. When a wardrobe is deleted, its items
// would otherwise sit around orphaned in localStorage forever.
export function deleteItemsForWardrobe(wardrobeId) {
  const items = loadItems().filter((it) => it.wardrobeId !== wardrobeId);
  saveItems(items);
}

// When a section is renamed, items filed under the old name need to move
// with it so they don't become invisible in their own wardrobe.
export function renameCategoryOnItems(wardrobeId, oldName, newName) {
  const items = loadItems();
  let changed = false;
  items.forEach((it) => {
    if (it.wardrobeId === wardrobeId && it.category === oldName) {
      it.category = newName;
      changed = true;
    }
  });
  if (changed) saveItems(items);
}

// ---- looks ----
export function loadLooks() {
  try {
    const raw = localStorage.getItem(LOOKS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveLooks(looks) {
  localStorage.setItem(LOOKS_KEY, JSON.stringify(looks));
}
