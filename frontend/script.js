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

// A játéktábla inicializálása
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
        endGame();
        return;
    }

    currentRow++;
    currentTile = 0;

    if (currentRow === MAX_GUESSES) {
        showMessage(`Vége! A szó ez volt: ${targetWord}`);
        endGame();
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

function endGame() {
    isGameOver = true;
    document.getElementById("play-again-btn").classList.add("visible");
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

// Első játék indítása
resetGame();