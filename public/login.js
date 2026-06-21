<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login - Termo Profissional</title>
  <style>
    body { background-color: #121213; color: white; font-family: sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
    .container { background-color: #1a1a1c; border: 1px solid #3f3f46; padding: 30px; border-radius: 8px; width: 100%; max-width: 350px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
    h1 { letter-spacing: 4px; margin-bottom: 25px; }
    input { width: 100%; padding: 12px; margin-bottom: 15px; border-radius: 6px; border: 1px solid #3f3f46; background: #27272a; color: white; box-sizing: border-box; }
    button { width: 100%; padding: 12px; font-weight: bold; border-radius: 6px; border: none; cursor: pointer; background: #ff4655; color: white; }
    .sec-btn { background: #27272a; color: white; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>TERMO</h1>
    <form onsubmit="event.preventDefault(); login();">
      <input type="text" id="username" placeholder="Usuário" required>
      <input type="password" id="password" placeholder="Senha" required>
      <button type="submit">Entrar</button>
      <button type="button" class="sec-btn" onclick="window.location.href='/cadastro'">Criar Conta</button>
    </form>
    <p id="message" style="color: #ff4655; margin-top: 10px;"></p>
  </div>
  <script src="login.js"></script>
</body>
</html>
