// ---- Nini: real accounts with Firebase Authentication ----
// This file runs on the homepage. It handles sign up, log in, log out,
// and keeping the nav in sync with whether someone's logged in.
// The wardrobe feature itself now lives in wardrobe.js, on its own page.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

// Your Firebase project's settings (from the Firebase console).
// This is not a secret — it's fine for this to be visible in your code.
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
const auth = getAuth(app);

// ---- Step 1: grab references to the elements we need ----
const signupBtn = document.getElementById('signupBtn');
const loginBtn = document.getElementById('loginBtn');
const overlay = document.getElementById('authOverlay');
const closeBtn = document.getElementById('modalClose');
const modalTitle = document.getElementById('modalTitle');
const modalSubtitle = document.getElementById('modalSubtitle');
const switchToLogin = document.getElementById('switchToLogin');
const authForm = document.getElementById('authForm');
const authError = document.getElementById('authError');
const accountStatus = document.getElementById('accountStatus');
const accountEmail = document.getElementById('accountEmail');
const logoutBtn = document.getElementById('logoutBtn');

let currentMode = 'signup';

function openModal(mode) {
  currentMode = mode;
  authError.style.display = 'none';
  authForm.reset();

  if (mode === 'login') {
    modalTitle.textContent = 'Log in';
    modalSubtitle.textContent = 'Welcome back to your wardrobe.';
  } else {
    modalTitle.textContent = 'Sign up';
    modalSubtitle.textContent = 'Create your wardrobe in under a minute.';
  }
  overlay.classList.add('is-open');
}

function closeModal() {
  overlay.classList.remove('is-open');
}

signupBtn.addEventListener('click', function (event) {
  event.preventDefault();
  openModal('signup');
});

loginBtn.addEventListener('click', function (event) {
  event.preventDefault();
  openModal('login');
});

switchToLogin.addEventListener('click', function (event) {
  event.preventDefault();
  openModal(currentMode === 'signup' ? 'login' : 'signup');
});

closeBtn.addEventListener('click', closeModal);

overlay.addEventListener('click', function (event) {
  if (event.target === overlay) {
    closeModal();
  }
});

document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape') {
    closeModal();
  }
});

logoutBtn.addEventListener('click', function (event) {
  event.preventDefault();
  signOut(auth);
});

function showError(message) {
  authError.textContent = message;
  authError.style.display = 'block';
}

authForm.addEventListener('submit', function (event) {
  event.preventDefault();
  authError.style.display = 'none';

  const email = authForm.querySelector('input[type="email"]').value;
  const password = authForm.querySelector('input[type="password"]').value;

  if (currentMode === 'signup') {
    createUserWithEmailAndPassword(auth, email, password)
      .then(function () {
        closeModal();
      })
      .catch(function (error) {
        showError(error.message);
      });
  } else {
    signInWithEmailAndPassword(auth, email, password)
      .then(function () {
        closeModal();
      })
      .catch(function (error) {
        showError(error.message);
      });
  }
});

// Keeping the nav in sync with whether someone's logged in
onAuthStateChanged(auth, function (user) {
  if (user) {
    accountEmail.textContent = user.email;
    accountStatus.style.display = 'flex';
    loginBtn.style.display = 'none';
    signupBtn.style.display = 'none';
  } else {
    accountStatus.style.display = 'none';
    loginBtn.style.display = 'inline';
    signupBtn.style.display = 'inline';
  }
});
