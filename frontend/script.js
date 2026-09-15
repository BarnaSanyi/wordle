const WORD_LENGTH = 5;
const MAX_GUESSES = 6;
let board = [];
let currentRow = 0;
let currentTile = 0;
let targetWord = "";
let isGameOver = false;
let isChecking = false; // Védelem a gyors Enter nyomogatás ellen

// --- 1. JÁTÉK ÉS BILLENTYŰZET INICIALIZÁLÁSA ---
async function resetGame() {
    currentRow = 0;
    currentTile = 0;
    isGameOver = false;
    isChecking = false;
    
    const playAgainBtn = document.getElementById("play-again-btn");
    if (playAgainBtn) playAgainBtn.classList.remove("visible");
    
    const msgContainer = document.getElementById("message-container");
    if (msgContainer) msgContainer.textContent = "";
    
    // Billentyűzet színeinek teljes törlése (CSS és direkt stílusok is)
    document.querySelectorAll(".key").forEach(key => {
        key.classList.remove("correct", "present", "absent");
        key.style.backgroundColor = "";
        key.style.borderColor = "";
        key.style.color = "";
    });

    initBoard();
    
    try {
        const response = await fetch('/api/random-word');
        const data = await response.json();
        targetWord = data.word.toUpperCase();
    } catch (err) {
        showMessage("Hiba a szó betöltésekor!");
    }
}

function initBoard() {
    const boardContainer = document.getElementById("board");
    if (!boardContainer) return;
    boardContainer.innerHTML = ""; 
    board = [];

    for (let r = 0; r < MAX_GUESSES; r++) {
        const row = document.createElement("div");
        row.classList.add("row");
        const rowTiles = [];
        
        for (let c = 0; c < WORD_LENGTH; c++) {
            const tile = document.createElement("div");
            tile.classList.add("tile");
            tile.setAttribute("id", `tile-${r}-${c}`);
            
            // Hullám animáció
            tile.classList.add("wave");
            const delay = (r + c) * 60; 
            tile.style.animationDelay = `${delay}ms`;
            
            tile.addEventListener("animationend", () => {
                tile.classList.remove("wave");
                tile.style.animationDelay = "";
            });

            row.appendChild(tile);
            rowTiles.push("");
        }
        boardContainer.appendChild(row);
        board.push(rowTiles);
    }
}

function initKeyboard() {
    const keyboardContainer = document.getElementById("keyboard-container");
    if (!keyboardContainer) return;
    keyboardContainer.innerHTML = ""; 

    const keys = [
        ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
        ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
        ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "DEL"]
    ];

    keys.forEach(row => {
        const rowElem = document.createElement("div");
        rowElem.classList.add("keyboard-row");
        
        row.forEach(key => {
            const keyElem = document.createElement("button");
            keyElem.classList.add("key");
            keyElem.setAttribute("data-key", key);
            keyElem.textContent = key;
            
            if (key === "ENTER" || key === "DEL") keyElem.classList.add("wide");
            
            keyElem.addEventListener("click", () => {
                if (isGameOver || isChecking) return;
                if (key === "ENTER") checkGuess();
                else if (key === "DEL") deleteLetter();
                else addLetter(key);
            });
            
            rowElem.appendChild(keyElem);
        });
        keyboardContainer.appendChild(rowElem);
    });
}

// --- 2. JÁTÉKMENET ÉS INPUT ---
function addLetter(letter) {
    if (currentTile < WORD_LENGTH) {
        const tile = document.getElementById(`tile-${currentRow}-${currentTile}`);
        tile.textContent = letter;
        tile.classList.add("filled");
        board[currentRow][currentTile] = letter;
        currentTile++;
    }
}

function deleteLetter() {
    if (currentTile > 0) {
        currentTile--;
        const tile = document.getElementById(`tile-${currentRow}-${currentTile}`);
        tile.textContent = "";
        tile.classList.remove("filled");
        board[currentRow][currentTile] = "";
    }
}

async function checkGuess() {
    if (currentTile !== WORD_LENGTH) {
        showMessage("Nincs elég betű!");
        triggerShake();
        return;
    }

    isChecking = true; // Zárjuk a bemenetet
    const guess = board[currentRow].join("");
    
    try {
        const response = await fetch(`/api/check-word/${guess}`);
        const data = await response.json();
        
        if (!data.exists) {
            showMessage("Nem létező szó!");
            triggerShake();
            isChecking = false;
            return;
        }
    } catch (error) {
        showMessage("Hiba az ellenőrzéskor.");
        isChecking = false;
        return;
    }

    let targetWordCopy = targetWord;
    
    // Zöldek (pontos egyezés)
    for (let i = 0; i < WORD_LENGTH; i++) {
        const tile = document.getElementById(`tile-${currentRow}-${i}`);
        const letter = guess[i];
        tile.classList.remove("filled"); 
        
        if (letter === targetWord[i]) {
            tile.classList.add("correct");
            updateKeyColor(letter, "correct");
            targetWordCopy = targetWordCopy.replace(letter, "_");
        }
    }

    // Sárgák és Szürkék
    for (let i = 0; i < WORD_LENGTH; i++) {
        const tile = document.getElementById(`tile-${currentRow}-${i}`);
        const letter = guess[i];
        
        if (!tile.classList.contains("correct")) {
            if (targetWordCopy.includes(letter)) {
                tile.classList.add("present");
                updateKeyColor(letter, "present");
                targetWordCopy = targetWordCopy.replace(letter, "_");
            } else {
                tile.classList.add("absent");
                updateKeyColor(letter, "absent");
            }
        }
    }

    if (guess === targetWord) {
        showMessage("Gratulálok, nyertél!");
        endGame(true, currentRow + 1);
        isChecking = false;
        return;
    }

    currentRow++;
    currentTile = 0;
    isChecking = false;

    if (currentRow === MAX_GUESSES) {
        showMessage(`Vége! A szó ez volt: ${targetWord}`);
        endGame(false, MAX_GUESSES);
    }
}

