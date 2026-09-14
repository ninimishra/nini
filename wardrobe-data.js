// ---- Cultr: shared wardrobe data layer (Firestore-backed) ----
// Every wardrobe page requires login (see the auth-gate at the bottom of
// each page's own .js file) — once logged in, this file loads that
// account's wardrobes/items/looks from Firestore into an in-memory
// cache, so edits are tied to the account rather than the device: log in
// on any browser and your wardrobes are there.
//
// To keep the six pages that use this file simple, loadX()/saveX() stay
// SYNCHRONOUS — they read/write the in-memory cache instantly, the same
// as the old localStorage version did. The only async step is
// ensureUserData(), called once right after login (see each page's
// bootstrap) to populate that cache from Firestore before any page logic
// runs. saveX() writes update the cache immediately (so the UI feels
// instant) and persist to Firestore in the background, debounced.
//
// Data shape: one document per account at wardrobeApp/{uid} with fields
// { wardrobes, items, looks } — one document rather than subcollections,
// since this is simple, cheap, and reads/writes in a single round trip.

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDk2Fg3iuYJ-j4a07n2jS1UeUy1FjfaVgk",
  authDomain: "nini-c040c.firebaseapp.com",
  projectId: "nini-c040c",
  storageBucket: "nini-c040c.firebasestorage.app",
  messagingSenderId: "496460943549",
  appId: "1:496460943549:web:67d169ef2395e6b3f0a7d4",
  measurementId: "G-LH3L0P142P"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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

function seedDefaultWardrobes() {
  return DEFAULT_WARDROBES.map((w) => Object.assign({}, w, { categories: w.categories.slice() }));
}

// ---- auth ----
// Thin wrapper so pages don't need their own Firebase imports just to
// know whether someone's logged in.
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// ---- in-memory cache, populated from Firestore after login ----
let cache = null; // { wardrobes, items, looks }
let currentUid = null;

function docRefFor(uid) {
  return doc(db, "wardrobeApp", uid);
}

// Call once right after a successful login (see each page's bootstrap),
// before running any page logic that reads wardrobes/items/looks.
export async function ensureUserData() {
  const user = auth.currentUser;
  if (!user) {
    cache = null;
    currentUid = null;
    return null;
  }
  if (cache && currentUid === user.uid) return cache; // already loaded this session

  const ref = docRefFor(user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data() || {};
    cache = {
      wardrobes: Array.isArray(data.wardrobes) && data.wardrobes.length ? data.wardrobes : seedDefaultWardrobes(),
      items: Array.isArray(data.items) ? data.items : [],
      looks: Array.isArray(data.looks) ? data.looks : [],
      mannequinShape: Array.isArray(data.mannequinShape) ? data.mannequinShape : []
    };
    // Migrate wardrobes saved before per-wardrobe sections existed.
    let needsWrite = !Array.isArray(data.wardrobes) || data.wardrobes.length === 0;
    cache.wardrobes.forEach((w) => {
      if (!Array.isArray(w.categories) || w.categories.length === 0) {
        w.categories = DEFAULT_CATEGORIES.slice();
        needsWrite = true;
      }
    });
    currentUid = user.uid;
    if (needsWrite) await setDoc(ref, cache, { merge: true });
  } else {
    cache = { wardrobes: seedDefaultWardrobes(), items: [], looks: [], mannequinShape: [] };
    currentUid = user.uid;
    await setDoc(ref, cache);
  }

  return cache;
}

let persistTimer = null;
function persist() {
  if (!currentUid || !cache) return;
  // Debounced so a quick run of edits (typing a rename, dragging an
  // outfit piece around) doesn't fire a Firestore write per change.
  clearTimeout(persistTimer);
  const uid = currentUid;
  const snapshot = cache;
  persistTimer = setTimeout(() => {
    setDoc(docRefFor(uid), snapshot, { merge: true }).catch((err) => {
      console.error("Cultr: couldn't save to your account —", err);
    });
  }, 400);
}

// ---- wardrobes ----
export function loadWardrobes() {
  return cache ? cache.wardrobes : [];
}
export function saveWardrobes(list) {
  if (!cache) return;
  cache.wardrobes = list;
  persist();
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
  return cache ? cache.items : [];
}
export function saveItems(items) {
  if (!cache) return;
  cache.items = items;
  persist();
}

// Items belong to a wardrobe by id. When a wardrobe is deleted, its
// items would otherwise sit around orphaned forever.
export function deleteItemsForWardrobe(wardrobeId) {
  saveItems(loadItems().filter((it) => it.wardrobeId !== wardrobeId));
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
  return cache ? cache.looks : [];
}
export function saveLooks(looks) {
  if (!cache) return;
  cache.looks = looks;
  persist();
}

// ---- mannequin shape ----
// A small set of control points { yPercent, delta } describing how much
// wider/narrower the figure is at each height band, from the "Edit
// figure" tool on the outfit builder page. Stored per account so it
// carries over between sessions.
export function loadMannequinShape() {
  return cache && Array.isArray(cache.mannequinShape) ? cache.mannequinShape : [];
}
export function saveMannequinShape(shape) {
  if (!cache) return;
  cache.mannequinShape = shape;
  persist();
}
