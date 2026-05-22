const boardContainer = document.getElementById("board");
const statusText = document.getElementById("status");
const keyboardContainer = document.getElementById("keyboard");

let currentLevel = 1; 
let currentMode = 1;  
let targetWords = []; 
const MAX_ROWS = 6;
const MAX_COLS = 5;

let currentRow = 0;
let currentCol = 0; 
let totalRoundScore = 0; 

let guesses = [];
let boardsData = []; 

let currentUser = JSON.parse(localStorage.getItem("user"));

/* ==========================================================================
   MAPEAMENTO DAS SUAS IMAGENS REAIS
   ========================================================================== */
const listaAvataresReais = ["Dino", "Dog", "Freddy", "Gator", "Gengar", "Giraffe", "Monkey", "Shrimp"];

const listaBordasReais = [
  { id: "default", nome: "Sem Borda" },
  { id: "iron-border", nome: "Borda Ferro" },
  { id: "bronze-border", nome: "Borda Bronze" },
  { id: "silver-border", nome: "Borda Prata" },
  { id: "gold-border", nome: "Borda Ouro" },
  { id: "platinum-border", nome: "Borda Platina" },
  { id: "diamond-border", nome: "Borda Diamante" },
  { id: "imortal-1-border", nome: "Borda Imortal I" },
  { id: "imortal-2-border", nome: "Borda Imortal II" },
  { id: "imortal-3-border", nome: "Borda Imortal III" },
  { id: "Radiant-border", nome: "Borda Radiante" } 
];

/* ==========================================================================
   SISTEMA DE RANKED (ELOS ATUALIZADOS ATÉ O RADIANTE)
   ========================================================================== */
function obterElo(pontos) {
  if (pontos < 10000) return "Ferro";
  if (pontos < 50000) return "Bronze";
  if (pontos < 150000) return "Prata";
  if (pontos < 500000) return "Ouro";
  if (pontos < 1500000) return "Platina";
  if (pontos < 3000000) return "Diamante";
  if (pontos < 5000000) return "Ascendente";
  if (pontos < 7000000) return "Imortal 1";
  if (pontos < 9000000) return "Imortal 2";
  if (pontos < 12000000) return "Imortal 3";
  return "Radiante";
}

// Converte os nomes dos Elos para bater exatamente com seus arquivos png
function formatarNomeImg(nomeElo) {
  let nome = nomeElo.toLowerCase();
  if (nome === "imortal 1") return "immortal-1";
  if (nome === "imortal 2") return "immortal-2";
  if (nome === "imortal 3") return "immortal-3";
  if (nome === "diamante") return "diamond";     // CORRIGIDO: Seus arquivos físicos usam o termo em inglês
  if (nome === "ascendente") return "ascendant"; 
  return nome;
}

/* ==========================================================================
   INTERAÇÃO DO MENU SUPERIOR DE COSMÉTICOS (ABAS E SELEÇÃO)
   ========================================================================== */
function toggleCosmeticsMenu() {
  const menu = document.getElementById("cosmetics-dropdown");
  if(menu) menu.style.display = menu.style.display === "none" ? "block" : "none";
}

function switchCosmeticsTab(tabId) {
  document.querySelectorAll(".cosmetics-panel").forEach(p => p.style.display = "none");
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  
  document.getElementById(tabId).style.display = "block";
  if(tabId === 'tab-avatars') document.getElementById("btn-tab-avatars").classList.add("active");
  if(tabId === 'tab-borders') document.getElementById("btn-tab-borders").classList.add("active");
}

// Renderiza dinamicamente as opções dentro do dropdown de cosméticos
function renderCosmeticsGrid() {
  const gridAvatars = document.getElementById("grid-avatars");
  const gridBorders = document.getElementById("grid-borders");
  if (!gridAvatars || !gridBorders || !currentUser) return;

  const avatarAtual = typeof currentUser.avatar === "string" ? currentUser.avatar : "Dino";
  const bordaAtual = currentUser.border || "default";

  // 1. Renderizar fotos (.jpg)
  gridAvatars.innerHTML = "";
  listaAvataresReais.forEach(nomeAv => {
    const img = document.createElement("img");
    img.src = `assets/avatars/${nomeAv}.jpg`;
    img.className = `item-select-preview ${avatarAtual === nomeAv ? 'selected' : ''}`;
    img.title = nomeAv;
    img.onclick = () => selecionarAvatar(nomeAv);
    gridAvatars.appendChild(img);
  });

  // 2. Renderizar bordas (.png)
  gridBorders.innerHTML = "";
  listaBordasReais.forEach(borda => {
    if (borda.id === "default") {
      const div = document.createElement("div");
      div.className = `item-select-preview ${bordaAtual === "default" ? 'selected' : ''}`;
      div.style.display = "flex";
      div.style.alignItems = "center";
      div.style.justifyContent = "center";
      div.style.fontSize = "12px";
      div.innerText = borda.nome;
      div.onclick = () => selecionarBorda("default");
      gridBorders.appendChild(div);
    } else {
      const img = document.createElement("img");
      img.src = `assets/borders/${borda.id}.png`;
      img.className = `item-select-preview ${bordaAtual === borda.id ? 'selected' : ''}`;
      img.title = borda.nome;
      img.onclick = () => selecionarBorda(borda.id);
      gridBorders.appendChild(img);
    }
  });
}

