(() => {
  const weekPlanEl = document.getElementById("weekPlan");
  const dayKindBadgeEl = document.getElementById("dayKindBadge");
  const dayKindTextEl = document.getElementById("dayKindText");
  const selectedDaySubtitleEl = document.getElementById("selectedDaySubtitle");
  const weekDetailEl = document.getElementById("weekDetail");

  const bodyWeightPillEl = document.getElementById("bodyWeightPill");
  const topWeightBtnEl = document.getElementById("topWeightBtn");
  const topWeightTextEl = document.getElementById("topWeightText");
  const weightTrendEl = document.getElementById("weightTrend");
  const weightTrendHintEl = document.getElementById("weightTrendHint");

  const workoutBlockEl = document.getElementById("workoutBlock");
  const workoutStatusEl = document.getElementById("workoutStatus");
  const saveWorkoutBtn = document.getElementById("saveWorkoutBtn");

  const targetsBlockEl = document.getElementById("targetsBlock");

  const mealsStatusEl = document.getElementById("mealsStatus");
  const saveMealsBtn = document.getElementById("saveMealsBtn");

  const summaryBlockEl = document.getElementById("summaryBlock");

  const notesEl = document.getElementById("gymNotesText");
  const notesHintEl = document.getElementById("gymNotesHint");

  const mealTemplateSelectEl = document.getElementById("mealTemplateSelect");
  const addMealBtnEl = document.getElementById("addMealBtn");
  const mealsBlockEl = document.getElementById("mealsBlock");

  const state = {
    selectedDate: gymFormatIsoDate(new Date()),
    dashboard: null,
    plan: null,
    workoutsById: new Map(),
    exerciseCatalog: [],
    workoutEdits: new Map(), // exerciseId -> weightKg string
    removedExerciseIds: new Set(), // exerciseId (extra rows removed before save)
    mealEdits: new Map(), // templateId -> Map(templateItemId -> quantity string)
    weekDetailOpen: true,
    weightTrendOpen: false,
    weightTrendLoadedForDate: null
  };

  function setWeekDetailOpen(next) {
    state.weekDetailOpen = Boolean(next);
    if (!weekDetailEl) return;
    weekDetailEl.classList.toggle("is-open", state.weekDetailOpen);
    weekDetailEl.setAttribute("aria-hidden", state.weekDetailOpen ? "false" : "true");
  }

  function applyWeightTrendOpenState() {
    const open = Boolean(state.weightTrendOpen);
    if (weightTrendEl) weightTrendEl.hidden = !open;
    if (weightTrendHintEl) weightTrendHintEl.classList.toggle("d-none", open);
    if (topWeightBtnEl) topWeightBtnEl.setAttribute("aria-expanded", open ? "true" : "false");
  }

  // Meals are free-form: users add any template(s) per day.

  function fmt0(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(0) : "0";
  }

  function formatTotalsShort(t) {
    return `P ${fmt0(t.proteinG)}g • C ${fmt0(t.carbsG)}g • F ${fmt0(t.fatsG)}g • ${fmt0(t.caloriesKcal)} kcal`;
  }

  function setLoadingBlocks() {
    workoutBlockEl.innerHTML = `
      <div class="gym-skeleton" style="height: 76px;"></div>
      <div class="gym-skeleton mt-3" style="height: 76px;"></div>
    `;
    targetsBlockEl.innerHTML = `<div class="gym-skeleton" style="height: 128px;"></div>`;
    summaryBlockEl.innerHTML = `<div class="gym-skeleton" style="height: 120px;"></div>`;
    if (weekPlanEl) weekPlanEl.innerHTML = `<div class="gym-skeleton" style="height: 340px;"></div>`;
    if (weightTrendEl && state.weightTrendOpen) weightTrendEl.innerHTML = `<div class="gym-skeleton" style="height: 140px;"></div>`;
    if (mealsBlockEl) {
      mealsBlockEl.innerHTML = `
        <div class="gym-skeleton" style="height: 120px;"></div>
        <div class="gym-skeleton mt-3" style="height: 120px;"></div>
      `;
    }
  }

  function safeNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function round2(v) {
    const n = safeNum(v);
    return Math.round(n * 100) / 100;
  }

  function addTotals(base, add) {
    if (!base || !add) return base;
    base.proteinG = round2(safeNum(base.proteinG) + safeNum(add.proteinG));
    base.carbsG = round2(safeNum(base.carbsG) + safeNum(add.carbsG));
    base.fatsG = round2(safeNum(base.fatsG) + safeNum(add.fatsG));
    base.caloriesKcal = round2(safeNum(base.caloriesKcal) + safeNum(add.caloriesKcal));
    return base;
  }

  function zeroTotals() {
    return { proteinG: 0, carbsG: 0, fatsG: 0, caloriesKcal: 0 };
  }

  function computeConsumed(item, quantity) {
    const qty = safeNum(quantity);
    const base = Math.max(0.000001, safeNum(item?.baseQuantity) || 1);
    const factor = qty / base;
    return {
      proteinG: round2(safeNum(item?.proteinG) * factor),
      carbsG: round2(safeNum(item?.carbsG) * factor),
      fatsG: round2(safeNum(item?.fatsG) * factor),
      caloriesKcal: round2(safeNum(item?.caloriesKcal) * factor)
    };
  }

  function computePlannedTotals(items) {
    const planned = zeroTotals();
    (items || []).forEach((it) => {
      addTotals(planned, computeConsumed(it, safeNum(it?.baseQuantity)));
    });
    return planned;
  }

  function recalcMealsTotals(dash) {
    if (!dash) return;
    const total = zeroTotals();
    const meals = dash.dayMeals || [];
    meals.forEach((m) => {
      const mealTotal = zeroTotals();
      (m.items || []).forEach((it) => {
        const consumed = computeConsumed(it, it.quantity ?? 0);
        it.consumed = consumed;
        addTotals(mealTotal, consumed);
      });
      m.consumedTotals = mealTotal;
      addTotals(total, mealTotal);
    });
    dash.consumedTotals = total;
  }

  async function loadWeekPlan() {
    state.workoutsById = new Map();
    state.plan = null;
    try {
      const [plan, workoutsAll] = await Promise.all([
        getGymPlanCurrent().catch(() => null),
        getGymWorkoutsAll().catch(() => null)
      ]);
      state.plan = plan;
      (workoutsAll || []).forEach((w) => state.workoutsById.set(String(w.id), w));
    } catch {
      state.plan = null;
    }
  }

  async function loadExerciseCatalog() {
    try {
      state.exerciseCatalog = (await getGymExercises().catch(() => [])) || [];
    } catch {
      state.exerciseCatalog = [];
    }
  }

  function getWorkoutNameById(id) {
    if (id == null) return "Rest";
    const w = state.workoutsById.get(String(id));
    return w?.name || "Workout";
  }

  function getWorkoutNameForWeekday(weekday) {
    const assignments = state.plan?.assignments || [];
    const a = assignments.find((x) => Number(x.weekday) === Number(weekday));
    return getWorkoutNameById(a?.workoutId ?? null);
  }

  function renderSelectedDateLabel() {
    if (!selectedDaySubtitleEl) return;
    const d = gymParseIsoDate(state.selectedDate);
    selectedDaySubtitleEl.textContent = d.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "short",
      day: "2-digit"
    });
  }

  function renderWeekPlan() {
    if (!weekPlanEl) return;
    const selected = gymParseIsoDate(state.selectedDate);
    const start = gymStartOfWeekSunday(selected);
    const todayIso = gymFormatIsoDate(new Date());

    weekPlanEl.innerHTML = "";
    for (let i = 0; i < 7; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const iso = gymFormatIsoDate(d);
      const isFuture = iso > todayIso;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "gym-week-row";
      if (iso === state.selectedDate) btn.classList.add("is-active");
      if (iso === todayIso) btn.classList.add("is-today");
      if (isFuture) {
        btn.classList.add("is-disabled");
      }

      const dateText = d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
      const workoutName = state.plan ? getWorkoutNameForWeekday(i) : "Set plan";
      btn.innerHTML = `
        <div>
          <div class="gym-week-row__dow">${gymDOWLabel(i)}</div>
          <div class="gym-week-row__date">${dateText}</div>
        </div>
        <div class="gym-week-row__workout">
          ${workoutName}
          <small>${state.plan?.effectiveFrom ? `Plan from ${state.plan.effectiveFrom}` : "Workout Setup → Plan"}</small>
        </div>
      `;

      btn.addEventListener("click", () => {
        if (state.selectedDate === iso) {
          setWeekDetailOpen(!state.weekDetailOpen);
          return;
        }

        state.selectedDate = iso;
        state.workoutEdits.clear();
        state.removedExerciseIds.clear();
        state.mealEdits.clear();
        state.weightTrendLoadedForDate = null;
        setWeekDetailOpen(true);
        renderSelectedDateLabel();
        renderWeekPlan();
        loadDashboard();
      });

      weekPlanEl.appendChild(btn);
    }
  }

  function renderDayKindBadge(dayKind) {
    if (!dayKindBadgeEl || !dayKindTextEl) return;
    dayKindBadgeEl.classList.remove("d-none", "is-readonly", "is-today");
    if (dayKind === "TODAY") {
      dayKindBadgeEl.classList.add("is-today");
      dayKindTextEl.textContent = "Today (editable)";
    } else if (dayKind === "PAST") {
      dayKindBadgeEl.classList.add("is-readonly");
      dayKindTextEl.textContent = "Past day (read-only)";
    } else {
      dayKindBadgeEl.classList.add("is-readonly");
      dayKindTextEl.textContent = "Future day (disabled)";
    }
  }

  function renderBodyWeight(dash) {
    const w = dash?.bodyProfile?.weightKg;
    if (w == null) {
      if (bodyWeightPillEl) {
        bodyWeightPillEl.classList.remove("is-today");
        bodyWeightPillEl.textContent = "—";
      }
      if (topWeightTextEl) topWeightTextEl.textContent = "—";
      return;
    }
    const label = `${Number(w).toFixed(1)} kg`;
    if (bodyWeightPillEl) {
      bodyWeightPillEl.classList.add("is-today");
      bodyWeightPillEl.textContent = label;
    }
    if (topWeightTextEl) topWeightTextEl.textContent = label;
  }

  function renderWeightSparkline(dates, profiles) {
    const weights = profiles.map((p) => (p?.weightKg == null ? null : Number(p.weightKg)));
    const points = weights
      .map((w, idx) => (Number.isFinite(w) ? { idx, w } : null))
      .filter(Boolean);

    if (!points.length) return "";

    const wMin = Math.min(...points.map((p) => p.w));
    const wMax = Math.max(...points.map((p) => p.w));
    const range = wMax - wMin || 1;

    const width = 360;
    const height = 74;
    const padX = 10;
    const padY = 10;

    const xStep = (width - padX * 2) / Math.max(1, weights.length - 1);
    const yScale = (height - padY * 2) / range;

    function x(i) {
      return padX + i * xStep;
    }

    function y(v) {
      return height - padY - (v - wMin) * yScale;
    }

    let path = "";
    let started = false;
    weights.forEach((val, idx) => {
      if (!Number.isFinite(val)) {
        started = false;
        return;
      }
      const cmd = started ? "L" : "M";
      path += `${cmd}${x(idx).toFixed(2)} ${y(val).toFixed(2)} `;
      started = true;
    });

    const circles = points
      .map((p) => `<circle cx="${x(p.idx).toFixed(2)}" cy="${y(p.w).toFixed(2)}" r="2.6" />`)
      .join("");

    return `
      <div class="gym-weight-chart">
        <div class="gym-weight-chart__meta">
          <div class="gym-helper">Last ${weights.length} days</div>
          <div class="gym-helper">${wMin.toFixed(1)} kg – ${wMax.toFixed(1)} kg</div>
        </div>
        <svg viewBox="0 0 ${width} ${height}" width="100%" height="74" aria-hidden="true" class="gym-weight-chart__svg">
          <path d="${path.trim()}" class="gym-weight-chart__line"></path>
          <g class="gym-weight-chart__dots">${circles}</g>
        </svg>
      </div>
    `;
  }

  async function loadWeightTrend() {
    if (!weightTrendEl) return;
    if (!state.weightTrendOpen) return;
    const base = gymParseIsoDate(state.selectedDate);
    const dates = [];
    const days = 14;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i);
      dates.push(gymFormatIsoDate(d));
    }

    try {
      const profiles = await Promise.all(dates.map((iso) => getGymBody(iso).catch(() => null)));
      const chart = renderWeightSparkline(dates, profiles);
      const rows = profiles.slice(-7).map((p, idx) => {
        const iso = dates[dates.length - 7 + idx];
        const label = gymParseIsoDate(iso).toLocaleDateString(undefined, { month: "short", day: "2-digit" });
        const value = p?.weightKg != null ? `${Number(p.weightKg).toFixed(1)} kg` : "—";
        return `
          <div class="gym-weight-trend__row">
            <div class="gym-weight-trend__label">${label}</div>
            <div class="gym-weight-trend__value">${value}</div>
          </div>
        `;
      });
      weightTrendEl.innerHTML = chart + rows.join("");
      state.weightTrendLoadedForDate = state.selectedDate;
    } catch {
      weightTrendEl.innerHTML = `<div class="gym-helper">—</div>`;
    }
  }

  function renderWorkout(dash) {
    const canEdit = Boolean(dash?.canEdit);
    saveWorkoutBtn.disabled = !canEdit;
    saveWorkoutBtn.classList.toggle("d-none", !canEdit);

    const exercises = dash?.exercises || [];
    const lockBadge = `
      <div class="gym-badge ${canEdit ? "is-today" : "is-readonly"}">
        <i class="bi ${canEdit ? "bi-unlock-fill" : "bi-lock-fill"}" aria-hidden="true"></i>
        <span>${canEdit ? "Editable" : "Read-only"}</span>
      </div>
    `;

    const title = dash?.workout?.name ? dash.workout.name : "Manual workout";
    const subtitle = dash?.workout ? "Workout type" : "Log what you did today.";

    const hasPlannedWorkout = Boolean(dash?.workout?.id);
    const showCopyBtn = Boolean(canEdit && hasPlannedWorkout && exercises.length);

    const existingIds = new Set(exercises.map((x) => String(x.exerciseId)));
    const options = (state.exerciseCatalog || [])
      .filter((x) => x?.id != null && !existingIds.has(String(x.id)))
      .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), undefined, { sensitivity: "base" }))
      .map((x) => `<option value="${x.id}">${x.name}</option>`);

    workoutBlockEl.innerHTML = `
      <div class="gym-row">
        <div>
          <div class="gym-row__title">${title}</div>
          <div class="gym-row__meta">${subtitle}</div>
        </div>
        ${lockBadge}
      </div>
      <div class="gym-divider"></div>
      ${showCopyBtn ? `
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
          <button id="copyLastWeightsBtn" type="button" class="btn btn-outline-secondary btn-sm">
            <i class="bi bi-arrow-clockwise me-2" aria-hidden="true"></i>
            Use last weights
          </button>
          <div class="gym-helper">Fills from your last logged day for this workout.</div>
        </div>
      ` : ""}
      ${exercises.length
        ? exercises
          .map((ex) => {
            const isExtra = Boolean(ex?.extra);
            const v = state.workoutEdits.get(String(ex.exerciseId));
            const display = v != null ? v : (ex.weightKg ?? "");
            return `
              <div class="gym-row" data-ex-id="${ex.exerciseId}" data-extra="${isExtra ? "1" : "0"}">
                <div>
                  <div class="d-flex align-items-center gap-2 flex-wrap">
                    <div class="gym-row__title">${ex.name}</div>
                    ${isExtra ? `<span class="gym-pill">Manual</span>` : ""}
                  </div>
                  <div class="gym-row__meta">${ex.type || ""}</div>
                </div>
                <div class="d-flex align-items-end gap-2" style="min-width: 160px;">
                  <div style="flex: 1; min-width: 140px;">
                    <label class="gym-helper mb-1">Weight (kg)</label>
                    <input class="form-control form-control-sm gym-weight-input" type="number" min="0" step="0.5"
                      value="${display}" ${canEdit ? "" : "disabled"} />
                  </div>
                  ${(canEdit && isExtra) ? `
                    <button type="button" class="btn btn-outline-secondary btn-sm gym-ex-remove" title="Remove">
                      <i class="bi bi-x-lg" aria-hidden="true"></i>
                    </button>
                  ` : ""}
                </div>
              </div>
            `;
          })
          .join("")
        : `<div class="gym-helper">${hasPlannedWorkout ? "No exercises linked. Add exercises in Workout Setup." : "No exercises logged yet."}</div>`}
      ${canEdit ? `
        <div class="gym-divider"></div>
        <div class="gym-row">
          <div>
            <div class="gym-row__title">Add exercise</div>
            <div class="gym-row__meta">Log an extra exercise for today.</div>
          </div>
          <div class="d-flex gap-2 align-items-end" style="min-width: 320px; max-width: 520px; width: 100%;">
            <div style="flex: 1; min-width: 160px;">
              <label class="gym-helper mb-1">Exercise</label>
              <select id="manualExerciseSelect" class="form-select form-select-sm">
                <option value="">Select</option>
                ${options.join("")}
              </select>
            </div>
            <div style="width: 140px;">
              <label class="gym-helper mb-1">Weight</label>
              <input id="manualExerciseWeight" class="form-control form-control-sm" type="number" min="0" step="0.5" placeholder="kg" />
            </div>
            <button id="addManualExerciseBtn" type="button" class="btn btn-outline-secondary btn-sm" style="height: 31px;">
              <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>
              Add
            </button>
          </div>
        </div>
      ` : ""}
    `;

    const copyBtn = document.getElementById("copyLastWeightsBtn");
    copyBtn?.addEventListener("click", async () => {
      const dash = state.dashboard;
      if (!dash?.canEdit || !dash?.workout) return;
      copyBtn.disabled = true;
      try {
        const ok = await applyLastWorkoutWeights(dash);
        if (!ok) alert("No previous weights found for this workout (recent days).");
        renderWorkout(dash);
      } finally {
        copyBtn.disabled = false;
      }
    });

    workoutBlockEl.querySelectorAll(".gym-weight-input").forEach((input) => {
      input.addEventListener("input", () => {
        const row = input.closest(".gym-row");
        const exId = row?.getAttribute("data-ex-id");
        if (!exId) return;
        state.workoutEdits.set(String(exId), input.value);
      });
    });

    workoutBlockEl.querySelectorAll(".gym-ex-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const dash = state.dashboard;
        if (!dash?.canEdit) return;
        const row = btn.closest(".gym-row");
        const exId = row?.getAttribute("data-ex-id");
        if (!exId) return;
        dash.exercises = (dash.exercises || []).filter((x) => String(x.exerciseId) !== String(exId));
        state.workoutEdits.delete(String(exId));
        state.removedExerciseIds.add(String(exId));
        renderWorkout(dash);
      });
    });

    const addBtn = document.getElementById("addManualExerciseBtn");
    addBtn?.addEventListener("click", () => {
      const dash = state.dashboard;
      if (!dash?.canEdit) return;
      const sel = document.getElementById("manualExerciseSelect");
      const wEl = document.getElementById("manualExerciseWeight");
      const exId = sel?.value;
      if (!exId) return;
      const ex = (state.exerciseCatalog || []).find((x) => String(x.id) === String(exId));
      if (!ex) return;

      if ((dash.exercises || []).some((x) => String(x.exerciseId) === String(exId))) return;
      state.removedExerciseIds.delete(String(exId));

      const next = {
        exerciseId: ex.id,
        name: ex.name,
        type: ex.type,
        weightKg: null,
        extra: true
      };
      dash.exercises = [...(dash.exercises || []), next];

      const w = String(wEl?.value || "").trim();
      if (w) state.workoutEdits.set(String(exId), w);
      if (sel) sel.value = "";
      if (wEl) wEl.value = "";
      renderWorkout(dash);
    });
  }

  async function applyLastWorkoutWeights(dash) {
    const workoutId = dash?.workout?.id;
    if (!workoutId) return false;

    const base = gymParseIsoDate(state.selectedDate);
    for (let offset = 1; offset <= 21; offset++) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - offset);
      const iso = gymFormatIsoDate(d);

      const prev = await getGymDashboard(iso).catch(() => null);
      if (!prev?.workout) continue;
      if (String(prev.workout.id) !== String(workoutId)) continue;

      const prevWeights = new Map((prev.exercises || []).map((x) => [String(x.exerciseId), x.weightKg]));
      let any = false;
      (dash.exercises || []).forEach((ex) => {
        const w = prevWeights.get(String(ex.exerciseId));
        if (w == null) return;
        state.workoutEdits.set(String(ex.exerciseId), String(w));
        any = true;
      });

      if (any) return true;
    }

    return false;
  }

  function renderTargets(dash) {
    const profile = dash?.bodyProfile;
    if (!profile) {
      targetsBlockEl.innerHTML = `
        <div class="gym-helper">
          Set body weight in <a href="body-settings.html">Body Settings</a> to get targets.
        </div>
      `;
      return;
    }

    const t = profile.targets || {};
    targetsBlockEl.innerHTML = `
      <div class="gym-row">
        <div>
          <div class="gym-row__title">${profile.weightKg != null ? `${Number(profile.weightKg).toFixed(1)} kg` : "—"}</div>
          <div class="gym-row__meta">Effective from ${profile.effectiveFrom || "—"}</div>
        </div>
      </div>
      <div class="gym-divider"></div>
      <div class="gym-grid-2">
        <div class="gym-row"><div><div class="gym-row__title">${t.proteinG ?? "—"} g</div><div class="gym-row__meta">Protein</div></div></div>
        <div class="gym-row"><div><div class="gym-row__title">${t.carbsG ?? "—"} g</div><div class="gym-row__meta">Carbs</div></div></div>
        <div class="gym-row"><div><div class="gym-row__title">${t.fatsG ?? "—"} g</div><div class="gym-row__meta">Fats</div></div></div>
        <div class="gym-row"><div><div class="gym-row__title">${t.caloriesKcal ?? "—"} kcal</div><div class="gym-row__meta">Calories</div></div></div>
      </div>
    `;
  }

  function renderMealTemplateSelects(dash) {
    if (!mealTemplateSelectEl) return;

    const templates = dash?.mealTemplates || [];
    const added = new Set((dash?.dayMeals || []).map((m) => String(m.mealTemplateId)));

    const options = [`<option value="">Add meal…</option>`].concat(
      templates.map((t) => {
        const isAdded = added.has(String(t.id));
        return `<option value="${t.id}" ${isAdded ? "disabled" : ""}>${t.name}${isAdded ? " (added)" : ""}</option>`;
      })
    );

    mealTemplateSelectEl.innerHTML = options.join("");
    mealTemplateSelectEl.value = "";
    mealTemplateSelectEl.disabled = !dash?.canEdit || !templates.length;
    if (addMealBtnEl) addMealBtnEl.disabled = !dash?.canEdit || !templates.length;
  }

  function ensureMealEdits(templateId) {
    const key = String(templateId);
    if (!state.mealEdits.has(key)) state.mealEdits.set(key, new Map());
    return state.mealEdits.get(key);
  }

  function renderMeals(dash) {
    if (!mealsBlockEl) return;

    const meals = dash?.dayMeals || [];
    if (!meals.length) {
      mealsBlockEl.innerHTML = `<div class="gym-helper">No meals yet. Use “Add meal” above.</div>`;
      return;
    }

    mealsBlockEl.innerHTML = meals
      .map((m) => {
        const totals = m.consumedTotals || zeroTotals();
        const totalsLine = formatTotalsShort(totals);
        const plannedTotals = computePlannedTotals(m.items || []);
        const plannedLine = formatTotalsShort(plannedTotals);

        return `
          <div class="gym-meal-card" data-meal-template-id="${m.mealTemplateId}">
            <div class="gym-meal-card__head">
              <div>
                <div class="gym-meal-card__title">${m.name}</div>
                <div class="gym-meal-card__meta">Consumed: ${totalsLine}</div>
                <div class="gym-helper mt-1">Planned: ${plannedLine}</div>
              </div>
              <div class="d-flex gap-2 align-items-start">
                <button type="button" class="btn btn-outline-secondary btn-sm gym-meal-fill" title="Set all to 1x" ${dash?.canEdit ? "" : "disabled"}>
                  1x
                </button>
                <button type="button" class="btn btn-outline-secondary btn-sm gym-meal-remove" title="Remove" ${dash?.canEdit ? "" : "disabled"}>
                  <i class="bi bi-x-lg" aria-hidden="true"></i>
                </button>
              </div>
            </div>
            ${(m.items || [])
              .map((it) => {
                const edits = ensureMealEdits(m.mealTemplateId);
                const v = edits.get(String(it.templateItemId));
                const raw = v != null ? v : (it.quantity ?? 0);
                const display = v != null ? String(raw) : (safeNum(raw) === 0 ? "" : String(raw));
                const per = formatTotalsShort({
                  proteinG: it.proteinG,
                  carbsG: it.carbsG,
                  fatsG: it.fatsG,
                  caloriesKcal: it.caloriesKcal
                });
                const base = `${safeNum(it.baseQuantity)} ${it.unitLabel || ""}`.trim();
                return `
                  <div class="gym-meal-item" data-item-id="${it.templateItemId}">
                    <div>
                      <div class="gym-meal-item__name">${it.name}</div>
                      <div class="gym-meal-item__meta">${base} \u2022 ${per}</div>
                    </div>
                    <input class="form-control form-control-sm gym-qty-input" type="number" min="0" step="0.1"
                      value="${display}" placeholder="${safeNum(it.baseQuantity)}" ${dash?.canEdit ? "" : "disabled"} />
                  </div>
                `;
              })
              .join("")}
          </div>
        `;
      })
      .join("");

    document.querySelectorAll(".gym-meal-card").forEach((card) => {
      const templateId = card.getAttribute("data-meal-template-id");
      const removeBtn = card.querySelector(".gym-meal-remove");
      const fillBtn = card.querySelector(".gym-meal-fill");

      removeBtn?.addEventListener("click", () => {
        const dash = state.dashboard;
        if (!dash?.canEdit) return;
        dash.dayMeals = (dash.dayMeals || []).filter((m) => String(m.mealTemplateId) !== String(templateId));
        state.mealEdits.delete(String(templateId));
        recalcMealsTotals(dash);
        renderMealTemplateSelects(dash);
        renderMeals(dash);
        renderSummary(dash);
      });

      fillBtn?.addEventListener("click", () => {
        const dash = state.dashboard;
        if (!dash?.canEdit) return;
        const meal = (dash.dayMeals || []).find((m) => String(m.mealTemplateId) === String(templateId));
        if (!meal) return;

        const edits = ensureMealEdits(templateId);
        (meal.items || []).forEach((it) => {
          const qty = Math.max(0, safeNum(it.baseQuantity));
          it.quantity = qty;
          edits.set(String(it.templateItemId), String(qty));
        });

        recalcMealsTotals(dash);
        renderMeals(dash);
        renderSummary(dash);
      });

      card.querySelectorAll(".gym-qty-input").forEach((input) => {
        input.addEventListener("input", () => {
          const itemRow = input.closest(".gym-meal-item");
          const itemId = itemRow?.getAttribute("data-item-id");
          if (!itemId) return;
          const edits = ensureMealEdits(templateId);
          edits.set(String(itemId), input.value);

          const dash = state.dashboard;
          const meal = (dash?.dayMeals || []).find((m) => String(m.mealTemplateId) === String(templateId));
          const it = (meal?.items || []).find((x) => String(x.templateItemId) === String(itemId));
          if (it) it.quantity = safeNum(input.value);

          recalcMealsTotals(dash);
          const totals = meal?.consumedTotals || zeroTotals();
          const metaEl = card.querySelector(".gym-meal-card__meta");
          if (metaEl) metaEl.textContent = `Consumed: ${formatTotalsShort(totals)}`;
          renderSummary(dash);
        });
      });
    });
  }

  function addMeal(templateId) {
    const dash = state.dashboard;
    if (!dash?.canEdit) return;
    const templates = dash.mealTemplates || [];
    const t = templates.find((x) => String(x.id) === String(templateId));
    if (!t) return;

    const dayMeals = dash.dayMeals ? [...dash.dayMeals] : [];
    if (dayMeals.some((m) => String(m.mealTemplateId) === String(t.id))) return;

    dayMeals.push({
      mealTemplateId: t.id,
      name: t.name,
      items: (t.items || []).map((it) => ({
        templateItemId: it.id,
        name: it.name,
        unitLabel: it.unitLabel,
        baseQuantity: it.baseQuantity,
        proteinG: it.proteinG,
        carbsG: it.carbsG,
        fatsG: it.fatsG,
        caloriesKcal: it.caloriesKcal,
        quantity: 0
      })),
      consumedTotals: zeroTotals()
    });

    dash.dayMeals = dayMeals;
    recalcMealsTotals(dash);
    renderMealTemplateSelects(dash);
    renderMeals(dash);
    renderSummary(dash);
  }

  function parseWeightInput(value) {
    const s = String(value ?? "").trim();
    if (!s) return null;
    const n = Number(s);
    if (Number.isNaN(n) || n < 0) return null;
    return n;
  }

  saveWorkoutBtn?.addEventListener("click", async () => {
    gymClearStatus(workoutStatusEl);
    const dash = state.dashboard;
    if (!dash?.canEdit) return;
    const logs = (dash.exercises || []).map((ex) => {
      const v = state.workoutEdits.get(String(ex.exerciseId));
      const num = parseWeightInput(v != null ? v : ex.weightKg);
      return { exerciseId: ex.exerciseId, weightKg: num };
    });
    state.removedExerciseIds.forEach((exId) => {
      logs.push({ exerciseId: Number(exId), weightKg: null });
    });
    try {
      const next = await saveGymWorkout(state.selectedDate, logs);
      state.dashboard = next;
      state.workoutEdits.clear();
      state.removedExerciseIds.clear();
      renderWorkout(next);
      gymSetStatus(workoutStatusEl, "Saved.", "ok");
      setTimeout(() => gymClearStatus(workoutStatusEl), 1500);
    } catch (err) {
      gymSetStatus(workoutStatusEl, err?.message || "Save failed.", "err");
    }
  });

  addMealBtnEl?.addEventListener("click", () => {
    const templateId = mealTemplateSelectEl?.value;
    if (!templateId) return;
    addMeal(templateId);
    if (mealTemplateSelectEl) mealTemplateSelectEl.value = "";
  });

  saveMealsBtn?.addEventListener("click", async () => {
    gymClearStatus(mealsStatusEl);
    const dash = state.dashboard;
    if (!dash?.canEdit) return;

    const meals = (dash.dayMeals || []).map((m) => {
      const edits = state.mealEdits.get(String(m.mealTemplateId)) || new Map();
      const items = (m.items || []).map((it) => {
        const v = edits.get(String(it.templateItemId));
        const num = Number(String(v != null ? v : it.quantity ?? 0));
        return {
          templateItemId: it.templateItemId,
          quantity: Number.isFinite(num) && num >= 0 ? num : 0
        };
      });
      return { mealTemplateId: m.mealTemplateId, items };
    });

    try {
      const next = await saveGymMeals(state.selectedDate, meals);
      state.dashboard = next;
      state.mealEdits.clear();
      recalcMealsTotals(next);
      renderMealTemplateSelects(next);
      renderMeals(next);
      renderSummary(next);
      gymSetStatus(mealsStatusEl, "Saved.", "ok");
      setTimeout(() => gymClearStatus(mealsStatusEl), 1500);
    } catch (err) {
      gymSetStatus(mealsStatusEl, err?.message || "Save failed.", "err");
    }
  });

  function renderSummary(dash) {
    const consumed = dash?.consumedTotals || zeroTotals();
    const target = dash?.bodyProfile?.targets || null;

    function line(label, consumedV, targetV, unit) {
      const c = safeNum(consumedV);
      const t = safeNum(targetV);
      const pct = t > 0 ? Math.min(100, Math.round((c / t) * 100)) : 0;
      return `
        <div class="gym-row" style="align-items: flex-start;">
          <div style="flex: 1; min-width: 0;">
            <div class="gym-row__title">${label}</div>
            <div class="gym-row__meta">${c.toFixed(0)} / ${t ? t.toFixed(0) : "—"} ${unit}</div>
            <div class="progress mt-2" style="height: 10px; border-radius: 999px; background: rgba(17,24,39,0.08);">
              <div class="progress-bar" role="progressbar" style="width: ${pct}%; background: linear-gradient(90deg, rgba(0,194,168,0.92), rgba(108,99,255,0.82)); border-radius: 999px;"></div>
            </div>
          </div>
          <div class="gym-badge">${pct}%</div>
        </div>
      `;
    }

    if (!target) {
      summaryBlockEl.innerHTML = `
        <div class="gym-helper">
          Set body weight to compare intake vs targets. Current intake: P ${safeNum(consumed.proteinG)}g • C ${safeNum(consumed.carbsG)}g • F ${safeNum(consumed.fatsG)}g • ${safeNum(consumed.caloriesKcal)} kcal.
        </div>
      `;
      return;
    }

    summaryBlockEl.innerHTML = `
      ${line("Protein", consumed.proteinG, target.proteinG, "g")}
      ${line("Carbs", consumed.carbsG, target.carbsG, "g")}
      ${line("Fats", consumed.fatsG, target.fatsG, "g")}
      ${line("Calories", consumed.caloriesKcal, target.caloriesKcal, "kcal")}
    `;
  }

  function notesStorageKey(iso) {
    return `ht.gym.notes.v1.${iso}`;
  }

  function loadNotes() {
    if (!notesEl) return;
    notesEl.value = localStorage.getItem(notesStorageKey(state.selectedDate)) || "";
    if (notesHintEl) notesHintEl.textContent = "Saved locally for this date.";
  }

  let notesTimer = null;
  notesEl?.addEventListener("input", () => {
    if (notesTimer) clearTimeout(notesTimer);
    notesTimer = setTimeout(() => {
      localStorage.setItem(notesStorageKey(state.selectedDate), notesEl.value || "");
      if (notesHintEl) notesHintEl.textContent = "Saved.";
    }, 350);
  });

  async function loadDashboard() {
    document.body.classList.add("gym-is-loading");
    setLoadingBlocks();
    gymClearStatus(workoutStatusEl);
    gymClearStatus(mealsStatusEl);
    loadNotes();

    try {
      const dash = await getGymDashboard(state.selectedDate);
      state.dashboard = dash;
      state.removedExerciseIds.clear();
      recalcMealsTotals(dash);
      renderSelectedDateLabel();
      renderDayKindBadge(dash.dayKind);
      renderBodyWeight(dash);
      renderWorkout(dash);
      renderTargets(dash);
      renderMealTemplateSelects(dash);
      renderMeals(dash);
      renderSummary(dash);
      renderWeekPlan();
      applyWeightTrendOpenState();
      if (state.weightTrendOpen && state.weightTrendLoadedForDate !== state.selectedDate) {
        await loadWeightTrend();
      }
    } catch (err) {
      workoutBlockEl.innerHTML = `<div class="gym-helper">Failed to load gym dashboard.</div>`;
      targetsBlockEl.innerHTML = `<div class="gym-helper">—</div>`;
      if (mealsBlockEl) mealsBlockEl.innerHTML = `<div class="gym-helper">—</div>`;
      summaryBlockEl.innerHTML = `<div class="gym-helper">—</div>`;
      if (weekPlanEl) weekPlanEl.innerHTML = `<div class="gym-helper">—</div>`;
      if (weightTrendEl && state.weightTrendOpen) weightTrendEl.innerHTML = `<div class="gym-helper">—</div>`;
      console.error(err);
    } finally {
      document.body.classList.remove("gym-is-loading");
    }
  }

  async function init() {
    await gymRenderWelcomeName();
    gymStartClock();
    await Promise.all([loadWeekPlan(), loadExerciseCatalog()]);

    topWeightBtnEl?.addEventListener("click", async () => {
      state.weightTrendOpen = !state.weightTrendOpen;
      applyWeightTrendOpenState();
      if (state.weightTrendOpen && state.weightTrendLoadedForDate !== state.selectedDate) {
        if (weightTrendEl) weightTrendEl.innerHTML = `<div class="gym-skeleton" style="height: 140px;"></div>`;
        await loadWeightTrend();
      }
    });

    bodyWeightPillEl?.addEventListener("click", () => topWeightBtnEl?.click());

    applyWeightTrendOpenState();
    setWeekDetailOpen(true);
    renderSelectedDateLabel();
    renderWeekPlan();
    loadNotes();
    await loadDashboard();
  }

  init();
})();
