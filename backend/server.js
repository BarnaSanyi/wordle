const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');       // ÚJ: Titkosítás
const jwt = require('jsonwebtoken');      // ÚJ: Bejelentkezési token

const app = express();
const db = new sqlite3.Database('./words.db');

// Fontos! Titkos kulcs a JWT-hez (Élesben ezt .env fájlban illik tárolni)
const JWT_SECRET = "szuper_titkos_wordle_univerzum_kulcs_2026";

app.set('trust proxy', 1);

const corsOptions = {
    origin: ['http://wordle.barnasanyi.hu', 'https://wordle.barnasanyi.hu', 'http://localhost'], 
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// ÚJ: Engedélyezzük a szervernek, hogy megértse a POST kérések (JSON) tartalmát
app.use(express.json()); 

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: "Túl sok kérés érkezett, kérlek próbáld újra később." }
});
app.use('/api/', limiter);

// --- ADATBÁZIS BŐVÍTÉSE: Felhasználók tábla ---
// Ha még nincs, létrehozza a táblát a ranglistákhoz szükséges oszlopokkal is!
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        score INTEGER DEFAULT 0,
        current_streak INTEGER DEFAULT 0,
        max_streak INTEGER DEFAULT 0,
        games_played INTEGER DEFAULT 0,
        total_guesses INTEGER DEFAULT 0
    )`);
});

// --- ÚJ VÉGPONT: REGISZTRÁCIÓ ---
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;

    // 1. Bemenet ellenőrzése
    if (!username || !password) {
        return res.status(400).json({ error: "Minden mezőt ki kell tölteni!" });
    }
    if (username.length < 3 || username.length > 15 || !/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({ error: "A név 3-15 karakter lehet, csak betűk, számok és aláhúzás." });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: "A jelszónak legalább 6 karakternek kell lennie." });
    }

    try {
        // 2. Jelszó titkosítása (10-es salt round a biztonságért)
        const hashedPassword = await bcrypt.hash(password, 10);

        // 3. Mentés az adatbázisba
        db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, hashedPassword], function(err) {
            if (err) {
                // SQLITE_CONSTRAINT hiba: a felhasználónév már létezik
                if (err.message.includes("UNIQUE")) {
                    return res.status(400).json({ error: "Ez a felhasználónév már foglalt!" });
                }
                console.error(err);
                return res.status(500).json({ error: "Szerverhiba történt." });
            }

            // 4. Sikeres regisztráció esetén azonnal be is jelentkeztetjük
            const token = jwt.sign({ userId: this.lastID, username: username }, JWT_SECRET, { expiresIn: '30d' });
            res.json({ message: "Sikeres regisztráció!", token: token, username: username });
        });
    } catch (error) {
        res.status(500).json({ error: "Szerverhiba történt." });
    }
});

// --- ÚJ VÉGPONT: BEJELENTKEZÉS ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    // 1. Bemenet ellenőrzése
    if (!username || !password) {
        return res.status(400).json({ error: "Minden mezőt ki kell tölteni!" });
    }

    // 2. Felhasználó keresése az adatbázisban
    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Szerverhiba történt." });
        }
        
        // Ha nincs ilyen felhasználónév
        if (!user) {
            return res.status(400).json({ error: "Hibás felhasználónév vagy jelszó!" });
        }

        try {
            // 3. Jelszó ellenőrzése a bcrypt-tel
            // A bcrypt.compare automatikusan felismeri a titkosítást és összeveti a beírt jelszóval
            const isValidPassword = await bcrypt.compare(password, user.password);
            
            if (!isValidPassword) {
                // Biztonsági ökölszabály: Soha ne mondjuk meg, hogy a név vagy a jelszó volt-e a rossz!
                return res.status(400).json({ error: "Hibás felhasználónév vagy jelszó!" });
            }

            // 4. Sikeres bejelentkezés! Token kiállítása.
            const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
            res.json({ message: "Sikeres bejelentkezés!", token: token, username: user.username });
            
        } catch (error) {
            res.status(500).json({ error: "Szerverhiba történt." });
        }
    });
});

// --- KÖZTES RÉTEG (MIDDLEWARE): TOKEN ELLENŐRZÉSE ---
// Ez védi a statisztikákat: csak érvényes tokennel lehet pontot kapni!
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN" formátum bontása
    
    if (!token) return res.status(401).json({ error: "Nincs bejelentkezve!" });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Érvénytelen token!" });
        req.user = user;
        next();
    });
};

// --- ÚJ VÉGPONT: JÁTÉK VÉGE STATISZTIKA MENTÉSE ---
app.post('/api/game-end', authenticateToken, (req, res) => {
    const { win, guesses } = req.body;
    const userId = req.user.userId;

    db.get("SELECT * FROM users WHERE id = ?", [userId], (err, user) => {
        if (err || !user) return res.status(500).json({ error: "Hiba a felhasználó keresésekor." });

        let { score, current_streak, max_streak, games_played, total_guesses } = user;
        
        games_played++; // Játszott meccsek száma nő
        
        if (win) {
            current_streak++; // Nyerő széria nő
            if (current_streak > max_streak) max_streak = current_streak;
            
            // Pontszámítás a korábban megbeszélt logika alapján!
            const points = { 1: 1000, 2: 500, 3: 300, 4: 150, 5: 50, 6: 10 };
            score += (points[guesses] || 0);
            total_guesses += guesses;
        } else {
            current_streak = 0; // Széria lenullázódik
            total_guesses += 6; // Vesztes meccsnél 6 tippet számolunk az átlaghoz
        }

        // Frissítjük az adatbázist
        db.run(
            "UPDATE users SET score = ?, current_streak = ?, max_streak = ?, games_played = ?, total_guesses = ? WHERE id = ?",
            [score, current_streak, max_streak, games_played, total_guesses, userId],
            (err) => {
                if (err) return res.status(500).json({ error: "Nem sikerült menteni a statisztikát." });
                res.json({ success: true, score, current_streak, max_streak });
            }
        );
    });
});

// --- RÉGI VÉGPONTOK (Változatlanul) ---
app.get('/api/random-word', (req, res) => {
    db.get("SELECT word FROM dictionary ORDER BY RANDOM() LIMIT 1", (err, row) => {
        if (err) return res.status(500).json({ error: "Belső szerverhiba" });
        res.json({ word: row.word });
    });
});

app.get('/api/check-word/:word', (req, res) => {
    const checkWord = req.params.word.toUpperCase();
    if (!/^[A-Z]{5}$/.test(checkWord)) return res.status(400).json({ error: "Érvénytelen formátum." });
    db.get("SELECT word FROM dictionary WHERE word = ?", [checkWord], (err, row) => {
        if (err) return res.status(500).json({ error: "Belső szerverhiba" });
        res.json({ exists: !!row });
    });
});

app.listen(3000, '127.0.0.1', () => {
    console.log("A Wordle API (Auth-val) fut a 127.0.0.1:3000 címen.");
});

// --- ÚJ VÉGPONT: RANGLISTA (LEADERBOARD) ---
app.get('/api/leaderboard', (req, res) => {
    const leaderboards = {
        score: [],
        streak: [],
        average: []
    };

    // 1. Top 10 Galaktikus Pontszám (Score)
    db.all("SELECT username, score FROM users WHERE score > 0 ORDER BY score DESC LIMIT 10", [], (err, scoreRows) => {
        if (err) return res.status(500).json({ error: "Adatbázis hiba" });
        leaderboards.score = scoreRows;

        // 2. Top 10 Nyerő széria (Max Streak)
        db.all("SELECT username, max_streak FROM users WHERE max_streak > 0 ORDER BY max_streak DESC LIMIT 10", [], (err, streakRows) => {
            if (err) return res.status(500).json({ error: "Adatbázis hiba" });
            leaderboards.streak = streakRows;

            // 3. Top 10 Precízió (Átlagos tippszám)
            // Csak azokat rangsoroljuk, akik játszottak már legalább 5 meccset, hogy ne lehessen 1 szerencsés tippel nyerni!
            // Növekvő sorrend (ASC), mert a kisebb átlag a jobb!
            db.all("SELECT username, games_played, total_guesses FROM users WHERE games_played >= 5 ORDER BY (CAST(total_guesses AS FLOAT) / games_played) ASC LIMIT 10", [], (err, avgRows) => {
                if (err) return res.status(500).json({ error: "Adatbázis hiba" });
                
                // JavaScriptben kiszámoljuk a pontos átlagot 2 tizedesjegyre
                leaderboards.average = avgRows.map(row => ({
                    username: row.username,
                    avg: (row.total_guesses / row.games_played).toFixed(2)
                }));

                res.json(leaderboards); // Visszaküldjük mind a 3 listát egyben
            });
        });
    });
});

// --- ÚJ VÉGPONT: SAJÁT STATISZTIKA ÉS HELYEZÉS (HUD) ---
app.get('/api/my-stats', authenticateToken, (req, res) => {
    const userId = req.user.userId;

    // Lekérjük a játékos saját adatait
    db.get("SELECT score, max_streak, games_played, total_guesses FROM users WHERE id = ?", [userId], (err, user) => {
        if (err || !user) return res.status(500).json({ error: "Felhasználó nem található." });

        const stats = {
            score: user.score,
            streak: user.max_streak,
            avg: user.games_played > 0 ? (user.total_guesses / user.games_played).toFixed(2) : 0,
            ranks: { score: "-", streak: "-", average: "-" }
        };

        // Segédfüggvény a helyezések kiszámolására
        const getRank = (query, param) => new Promise((resolve) => {
            db.get(query, [param], (err, row) => {
                if (err) resolve("-");
                else resolve(row.rank);
            });
        });

        // Kiszámoljuk mind a 3 helyezést (Megnézzük, hány embernek van TÖBB pontja/szériája, + 1)
        Promise.all([
            getRank("SELECT COUNT(*) + 1 AS rank FROM users WHERE score > ?", user.score),
            getRank("SELECT COUNT(*) + 1 AS rank FROM users WHERE max_streak > ?", user.max_streak),
            user.games_played >= 5 
                ? getRank("SELECT COUNT(*) + 1 AS rank FROM users WHERE games_played >= 5 AND (CAST(total_guesses AS FLOAT) / games_played) < ?", user.total_guesses / user.games_played) 
                : Promise.resolve("-")
        ]).then(([scoreRank, streakRank, avgRank]) => {
            // Csak akkor adunk helyezést, ha már van pontja/szériája
            stats.ranks.score = user.score > 0 ? scoreRank : "-";
            stats.ranks.streak = user.max_streak > 0 ? streakRank : "-";
            stats.ranks.average = user.games_played >= 5 ? avgRank : "-";
            
            res.json(stats);
        }).catch(() => res.status(500).json({ error: "Hiba a rangok számításánál." }));
    });
});