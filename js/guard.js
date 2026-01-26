function htLogoutAndRedirect() {
  localStorage.removeItem("token");
  localStorage.removeItem("fullName");
  localStorage.removeItem("email");
  const path = String(window.location.pathname || "").replace(/\\/g, "/");
  const loginHref = path.includes("/gym/") ? "../login.html" : "login.html";
  window.location.href = loginHref;
}

window.htLogoutAndRedirect = htLogoutAndRedirect;

// Redirect if token missing.
const token = localStorage.getItem("token");
if (!token) {
  htLogoutAndRedirect();
}

// Logout button
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  htLogoutAndRedirect();
});
