const TOKEN_KEY = "dam_user";

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

function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = "../pages/login.html";
  }
}

function logout() {
  removeUser();
  window.location.href = "../pages/login.html";
}