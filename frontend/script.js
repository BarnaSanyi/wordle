// Globális változók
let targetWord = "";
const WORD_LENGTH = 5;
const MAX_GUESSES = 6;

let currentRow = 0;
let currentTile = 0;
let isGameOver = false;
let board = [];

// API hívás: Random szó lekérése a backendről
async function fetchRandomWord() {
    try {
        const response = await fetch('/api/random-word');
        if (!response.ok) throw new Error("Hálózati hiba");
        const data = await response.json();
        targetWord = data.word;
    } catch (error) {
        console.error("Hiba az API híváskor:", error);
        showMessage("Hiba a szerverrel való kapcsolatban.");
    }
}

// A játéktábla inicializálása hullámzó animációval
function initBoard() {
    const boardContainer = document.getElementById("board");
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
            
            // --- ÚJ: Hullám animáció beállítása ---
            tile.classList.add("wave");
            
            // Késleltetés kiszámítása: (sor + oszlop) * 60 milliszekundum
            // Így gyönyörű átlós hullámot kapunk bal fentről jobb le.
            const delay = (r + c) * 60; 
            tile.style.animationDelay = `${delay}ms`;
            
            // Amikor a belépő animáció befejeződött, letakarítjuk a class-t és a delay-t,
            // hogy ne zavarjon be később a gépelés animációjának.
            tile.addEventListener("animationend", () => {
                tile.classList.remove("wave");
                tile.style.animationDelay = "";
            });
            // ----------------------------------------

            row.appendChild(tile);
            rowTiles.push("");
        }
        boardContainer.appendChild(row);
        board.push(rowTiles);
    }
}

// Billentyűzet inicializálása
function initKeyboard() {
    const keys = [
        ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
        ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
        ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"]
    ];

    const keyboardContainer = document.getElementById("keyboard-container");
    keyboardContainer.innerHTML = ""; 

    keys.forEach(row => {
        const rowEl = document.createElement("div");
        rowEl.classList.add("keyboard-row");
        
        row.forEach(key => {
            const button = document.createElement("button");
            button.textContent = key === "BACKSPACE" ? "⌫" : key;
            button.classList.add("key");
            button.setAttribute("id", `key-${key}`);
            if (key === "ENTER" || key === "BACKSPACE") {
                button.classList.add("wide");
            }
            button.addEventListener("click", () => handleInput(key));
            rowEl.appendChild(button);
        });
        
        keyboardContainer.appendChild(rowEl);
    });
}

// Beviteli logika
function handleInput(key) {
    if (isGameOver) return;

    if (key === "BACKSPACE" || key === "Backspace") {
        deleteLetter();
        return;
    }

    if (key === "ENTER" || key === "Enter") {
        checkGuess();
        return;
    }

    if (/^[A-Z]$/.test(key.toUpperCase())) {
        addLetter(key.toUpperCase());
    }
}

function addLetter(letter) {
    if (currentTile < WORD_LENGTH) {
        const tile = document.getElementById(`tile-${currentRow}-${currentTile}`);
        tile.textContent = letter;
        
        // ÚJ: Hozzáadjuk a 'filled' osztályt, ami lejátssza a pop animációt és színt vált
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
        
        // ÚJ: Levesszük a 'filled' osztályt, így visszakapja az alap sötét keretet
        tile.classList.remove("filled"); 
        
        board[currentRow][currentTile] = "";
    }
}

// Tipp ellenőrzése aszinkron módon az API-n keresztül
async function checkGuess() {
    // Segédfüggvény a rázkódás meghívásához
    const triggerShake = () => {
        const row = document.getElementsByClassName("row")[currentRow];
        row.classList.remove("shake"); // Ha már rajta volt, levesszük
        void row.offsetWidth; // DOM "újraolvasás" kikényszerítése, hogy újra lejátssza az animációt
        row.classList.add("shake");
    };

    if (currentTile !== WORD_LENGTH) {
        showMessage("Nincs elég betű!");
        triggerShake(); // ÚJ: Sor megrázása
        return;
    }

    const guess = board[currentRow].join("");
    
    try {
        const response = await fetch(`/api/check-word/${guess}`);
        const data = await response.json();
        
        if (!data.exists) {
            showMessage("Nem létező szó!");
            triggerShake(); // ÚJ: Sor megrázása, mert a szó nincs a szótárban
            return;
        }
    } catch (error) {
        showMessage("Hiba az ellenőrzéskor.");
        return;
    }

    let targetWordCopy = targetWord;
    
    // Első kör: Zöldek (pontos egyezés) ellenőrzése
    for (let i = 0; i < WORD_LENGTH; i++) {
        const tile = document.getElementById(`tile-${currentRow}-${i}`);
        const letter = guess[i];
        
        // Töröljük a filled osztályt, hogy a zöld/sárga/szürke háttérszínek érvényesüljenek
        tile.classList.remove("filled"); 
        
        if (letter === targetWord[i]) {
            tile.classList.add("correct");
            updateKeyColor(letter, "correct");
            targetWordCopy = targetWordCopy.replace(letter, "_");
        }
    }

    // Második kör: Sárgák és Szürkék ellenőrzése
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
        endGame(true, currentRow + 1); // <--- EZT ÍRD ÁT: true (nyert), és a tippek száma
        return;
    }

    currentRow++;
    currentTile = 0;

    if (currentRow === MAX_GUESSES) {
        showMessage(`Vége! A szó ez volt: ${targetWord}`);
        endGame(false, MAX_GUESSES); // <--- EZT ÍRD ÁT: false (vesztett)
    }
}

