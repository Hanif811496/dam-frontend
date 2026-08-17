async function apiCall(endpoint, options = {}, maxRetries = 3, retryDelayMs = 4000) {
  const url = API_BASE_URL + endpoint;
  let lastError;
  let toastShown = false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
        ...options,
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        return data;
      }

      const error = new Error(
        data.detail ||
        data.message ||
        `Request gagal (${res.status})`
      );

      error.status = res.status;
      error.data = data;

      if (res.status >= 500 && attempt < maxRetries) {
        lastError = error;
      } else {
        throw error;
      }

    } catch (err) {
      lastError = err;

      if (
        err?.status &&
        err.status < 500
      ) {
        throw err;
      }
    }

    if (attempt < maxRetries) {
      if (
        !toastShown &&
        typeof showToast === "function"
      ) {
        toastShown = true;

        showToast(
          "Menghubungkan ke server, mohon tunggu sebentar...",
          "warning"
        );
      }

      await new Promise(resolve =>
        setTimeout(resolve, retryDelayMs)
      );
    }
  }

  throw lastError;
}


// ======================================================
// AUTH
// ======================================================

async function loginUser(email, password) {
  return apiCall("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
    }),
  });
}


async function registerUser(nama, email, password) {
  return apiCall("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      nama,
      email,
      password,
    }),
  });
}


// ======================================================
// ASSETS
// ======================================================

async function getAssets(user_id) {
  return apiCall(
    `/assets/by-division?user_id=${encodeURIComponent(user_id)}`
  );
}


async function getMyAssets(user_id) {
  return apiCall(
    `/assets?user_id=${encodeURIComponent(user_id)}`
  );
}


async function getAssetDetail(asset_id) {
  return apiCall(
    `/assets/${encodeURIComponent(asset_id)}`
  );
}


async function deleteAsset(asset_id, user_id) {
  return apiCall(
    `/assets/${encodeURIComponent(asset_id)}?user_id=${encodeURIComponent(user_id || "")}`,
    {
      method: "DELETE",
    }
  );
}


async function logDownload(asset_id, user_id) {
  try {
    return await apiCall(
      `/assets/${encodeURIComponent(asset_id)}/log-download`,
      {
        method: "POST",
        body: JSON.stringify({
          asset_id,
          user_id,
        }),
      }
    );
  } catch (err) {
    console.error(
      "Gagal mencatat aktivitas download:",
      err
    );
  }
}


async function searchAssets(user_id, query) {
  return apiCall(
    `/assets/${encodeURIComponent(user_id)}/search?q=${encodeURIComponent(query)}`
  );
}


async function setAssetPermissions(
  asset_id,
  division_ids
) {
  return apiCall(
    "/assets/permissions",
    {
      method: "POST",
      body: JSON.stringify({
        asset_id,
        division_ids,
      }),
    }
  );
}


// ======================================================
// ASSET SHARE
// ======================================================

async function getSharedAssets(user_id) {
  return apiCall(
    `/assets/shared-to-me?user_id=${encodeURIComponent(user_id)}`
  );
}


async function getSharedByMe(user_id) {
  return apiCall(
    `/assets/shared-by-me?user_id=${encodeURIComponent(user_id)}`
  );
}


async function getUnreadShares(user_id) {
  return apiCall(
    `/assets/unread-shares?user_id=${encodeURIComponent(user_id)}`
  );
}


async function shareAssetToDivision(
  asset_id,
  from_user_id,
  to_division_id,
  catatan = null
) {
  return apiCall(
    "/assets/share",
    {
      method: "POST",
      body: JSON.stringify({
        asset_id,
        from_user_id,
        to_division_id,
        catatan,
      }),
    }
  );
}


async function markShareRead(share_id) {
  return apiCall(
    `/assets/share/${encodeURIComponent(share_id)}/read`,
    {
      method: "PUT",
    }
  );
}


