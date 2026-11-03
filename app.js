/**
 * app.js — UI logic: tabs, forms, clipboard, entropy meter
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- Tab switching ---
  const tabs = document.querySelectorAll('[data-tab]');
  const panels = document.querySelectorAll('[data-panel]');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => {
        t.classList.remove('border-emerald-500', 'text-emerald-400');
        t.classList.add('border-transparent', 'text-gray-400');
      });
      tab.classList.add('border-emerald-500', 'text-emerald-400');
      tab.classList.remove('border-transparent', 'text-gray-400');

      panels.forEach((p) => p.classList.add('hidden'));
      document.querySelector(`[data-panel="${tab.dataset.tab}"]`).classList.remove('hidden');
    });
  });

  // --- Entropy meter ---
  const masterInputs = document.querySelectorAll('.master-input');
  masterInputs.forEach((input) => {
    input.addEventListener('input', () => {
      const meter = input.closest('form').querySelector('.entropy-bar');
      const label = input.closest('form').querySelector('.entropy-label');
      if (!meter || !label) return;

      const bits = CryptoEngine.calcEntropy(input.value);
      const pct = Math.min(100, (bits / 128) * 100);

      meter.style.width = pct + '%';
      if (bits < 40) {
        meter.className = 'entropy-bar h-full rounded-full bg-red-500 transition-all duration-300';
        label.textContent = `Weak (${bits} bits)`;
        label.className = 'entropy-label text-xs text-red-400';
      } else if (bits < 80) {
        meter.className = 'entropy-bar h-full rounded-full bg-yellow-500 transition-all duration-300';
        label.textContent = `Moderate (${bits} bits)`;
        label.className = 'entropy-label text-xs text-yellow-400';
      } else {
        meter.className = 'entropy-bar h-full rounded-full bg-emerald-500 transition-all duration-300';
        label.textContent = `Strong (${bits} bits)`;
        label.className = 'entropy-label text-xs text-emerald-400';
      }
    });
  });

  // --- Deterministic mode ---
  document.getElementById('gen-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const master = document.getElementById('gen-master').value;
    const service = document.getElementById('gen-service').value;
    const length = parseInt(document.getElementById('gen-length').value, 10) || 20;

    if (!master || !service) return;

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Deriving…';

    try {
      const password = await CryptoEngine.generateDeterministic(master, service, length);
      document.getElementById('gen-output').value = password;
      document.getElementById('gen-result').classList.remove('hidden');
    } catch (err) {
      alert('Generation failed: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate Password';
    }
  });

  // --- Vault: add entry ---
  document.getElementById('vault-add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const master = document.getElementById('vault-master').value;
    const label = document.getElementById('vault-label').value;
    const username = document.getElementById('vault-username').value;
    const password = document.getElementById('vault-password').value;
    const notes = document.getElementById('vault-notes').value;

    if (!master || !label) return;

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Encrypting…';

    try {
      await Vault.addEntry(master, label, username, password, notes);
      e.target.reset();
      refreshVaultList();
      showToast('Entry saved & encrypted');
    } catch (err) {
      alert('Encryption failed: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save to Vault';
    }
  });

  // --- Vault: list / unlock ---
  document.getElementById('vault-unlock-btn').addEventListener('click', async () => {
    const master = document.getElementById('vault-unlock-pass').value;
    if (!master) return;

    const btn = document.getElementById('vault-unlock-btn');
    btn.disabled = true;
    btn.textContent = 'Decrypting…';

    try {
      const entries = await Vault.decryptAll(master);
      renderDecryptedEntries(entries);
    } catch {
      alert('Wrong master password or corrupted vault.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Unlock';
    }
  });

  // --- Vault: export / import ---
  document.getElementById('vault-export-btn').addEventListener('click', () => {
    Vault.exportVault();
    showToast('Vault exported');
  });

  document.getElementById('vault-import-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const count = await Vault.importVault(file);
      refreshVaultList();
      showToast(`Imported vault (${count} total entries)`);
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
    e.target.value = '';
  });

  // --- Clipboard with auto-clear ---
  document.addEventListener('click', (e) => {
    if (e.target.closest('.copy-btn')) {
      const target = e.target.closest('.copy-btn').dataset.target;
      const text =
        document.getElementById(target)?.value ||
        e.target.closest('.copy-btn').dataset.text;

      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        showToast('Copied — clipboard auto-clears in 15s');
        setTimeout(() => {
          navigator.clipboard.writeText('').catch(() => {});
        }, 15_000);
      });
    }
  });

  // --- Toggle password visibility ---
  document.addEventListener('click', (e) => {
    if (e.target.closest('.toggle-vis')) {
      const btn = e.target.closest('.toggle-vis');
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.querySelector('.eye-icon').textContent = isPassword ? '🙈' : '👁';
    }
  });

  // --- Helpers ---
  function refreshVaultList() {
    const list = Vault.listEntries();
    const countEl = document.getElementById('vault-count');
    if (countEl) countEl.textContent = `${list.length} stored`;
    // Clear decrypted view when list changes
    document.getElementById('vault-entries').innerHTML = '';
  }

  function renderDecryptedEntries(entries) {
    const container = document.getElementById('vault-entries');
    if (entries.length === 0) {
      container.innerHTML = '<p class="text-gray-500 text-sm">Vault is empty.</p>';
      return;
    }

    container.innerHTML = entries
      .map(
        (e) => `
      <div class="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-2">
        <div class="flex items-center justify-between">
          <h4 class="font-semibold text-emerald-400">${esc(e.label)}</h4>
          <button onclick="deleteVaultEntry('${e.id}')"
            class="text-xs text-red-400 hover:text-red-300">Delete</button>
        </div>
        <div class="grid grid-cols-[80px_1fr_auto] gap-2 items-center text-sm">
          <span class="text-gray-400">User</span>
          <code class="bg-gray-900 px-2 py-1 rounded truncate">${esc(e.username)}</code>
          <button class="copy-btn text-xs text-emerald-400 hover:text-emerald-300" data-text="${esc(e.username)}">Copy</button>

          <span class="text-gray-400">Pass</span>
          <code class="bg-gray-900 px-2 py-1 rounded truncate">${esc(e.password)}</code>
          <button class="copy-btn text-xs text-emerald-400 hover:text-emerald-300" data-text="${esc(e.password)}">Copy</button>
        </div>
        ${e.notes ? `<p class="text-xs text-gray-500 mt-1">${esc(e.notes)}</p>` : ''}
      </div>
    `
      )
      .join('');
  }

  function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
    setTimeout(() => {
      toast.classList.add('translate-y-20', 'opacity-0');
      toast.classList.remove('translate-y-0', 'opacity-100');
    }, 2500);
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // Global for inline onclick
  window.deleteVaultEntry = (id) => {
    if (confirm('Delete this entry?')) {
      Vault.deleteEntry(id);
      refreshVaultList();
      document.getElementById('vault-entries').innerHTML = '';
      showToast('Entry deleted');
    }
  };

  // Init
  refreshVaultList();
});