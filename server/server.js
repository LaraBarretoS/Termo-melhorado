const express = require('express');
const path = require('path');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();

// Configurações de Middleware
app.use(cors());
app.use(express.json());

// ==========================================
// Conexão com o Banco de Dados (Neon/PostgreSQL)
// ==========================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Obrigatório para conexões seguras com o Neon
  }
});

// Testar a conexão com o banco de dados assim que o servidor inicia
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Erro ao conectar ao PostgreSQL do Neon:', err.stack);
  }
  console.log('Conectado com sucesso ao PostgreSQL do Neon!');
  release();
});

// ==========================================
// 1. Servir Arquivos Estáticos (Pasta Public)
// ==========================================
// Esta linha deve vir ANTES das rotas de página para que o Express 
// consiga entregar arquivos como login.js e style.css diretamente.
app.use(express.static(path.join(__dirname, '../public')));

// ==========================================
// 2. Rotas de Páginas (GET)
// ==========================================

// Rota para a página de Login (Acessada por '/' ou '/login')
app.get(['/', '/login'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

// Rota para a página de Cadastro
app.get('/cadastro', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/cadastro.html'));
});

// Rota para a página principal do Jogo
app.get('/game', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ==========================================
// 3. Rotas da API (POST e GET para lógica do jogo)
// ==========================================

// Rota de Cadastro de Usuário
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  }

  try {
    // Verifica se o usuário já existe no banco
    const userExists = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'Este nome de usuário já está em uso.' });
    }

    // Insere o novo usuário (Armazenando pontos zerados e elo Unranked por padrão)
    await pool.query(
      'INSERT INTO users (username, password, points, elo) VALUES ($1, $2, $3, $4)',
      [username, password, 0, 'Unranked']
    );

    res.status(201).json({ message: 'Usuário cadastrado com sucesso!' });
  } catch (error) {
    console.error('Erro ao cadastrar usuário:', error);
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

// Rota de Login do Usuário
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }

    // Login bem-sucedido: Retorna os dados necessários para o frontend salvar na Session/LocalStorage
    const user = result.rows[0];
    res.json({
      message: 'Login realizado com sucesso!',
      user: {
        id: user.id,
        username: user.username,
        points: user.points,
        elo: user.elo
      }
    });
  } catch (error) {
    console.error('Erro ao realizar login:', error);
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

// Rota para buscar Palavras do Jogo
app.get('/words', async (req, res) => {
  try {
    const result = await pool.query('SELECT word FROM words');
    const wordsList = result.rows.map(row => row.word);
    res.json(wordsList);
  } catch (error) {
    console.error('Erro ao buscar palavras:', error);
    res.status(500).json({ error: 'Erro ao carregar banco de palavras.' });
  }
});

// Rota para buscar o Ranking Global
app.get('/ranking', async (req, res) => {
  try {
    const result = await pool.query('SELECT username, points, elo FROM users ORDER BY points DESC LIMIT 10');
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar ranking:', error);
    res.status(500).json({ error: 'Erro ao carregar o ranking.' });
  }
});

// Rota para atualizar a Pontuação e o Elo do jogador
app.post('/score', async (req, res) => {
  const { username, points, elo } = req.body;

  try {
    await pool.query('UPDATE users SET points = $1, elo = $2 WHERE username = $3', [points, elo, username]);
    res.json({ message: 'Pontuação atualizada com sucesso!' });
  } catch (error) {
    console.error('Erro ao atualizar pontuação:', error);
    res.status(500).json({ error: 'Erro ao salvar progresso.' });
  }
});

// Rota para atualizar Cosméticos/Customizações (Opcional, caso use no jogo)
app.post('/update-cosmetics', async (req, res) => {
  const { username, cosmetics } = req.body;
  try {
    await pool.query('UPDATE users SET cosmetics = $1 WHERE username = $2', [JSON.stringify(cosmetics), username]);
    res.json({ message: 'Cosméticos atualizados com sucesso!' });
  } catch (error) {
    console.error('Erro ao atualizar cosméticos:', error);
    res.status(500).json({ error: 'Erro ao salvar customização.' });
  }
});

// ==========================================
// Inicialização do Servidor
// ==========================================
const PORT = process.env.PORT || 5500;
app.listen(PORT, () => {
  console.log(`Servidor backend ativo e rodando na porta ${PORT}`);
});
