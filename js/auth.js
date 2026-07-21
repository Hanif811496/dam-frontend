const TOKEN_KEY = "dam_user";
const MANAGER_ID = "79732e94-d800-4b11-ad92-74e594f1b54b";

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

async function loadUserDivision() {
  const user = getUser();
  if (!user || user.division_id) return;
  try {
    const res  = await fetch(`${API_BASE_URL}/divisions/user/${user.user_id}`);
    const data = await res.json();
    if (data.division) {
      user.division_id   = data.division.division_id;
      user.division_nama = data.division.divisions?.nama || "";
      saveUser(user);
    }
  } catch (e) { console.error(e); }
}

function redirectAfterLogin() {
  if (isManager()) {
    window.location.href = "dashboard.html";
  } else {
    window.location.href = "gallery.html";
  }
}