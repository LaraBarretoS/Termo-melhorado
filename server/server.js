const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const { Pool } = require("pg"); 
const bcrypt = require("bcrypt");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5500;

app.use(cors());
app.use(express.json()); 

// CAMINHO RESOLVIDO: Garante estabilidade na localização de scripts estáticos no Render
const publicPath = path.resolve(__dirname, "../public");
app.use(express.static(publicPath));

// Rotas de entrega de Páginas usando caminhos absolutos validados
app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "login.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(publicPath, "login.html"));
});

app.get("/cadastro", (req, res) => {
  res.sendFile(path.join(publicPath, "cadastro.html"));
});

app.get("/game", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

app.get("/index.html", (req, res) => {
  res.redirect("/");
});

// Resgate do arquivo JSON de palavras corrigido
const wordsPath = path.resolve(__dirname, "words.json");
const words = JSON.parse(fs.readFileSync(wordsPath, "utf8"));

// ==========================================================================
// BANCO DE DADOS (Postgres Neon ou SQLite Local)
// ==========================================================================
let db;
const isPostgres = !!process.env.DATABASE_URL;

if (isPostgres) {
  db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  console.log("Conectado ao PostgreSQL do Neon");
} else {
  const dbPath = path.resolve(__dirname, "database.db");
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("Erro SQLite:", err.message);
    else console.log("Conectado ao SQLite Local (database.db)");
  });
}

function ejecutarQuery(query, params, callback) {
  if (isPostgres) {
    db.query(query, params)
      .then(res => callback(null, { rows: res.rows, row: res.rows[0] }))
      .catch(err => callback(err, null));
  } else {
    db.all(query, params, function(err, rows) {
      if (err) return callback(err, null);
      callback(null, { rows: rows, row: rows[0] });
    });
  }
}

// ==========================================================================
// ROTAS DA API (Compatibilidade Total Neon)
// ==========================================================================

app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Preencha tudo" });
  try {
    const hash = await bcrypt.hash(password, 10);
    const query = `INSERT INTO users (username, password, points, coins, avatar, border) VALUES (?, ?, 0, 100, 'Dino', 'default')`;
    const pgQuery = `INSERT INTO users (username, password, points, coins, avatar, border) VALUES ($1, $2, 0, 100, 'Dino', 'default')`;
    
    ejecutarQuery(isPostgres ? pgQuery : query, [username, hash], (err) => {
      if (err) return res.status(400).json({ error: "Usuário já existe" });
      res.json({ success: true });
    });
  } catch (e) {
    res.status(500).json({ error: "Erro no servidor" });
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const query = `SELECT * FROM users WHERE username = ?`;
  const pgQuery = `SELECT * FROM users WHERE username = $1`;

  ejecutarQuery(isPostgres ? pgQuery : query, [username], async (err, result) => {
    if (err || !result || !result.row) return res.status(400).json({ error: "Usuário não encontrado" });
    
    const userRow = result.row;
    const match = await bcrypt.compare(password, userRow.password);
    if (!match) return res.status(400).json({ error: "Senha incorreta" });
    
    // Mapeamento das chaves minúsculas vindas do Neon
    res.json({
      username: userRow.username,
      points: parseInt(userRow.points) || 0,
      coins: parseInt(userRow.coins) || 0,
      avatar: userRow.avatar || "Dino",
      border: userRow.border || "default"
    });
  });
});

app.get("/words", (req, res) => {
  res.json(words);
});

app.get("/ranking", (req, res) => {
  const q = `SELECT username, points, avatar, border FROM users ORDER BY points DESC LIMIT 50`;
  ejecutarQuery(q, [], (err, result) => {
    if (err) return res.status(500).json({ error: "Erro ao carregar ranking" });
    res.json(result.rows || []);
  });
});

app.post("/score", (req, res) => {
  const { username, score, coinsEarned } = req.body;
  const pts = parseInt(score) || 0;
  const cns = parseInt(coinsEarned) || 0;

  const q = `UPDATE users SET points = points + ?, coins = coins + ? WHERE username = ?`;
  const pgQ = `UPDATE users SET points = points + $1, coins = coins + $2 WHERE username = $3`;

  ejecutarQuery(isPostgres ? pgQ : q, [pts, cns, username], (err) => {
    if (err) return res.status(500).json({ error: "Erro ao salvar dados" });
    
    const findQ = `SELECT points, coins FROM users WHERE username = ?`;
    const findPgQ = `SELECT points, coins FROM users WHERE username = $1`;
    ejecutarQuery(isPostgres ? findPgQ : findQ, [username], (err2, result) => {
      if (err2 || !result.row) return res.status(500).json({ error: "Erro ao resgatar dados" });
      res.json({ success: true, newPoints: result.row.points, newCoins: result.row.coins });
    });
  });
});

app.post("/update-cosmetics", (req, res) => {
  const { username, avatar, border } = req.body;
  const q = `UPDATE users SET avatar = ?, border = ? WHERE username = ?`;
  const pgQ = `UPDATE users SET avatar = $1, border = $2 WHERE username = $3`;

  ejecutarQuery(isPostgres ? pgQ : q, [avatar, border, username], (err) => {
    if (err) return res.status(500).json({ error: "Erro ao salvar cosméticos" });
    res.json({ success: true });
  });
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
