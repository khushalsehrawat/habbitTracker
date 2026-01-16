function htLogoutAndRedirect() {
  localStorage.removeItem("token");
  localStorage.removeItem("fullName");
  localStorage.removeItem("email");
  window.location.href = "login.html";
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
