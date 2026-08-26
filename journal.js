// ---- Cultr: Journal / "This Week's Finds" ----
// Reuses the same Firebase project as the wardrobe feature. Finds are
// stored in their own "finds" collection so they don't mix with
// wardrobe items or boards.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  getAuth,
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
const db = getFirestore(app);

// ---- Elements ----
const loggedInBar = document.getElementById('loggedInBar');
const accountEmail = document.getElementById('accountEmail');
const logoutBtn = document.getElementById('logoutBtn');
const loggedOutMsg = document.getElementById('loggedOutMsg');
const addFindBtn = document.getElementById('addFindBtn');

const findOverlay = document.getElementById('findOverlay');
const findClose = document.getElementById('findClose');
const findForm = document.getElementById('findForm');
const findPhoto = document.getElementById('findPhoto');
const photoDropText = document.getElementById('photoDropText');
const photoPreview = document.getElementById('photoPreview');
const findCaption = document.getElementById('findCaption');
const findError = document.getElementById('findError');

const thisWeekSection = document.getElementById('thisWeekSection');
const thisWeekGrid = document.getElementById('thisWeekGrid');
const earlierSection = document.getElementById('earlierSection');
const earlierGrid = document.getElementById('earlierGrid');
const emptyState = document.getElementById('emptyState');

let selectedPhotoData = null;
let unsubscribeFromFinds = null;

logoutBtn.addEventListener('click', function (event) {
  event.preventDefault();
  signOut(auth);
});

// ---- Login state ----
onAuthStateChanged(auth, function (user) {
  if (user) {
    loggedInBar.style.display = 'flex';
    accountEmail.textContent = user.email;
    loggedOutMsg.style.display = 'none';
    addFindBtn.style.display = 'inline-block';
    listenForFinds(user.uid);
  } else {
    loggedInBar.style.display = 'none';
    addFindBtn.style.display = 'none';
    loggedOutMsg.style.display = 'block';
    loggedOutMsg.innerHTML = 'Log in on the <a href="index.html">homepage</a> to start saving your weekly finds.';
    thisWeekSection.style.display = 'none';
    earlierSection.style.display = 'none';
    emptyState.style.display = 'none';
    if (unsubscribeFromFinds) unsubscribeFromFinds();
  }
});

// ---- Modal open/close ----
// The "This week's finds" box is now a plain <a href="weekly-finds.html">
// in the HTML itself, so it navigates there with zero JS required (it'll
// still work even if this script, or Firebase, fails to load). The
// "+ Add a find" button sits inside that link, so it has to stop the
// click from also triggering the link's navigation.
addFindBtn.addEventListener('click', function (event) {
  event.preventDefault();
  event.stopPropagation();
  findError.style.display = 'none';
  findForm.reset();
  photoPreview.style.display = 'none';
  photoDropText.style.display = 'block';
  selectedPhotoData = null;
  findOverlay.classList.add('is-open');
});

findClose.addEventListener('click', function () {
  findOverlay.classList.remove('is-open');
});

findOverlay.addEventListener('click', function (event) {
  if (event.target === findOverlay) {
    findOverlay.classList.remove('is-open');
  }
});