// ======================================================
// UPLOAD
// ======================================================

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

  for (
    let attempt = 0;
    attempt <= maxRetries;
    attempt++
  ) {
    try {
      return await new Promise(
        (resolve, reject) => {
          const formData =
            new FormData();

          formData.append(
            "user_id",
            user_id
          );

          formData.append(
            "file",
            file
          );

          if (target_division_id) {
            formData.append(
              "target_division_id",
              target_division_id
            );
          }

          const xhr =
            new XMLHttpRequest();

          xhr.open(
            "POST",
            API_BASE_URL +
            "/assets/upload"
          );

          xhr.upload.onprogress =
            event => {
              if (
                event.lengthComputable &&
                typeof onProgress ===
                "function"
              ) {
                const percent =
                  Math.round(
                    (
                      event.loaded /
                      event.total
                    ) * 100
                  );

                onProgress(percent);
              }
            };

          xhr.onload = () => {
            let data = {};

            try {
              data = JSON.parse(
                xhr.responseText
              );
            } catch (err) {}

            if (
              xhr.status >= 200 &&
              xhr.status < 300
            ) {
              resolve(data);
              return;
            }

            if (
              xhr.status >= 500
            ) {
              reject({
                retryable: true,
                error: new Error(
                  data.detail ||
                  `Server error ${xhr.status}`
                ),
              });

              return;
            }

            reject({
              retryable: false,
              error: new Error(
                data.detail ||
                "Upload gagal"
              ),
            });
          };

          xhr.onerror = () => {
            reject({
              retryable: true,
              error: new Error(
                "Koneksi gagal"
              ),
            });
          };

          xhr.ontimeout = () => {
            reject({
              retryable: true,
              error: new Error(
                "Waktu koneksi habis"
              ),
            });
          };

          xhr.send(formData);
        }
      );

    } catch (rejection) {
      lastError =
        rejection.error ||
        rejection;

      if (
        rejection.retryable === false ||
        attempt === maxRetries
      ) {
        throw lastError;
      }

      if (
        typeof onProgress ===
        "function"
      ) {
        onProgress(0);
      }

      if (
        !toastShown &&
        typeof showToast ===
        "function"
      ) {
        toastShown = true;

        showToast(
          "Koneksi ke server gagal, mencoba lagi...",
          "warning"
        );
      }

      await new Promise(resolve =>
        setTimeout(
          resolve,
          retryDelayMs
        )
      );
    }
  }

  throw lastError;
}


// ======================================================
// FOLDERS
// ======================================================

async function getFolders(user_id) {
  return apiCall(
    `/folders?user_id=${encodeURIComponent(user_id)}`
  );
}


async function getFolderAssets(
  folder_id,
  user_id
) {
  return apiCall(
    `/folders/${encodeURIComponent(folder_id)}/assets?user_id=${encodeURIComponent(user_id)}`
  );
}


async function createFolder(
  nama,
  user_id,
  parent_id = null
) {
  return apiCall(
    "/folders",
    {
      method: "POST",
      body: JSON.stringify({
        nama,
        user_id,
        parent_id,
      }),
    }
  );
}


async function createSmartFolder({
  nama,
  user_id,
  parent_id = null,
  target_division_id = null,
  division_ids = [],
}) {
  return apiCall(
    "/folders/smart",
    {
      method: "POST",
      body: JSON.stringify({
        nama,
        user_id,
        parent_id,
        target_division_id,
        division_ids,
      }),
    }
  );
}


async function deleteFolder(
  folder_id,
  user_id = null
) {
  let endpoint =
    `/folders/${encodeURIComponent(folder_id)}`;

  if (user_id) {
    endpoint +=
      `?user_id=${encodeURIComponent(user_id)}`;
  }

  return apiCall(
    endpoint,
    {
      method: "DELETE",
    }
  );
}


// ======================================================
// NESTED SMART FOLDERS
// ======================================================

async function moveFolder(
  folder_id,
  user_id,
  parent_id = null
) {
  return apiCall(
    `/folders/${encodeURIComponent(folder_id)}/move`,
    {
      method: "PUT",
      body: JSON.stringify({
        user_id,
        parent_id,
      }),
    }
  );
}


// ======================================================
// ASSET <-> FOLDER
// ======================================================

async function addAssetToFolder(
  folder_id,
  asset_id,
  user_id
) {
  return apiCall(
    `/folders/${encodeURIComponent(folder_id)}/add-asset?asset_id=${encodeURIComponent(asset_id)}&user_id=${encodeURIComponent(user_id)}`,
    {
      method: "POST",
    }
  );
}


async function removeAssetFromFolder(
  folder_id,
  asset_id,
  user_id
) {
  return apiCall(
    `/folders/${encodeURIComponent(folder_id)}/assets/${encodeURIComponent(asset_id)}?user_id=${encodeURIComponent(user_id)}`,
    {
      method: "DELETE",
    }
  );
}


async function moveAssetToFolder(
  asset_id,
  to_folder_id,
  from_folder_id,
  user_id
) {
  return apiCall(
    `/assets/${encodeURIComponent(asset_id)}/move-folder`,
    {
      method: "POST",
      body: JSON.stringify({
        user_id,
        to_folder_id,
        from_folder_id:
          from_folder_id || null,
      }),
    }
  );
}


// ======================================================
// FOLDER SHARING
// ======================================================

