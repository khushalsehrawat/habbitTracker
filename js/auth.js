// LOGIN
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = (document.getElementById("loginEmail")?.value || "").trim();
    const password = document.getElementById("loginPassword")?.value || "";

    try {
      const data = await loginApi(email, password);
      localStorage.setItem("token", data.accessToken);
      if (data.fullName) localStorage.setItem("fullName", data.fullName);
      if (data.email) localStorage.setItem("email", data.email);
      window.location.href = "dashboard.html";
    } catch (err) {
      alert(err?.message || "Invalid login credentials");
    }
  });
}

// REGISTER
const registerForm = document.getElementById("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fullName = (document.getElementById("regName")?.value || "").trim();
    const email = (document.getElementById("regEmail")?.value || "").trim();
    const password = document.getElementById("regPassword")?.value || "";

    try {
      await registerApi(fullName, email, password);
      alert("Registration successful. Please login.");
      window.location.href = "login.html";
    } catch (err) {
      alert(err?.message || "Registration failed");
    }
  });
}
