/**
 * vault.js — Encrypted vault (localStorage + file export/import)
 * Every entry is stored as AES-256-GCM ciphertext.
 */

const Vault = (() => {
  const STORAGE_KEY = 'zkpm_vault';

  /** Get all encrypted entries from localStorage. */
  function loadRaw() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /** Persist encrypted entries array. */
  function saveRaw(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  /**
   * Add a credential to the vault.
   * Stores: { id, label (plaintext tag), encrypted payload }.
   */
  async function addEntry(masterPass, label, username, password, notes = '') {
    const payload = JSON.stringify({ username, password, notes, createdAt: Date.now() });
    const encrypted = await CryptoEngine.encrypt(masterPass, payload);
    const entries = loadRaw();
    const entry = {
      id: crypto.randomUUID(),
      label,
      data: encrypted,
    };
    entries.push(entry);
    saveRaw(entries);
    return entry.id;
  }

  /** Decrypt a single entry. */
  async function decryptEntry(masterPass, entry) {
    const json = await CryptoEngine.decrypt(masterPass, entry.data);
    return { id: entry.id, label: entry.label, ...JSON.parse(json) };
  }

  /** List all entries (labels only — no decryption). */
  function listEntries() {
    return loadRaw().map((e) => ({ id: e.id, label: e.label }));
  }

  /** Decrypt all entries. */
  async function decryptAll(masterPass) {
    const entries = loadRaw();
    return Promise.all(entries.map((e) => decryptEntry(masterPass, e)));
  }

  /** Delete an entry by id. */
  function deleteEntry(id) {
    const entries = loadRaw().filter((e) => e.id !== id);
    saveRaw(entries);
  }

  /** Export vault as encrypted JSON file download. */
  function exportVault() {
    const entries = loadRaw();
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vault-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Import vault from a JSON file (merges with existing). */
  function importVault(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const imported = JSON.parse(reader.result);
          if (!Array.isArray(imported)) throw new Error('Invalid vault file');
          const existing = loadRaw();
          const existingIds = new Set(existing.map((e) => e.id));
          const merged = [...existing, ...imported.filter((e) => !existingIds.has(e.id))];
          saveRaw(merged);
          resolve(merged.length);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  /** Wipe all vault data from localStorage. */
  function clearVault() {
    localStorage.removeItem(STORAGE_KEY);
  }

  return {
    addEntry,
    decryptEntry,
    decryptAll,
    listEntries,
    deleteEntry,
    exportVault,
    importVault,
    clearVault,
  };
})();