async function shareFolderToDivision(
  folder_id,
  from_user_id,
  to_division_id
) {
  return apiCall(
    `/folders/${encodeURIComponent(folder_id)}/share`,
    {
      method: "POST",
      body: JSON.stringify({
        from_user_id,
        to_division_id,
      }),
    }
  );
}


async function getFolderAccess(
  folder_id
) {
  return apiCall(
    `/folders/${encodeURIComponent(folder_id)}/access`
  );
}


async function setFolderAccess(
  folder_id,
  user_ids,
  granted_by
) {
  return apiCall(
    `/folders/${encodeURIComponent(folder_id)}/access`,
    {
      method: "POST",
      body: JSON.stringify({
        user_ids,
        granted_by,
      }),
    }
  );
}


async function removeFolderAccess(
  folder_id,
  user_id
) {
  return apiCall(
    `/folders/${encodeURIComponent(folder_id)}/access/${encodeURIComponent(user_id)}`,
    {
      method: "DELETE",
    }
  );
}


// ======================================================
// FOLDER DIVISION ACCESS
// ======================================================

async function getFolderDivisions(
  folder_id
) {
  return apiCall(
    `/folders/${encodeURIComponent(folder_id)}/divisions`
  );
}


async function setFolderDivisions(
  folder_id,
  division_ids,
  granted_by
) {
  return apiCall(
    `/folders/${encodeURIComponent(folder_id)}/divisions`,
    {
      method: "POST",
      body: JSON.stringify({
        division_ids,
        granted_by,
      }),
    }
  );
}


// ======================================================
// AUTO ASSIGN RULES
// ======================================================

async function getFolderRules(
  user_id,
  folder_id = null
) {
  let endpoint =
    `/folders/rules?user_id=${encodeURIComponent(user_id)}`;

  if (folder_id) {
    endpoint +=
      `&folder_id=${encodeURIComponent(folder_id)}`;
  }

  return apiCall(endpoint);
}


async function createFolderRule(
  user_id,
  keyword,
  folder_id
) {
  return apiCall(
    "/folders/rules",
    {
      method: "POST",
      body: JSON.stringify({
        user_id,
        keyword,
        folder_id,
      }),
    }
  );
}


async function createFolderRulesBatch(
  user_id,
  keywords,
  folder_id
) {
  return apiCall(
    "/folders/rules/batch",
    {
      method: "POST",
      body: JSON.stringify({
        user_id,
        keywords,
        folder_id,
      }),
    }
  );
}


async function deleteFolderRule(
  rule_id
) {
  return apiCall(
    `/folders/rules/${encodeURIComponent(rule_id)}`,
    {
      method: "DELETE",
    }
  );
}


function parseRuleKeywords(
  rawValue
) {
  if (!rawValue) {
    return [];
  }

  const values =
    String(rawValue)
      .split(/[,\s;\n]+/)
      .map(value =>
        value
          .trim()
          .toLowerCase()
      )
      .filter(Boolean);

  return [
    ...new Set(values)
  ];
}


/*
 * Helper internal.
 *
 * Parameter:
 * user_id
 * rawKeywords
 * folder_id
 */
async function createMultipleFolderRules(
  user_id,
  rawKeywords,
  folder_id
) {
  const keywords =
    Array.isArray(rawKeywords)
      ? [
          ...new Set(
            rawKeywords
              .map(value =>
                String(value)
                  .trim()
                  .toLowerCase()
              )
              .filter(Boolean)
          ),
        ]
      : parseRuleKeywords(
          rawKeywords
        );

  if (!keywords.length) {
    return {
      rules: [],
      skipped: [],
      failed: [],
    };
  }

  /*
   * Backend terbaru punya endpoint:
   *
   * POST /folders/rules/batch
   *
   * body:
   * {
   *   user_id,
   *   keywords,
   *   folder_id
   * }
   */
  try {
    const result =
      await createFolderRulesBatch(
        user_id,
        keywords,
        folder_id
      );

    return {
      rules:
        result.rules || [],

      skipped:
        result.skipped || [],

      failed: [],
    };

  } catch (batchError) {
    /*
     * Fallback untuk backend yang
     * belum punya endpoint batch.
     */
    const rules = [];
    const skipped = [];
    const failed = [];

    for (
      const keyword
      of keywords
    ) {
      try {
        const result =
          await createFolderRule(
            user_id,
            keyword,
            folder_id
          );

        if (
          result &&
          result.duplicate
        ) {
          skipped.push(
            keyword
          );

          continue;
        }

        rules.push(
          result?.rule ||
          result
        );

      } catch (error) {
        failed.push({
          keyword,
          error:
            error?.message ||
            "Gagal menambahkan rule",
        });
      }
    }

    return {
      rules,
      skipped,
      failed,
    };
  }
}


