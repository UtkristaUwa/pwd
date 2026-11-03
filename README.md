# ZK Vault

A zero-knowledge password manager that runs entirely in your browser. No servers, no accounts, no tracking — just cryptography.

## Features

### Deterministic Password Generator
- Enter a master passphrase + service name → get the same strong password every time
- Nothing is stored anywhere — same inputs always produce the same output
- Configurable password length (8–64 characters)
- Guarantees uppercase, lowercase, digits, and symbols in every password

### Encrypted Vault
- Store credentials encrypted with **AES-256-GCM** in your browser's localStorage
- Each entry holds a label, username, password, and optional notes
- Unlock with your master passphrase to view stored credentials
- Export/import vault as encrypted JSON for backups

## Security

| Feature | Detail |
|---|---|
| Key Derivation | PBKDF2-HMAC-SHA256, 600,000 iterations |
| Encryption | AES-256-GCM |
| API | Web Crypto API (browser-native) |
| Storage | localStorage only — never leaves your device |
| Network | Zero network requests. Works fully offline. |

All cryptographic operations run **client-side**. Your master passphrase never leaves your browser.

## Usage

Open `index.html` in any modern browser. No build step, no dependencies, no server required.

```
git clone https://github.com/UtkristaUwa/pwd.git
cd pwd
open index.html
```

Or host it on GitHub Pages for access from anywhere.

## File Structure

```
├── index.html    # Main HTML page
├── crypto.js     # PBKDF2 key derivation, AES-256-GCM encrypt/decrypt, deterministic generation
├── vault.js      # Encrypted vault CRUD, localStorage, export/import
└── app.js        # UI logic: tabs, forms, entropy meter, clipboard, toasts
```

## Entropy Meter

The passphrase strength indicator estimates entropy based on character class diversity:

- **Weak** (< 40 bits) — red
- **Moderate** (40–79 bits) — yellow
- **Strong** (80+ bits) — green

## Clipboard

Copied passwords auto-clear from your clipboard after 15 seconds.
