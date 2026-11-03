/**
 * crypto.js — Core cryptographic engine
 * Uses Web Crypto API for AES-256-GCM and PBKDF2.
 * All operations run entirely client-side.
 */

const CryptoEngine = (() => {
  const PBKDF2_ITERATIONS = 600_000;
  const SALT_BYTES = 16;
  const IV_BYTES = 12;
  const KEY_BITS = 256;

  /**
   * Derive an AES-256-GCM key from a passphrase + salt using PBKDF2.
   */
  async function deriveKey(passphrase, salt, usage = ['encrypt', 'decrypt']) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: KEY_BITS },
      false,
      usage
    );
  }

  /**
   * Encrypt plaintext string → { iv, salt, ciphertext } (all base64).
   */
  async function encrypt(passphrase, plaintext) {
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const key = await deriveKey(passphrase, salt, ['encrypt']);

    const cipherBuf = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(plaintext)
    );

    return {
      salt: bufToBase64(salt),
      iv: bufToBase64(iv),
      ciphertext: bufToBase64(new Uint8Array(cipherBuf)),
    };
  }

  /**
   * Decrypt { iv, salt, ciphertext } → plaintext string.
   * Throws on wrong passphrase / tampered data.
   */
  async function decrypt(passphrase, { salt, iv, ciphertext }) {
    const key = await deriveKey(passphrase, base64ToBuf(salt), ['decrypt']);
    const plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBuf(iv) },
      key,
      base64ToBuf(ciphertext)
    );
    return new TextDecoder().decode(plainBuf);
  }

  /**
   * Deterministic password generation.
   * master + service → PBKDF2 → raw bytes → mapped to charset.
   */
  async function generateDeterministic(master, service, length = 20) {
    const enc = new TextEncoder();
    const salt = enc.encode(service.trim().toLowerCase());

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(master),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const bits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      length * 8
    );

    return bytesToPassword(new Uint8Array(bits), length);
  }

  // --- Helpers ---

  const CHARSET =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+';

  function bytesToPassword(bytes, length) {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += CHARSET[bytes[i] % CHARSET.length];
    }

    // Guarantee at least one of each class
    const classes = [
      { regex: /[a-z]/, pool: 'abcdefghijklmnopqrstuvwxyz' },
      { regex: /[A-Z]/, pool: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
      { regex: /[0-9]/, pool: '0123456789' },
      { regex: /[^a-zA-Z0-9]/, pool: '!@#$%^&*()-_=+' },
    ];

    const chars = result.split('');
    classes.forEach((cls, idx) => {
      if (!cls.regex.test(result)) {
        chars[idx] = cls.pool[bytes[idx] % cls.pool.length];
      }
    });

    return chars.join('');
  }

  function bufToBase64(buf) {
    return btoa(String.fromCharCode(...buf));
  }

  function base64ToBuf(b64) {
    const bin = atob(b64);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return buf;
  }

  /**
   * Calculate password / passphrase entropy in bits.
   */
  function calcEntropy(str) {
    let pool = 0;
    if (/[a-z]/.test(str)) pool += 26;
    if (/[A-Z]/.test(str)) pool += 26;
    if (/[0-9]/.test(str)) pool += 10;
    if (/[^a-zA-Z0-9]/.test(str)) pool += 32;
    if (pool === 0) return 0;
    return Math.floor(str.length * Math.log2(pool));
  }

  return { encrypt, decrypt, generateDeterministic, calcEntropy };
})();