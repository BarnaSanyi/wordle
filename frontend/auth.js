const registerForm = document.getElementById('register-form');
const loginForm = document.getElementById('login-form');
const authTitle = document.getElementById('auth-title');
const switchText = document.getElementById('switch-text');
const switchLink = document.getElementById('switch-link');
const errorDiv = document.getElementById('auth-error');

let isLoginMode = false; // Alapértelmezetten regisztrációt mutatunk

// --- NÉZET VÁLTÁSA ---
switchLink.addEventListener('click', (e) => {
    e.preventDefault();
    errorDiv.textContent = ""; // Hiba törlése váltáskor
    errorDiv.style.color = "#ff6b6b";

    isLoginMode = !isLoginMode;

    if (isLoginMode) {
        registerForm.style.display = "none";
        loginForm.style.display = "block";
        authTitle.textContent = "Bejelentkezés";
        switchText.textContent = "Nincs még fiókod?";
        switchLink.textContent = "Regisztrálj!";
    } else {
        loginForm.style.display = "none";
        registerForm.style.display = "block";
        authTitle.textContent = "Regisztráció";
        switchText.textContent = "Már van fiókod?";
        switchLink.textContent = "Jelentkezz be!";
    }
});

// --- REGISZTRÁCIÓ BEKÜLDÉSE ---
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleAuth('/api/register', 'reg-username', 'reg-password', registerForm);
});

// --- BEJELENTKEZÉS BEKÜLDÉSE ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleAuth('/api/login', 'login-username', 'login-password', loginForm);
});

// --- KÖZÖS HÁLÓZATI FÜGGVÉNY A KÉT ŰRLAPHOZ ---
async function handleAuth(endpoint, userField, passField, formElement) {
    const username = document.getElementById(userField).value.trim();
    const password = document.getElementById(passField).value;
    const btn = formElement.querySelector('button');

    errorDiv.textContent = ""; 
    btn.textContent = "Töltés...";
    btn.disabled = true;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            errorDiv.style.color = "#ff6b6b";
            errorDiv.textContent = data.error;
            btn.textContent = isLoginMode ? "Bejelentkezés" : "Regisztráció";
            btn.disabled = false;
        } else {
            // SIKERES AZONOSÍTÁS
            localStorage.setItem('wordle_token', data.token);
            localStorage.setItem('wordle_username', data.username);
            
            errorDiv.style.color = "var(--correct-color)";
            errorDiv.textContent = data.message + " Átirányítás...";
            
            // 1.5 másodperc múlva visszavisszük a játékba
            setTimeout(() => {
                window.location.href = "index.html";
            }, 1500);
        }
    } catch (error) {
        errorDiv.style.color = "#ff6b6b";
        errorDiv.textContent = "Hálózati hiba történt.";
        btn.textContent = isLoginMode ? "Bejelentkezés" : "Regisztráció";
        btn.disabled = false;
    }
}