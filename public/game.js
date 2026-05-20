const boardContainer = document.getElementById("board");
const statusText = document.getElementById("status");
const keyboardContainer = document.getElementById("keyboard");

let currentLevel = 1; // 1 = Termo (Nível 1), 2 = Dueto (Nível 2), 3 = Quarteto (Nível 3)
let currentMode = 1;  // 1, 2 ou 4 palavras simultâneas
let targetWords = []; 
const MAX_ROWS = 6;
const MAX_COLS = 5;

let currentRow = 0;
let currentCol = 0; 
let totalRoundScore = 0; 

let guesses = [];
let boardsData = []; 

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
  updatePointsDisplay();
  
  const initial = currentUser.username.charAt(0).toUpperCase();
  document.getElementById("profile-avatar").innerText = initial;

  if (currentUser.theme) {
    changeTheme(currentUser.theme, false);
    const themeSelect = document.getElementById("theme-select");
    if (themeSelect) themeSelect.value = currentUser.theme;
  }
}

function updatePointsDisplay() {
  let pts = currentUser.points_n1 || 0;
  if (currentLevel === 2) pts = currentUser.points_n2 || 0;
  if (currentLevel === 3) pts = currentUser.points_n3 || 0;
  document.getElementById("profile-points").innerText = pts;
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
   RANKING FILTRADO POR NÍVEL ATUAL
========================= */
async function loadRanking() {
  try {
    const response = await fetch(`/ranking?level=${currentLevel}`);
    const data = await response.json();
    const list = document.getElementById("ranking-list");
    if (!list) return;
    list.innerHTML = "";

    // Atualiza o título visual do ranking indicando qual nível está listado
    const rankingTitle = document.querySelector(".ranking-section h3");
    if (rankingTitle) rankingTitle.innerText = `Ranking - Nível ${currentLevel}`;

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
  document.querySelectorAll(".tile").forEach(tile => tile.classList.remove("active-tile"));

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
   GERENCIAMENTO DE NÍVEIS LINEAR
========================= */
async function startNewGame() {
  currentRow = 0;
  currentCol = 0;
  totalRoundScore = 0;
  targetWords = [];
  guesses = [];
  boardsData = [];
  statusText.innerText = "";
  
  // Define o número de palavras baseado no nível linear
  if (currentLevel === 1) currentMode = 1;
  if (currentLevel === 2) currentMode = 2;
  if (currentLevel === 3) currentMode = 4;

  boardContainer.innerHTML = "";
  boardContainer.className = `mode-${currentMode}`;

  // Atualiza exibição de pontos e ranking para o nível ativo
  updatePointsDisplay();
  loadRanking();

  for (let b = 0; b < currentMode; b++) {
    try {
      const response = await fetch("/word");
      const data = await response.json();
      targetWords.push(data.word.toUpperCase());
    } catch (err) {
      console.error("Erro ao buscar palavra:", err);
      targetWords.push("TERMO");
    }
    guesses.push(Array.from({ length: MAX_ROWS }, () => Array(MAX_COLS).fill("")));
    boardsData.push({ solved: false });
  }

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
   VALIDAÇÃO DA TENTATIVA
========================= */
function checkWord() {
  document.querySelectorAll(".tile").forEach(t => t.classList.remove("active-tile"));
  document.querySelectorAll(".row-active").forEach(r => r.classList.remove("row-active"));

  let roundPointsGained = 0; 
  const firstActive = boardsData.findIndex(b => !b.solved);
  const currentGuessStr = guesses[firstActive][currentRow].join("");

  for (let b = 0; b < currentMode; b++) {
    if (boardsData[b].solved) continue;

    const boardEl = document.getElementById(`board-${b}`);
    const targetWordStr = targetWords[b];

    const tileStatuses = Array(MAX_COLS).fill("absent");
    const used = Array(MAX_COLS).fill(false);

    let correctPosition = 0;
    let correctLetters = 0;

    for (let i = 0; i < MAX_COLS; i++) {
      if (currentGuessStr[i] === targetWordStr[i]) {
        tileStatuses[i] = "correct";
        used[i] = true;
        correctPosition++;
        roundPointsGained += 3000;
      }
    }

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

    for (let i = 0; i < MAX_COLS; i++) {
      const tile = document.getElementById(`tile-${b}-${currentRow}-${i}`);
      if (tile) tile.classList.add(tileStatuses[i]);
      updateKeyboardColors(currentGuessStr[i], tileStatuses[i]);
    }

    if (currentGuessStr === targetWordStr) {
      boardsData[b].solved = true;
      boardEl.classList.add("solved");

      if (currentRow === 0) {
        roundPointsGained = roundPointsGained - (correctPosition * 3000 + correctLetters * 1000) + 20000;
      }
    }
  }

  totalRoundScore += roundPointsGained;
  currentRow++;
  currentCol = 0;

  if (boardsData.every(b => b.solved)) {
    statusText.innerText = `Vitória! 🎉 +${totalRoundScore} pts no Nível ${currentLevel}`;
    saveScore(totalRoundScore);
    showEndGameModal(true);
    currentRow = MAX_ROWS;
    return;
  }

  if (currentRow === MAX_ROWS) {
    statusText.innerText = `Fim de jogo! Resposta: ${targetWords.join(" | ")}`;
    if (totalRoundScore > 0) saveScore(totalRoundScore);
    showEndGameModal(false);
    return;
  }

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
    body: JSON.stringify({ username: currentUser.username, score: scorePoints, level: currentLevel })
  });
  const data = await response.json();
  
  if (data.success) {
    // Atualiza dinamicamente a chave do respectivo nível na sessão local
    if (currentLevel === 1) currentUser.points_n1 = data.newPoints;
    if (currentLevel === 2) currentUser.points_n2 = data.newPoints;
    if (currentLevel === 3) currentUser.points_n3 = data.newPoints;
    
    localStorage.setItem("user", JSON.stringify(currentUser));
    updatePointsDisplay();
    loadRanking();
  }
}

/* =========================
   FLUXO DE POPUPS DO FIM DE JOGO
========================= */
function showEndGameModal(isVictory) {
  // Remove modais antigos caso existam
  const oldModal = document.getElementById("custom-modal");
  if (oldModal) oldModal.remove();

  const modal = document.createElement("div");
  modal.id = "custom-modal";
  modal.className = "modal-overlay";

  const content = document.createElement("div");
  content.className = "modal-content";

  const title = document.createElement("h2");
  title.innerText = isVictory ? "Sensacional! 🎉" : "Não foi dessa vez! 😢";

  const text = document.createElement("p");
  text.innerHTML = isVictory 
    ? `Você superou o Nível ${currentLevel} fazendo <strong>+${totalRoundScore}</strong> pontos!`
    : `Você acumulou parciais de <strong>+${totalRoundScore}</strong> pontos. As palavras eram: <br><strong>${targetWords.join(" | ")}</strong>`;

  const btnContainer = document.createElement("div");
  btnContainer.className = "modal-buttons";

  // Botão 1: Resetar (Sempre dá F5 na página de acordo com as regras estabelecidas)
  const btnReset = document.createElement("button");
  btnReset.innerText = "Resetar (F5)";
  btnReset.className = "m-btn m-btn-reset";
  btnReset.addEventListener("click", () => {
    window.location.reload();
  });

  btnContainer.appendChild(btnReset);

  // Configuração dos botões baseada no progresso linear do jogador
  if (currentLevel === 1) {
    if (isVictory) {
      const btnNext = document.createElement("button");
      btnNext.innerText = "Mudar de Nível (Dueto)";
      btnNext.className = "m-btn m-btn-next";
      btnNext.addEventListener("click", () => {
        currentLevel = 2;
        modal.remove();
        startNewGame();
      });
      btnContainer.appendChild(btnNext);
    }
  } 
  else if (currentLevel === 2) {
    if (isVictory) {
      const btnNext = document.createElement("button");
      btnNext.innerText = "Mudar de Nível (Quarteto)";
      btnNext.className = "m-btn m-btn-next";
      btnNext.addEventListener("click", () => {
        currentLevel = 3;
        modal.remove();
        startNewGame();
      });
      btnContainer.appendChild(btnNext);
    }
  } 
  else if (currentLevel === 3) {
    // No nível de 4 colunas, adiciona a opção de resetar as 4 colunas ou voltar à estaca inicial
    const btnBackTo1 = document.createElement("button");
    btnBackTo1.innerText = "Voltar ao Nível 1";
    btnBackTo1.className = "m-btn m-btn-back";
    btnBackTo1.addEventListener("click", () => {
      currentLevel = 1;
      modal.remove();
      startNewGame();
    });
    btnContainer.appendChild(btnBackTo1);
  }

  content.appendChild(title);
  content.appendChild(text);
  content.appendChild(btnContainer);
  modal.appendChild(content);
  document.body.appendChild(modal);
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
  await startNewGame();
}

init();