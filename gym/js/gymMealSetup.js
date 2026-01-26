(() => {
  const templatesListEl = document.getElementById("templatesList");
  const form = document.getElementById("mealTemplateForm");
  const mealNameEl = document.getElementById("mealName");
  const itemsListEl = document.getElementById("itemsList");
  const addItemBtn = document.getElementById("addItemBtn");
  const simpleModeToggleEl = document.getElementById("mealSimpleModeToggle");
  const bulkItemsEl = document.getElementById("mealBulkItems");
  const bulkAddBtn = document.getElementById("mealBulkAddBtn");
  const cancelEditBtn = document.getElementById("cancelEditBtn");
  const statusEl = document.getElementById("mealFormStatus");
  const saveMealBtn = document.getElementById("saveMealBtn");

  const SIMPLE_MODE_KEY = "ht.gym.meal.simpleMode.v1";

  const state = {
    templates: [],
    editTemplateId: null,
    items: [],
    simpleMode: true
  };

  function safeNum(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function clampNonNeg(v) {
    const n = safeNum(v, 0);
    return n >= 0 ? n : 0;
  }

  function emptyItem() {
    return {
      name: "",
      unitLabel: "serving",
      baseQuantity: 1,
      proteinG: 0,
      carbsG: 0,
      fatsG: 0,
      caloriesKcal: 0
    };
  }

  function renderItems() {
    if (!itemsListEl) return;

    if (!state.items.length) {
      itemsListEl.innerHTML = `<div class="gym-helper">Add at least one item.</div>`;
      return;
    }

    const isSimple = Boolean(state.simpleMode);

    itemsListEl.innerHTML = state.items
      .map((it, idx) => {
        const baseQty = safeNum(it.baseQuantity, 1);
        const unitLabel = String(it.unitLabel || "").trim() || "serving";
        const baseText = `${Math.max(0.01, baseQty).toString()} ${unitLabel}`.trim();

        const simpleFields = `
          <div class="row g-2">
            <div class="col-12 col-md-8">
              <label class="form-label gym-helper mb-1">Name</label>
              <input class="form-control form-control-sm gym-it-name" value="${it.name}" maxlength="140" placeholder="e.g., Oats" />
            </div>
            <div class="col-12 col-md-4">
              <label class="form-label gym-helper mb-1">Calories (per ${baseText})</label>
              <input class="form-control form-control-sm gym-it-cal" type="number" min="0" step="1" value="${it.caloriesKcal}" />
            </div>
          </div>
          <div class="gym-helper mt-2">Switch off Simple mode to edit base qty + macros.</div>
        `;

        const advancedFields = `
          <div class="row g-2">
            <div class="col-12 col-md-6">
              <label class="form-label gym-helper mb-1">Name</label>
              <input class="form-control form-control-sm gym-it-name" value="${it.name}" maxlength="140" placeholder="e.g., Oats" />
            </div>
            <div class="col-6 col-md-3">
              <label class="form-label gym-helper mb-1">Unit</label>
              <input class="form-control form-control-sm gym-it-unit" value="${it.unitLabel}" maxlength="24" placeholder="serving" />
            </div>
            <div class="col-6 col-md-3">
              <label class="form-label gym-helper mb-1">Base qty</label>
              <input class="form-control form-control-sm gym-it-base" type="number" min="0.01" step="0.01" value="${it.baseQuantity}" />
            </div>

            <div class="col-6 col-md-3">
              <label class="form-label gym-helper mb-1">Calories (kcal)</label>
              <input class="form-control form-control-sm gym-it-cal" type="number" min="0" step="0.1" value="${it.caloriesKcal}" />
            </div>
            <div class="col-6 col-md-3">
              <label class="form-label gym-helper mb-1">Protein (g)</label>
              <input class="form-control form-control-sm gym-it-protein" type="number" min="0" step="0.1" value="${it.proteinG}" />
            </div>
            <div class="col-6 col-md-3">
              <label class="form-label gym-helper mb-1">Carbs (g)</label>
              <input class="form-control form-control-sm gym-it-carbs" type="number" min="0" step="0.1" value="${it.carbsG}" />
            </div>
            <div class="col-6 col-md-3">
              <label class="form-label gym-helper mb-1">Fats (g)</label>
              <input class="form-control form-control-sm gym-it-fats" type="number" min="0" step="0.1" value="${it.fatsG}" />
            </div>
          </div>
        `;

        return `
          <div class="gym-row" data-idx="${idx}" style="align-items: flex-start;">
            <div style="width: 100%;">
              <div class="d-flex align-items-center justify-content-between">
                <div class="gym-row__title" style="font-size: 13px;">Item ${idx + 1}</div>
                <button type="button" class="btn btn-outline-secondary btn-sm gym-remove-item">
                  <i class="bi bi-x-lg me-2" aria-hidden="true"></i>Remove
                </button>
              </div>
              <div class="gym-divider"></div>
              ${isSimple ? simpleFields : advancedFields}
            </div>
          </div>
        `;
      })
      .join("");

    itemsListEl.querySelectorAll(".gym-row").forEach((row) => {
      const idx = Number(row.getAttribute("data-idx"));
      row.querySelector(".gym-remove-item")?.addEventListener("click", () => {
        state.items.splice(idx, 1);
        renderItems();
      });

      function bind(cls, key, parser) {
        row.querySelector(cls)?.addEventListener("input", (e) => {
          state.items[idx][key] = parser(e.target.value);
        });
      }

      bind(".gym-it-name", "name", (v) => String(v || ""));
      bind(".gym-it-cal", "caloriesKcal", (v) => Number(v || 0));

      if (!state.simpleMode) {
        bind(".gym-it-unit", "unitLabel", (v) => String(v || ""));
        bind(".gym-it-base", "baseQuantity", (v) => Number(v || 0));
        bind(".gym-it-protein", "proteinG", (v) => Number(v || 0));
        bind(".gym-it-carbs", "carbsG", (v) => Number(v || 0));
        bind(".gym-it-fats", "fatsG", (v) => Number(v || 0));
      }
    });
  }

  function resetForm() {
    state.editTemplateId = null;
    if (mealNameEl) mealNameEl.value = "";
    state.items = [emptyItem()];
    cancelEditBtn?.classList.add("d-none");
    if (saveMealBtn) {
      saveMealBtn.innerHTML = `<i class="bi bi-cloud-check-fill me-2" aria-hidden="true"></i>Save`;
    }
    gymClearStatus(statusEl);
    renderItems();
  }

  function renderTemplates() {
    if (!templatesListEl) return;

    if (!state.templates.length) {
      templatesListEl.innerHTML = `<div class="gym-helper">No meals yet. Create your first template.</div>`;
      return;
    }

    templatesListEl.innerHTML = state.templates
      .map((t) => {
        const isActive = t.active !== false;
        const items = (t.items || []).map((it) => `${it.name}`).join(", ");
        return `
          <div class="gym-row" data-template-id="${t.id}">
            <div>
              <div class="d-flex align-items-center gap-2">
                <div class="gym-row__title">${t.name}</div>
                ${isActive ? "" : `<span class="gym-badge is-readonly">Deactivated</span>`}
              </div>
              <div class="gym-row__meta">${items || "No items"}</div>
            </div>
            <div class="d-flex gap-2 justify-content-end flex-wrap">
              <button class="btn btn-outline-secondary btn-sm gym-edit" type="button">
                <i class="bi bi-pencil me-2" aria-hidden="true"></i>Edit
              </button>
              <button class="btn btn-outline-secondary btn-sm gym-deactivate" type="button" ${isActive ? "" : "disabled"}>
                <i class="bi bi-x-circle me-2" aria-hidden="true"></i>Deactivate
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    templatesListEl.querySelectorAll(".gym-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const row = btn.closest(".gym-row");
        const id = row?.getAttribute("data-template-id");
        const t = state.templates.find((x) => String(x.id) === String(id));
        if (!t) return;

        state.editTemplateId = t.id;
        if (mealNameEl) mealNameEl.value = t.name;
        state.items = (t.items || []).map((it) => ({
          name: it.name,
          unitLabel: it.unitLabel,
          baseQuantity: Number(it.baseQuantity || 0),
          proteinG: Number(it.proteinG || 0),
          carbsG: Number(it.carbsG || 0),
          fatsG: Number(it.fatsG || 0),
          caloriesKcal: Number(it.caloriesKcal || 0)
        }));
        cancelEditBtn?.classList.remove("d-none");
        if (saveMealBtn) {
          saveMealBtn.innerHTML = `<i class="bi bi-cloud-check-fill me-2" aria-hidden="true"></i>Update`;
        }
        gymClearStatus(statusEl);
        renderItems();
      });
    });

    templatesListEl.querySelectorAll(".gym-deactivate").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const row = btn.closest(".gym-row");
        const id = row?.getAttribute("data-template-id");
        if (!id) return;
        if (!confirm("Deactivate this meal template?")) return;
        try {
          await deactivateGymMealTemplate(id);
          await load();
        } catch (e) {
          alert(e?.message || "Deactivate failed");
        }
      });
    });
  }

  async function load() {
    if (templatesListEl) templatesListEl.innerHTML = `<div class="gym-skeleton" style="height: 76px;"></div>`;
    state.templates = (await getGymMealTemplatesAll().catch(() => [])) || [];
    renderTemplates();
  }

  simpleModeToggleEl?.addEventListener("change", () => {
    state.simpleMode = Boolean(simpleModeToggleEl.checked);
    localStorage.setItem(SIMPLE_MODE_KEY, state.simpleMode ? "1" : "0");
    renderItems();
  });

  addItemBtn?.addEventListener("click", () => {
    state.items.push(emptyItem());
    renderItems();
  });

  bulkAddBtn?.addEventListener("click", () => {
    const raw = String(bulkItemsEl?.value || "");
    const lines = raw
      .split(/\r?\n/)
      .map((x) => String(x || "").trim())
      .filter(Boolean);

    if (!lines.length) return;

    const parsed = lines
      .map((line) => {
        const m = line.match(/^(.*?)(?:\s*[-,:|]\s*)(\d+(?:\.\d+)?)\s*$/);
        if (!m) return { name: line, caloriesKcal: 0 };
        return {
          name: String(m[1] || "").trim(),
          caloriesKcal: clampNonNeg(m[2])
        };
      })
      .filter((x) => x.name);

    if (!parsed.length) return;

    if (state.items.length === 1 && !String(state.items[0]?.name || "").trim()) {
      const first = parsed.shift();
      state.items[0] = {
        ...emptyItem(),
        ...state.items[0],
        name: first.name,
        caloriesKcal: first.caloriesKcal
      };
    }

    parsed.forEach((p) => {
      state.items.push({ ...emptyItem(), name: p.name, caloriesKcal: p.caloriesKcal });
    });

    if (bulkItemsEl) bulkItemsEl.value = "";
    renderItems();
  });

  cancelEditBtn?.addEventListener("click", () => resetForm());

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    gymClearStatus(statusEl);

    const name = String(mealNameEl?.value || "").trim();
    const items = (state.items || [])
      .map((it) => ({
        name: String(it.name || "").trim(),
        unitLabel: String(it.unitLabel || "").trim() || "serving",
        baseQuantity: Math.max(0.01, safeNum(it.baseQuantity, 1) || 1),
        proteinG: clampNonNeg(it.proteinG),
        carbsG: clampNonNeg(it.carbsG),
        fatsG: clampNonNeg(it.fatsG),
        caloriesKcal: clampNonNeg(it.caloriesKcal)
      }))
      .filter((it) => it.name);

    if (!name) return gymSetStatus(statusEl, "Meal name is required.", "err");
    if (!items.length) return gymSetStatus(statusEl, "Add at least one item.", "err");

    try {
      if (state.editTemplateId) {
        await updateGymMealTemplate(state.editTemplateId, { name, items });
        gymSetStatus(statusEl, "Updated.", "ok");
      } else {
        await createGymMealTemplate({ name, items });
        gymSetStatus(statusEl, "Saved.", "ok");
      }
      await load();
      resetForm();
    } catch (err) {
      gymSetStatus(statusEl, err?.message || "Save failed.", "err");
    }
  });

  async function init() {
    await gymRenderWelcomeName();
    gymStartClock();
    state.simpleMode = localStorage.getItem(SIMPLE_MODE_KEY) !== "0";
    if (simpleModeToggleEl) simpleModeToggleEl.checked = state.simpleMode;
    resetForm();
    await load();
  }

  init();
})();

