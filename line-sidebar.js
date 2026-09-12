// ---- Cultr: LineSidebar ----
// Vanilla-JS port of the React Bits <LineSidebar /> component. Same
// proximity/falloff math and the same single-rAF-loop smoothing trick as
// the original, just built against plain DOM elements instead of React
// refs/state.
//
// Usage:
//   import { mountLineSidebar } from './line-sidebar.js';
//   const sidebar = mountLineSidebar(document.getElementById('sidebarMount'), {
//     items: ['Tops', 'Bottoms', 'Shoes'],
//     onItemClick: (index, label) => { ... }
//   });
//   // sidebar.destroy() to tear down.

const FALLOFF_CURVES = {
  linear: (p) => p,
  smooth: (p) => p * p * (3 - 2 * p),
  sharp: (p) => p * p * p
};

export function mountLineSidebar(mount, opts = {}) {
  const {
    items = [],
    accentColor = "#A855F7",
    textColor = "#c4c4c4",
    markerColor = "#6c6c6c",
    showIndex = true,
    showMarker = true,
    proximityRadius = 100,
    maxShift = 30,
    falloff = "smooth",
    markerLength = 60,
    markerGap = 0,
    tickScale = 0.5,
    scaleTick = true,
    itemGap = 20,
    fontSize = 1.1,
    smoothing = 100,
    defaultActive = null,
    onItemClick,
    className = ""
  } = opts;

  if (!mount) return { destroy() {} };

  const nav = document.createElement("nav");
  nav.className =
    "line-sidebar" +
    (showMarker ? " line-sidebar--markers" : "") +
    (scaleTick ? " line-sidebar--scale-tick" : "") +
    (className ? " " + className : "");
  nav.style.setProperty("--accent-color", accentColor);
  nav.style.setProperty("--text-color", textColor);
  nav.style.setProperty("--marker-color", markerColor);
  nav.style.setProperty("--marker-length", markerLength + "px");
  nav.style.setProperty("--marker-gap", markerGap + "px");
  nav.style.setProperty("--tick-scale", tickScale);
  nav.style.setProperty("--max-shift", maxShift + "px");
  nav.style.setProperty("--item-gap", itemGap + "px");
  nav.style.setProperty("--font-size", fontSize + "rem");
  nav.style.setProperty("--smoothing", smoothing + "ms");

  const list = document.createElement("ul");
  list.className = "line-sidebar__list";
  nav.appendChild(list);
  mount.appendChild(nav);

  let activeIndex = defaultActive;
  const itemEls = [];
  const targets = new Array(items.length).fill(0);
  const current = new Array(items.length).fill(0);

  items.forEach((label, index) => {
    const li = document.createElement("li");
    li.className = "line-sidebar__item";
    if (activeIndex === index) li.setAttribute("aria-current", "true");

    if (showMarker) {
      const marker = document.createElement("span");
      marker.className = "line-sidebar__marker";
      marker.setAttribute("aria-hidden", "true");
      li.appendChild(marker);
    }

    const labelSpan = document.createElement("span");
    labelSpan.className = "line-sidebar__label";

    if (showIndex) {
      const idx = document.createElement("span");
      idx.className = "line-sidebar__index";
      idx.textContent = String(index + 1).padStart(2, "0");
      labelSpan.appendChild(idx);
    }

    const text = document.createElement("span");
    text.className = "line-sidebar__text";
    text.textContent = label;
    labelSpan.appendChild(text);

    li.appendChild(labelSpan);
    li.addEventListener("click", () => {
      const prev = list.querySelector('[aria-current="true"]');
      if (prev) prev.removeAttribute("aria-current");
      activeIndex = index;
      li.setAttribute("aria-current", "true");
      startLoop();
      if (onItemClick) onItemClick(index, label);
    });

    list.appendChild(li);
    itemEls.push(li);
  });

  let raf = 0;
  let last = 0;

  function runFrame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const tau = Math.max(smoothing, 1) / 1000;
    const k = 1 - Math.exp(-dt / tau);

    let moving = false;
    for (let i = 0; i < itemEls.length; i++) {
      const el = itemEls[i];
      const target = Math.max(targets[i] || 0, activeIndex === i ? 1 : 0);
      const cur = current[i] || 0;
      const next = cur + (target - cur) * k;
      const settled = Math.abs(target - next) < 0.0015;
      const value = settled ? target : next;
      current[i] = value;
      el.style.setProperty("--effect", value.toFixed(4));
      if (!settled) moving = true;
    }

    raf = moving ? requestAnimationFrame(runFrame) : 0;
  }

  function startLoop() {
    if (raf) cancelAnimationFrame(raf);
    last = performance.now();
    raf = requestAnimationFrame(runFrame);
  }

  function handlePointerMove(e) {
    const rect = list.getBoundingClientRect();
    const pointerY = e.clientY - rect.top;
    const ease = FALLOFF_CURVES[falloff] || FALLOFF_CURVES.linear;
    for (let i = 0; i < itemEls.length; i++) {
      const el = itemEls[i];
      const center = el.offsetTop + el.offsetHeight / 2;
      const distance = Math.abs(pointerY - center);
      targets[i] = ease(Math.max(0, 1 - distance / proximityRadius));
    }
    startLoop();
  }

  function handlePointerLeave() {
    for (let i = 0; i < targets.length; i++) targets[i] = 0;
    startLoop();
  }

  list.addEventListener("pointermove", handlePointerMove);
  list.addEventListener("pointerleave", handlePointerLeave);
  startLoop();

  return {
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      list.removeEventListener("pointermove", handlePointerMove);
      list.removeEventListener("pointerleave", handlePointerLeave);
      if (nav.parentNode === mount) mount.removeChild(nav);
    }
  };
}
