const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5500;

app.use(cors());
app.use(express.json()); 

const publicPath = path.join(__dirname, "../public");
app.use(express.static(publicPath, { index: false }));

function page(file) {
  return (req, res) => {
    res.sendFile(path.join(publicPath, file));
  };
}

/* =========================
   ROTAS FIXAS
========================= */
app.get("/", page("login.html"));
app.get("/login", page("login.html"));
app.get("/cadastro", page("cadastro.html"));
app.get("/game", page("index.html"));

app.get("/index.html", (req, res) => {
  res.redirect("/");
});

/* =========================
   DB E TABELAS (Modo em Memória - 100% Grátis)
========================= */
// Se estiver no Render, usa o banco em memória (grátis), se estiver local, usa o arquivo normal
const dbPath = process.env.RENDER ? ":memory:" : path.join(__dirname, "database.db");
const db = new sqlite3.Database(dbPath);

// Garante que o Node ache o json de palavras em qualquer ambiente
const wordsPath = path.join(__dirname, "words.json");
const words = JSON.parse(fs.readFileSync(wordsPath, "utf8"));

db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    points INTEGER DEFAULT 0,
    theme TEXT DEFAULT 'default'
  )
`);

/* =========================
   AUTENTICAÇÃO
========================= */
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
    if (err) return res.status(500).json({ error: "Erro no servidor" });
    if (!user) return res.status(400).json({ error: "Usuário não encontrado" });
    
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ error: "Senha incorreta" });

    res.json({
      success: true,
      username: user.username,
      points: user.points,
      theme: user.theme
    });
  });
});

app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hash], function (err) {
    if (err) return res.status(400).json({ error: "Usuário já existe" });
    res.json({ success: true });
  });
});

/* =========================
   RANKING
========================= */
app.get("/ranking", (req, res) => {
  db.all(`SELECT username, points FROM users ORDER BY points DESC LIMIT 10`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: "Erro ao buscar ranking" });
    res.json(rows);
  });
});

/* =========================
   TEMAS
========================= */
app.post("/update-theme", (req, res) => {
  const { username, theme } = req.body;
  db.run(`UPDATE users SET theme = ? WHERE username = ?`, [theme, username], function (err) {
    if (err) return res.status(500).json({ error: "Erro ao atualizar tema" });
    res.json({ success: true, theme });
  });
});

/* =========================
   WORD & SCORE
========================= */
app.get("/word", (req, res) => {
  const filtered = words.filter(w => w.length === 5);
  const word = filtered[Math.floor(Math.random() * filtered.length)];
  res.json({ word });
});

app.post("/score", (req, res) => {
  const { username, score } = req.body;
  db.run(`UPDATE users SET points = points + ? WHERE username = ?`, [score, username], function (err) {
    if (err) return res.status(500).json({ error: "Erro ao salvar score" });
    db.get(`SELECT points FROM users WHERE username = ?`, [username], (err, row) => {
      res.json({ success: true, newPoints: row ? row.points : score });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