function updateKeyColor(letter, colorClass) {
    const key = document.getElementById(`key-${letter}`);
    if (!key) return;
    
    if (key.style.backgroundColor === 'var(--correct-color)') return;
    
    if (colorClass === 'correct') {
        key.style.backgroundColor = 'var(--correct-color)';
    } else if (colorClass === 'present' && key.style.backgroundColor !== 'var(--correct-color)') {
        key.style.backgroundColor = 'var(--present-color)';
    } else if (colorClass === 'absent' && key.style.backgroundColor === '') {
        key.style.backgroundColor = 'var(--absent-color)';
    }
}

function showMessage(msg) {
    const msgContainer = document.getElementById("message-container");
    msgContainer.textContent = msg;
    if (!isGameOver) {
        setTimeout(() => {
            if (!isGameOver) msgContainer.textContent = "";
        }, 2000);
    }
}

// --- JÁTÉK VÉGE ÉS STATISZTIKA MENTÉSE ---
function endGame(win, guesses) {
    isGameOver = true;
    document.getElementById("play-again-btn").classList.add("visible");
    
    // Elküldjük a backendnek az eredményt!
    saveGameStats(win, guesses);
}

async function saveGameStats(win, guesses) {
    const token = localStorage.getItem('wordle_token');
    if (!token) return; // Ha vendég játszik, nem mentünk adatbázisba

    try {
        const response = await fetch('/api/game-end', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // Itt küldjük a titkos tokent!
            },
            body: JSON.stringify({ win, guesses })
        });
        
        // Ha valamiért lejárt a token (pl 30 nap után)
        if (response.status === 401 || response.status === 403) {
            handleLogout();
        }
    } catch (err) {
        console.error("Hiba a statisztika mentésekor", err);
    }
}

// --- BEJELENTKEZÉSI UI KEZELÉSE ---
function setupAuthUI() {
    const username = localStorage.getItem('wordle_username');
    const profileBtn = document.getElementById('profile-btn');
    const dropdown = document.getElementById('dropdown-menu');
    const logoutBtn = document.getElementById('logout-btn');

    if (username) {
        // Ha be van jelentkezve
        profileBtn.textContent = username;
        profileBtn.classList.add('logged-in');
        
        // Klikk a névre -> lenyílik a menü
        profileBtn.onclick = (e) => {
            e.stopPropagation(); // Ne záródjon be azonnal
            dropdown.classList.toggle('active');
        };

        // Bárhova máshova kattint a képernyőn, záruljon be a menü
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && e.target !== profileBtn) {
                dropdown.classList.remove('active');
            }
        });

        logoutBtn.onclick = handleLogout;
    } else {
        // Vendég mód
        profileBtn.textContent = '👤';
        profileBtn.classList.remove('logged-in');
        profileBtn.onclick = () => {
            window.location.href = 'auth.html';
        };
    }
}

function handleLogout() {
    localStorage.removeItem('wordle_token');
    localStorage.removeItem('wordle_username');
    window.location.reload(); // Újratölti az oldalt, vendégként
}

// Új játék indítása és állapotok nullázása
async function resetGame() {
    currentRow = 0;
    currentTile = 0;
    isGameOver = false;
    
    document.getElementById("message-container").textContent = "";
    document.getElementById("play-again-btn").classList.remove("visible");

    initBoard();
    initKeyboard();
    
    // Megvárjuk, amíg az SQLite adatbázisból megérkezik az új szó
    await fetchRandomWord();
}

// Eseménykezelők
document.getElementById("play-again-btn").addEventListener("click", () => {
    resetGame();
    document.getElementById("play-again-btn").blur(); 
});

document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    handleInput(e.key);
});

// --- UNIVERZUM GENERÁLÁSA ---
function createUniverse() {
    const universe = document.createElement("div");
    universe.id = "universe";
    document.body.appendChild(universe);

    const starCount = 150; // Ennyi csillag lesz a képernyőn

    for (let i = 0; i < starCount; i++) {
        const star = document.createElement("div");
        
        // Véletlenszerű méret sorsolása (70% kicsi, 25% közepes, 5% nagy)
        const rand = Math.random();
        let sizeClass = "star-small";
        if (rand > 0.7) sizeClass = "star-medium";
        if (rand > 0.95) sizeClass = "star-large";
        
        star.classList.add("star", sizeClass);
        
        // Véletlenszerű X és Y pozíció a képernyőn
        star.style.left = `${Math.random() * 100}vw`;
        star.style.top = `${Math.random() * 100}vh`;
        
        // Véletlenszerű pulzálási sebesség (2 és 5 másodperc között)
        star.style.animationDuration = `${Math.random() * 3 + 2}s`;
        
        // Véletlenszerű kezdési csúszás, hogy ne egyszerre villogjanak
        star.style.animationDelay = `${Math.random() * 4}s`;
        
        universe.appendChild(star);
    }
}

