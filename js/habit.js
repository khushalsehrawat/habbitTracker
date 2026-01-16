(() => {
  const form = document.getElementById("habitForm");
  if (!form) return;

  const habitIdInput = document.getElementById("habitId");
  const titleInput = document.getElementById("habitTitle");
  const descriptionInput = document.getElementById("habitDescription");
  const categorySelect = document.getElementById("habitCategory");
  const typeSelect = document.getElementById("habitType");
  const trackingMode = document.getElementById("trackingMode");
  const targetBlock = document.getElementById("targetBlock");
  const targetValueInput = document.getElementById("targetValue");
  const targetUnitInput = document.getElementById("targetUnit");
  const frequencyTypeSelect = document.getElementById("frequencyType");
  const frequencyValueBlock = document.getElementById("frequencyValueBlock");
  const frequencyValueInput = document.getElementById("frequencyValue");
  const daysBlock = document.getElementById("daysOfWeekBlock");
  const daysGrid = document.getElementById("daysGrid");
  const submitBtn = document.getElementById("submitHabitBtn");
  const cancelEditBtn = document.getElementById("cancelEditBtn");
  const statusEl = document.getElementById("habitFormStatus");

  const habitsList = document.getElementById("habitsList");
  const habitsEmpty = document.getElementById("habitsEmpty");
  const refreshBtn = document.getElementById("refreshHabitsBtn");

  const weekdays = [
    { key: "MONDAY", label: "Mon" },
    { key: "TUESDAY", label: "Tue" },
    { key: "WEDNESDAY", label: "Wed" },
    { key: "THURSDAY", label: "Thu" },
    { key: "FRIDAY", label: "Fri" },
    { key: "SATURDAY", label: "Sat" },
    { key: "SUNDAY", label: "Sun" }
  ];

  const selectedDays = new Set();
  let cachedHabits = [];

  function setStatus(kind, message) {
    if (!statusEl) return;
    statusEl.classList.remove("d-none", "is-success", "is-error");
    statusEl.classList.add(kind === "success" ? "is-success" : "is-error");
    statusEl.textContent = message;
  }

  function clearStatus() {
    if (!statusEl) return;
    statusEl.classList.add("d-none");
    statusEl.textContent = "";
  }

  function setCreateMode() {
    habitIdInput.value = "";
    cancelEditBtn?.classList.add("d-none");
    submitBtn.innerHTML = `<i class="bi bi-plus-lg me-2" aria-hidden="true"></i>Create Habit`;
  }

  function setEditMode(habit) {
    habitIdInput.value = String(habit.id);
    cancelEditBtn?.classList.remove("d-none");
    submitBtn.innerHTML = `<i class="bi bi-check2-circle me-2" aria-hidden="true"></i>Update Habit`;
  }

  function setTrackingUi(mode) {
    const isTarget = mode === "TARGET";
    targetBlock?.classList.toggle("d-none", !isTarget);
    if (!isTarget) {
      targetValueInput.value = "";
      targetUnitInput.value = "";
    }
  }

  function setFrequencyUi(freqType) {
    const showValue = freqType === "X_PER_WEEK" || freqType === "X_PER_MONTH";
    frequencyValueBlock?.classList.toggle("d-none", !showValue);
    if (!showValue) frequencyValueInput.value = "";

    const showDays = freqType === "SPECIFIC_DAYS_OF_WEEK";
    daysBlock?.classList.toggle("d-none", !showDays);
    if (!showDays) selectedDays.clear();
    renderDays();
  }

  function renderDays() {
    if (!daysGrid) return;
    daysGrid.innerHTML = "";
    for (const day of weekdays) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `day-pill${selectedDays.has(day.key) ? " is-active" : ""}`;
      btn.textContent = day.label;
      btn.addEventListener("click", () => {
        if (selectedDays.has(day.key)) selectedDays.delete(day.key);
        else selectedDays.add(day.key);
        renderDays();
      });
      daysGrid.appendChild(btn);
    }
  }

  function formatHabitMeta(habit) {
    const bits = [];
    if (habit.category) bits.push(habit.category);
    if (habit.frequencyType === "DAILY") bits.push("Daily");
    if (habit.frequencyType === "X_PER_WEEK" && habit.frequencyValue) bits.push(`${habit.frequencyValue}× / week`);
    if (habit.frequencyType === "X_PER_MONTH" && habit.frequencyValue) bits.push(`${habit.frequencyValue}× / month`);
    if (habit.frequencyType === "SPECIFIC_DAYS_OF_WEEK" && habit.daysOfWeek) {
      bits.push(habit.daysOfWeek.split(",").map((d) => d.slice(0, 3)).join(", "));
    }
    if (habit.type) bits.push(habit.type === "BUILD" ? "Build" : "Break");
    return bits.filter(Boolean).join(" • ");
  }

  function renderHabits() {
    habitsList.innerHTML = "";

    if (!cachedHabits.length) {
      habitsEmpty?.classList.remove("d-none");
      return;
    }
    habitsEmpty?.classList.add("d-none");

    for (const habit of cachedHabits) {
      const card = document.createElement("div");
      card.className = "habit-card";

      const targetText = habit.targetValue
        ? `${habit.targetValue} ${habit.unit || ""}`.trim()
        : "Done / Not done";

      card.innerHTML = `
        <div class="habit-card__main">
          <div class="habit-card__title">${escapeHtml(habit.title)}</div>
          <div class="habit-card__meta">${escapeHtml(formatHabitMeta(habit))}</div>
        </div>
        <div class="habit-card__side">
          <div class="habit-card__target">${escapeHtml(targetText)}</div>
          <div class="habit-card__actions">
            <button type="button" class="btn btn-outline-secondary btn-sm" data-action="edit">
              <i class="bi bi-pencil me-1" aria-hidden="true"></i>Edit
            </button>
            <button type="button" class="btn btn-outline-danger btn-sm" data-action="deactivate">
              <i class="bi bi-x-circle me-1" aria-hidden="true"></i>Deactivate
            </button>
          </div>
        </div>
      `;

      card.querySelector('[data-action="edit"]').addEventListener("click", () => {
        clearStatus();
        titleInput.value = habit.title || "";
        descriptionInput.value = habit.description || "";
        categorySelect.value = habit.category || "OTHER";
        typeSelect.value = habit.type || "BUILD";

        const isTarget = habit.targetValue != null;
        trackingMode.value = isTarget ? "TARGET" : "CHECK";
        setTrackingUi(trackingMode.value);
        if (isTarget) {
          targetValueInput.value = habit.targetValue ?? "";
          targetUnitInput.value = habit.unit || "";
        }

        frequencyTypeSelect.value = habit.frequencyType || "DAILY";
        setFrequencyUi(frequencyTypeSelect.value);
        if (habit.frequencyValue != null) frequencyValueInput.value = habit.frequencyValue;
        if (habit.daysOfWeek) {
          selectedDays.clear();
          for (const d of habit.daysOfWeek.split(",")) selectedDays.add(d.trim());
          renderDays();
        }

        setEditMode(habit);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });

      card.querySelector('[data-action="deactivate"]').addEventListener("click", async () => {
        const ok = confirm(`Deactivate “${habit.title}”? It will stop appearing for new days.`);
        if (!ok) return;
        try {
          await deactivateHabit(habit.id);
          await loadHabits();
        } catch (err) {
          alert(err?.message || "Failed to deactivate habit");
        }
      });

      habitsList.appendChild(card);
    }
  }

  async function loadHabits() {
    cachedHabits = await getMyHabits();
    renderHabits();
  }

  function buildHabitRequest() {
    const title = (titleInput.value || "").trim();
    const description = (descriptionInput.value || "").trim();
    const category = categorySelect.value;
    const type = typeSelect.value;
    const frequencyType = frequencyTypeSelect.value;

    let frequencyValue = null;
    if (frequencyType === "X_PER_WEEK" || frequencyType === "X_PER_MONTH") {
      const raw = Number(frequencyValueInput.value);
      frequencyValue = Number.isFinite(raw) && raw > 0 ? raw : null;
    }

    let daysOfWeek = null;
    if (frequencyType === "SPECIFIC_DAYS_OF_WEEK") {
      if (!selectedDays.size) throw new Error("Select at least one day of week.");
      daysOfWeek = Array.from(selectedDays).join(",");
    }

    let targetValue = null;
    let unit = null;
    if (trackingMode.value === "TARGET") {
      const rawTarget = Number(targetValueInput.value);
      if (!Number.isFinite(rawTarget) || rawTarget <= 0) {
        throw new Error("Target must be a positive number.");
      }
      targetValue = rawTarget;
      unit = (targetUnitInput.value || "").trim() || null;
    }

    return {
      title,
      description: description || null,
      category,
      type,
      frequencyType,
      frequencyValue,
      daysOfWeek,
      targetValue,
      unit
    };
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  trackingMode.addEventListener("change", () => setTrackingUi(trackingMode.value));
  frequencyTypeSelect.addEventListener("change", () => setFrequencyUi(frequencyTypeSelect.value));
  cancelEditBtn?.addEventListener("click", () => {
    form.reset();
    selectedDays.clear();
    setTrackingUi(trackingMode.value);
    setFrequencyUi(frequencyTypeSelect.value);
    setCreateMode();
    clearStatus();
  });

  refreshBtn?.addEventListener("click", loadHabits);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearStatus();

    try {
      const request = buildHabitRequest();
      if (!request.title) throw new Error("Title is required.");

      submitBtn.disabled = true;
      submitBtn.classList.add("is-loading");

      const habitId = habitIdInput.value ? Number(habitIdInput.value) : null;
      if (habitId) {
        await updateHabit(habitId, request);
        setStatus("success", "Habit updated.");
      } else {
        await createHabit(request);
        setStatus("success", "Habit created.");
      }

      form.reset();
      selectedDays.clear();
      setCreateMode();
      setTrackingUi(trackingMode.value);
      setFrequencyUi(frequencyTypeSelect.value);
      await loadHabits();

      // Ensure dashboard sees new habits for today (backend will sync statuses).
      try {
        const today = await getOrCreateToday();
        if (today?.locked) {
          setStatus("success", "Habit saved. Note: today is already locked, so this habit starts from tomorrow.");
        }
      } catch {
        // ignore
      }
    } catch (err) {
      setStatus("error", err?.message || "Failed to save habit.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove("is-loading");
    }
  });

  // Init
  renderDays();
  setCreateMode();
  setTrackingUi(trackingMode.value);
  setFrequencyUi(frequencyTypeSelect.value);
  loadHabits().catch(() => {
    // handled by 401 or alert elsewhere
  });

  document.querySelectorAll(".glass-card").forEach((el, i) => {
    el.classList.add("fade-up");
    window.setTimeout(() => el.classList.add("is-visible"), 40 + i * 60);
  });
})();