async function selecionarAvatar(nomeAvatar) {
  if (!currentUser) return;
  currentUser.avatar = nomeAvatar;
  localStorage.setItem("user", JSON.stringify(currentUser));
  updatePointsDisplay();
  renderCosmeticsGrid();
  await salvarCosmeticosNoServidor();
}

async function selecionarBorda(idBorda) {
  if (!currentUser) return;
  currentUser.border = idBorda;
  localStorage.setItem("user", JSON.stringify(currentUser));
  updatePointsDisplay();
  renderCosmeticsGrid();
  await salvarCosmeticosNoServidor();
}

async function salvarCosmeticosNoServidor() {
  try {
    await fetch("/update-cosmetics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: currentUser.username,
        avatar: currentUser.avatar || "Dino",
        border: currentUser.border || "default"
      })
    });
  } catch (err) {
    console.error("Erro ao sincronizar cosméticos com o banco:", err);
  }
}

/* ==========================================================================
   VERIFICAÇÃO DE LOGIN E PERFIL
   ========================================================================== */
function checkUserSession() {
  if (!currentUser) {
    window.location.href = "/login";
    return;
  }
  
  if (document.getElementById("profile-username")) {
    document.getElementById("profile-username").innerText = currentUser.username;
  }
  
  updatePointsDisplay();
  renderCosmeticsGrid();

  if (currentUser.theme) {
    changeTheme(currentUser.theme, false);
    const themeSelect = document.getElementById("theme-select");
    if (themeSelect) themeSelect.value = currentUser.theme;
  }
}

async function syncUserWithServer() {
  if (!currentUser) return;
  try {
    const response = await fetch("/sync-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: currentUser.username,
        points: Number(currentUser.points) || 0,
        theme: currentUser.theme || "default",
        avatar: currentUser.avatar || "Dino",
        border: currentUser.border || "default"
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log("Sincronização realizada com sucesso:", data.message);
    }
  } catch (err) {
    console.error("Erro ao sincronizar sessão com o ranking:", err);
  }
}

function updatePointsDisplay() {
  if (!currentUser) return;
  let pts = Number(currentUser.points) || 0;
  
  const pointsEl = document.getElementById("profile-points");
  const eloIconEl = document.getElementById("profile-elo-icon"); 
  const avatarImgEl = document.getElementById("profile-avatar-img");
  const borderImgEl = document.getElementById("profile-border-img");
  
  const eloAtual = obterElo(pts);

  if (pointsEl) {
    pointsEl.innerHTML = `${pts.toLocaleString()} pts <br><span class="elo-tag elo-${formatarNomeImg(eloAtual)}" style="font-weight:bold; font-size:13px; color: #ff4655;">Elo: ${eloAtual}</span>`;
  }

  // Atualiza Foto Circular (.jpg)
  if (avatarImgEl) {
    const avatarSalvo = typeof currentUser.avatar === "string" ? currentUser.avatar : "Dino";
    avatarImgEl.src = `assets/avatars/${avatarSalvo}.jpg`;
  }

  // Atualiza Borda Sobreposta (.png)
  if (borderImgEl) {
    const borda = currentUser.border || "default";
    if (borda === "default") {
      borderImgEl.style.display = "none";
    } else {
      borderImgEl.src = `assets/borders/${borda}.png`;
      borderImgEl.style.display = "block";
    }
  }

  // Mini Ícone do Elo (.png) - Tratado e corrigido o caminho
  if (eloIconEl) {
    eloIconEl.src = `assets/elos/${formatarNomeImg(eloAtual)}.png`;
    eloIconEl.alt = `Elo ${eloAtual}`;
    eloIconEl.style.display = "block"; 
    eloIconEl.onerror = function() {
      this.style.display = "none"; 
    };
  }
}

