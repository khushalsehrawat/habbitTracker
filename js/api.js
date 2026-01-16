const BASE_URL =
  localStorage.getItem("ht.apiBase") ||
  new URLSearchParams(window.location.search).get("apiBase") ||
  "http://localhost:8080";

const HT_DEBUG =
  localStorage.getItem("ht.debug") === "1" ||
  new URLSearchParams(window.location.search).get("debug") === "1";

function getAccessToken() {
  return localStorage.getItem("token");
}

function handleUnauthorized() {
  if (typeof window.htLogoutAndRedirect === "function") {
    window.htLogoutAndRedirect();
    return;
  }
  localStorage.removeItem("token");
  window.location.href = "login.html";
}

function logDebug(...args) {
  if (!HT_DEBUG) return;
  console.debug(...args);
}

function truncate(value, max) {
  const s = String(value ?? "");
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

async function apiFetch(path, options) {
  const requestOptions = options ? { ...options } : {};
  const headers = new Headers(requestOptions.headers || {});

  if (!headers.has("Content-Type") && requestOptions.body) {
    headers.set("Content-Type", "application/json");
  }

  if (path.startsWith("/api/")) {
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  requestOptions.headers = headers;

  logDebug("[API]", requestOptions.method || "GET", `${BASE_URL}${path}`);

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, requestOptions);
  } catch (err) {
    console.error("[API] Connection failed:", {
      url: `${BASE_URL}${path}`,
      method: requestOptions.method || "GET",
      error: err
    });
    throw err;
  }

  if (response.status === 401 && path.startsWith("/api/")) {
    handleUnauthorized();
    throw new Error("Unauthorized");
  }

  return response;
}

async function apiJson(path, options) {
  const response = await apiFetch(path, options);

  if (response.ok) {
    if (response.status === 204) return null;
    return response.json();
  }

  const bodyText = await response.text().catch(() => "");
  let message = "Request failed";
  try {
    const json = bodyText ? JSON.parse(bodyText) : null;
    if (json?.message) message = json.message;
    else if (json?.error) message = json.error;
  } catch {
    if (bodyText) message = truncate(bodyText, 240);
  }

  console.error("[API] Request failed:", {
    url: `${BASE_URL}${path}`,
    method: options?.method || "GET",
    status: response.status,
    message,
    bodyPreview: truncate(bodyText, 500)
  });
  throw new Error(message);
}

window.addEventListener("unhandledrejection", (event) => {
  console.error("[UnhandledRejection]", event.reason);
});

// -----------------------
// Auth (public)
// -----------------------

async function loginApi(email, password) {
  return apiJson("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

async function registerApi(fullName, email, password) {
  const timeZoneId = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return apiJson("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      fullName,
      email,
      password,
      autoSaveTime: "23:00",
      timeZoneId
    })
  });
}

// -----------------------
// User (protected)
// -----------------------

async function getMyProfile() {
  return apiJson("/api/user/me", { method: "GET" });
}

async function updateMyName(fullName) {
  return apiJson("/api/user/name", {
    method: "PUT",
    body: JSON.stringify({ fullName })
  });
}

async function updateMyAutoSaveTime(autoSaveTime) {
  return apiJson("/api/user/auto-save-time", {
    method: "PUT",
    body: JSON.stringify({ autoSaveTime })
  });
}

async function updateMyTimeZone(timeZoneId) {
  return apiJson("/api/user/timezone", {
    method: "PUT",
    body: JSON.stringify({ timeZoneId })
  });
}

// -----------------------
// Habits (protected)
// -----------------------

async function getMyHabits() {
  return apiJson("/api/habits", { method: "GET" });
}

async function createHabit(habitRequest) {
  return apiJson("/api/habits", {
    method: "POST",
    body: JSON.stringify(habitRequest)
  });
}

async function updateHabit(habitId, habitRequest) {
  return apiJson(`/api/habits/${habitId}`, {
    method: "PUT",
    body: JSON.stringify(habitRequest)
  });
}

async function deactivateHabit(habitId) {
  return apiJson(`/api/habits/${habitId}`, { method: "DELETE" });
}

// -----------------------
// Day tracking (protected)
// -----------------------

async function getOrCreateToday() {
  return apiJson("/api/day/today", { method: "GET" });
}

async function saveToday(saveDayRequest) {
  return apiJson("/api/day/today/save", {
    method: "POST",
    body: JSON.stringify(saveDayRequest)
  });
}

// Backward-compat alias (endpoint no longer locks).
async function saveAndLockToday(saveDayRequest) {
  return saveToday(saveDayRequest);
}

async function getEntriesForMonth(year, month) {
  return apiJson(`/api/day/month/${year}/${month}`, { method: "GET" });
}

// -----------------------
// Stats (protected)
// -----------------------

async function getDailyStats(startDate, endDate) {
  const params = new URLSearchParams({ startDate, endDate });
  return apiJson(`/api/stats/daily?${params.toString()}`, { method: "GET" });
}

async function getMonthlyStats(year, month) {
  return apiJson(`/api/stats/monthly/${year}/${month}`, { method: "GET" });
}

async function getCategoryStats(year, month) {
  return apiJson(`/api/stats/categories/${year}/${month}`, { method: "GET" });
}

async function getStreakStats() {
  return apiJson("/api/stats/streaks", { method: "GET" });
}

// -----------------------
// Export / AI (protected)
// -----------------------

async function exportMonthText(year, month) {
  return apiJson(`/api/export/month/${year}/${month}`, { method: "GET" });
}

async function getMonthlyAiPrompt(year, month) {
  return apiJson(`/api/ai/monthly-prompt/${year}/${month}`, { method: "GET" });
}
