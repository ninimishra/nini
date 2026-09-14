// ---- Cultr: Wardrobe overview page ----
// Wires together the ported React Bits components (LineSidebar,
// TiltedCard, Stepper) plus the shared Add Item modal into the Wardrobe
// overview. Storage lives in wardrobe-data.js — see that file for the
// no-backend-yet approach and the eventual Firestore swap-in point.

import { mountLineSidebar } from "./line-sidebar.js";
import { mountTiltedCard } from "./tilted-card.js";
import { mountStepper } from "./stepper.js";
import { mountSpecularButton } from "./specular-button.js";
import { mountAddItemModal } from "./add-item.js";
import {
  loadWardrobes,
  saveWardrobes,
  deleteItemsForWardrobe,
  allCategories,
  slugify,
  onAuthChange,
  ensureUserData
} from "./wardrobe-data.js";

// ---- tiny helpers ----
function hashHue(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return hash % 360;
}

// Self-contained SVG "monogram" fallback cover, used until someone
// uploads a real photo for a wardrobe — zero network requests and no
// stock-photo licensing to think about.
function monogramImage(name) {
  const hue = hashHue(name || "W");
  const initial = (name || "W").trim().charAt(0).toUpperCase();
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="480" height="600" viewBox="0 0 480 600">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="hsl(${hue},28%,88%)" />
          <stop offset="100%" stop-color="hsl(${(hue + 35) % 360},22%,72%)" />
        </linearGradient>
      </defs>
      <rect width="480" height="600" fill="url(#g)" />
      <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
        font-family="Georgia, 'Times New Roman', serif" font-style="italic"
        font-size="220" fill="rgba(26,23,18,0.22)">${initial}</text>
    </svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

function coverImageFor(entry) {
  return entry.coverImage || monogramImage(entry.name);
}

function wardrobeHref(entry) {
  return "wardrobe-detail.html?id=" + encodeURIComponent(entry.id) + "&name=" + encodeURIComponent(entry.name);
}

// Same shrink-before-storing trick used elsewhere on the site, so a
// full-resolution cover photo doesn't bloat localStorage.
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
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ---- specular button styling shared with the homepage's nav pills ----
const specularCommon = {
  radius: 999,
  lineColor: "#B08A4E",
  baseColor: "#EDE8DC",
  intensity: 0.9,
  shineSize: 14,
  shineFade: 45,
  thickness: 1.1,
  speed: 0.3,
  followMouse: true,
  proximity: 200,
  autoAnimate: false
};

function init() {
  const sidebarMount = document.getElementById("wardrobeSidebar");
  const grid = document.getElementById("wardrobeGrid");
  const addCard = document.getElementById("addWardrobeCard");
  const howItWorksBtn = document.getElementById("howItWorksBtn");
  const stepperOverlay = document.getElementById("stepperOverlay");
  const stepperClose = document.getElementById("stepperClose");
  const stepperMount = document.getElementById("stepperMount");
  const addItemBtn = document.getElementById("addItemGlobalBtn");
  const addItemMount = document.getElementById("addItemMount");

  // ---- Wardrobe cards ----
  let wardrobes = loadWardrobes();

  // ---- LineSidebar: browse by category, across every wardrobe's sections ----
  const sidebarItems = ["All"].concat(allCategories(wardrobes));
  mountLineSidebar(sidebarMount, {
    items: sidebarItems,
    accentColor: "#B08A4E",
    textColor: "#1A1712",
    markerColor: "rgba(26,23,18,0.35)",
    showIndex: true,
    showMarker: true,
    proximityRadius: 90,
    maxShift: 22,
    falloff: "smooth",
    markerLength: 48,
    markerGap: 4,
    tickScale: 0.5,
    scaleTick: true,
    itemGap: 18,
    fontSize: 1,
    smoothing: 100,
    defaultActive: 0,
    onItemClick: (index, label) => {
      if (label === "All") return;
      window.location.href = "category.html?name=" + encodeURIComponent(label);
    }
  });

  // ---- Stepper: "How it works" ----
  const stepper = mountStepper(stepperMount, {
    backButtonText: "Back",
    nextButtonText: "Next",
    steps: [
      {
        title: "Add what you own",
        bodyHTML: "<p>Start a wardrobe for however you already sort your clothes — by season, by occasion, by mood. There's no single right way to split things up.</p>"
      },
      {
        title: "Group it into wardrobes",
        bodyHTML: "<p>Each wardrobe is its own little capsule — Everyday, Workwear, Date Night, whatever fits your life. Give it a name (and a cover photo) you'll recognise later.</p>"
      },
      {
        title: "Browse by category",
        bodyHTML: "<p>Use the sidebar to jump straight to any section — tops, bottoms, or custom ones you've added — across everything you've catalogued.</p>"
      },
      {
        title: "Build an outfit",
        bodyHTML: "<p>Drag pieces from your wardrobe onto the mannequin to put a look together, then save it to Looks so you can find it again.</p>"
      }
    ],
    onFinalStepCompleted: () => closeStepper()
  });

  function openStepper() {
    stepper.reset();
    stepperOverlay.classList.add("is-open");
  }
  function closeStepper() {
    stepperOverlay.classList.remove("is-open");
  }
  howItWorksBtn.addEventListener("click", openStepper);
  stepperClose.addEventListener("click", closeStepper);
  stepperOverlay.addEventListener("click", (e) => {
    if (e.target === stepperOverlay) closeStepper();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeStepper();
  });

  function renderCard(entry) {
    const card = document.createElement("div");
    card.className = "wardrobe-card";

    const stage = document.createElement("div");
    stage.className = "wardrobe-card-stage";
    card.appendChild(stage);

    let tiltedCard = mountTiltedCard(stage, {
      imageSrc: coverImageFor(entry),
      altText: entry.name,
      captionText: entry.name,
      rotateAmplitude: 10,
      scaleOnHover: 1.06,
      showTooltip: true
    });

    // ---- editable cover photo ----
    const coverInput = document.createElement("input");
    coverInput.type = "file";
    coverInput.accept = "image/*";
    coverInput.className = "wardrobe-cover-input";
    coverInput.addEventListener("change", () => {
      const file = coverInput.files[0];
      if (!file) return;
      resizeImage(file, 700).then((dataUrl) => {
        entry.coverImage = dataUrl;
        saveWardrobes(wardrobes);
        tiltedCard.destroy();
        tiltedCard = mountTiltedCard(stage, {
          imageSrc: coverImageFor(entry),
          altText: entry.name,
          captionText: entry.name,
          rotateAmplitude: 10,
          scaleOnHover: 1.06,
          showTooltip: true
        });
      });
    });

    const coverBtn = document.createElement("button");
    coverBtn.type = "button";
    coverBtn.className = "wardrobe-card-cover-btn";
    coverBtn.textContent = "Change cover";
    coverBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      coverInput.click();
    });
    stage.appendChild(coverInput);
    stage.appendChild(coverBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "wardrobe-card-delete";
    deleteBtn.innerHTML = "&times;";
    deleteBtn.setAttribute("aria-label", 'Delete "' + entry.name + '"');
    deleteBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const confirmed = window.confirm('Delete "' + entry.name + '"? This can\'t be undone.');
      if (!confirmed) return;
      wardrobes = wardrobes.filter((w) => w.id !== entry.id);
      saveWardrobes(wardrobes);
      deleteItemsForWardrobe(entry.id);
      tiltedCard.destroy();
      specular.destroy();
      card.remove();
    });
    stage.appendChild(deleteBtn);

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "wardrobe-card-name";
    nameInput.value = entry.name;
    nameInput.setAttribute("aria-label", "Wardrobe name");
    nameInput.addEventListener("change", () => {
      const trimmed = nameInput.value.trim() || "Untitled Wardrobe";
      entry.name = trimmed;
      nameInput.value = trimmed;
      saveWardrobes(wardrobes);
      openBtn.href = wardrobeHref(entry);
    });
    card.appendChild(nameInput);

    const openBtn = document.createElement("a");
    openBtn.className = "wardrobe-open-btn";
    openBtn.href = wardrobeHref(entry);
    openBtn.innerHTML = "<span>Open</span>";
    card.appendChild(openBtn);
    const specular = mountSpecularButton(openBtn, specularCommon);

    grid.insertBefore(card, addCard);
  }

  wardrobes.forEach(renderCard);

  addCard.addEventListener("click", () => {
    const entry = {
      id: slugify("wardrobe-" + Date.now()),
      name: "New Wardrobe",
      categories: ["Tops", "Bottoms", "Jeans", "Accessories"]
    };
    wardrobes.push(entry);
    saveWardrobes(wardrobes);
    renderCard(entry);
  });

  // ---- global "Add item" (no wardrobe preselected — pick one or several) ----
  const addItemModal = mountAddItemModal(addItemMount, {
    getWardrobes: () => wardrobes,
    defaultWardrobeIds: [],
    onSaved: () => {
      // Items aren't shown on this overview page, nothing to refresh here.
    }
  });
  addItemBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    addItemModal.open();
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
