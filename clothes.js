// ---- Cultr: Clothes browser (brand row + category panel) ----
// Browses the same "products" collection as the "This week's finds" grid
// on journal.html (find-1..find-50, edited directly in the Firebase
// console), filtered by category. The brand row across the top is
// placeholder artwork for now (fake names, plain squares) — swap BRANDS
// below for real names any time, or wire it up to its own Firestore
// "brands" collection later the same way the category panel is wired up
// here.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  getFirestore,
  collection,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDk2Fg3iuYJ-j4a07n2jS1UeUy1FjfaVgk",
  authDomain: "nini-c040c.firebaseapp.com",
  projectId: "nini-c040c",
  storageBucket: "nini-c040c.firebasestorage.app",
  messagingSenderId: "496460943549",
  appId: "1:496460943549:web:67d169ef2395e6b3f0a7d4",
  measurementId: "G-LH3L0P142P"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Fake placeholder brand names for now — purely visual, not wired to
// anything. Rename these, or turn them into links, whenever you're ready.
const BRANDS = ['Ardent & Rue', 'Marlowe', 'Fen', 'Casa Noir', 'Birch Studio', 'Nocturne'];
const CATEGORIES = ['Accessories', 'Bottoms', 'Tops', 'Dresses', 'Shoes'];

const brandRow = document.getElementById('brandRow');
const categoryPanel = document.getElementById('categoryPanel');
const clothesGrid = document.getElementById('clothesGrid');

let activeCategory = 'All';
let allProducts = [];

// ---- Brand row (static placeholders) ----
BRANDS.forEach(function (name) {
  const btn = document.createElement('div');
  btn.className = 'brand-btn';
  btn.textContent = name;
  brandRow.appendChild(btn);
});

// ---- Category panel (real filter) ----
function renderCategoryPanel() {
  categoryPanel.innerHTML = '';
  ['All'].concat(CATEGORIES).forEach(function (cat) {
    const btn = document.createElement('button');
    btn.className = 'cat-btn' + (cat === activeCategory ? ' is-active' : '');
    btn.textContent = cat;
    btn.addEventListener('click', function () {
      activeCategory = cat;
      renderCategoryPanel();
      renderGrid();
    });
    categoryPanel.appendChild(btn);
  });
}

function renderProductCard(id, product) {
  const card = document.createElement('a');
  card.className = 'product-card';
  card.href = 'product.html?id=' + id;
  card.innerHTML =
    '<img src="' + product.photo + '" alt="' + (product.name || '') + '">' +
    '<div class="product-card-info">' +
      '<div class="product-card-brand">' + (product.brand || '') + '</div>' +
      '<div class="product-card-name">' + (product.name || '') + '</div>' +
    '</div>';
  return card;
}

function renderGrid() {
  clothesGrid.innerHTML = '';
  // Only show slots that actually have a photo — the weekly-finds page
  // keeps 50 fixed document slots, many of which may still be empty.
  const withPhoto = allProducts.filter(function (p) { return p.data.photo; });
  const filtered = activeCategory === 'All'
    ? withPhoto
    : withPhoto.filter(function (p) { return p.data.category === activeCategory; });

  if (filtered.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = activeCategory === 'All'
      ? 'Nothing in the catalogue yet.'
      : 'Nothing in "' + activeCategory + '" yet.';
    clothesGrid.appendChild(empty);
    return;
  }
  filtered.forEach(function (p) {
    clothesGrid.appendChild(renderProductCard(p.id, p.data));
  });
}

renderCategoryPanel();

onSnapshot(collection(db, 'products'), function (snapshot) {
  allProducts = [];
  snapshot.forEach(function (docSnap) {
    allProducts.push({ id: docSnap.id, data: docSnap.data() });
  });
  allProducts.sort(function (a, b) {
    const at = a.data.createdAt ? a.data.createdAt.toMillis() : 0;
    const bt = b.data.createdAt ? b.data.createdAt.toMillis() : 0;
    return bt - at;
  });
  renderGrid();
});
