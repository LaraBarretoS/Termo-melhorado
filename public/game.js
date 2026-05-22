// ==========================================================================
// BLOCO: VARIÁVEIS GLOBAIS E CONFIGURAÇÕES INICIAIS DO JOGO
// ==========================================================================
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


// ==========================================================================
// BLOCO: MAPEAMENTO DE ARQUIVOS FÍSICOS (AVATARES E BORDAS)
// ==========================================================================
const listaAvataresReais = ["Dino", "Dog", "Freddy", "Gator", "Gengar", "Giraffe", "Monkey", "Shrimp", "Bunny"];

const listaBordasReais = [
  { id: "default", nome: "Sem Borda" },
  { id: "iron-border", nome: "Borda Ferro" },
  { id: "bronze-border", nome: "Borda Bronze" },
  { id: "silver-border", nome: "Borda Prata" },
  { id: "gold-border", nome: "Borda Ouro" },
  { id: "platinum-border", nome: "Borda Platina" },
  { id: "ascendant-border", nome: "Borda Ascendente" }, 
  { id: "imortal-1-border", nome: "Borda Imortal I" },
  { id: "imortal-2-border", nome: "Borda Imortal II" },
  { id: "imortal-3-border", nome: "Borda Imortal III" },
  { id: "Radiant-border", nome: "Borda Radiante" } 
];


// ==========================================================================
// BLOCO: REGRAS DE ELO E PADRONIZAÇÃO DE IMAGENS (SISTEMA RANKED)
// ==========================================================================
function obterElo(pontos) {
  const pts = Number(pontos) || 0;
  if (pts < 10000) return "Ferro";
  if (pts < 50000) return "Bronze";
  if (pts < 150000) return "Prata";
  if (pts < 500000) return "Ouro";
  if (pts < 1500000) return "Platina";
  if (pts < 3000000) return "Diamante";
  if (pts < 5000000) return "Ascendente";
  if (pts < 7000000) return "Imortal 1";
  if (pts < 9000000) return "Imortal 2";
  if (pts < 12000000) return "Imortal 3";
  return "Radiante";
}

function formatarNomeImg(nomeElo) {
  let nome = nomeElo.toLowerCase().trim();
  if (nome === "ferro") return "iron";
  if (nome === "bronze") return "bronze";
  if (nome === "prata") return "silver";
  if (nome === "ouro") return "gold";
  if (nome === "platina") return "platinum";
  if (nome === "diamante") return "diamond";     
  if (nome === "ascendente") return "ascendant"; 
  if (nome === "imortal 1") return "immortal-1";
  if (nome === "imortal 2") return "immortal-2";
  if (nome === "imortal 3") return "immortal-3";
  if (nome === "radiante") return "radiant";
  return nome;
}


// ==========================================================================
// BLOCO: NOVO POP-UP INTERATIVO DE COSMÉTICOS (LOJA / MODAL)
// ==========================================================================
function openCosmeticsModal() {
  const modal = document.getElementById("cosmetics-modal");
  if (!modal) return;
  modal.style.display = "flex"; 
  renderCosmeticsGrid();        
}

function closeCosmeticsModal() {
  const modal = document.getElementById("cosmetics-modal");
  if (modal) modal.style.display = "none";
}

function switchCosmeticsTab(tabId) {
  document.querySelectorAll(".cosmetics-panel").forEach(p => p.style.display = "none");
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  
  document.getElementById(tabId).style.display = "block";
  if(tabId === 'tab-avatars') document.getElementById("btn-tab-avatars").classList.add("active");
  if(tabId === 'tab-borders') document.getElementById("btn-tab-borders").classList.add("active");
}

