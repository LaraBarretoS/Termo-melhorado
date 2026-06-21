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

const publicPath = path.join(__dirname, "../public");
app.use(express.static(publicPath));

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

const wordsPath = path.join(__dirname, "words.json");
const words = JSON.parse(fs.readFileSync(wordsPath, "utf8"));

// ==========================================================================
// BANCO DE DADOS (Postgres ou SQLite Local)
// ==========================================================================
let db;
const isPostgres = !!process.env.DATABASE_URL;

if (isPostgres) {
  db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  console.log("Conectado ao PostgreSQL do Render");
} else {
  const dbPath = path.join(__dirname, "database.db");
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

// Criar tabelas se não existirem
const createTableQuery = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE,
    password TEXT,
    points INTEGER DEFAULT 0,
    coins INTEGER DEFAULT 100,
    avatar TEXT DEFAULT 'Dino',
    border TEXT DEFAULT 'default'
  );
`;
if (isPostgres) {
  db.query(createTableQuery).catch(e => console.error(e));
} else {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      points INTEGER DEFAULT 0,
      coins INTEGER DEFAULT 100,
      avatar TEXT DEFAULT 'Dino',
      border TEXT DEFAULT 'default'
    )`);
  });
}

// ==========================================================================
// ROTAS DA API
// ==========================================================================

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const query = `SELECT * FROM users WHERE username = ?`;
  const pgQuery = `SELECT * FROM users WHERE username = $1`;

  ejecutarQuery(isPostgres ? pgQuery : query, [username], async (err, result) => {
    if (err || !result || !result.row) {
      return res.status(400).json({ error: "Usuário não encontrado" });
    }
    
    const userRow = result.row;
    const match = await bcrypt.compare(password, userRow.password);
    if (!match) return res.status(400).json({ error: "Senha incorreta" });
    
    // Tratamento robusto para garantir que nenhuma propriedade vá nula ou quebrada ao front-end
    res.json({
      username: userRow.username,
      points: parseInt(userRow.points) || 0,
      coins: parseInt(userRow.coins) || 0,
      avatar: userRow.avatar || "Dino",
      border: userRow.border || "default"
    });
  });
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const query = `SELECT * FROM users WHERE username = ?`;
  const pgQuery = `SELECT * FROM users WHERE username = $1`;

  ejecutarQuery(isPostgres ? pgQuery : query, [username], async (err, result) => {
    if (err || !result.row) return res.status(400).json({ error: "Usuário não encontrado" });
    const match = await bcrypt.compare(password, result.row.password);
    if (!match) return res.status(400).json({ error: "Senha incorreta" });
    
    res.json({
      username: result.row.username,
      points: result.row.points,
      coins: result.row.coins,
      avatar: result.row.avatar,
      border: result.row.border
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

// Ajustado para bater com o endpoint do frontend ("/update-cosmetics")
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
