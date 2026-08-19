// ---- Nini: real accounts with Firebase Authentication ----
// This file now talks to Firebase, a free Google service that securely
// creates accounts and checks passwords for us — we never handle raw
// passwords ourselves, which is the safe way to do this.

// Step 0: import the Firebase tools we need.
// "type=module" on the <script> tag in nini.html is what allows
// these import lines to work at all.
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

// Connect to your Firebase project, and get the "auth" tool —
// this is the object we'll use for every sign up / log in / log out call.
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

// Tracks whether the modal is currently in "signup" or "login" mode,
// so the form submit handler knows which Firebase function to call.
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

// ---- Step 2 + 3: listen for clicks, then react ----

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

// ---- The real part: talking to Firebase ----
// This function reads whatever's typed into the form and shows an
// error message if Firebase rejects it (e.g. wrong password, or an
// email that's already taken).
function showError(message) {
  authError.textContent = message;
  authError.style.display = 'block';
}

authForm.addEventListener('submit', function (event) {
  event.preventDefault(); // stop the page from refreshing
  authError.style.display = 'none';

  const email = authForm.querySelector('input[type="email"]').value;
  const password = authForm.querySelector('input[type="password"]').value;

  if (currentMode === 'signup') {
    // createUserWithEmailAndPassword talks to Firebase and creates
    // a real account. It returns a "promise" — a placeholder for a
    // result that arrives a little later, since it has to reach out
    // over the internet. .then() runs once it succeeds; .catch() runs
    // if something goes wrong.
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

// ---- Keeping the nav in sync with whether someone's logged in ----
// onAuthStateChanged runs automatically whenever someone logs in,
// logs out, or when the page first loads (Firebase remembers sessions).
onAuthStateChanged(auth, function (user) {
  if (user) {
    // Signed in: show their email, hide the Log in / Sign up buttons
    accountEmail.textContent = user.email;
    accountStatus.style.display = 'flex';
    loginBtn.style.display = 'none';
    signupBtn.style.display = 'none';
  } else {
    // Signed out: show Log in / Sign up again
    accountStatus.style.display = 'none';
    loginBtn.style.display = 'inline';
    signupBtn.style.display = 'inline';
  }
});
