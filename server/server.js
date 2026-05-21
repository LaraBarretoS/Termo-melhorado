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
const isRender = process.env.RENDER ? true : false;
let dbSQLite;
let poolPostgres;

if (isRender) {
  console.log("Ambiente Render detectado. Conectando ao PostgreSQL estável...");
  
  poolPostgres = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  poolPostgres.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT,
      points INTEGER DEFAULT 0,
      theme TEXT DEFAULT 'default'
    )
  `).then(() => {
    // Garante as colunas para o sistema de elos, conquistas e cosméticos no Postgres
    poolPostgres.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS avatar INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS border TEXT DEFAULT 'default';
    `).catch(err => console.error("Erro ao adicionar colunas de cosméticos no Postgres:", err));
  }).catch(err => console.error("Erro crítico ao criar tabela no Postgres:", err));

} else {
  console.log("Executando localmente. Conectando ao banco SQLite...");
  const dbPath = path.join(__dirname, "database.db");
  dbSQLite = new sqlite3.Database(dbPath);

  dbSQLite.serialize(() => {
    dbSQLite.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        points INTEGER DEFAULT 0,
        theme TEXT DEFAULT 'default'
      )
    `);
    // Garante as colunas localmente de forma segura
    dbSQLite.run(`ALTER TABLE users ADD COLUMN avatar INTEGER DEFAULT 1`, () => {});
    dbSQLite.run(`ALTER TABLE users ADD COLUMN border TEXT DEFAULT 'default'`, () => {});
  });
}

function executarQuery(text, params, callback) {
  if (isRender) {
    let index = 1;
    let pgText = text.replace(/\?/g, () => `$${index++}`);
    
    if (pgText.includes("MAX(points")) {
      pgText = pgText.replace(/MAX\((points),\s*\$(\d+)\)/g, "GREATEST($1, $2)");
    }
    // Trava para impedir pontuação negativa no cálculo de perdas
    if (pgText.includes("points + $1")) {
      pgText = pgText.replace("points + $1", "GREATEST(0, points + $1)");
    }

    poolPostgres.query(pgText, params, (err, res) => {
      if (err) return callback(err, null);
      const rows = res.rows;
      const row = rows[0] || null;
      callback(null, { rows, row });
    });
  } else {
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
   ROTAS DA API
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
      theme: user.theme,
      avatar: user.avatar || 1,
      border: user.border || "default"
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
  const { username, points, theme, avatar, border } = req.body;
  
  executarQuery(`SELECT * FROM users WHERE username = ?`, [username], (err, resultado) => {
    if (err) return res.status(500).json({ error: "Erro ao buscar usuário" });
    
    if (!resultado.row) {
      executarQuery(
        `INSERT INTO users (username, password, points, theme, avatar, border) VALUES (?, ?, ?, ?, ?, ?)`,
        [username, "restored_account", points || 0, theme || 'default', avatar || 1, border || 'default'],
        (err2) => {
          if (err2) return res.status(500).json({ error: "Erro ao recriar usuário" });
          return res.json({ success: true, message: "Usuário restaurado" });
        }
      );
    } else {
      executarQuery(
        `UPDATE users SET points = MAX(points, ?), theme = ?, avatar = ?, border = ? WHERE username = ?`,
        [points || 0, theme || 'default', avatar || 1, border || 'default', username],
        (err3) => {
          if (err3) return res.status(500).json({ error: "Erro ao atualizar pontos" });
          return res.json({ success: true, message: "Dados sincronizados" });
        }
      );
    }
  });
});

app.post("/update-cosmetics", (req, res) => {
  const { username, avatar, border } = req.body;
  executarQuery(
    `UPDATE users SET avatar = ?, border = ? WHERE username = ?`,
    [avatar, border, username],
    (err) => {
      if (err) return res.status(500).json({ error: "Erro ao atualizar cosméticos" });
      res.json({ success: true, avatar, border });
    }
  );
});

app.get("/ranking", (req, res) => {
  executarQuery(`SELECT username, points, avatar, border FROM users ORDER BY points DESC LIMIT 10`, [], (err, resultado) => {
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

  // Lógica de mitigação de perda ou checagem estática
  if (!wordsSolved || wordsSolved === 0) {
    // Se o score enviado for negativo (punição direta por derrota)
    if (score < 0) {
      executarQuery(`UPDATE users SET points = points + ? WHERE username = ?`, [score, username], (err) => {
        if (err) return res.status(500).json({ error: "Erro ao aplicar perda de pontos" });
        executarQuery(`SELECT points FROM users WHERE username = ?`, [username], (err2, resultado) => {
          if (err2) return res.status(500).json({ error: "Erro ao buscar dados" });
          res.json({ success: true, newPoints: resultado.row ? resultado.row.points : 0 });
        });
      });
    } else {
      executarQuery(`SELECT points FROM users WHERE username = ?`, [username], (err, resultado) => {
        if (err) return res.status(500).json({ error: "Erro ao buscar dados do usuário" });
        return res.json({ success: true, newPoints: resultado.row ? resultado.row.points : 0 });
      });
    }
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

const express = require('express');
const path = require('path');
const app = express();

// Linha crucial para que o Express sirva os arquivos de estilo, JS e imagens
app.use(express.static(path.join(__dirname, 'public')));

// Exemplo da sua rota de ranking que o frontend consome
app.get('/ranking', async (req, res) => {
  try {
    // Exemplo: Buscar usuários ordenados por pontos no banco Postgres
    // const result = await db.query('SELECT username, points FROM users ORDER BY points DESC LIMIT 10');
    // res.json(result.rows);
    
    res.json([
      { username: "Iara", points: 2689500 },
      { username: "Come Come", points: 251000 }
    ]);
  } catch (error) {
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando perfeitamente na porta ${PORT}`);
});

app.listen(PORT, () => {
  console.log(`Servidor rodando com sucesso na porta ${PORT}.`);
});