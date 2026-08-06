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

async function uploadAsset(user_id, file, onProgress) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("user_id", user_id);
    formData.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", API_BASE_URL + "/assets/upload");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      const data = JSON.parse(xhr.responseText);
      if (xhr.status === 200) resolve(data);
      else reject(new Error(data.detail || "Upload gagal"));
    };
    xhr.onerror = () => reject(new Error("Koneksi gagal"));
    xhr.send(formData);
  });
}