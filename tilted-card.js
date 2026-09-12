// ---- Cultr: TiltedCard ----
// Vanilla-JS port of the React Bits <TiltedCard /> component. The
// original uses framer-motion springs (useSpring); this site has no
// React/motion, so each animated value (rotateX, rotateY, scale,
// opacity, caption rotation) is driven by a tiny hand-rolled
// critically-damped spring integrator running on one rAF loop instead -
// same damping/stiffness/mass numbers, same visual feel.
//
// Usage:
//   import { mountTiltedCard } from './tilted-card.js';
//   const card = mountTiltedCard(document.getElementById('cardMount'), {
//     imageSrc: '...',
//     captionText: 'Everyday Edit'
//   });
//   // card.destroy() to tear down.

function makeSpring(stiffness, damping, mass, initial = 0) {
  let value = initial;
  let velocity = 0;
  let target = initial;
  return {
    set(t) { target = t; },
    snap(t) { target = t; value = t; velocity = 0; },
    step(dt) {
      const force = -stiffness * (value - target);
      const damp = -damping * velocity;
      const accel = (force + damp) / mass;
      velocity += accel * dt;
      value += velocity * dt;
      return value;
    },
    get() { return value; },
    settled() {
      return Math.abs(target - value) < 0.01 && Math.abs(velocity) < 0.01;
    }
  };
}

export function mountTiltedCard(mount, opts = {}) {
  const {
    imageSrc,
    altText = "Tilted card image",
    captionText = "",
    rotateAmplitude = 14,
    scaleOnHover = 1.1,
    showTooltip = true,
    displayOverlayContent = false,
    overlayHTML = null
  } = opts;

  if (!mount) return { destroy() {} };

  const figure = document.createElement("figure");
  figure.className = "tilted-card-figure";

  const inner = document.createElement("div");
  inner.className = "tilted-card-inner";

  const img = document.createElement("img");
  img.className = "tilted-card-img";
  img.src = imageSrc || "";
  img.alt = altText;
  img.loading = "lazy";
  inner.appendChild(img);

  if (displayOverlayContent && overlayHTML) {
    const overlay = document.createElement("div");
    overlay.className = "tilted-card-overlay";
    overlay.innerHTML = overlayHTML;
    inner.appendChild(overlay);
  }

  figure.appendChild(inner);

  let figcaption = null;
  if (showTooltip) {
    figcaption = document.createElement("figcaption");
    figcaption.className = "tilted-card-caption";
    figcaption.textContent = captionText;
    Object.assign(figcaption.style, {
      pointerEvents: "none",
      position: "absolute",
      left: "0",
      top: "0",
      borderRadius: "4px",
      background: "#fff",
      padding: "4px 10px",
      fontSize: "10px",
      color: "#2d2d2d",
      opacity: "0",
      zIndex: "3"
    });
    figure.appendChild(figcaption);
  }

  mount.appendChild(figure);

  const springValues = { stiffness: 100, damping: 30, mass: 2 };
  const rotateX = makeSpring(springValues.stiffness, springValues.damping, springValues.mass);
  const rotateY = makeSpring(springValues.stiffness, springValues.damping, springValues.mass);
  const scale = makeSpring(springValues.stiffness, springValues.damping, springValues.mass, 1);
  const opacity = makeSpring(350, 30, 1);
  const rotateFig = makeSpring(350, 30, 1);

  let capX = 0;
  let capY = 0;
  let lastY = 0;
  let raf = 0;
  let lastTime = 0;

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.032) : 0.016;
    lastTime = now;

    const rx = rotateX.step(dt);
    const ry = rotateY.step(dt);
    const sc = scale.step(dt);
    const op = opacity.step(dt);
    const rf = rotateFig.step(dt);

    inner.style.transform =
      "rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg) scale(" + sc.toFixed(3) + ")";

    if (figcaption) {
      figcaption.style.transform =
        "translate(" + capX.toFixed(1) + "px, " + capY.toFixed(1) + "px) rotate(" + rf.toFixed(2) + "deg)";
      figcaption.style.opacity = op.toFixed(3);
    }
  }
  raf = requestAnimationFrame(loop);

  function handleMouse(e) {
    const rect = figure.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - rect.width / 2;
    const offsetY = e.clientY - rect.top - rect.height / 2;

    rotateX.set((offsetY / (rect.height / 2)) * -rotateAmplitude);
    rotateY.set((offsetX / (rect.width / 2)) * rotateAmplitude);

    capX = e.clientX - rect.left;
    capY = e.clientY - rect.top;

    const velocityY = offsetY - lastY;
    rotateFig.set(-velocityY * 0.6);
    lastY = offsetY;
  }

  function handleEnter() {
    scale.set(scaleOnHover);
    opacity.set(1);
  }

  function handleLeave() {
    opacity.set(0);
    scale.set(1);
    rotateX.set(0);
    rotateY.set(0);
    rotateFig.set(0);
  }

  figure.addEventListener("pointermove", handleMouse);
  figure.addEventListener("pointerenter", handleEnter);
  figure.addEventListener("pointerleave", handleLeave);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      figure.removeEventListener("pointermove", handleMouse);
      figure.removeEventListener("pointerenter", handleEnter);
      figure.removeEventListener("pointerleave", handleLeave);
      if (figure.parentNode === mount) mount.removeChild(figure);
    }
  };
}
