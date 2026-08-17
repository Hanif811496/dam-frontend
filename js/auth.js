const TOKEN_KEY = "dam_user";
const MANAGER_ID = "79732e94-d800-4b11-ad92-74e594f1b54b";

const DIVISION_TOPBAR_META = {
  "Manager":       { className: "navbar-div-manager",  icon: "shield-check" },
  "Design Artist": { className: "navbar-div-design",   icon: "palette" },
  "3D Modeler":    { className: "navbar-div-3d",       icon: "box" },
  "Animator":      { className: "navbar-div-animator", icon: "sparkles" },
  "Editor":        { className: "navbar-div-editor",   icon: "clapperboard" },
  "Render Artist": { className: "navbar-div-render",   icon: "aperture" },
  "Custom":        { className: "navbar-div-custom",   icon: "users" },
};

function saveUser(data) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(data));
}

function getUser() {
  const data = localStorage.getItem(TOKEN_KEY);
  return data ? JSON.parse(data) : null;
}

function removeUser() {
  localStorage.removeItem(TOKEN_KEY);
}

function isLoggedIn() {
  return getUser() !== null;
}

function isManager() {
  const user = getUser();
  return user && user.division_id === MANAGER_ID;
}

function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = "../pages/login.html";
  }
}

function requireManager() {
  if (!isLoggedIn()) {
    window.location.href = "../pages/login.html";
    return;
  }
  if (!isManager()) {
    window.location.href = "../pages/gallery.html";
  }
}

function logout() {
  removeUser();
  window.location.href = "../pages/login.html";
}

function getUserDivisionName(user = getUser()) {
  if (!user) return "";

  return String(
    user.division_nama ||
    user.division?.nama ||
    user.divisions?.nama ||
    user.division?.divisions?.nama ||
    ""
  ).trim();
}

function getDivisionTopbarMeta(divisionName) {
  return DIVISION_TOPBAR_META[divisionName] || {
    className: "navbar-div-generic",
    icon: "layers-3",
  };
}

function renderTopbarUser(user = getUser()) {
  if (!user) return;

  const nameEl = document.getElementById("user-name");
  if (!nameEl) return;

  const navbarRight = nameEl.parentElement;
  if (!navbarRight) return;

  let identity = document.getElementById("navbar-user-identity");

  if (!identity) {
    identity = document.createElement("div");
    identity.id = "navbar-user-identity";
    identity.className = "navbar-user-identity";

    navbarRight.insertBefore(identity, nameEl);
    identity.appendChild(nameEl);
  }

  nameEl.textContent = user.nama || "User";
  nameEl.classList.add("navbar-user-name");
  nameEl.style.fontSize = "";
  nameEl.style.color = "";

  const divisionName = getUserDivisionName(user);
  let badge = document.getElementById("user-division-badge");

  if (!divisionName) {
    if (badge) badge.remove();
    return;
  }

  const meta = getDivisionTopbarMeta(divisionName);

  if (!badge) {
    badge = document.createElement("span");
    badge.id = "user-division-badge";
    identity.appendChild(badge);
  }

  badge.className = `navbar-division-badge ${meta.className}`;
  badge.title = `Divisi: ${divisionName}`;
  badge.innerHTML = `
    <span class="navbar-division-logo" aria-hidden="true">
      <i data-lucide="${meta.icon}"></i>
    </span>
    <span>${divisionName}</span>
  `;

  if (window.lucide?.createIcons) {
    lucide.createIcons();
  }
}

async function loadUserDivision(force = false) {
  const user = getUser();
  if (!user) return null;

  if (!force && user.division_id && user.division_nama) {
    renderTopbarUser(user);
    return user;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/divisions/user/${encodeURIComponent(user.user_id)}`);
    if (!res.ok) throw new Error(`Gagal memuat divisi (${res.status})`);

    const data = await res.json();

    if (data.division) {
      user.division_id = data.division.division_id || "";
      user.division_nama = data.division.divisions?.nama || "";
      saveUser(user);
    }
  } catch (e) {
    console.error("Gagal memuat divisi user:", e);
  }

  renderTopbarUser(getUser());
  return getUser();
}

async function hydrateTopbarUser() {
  const user = getUser();
  if (!user) return;

  // Nama langsung tampil dari localStorage, badge divisi menyusul bila data lama
  // belum menyimpan division_nama.
  renderTopbarUser(user);
  await loadUserDivision(false);
}

function redirectAfterLogin() {
  if (isManager()) {
    window.location.href = "dashboard.html";
  } else {
    window.location.href = "gallery.html";
  }
}
