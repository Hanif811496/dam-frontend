async function apiCall(endpoint, options = {}, maxRetries = 3, retryDelayMs = 4000) {
  const url = API_BASE_URL + endpoint;
  let lastError;
  let toastShown = false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res  = await fetch(url, {
        headers: { "Content-Type": "application/json", ...options.headers },
        ...options,
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) return data;

      if (res.status >= 500 && attempt < maxRetries) {
        lastError = new Error(data.detail || `Server error ${res.status}`);
      } else {
        throw new Error(data.detail || "Terjadi kesalahan");
      }
    } catch (e) {
      lastError = e;
    }

    if (attempt < maxRetries) {
      if (!toastShown && typeof showToast === "function") {
        toastShown = true;
        showToast("Menghubungkan ke server, mohon tunggu sebentar...", "warning");
      }
      await new Promise(r => setTimeout(r, retryDelayMs));
    }
  }
  throw lastError;
}

async function loginUser(email, password) {
  return apiCall("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

async function registerUser(nama, email, password) {
  return apiCall("/auth/register", {
    method: "POST",
    body: JSON.stringify({ nama, email, password }),
  });
}

async function getAssets(user_id) {
  return apiCall(`/assets/by-division?user_id=${user_id}`);
}

async function getAssetDetail(asset_id) {
  return apiCall(`/assets/${asset_id}`);
}

async function deleteAsset(asset_id) {
  return apiCall(`/assets/${asset_id}`, { method: "DELETE" });
}

async function searchAssets(user_id, q) {
  return apiCall(`/assets/${user_id}/search?q=${encodeURIComponent(q)}`);
}

async function getFolders(user_id) {
  return apiCall(`/folders?user_id=${user_id}`);
}

async function moveAssetToFolder(asset_id, to_folder_id, from_folder_id, user_id) {
  return apiCall(`/assets/${asset_id}/move-folder`, {
    method: "POST",
    body: JSON.stringify({ user_id, to_folder_id, from_folder_id: from_folder_id || null }),
  });
}

async function removeAssetFromFolder(folder_id, asset_id, user_id) {
  return apiCall(`/folders/${folder_id}/assets/${asset_id}?user_id=${user_id}`, {
    method: "DELETE",
  });
}

async function uploadAsset(user_id, file, onProgress, maxRetries = 3, retryDelayMs = 4000, target_division_id = null) {
  let lastError;
  let toastShown = false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append("user_id", user_id);
        formData.append("file", file);
        if (target_division_id) formData.append("target_division_id", target_division_id);
        const xhr = new XMLHttpRequest();
        xhr.open("POST", API_BASE_URL + "/assets/upload");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          let data = {};
          try { data = JSON.parse(xhr.responseText); } catch (e) {}
          if (xhr.status === 200) {
            resolve(data);
          } else if (xhr.status >= 500) {
            reject({ retryable: true, error: new Error(data.detail || `Server error ${xhr.status}`) });
          } else {
            reject({ retryable: false, error: new Error(data.detail || "Upload gagal") });
          }
        };
        xhr.onerror   = () => reject({ retryable: true, error: new Error("Koneksi gagal") });
        xhr.ontimeout = () => reject({ retryable: true, error: new Error("Waktu koneksi habis") });
        xhr.send(formData);
      });
    } catch (rejection) {
      lastError = rejection.error;
      if (!rejection.retryable || attempt === maxRetries) throw lastError;

      if (onProgress) onProgress(0);
      if (!toastShown && typeof showToast === "function") {
        toastShown = true;
        showToast("Koneksi ke server gagal, mencoba lagi...", "warning");
      }
      await new Promise(r => setTimeout(r, retryDelayMs));
    }
  }
  throw lastError;
}