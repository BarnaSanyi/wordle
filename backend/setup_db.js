const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./words.db');

async function fetchAndImportWords() {
    console.log("Szótár letöltése folyamatban a webről...");
    
    try {
        // Egy népszerű 5 betűs angol szavak listája (kb 5700 szó)
        const response = await fetch('https://raw.githubusercontent.com/charlesreid1/five-letter-words/master/sgb-words.txt');
        
        if (!response.ok) throw new Error("Nem sikerült letölteni a listát.");
        
        const text = await response.text();

        // Feldolgozás: soronként vágjuk, nagybetűsítjük, és biztosítjuk, hogy csak 5 betűs legyen
        const words = text.split('\n')
                          .map(w => w.trim().toUpperCase())
                          .filter(w => w.length === 5);

        console.log(`${words.length} szó letöltve. Mentés az adatbázisba (ez eltarthat 1-2 másodpercig)...`);

        // Adatbázis műveletek
        db.serialize(() => {
            // Tábla létrehozása (ha még nem létezne)
            db.run("CREATE TABLE IF NOT EXISTS dictionary (id INTEGER PRIMARY KEY AUTOINCREMENT, word TEXT UNIQUE)");

            // Tranzakció indítása a gyorsabb mentés érdekében
            db.exec("BEGIN TRANSACTION");
            
            const stmt = db.prepare("INSERT OR IGNORE INTO dictionary (word) VALUES (?)");
            
            words.forEach(word => {
                stmt.run(word);
            });
            
            stmt.finalize();
            db.exec("COMMIT");
            
            console.log("Kész! A szavak sikeresen bekerültek az SQLite adatbázisba.");
        });

    } catch (error) {
        console.error("Hiba történt:", error);
    } finally {
        db.close();
    }
}

fetchAndImportWords();