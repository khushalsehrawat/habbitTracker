(() => {
  const AUTO_SAVE_ENABLED_KEY = "ht.autosave.enabled.v1";

  const profileForm = document.getElementById("profileForm");
  const systemForm = document.getElementById("systemForm");
  if (!profileForm || !systemForm) return;

  const fullNameInput = document.getElementById("fullName");
  const emailInput = document.getElementById("email");
  const roleEl = document.getElementById("role");
  const signupEl = document.getElementById("signup");
  const planLine = document.getElementById("planLine");

  const timeZoneSelect = document.getElementById("timeZoneId");
  const autoSaveTimeInput = document.getElementById("autoSaveTime");
  const autoSaveEnabledToggle = document.getElementById("autoSaveEnabled");

  const saveProfileBtn = document.getElementById("saveProfileBtn");
  const saveSystemBtn = document.getElementById("saveSystemBtn");
  const profileStatus = document.getElementById("profileStatus");
  const systemStatus = document.getElementById("systemStatus");

  function setStatus(el, kind, message) {
    if (!el) return;
    el.classList.remove("d-none", "is-success", "is-error");
    el.classList.add(kind === "success" ? "is-success" : "is-error");
    el.textContent = message;
  }

  function clearStatus(el) {
    if (!el) return;
    el.classList.add("d-none");
    el.textContent = "";
  }

  function getAutoSaveEnabled() {
    return localStorage.getItem(AUTO_SAVE_ENABLED_KEY) === "1";
  }

  function setAutoSaveEnabled(enabled) {
    localStorage.setItem(AUTO_SAVE_ENABLED_KEY, enabled ? "1" : "0");
  }

  function buildTimeZones() {
    timeZoneSelect.innerHTML = "";
    const defaultTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

    const options = [
      defaultTz,
      "Asia/Kolkata",
      "UTC",
      "Europe/London",
      "Europe/Berlin",
      "America/New_York",
      "America/Los_Angeles",
      "Asia/Dubai",
      "Asia/Singapore",
      "Asia/Tokyo",
      "Australia/Sydney"
    ];

    const unique = Array.from(new Set(options));
    for (const tz of unique) {
      const opt = document.createElement("option");
      opt.value = tz;
      opt.textContent = tz;
      timeZoneSelect.appendChild(opt);
    }
  }

  async function loadProfile() {
    const profile = await getMyProfile();
    fullNameInput.value = profile.fullName || "";
    emailInput.value = profile.email || "";
    roleEl.textContent = profile.role || "—";
    signupEl.textContent = profile.signupDate || "—";
    planLine.textContent = profile.role || "FREE";

    if (profile.fullName) localStorage.setItem("fullName", profile.fullName);
    if (profile.email) localStorage.setItem("email", profile.email);

    if (profile.autoSaveTime) {
      autoSaveTimeInput.value = String(profile.autoSaveTime).slice(0, 5);
    }

    if (profile.timeZoneId) {
      timeZoneSelect.value = profile.timeZoneId;
    } else {
      timeZoneSelect.value = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    }

    autoSaveEnabledToggle.checked = getAutoSaveEnabled();

    document.querySelectorAll(".glass-card").forEach((el, i) => {
      el.classList.add("fade-up");
      window.setTimeout(() => el.classList.add("is-visible"), 40 + i * 60);
    });
  }

  profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearStatus(profileStatus);

    try {
      saveProfileBtn.disabled = true;
      saveProfileBtn.classList.add("is-loading");

      const fullName = (fullNameInput.value || "").trim();
      if (!fullName) throw new Error("Full name is required.");

      const updated = await updateMyName(fullName);
      fullNameInput.value = updated.fullName || fullName;
      setStatus(profileStatus, "success", "Profile saved.");
      if (updated.fullName) localStorage.setItem("fullName", updated.fullName);
    } catch (err) {
      setStatus(profileStatus, "error", err?.message || "Failed to save profile.");
    } finally {
      saveProfileBtn.disabled = false;
      saveProfileBtn.classList.remove("is-loading");
    }
  });

  systemForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearStatus(systemStatus);

    try {
      saveSystemBtn.disabled = true;
      saveSystemBtn.classList.add("is-loading");

      const tz = timeZoneSelect.value;
      const time = autoSaveTimeInput.value || "23:00";
      const enabled = Boolean(autoSaveEnabledToggle.checked);

      setAutoSaveEnabled(enabled);

      await updateMyTimeZone(tz);
      await updateMyAutoSaveTime(time);
      setStatus(systemStatus, "success", "System settings saved.");
    } catch (err) {
      setStatus(systemStatus, "error", err?.message || "Failed to save system settings.");
    } finally {
      saveSystemBtn.disabled = false;
      saveSystemBtn.classList.remove("is-loading");
    }
  });

  buildTimeZones();
  loadProfile().catch((err) => {
    alert(err?.message || "Failed to load settings");
  });
})();
