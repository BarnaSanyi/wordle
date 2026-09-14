const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const db = new sqlite3.Database('./words.db');

app.use(cors());

// Végpont: Random szó lekérése
app.get('/api/random-word', (req, res) => {
    db.get("SELECT word FROM dictionary ORDER BY RANDOM() LIMIT 1", (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ word: row.word });
    });
});

// Végpont: Szó ellenőrzése (létezik-e a szótárban)
app.get('/api/check-word/:word', (req, res) => {
    const checkWord = req.params.word.toUpperCase();
    db.get("SELECT word FROM dictionary WHERE word = ?", [checkWord], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ exists: !!row });
    });
});

app.listen(3000, () => {
    console.log("A Wordle API fut a 3000-es porton.");
});