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
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  deleteDoc,
  doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

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
const db = getFirestore(app);

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

// Wardrobe feature elements
const wardrobeSection = document.getElementById('wardrobe-app');
const itemForm = document.getElementById('itemForm');
const itemPhoto = document.getElementById('itemPhoto');
const photoDropText = document.getElementById('photoDropText');
const photoPreview = document.getElementById('photoPreview');
const itemName = document.getElementById('itemName');
const itemCategory = document.getElementById('itemCategory');
const itemColour = document.getElementById('itemColour');
const itemSeason = document.getElementById('itemSeason');
const itemError = document.getElementById('itemError');
const wardrobeGrid = document.getElementById('wardrobeGrid');
const wardrobeEmpty = document.getElementById('wardrobeEmpty');

// Holds the compressed photo (as a data URL / base64 string) once
// someone picks a file, ready to save when the form is submitted.
let selectedPhotoData = null;

// Holds the "stop listening" function Firestore gives us, so we can
// turn off the live item listener when someone logs out.
let unsubscribeFromItems = null;

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

    // Reveal the wardrobe section and start listening for this
    // person's items.
    wardrobeSection.style.display = 'block';
    listenForItems(user.uid);
  } else {
    // Signed out: show Log in / Sign up again
    accountStatus.style.display = 'none';
    loginBtn.style.display = 'inline';
    signupBtn.style.display = 'inline';

    // Hide the wardrobe section and stop listening for items,
    // since there's no logged-in user to show items for.
    wardrobeSection.style.display = 'none';
    if (unsubscribeFromItems) {
      unsubscribeFromItems();
    }
  }
});

// ---- Wardrobe: photo upload feature ----

// When someone picks a photo, we shrink it down before storing it.
// We're storing photos as text (base64) directly in the database,
// which only works well for smaller images — a full-size phone photo
// could be 5-10MB, way too big. Resizing it with a <canvas> first
// keeps it small enough to store, while still looking good.
function resizeImage(file, maxSize) {
  return new Promise(function (resolve) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        // Work out new dimensions, keeping the photo's proportions
        let width = img.width;
        let height = img.height;
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }

        // Draw the resized image onto an invisible canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Turn the canvas back into a compressed image (jpeg, 70% quality)
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// When a photo is picked, show a preview and resize it in the background
itemPhoto.addEventListener('change', function () {
  const file = itemPhoto.files[0];
  if (!file) return;

  resizeImage(file, 800).then(function (dataUrl) {
    selectedPhotoData = dataUrl;
    photoPreview.src = dataUrl;
    photoPreview.style.display = 'block';
    photoDropText.style.display = 'none';
  });
});

function showItemError(message) {
  itemError.textContent = message;
  itemError.style.display = 'block';
}

// Adding a new item to the wardrobe
itemForm.addEventListener('submit', function (event) {
  event.preventDefault();
  itemError.style.display = 'none';

  const user = auth.currentUser;
  if (!user) return; // safety check — shouldn't happen, form is hidden when logged out

  if (!selectedPhotoData) {
    showItemError('Please add a photo first.');
    return;
  }

  // addDoc saves a new item into the "items" collection in Firestore.
  // We tag it with the logged-in user's uid, so later we can ask
  // Firestore for "only items belonging to this person."
  addDoc(collection(db, 'items'), {
    uid: user.uid,
    name: itemName.value,
    category: itemCategory.value,
    colour: itemColour.value,
    season: itemSeason.value,
    photo: selectedPhotoData,
    createdAt: serverTimestamp()
  })
    .then(function () {
      itemForm.reset();
      photoPreview.style.display = 'none';
      photoDropText.style.display = 'block';
      selectedPhotoData = null;
    })
    .catch(function (error) {
      showItemError(error.message);
    });
});

// Renders one item's card into the wardrobe grid
function renderItem(id, item) {
  const card = document.createElement('div');
  card.className = 'wardrobe-item';
  card.innerHTML =
    '<img src="' + item.photo + '" alt="' + item.name + '">' +
    '<button class="wardrobe-item-delete" title="Remove">&times;</button>' +
    '<div class="wardrobe-item-name">' + item.name + '</div>' +
    '<div class="wardrobe-item-meta">' + item.category + ' · ' + item.colour + '</div>';

  // Wire up the delete button for this specific card
  card.querySelector('.wardrobe-item-delete').addEventListener('click', function () {
    deleteDoc(doc(db, 'items', id));
  });

  return card;
}

// Sets up a live connection to Firestore for this user's items.
// onSnapshot doesn't just fetch once — it keeps listening, so if an
// item is added or removed (from any tab/device), the grid updates
// automatically without needing to refresh the page.
function listenForItems(uid) {
  const itemsQuery = query(collection(db, 'items'), where('uid', '==', uid));

  unsubscribeFromItems = onSnapshot(itemsQuery, function (snapshot) {
    wardrobeGrid.innerHTML = '';

    if (snapshot.empty) {
      wardrobeEmpty.style.display = 'block';
      return;
    }
    wardrobeEmpty.style.display = 'none';

    snapshot.forEach(function (docSnap) {
      wardrobeGrid.appendChild(renderItem(docSnap.id, docSnap.data()));
    });
  });
}
