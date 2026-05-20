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

app.get("/", page("login.html"));
app.get("/login", page("login.html"));
app.get("/cadastro", page("cadastro.html"));
app.get("/game", page("index.html"));

app.get("/index.html", (req, res) => {
  res.redirect("/");
});

/* =========================
   DB E TABELAS (Persistência Corrigida)
========================= */
const dbPath = path.join(__dirname, "database.db");
const db = new sqlite3.Database(dbPath);

const wordsPath = path.join(__dirname, "words.json");
const words = JSON.parse(fs.readFileSync(wordsPath, "utf8"));

db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    points_n1 INTEGER DEFAULT 0,
    points_n2 INTEGER DEFAULT 0,
    points_n3 INTEGER DEFAULT 0,
    theme TEXT DEFAULT 'default'
  )
`);

/* =========================
   AUTENTICAÇÃO E SINCRONIZAÇÃO
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
      points_n1: user.points_n1,
      points_n2: user.points_n2,
      points_n3: user.points_n3,
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

app.post("/sync-user", (req, res) => {
  const { username, points_n1, points_n2, points_n3, theme } = req.body;
  
  db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, row) => {
    if (err) return res.status(500).json({ error: "Erro ao buscar usuário" });
    
    if (!row) {
      db.run(
        `INSERT INTO users (username, password, points_n1, points_n2, points_n3, theme) VALUES (?, ?, ?, ?, ?, ?)`,
        [username, "restored_account", points_n1 || 0, points_n2 || 0, points_n3 || 0, theme || 'default'],
        function(err2) {
          if (err2) return res.status(500).json({ error: "Erro ao recriar usuário no ranking" });
          return res.json({ success: true, message: "Usuário restaurado no ranking com sucesso" });
        }
      );
    } else {
      db.run(
        `UPDATE users SET points_n1 = MAX(points_n1, ?), points_n2 = MAX(points_n2, ?), points_n3 = MAX(points_n3, ?) WHERE username = ?`,
        [points_n1 || 0, points_n2 || 0, points_n3 || 0, username],
        function(err3) {
          if (err3) return res.status(500).json({ error: "Erro ao atualizar pontos" });
          return res.json({ success: true, message: "Pontos sincronizados" });
        }
      );
    }
  });
});

/* =========================
   RANKING SEPARADO POR NÍVEL
========================= */
app.get("/ranking", (req, res) => {
  const level = req.query.level || "1";
  let column = "points_n1";
  if (level === "2") column = "points_n2";
  if (level === "3") column = "points_n3";

  db.all(`SELECT username, ${column} AS points FROM users ORDER BY ${column} DESC LIMIT 10`, [], (err, rows) => {
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
   WORD & SCORE DINÂMICO
========================= */
app.get("/word", (req, res) => {
  const filtered = words.filter(w => w.length === 5);
  const word = filtered[Math.floor(Math.random() * filtered.length)];
  res.json({ word });
});

app.post("/score", (req, res) => {
  const { username, score, level, wordsSolved } = req.body;
  
  let column = "points_n1";
  if (level === 2) column = "points_n2";
  if (level === 3) column = "points_n3";

  if (!wordsSolved || wordsSolved === 0) {
    db.get(`SELECT ${column} FROM users WHERE username = ?`, [username], (err, row) => {
      if (err) return res.status(500).json({ error: "Erro ao buscar dados do usuário" });
      return res.json({ success: true, newPoints: row ? row[column] : 0 });
    });
    return;
  }

  db.run(`UPDATE users SET ${column} = ${column} + ? WHERE username = ?`, [score, username], function (err) {
    if (err) return res.status(500).json({ error: "Erro ao salvar score" });
    db.get(`SELECT ${column} FROM users WHERE username = ?`, [username], (err, row) => {
      res.json({ success: true, newPoints: row ? row[column] : score });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});