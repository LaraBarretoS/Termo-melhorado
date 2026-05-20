const boardContainer = document.getElementById("board"); // O container onde os tabuleiros serão gerados
const statusText = document.getElementById("status");
const keyboardContainer = document.getElementById("keyboard");

let currentMode = 1; // 1 = Termo, 2 = Dueto, 4 = Quarteto
let targetWords = []; // Armazena as palavras secretas de cada tabuleiro na rodada
const MAX_ROWS = 6;
const MAX_COLS = 5;

let currentRow = 0;
let currentCol = 0; 
let totalRoundScore = 0; // Acumula os pontos dinâmicos feitos nesta partida

// Estrutura de tentativas tridimensional para suportar múltiplos tabuleiros: [tabuleiro][linha][coluna]
let guesses = [];
let boardsData = []; // Controla se cada tabuleiro individual já foi resolvido ou não

let currentUser = JSON.parse(localStorage.getItem("user"));

/* =========================
   VERIFICAÇÃO DE LOGIN E PERFIL
========================= */
function checkUserSession() {
  if (!currentUser) {
    window.location.href = "/login";
    return;
  }
  document.getElementById("profile-username").innerText = currentUser.username;
  document.getElementById("profile-points").innerText = currentUser.points;
  
  const initial = currentUser.username.charAt(0).toUpperCase();
  document.getElementById("profile-avatar").innerText = initial;

  if (currentUser.theme) {
    changeTheme(currentUser.theme, false);
    const themeSelect = document.getElementById("theme-select");
    if (themeSelect) themeSelect.value = currentUser.theme;
  }
}

/* =========================
   CONTROLE DE TEMAS
========================= */
async function changeTheme(themeName, sendToServer = true) {
  const body = document.getElementById("game-body");
  if (body) {
    body.className = ""; 
    body.classList.add(`theme-${themeName}`);
  }

  currentUser.theme = themeName;
  localStorage.setItem("user", JSON.stringify(currentUser));

  if (sendToServer) {
    await fetch("/update-theme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: currentUser.username, theme: themeName })
    });
  }
}

/* =========================
   RANKING COM INICIAIS
========================= */
async function loadRanking() {
  try {
    const response = await fetch("/ranking");
    const data = await response.json();
    const list = document.getElementById("ranking-list");
    if (!list) return;
    list.innerHTML = "";

    data.forEach((player, index) => {
      const itemDiv = document.createElement("li");
      itemDiv.classList.add("ranking-item");
      const playerInitial = player.username.charAt(0).toUpperCase();

      itemDiv.innerHTML = `
        <span style="font-weight:bold; width:20px;">${index + 1}°</span>
        <div class="ranking-avatar-text">${playerInitial}</div>
        <div class="ranking-info">
          <strong>${player.username}</strong><br>
          <span style="font-size:12px; opacity:0.8;">${player.points} pts</span>
        </div>
      `;
      list.appendChild(itemDiv);
    });
  } catch (err) {
    console.error("Erro ao carregar o ranking:", err);
  }
}

/* =========================
   TECLADO VIRTUAL
========================= */
const keyboardRows = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ç"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"]
];

function createKeyboard() {
  keyboardContainer.innerHTML = "";
  keyboardRows.forEach(row => {
    const rowDiv = document.createElement("div");
    rowDiv.classList.add("keyboard-row");
    row.forEach(key => {
      const btn = document.createElement("button");
      btn.textContent = key === "BACKSPACE" ? "⌫" : key;
      btn.classList.add("key-btn");
      btn.setAttribute("data-key", key);

      if (key === "ENTER" || key === "BACKSPACE") btn.classList.add("wide");
      btn.addEventListener("click", () => pressKey(key));
      rowDiv.appendChild(btn);
    });
    keyboardContainer.appendChild(rowDiv);
  });
}

function updateKeyboardColors(letter, status) {
  const btn = document.querySelector(`.key-btn[data-key='${letter}']`);
  if (!btn) return;

  if (btn.classList.contains("correct")) return;
  if (btn.classList.contains("present") && status === "absent") return;

  btn.classList.remove("present", "absent");
  btn.classList.add(status);
}

/* =========================
   SISTEMA DE DIGITAÇÃO E SELEÇÃO DE CAIXA
========================= */
function selectTile(colIndex) {
  if (currentRow >= MAX_ROWS) return;
  currentCol = colIndex;
  renderActiveTileIndicator();
}

function renderActiveTileIndicator() {
  // Remove o indicador de foco de todas as caixas de todos os tabuleiros ativos
  document.querySelectorAll(".tile").forEach(tile => tile.classList.remove("active-tile"));

  // Adiciona o indicador de foco na coluna atual em todos os tabuleiros ainda não resolvidos
  for (let b = 0; b < currentMode; b++) {
    if (!boardsData[b].solved) {
      const activeTile = document.getElementById(`tile-${b}-${currentRow}-${currentCol}`);
      if (activeTile) activeTile.classList.add("active-tile");
    }
  }
}

