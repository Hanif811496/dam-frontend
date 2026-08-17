// ── Detail Panel: modal/panel detail aset yang dipakai bersama ──
// oleh gallery.html dan folders.html, supaya buka detail aset
// tidak perlu pindah halaman ke detail.html.
//
// Cara pakai di halaman host:
//   <div onclick="openDetailPanel('ASSET_ID', 'namaFungsiRefresh')">...</div>
//
// 'namaFungsiRefresh' (opsional) adalah nama fungsi global (string) yang
// akan dipanggil dengan parameter asset_id setelah aset berhasil dihapus,
// supaya halaman host bisa memperbarui tampilannya sendiri (hapus dari
// grid, reload folder, dll) tanpa reload penuh.

let detailPanelAssetId      = null;
let detailPanelRefreshFn    = null;
let detailPanelCurrentAsset = null;
let detailPanelCurrentTags  = [];

function ensureDetailPanelDOM() {
  if (document.getElementById("detail-panel-overlay")) return;

  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div class="detail-panel-overlay" id="detail-panel-overlay">
      <div class="detail-panel">
        <div class="detail-panel-header">
          <div class="detail-panel-title" id="detail-panel-title">Detail Aset</div>
          <div class="detail-panel-close" onclick="closeDetailPanel()">
            <i data-lucide="x" style="width:18px;height:18px;"></i>
          </div>
        </div>
        <div class="detail-panel-body" id="detail-panel-body">
          <div style="display:flex;justify-content:center;padding:60px;">
            <div class="spinner"></div>
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrap.firstElementChild);

  document.getElementById("detail-panel-overlay").addEventListener("click", (e) => {
    if (e.target.id === "detail-panel-overlay") closeDetailPanel();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDetailPanel();
  });

  window.addEventListener("popstate", () => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) {
      openDetailPanelSilent(id);
    } else {
      closeDetailPanel(true);
    }
  });
}

function getFileIconDetail(tipe) {
  if (tipe.includes("video")) return "🎬";
  if (tipe.includes("pdf"))   return "📄";
  if (tipe.includes("word") || tipe.includes("document")) return "📝";
  if (tipe.includes("spreadsheet") || tipe.includes("excel")) return "📊";
  return "📁";
}

async function openDetailPanel(assetId, refreshFnName) {
  ensureDetailPanelDOM();
  detailPanelAssetId   = assetId;
  detailPanelRefreshFn = refreshFnName || null;

  document.getElementById("detail-panel-overlay").classList.add("open");
  document.getElementById("detail-panel-body").innerHTML =
    `<div style="display:flex;justify-content:center;padding:60px;"><div class="spinner"></div></div>`;

  const url = new URL(window.location);
  url.searchParams.set("id", assetId);
  history.pushState({ detailPanel: true, assetId }, "", url);

  await loadDetailPanel();
}

async function openDetailPanelSilent(assetId) {
  ensureDetailPanelDOM();
  detailPanelAssetId = assetId;
  document.getElementById("detail-panel-overlay").classList.add("open");
  await loadDetailPanel();
}

function closeDetailPanel(skipHistory) {
  const overlay = document.getElementById("detail-panel-overlay");
  if (overlay) overlay.classList.remove("open");
  detailPanelAssetId = null;

  const url = new URL(window.location);
  if (url.searchParams.has("id")) {
    url.searchParams.delete("id");
    if (!skipHistory) history.pushState({}, "", url);
  }
}

async function loadDetailPanel() {
  try {
    const data = await getAssetDetail(detailPanelAssetId);
    detailPanelCurrentAsset = data.asset;
    detailPanelCurrentTags  = data.tags;
    renderDetailPanel();
  } catch (err) {
    document.getElementById("detail-panel-body").innerHTML =
      `<div style="padding:20px;text-align:center;">
        <p style="color:var(--danger);margin-bottom:10px;">Gagal memuat: ${err.message}</p>
        <button class="btn btn-outline btn-sm" onclick="loadDetailPanel()">Coba Lagi</button>
      </div>`;
  }
}

