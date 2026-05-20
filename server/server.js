const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const { Pool } = require("pg"); // Adicionado o driver do Postgres
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

const wordsPath = path.join(__dirname, "words.json");
const words = JSON.parse(fs.readFileSync(wordsPath, "utf8"));

/* ==========================================================================
   CONEXÃO COM O BANCO DE DADOS (Postgres no Render / SQLite Local)
   ========================================================================== */
const isRender = process.env.DATABASE_URL ? true : false;
let dbSQLite;
let poolPostgres;

if (isRender) {
  // Se estiver no Render, conecta ao Postgres estável e persistente
  poolPostgres = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  // Criação da tabela no Postgres (sintaxe ligeiramente diferente para o ID autoincremento)
  poolPostgres.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT,
      points INTEGER DEFAULT 0,
      theme TEXT DEFAULT 'default'
    )
  `).catch(err => console.error("Erro ao criar tabela no Postgres:", err));

} else {
  // Se estiver rodando local na sua máquina, continua usando seu arquivo SQLite normalmente
  const dbPath = path.join(__dirname, "database.db");
  dbSQLite = new sqlite3.Database(dbPath);

  dbSQLite.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      points INTEGER DEFAULT 0,
      theme TEXT DEFAULT 'default'
    )
  `);
}

// Função auxiliar para padronizar as consultas (Queries) entre os dois bancos
function executarQuery(text, params, callback) {
  if (isRender) {
    // No Postgres, os parâmetros usam $1, $2 em vez de ?. Vamos converter dinamicamente:
    let index = 1;
    const pgText = text.replace(/\?/g, () => `$${index++}`);
    
    // O Postgres nativo usa a função MAX de forma diferente em UPDATES, ajustamos o comando SQL se for o sync
    let finalPgText = pgText;
    if (pgText.includes("UPDATE users SET points = MAX(points")) {
      finalPgText = `UPDATE users SET points = GREATEST(points, $1) WHERE username = $2`;
    }

    poolPostgres.query(finalPgText, params, (err, res) => {
      if (err) return callback(err, null);
      // Padroniza o retorno das linhas para ficar igual ao SQLite
      const rows = res.rows;
      const row = rows[0] || null;
      callback(null, { rows, row });
    });
  } else {
    // Executa no SQLite local
    if (text.trim().startsWith("SELECT")) {
      dbSQLite.all(text, params, (err, rows) => {
        if (err) return callback(err, null);
        callback(null, { rows, row: rows[0] || null });
      });
    } else {
      dbSQLite.run(text, params, function(err) {
        if (err) return callback(err, null);
        callback(null, { rows: [], row: null });
      });
    }
  }
}

/* ==========================================================================
   ROTAS DA API (Sincronizadas com a abstração do Banco)
   ========================================================================== */

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  executarQuery(`SELECT * FROM users WHERE username = ?`, [username], async (err, resultado) => {
    if (err) return res.status(500).json({ error: "Erro no servidor" });
    if (!resultado.row) return res.status(400).json({ error: "Usuário não encontrado" });
    
    const user = resultado.row;
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
  executarQuery(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hash], (err) => {
    if (err) return res.status(400).json({ error: "Usuário já existe" });
    res.json({ success: true });
  });
});

app.post("/sync-user", (req, res) => {
  const { username, points, theme } = req.body;
  
  executarQuery(`SELECT * FROM users WHERE username = ?`, [username], (err, resultado) => {
    if (err) return res.status(500).json({ error: "Erro ao buscar usuário" });
    
    if (!resultado.row) {
      executarQuery(
        `INSERT INTO users (username, password, points, theme) VALUES (?, ?, ?, ?)`,
        [username, "restored_account", points || 0, theme || 'default'],
        (err2) => {
          if (err2) return res.status(500).json({ error: "Erro ao recriar usuário" });
          return res.json({ success: true, message: "Usuário restaurado" });
        }
      );
    } else {
      executarQuery(
        `UPDATE users SET points = MAX(points, ?) WHERE username = ?`,
        [points || 0, username],
        (err3) => {
          if (err3) return res.status(500).json({ error: "Erro ao atualizar pontos" });
          return res.json({ success: true, message: "Pontos sincronizados" });
        }
      );
    }
  });
});

app.get("/ranking", (req, res) => {
  executarQuery(`SELECT username, points FROM users ORDER BY points DESC LIMIT 10`, [], (err, resultado) => {
    if (err) return res.status(500).json({ error: "Erro ao buscar ranking" });
    res.json(resultado.rows);
  });
});

app.post("/update-theme", (req, res) => {
  const { username, theme } = req.body;
  executarQuery(`UPDATE users SET theme = ? WHERE username = ?`, [theme, username], (err) => {
    if (err) return res.status(500).json({ error: "Erro ao atualizar tema" });
    res.json({ success: true, theme });
  });
});

/* ==========================================================================
   PALAVRAS DO JOGO E CÁLCULO DE SCORE
   ========================================================================== */
app.get("/word", (req, res) => {
  const filtered = words.filter(w => w.length === 5);
  const word = filtered[Math.floor(Math.random() * filtered.length)];
  res.json({ word });
});

app.post("/score", (req, res) => {
  const { username, score, wordsSolved } = req.body;

  if (!wordsSolved || wordsSolved === 0) {
    executarQuery(`SELECT points FROM users WHERE username = ?`, [username], (err, resultado) => {
      if (err) return res.status(500).json({ error: "Erro ao buscar dados do usuário" });
      return res.json({ success: true, newPoints: resultado.row ? resultado.row.points : 0 });
    });
    return;
  }

  executarQuery(`UPDATE users SET points = points + ? WHERE username = ?`, [score, username], (err) => {
    if (err) return res.status(500).json({ error: "Erro ao salvar score" });
    executarQuery(`SELECT points FROM users WHERE username = ?`, [username], (err2, resultado) => {
      if (err2) return res.status(500).json({ error: "Erro ao buscar nova pontuação" });
      res.json({ success: true, newPoints: resultado.row ? resultado.row.points : score });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando com suporte a múltiplos ambientes.`);
});