/* ==========================================================================
   CONTROLE DE TEMAS
   ========================================================================== */
async function changeTheme(themeName, sendToServer = true) {
  const body = document.getElementById("game-body");
  if (body) {
    body.className = ""; 
    body.classList.add(`theme-${themeName}`);
  }

  if (currentUser) {
    currentUser.theme = themeName;
    localStorage.setItem("user", JSON.stringify(currentUser));

    if (sendToServer) {
      try {
        await fetch("/update-theme", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: currentUser.username, theme: themeName })
        });
      } catch(e) {
        console.error("Erro ao salvar tema no servidor", e);
      }
    }
  }
}

/* ==========================================================================
   RANKING GERAL (CORREÇÃO DA VALIDAÇÃO E FILTRO DE AVATARES EM LOOP)
   ========================================================================== */
async function loadRanking() {
  try {
    const response = await fetch(`/ranking`);
    if (!response.ok) throw new Error("Falha na requisição do ranking");
    
    const data = await response.json();
    const list = document.getElementById("ranking-list");
    if (!list) return;
    list.innerHTML = "";

    if (Array.isArray(data)) {
      data.forEach((player, index) => {
        const itemLi = document.createElement("li");
        itemLi.classList.add("ranking-item");
        const playerElo = obterElo(player.points || 0);
        
        const hasBorder = player.border && player.border !== 'default';
        const borderSrc = hasBorder ? `src="assets/borders/${player.border}.png"` : '';
        const borderStyle = hasBorder ? 'display:block;' : 'display:none;';
        
        // CORREÇÃO: Garante que lê estritamente a string vinda do banco individual de cada player
        const playerAvatarFile = typeof player.avatar === "string" && player.avatar.trim() !== "" ? player.avatar : "Dino";

        itemLi.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-weight:bold; width:20px; text-align: left;">${index + 1}°</span>
            
            <div class="ranking-avatar-wrapper">
              <img src="assets/avatars/${playerAvatarFile}.jpg" class="ranking-avatar-img" onerror="this.src='assets/avatars/Dino.jpg'">
              <img ${borderSrc} class="ranking-border-overlay" style="${borderStyle}">
            </div>

            <div class="ranking-info">
              <strong>${player.username || "Anônimo"}</strong> <small style="color: #ff4655;">(${playerElo})</small><br>
              <span style="font-size:12px; opacity:0.8;">${(player.points || 0).toLocaleString()} pts</span>
            </div>
          </div>
          <img src="assets/elos/${formatarNomeImg(playerElo)}.png" alt="${playerElo}" class="ranking-elo-img" onerror="this.style.opacity='0'" style="width: 28px; height: 28px; object-fit: contain; display: block;">
        `;
        list.appendChild(itemLi);
      });
    }
  } catch (err) {
    console.error("Erro ao carregar o ranking:", err);
  }
}

/* ==========================================================================
   TECLADO VIRTUAL
   ========================================================================== */
const keyboardRows = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ç"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"]
];

function createKeyboard() {
  if (!keyboardContainer) return;
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

/* ==========================================================================
   SISTEMA DE DIGITAÇÃO E SELEÇÃO DE CAIXA
   ========================================================================== */
function selectTile(colIndex) {
  if (currentRow >= MAX_ROWS) return;
  currentCol = colIndex;
  renderActiveTileIndicator();
}

function renderActiveTileIndicator() {
  document.querySelectorAll(".tile").forEach(tile => tile.classList.remove("active-tile"));
  for (let b = 0; b < currentMode; b++) {
    if (boardsData[b] && !boardsData[b].solved) {
      const activeTile = document.getElementById(`tile-${b}-${currentRow}-${currentCol}`);
      if (activeTile) activeTile.classList.add("active-tile");
    }
  }
}

function pressKey(key) {
  if (currentRow >= MAX_ROWS || boardsData.every(b => b.solved)) return;

  if (key === "ArrowLeft" || key === "ARROWLEFT") {
    if (currentCol > 0) { currentCol--; renderActiveTileIndicator(); }
  }
  else if (key === "ArrowRight" || key === "ARROWRIGHT") {
    if (currentCol < MAX_COLS - 1) { currentCol++; renderActiveTileIndicator(); }
  }
  else if (/^[A-ZÇ]$/i.test(key) && key.length === 1) {
    if (currentCol < MAX_COLS) {
      const upperKey = key.toUpperCase();
      for (let b = 0; b < currentMode; b++) {
        if (boardsData[b] && !boardsData[b].solved) {
          guesses[b][currentRow][currentCol] = upperKey;
          updateTile(b, currentRow, currentCol, upperKey);
        }
      }
      if (currentCol < MAX_COLS - 1) currentCol++;
      renderActiveTileIndicator();
    }
  }
  else if (key === "Backspace" || key === "BACKSPACE") {
    const firstActive = boardsData.findIndex(b => !b.solved);
    if(firstActive === -1) return;
    const tileHasContent = guesses[firstActive][currentRow][currentCol] !== "";

    for (let b = 0; b < currentMode; b++) {
      if (boardsData[b] && !boardsData[b].solved) {
        if (tileHasContent) {
          guesses[b][currentRow][currentCol] = "";
          updateTile(b, currentRow, currentCol, "");
        } else if (currentCol > 0) {
          guesses[b][currentRow][currentCol - 1] = "";
          updateTile(b, currentRow, currentCol - 1, "");
        }
      }
    }
    if (!tileHasContent && currentCol > 0) currentCol--;
    renderActiveTileIndicator();
  }
  else if (key === "Enter" || key === "ENTER") {
    const firstActive = boardsData.findIndex(b => !b.solved);
    if(firstActive === -1) return;
    const isComplete = guesses[firstActive][currentRow].every(letter => letter !== "");
    if (isComplete) {
      if(statusText) statusText.innerText = "";
      checkWord();
    } else {
      if(statusText) statusText.innerText = "Palavra incompleta";
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

/* ==========================================================================
   GERENCIAMENTO DE NÍVEIS
   ========================================================================== */
async function startNewGame() {
  currentRow = 0;
  currentCol = 0;
  totalRoundScore = 0;
  targetWords = [];
  guesses = [];
  boardsData = [];
  if(statusText) statusText.innerText = "";
  
  if (currentLevel === 1) currentMode = 1;
  if (currentLevel === 2) currentMode = 2;
  if (currentLevel === 3) currentMode = 4;

  if(boardContainer) {
    boardContainer.innerHTML = "";
    boardContainer.className = `mode-${currentMode}`;
  }

  updatePointsDisplay();
  await loadRanking();

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

  if(boardContainer) {
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
  }
  createKeyboard();
  renderActiveTileIndicator();
}

/* ==========================================================================
   VALIDAÇÃO DA TENTATIVA
   ========================================================================== */
function checkWord() {
  document.querySelectorAll(".tile").forEach(t => t.classList.remove("active-tile"));
  document.querySelectorAll(".row-active").forEach(r => r.classList.remove("row-active"));

  let roundPointsGained = 0; 
  const firstActive = boardsData.findIndex(b => !b.solved);
  if(firstActive === -1) return;
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
      if(boardEl) boardEl.classList.add("solved");
      if (currentRow === 0) {
        roundPointsGained = roundPointsGained - (correctPosition * 3000 + correctLetters * 1000) + 20000;
      }
    }
  }

  totalRoundScore += roundPointsGained;
  currentRow++;
  currentCol = 0;

  if (boardsData.every(b => b.solved)) {
    if(statusText) statusText.innerText = `Vitória! 🎉 +${totalRoundScore} pts`;
    saveScore(totalRoundScore, true); 
    showEndGameModal(true);
    currentRow = MAX_ROWS;
    return;
  }

  if (currentRow === MAX_ROWS) {
    if(statusText) statusText.innerText = `Fim de jogo!`;
    saveScore(0, false); 
    showEndGameModal(false);
    return;
  }

  for (let b = 0; b < currentMode; b++) {
    if (boardsData[b] && !boardsData[b].solved) {
      const board = document.getElementById(`board-${b}`);
      if (board && board.children[currentRow]) {
        board.children[currentRow].classList.add("row-active");
      }
    }
  }
  renderActiveTileIndicator();
}

/* ==========================================================================
   SALVA O SCORE NO BANCO E AVANÇA O NÍVEL COMPETITIVO AUTOMATICAMENTE
   ========================================================================== */
async function saveScore(scorePoints, e_Vitoria) {
  if (!currentUser) return;
  const wordsSolvedCount = boardsData.filter(b => b.solved).length;
  let finalCalculatedScore = scorePoints;

  if (wordsSolvedCount === 0) {
    finalCalculatedScore = -15000;
  } else {
    if (currentLevel === 2) finalCalculatedScore = Math.floor(scorePoints * 2); 
    if (currentLevel === 3) finalCalculatedScore = Math.floor(scorePoints * 2.5); 
  }

  if (e_Vitoria) {
    if (currentLevel < 3) {
      currentLevel++;
    } else {
      currentLevel = 1; 
    }
  }

  try {
    const response = await fetch("/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        username: currentUser.username, 
        score: finalCalculatedScore, 
        wordsSolved: wordsSolvedCount 
      })
    });
    const data = await response.json();
    if (data.success) {
      currentUser.points = data.newPoints;
      localStorage.setItem("user", JSON.stringify(currentUser));
      updatePointsDisplay();
      await loadRanking();
    }
  } catch(e) {
    console.error("Erro crítico ao salvar pontuação:", e);
  }
}

/* ==========================================================================
   POPUPS DO FIM DE JOGO
   ========================================================================== */
function showEndGameModal(isVictory) {
  const oldModal = document.getElementById("custom-modal");
  if (oldModal) oldModal.remove();

  const modal = document.createElement("div");
  modal.id = "custom-modal";
  modal.className = "modal-overlay";

  const content = document.createElement("div");
  content.className = "modal-content";

  const title = document.createElement("h2");
  title.innerText = isVictory ? "Sensacional! 🎉" : "Derrota Comp! 😢";

  const wordsSolvedCount = boardsData.filter(b => b.solved).length;
  let multiplierVal = 1;
  if(currentLevel === 2) multiplierVal = 2;
  if(currentLevel === 3) multiplierVal = 2.5;

  const baseScore = wordsSolvedCount > 0 ? totalRoundScore : 0;
  const finalScoreToShow = wordsSolvedCount === 0 ? -15000 : Math.floor(baseScore * multiplierVal);

  const text = document.createElement("p");
  if (wordsSolvedCount === 0) {
    text.innerHTML = `Você gastou todos os seus palpites. Erro Grave! <br><span style="color:#ff4655; font-weight:bold;">Perdeu -15.000 PDL</span>.<br><br>As respostas eram:<br><strong>${targetWords.join(" | ")}</strong>`;
  } else {
    text.innerHTML = `Você venceu o desafio garantindo <strong>+${finalScoreToShow.toLocaleString()}</strong> pontos!<br><br>Aguarde o carregamento do próximo nível.`;
  }

  const btnContainer = document.createElement("div");
  btnContainer.className = "modal-buttons";

  const btnReset = document.createElement("button");
  btnReset.innerText = "Avançar Próxima Partida";
  btnReset.className = "m-btn m-btn-next";
  btnReset.addEventListener("click", () => {
    modal.remove();
    startNewGame(); 
  });
  btnContainer.appendChild(btnReset);

  modal.appendChild(content);
  content.appendChild(title);
  content.appendChild(text);
  content.appendChild(btnContainer);
  document.body.appendChild(modal);
}

function logout() {
  localStorage.removeItem("user");
  window.location.href = "/login";
}

/* ==========================================================================
   SISTEMA INTERATIVO DO MODAL DE CONQUISTAS
   ========================================================================== */
function openAchievementsModal() {
  const modal = document.getElementById("achievements-modal");
  if (!modal) return;
  modal.style.display = "flex";
  
  const pts = Number(currentUser.points) || 0;
  const elosConfig = [
    { id: "ach-ferro", min: 0 }, { id: "ach-bronze", min: 10000 }, { id: "ach-prata", min: 50000 },
    { id: "ach-ouro", min: 150000 }, { id: "ach-platina", min: 500000 }, { id: "ach-diamante", min: 1500000 },
    { id: "ach-ascendente", min: 3000000 }, { id: "ach-imortal1", min: 5000000 }, { id: "ach-imortal2", min: 7000000 },
    { id: "ach-imortal3", min: 9000000 }, { id: "ach-radiante", min: 12000000 }
  ];

  elosConfig.forEach(elo => {
    const card = document.getElementById(elo.id);
    if (card) {
      if (pts >= elo.min) {
        card.classList.add("unlocked");
        card.querySelector(".ach-status").textContent = "✅";
      } else {
        card.classList.remove("unlocked");
        card.querySelector(".ach-status").textContent = "🔒";
      }
    }
  });
}

function closeAchievementsModal() {
  const modal = document.getElementById("achievements-modal");
  if (modal) modal.style.display = "none";
}

/* ==========================================================================
   INICIALIZAÇÃO DO JOGO
   ========================================================================== */
async function init() {
  checkUserSession();
  await syncUserWithServer(); 
  await startNewGame();
}

init();