function triggerShake() {
    const row = document.getElementsByClassName("row")[currentRow];
    if (row) {
        row.classList.remove("shake");
        void row.offsetWidth; 
        row.classList.add("shake");
    }
}

// ERŐSZAKOS SZÍNEZÉS: Ez garantálja, hogy a CSS ne tudja elrontani a gombokat!
function updateKeyColor(letter, status) {
    const key = document.querySelector(`.key[data-key="${letter}"]`);
    if (!key) return;

    if (status === "correct") {
        key.classList.remove("present", "absent");
        key.classList.add("correct");
        key.style.backgroundColor = "var(--ok)";
        key.style.borderColor = "var(--ok)";
    } else if (status === "present" && !key.classList.contains("correct")) {
        key.classList.remove("absent");
        key.classList.add("present");
        key.style.backgroundColor = "var(--has)";
        key.style.borderColor = "var(--has)";
    } else if (status === "absent" && !key.classList.contains("correct") && !key.classList.contains("present")) {
        key.classList.add("absent");
        key.style.backgroundColor = "var(--no)";
        key.style.borderColor = "var(--no)";
    }
}

function showMessage(msg) {
    const container = document.getElementById("message-container");
    if (container) {
        container.textContent = msg;
        setTimeout(() => { container.textContent = ""; }, 2500);
    }
}

// --- 3. JÁTÉK VÉGE ÉS STATISZTIKA (HUD) MENTÉSE ---
function endGame(win, guesses) {
    isGameOver = true;
    const btn = document.getElementById("play-again-btn");
    if (btn) btn.classList.add("visible");
    saveGameStats(win, guesses);
}

async function saveGameStats(win, guesses) {
    const token = localStorage.getItem('wordle_token');
    if (!token) return; 

    try {
        const response = await fetch('/api/game-end', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ win, guesses })
        });
        
        if (response.status === 401 || response.status === 403) {
            handleLogout();
        } else {
            updatePlayerHUD();
        }
    } catch (err) {
        console.error("Hiba a statisztika mentésekor", err);
    }
}

// --- 4. BEJELENTKEZÉSI UI (HUD) KEZELÉSE ---
function setupAuthUI() {
    const username = localStorage.getItem('wordle_username');
    const profileBtn = document.getElementById('profile-btn');
    const dropdown = document.getElementById('dropdown-menu');
    const logoutBtn = document.getElementById('logout-btn');

    if (!profileBtn) return; // Ha auth.html-en vagyunk, lépjen ki

    if (username) {
        profileBtn.textContent = username;
        profileBtn.classList.add('logged-in');
        
        profileBtn.onclick = (e) => {
            e.stopPropagation();
            if(dropdown) dropdown.classList.toggle('active');
        };

        document.addEventListener('click', (e) => {
            if (dropdown && !dropdown.contains(e.target) && e.target !== profileBtn) {
                dropdown.classList.remove('active');
            }
        });

        if(logoutBtn) logoutBtn.onclick = handleLogout;
        updatePlayerHUD(); 
    } else {
        profileBtn.textContent = '👤';
        profileBtn.classList.remove('logged-in');
        profileBtn.onclick = () => { window.location.href = 'auth.html'; };
    }
}

function handleLogout() {
    localStorage.removeItem('wordle_token');
    localStorage.removeItem('wordle_username');
    window.location.reload(); 
}

async function updatePlayerHUD() {
    const token = localStorage.getItem('wordle_token');
    
    if (!token) {
        document.body.classList.remove('logged-in-state');
        return;
    }

    try {
        const response = await fetch('/api/my-stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Ez a sor adja ki a parancsot a CSS-nek, hogy jelenítse meg a paneleket
            document.body.classList.add('logged-in-state');
            
            // Mind a gépes, mind a mobilos HUD-ot frissítjük egyszerre!
            document.querySelectorAll('.hud-score').forEach(el => el.textContent = data.score);
            document.querySelectorAll('.hud-rank-score').forEach(el => el.textContent = data.ranks.score !== "-" ? `#${data.ranks.score}` : "-");
            
            document.querySelectorAll('.hud-streak').forEach(el => el.textContent = data.streak);
            document.querySelectorAll('.hud-rank-streak').forEach(el => el.textContent = data.ranks.streak !== "-" ? `#${data.ranks.streak}` : "-");
            
            document.querySelectorAll('.hud-avg').forEach(el => el.textContent = data.avg);
            document.querySelectorAll('.hud-rank-avg').forEach(el => el.textContent = data.ranks.average !== "-" ? `#${data.ranks.average}` : "-");
        } else {
            document.body.classList.remove('logged-in-state');
        }
    } catch (err) {
        console.error("Hiba a HUD betöltésekor", err);
    }
}

