const board = document.getElementById("board");
const statusText = document.getElementById("status");
const keyboardContainer = document.getElementById("keyboard");

let WORD = "";
const MAX_ROWS = 6;
const MAX_COLS = 5;

let currentRow = 0;
let currentCol = 0; 
let score = 0;

let guesses = Array.from({ length: MAX_ROWS }, () => Array(MAX_COLS).fill(""));
let currentUser = JSON.parse(localStorage.getItem("user"));

/* =========================
   VERIFICAÇÃO DE LOGIN E PERFIL (ATUALIZADO)
========================= */
function checkUserSession() {
  if (!currentUser) {
    window.location.href = "/login";
    return;
  }
  document.getElementById("profile-username").innerText = currentUser.username;
  document.getElementById("profile-points").innerText = currentUser.points;
  
  // Extrai a primeira letra do nome do jogador para preencher o avatar redondo
  const initial = currentUser.username.charAt(0).toUpperCase();
  document.getElementById("profile-avatar").innerText = initial;

  if (currentUser.theme) {
    changeTheme(currentUser.theme, false);
    document.getElementById("theme-select").value = currentUser.theme;
  }
}

/* =========================
   CONTROLE DE TEMAS
========================= */
async function changeTheme(themeName, sendToServer = true) {
  const body = document.getElementById("game-body");
  body.className = ""; 
  body.classList.add(`theme-${themeName}`);

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
   RANKING COM INICIAIS (ATUALIZADO)
========================= */
async function loadRanking() {
  const response = await fetch("/ranking");
  const data = await response.json();
  const list = document.getElementById("ranking-list");
  list.innerHTML = "";

  data.forEach((player, index) => {
    const itemDiv = document.createElement("li");
    itemDiv.classList.add("ranking-item");

    // Extrai a inicial de cada oponente do ranking em tempo de execução
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
   SISTEMA DE DIGITAÇÃO LIVRE E SELEÇÃO DE CAIXA
========================= */
function selectTile(colIndex) {
  if (currentRow >= MAX_ROWS) return;
  currentCol = colIndex;
  renderActiveTileIndicator();
}

function renderActiveTileIndicator() {
  for (let c = 0; c < MAX_COLS; c++) {
    const tile = document.getElementById(`tile-${currentRow}-${c}`);
    if (tile) tile.classList.remove("active-tile");
  }

  if (currentCol < MAX_COLS && currentCol >= 0) {
    const activeTile = document.getElementById(`tile-${currentRow}-${currentCol}`);
    if (activeTile) activeTile.classList.add("active-tile");
  }
}

function pressKey(key) {
  if (currentRow >= MAX_ROWS) return;

  if (/^[A-ZÇ]$/i.test(key) && key.length === 1) {
    if (currentCol < MAX_COLS) {
      guesses[currentRow][currentCol] = key.toUpperCase();
      updateTile(currentRow, currentCol, key.toUpperCase());
      
      if (currentCol < MAX_COLS - 1) {
        currentCol++;
      }
      renderActiveTileIndicator();
    }
  }
  else if (key === "Backspace" || key === "BACKSPACE") {
    if (guesses[currentRow][currentCol] !== "") {
      guesses[currentRow][currentCol] = "";
      updateTile(currentRow, currentCol, "");
    } 
    else if (currentCol > 0) {
      currentCol--;
      guesses[currentRow][currentCol] = "";
      updateTile(currentRow, currentCol, "");
    }
    renderActiveTileIndicator();
  }
  else if (key === "Enter" || key === "ENTER") {
    const isComplete = guesses[currentRow].every(letter => letter !== "");
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

function updateTile(row, col, letter) {
  const tile = document.getElementById(`tile-${row}-${col}`);
  if (tile) tile.textContent = letter;
}

/* =========================
   LÓGICA DO JOGO
========================= */
async function loadWord() {
  const response = await fetch("/word");
  const data = await response.json();
  WORD = data.word.toUpperCase();
}

function createBoard() {
  board.innerHTML = "";
  for (let r = 0; r < MAX_ROWS; r++) {
    const row = document.createElement("div");
    row.classList.add("row");
    if (r === currentRow) row.classList.add("row-active");

    for (let c = 0; c < MAX_COLS; c++) {
      const tile = document.createElement("div");
      tile.classList.add("tile");
      tile.id = `tile-${r}-${c}`;
      
      tile.addEventListener("click", () => {
        if (r === currentRow) selectTile(c);
      });

      row.appendChild(tile);
    }
    board.appendChild(row);
  }
  renderActiveTileIndicator();
}

function checkWord() {
  const guess = guesses[currentRow].join("");
  const wordArr = WORD.split("");
  const guessArr = guess.split("");
  const tileStatuses = Array(MAX_COLS).fill("absent");
  const used = Array(MAX_COLS).fill(false);

  const activeRow = document.querySelector(".row-active");
  if (activeRow) {
    for (let c = 0; c < MAX_COLS; c++) {
      const tile = document.getElementById(`tile-${currentRow}-${c}`);
      if (tile) tile.classList.remove("active-tile");
    }
    activeRow.classList.remove("row-active");
  }

  for (let i = 0; i < MAX_COLS; i++) {
    if (guessArr[i] === wordArr[i]) {
      tileStatuses[i] = "correct";
      used[i] = true;
    }
  }

  for (let i = 0; i < MAX_COLS; i++) {
    if (tileStatuses[i] === "correct") continue;
    for (let j = 0; j < MAX_COLS; j++) {
      if (!used[j] && guessArr[i] === wordArr[j]) {
        tileStatuses[i] = "present";
        used[j] = true;
        break;
      }
    }
  }

  let correctPosition = 0;
  let correctLetters = 0;

  for (let i = 0; i < MAX_COLS; i++) {
    const tile = document.getElementById(`tile-${currentRow}-${i}`);
    if (tile) tile.classList.add(tileStatuses[i]);
    updateKeyboardColors(guessArr[i], tileStatuses[i]);

    if (tileStatuses[i] === "correct") correctPosition++;
    if (tileStatuses[i] === "present") correctLetters++;
  }

  if (guess === WORD) {
    score = calculateScore(correctLetters, correctPosition);
    statusText.innerText = `Você venceu 😎 | +${score} pontos`;
    saveScore(score);
    currentRow = MAX_ROWS;
    return;
  }

  currentRow++;
  currentCol = 0;

  if (currentRow === MAX_ROWS) {
    statusText.innerText = `A palavra era ${WORD}`;
  } else {
    const rows = document.getElementsByClassName("row");
    if (rows[currentRow]) rows[currentRow].classList.add("row-active");
    renderActiveTileIndicator();
  }
}

function calculateScore(correctLetters, correctPosition) {
  if (correctPosition === 5) return 20000;
  if (correctLetters === 4 && correctPosition === 4) return 19000;
  if (correctLetters === 4) return 15000;
  if (correctLetters === 3 && correctPosition === 3) return 10000;
  return 1000;
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
   INICIALIZAÇÃO
========================= */
async function init() {
  checkUserSession();
  await loadWord();
  createBoard();
  createKeyboard();
  loadRanking();
}

init();