function renderCosmeticsGrid() {
  const gridAvatars = document.getElementById("grid-avatars");
  const gridBorders = document.getElementById("grid-borders");
  if (!gridAvatars || !gridBorders || !currentUser) return;

  const avatarAtual = typeof currentUser.avatar === "string" ? currentUser.avatar : "Dino";
  const bordaAtual = currentUser.border || "default";
  const pointsJogador = Number(currentUser.points) || 0;

  gridAvatars.innerHTML = "";
  listaAvataresReais.forEach(nomeAv => {
    const img = document.createElement("img");
    
    // CORREÇÃO: Identifica a extensão correta baseada no arquivo físico do avatar
    const extensao = nomeAv === "Bunny" ? "png" : "jpg";
    img.src = `assets/avatars/${nomeAv}.${extensao}`; 
    
    img.className = `item-select-preview ${avatarAtual === nomeAv ? 'selected' : ''}`;
    img.title = nomeAv;
    img.onclick = () => selecionarAvatar(nomeAv);
    gridAvatars.appendChild(img);
  });

  const requisitosBordas = {
    "default": 0,
    "iron-border": 0,          
    "bronze-border": 10000,    
    "silver-border": 50000,    
    "gold-border": 150000,     
    "platinum-border": 500000,
    "diamond-border": 1500000,
    "ascendant-border": 3000000, 
    "imortal-1-border": 5000000,
    "imortal-2-border": 7000000,
    "imortal-3-border": 9000000,
    "Radiant-border": 12000000
  };

  gridBorders.innerHTML = "";
  listaBordasReais.forEach(borda => {
    const pontosNecessarios = requisitosBordas[borda.id] || 0;
    const estaBloqueada = pointsJogador < pontosNecessarios;

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
      const wrapper = document.createElement("div");
      wrapper.style.position = "relative";
      wrapper.style.display = "inline-block";

      const img = document.createElement("img");
      img.src = `assets/borders/${borda.id}.png`;
      img.className = `item-select-preview ${bordaAtual === staticIdBorda(borda.id) ? 'selected' : ''}`;
      
      if (estaBloqueada) {
        img.classList.add("item-locked"); 
        img.title = `${borda.nome} (Bloqueada - Requer Elo Correspondente)`;
        
        const lockIcon = document.createElement("div");
        lockIcon.innerText = "🔒";
        lockIcon.style.position = "absolute";
        lockIcon.style.top = "50%";
        lockIcon.style.left = "50%";
        lockIcon.style.transform = "translate(-50%, -50%)";
        lockIcon.style.fontSize = "16px";
        lockIcon.style.pointerEvents = "none"; 
        
        wrapper.appendChild(img);
        wrapper.appendChild(lockIcon);
      } else {
        img.title = borda.nome;
        img.onclick = () => selecionarBorda(borda.id);
        wrapper.appendChild(img);
      }
      gridBorders.appendChild(wrapper);
    }
  });

  function staticIdBorda(id) { return id === "Radiant-border" ? "Radiant-border" : id; }
}

function selecionarAvatar(nomeAvatar) {
  if (!currentUser) return;
  currentUser.avatar = nomeAvatar;
  localStorage.setItem("user", JSON.stringify(currentUser));
  renderCosmeticsGrid(); 
}

function selecionarBorda(idBorda) {
  if (!currentUser) return;
  currentUser.border = idBorda;
  localStorage.setItem("user", JSON.stringify(currentUser));
  renderCosmeticsGrid(); 
}

async function salvarEAtualizarPagina() {
  if (!currentUser) return;
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
    window.location.reload();
  } catch (err) {
    console.error("Erro ao sincronizar cosméticos com o banco:", err);
    window.location.reload();
  }
}


// ==========================================================================
// BLOCO: VERIFICAÇÃO DE PERFIL E SINCRONIZAÇÃO DE USUÁRIO
// ==========================================================================
function checkUserSession() {
  if (!currentUser) {
    window.location.href = "/login";
    return;
  }
  
  if (document.getElementById("profile-username")) {
    document.getElementById("profile-username").innerText = currentUser.username;
  }
  
  updatePointsDisplay();

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
      console.log("Sincronização realizada com sucesso.");
    }
  } catch (err) {
    console.error("Erro ao sincronizar sessão com o ranking:", err);
  }
}


// ==========================================================================
// BLOCO: ATUALIZAÇÃO VISUAL DA INTERFACE DO PERFIL (PONTOS, ELO, FOTO, BORDA)
// ==========================================================================
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

  if (avatarImgEl) {
    const avatarSalvo = typeof currentUser.avatar === "string" ? currentUser.avatar : "Dino";
    // CORREÇÃO: Garante que o Bunny carregue como PNG no display superior do perfil
    const extensao = avatarSalvo === "Bunny" ? "png" : "jpg";
    avatarImgEl.src = `assets/avatars/${avatarSalvo}.${extensao}`;
  }

  if (borderImgEl) {
    const borda = currentUser.border || "default";
    if (borda === "default") {
      borderImgEl.style.display = "none";
    } else {
      borderImgEl.src = `assets/borders/${borda}.png`;
      borderImgEl.style.display = "block";
    }
  }

  if (eloIconEl) {
    eloIconEl.src = `assets/elos/${formatarNomeImg(eloAtual)}.png`;
    eloIconEl.alt = `Elo ${eloAtual}`;
    eloIconEl.style.display = "block"; 
    eloIconEl.onerror = function() {
      this.style.display = "none"; 
    };
  }
}


// ==========================================================================
// BLOCO: ALTERAÇÃO VISUAL DE TEMAS
// ==========================================================================
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


