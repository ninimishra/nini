// ---- Cultr: browse-by-category page ----
// Reached from the Wardrobe overview page's sidebar. Shows every item,
// across every wardrobe, filed under one section (e.g. "Tops"), since
// sections are per-wardrobe and this is the one place to see them all
// together regardless of which wardrobe they live in.

import { loadWardrobes, loadItems, onAuthChange, ensureUserData } from "./wardrobe-data.js";

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function init() {
  const category = getQueryParam("name") || "";
  document.title = category + " — Cultr";
  document.getElementById("categoryTitle").textContent = category || "Category";

  const wardrobes = loadWardrobes();
  const wardrobesById = new Map(wardrobes.map((w) => [w.id, w]));
  const items = loadItems().filter((it) => it.category === category);

  const subtitle = document.getElementById("categorySubtitle");
  subtitle.textContent = items.length
    ? items.length + (items.length === 1 ? " item" : " items") + " across your wardrobes"
    : "Nothing filed here yet.";

  const grid = document.getElementById("categoryGrid");

  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "category-empty";
    empty.textContent = "Add an item and file it under \"" + category + "\" to see it here.";
    grid.appendChild(empty);
    return;
  }

  items.forEach((it) => {
    const wardrobe = wardrobesById.get(it.wardrobeId);
    const cell = document.createElement("div");
    cell.className = "category-item";

    const img = document.createElement("img");
    img.src = it.image;
    img.alt = category;
    img.loading = "lazy";
    const tags = [it.color, ...(it.style || [])].filter(Boolean);
    if (tags.length) img.title = tags.join(" · ");
    cell.appendChild(img);

    const link = document.createElement("a");
    link.className = "category-item-wardrobe";
    link.textContent = wardrobe ? wardrobe.name : "Unknown wardrobe";
    link.href = wardrobe
      ? "wardrobe-detail.html?id=" + encodeURIComponent(wardrobe.id) + "&name=" + encodeURIComponent(wardrobe.name)
      : "wardrobe.html";
    cell.appendChild(link);

    grid.appendChild(cell);
  });
}

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