// --- 5. RANGLISTA (LEADERBOARD) ---
function setupLeaderboard() {
    const leaderboardBtn = document.getElementById('leaderboard-btn');
    const modalOverlay = document.getElementById('leaderboard-modal');
    const closeModal = document.getElementById('close-modal');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const boards = document.querySelectorAll('.board');

    if (!leaderboardBtn || !modalOverlay) return;

    leaderboardBtn.addEventListener('click', async () => {
        modalOverlay.classList.add('active');
        await fetchLeaderboards();
    });

    closeModal.addEventListener('click', () => modalOverlay.classList.remove('active'));
    modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) modalOverlay.classList.remove('active'); });

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            boards.forEach(b => b.classList.remove('active'));
            document.getElementById(btn.getAttribute('data-target')).classList.add('active');
        });
    });
}

async function fetchLeaderboards() {
    try {
        const response = await fetch('/api/leaderboard');
        if (!response.ok) throw new Error(`Szerver hiba: ${response.status}`);
        
        const data = await response.json();
        if (!data.score) throw new Error("Hibás adatszerkezet");

        renderTable('board-score', data.score, 'Pont');
        renderTable('board-streak', data.streak, 'Széria');
        renderTable('board-average', data.average, 'Átlag');
    } catch (error) {
        const errorHtml = "<p style='text-align:center; color:#ff6b6b; padding:20px;'>Hiba az adatok letöltésekor.</p>";
        ['board-score', 'board-streak', 'board-average'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.innerHTML = errorHtml;
        });
    }
}

function renderTable(containerId, dataArray, valueLabel) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (!dataArray || dataArray.length === 0) {
        container.innerHTML = "<p style='text-align:center; padding: 20px; color:#aaa;'>Még nincs adat.</p>";
        return;
    }

    let html = `<table class="leaderboard-table"><thead><tr><th>#</th><th>Űrhajós Név</th><th style="text-align: right;">${valueLabel}</th></tr></thead><tbody>`;

    dataArray.forEach((player, index) => {
        const rank = index + 1;
        const rankClass = rank <= 3 ? `rank-${rank}` : '';
        const value = player.score !== undefined ? player.score : player.max_streak !== undefined ? player.max_streak : player.avg;

        html += `<tr><td class="${rankClass}">${rank}.</td><td class="${rankClass}">${player.username}</td><td style="text-align: right; font-family: monospace;">${value}</td></tr>`;
    });

    html += `</tbody></table>`;
    if (containerId === 'board-average') html += `<p style="font-size: 0.8rem; color: #888; text-align: center; margin-top: 15px;">Csak a legalább 5 játékkal rendelkező játékosok láthatóak.</p>`;
    container.innerHTML = html;
}

// --- 6. UNIVERZUM GENERÁLÁSA ---
function createUniverse() {
    const universe = document.createElement("div");
    universe.id = "universe";
    document.body.appendChild(universe);

    for (let i = 0; i < 150; i++) {
        const star = document.createElement("div");
        const rand = Math.random();
        let sizeClass = "star-small";
        if (rand > 0.7) sizeClass = "star-medium";
        if (rand > 0.95) sizeClass = "star-large";
        
        star.classList.add("star", sizeClass);
        star.style.left = `${Math.random() * 100}vw`;
        star.style.top = `${Math.random() * 100}vh`;
        star.style.animationDuration = `${Math.random() * 3 + 2}s`;
        star.style.animationDelay = `${Math.random() * 4}s`;
        universe.appendChild(star);
    }
}

// --- 7. ESEMÉNYKEZELŐK ÉS PROGRAM INDÍTÁSA ---
document.addEventListener("DOMContentLoaded", () => {
    
    const playAgainBtn = document.getElementById("play-again-btn");
    if (playAgainBtn) playAgainBtn.addEventListener("click", resetGame);

    // Fizikai billentyűzet (Számítógép) figyelése
    document.addEventListener("keydown", (e) => {
        if (isGameOver || isChecking) return;
        
        if (e.key === "Enter") checkGuess();
        else if (e.key === "Backspace") deleteLetter();
        else if (/^[a-zA-Z]$/.test(e.key)) addLetter(e.key.toUpperCase());
    });

    // Indító folyamatok
    createUniverse();
    setupAuthUI();
    setupLeaderboard();
    
    // Ha a játéktábla létezik (tehát az index.html-en vagyunk), felépítjük a játékot
    if (document.getElementById("board")) {
        initKeyboard();
        resetGame();
    }
});