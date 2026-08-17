const SIDEBAR_COLLAPSE_KEY = "dam_sidebar_collapsed";

function initSidebarToggle() {
  const btn = document.getElementById("sidebar-toggle");
  if (!btn) return;

  // Default: sidebar terbuka. Hanya collapse kalau user pernah menutupnya.
  const collapsed = localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "true";
  document.body.classList.toggle("sidebar-collapsed", collapsed);

  btn.addEventListener("click", () => {
    const isCollapsed = document.body.classList.toggle("sidebar-collapsed");
    localStorage.setItem(SIDEBAR_COLLAPSE_KEY, isCollapsed ? "true" : "false");
  });
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function showToast(message, type = "success") {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function showLoading(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = '<div style="display:flex;justify-content:center;padding:40px"><div class="spinner"></div></div>';
}

// Fetch dengan auto-retry — berguna saat backend baru "bangun" dari sleep
// (mis. Render free tier) sehingga request pertama gagal/timeout.
let _coldStartToastShown = false;

async function fetchWithRetry(url, options = {}, maxRetries = 4, retryDelayMs = 4000) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return await res.json();
      if (res.status >= 500 || res.status === 0) {
        lastError = new Error(`Server error ${res.status}`);
      } else {
        let detail = "";
        try { detail = (await res.json()).detail; } catch (e) {}
        throw new Error(detail || `Request gagal (${res.status})`);
      }
    } catch (e) {
      lastError = e;
    }
    if (attempt < maxRetries) {
      if (!_coldStartToastShown) {
        _coldStartToastShown = true;
        showToast("Menghubungkan ke server, mohon tunggu sebentar...", "warning");
      }
      await new Promise(r => setTimeout(r, retryDelayMs));
    }
  }
  throw lastError;
}