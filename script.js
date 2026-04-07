const ADMIN_UID = "frVpUq0MugTsjY2G8W33ETABcr63";

const firebaseConfig = {
  apiKey: "AIzaSyDEjq4244oB0enW11NFQDbmdpSsJSOiUKk",
  authDomain: "xarita-c567b.firebaseapp.com",
  projectId: "xarita-c567b",
  storageBucket: "xarita-c567b.firebasestorage.app",
  messagingSenderId: "766862887081",
  appId: "1:766862887081:web:92d580b836f541707381b8",
  databaseURL: "https://xarita-c567b-default-rtdb.asia-southeast1.firebasedatabase.app",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const rtdb = firebase.database();
const provider = new firebase.auth.GoogleAuthProvider();

let allUsers = [];
let filterMode = "all";
let searchQuery = "";
let pendingAction = null;
let usersUnsub = null;
let rtdbStatusRef = null;
let rtdbStatusCache = {};

document.getElementById("adminLoginBtn").addEventListener("click", () => {
  auth.signInWithPopup(provider).catch(console.error);
});

document.getElementById("adminLogoutBtn").addEventListener("click", () => {
  auth.signOut();
});

auth.onAuthStateChanged((user) => {
  if (user && user.uid === ADMIN_UID) {
    document.getElementById("loginWall").style.display = "none";
    document.getElementById("adminApp").style.display = "block";
    document.getElementById("adminNameEl").textContent = user.displayName || user.email;
    loadUsers();
  } else if (user && user.uid !== ADMIN_UID) {
    auth.signOut();
    alert("Bu sahifaga kirish huquqingiz yo'q.");
  } else {
    cleanupListeners();
    document.getElementById("loginWall").style.display = "flex";
    document.getElementById("adminApp").style.display = "none";
  }
});

function cleanupListeners() {
  if (usersUnsub) {
    usersUnsub();
    usersUnsub = null;
  }

  if (rtdbStatusRef) {
    rtdbStatusRef.off();
    rtdbStatusRef = null;
  }

  allUsers = [];
  rtdbStatusCache = {};
}

function loadUsers() {
  cleanupListeners();

  usersUnsub = db.collection("users").onSnapshot((snap) => {
    allUsers = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return bTime - aTime;
      });

    updateStats();
    renderTable();
  });

  rtdbStatusRef = rtdb.ref("status");
  rtdbStatusRef.on("value", (snapshot) => {
    rtdbStatusCache = snapshot.val() || {};
    console.log("Admin RTDB status:", rtdbStatusCache);
    updateStats();
    renderTable();
  }, (error) => {
    console.error("RTDB status o'qishda xatolik:", error);
  });
}

function isOnline(user) {
  if (user.blocked) return false;
  return rtdbStatusCache[user.id]?.online === true;
}

function getLastSeen(user) {
  const status = rtdbStatusCache[user.id];
  if (!status?.lastSeen) return null;
  return new Date(status.lastSeen);
}

function formatLastSeen(date) {
  if (!date) return "";
  const now = Date.now();
  const diff = now - date.getTime();
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(diff / 3600000);

  if (diff < 60000) return "hozirgina";
  if (min < 60) return `${min} daqiqa oldin`;
  if (hr < 24) return `${hr} soat oldin`;
  return date.toLocaleDateString("uz-UZ", { day: "2-digit", month: "short" });
}

function updateStats() {
  document.getElementById("statTotal").textContent = allUsers.length;
  document.getElementById("statOnline").textContent = allUsers.filter((u) => isOnline(u)).length;
  document.getElementById("statBlocked").textContent = allUsers.filter((u) => u.blocked).length;
  document.getElementById("statNickname").textContent = allUsers.filter((u) => u.nickname).length;
}

