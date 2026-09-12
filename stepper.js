// ---- Cultr: Stepper ----
// Vanilla-JS port of the React Bits <Stepper /> component, used here as
// the content of the Wardrobe page's "How it works" modal. Simplified
// from the original: plain CSS opacity/height transitions stand in for
// the framer-motion slide animation (no React, no motion library), but
// the step-indicator / connector / back-next logic is the same.
//
// Usage:
//   import { mountStepper } from './stepper.js';
//   const stepper = mountStepper(document.getElementById('stepperMount'), {
//     steps: [{ title: 'Step 1', bodyHTML: '<p>...</p>' }, ...],
//     onFinalStepCompleted: () => overlay.classList.remove('is-open')
//   });
//   // stepper.reset() to go back to step 1, stepper.destroy() to tear down.

export function mountStepper(mount, opts = {}) {
  const {
    steps = [],
    initialStep = 1,
    backButtonText = "Back",
    nextButtonText = "Continue",
    onStepChange = () => {},
    onFinalStepCompleted = () => {}
  } = opts;

  if (!mount || steps.length === 0) return { destroy() {}, reset() {} };

  let currentStep = initialStep;
  const totalSteps = steps.length;

  const outer = document.createElement("div");
  outer.className = "outer-container";

  const circleContainer = document.createElement("div");
  circleContainer.className = "step-circle-container";

  const indicatorRow = document.createElement("div");
  indicatorRow.className = "step-indicator-row";

  const indicatorEls = [];
  const connectorFills = [];

  steps.forEach((_, i) => {
    const stepNumber = i + 1;
    const indicator = document.createElement("div");
    indicator.className = "step-indicator";
    indicator.dataset.status = "inactive";
    const inner = document.createElement("div");
    inner.className = "step-indicator-inner";
    inner.textContent = String(stepNumber);
    indicator.appendChild(inner);
    indicator.addEventListener("click", () => {
      if (stepNumber !== currentStep) updateStep(stepNumber);
    });
    indicatorRow.appendChild(indicator);
    indicatorEls.push(indicator);

    if (i < totalSteps - 1) {
      const connector = document.createElement("div");
      connector.className = "step-connector";
      const fill = document.createElement("div");
      fill.className = "step-connector-fill";
      connector.appendChild(fill);
      indicatorRow.appendChild(connector);
      connectorFills.push(fill);
    }
  });

  const content = document.createElement("div");
  content.className = "step-content-default";

  const footer = document.createElement("div");
  footer.className = "footer-container";
  const footerNav = document.createElement("div");
  footerNav.className = "footer-nav";

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "back-button";
  backBtn.textContent = backButtonText;

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "next-button";

  footerNav.appendChild(backBtn);
  footerNav.appendChild(nextBtn);
  footer.appendChild(footerNav);

  circleContainer.appendChild(indicatorRow);
  circleContainer.appendChild(content);
  circleContainer.appendChild(footer);
  outer.appendChild(circleContainer);
  mount.appendChild(outer);

  function renderStepContent() {
    const step = steps[currentStep - 1];
    content.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "step-default";
    if (step.title) {
      const h2 = document.createElement("h2");
      h2.textContent = step.title;
      wrap.appendChild(h2);
    }
    if (step.bodyHTML) {
      const body = document.createElement("div");
      body.innerHTML = step.bodyHTML;
      wrap.appendChild(body);
    }
    content.appendChild(wrap);
  }

  function renderIndicators() {
    indicatorEls.forEach((el, i) => {
      const stepNumber = i + 1;
      el.dataset.status =
        currentStep === stepNumber ? "active" : currentStep < stepNumber ? "inactive" : "complete";
    });
    connectorFills.forEach((fill, i) => {
      fill.style.width = currentStep > i + 1 ? "100%" : "0%";
    });
  }

  function renderFooter() {
    const isLastStep = currentStep === totalSteps;
    backBtn.style.display = currentStep === 1 ? "none" : "inline-block";
    footerNav.className = "footer-nav " + (currentStep !== 1 ? "spread" : "end");
    nextBtn.textContent = isLastStep ? "Complete" : nextButtonText;
  }

  function updateStep(newStep) {
    currentStep = newStep;
    if (newStep > totalSteps) {
      onFinalStepCompleted();
      return;
    }
    renderStepContent();
    renderIndicators();
    renderFooter();
    onStepChange(newStep);
  }

  backBtn.addEventListener("click", () => {
    if (currentStep > 1) updateStep(currentStep - 1);
  });
  nextBtn.addEventListener("click", () => {
    if (currentStep === totalSteps) {
      updateStep(totalSteps + 1);
    } else {
      updateStep(currentStep + 1);
    }
  });

  renderStepContent();
  renderIndicators();
  renderFooter();

  return {
    reset() { updateStep(initialStep); },
    destroy() {
      if (outer.parentNode === mount) mount.removeChild(outer);
    }
  };
}