function pressKey(key) {
  if (currentRow >= MAX_ROWS || boardsData.every(b => b.solved)) return;

  if (key === "ArrowLeft" || key === "ARROWLEFT") {
    if (currentCol > 0) {
      currentCol--;
      renderActiveTileIndicator();
    }
  }
  else if (key === "ArrowRight" || key === "ARROWRIGHT") {
    if (currentCol < MAX_COLS - 1) {
      currentCol++;
      renderActiveTileIndicator();
    }
  }
  else if (/^[A-ZÇ]$/i.test(key) && key.length === 1) {
    if (currentCol < MAX_COLS) {
      const upperKey = key.toUpperCase();
      
      // Salva a letra digitada nas estruturas de dados dos tabuleiros ativos
      for (let b = 0; b < currentMode; b++) {
        if (!boardsData[b].solved) {
          guesses[b][currentRow][currentCol] = upperKey;
          updateTile(b, currentRow, currentCol, upperKey);
        }
      }
      
      if (currentCol < MAX_COLS - 1) {
        currentCol++;
      }
      renderActiveTileIndicator();
    }
  }
  else if (key === "Backspace" || key === "BACKSPACE") {
    // Verifica se a caixa atual tem conteúdo para apagar
    const firstActive = boardsData.findIndex(b => !b.solved);
    const tileHasContent = guesses[firstActive][currentRow][currentCol] !== "";

    for (let b = 0; b < currentMode; b++) {
      if (!boardsData[b].solved) {
        if (tileHasContent) {
          guesses[b][currentRow][currentCol] = "";
          updateTile(b, currentRow, currentCol, "");
        } else if (currentCol > 0) {
          guesses[b][currentRow][currentCol - 1] = "";
          updateTile(b, currentRow, currentCol - 1, "");
        }
      }
    }

    if (!tileHasContent && currentCol > 0) {
      currentCol--;
    }
    renderActiveTileIndicator();
  }
  else if (key === "Enter" || key === "ENTER") {
    const firstActive = boardsData.findIndex(b => !b.solved);
    const isComplete = guesses[firstActive][currentRow].every(letter => letter !== "");
    
    if (isComplete) {
      checkWord();
    } else {
      statusText.innerText = "Palavra incompleta";
    }
  }
}

window.addEventListener("keydown", (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  pressKey(e.key);
}, true);

function updateTile(boardIndex, row, col, letter) {
  const tile = document.getElementById(`tile-${boardIndex}-${row}-${col}`);
  if (tile) tile.textContent = letter;
}

/* =========================
   LÓGICA DOS MÚLTIPLOS MODOS E CRIAÇÃO DO JOGO
========================= */
function setupModeButtons() {
  document.querySelectorAll(".mode-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      currentMode = parseInt(e.target.getAttribute("data-mode"));
      startNewGame();
    });
  });

  const resetBtn = document.getElementById("btn-reset");
  if (resetBtn) resetBtn.addEventListener("click", startNewGame);
}

async function startNewGame() {
  currentRow = 0;
  currentCol = 0;
  totalRoundScore = 0;
  targetWords = [];
  guesses = [];
  boardsData = [];
  statusText.innerText = "";
  
  boardContainer.innerHTML = "";
  boardContainer.className = `mode-${currentMode}`;

  // Busca do servidor o número exato de palavras correspondente ao modo ativo
  for (let b = 0; b < currentMode; b++) {
    try {
      const response = await fetch("/word");
      const data = await response.json();
      targetWords.push(data.word.toUpperCase());
    } catch (err) {
      console.error("Erro ao carregar palavra do servidor:", err);
      targetWords.push("TERMO");
    }
    
    // Cria matrizes de tentativas limpas para cada tabuleiro individual
    guesses.push(Array.from({ length: MAX_ROWS }, () => Array(MAX_COLS).fill("")));
    boardsData.push({ solved: false });
  }

  // Renderiza dinamicamente as estruturas de grades na tela
  for (let b = 0; b < currentMode; b++) {
    const boardEl = document.createElement("div");
    boardEl.className = "board";
    boardEl.id = `board-${b}`;

    for (let r = 0; r < MAX_ROWS; r++) {
      const rowEl = document.createElement("div");
      rowEl.className = "row";
      if (r === 0) rowEl.classList.add("row-active");

      for (let c = 0; c < MAX_COLS; c++) {
        const tile = document.createElement("div");
        tile.className = "tile";
        tile.id = `tile-${b}-${r}-${c}`;
        
        tile.addEventListener("click", () => {
          if (r === currentRow) selectTile(c);
        });

        rowEl.appendChild(tile);
      }
      boardEl.appendChild(rowEl);
    }
    boardContainer.appendChild(boardEl);
  }

  createKeyboard();
  renderActiveTileIndicator();
}