// --- RANGLISTA (LEADERBOARD) LOGIKA ---
const leaderboardBtn = document.getElementById('leaderboard-btn');
const modalOverlay = document.getElementById('leaderboard-modal');
const closeModal = document.getElementById('close-modal');
const tabBtns = document.querySelectorAll('.tab-btn');
const boards = document.querySelectorAll('.board');

// Modal megnyitása és adatok letöltése
leaderboardBtn.addEventListener('click', async () => {
    modalOverlay.classList.add('active');
    await fetchLeaderboards();
});

// Modal bezárása
closeModal.addEventListener('click', () => {
    modalOverlay.classList.remove('active');
});

// Zárás, ha a sötét háttérre kattint
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) modalOverlay.classList.remove('active');
});

// Fülek (Tabok) váltása
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Gombok stílusának cseréje
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Táblázatok cseréje
        boards.forEach(b => b.classList.remove('active'));
        const targetId = btn.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');
    });
});

// Ranglisták lekérése a szervertől és megjelenítése
async function fetchLeaderboards() {
    try {
        const response = await fetch('/api/leaderboard');
        
        // Ha a szerver hibaüzenetet küld (pl. 500-as kód)
        if (!response.ok) {
            throw new Error(`Szerver hiba: ${response.status}`);
        }

        const data = await response.json();

        // Ellenőrizzük, hogy a szerver tényleg a várt struktúrát küldte-e
        if (!data.score || !data.streak || !data.average) {
            throw new Error("Hibás adatszerkezet érkezett a szervertől.");
        }

        // 1. Galaktikus Pontok
        renderTable('board-score', data.score, 'Pont');
        
        // 2. Nyerő Széria
        renderTable('board-streak', data.streak, 'Széria');
        
        // 3. Precízió (Átlag)
        renderTable('board-average', data.average, 'Átlag');

    } catch (error) {
        console.error("Ranglista hiba:", error);
        // Mind a 3 táblázat helyére kiírjuk a hibát, hogy ne ragadjanak be
        document.getElementById('board-score').innerHTML = "<p style='text-align:center; color:#ff6b6b; padding:20px;'>Hiba az adatok letöltésekor.</p>";
        document.getElementById('board-streak').innerHTML = "<p style='text-align:center; color:#ff6b6b; padding:20px;'>Hiba az adatok letöltésekor.</p>";
        document.getElementById('board-average').innerHTML = "<p style='text-align:center; color:#ff6b6b; padding:20px;'>Hiba az adatok letöltésekor.</p>";
    }
}

// Segédfüggvény: HTML táblázat generálása egy tömbből
function renderTable(containerId, dataArray, valueLabel) {
    const container = document.getElementById(containerId);
    
    if (dataArray.length === 0) {
        container.innerHTML = "<p style='text-align:center; padding: 20px; color:#aaa;'>Még nincs adat.</p>";
        return;
    }

    let html = `<table class="leaderboard-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Űrhajós Név</th>
                            <th style="text-align: right;">${valueLabel}</th>
                        </tr>
                    </thead>
                    <tbody>`;

    dataArray.forEach((player, index) => {
        const rank = index + 1;
        // Az első 3 helyezett kap egyedi CSS osztályt (arany, ezüst, bronz)
        const rankClass = rank <= 3 ? `rank-${rank}` : '';
        
        // Kinyerjük az értéket attól függően, melyik listában vagyunk
        const value = player.score !== undefined ? player.score 
                    : player.max_streak !== undefined ? player.max_streak 
                    : player.avg;

        html += `<tr>
                    <td class="${rankClass}">${rank}.</td>
                    <td class="${rankClass}">${player.username}</td>
                    <td style="text-align: right; font-family: monospace;">${value}</td>
                 </tr>`;
    });

    html += `</tbody></table>`;
    
    // Extra infó a Precíziós listához
    if (containerId === 'board-average') {
        html += `<p style="font-size: 0.8rem; color: #888; text-align: center; margin-top: 15px;">Csak a legalább 5 játékkal rendelkező játékosok láthatóak.</p>`;
    }

    container.innerHTML = html;
}

// --- FÜGGVÉNYEK MEGHÍVÁSA INDÍTÁSKOR ---
setupAuthUI(); // Beállítja a headert
resetGame();   // Lekéri a szót és indítja a táblát
createUniverse(); // Háttér