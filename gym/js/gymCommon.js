function gymFormatIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

(() => {
  if (!document?.body) return;
  document.body.classList.add("gym-mode");
  requestAnimationFrame(() => document.body.classList.add("gym-enter"));
})();

function gymParseIsoDate(iso) {
  const [y, m, d] = String(iso).split("-").map((x) => parseInt(x, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

function gymStartOfWeekSunday(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  return d;
}

function gymDOWLabel(index) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][index] || "";
}

function gymSetStatus(el, text, kind) {
  if (!el) return;
  el.classList.remove("d-none", "alert-success", "alert-danger", "alert-warning");
  el.classList.add("alert", kind === "ok" ? "alert-success" : kind === "warn" ? "alert-warning" : "alert-danger");
  el.textContent = text;
}

function gymClearStatus(el) {
  if (!el) return;
  el.classList.add("d-none");
  el.classList.remove("alert", "alert-success", "alert-danger", "alert-warning");
  el.textContent = "";
}

async function gymRenderWelcomeName() {
  const el = document.getElementById("welcomeName");
  if (!el) return;
  try {
    const me = await getMyProfile();
    el.textContent = me?.fullName || "User";
  } catch {
    el.textContent = "User";
  }
}

function gymStartClock() {
  const timeEl = document.getElementById("liveTime");
  const dayEl = document.getElementById("todayDay");
  const dateEl = document.getElementById("todayDate");
  const yearEl = document.getElementById("todayYear");
  if (!timeEl || !dayEl || !dateEl || !yearEl) return;

  function tick() {
    const now = new Date();
    const dow = now.toLocaleDateString(undefined, { weekday: "long" });
    const monthDay = now.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
    dayEl.textContent = dow;
    dateEl.textContent = monthDay;
    yearEl.textContent = String(now.getFullYear());
    timeEl.textContent = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  tick();
  setInterval(tick, 1000);
}