// ==========================================================================
// BLOCO: BUSCA E RENDERIZAÇÃO DO RANKING GERAL (SINCRONIZADO)
// ==========================================================================
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
        
        let playerAvatarFile = "Dino";
        let playerBorderFile = "default";

        if (currentUser && player.username === currentUser.username) {
          playerAvatarFile = currentUser.avatar || "Dino";
          playerBorderFile = currentUser.border || "default";
        } else {
          playerAvatarFile = typeof player.avatar === "string" && player.avatar.trim() !== "" ? player.avatar : "Dino";
          playerBorderFile = player.border || "default";
        }

        const hasBorder = playerBorderFile !== 'default';
        const borderSrc = hasBorder ? `src="assets/borders/${playerBorderFile}.png"` : '';
        const borderStyle = hasBorder ? 'display:block;' : 'display:none;';

        // CORREÇÃO: Garante que o Bunny use a extensão correta na lista do ranking global
        const extensaoAvatar = playerAvatarFile === "Bunny" ? "png" : "jpg";

        itemLi.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-weight:bold; width:20px; text-align: left;">${index + 1}°</span>
            
            <div class="ranking-avatar-wrapper">
              <img src="assets/avatars/${playerAvatarFile}.${extensaoAvatar}" class="ranking-avatar-img" onerror="this.src='assets/avatars/Dino.jpg'">
              <img ${borderSrc} class="ranking-border-overlay" style="${borderStyle}">
            </div>

            <div class="ranking-info">
              <strong>${player.username || "Anônimo"}</strong> <small style="color: #ff4655;">(${playerElo})</small><br>
              <span style="font-size:12px; opacity:0.8;">${(player.points || 0).toLocaleString()} pts</span>
            </div>
          </div>
          <img src="assets/elos/${formatarNomeImg(playerElo)}.png" alt="${playerElo}" class="ranking-elo-img" onerror="this.style.display='none';" style="width: 28px; height: 28px; object-fit: contain; display: block;">
        `;
        list.appendChild(itemLi);
      });
    }
  } catch (err) {
    console.error("Erro ao carregar o ranking:", err);
  }
}


// ==========================================================================
// BLOCO: TECLADO VIRTUAL DO JOGO
// ==========================================================================
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


// ==========================================================================
// BLOCO: ENTRADA DE DADOS E EVENTOS DE DIGITAÇÃO (MOUSEDOWN / KEYDOWN)
// ==========================================================================
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


// ==========================================================================
// BLOCO: GERENCIAMENTO DE NÍVEIS (1 QUADRO, 2 QUADROS OU 4 QUADROS)
// ==========================================================================
async function startNewGame() {
  currentRow = 0;
  currentCol = 0;
  totalRoundScore = 0;
  targetWords = [];
  guesses = [];
  boardsData = [];
  if(statusText) statusText.innerText = "";
  
  if (currentLevel === 1) currentMode = 1;
  else if (currentLevel === 2) currentMode = 2;
  else if (currentLevel === 3) currentMode = 4;
  else { currentLevel = 1; currentMode = 1; }

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
      boardEl.appendChild(rowEl);
    }
  }
  createKeyboard();
  renderActiveTileIndicator();
}


// ==========================================================================
// BLOCO: VERIFICAÇÃO E VALIDAÇÃO DAS LETRAS (CORRETO, QUASE, INCORRETO)
// ==========================================================================
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
    if(statusText) {
      statusText.innerText = `Fim de jogo! Resposta: ${targetWords.join(" | ")}`;
    }
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


// ==========================================================================
// BLOCO: SALVAR PONTUAÇÃO (BANCO DE DADOS / LOCALSTORAGE)
// ==========================================================================
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
  } else {
    currentLevel = 1;
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


// ==========================================================================
// BLOCO: INTERFACE DE TELA DE VITÓRIA OU DERROTA (MODAL OVERLAY)
// ==========================================================================
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


// ==========================================================================
// BLOCO: SISTEMA INTERATIVO DE CONQUISTAS (ACHIEVEMENTS MODAL)
// ==========================================================================
function openAchievementsModal() {
  const modal = document.getElementById("achievements-modal");
  if (!modal) return;
  modal.style.display = "flex";
  
  const pts = Number(currentUser.points) || 0;
  
  const elosConfig = [
    { id: "ach-ferro", min: 0 }, 
    { id: "ach-bronze", min: 10000 }, 
    { id: "ach-prata", min: 50000 },
    { id: "ach-ouro", min: 150000 }, 
    { id: "ach-platina", min: 500000 }, 
    { id: "ach-diamante", min: 1500000 }, 
    { id: "ach-ascendente", min: 3000000 }, 
    { id: "ach-imortal1", min: 5000000 }, 
    { id: "ach-imortal2", min: 7000000 },
    { id: "ach-imortal3", min: 9000000 }, 
    { id: "ach-radiante", min: 12000000 }
  ];

  elosConfig.forEach(elo => {
    const card = document.getElementById(elo.id);
    if (card) {
      if (pts >= elo.min) {
        card.classList.add("unlocked");
        const statusEl = card.querySelector(".ach-status");
        if (statusEl) statusEl.textContent = "✅";
      } else {
        card.classList.remove("unlocked");
        const statusEl = card.querySelector(".ach-status");
        if (statusEl) statusEl.textContent = "🔒";
      }
    }
  });
}

function closeAchievementsModal() {
  const modal = document.getElementById("achievements-modal");
  if (modal) modal.style.display = "none";
}


// ==========================================================================
// BLOCO: INICIALIZAÇÃO DA SESSÃO AO CARREGAR A PÁGINA
// ==========================================================================
async function init() {
  checkUserSession();
  await syncUserWithServer(); 
  await startNewGame();
}

init();