const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
app.set('trust proxy', 1); // Megbízunk a reverse proxy-ban (Nginx)
const db = new sqlite3.Database('./words.db');

// 1. CORS szigorítás: Csak a te weboldalad férhet hozzá az API-hoz!
// IDE ÍRD BE A SAJÁT DOMAINEDET! (Ha még nincs, akkor a VPS IP-jét)
const corsOptions = {
    origin: ['http://wordle.barnasanyi.hu', 'https://wordle.barnasanyi.hu', 'http://localhost'], 
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// 2. Rate Limiting: Maximum 100 kérés / IP cím / 15 perc
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 perc
    max: 100, // max 100 kérés IP-nként
    message: { error: "Túl sok kérés érkezett, kérlek próbáld újra később." }
});
app.use('/api/', limiter); // Ezt a korlátozást minden /api/ végpontra rárakjuk

// Végpont: Random szó lekérése
app.get('/api/random-word', (req, res) => {
    db.get("SELECT word FROM dictionary ORDER BY RANDOM() LIMIT 1", (err, row) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Belső szerverhiba" });
        }
        res.json({ word: row.word });
    });
});

// Végpont: Szó ellenőrzése
app.get('/api/check-word/:word', (req, res) => {
    const checkWord = req.params.word.toUpperCase();
    
    // 3. INPUT VALIDATION (Regex)
    // Csak és kizárólag az angol ábécé betűit tartalmazhatja, és pontosan 5 karakternek kell lennie.
    if (!/^[A-Z]{5}$/.test(checkWord)) {
        return res.status(400).json({ error: "Érvénytelen formátum. Csak 5 betűs szavak engedélyezettek." });
    }

    // 4. PREPARED STATEMENT (Az SQL injection elleni védelem: a "?" jel)
    db.get("SELECT word FROM dictionary WHERE word = ?", [checkWord], (err, row) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Belső szerverhiba" });
        }
        res.json({ exists: !!row }); // Ha a row létezik (true), ha nem (false)
    });
});

// 5. Port bezárása (csak a localhost-ról fogad kérést)
app.listen(3000, '127.0.0.1', () => {
    console.log("A biztonságos Wordle API fut a 127.0.0.1:3000 címen.");
});