function renderTable() {
  const tbody = document.getElementById("usersTableBody");
  let users = [...allUsers];

  if (filterMode === "online") users = users.filter((u) => isOnline(u));
  if (filterMode === "blocked") users = users.filter((u) => u.blocked);

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    users = users.filter((u) =>
      (u.name || "").toLowerCase().includes(q) ||
      (u.nickname || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q)
    );
  }

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Foydalanuvchi topilmadi</td></tr>`;
    return;
  }

  tbody.innerHTML = "";

  users.forEach((user) => {
    const tr = document.createElement("tr");
    if (user.blocked) tr.classList.add("blocked-row");

    const createdAt = user.createdAt?.toDate
      ? user.createdAt.toDate().toLocaleDateString("uz-UZ", { day: "2-digit", month: "short", year: "numeric" })
      : "—";

    const online = isOnline(user);
    const lastSeen = getLastSeen(user);

    let statusBadge;
    if (user.blocked) {
      statusBadge = `<span class="badge badge-blocked">Bloklangan</span>`;
    } else if (online) {
      statusBadge = `<span class="badge badge-online">Online</span>`;
    } else {
      const ls = lastSeen
        ? `<div class="last-seen">${formatLastSeen(lastSeen)}</div>`
        : `<div class="last-seen">ko'rinmadi</div>`;
      statusBadge = `<span class="badge badge-offline">Offline</span>${ls}`;
    }

    let actionCell = `<span style="color:#636366;font-size:12px;">Admin</span>`;
    if (user.id !== ADMIN_UID) {
      const primaryAction = user.blocked
        ? `<button class="action-btn unblock-btn" data-uid="${user.id}" data-name="${escAttr(user.name || user.email)}">Blokdan chiqarish</button>`
        : `<button class="action-btn block-btn" data-uid="${user.id}" data-name="${escAttr(user.name || user.email)}">Bloklash</button>`;

      actionCell = `
        <div class="action-group">
          ${primaryAction}
          <button class="action-btn delete-btn" data-uid="${user.id}" data-name="${escAttr(user.name || user.email)}">O'chirish</button>
        </div>`;
    }

    tr.innerHTML = `
      <td>
        <div class="user-cell">
          <div class="user-avatar" style="background-image:url(${user.photo || ""});background-size:cover;"></div>
          <div>
            <div class="user-name">${esc(user.name || "Noma'lum")}</div>
            <div class="user-email">${esc(user.email || "")}</div>
          </div>
        </div>
      </td>
      <td class="nickname-cell">${user.nickname ? "@" + esc(user.nickname) : "<span style='color:#3a3a3c'>—</span>"}</td>
      <td class="location-cell">${user.location?.city ? esc(user.location.city) : "<span style='color:#3a3a3c'>—</span>"}</td>
      <td>${statusBadge}</td>
      <td class="date-cell">${createdAt}</td>
      <td>${actionCell}</td>`;

    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".block-btn").forEach((btn) => {
    btn.addEventListener("click", () => showConfirm("block", btn.dataset.uid, btn.dataset.name));
  });

  tbody.querySelectorAll(".unblock-btn").forEach((btn) => {
    btn.addEventListener("click", () => showConfirm("unblock", btn.dataset.uid, btn.dataset.name));
  });

  tbody.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => showConfirm("delete", btn.dataset.uid, btn.dataset.name));
  });
}

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escAttr(str) {
  return String(str || "")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showConfirm(action, uid, name) {
  pendingAction = { uid, name, action };

  const confirmIcon = document.getElementById("confirmIcon");
  const confirmTitle = document.getElementById("confirmTitle");
  const confirmDesc = document.getElementById("confirmDesc");
  const confirmOk = document.getElementById("confirmOk");

  if (action === "block") {
    confirmIcon.textContent = "⛔";
    confirmTitle.textContent = "Hisobni bloklash";
    confirmDesc.innerHTML = `<b>${esc(name)}</b> foydalanuvchisini bloklaysizmi?<br><br>Bloklangandan keyin bu odam saytdan avtomatik chiqadi va qayta kira olmaydi.`;
    confirmOk.textContent = "Bloklash";
    confirmOk.className = "confirm-ok";
  } else if (action === "unblock") {
    confirmIcon.textContent = "✅";
    confirmTitle.textContent = "Blokdan chiqarish";
    confirmDesc.innerHTML = `<b>${esc(name)}</b> foydalanuvchisini blokdan chiqarasizmi?<br><br>Bu odam yana saytga kira oladi.`;
    confirmOk.textContent = "Blokdan chiqarish";
    confirmOk.className = "confirm-ok unblock";
  } else {
    confirmIcon.textContent = "🗑";
    confirmTitle.textContent = "Hisobni o'chirish";
    confirmDesc.innerHTML = `<b>${esc(name)}</b> foydalanuvchisini butunlay o'chirasizmi?<br><br>Bu amal user hujjatini, nickname'ni, do'stliklarni, so'rovlarni va statusini o'chiradi. Keyin shu Google account bilan yana kirsa, noldan yangi akkaunt ochiladi.`;
    confirmOk.textContent = "O'chirish";
    confirmOk.className = "confirm-ok delete";
  }

  document.getElementById("confirmOverlay").classList.add("visible");
}

document.getElementById("confirmCancel").addEventListener("click", closeConfirm);
document.getElementById("confirmOverlay").addEventListener("click", (e) => {
  if (e.target === document.getElementById("confirmOverlay")) closeConfirm();
});

function closeConfirm() {
  document.getElementById("confirmOverlay").classList.remove("visible");
  pendingAction = null;
}

document.getElementById("confirmOk").addEventListener("click", async () => {
  if (!pendingAction) return;

  const { uid, action } = pendingAction;
  const btn = document.getElementById("confirmOk");
  btn.disabled = true;
  btn.textContent = "Jarayonda...";

  try {
    if (action === "block") {
      await blockUser(uid);
    } else if (action === "unblock") {
      await unblockUser(uid);
    } else if (action === "delete") {
      await deleteUserCompletely(uid);
    }
  } catch (e) {
    alert("Xatolik: " + e.message);
  }

  btn.disabled = false;
  closeConfirm();
});

async function blockUser(uid) {
  const userRef = db.collection("users").doc(uid);

  await userRef.set({
    blocked: true,
    online: false,
    location: null,
    blockedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  await rtdb.ref(`/status/${uid}`).set({
    online: false,
    lastSeen: firebase.database.ServerValue.TIMESTAMP,
  });
}

async function unblockUser(uid) {
  await db.collection("users").doc(uid).set({
    blocked: false,
    blockedAt: null,
  }, { merge: true });
}

async function deleteUserCompletely(uid) {
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.data() || {};

  if (userData.nickname) {
    await db.collection("nicknames").doc(userData.nickname).delete().catch(() => {});
  }

  const friendRequestsFrom = await db.collection("friendRequests").where("from", "==", uid).get();
  const friendRequestsTo = await db.collection("friendRequests").where("to", "==", uid).get();
  const friendsSnap = await db.collection("friends").where("users", "array-contains", uid).get();

  const deletePromises = [];

  friendRequestsFrom.forEach((doc) => deletePromises.push(doc.ref.delete()));
  friendRequestsTo.forEach((doc) => deletePromises.push(doc.ref.delete()));
  friendsSnap.forEach((doc) => deletePromises.push(doc.ref.delete()));

  deletePromises.push(userRef.delete().catch(() => {}));
  deletePromises.push(rtdb.ref(`/status/${uid}`).remove().catch(() => {}));
  deletePromises.push(db.collection("deletedUsers").doc(uid).delete().catch(() => {}));

  await Promise.all(deletePromises);
}

document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    filterMode = btn.dataset.filter;
    renderTable();
  });
});

document.getElementById("adminSearch").addEventListener("input", (e) => {
  searchQuery = e.target.value.trim();
  renderTable();
});