/* =========================
   SISTEMA DE VALIDAÇÃO E PONTUAÇÃO DINÂMICA
========================= */
function checkWord() {
  // Remove indicadores visuais de foco e linha ativa antes de pintar os blocos
  document.querySelectorAll(".tile").forEach(t => t.classList.remove("active-tile"));
  document.querySelectorAll(".row-active").forEach(r => r.classList.remove("row-active"));

  let roundPointsGained = 0; 
  const firstActive = boardsData.findIndex(b => !b.solved);
  const currentGuessStr = guesses[firstActive][currentRow].join("");

  for (let b = 0; b < currentMode; b++) {
    if (boardsData[b].solved) continue;

    const boardEl = document.getElementById(`board-${b}`);
    const activeRowEl = boardEl.children[currentRow];
    const targetWordStr = targetWords[b];

    const tileStatuses = Array(MAX_COLS).fill("absent");
    const used = Array(MAX_COLS).fill(false);

    let correctPosition = 0;
    let correctLetters = 0;

    // Passo 1: Detecta acertos exatos (Verde) -> +3.000 pontos
    for (let i = 0; i < MAX_COLS; i++) {
      if (currentGuessStr[i] === targetWordStr[i]) {
        tileStatuses[i] = "correct";
        used[i] = true;
        correctPosition++;
        roundPointsGained += 3000;
      }
    }

    // Passo 2: Detecta letras existentes mas deslocadas (Amarelo) -> +1.000 pontos
    for (let i = 0; i < MAX_COLS; i++) {
      if (tileStatuses[i] === "correct") continue;
      for (let j = 0; j < MAX_COLS; j++) {
        if (!used[j] && currentGuessStr[i] === targetWordStr[j]) {
          tileStatuses[i] = "present";
          used[j] = true;
          correctLetters++;
          roundPointsGained += 1000;
          break;
        }
      }
    }

    // Aplica os estilos visuais nas caixas correspondentes do tabuleiro
    for (let i = 0; i < MAX_COLS; i++) {
      const tile = document.getElementById(`tile-${b}-${currentRow}-${i}`);
      if (tile) tile.classList.add(tileStatuses[i]);
      updateKeyboardColors(currentGuessStr[i], tileStatuses[i]);
    }

    // Condição de acerto total da palavra secreta deste tabuleiro
    if (currentGuessStr === targetWordStr) {
      boardsData[b].solved = true;
      boardEl.classList.add("solved");

      // BÔNUS MÁXIMO DE 20.000 SE ACERTAR DE PRIMEIRA
      if (currentRow === 0) {
        // Substitui os pontos computados de letras desta palavra e fixa os 20k cravados
        roundPointsGained = roundPointsGained - (correctPosition * 3000 + correctLetters * 1000) + 20000;
      }
    }
  }

  totalRoundScore += roundPointsGained;

  // Próxima linha
  currentRow++;
  currentCol = 0;

  // Verifica fim de jogo
  if (boardsData.every(b => b.solved)) {
    statusText.innerText = `Vitória! 🎉 Você fez +${totalRoundScore} pontos!`;
    saveScore(totalRoundScore);
    currentRow = MAX_ROWS;
    return;
  }

  if (currentRow === MAX_ROWS) {
    statusText.innerText = `Fim de jogo! Palavras: ${targetWords.join(" | ")}`;
    if (totalRoundScore > 0) saveScore(totalRoundScore);
    return;
  }

  // Ativa visualmente a próxima linha disponível nos tabuleiros não finalizados
  for (let b = 0; b < currentMode; b++) {
    if (!boardsData[b].solved) {
      const board = document.getElementById(`board-${b}`);
      if (board && board.children[currentRow]) {
        board.children[currentRow].classList.add("row-active");
      }
    }
  }
  renderActiveTileIndicator();
}

async function saveScore(scorePoints) {
  const response = await fetch("/score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: currentUser.username, score: scorePoints })
  });
  const data = await response.json();
  
  if (data.success) {
    currentUser.points = data.newPoints;
    localStorage.setItem("user", JSON.stringify(currentUser));
    document.getElementById("profile-points").innerText = data.newPoints;
    loadRanking();
  }
}

function logout() {
  localStorage.removeItem("user");
  window.location.href = "/login";
}

/* =========================
   INICIALIZAÇÃO DO ECOSSISTEMA
========================= */
async function init() {
  checkUserSession();
  setupModeButtons();
  await startNewGame();
  loadRanking();
}

init();