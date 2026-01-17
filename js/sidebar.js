(() => {
  const KEY = "ht.sidebar.collapsed.v1";

  function isCollapsed() {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  }

  function setCollapsed(next) {
    try {
      localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  }

  function apply(next) {
    document.documentElement.classList.toggle("ht-sidebar-collapsed", Boolean(next));
  }

  function updateButton(button, nextCollapsed) {
    if (!button) return;
    const icon = button.querySelector("i");
    const text = button.querySelector(".sidebar-toggle__text");
    button.setAttribute("aria-pressed", nextCollapsed ? "true" : "false");
    button.setAttribute("aria-label", nextCollapsed ? "Expand sidebar" : "Collapse sidebar");
    button.title = nextCollapsed ? "Expand sidebar" : "Collapse sidebar";
    if (icon) {
      icon.className = nextCollapsed ? "bi bi-layout-sidebar-inset-reverse" : "bi bi-layout-sidebar-inset";
    }
    if (text) {
      text.textContent = nextCollapsed ? "Show sidebar" : "Hide sidebar";
    }
  }

  const button = document.getElementById("sidebarToggleBtn");
  const initial = isCollapsed();
  apply(initial);
  updateButton(button, initial);

  button?.addEventListener("click", () => {
    const next = !document.documentElement.classList.contains("ht-sidebar-collapsed");
    apply(next);
    setCollapsed(next);
    updateButton(button, next);
  });
})();