/*
 * IMPORTANT
 * =========
 *
 * folders.html memanggil:
 *
 * addFolderRules(
 *   user_id,
 *   folder_id,
 *   keywords
 * )
 *
 * Jadi urutan parameter fungsi ini
 * HARUS:
 *
 * 1. user_id
 * 2. folder_id
 * 3. rawKeywords
 */
async function addFolderRules(
  user_id,
  folder_id,
  rawKeywords
) {
  return createMultipleFolderRules(
    user_id,
    rawKeywords,
    folder_id
  );
}


// ======================================================
// FOLDER PREDICTION
// ======================================================

async function predictAssetFolders(
  asset_id,
  division_ids = []
) {
  return apiCall(
    `/assets/${encodeURIComponent(asset_id)}/predict-folders`,
    {
      method: "POST",
      body: JSON.stringify({
        division_ids,
      }),
    }
  );
}


// ======================================================
// DIVISIONS
// ======================================================

async function getDivisions() {
  return apiCall(
    "/divisions"
  );
}


async function getUserDivision(
  user_id
) {
  return apiCall(
    `/divisions/user/${encodeURIComponent(user_id)}`
  );
}


async function getAllUsersWithDivision() {
  return apiCall(
    "/divisions/users"
  );
}


async function assignDivision(
  user_id,
  division_id
) {
  return apiCall(
    `/divisions/assign?user_id=${encodeURIComponent(user_id)}&division_id=${encodeURIComponent(division_id)}`,
    {
      method: "POST",
    }
  );
}


// ======================================================
// TAGS
// ======================================================

async function getTags(
  user_id
) {
  return apiCall(
    `/tags?user_id=${encodeURIComponent(user_id)}`
  );
}


async function getTagCount(
  user_id
) {
  return apiCall(
    `/tags/count?user_id=${encodeURIComponent(user_id)}`
  );
}


async function getTopTags(
  user_id,
  limit = 7
) {
  return apiCall(
    `/tags/top?user_id=${encodeURIComponent(user_id)}&limit=${encodeURIComponent(limit)}`
  );
}


async function addAssetTag(
  asset_id,
  nama_tag,
  sumber = "manual",
  user_id = null
) {
  return apiCall(
    `/assets/${encodeURIComponent(asset_id)}/tags`,
    {
      method: "POST",
      body: JSON.stringify({
        nama_tag,
        sumber,
        user_id,
      }),
    }
  );
}


async function deleteAssetTag(
  asset_id,
  nama_tag,
  user_id = null
) {
  let endpoint =
    `/assets/${encodeURIComponent(asset_id)}/tags/${encodeURIComponent(nama_tag)}`;

  if (user_id) {
    endpoint +=
      `?user_id=${encodeURIComponent(user_id)}`;
  }

  return apiCall(
    endpoint,
    {
      method: "DELETE",
    }
  );
}


// ======================================================
// PROFILE
// ======================================================

async function updateProfile(
  user_id,
  nama
) {
  return apiCall(
    `/profile/${encodeURIComponent(user_id)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        nama,
      }),
    }
  );
}


async function updatePassword(
  user_id,
  password_lama,
  password_baru
) {
  return apiCall(
    `/profile/${encodeURIComponent(user_id)}/password`,
    {
      method: "PUT",
      body: JSON.stringify({
        password_lama,
        password_baru,
      }),
    }
  );
}


// ======================================================
// ADMIN
// ======================================================

async function adminUpdateUser(
  user_id,
  {
    nama = null,
    password_baru = null,
  } = {}
) {
  return apiCall(
    `/admin/users/${encodeURIComponent(user_id)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        nama,
        password_baru,
      }),
    }
  );
}


async function adminDeleteUser(
  user_id
) {
  return apiCall(
    `/admin/users/${encodeURIComponent(user_id)}`,
    {
      method: "DELETE",
    }
  );
}


async function getAdminActivity(
  params = {}
) {
  const query =
    new URLSearchParams();

  Object.entries(params)
    .forEach(
      ([key, value]) => {
        if (
          value !== undefined &&
          value !== null &&
          value !== ""
        ) {
          query.append(
            key,
            value
          );
        }
      }
    );

  const suffix =
    query.toString()
      ? `?${query.toString()}`
      : "";

  return apiCall(
    `/admin/activity${suffix}`
  );
}


async function getAdminAssetReport() {
  return apiCall(
    "/admin/report/assets"
  );
}


async function getAdminDivisionReport() {
  return apiCall(
    "/admin/report/divisions"
  );
}