function renderDetailPanel() {
  const a    = detailPanelCurrentAsset;
  const tags = detailPanelCurrentTags;
  document.getElementById("detail-panel-title").textContent = a.nama_file;

  const isImage = a.tipe_file.includes("image");
  const isVideo = a.tipe_file.includes("video");

  let previewHtml = "";
  if (isImage) {
    previewHtml = `<img src="${a.url}" alt="${a.nama_file}">`;
  } else if (isVideo) {
    previewHtml = `<video controls style="width:100%;max-height:360px;">
      <source src="${a.url}" type="${a.tipe_file}">
    </video>`;
  } else {
    previewHtml = `<div class="preview-icon-sm">${getFileIconDetail(a.tipe_file)}</div>`;
  }

  const autoTags   = tags.filter(t => t.sumber !== "manual");
  const manualTags = tags.filter(t => t.sumber === "manual");

  const autoTagsHtml = autoTags.map(t => `
    <span class="tag-pill-removable" id="dp-tag-${t.nama}">
      ${t.nama}
      <span class="sumber-badge">${t.sumber}</span>
      <span class="tag-remove" onclick="hapusTagPanel('${t.nama}')">×</span>
    </span>`).join("");

  const manualTagsHtml = manualTags.length
    ? manualTags.map(t => `
      <div class="manual-tag-row" id="dp-tag-${t.nama}">
        <div class="manual-tag-name">${t.nama}</div>
        <div class="manual-tag-by">
          <i data-lucide="user" style="width:11px;height:11px;"></i>
          ${t.added_by || "—"}
        </div>
        <span class="tag-remove" onclick="hapusTagPanel('${t.nama}')">×</span>
      </div>`).join("")
    : `<div style="font-size:12px;color:var(--text-muted);padding:6px 0;">Belum ada tag manual</div>`;

  document.getElementById("detail-panel-body").innerHTML = `
    <div class="detail-panel-preview">${previewHtml}</div>

    <div class="info-section">
      <div class="info-section-title">Informasi File</div>
      <div class="info-row">
        <span class="info-row-label">Nama file</span>
        <span class="info-row-value">${a.nama_file}</span>
      </div>
      <div class="info-row">
        <span class="info-row-label">Tipe</span>
        <span class="info-row-value">${a.tipe_file}</span>
      </div>
      <div class="info-row">
        <span class="info-row-label">Ukuran</span>
        <span class="info-row-value">${formatFileSize(a.ukuran)}</span>
      </div>
      <div class="info-row">
        <span class="info-row-label">Diupload</span>
        <span class="info-row-value">${formatDate(a.created_at)}</span>
      </div>
      <div class="info-row">
        <span class="info-row-label">Oleh</span>
        <span class="info-row-value">
          <span class="uploader-badge">
            <i data-lucide="user" style="width:11px;height:11px;"></i>
            ${a.uploader || "—"}
          </span>
        </span>
      </div>
      <div class="info-row">
        <span class="info-row-label">Divisi</span>
        <span class="info-row-value">${a.uploader_divisi || "—"}</span>
      </div>
    </div>

    <div class="info-section">
      <div class="info-section-title">Tag Otomatis (${autoTags.length})</div>
      <div class="tags-wrap" id="dp-auto-tags-wrap">${autoTagsHtml || '<div style="font-size:12px;color:var(--text-muted);">Belum ada tag otomatis</div>'}</div>
    </div>

    <div class="info-section">
      <div class="info-section-title">Tag Manual (${manualTags.length})</div>
      <div id="dp-manual-tags-wrap">${manualTagsHtml}</div>
      <div class="tag-add-row">
        <input type="text" class="input" id="dp-new-tag" placeholder="Tambah tag manual...">
        <button class="btn btn-primary btn-sm" onclick="tambahTagPanel()">Tambah</button>
      </div>
    </div>

    <div class="info-section action-row">
      <a href="${a.url}" download="${a.nama_file}" class="btn btn-primary" style="justify-content:center;">
        <i data-lucide="download" style="width:15px;height:15px;"></i> Download
      </a>
      <button class="btn btn-danger" style="justify-content:center;" onclick="hapusAsetPanel()">
        <i data-lucide="trash-2" style="width:15px;height:15px;"></i> Hapus Aset
      </button>
    </div>
  `;

  const tagInput = document.getElementById("dp-new-tag");
  tagInput.addEventListener("keydown", (e) => { if (e.key === "Enter") tambahTagPanel(); });

  lucide.createIcons();
}

async function tambahTagPanel() {
  const input = document.getElementById("dp-new-tag");
  const nama  = input.value.trim().toLowerCase();
  if (!nama) return;
  try {
    await fetchWithRetry(`${API_BASE_URL}/assets/${detailPanelAssetId}/tags`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({nama_tag: nama, sumber: "manual", user_id: user.user_id})
    });
    input.value = "";
    await loadDetailPanel();
    showToast("Tag ditambahkan");
  } catch (err) {
    showToast("Gagal menambah tag", "error");
  }
}

async function hapusTagPanel(nama_tag) {
  try {
    await fetchWithRetry(`${API_BASE_URL}/assets/${detailPanelAssetId}/tags/${encodeURIComponent(nama_tag)}`, {
      method: "DELETE"
    });
    await loadDetailPanel();
    showToast("Tag dihapus");
  } catch (err) {
    showToast("Gagal menghapus tag", "error");
  }
}

async function hapusAsetPanel() {
  if (!confirm("Yakin ingin menghapus aset ini? Tindakan tidak bisa dibatalkan.")) return;
  const deletedId = detailPanelAssetId;
  try {
    await deleteAsset(deletedId);
    showToast("Aset dihapus");
    closeDetailPanel();
    if (detailPanelRefreshFn && typeof window[detailPanelRefreshFn] === "function") {
      window[detailPanelRefreshFn](deletedId);
    }
  } catch (err) {
    showToast("Gagal menghapus: " + err.message, "error");
  }
}

// Kalau halaman dibuka langsung dengan ?id=xxx di URL (misal dari
// link/bookmark), otomatis buka panel-nya begitu halaman selesai load.
function initDetailPanelFromURL() {
  const id = new URLSearchParams(window.location.search).get("id");
  if (id) openDetailPanelSilent(id);
}