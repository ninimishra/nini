// ---- Cultr: shared login / signup, used on every page ----
// Reuses the same Firebase project as everything else. This file is safe
// to load alongside a page's own Firebase-using script (journal.js,
// clothes.js) — it only calls initializeApp() if nothing has already
// done so on this page.
//
// What this gives every page that loads it:
//   1. A login/signup modal, built and inserted automatically.
//   2. The header's nav area updated to show "Log in / Sign up" or the
//      logged-in account + "Log out", kept in sync automatically.
//   3. window.requireCultrAuth(callback) — call this from a click handler
//      to gate anything behind login. If the person is already logged in,
//      callback runs immediately. If not, the modal opens, and callback
//      runs automatically the moment they log in or sign up.
//   4. Any link with a data-auth-gate attribute is gated automatically —
//      clicking it while logged out opens the modal instead of navigating;
//      once logged in it completes the original click (following the
//      link's href, or smooth-scrolling if the href is a "#hash").

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

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

let pendingCallback = null;
let currentMode = "signup";

// ---- Step 1: build and inject the modal (once) ----
function injectModal() {
  if (document.getElementById("cultrAuthOverlay")) return;

  const style = document.createElement("style");
  style.textContent = `
    #cultrAuthOverlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s ease;
    }
    #cultrAuthOverlay.is-open { opacity: 1; visibility: visible; }
    #cultrAuthOverlay .modal-box {
      background: var(--black);
      color: var(--cream);
      width: 100%;
      max-width: 380px;
      margin: 20px;
      padding: 32px;
      border-radius: 8px;
      position: relative;
      border: 1px solid rgba(128,128,128,0.2);
      font-family: 'Inter', sans-serif;
    }
    #cultrAuthOverlay .modal-close {
      position: absolute;
      top: 12px;
      right: 14px;
      background: none;
      border: none;
      color: var(--cream);
      font-size: 22px;
      cursor: pointer;
      line-height: 1;
    }
    #cultrAuthOverlay h3 {
      font-family: 'Fraunces', serif;
      font-style: italic;
      font-weight: 600;
      font-size: 24px;
      margin: 0;
    }
    #cultrAuthOverlay .modal-subtitle {
      font-size: 13px;
      opacity: 0.6;
      margin-top: 8px;
    }
    #cultrAuthOverlay form {
      margin-top: 22px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    #cultrAuthOverlay label {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 12px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      opacity: 0.6;
    }
    #cultrAuthOverlay input {
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      padding: 11px 12px;
      border-radius: 4px;
      border: 1px solid rgba(128,128,128,0.3);
      background: transparent;
      color: var(--cream);
    }
    #cultrAuthOverlay .cultr-auth-error {
      font-size: 12.5px;
      color: #E0685A;
      display: none;
    }
    #cultrAuthOverlay button[type="submit"] {
      width: 100%;
      background: var(--brass);
      color: var(--black);
      font-weight: 600;
      font-size: 14px;
      padding: 13px 26px;
      border-radius: 999px;
      border: none;
      cursor: pointer;
    }
    #cultrAuthOverlay .modal-switch {
      margin-top: 18px;
      font-size: 13px;
      text-align: center;
      opacity: 0.7;
    }
    #cultrAuthOverlay .modal-switch a { color: var(--brass); }
    .cultr-nav-auth {
      display: flex;
      align-items: center;
      gap: 16px;
      font-size: 13px;
    }
    .cultr-nav-auth a { color: inherit; text-decoration: none; cursor: pointer; }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement("div");
  overlay.id = "cultrAuthOverlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <button class="modal-close" id="cultrAuthClose" aria-label="Close">&times;</button>
      <h3 id="cultrAuthTitle">Sign up</h3>
      <p class="modal-subtitle" id="cultrAuthSubtitle">Create your account in under a minute.</p>
      <form id="cultrAuthForm">
        <label>
          Email
          <input type="email" id="cultrAuthEmail" placeholder="you@example.com" required>
        </label>
        <label>
          Password
          <input type="password" id="cultrAuthPassword" placeholder="••••••••" required>
        </label>
        <p class="cultr-auth-error" id="cultrAuthError"></p>
        <button type="submit" id="cultrAuthSubmit">Create account</button>
      </form>
      <p class="modal-switch">
        <span id="cultrAuthSwitchText">Already have an account?</span>
        <a href="#" id="cultrAuthSwitch">Log in</a>
      </p>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById("cultrAuthClose").addEventListener("click", closeModal);
  overlay.addEventListener("click", function (event) {
    if (event.target === overlay) closeModal();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeModal();
  });
  document.getElementById("cultrAuthSwitch").addEventListener("click", function (event) {
    event.preventDefault();
    openModal(currentMode === "signup" ? "login" : "signup");
  });
  document.getElementById("cultrAuthForm").addEventListener("submit", handleSubmit);
}

function openModal(mode) {
  injectModal();
  currentMode = mode;
  const title = document.getElementById("cultrAuthTitle");
  const subtitle = document.getElementById("cultrAuthSubtitle");
  const submit = document.getElementById("cultrAuthSubmit");
  const switchText = document.getElementById("cultrAuthSwitchText");
  const switchLink = document.getElementById("cultrAuthSwitch");
  const error = document.getElementById("cultrAuthError");

  error.style.display = "none";
  document.getElementById("cultrAuthForm").reset();

  if (mode === "login") {
    title.textContent = "Log in";
    subtitle.textContent = "Welcome back.";
    submit.textContent = "Log in";
    switchText.textContent = "Need an account?";
    switchLink.textContent = "Sign up";
  } else {
    title.textContent = "Sign up";
    subtitle.textContent = "Create your account in under a minute.";
    submit.textContent = "Create account";
    switchText.textContent = "Already have an account?";
    switchLink.textContent = "Log in";
  }
  document.getElementById("cultrAuthOverlay").classList.add("is-open");
}

function closeModal() {
  const overlay = document.getElementById("cultrAuthOverlay");
  if (overlay) overlay.classList.remove("is-open");
  // If the modal is dismissed without logging in, drop any pending gate.
  pendingCallback = null;
}

function handleSubmit(event) {
  event.preventDefault();
  const error = document.getElementById("cultrAuthError");
  error.style.display = "none";

  const email = document.getElementById("cultrAuthEmail").value;
  const password = document.getElementById("cultrAuthPassword").value;

  const action = currentMode === "signup"
    ? createUserWithEmailAndPassword(auth, email, password)
    : signInWithEmailAndPassword(auth, email, password);

  action
    .then(function () {
      const overlay = document.getElementById("cultrAuthOverlay");
      if (overlay) overlay.classList.remove("is-open");
      // Note: pendingCallback (if any) runs from onAuthStateChanged below,
      // once Firebase confirms the login, not from here.
    })
    .catch(function (err) {
      error.textContent = err.message;
      error.style.display = "block";
    });
}

// ---- Step 2: keep the header's nav in sync with login state ----
function updateNavUI(user) {
  let navAuth = document.getElementById("cultrNavAuth");
  const navLinks = document.querySelector(".nav-links");

  if (!navAuth && navLinks) {
    navAuth = document.createElement("div");
    navAuth.id = "cultrNavAuth";
    navAuth.className = "cultr-nav-auth";
    navLinks.insertAdjacentElement("afterend", navAuth);
  }

  // index.html already has its own "Log in" link in the hero nav —
  // reuse it instead of adding a duplicate control.
  const heroLoginLink = document.getElementById("navLoginBtn");

  if (user) {
    if (navAuth) {
      navAuth.innerHTML =
        '<span>' + user.email + '</span> <a href="#" id="cultrLogoutLink">Log out</a>';
      document.getElementById("cultrLogoutLink").addEventListener("click", function (event) {
        event.preventDefault();
        signOut(auth);
      });
    }
    if (heroLoginLink) {
      heroLoginLink.textContent = "Log out";
      heroLoginLink.onclick = function (event) {
        event.preventDefault();
        signOut(auth);
      };
    }
  } else {
    if (navAuth) {
      navAuth.innerHTML =
        '<a href="#" id="cultrLoginLink">Log in</a> <a href="#" id="cultrSignupLink">Sign up</a>';
      document.getElementById("cultrLoginLink").addEventListener("click", function (event) {
        event.preventDefault();
        openModal("login");
      });
      document.getElementById("cultrSignupLink").addEventListener("click", function (event) {
        event.preventDefault();
        openModal("signup");
      });
    }
    if (heroLoginLink) {
      heroLoginLink.textContent = "Log in";
      heroLoginLink.onclick = function (event) {
        event.preventDefault();
        openModal("login");
      };
    }
  }
}

// ---- Step 3: the gating helper other scripts / inline handlers can use ----
window.requireCultrAuth = function (callback) {
  if (auth.currentUser) {
    callback();
    return;
  }
  pendingCallback = callback;
  openModal("login");
};

// ---- Step 4: auto-gate any [data-auth-gate] link on the page ----
document.querySelectorAll("[data-auth-gate]").forEach(function (el) {
  el.addEventListener("click", function (event) {
    if (auth.currentUser) return; // already logged in, let it navigate normally
    event.preventDefault();
    event.stopPropagation();
    const href = el.getAttribute("href");
    window.requireCultrAuth(function () {
      if (href && href.charAt(0) === "#") {
        const target = document.querySelector(href);
        if (target) target.scrollIntoView({ behavior: "smooth" });
      } else if (href) {
        window.location.href = href;
      }
    });
  });
});

onAuthStateChanged(auth, function (user) {
  updateNavUI(user);
  if (user && pendingCallback) {
    const callback = pendingCallback;
    pendingCallback = null;
    callback();
  }
});