// ---- Photo handling (resize before storing, same trick as wardrobe) ----
function resizeImage(file, maxSize) {
  return new Promise(function (resolve) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        let width = img.width;
        let height = img.height;
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

findPhoto.addEventListener('change', function () {
  const file = findPhoto.files[0];
  if (!file) return;
  resizeImage(file, 800).then(function (dataUrl) {
    selectedPhotoData = dataUrl;
    photoPreview.src = dataUrl;
    photoPreview.style.display = 'block';
    photoDropText.style.display = 'none';
  });
});

// ---- Saving a new find ----
findForm.addEventListener('submit', function (event) {
  event.preventDefault();
  findError.style.display = 'none';

  const user = auth.currentUser;
  if (!user) return;

  if (!selectedPhotoData) {
    findError.textContent = 'Please add a photo first.';
    findError.style.display = 'block';
    return;
  }

  addDoc(collection(db, 'finds'), {
    uid: user.uid,
    photo: selectedPhotoData,
    caption: findCaption.value,
    createdAt: serverTimestamp()
  })
    .then(function () {
      findOverlay.classList.remove('is-open');
    })
    .catch(function (error) {
      findError.textContent = error.message;
      findError.style.display = 'block';
    });
});

// ---- Rendering the feed, split into "This week" and "Earlier" ----
function renderFind(id, find) {
  const card = document.createElement('div');
  card.className = 'find-card';
  card.innerHTML =
    '<img src="' + find.photo + '" alt="Saved find">' +
    '<button class="find-delete" title="Remove">&times;</button>' +
    '<div class="find-caption">' + (find.caption || '') + '</div>';

  card.querySelector('.find-delete').addEventListener('click', function () {
    deleteDoc(doc(db, 'finds', id));
  });

  return card;
}

function listenForFinds(uid) {
  const findsQuery = query(collection(db, 'finds'), where('uid', '==', uid));

  unsubscribeFromFinds = onSnapshot(findsQuery, function (snapshot) {
    thisWeekGrid.innerHTML = '';
    earlierGrid.innerHTML = '';

    if (snapshot.empty) {
      emptyState.style.display = 'block';
      thisWeekSection.style.display = 'none';
      earlierSection.style.display = 'none';
      return;
    }
    emptyState.style.display = 'none';

    // Sort newest first
    const docs = [];
    snapshot.forEach(function (docSnap) { docs.push(docSnap); });
    docs.sort(function (a, b) {
      const at = a.data().createdAt ? a.data().createdAt.toMillis() : 0;
      const bt = b.data().createdAt ? b.data().createdAt.toMillis() : 0;
      return bt - at;
    });

    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let hasThisWeek = false;
    let hasEarlier = false;

    docs.forEach(function (docSnap) {
      const find = docSnap.data();
      const createdMs = find.createdAt ? find.createdAt.toMillis() : Date.now();
      const card = renderFind(docSnap.id, find);

      if (createdMs >= oneWeekAgo) {
        thisWeekGrid.appendChild(card);
        hasThisWeek = true;
      } else {
        earlierGrid.appendChild(card);
        hasEarlier = true;
      }
    });

    thisWeekSection.style.display = hasThisWeek ? 'block' : 'none';
    earlierSection.style.display = hasEarlier ? 'block' : 'none';
  });
}

// ---- "This week's finds" boxes: 50 fixed slots, edited directly in the
// Firebase console (products/find-1 .. products/find-50). No admin form,
// no login required to view — this is the public shop grid the tape box
// above scrolls down to. An empty slot just renders as a blank box.
const TOTAL_FIND_SLOTS = 50;
const thisWeeksFindsGrid = document.getElementById('thisWeeksFinds');

function slotId(n) { return 'find-' + n; }

function renderProductSlot(id, product) {
  const hasPhoto = product && product.photo;

  const card = document.createElement(hasPhoto ? 'a' : 'div');
  card.className = 'product-card' + (hasPhoto ? '' : ' is-empty');
  if (hasPhoto) card.href = 'product.html?id=' + id;

  const photoBox = document.createElement('div');
  photoBox.className = 'product-photo-box' + (hasPhoto ? '' : ' is-empty');
  if (hasPhoto) {
    const img = document.createElement('img');
    img.src = product.photo;
    img.alt = product.name || '';
    photoBox.appendChild(img);
  }
  card.appendChild(photoBox);

  if (hasPhoto && (product.brand || product.name)) {
    const brand = document.createElement('div');
    brand.className = 'product-card-brand';
    brand.textContent = product.brand || '';
    const name = document.createElement('div');
    name.className = 'product-card-name';
    name.textContent = product.name || '';
    card.appendChild(brand);
    card.appendChild(name);
  }

  return card;
}

function renderProductGrid(byId) {
  thisWeeksFindsGrid.innerHTML = '';
  for (let n = 1; n <= TOTAL_FIND_SLOTS; n++) {
    thisWeeksFindsGrid.appendChild(renderProductSlot(slotId(n), byId.get(slotId(n))));
  }
}

renderProductGrid(new Map()); // 50 empty boxes immediately, filled in live below

onSnapshot(collection(db, 'products'), function (snapshot) {
  const byId = new Map();
  snapshot.forEach(function (docSnap) { byId.set(docSnap.id, docSnap.data()); });
  renderProductGrid(byId);
});
