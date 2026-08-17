async function apiCall(endpoint, options = {}, maxRetries = 3, retryDelayMs = 4000) {
  const url = API_BASE_URL + endpoint;
  let lastError;
  let toastShown = false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
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
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
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
  return apiCall(`/assets/by-division?user_id=${encodeURIComponent(user_id)}`);
}

async function getMyAssets(user_id) {
  return apiCall(`/assets?user_id=${encodeURIComponent(user_id)}`);
}

async function getAssetDetail(asset_id) {
  return apiCall(`/assets/${encodeURIComponent(asset_id)}`);
}

async function deleteAsset(asset_id, user_id) {
  return apiCall(
    `/assets/${encodeURIComponent(asset_id)}?user_id=${encodeURIComponent(user_id || "")}`,
    { method: "DELETE" }
  );
}

async function logDownload(asset_id, user_id) {
  try {
    return await apiCall(`/assets/${encodeURIComponent(asset_id)}/log-download`, {
      method: "POST",
      body: JSON.stringify({ asset_id, user_id }),
    });
  } catch (e) {
    console.error("Gagal mencatat aktivitas download:", e);
  }
}

async function searchAssets(user_id, q) {
  return apiCall(
    `/assets/${encodeURIComponent(user_id)}/search?q=${encodeURIComponent(q)}`
  );
}

async function getFolders(user_id) {
  return apiCall(`/folders?user_id=${encodeURIComponent(user_id)}`);
}

async function getFolderAssets(folder_id, user_id) {
  return apiCall(
    `/folders/${encodeURIComponent(folder_id)}/assets?user_id=${encodeURIComponent(user_id)}`
  );
}

async function getDivisions() {
  return apiCall("/divisions");
}

async function getSharedAssets(user_id) {
  return apiCall(`/assets/shared-to-me?user_id=${encodeURIComponent(user_id)}`);
}

async function shareAssetToDivision(asset_id, from_user_id, to_division_id, catatan = null) {
  return apiCall("/assets/share", {
    method: "POST",
    body: JSON.stringify({ asset_id, from_user_id, to_division_id, catatan }),
  });
}

async function shareFolderToDivision(folder_id, from_user_id, to_division_id) {
  return apiCall(`/folders/${encodeURIComponent(folder_id)}/share`, {
    method: "POST",
    body: JSON.stringify({ from_user_id, to_division_id }),
  });
}

async function moveAssetToFolder(asset_id, to_folder_id, from_folder_id, user_id) {
  return apiCall(`/assets/${encodeURIComponent(asset_id)}/move-folder`, {
    method: "POST",
    body: JSON.stringify({
      user_id,
      to_folder_id,
      from_folder_id: from_folder_id || null,
    }),
  });
}

async function removeAssetFromFolder(folder_id, asset_id, user_id) {
  return apiCall(
    `/folders/${encodeURIComponent(folder_id)}/assets/${encodeURIComponent(asset_id)}?user_id=${encodeURIComponent(user_id)}`,
    { method: "DELETE" }
  );
}

async function addAssetToFolder(folder_id, asset_id, user_id) {
  return apiCall(
    `/folders/${encodeURIComponent(folder_id)}/add-asset?asset_id=${encodeURIComponent(asset_id)}&user_id=${encodeURIComponent(user_id)}`,
    { method: "POST" }
  );
}

async function setAssetPermissions(asset_id, division_ids) {
  return apiCall("/assets/permissions", {
    method: "POST",
    body: JSON.stringify({ asset_id, division_ids }),
  });
}

async function uploadAsset(
  user_id,
  file,
  onProgress,
  maxRetries = 3,
  retryDelayMs = 4000,
  target_division_id = null
) {
  let lastError;
  let toastShown = false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append("user_id", user_id);
        formData.append("file", file);
        if (target_division_id) {
          formData.append("target_division_id", target_division_id);
        }

        const xhr = new XMLHttpRequest();
        xhr.open("POST", API_BASE_URL + "/assets/upload");

        xhr.upload.onprogress = event => {
          if (event.lengthComputable && onProgress) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        };

        xhr.onload = () => {
          let data = {};
          try {
            data = JSON.parse(xhr.responseText);
          } catch (e) {}

          if (xhr.status === 200) {
            resolve(data);
          } else if (xhr.status >= 500) {
            reject({
              retryable: true,
              error: new Error(data.detail || `Server error ${xhr.status}`),
            });
          } else {
            reject({
              retryable: false,
              error: new Error(data.detail || "Upload gagal"),
            });
          }
        };

        xhr.onerror = () =>
          reject({ retryable: true, error: new Error("Koneksi gagal") });

        xhr.ontimeout = () =>
          reject({ retryable: true, error: new Error("Waktu koneksi habis") });

        xhr.send(formData);
      });
    } catch (rejection) {
      lastError = rejection.error;

      if (!rejection.retryable || attempt === maxRetries) {
        throw lastError;
      }

      if (onProgress) onProgress(0);

      if (!toastShown && typeof showToast === "function") {
        toastShown = true;
        showToast("Koneksi ke server gagal, mencoba lagi...", "warning");
      }

      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }

  throw lastError;
}