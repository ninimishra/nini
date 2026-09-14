// ---- Cultr: Looks gallery ----
// Renders every saved look as a small, non-interactive replay of the
// mannequin with its saved placements — each look stores its item images
// directly (see outfit-builder.js), so this page doesn't need to touch
// the wardrobe/items data at all.

import { loadLooks, saveLooks, onAuthChange, ensureUserData } from "./wardrobe-data.js";

function init() {
  const grid = document.getElementById("looksGrid");
  let looks = loadLooks();

  function render() {
    grid.innerHTML = "";
    if (looks.length === 0) {
      const empty = document.createElement("p");
      empty.className = "looks-empty";
      empty.textContent = "No looks saved yet — build one on the outfit builder page.";
      grid.appendChild(empty);
      return;
    }

    looks.forEach((look) => {
      const card = document.createElement("div");
      card.className = "look-card";

      const stage = document.createElement("div");
      stage.className = "look-stage";
      const base = document.createElement("img");
      base.className = "mannequin-base";
      base.src = "mannequin.png";
      base.alt = "Mannequin";
      stage.appendChild(base);

      (look.placements || []).forEach((p) => {
        const el = document.createElement("div");
        el.className = "placed-item";
        el.style.left = p.x + "%";
        el.style.top = p.y + "%";
        el.style.width = (p.width || 40) + "%";
        const img = document.createElement("img");
        img.src = p.image;
        el.appendChild(img);
        stage.appendChild(el);
      });

      card.appendChild(stage);

      const nameRow = document.createElement("div");
      nameRow.className = "look-name-row";
      const name = document.createElement("span");
      name.className = "look-name";
      name.textContent = look.name;
      nameRow.appendChild(name);

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "look-delete";
      deleteBtn.innerHTML = "&times;";
      deleteBtn.setAttribute("aria-label", 'Delete "' + look.name + '"');
      deleteBtn.addEventListener("click", () => {
        if (!window.confirm('Delete "' + look.name + '"?')) return;
        looks = looks.filter((l) => l.id !== look.id);
        saveLooks(looks);
        render();
      });
      nameRow.appendChild(deleteBtn);

      card.appendChild(nameRow);
      grid.appendChild(card);
    });
  }

  render();
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
