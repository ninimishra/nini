// ---- Nini: the wardrobe page ----
// This page shows a person's "wardrobes" (boards, like Pinterest boards) —
// and, once you click into one, the items inside it.
// Which view shows is controlled by the URL: wardrobe.html on its own
// shows the boards list; wardrobe.html?board=SOME_ID shows that board's items.

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
const accountEmail = document.getElementById('accountEmail');
const logoutBtn = document.getElementById('logoutBtn');

const loggedOutView = document.getElementById('loggedOutView');
const boardsView = document.getElementById('boardsView');
const boardDetailView = document.getElementById('boardDetailView');

const newBoardBtn = document.getElementById('newBoardBtn');
const boardsGrid = document.getElementById('boardsGrid');
const boardsEmpty = document.getElementById('boardsEmpty');

const newBoardOverlay = document.getElementById('newBoardOverlay');
const newBoardClose = document.getElementById('newBoardClose');
const newBoardForm = document.getElementById('newBoardForm');
const newBoardName = document.getElementById('newBoardName');
const newBoardError = document.getElementById('newBoardError');

const boardTitle = document.getElementById('boardTitle');
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

let selectedPhotoData = null;
let unsubscribeFromBoards = null;
let unsubscribeFromItems = null;

// A few palette colours for board card swatches, so boards don't
// all look identical — just cosmetic, cycles through the list.
const swatchColours = [
  'linear-gradient(135deg, #C08574, #8B5A48)',
  'linear-gradient(135deg, #B08D57, #83672F)',
  'linear-gradient(135deg, #7C8A6E, #545F44)',
  'linear-gradient(135deg, #5A5148, #2B2420)'
];

logoutBtn.addEventListener('click', function (event) {
  event.preventDefault();
  signOut(auth);
});

// ---- Deciding which view to show, based on login state + the URL ----
onAuthStateChanged(auth, function (user) {
  if (!user) {
    loggedOutView.style.display = 'block';
    boardsView.style.display = 'none';
    boardDetailView.style.display = 'none';
    return;
  }

  accountEmail.textContent = user.email;
  loggedOutView.style.display = 'none';

  const params = new URLSearchParams(window.location.search);
  const boardId = params.get('board');
  const boardName = params.get('name');

  if (boardId) {
    boardsView.style.display = 'none';
    boardDetailView.style.display = 'block';
    boardTitle.textContent = boardName || 'Wardrobe';
    listenForItems(user.uid, boardId);
  } else {
    boardDetailView.style.display = 'none';
    boardsView.style.display = 'block';
    listenForBoards(user.uid);
  }
});

// ---- Boards list view ----

function renderBoard(id, board, index) {
  const card = document.createElement('a');
  card.className = 'board-card';
  card.href = 'wardrobe.html?board=' + id + '&name=' + encodeURIComponent(board.name);

  const swatch = document.createElement('div');
  swatch.className = 'board-card-swatch';
  swatch.style.background = swatchColours[index % swatchColours.length];

  const name = document.createElement('div');
  name.className = 'board-card-name';
  name.textContent = board.name;

  card.appendChild(swatch);
  card.appendChild(name);
  return card;
}

function listenForBoards(uid) {
  const boardsQuery = query(collection(db, 'boards'), where('uid', '==', uid));

  unsubscribeFromBoards = onSnapshot(boardsQuery, function (snapshot) {
    boardsGrid.innerHTML = '';

    if (snapshot.empty) {
      boardsEmpty.style.display = 'block';
      return;
    }
    boardsEmpty.style.display = 'none';

    let index = 0;
    snapshot.forEach(function (docSnap) {
      boardsGrid.appendChild(renderBoard(docSnap.id, docSnap.data(), index));
      index++;
    });
  });
}

// Opening/closing the "new wardrobe" popup
newBoardBtn.addEventListener('click', function () {
  newBoardError.style.display = 'none';
  newBoardForm.reset();
  newBoardOverlay.classList.add('is-open');
});

newBoardClose.addEventListener('click', function () {
  newBoardOverlay.classList.remove('is-open');
});

newBoardOverlay.addEventListener('click', function (event) {
  if (event.target === newBoardOverlay) {
    newBoardOverlay.classList.remove('is-open');
  }
});

newBoardForm.addEventListener('submit', function (event) {
  event.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  addDoc(collection(db, 'boards'), {
    uid: user.uid,
    name: newBoardName.value,
    createdAt: serverTimestamp()
  })
    .then(function () {
      newBoardOverlay.classList.remove('is-open');
    })
    .catch(function (error) {
      newBoardError.textContent = error.message;
      newBoardError.style.display = 'block';
    });
});

// ---- Board detail view (the items inside one wardrobe) ----

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

itemForm.addEventListener('submit', function (event) {
  event.preventDefault();
  itemError.style.display = 'none';

  const user = auth.currentUser;
  if (!user) return;

  if (!selectedPhotoData) {
    showItemError('Please add a photo first.');
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const boardId = params.get('board');

  addDoc(collection(db, 'items'), {
    uid: user.uid,
    boardId: boardId,
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

function renderItem(id, item) {
  const card = document.createElement('div');
  card.className = 'wardrobe-item';
  card.innerHTML =
    '<img src="' + item.photo + '" alt="' + item.name + '">' +
    '<button class="wardrobe-item-delete" title="Remove">&times;</button>' +
    '<div class="wardrobe-item-name">' + item.name + '</div>' +
    '<div class="wardrobe-item-meta">' + item.category + ' · ' + item.colour + '</div>';

  card.querySelector('.wardrobe-item-delete').addEventListener('click', function () {
    deleteDoc(doc(db, 'items', id));
  });

  return card;
}

function listenForItems(uid, boardId) {
  const itemsQuery = query(
    collection(db, 'items'),
    where('uid', '==', uid),
    where('boardId', '==', boardId)
  );

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
