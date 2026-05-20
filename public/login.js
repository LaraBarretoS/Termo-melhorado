async function login() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  const response = await fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  const data = await response.json();

  if (response.ok) {
    localStorage.setItem("user", JSON.stringify(data));

    document.getElementById("message").innerText = "Login OK!";

    setTimeout(() => {
      window.location.href = "/game";
    }, 400);

  } else {
    document.getElementById("message").innerText = data.error || "Erro";
  }
}

/* cadastro (se estiver usando) */
async function register() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  const response = await fetch("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  const data = await response.json();

  document.getElementById("message").innerText =
    data.error || "Usuário criado!";
}