// ── gpa_export_import.js ──────────────────────────────────────
// Export and import for GPA calculator profiles.
//
// Export: downloads all profiles (or just the active one) as a
//         .json file. Falls back to clipboard on Android WebView.
//
// Import: accepts a .json file or pasted text. Shows a live
//         preview before committing. Profiles with the same name
//         as an existing one are skipped (never overwritten).
//
// Drop after storage.js and app.js. No existing files change.
// Add one call in your Profiles screen HTML:
//   <div id="profileExportImportRow"></div>
// and call gpaEiInit() once the DOM is ready, or let the
// MutationObserver below handle it automatically.
// ─────────────────────────────────────────────────────────────

const GPA_EI_VERSION = 1;
const VALID_DEPTS    = ['CNGB', 'IENG', 'FE'];

// ── auto-init when profileScreen is first shown ───────────────
(function () {
  const _origShow = window.showScreen;
  window.showScreen = function (name, fromPopState) {
    _origShow.apply(this, arguments);
    if (name === 'profiles') gpaEiInit();
  };
})();

function gpaEiInit() {
  _gpaEiInjectButtons();
  _gpaEiInjectModal();
}

// ── inject Export / Import buttons into the profiles screen ───
function _gpaEiInjectButtons() {
  if (document.getElementById('gpaEiRow')) return;

  // Look for a stable anchor — the profile list container or screen root
  const screen = document.getElementById('profileScreen');
  if (!screen) return;

  const row = document.createElement('div');
  row.id        = 'gpaEiRow';
  row.className = 'gpa-ei-row';
  row.innerHTML = `
    <button class="gpa-ei-btn" onclick="gpaEiExportAll()">↓ Export all profiles</button>
    <button class="gpa-ei-btn" onclick="gpaEiExportActive()">↓ Export active profile</button>
    <button class="gpa-ei-btn" onclick="gpaEiOpenImport()">↑ Import profiles</button>
  `;

  // Append at the bottom of the profile screen
  screen.appendChild(row);
}

// ── inject shared modal ───────────────────────────────────────
function _gpaEiInjectModal() {
  if (document.getElementById('gpaEiModal')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="gpaEiModal" style="
        display:none;position:fixed;inset:0;
        background:rgba(0,0,0,0.78);backdrop-filter:blur(6px);
        -webkit-backdrop-filter:blur(6px);z-index:310;
        align-items:center;justify-content:center;padding:20px;">
      <div class="gr-modal" style="max-width:440px;">
        <h2>Import Profiles</h2>
        <p style="margin-bottom:10px;">
          Paste JSON below or choose a .json file.
          Profiles with the same name as an existing one are skipped.
        </p>

        <!-- file picker -->
        <label class="ei-file-label">
          <span id="gpaEiFileChosen">No file chosen</span>
          <input type="file" id="gpaEiFileInput" accept=".json,application/json"
                 style="display:none;" onchange="gpaEiOnFileChosen(this)">
          <span class="ei-file-btn">Choose file</span>
        </label>

        <!-- paste area -->
        <textarea id="gpaEiPasteArea" class="ei-textarea"
                  placeholder="Or paste JSON here…"
                  oninput="gpaEiOnPaste(this)"></textarea>

        <!-- preview -->
        <div id="gpaEiPreview" class="ei-preview" style="display:none;"></div>

        <div class="gr-modal-btns" style="margin-top:14px;">
          <button class="gr-btn-ghost"  onclick="gpaEiCloseModal()">Cancel</button>
          <button class="gr-btn-accent" id="gpaEiConfirmBtn"
                  onclick="gpaEiConfirmImport()" disabled>Import</button>
        </div>
      </div>
    </div>
  `);
}

// ── EXPORT ────────────────────────────────────────────────────
function gpaEiExportAll() {
  const profiles = getAllProfiles();
  const keys     = Object.keys(profiles);
  if (!keys.length) { showToast('No profiles to export'); return; }

  const payload = _gpaEiBuildPayload(profiles);
  _gpaEiDownload('gpa_profiles.json', payload);
  showToast(`Exported ${keys.length} profile(s) ✓`);
}

function gpaEiExportActive() {
  if (!activeProfileId) { showToast('No active profile'); return; }
  const profiles = getAllProfiles();
  const p        = profiles[activeProfileId];
  if (!p) { showToast('Active profile not found'); return; }

  const subset = { [activeProfileId]: p };
  const payload = _gpaEiBuildPayload(subset);
  const safeName = (p.name || 'profile').replace(/[^a-z0-9_\-]/gi, '_').toLowerCase();
  _gpaEiDownload(`gpa_${safeName}.json`, payload);
  showToast(`Exported "${p.name}" ✓`);
}

function _gpaEiBuildPayload(profiles) {
  // Strip the localStorage key (id) — on import a new id is generated
  const list = Object.values(profiles).map(p => ({
    name:       p.name       || 'Unnamed',
    dept:       p.dept       || 'CNGB',
    semData:    p.semData    || {},
    semHistory: p.semHistory || {},
  }));
  return {
    _type:    'gpa_profiles',
    _version: GPA_EI_VERSION,
    exported: new Date().toISOString(),
    profiles: list,
  };
}

function _gpaEiDownload(filename, payload) {
  const json = JSON.stringify(payload, null, 2);
  try {
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  } catch (e) {
    // Fallback for Android WebView
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json)
        .then(() => showToast('Copied to clipboard (download not available)'))
        .catch(() => showToast('Export failed — try a desktop browser'));
    } else {
      showToast('Export failed — file download not supported here');
    }
  }
}

// ── IMPORT — modal ────────────────────────────────────────────
let _gpaEiParsed = null;   // validated profiles ready to import

function gpaEiOpenImport() {
  _gpaEiParsed = null;
  document.getElementById('gpaEiPasteArea').value          = '';
  document.getElementById('gpaEiFileChosen').textContent   = 'No file chosen';
  document.getElementById('gpaEiPreview').style.display    = 'none';
  document.getElementById('gpaEiPreview').innerHTML        = '';
  document.getElementById('gpaEiConfirmBtn').disabled      = true;
  document.getElementById('gpaEiModal').style.display      = 'flex';
}

function gpaEiCloseModal() {
  document.getElementById('gpaEiModal').style.display = 'none';
  _gpaEiParsed = null;
}

function gpaEiOnFileChosen(input) {
  const file = input.files[0];
  if (!file) return;
  document.getElementById('gpaEiFileChosen').textContent = file.name;
  const reader = new FileReader();
  reader.onload = e => _gpaEiValidate(e.target.result);
  reader.readAsText(file);
}

function gpaEiOnPaste(textarea) {
  _gpaEiValidate(textarea.value.trim());
}

// ── validate & preview ────────────────────────────────────────
function _gpaEiValidate(raw) {
  const preview = document.getElementById('gpaEiPreview');
  const btn     = document.getElementById('gpaEiConfirmBtn');
  _gpaEiParsed  = null;
  btn.disabled  = true;
  preview.style.display = 'none';
  preview.innerHTML     = '';
  if (!raw) return;

  // Parse JSON
  let payload;
  try { payload = JSON.parse(raw); }
  catch (e) {
    preview.style.display = 'block';
    preview.innerHTML = `<span class="ei-preview-error">Invalid JSON — check for missing commas or brackets.</span>`;
    return;
  }

  // Type check
  if (payload._type !== 'gpa_profiles') {
    preview.style.display = 'block';
    preview.innerHTML = `<span class="ei-preview-error">
      Wrong file type — expected <strong>gpa_profiles</strong>,
      got <strong>${payload._type || 'unknown'}</strong>.
    </span>`;
    return;
  }

  if (!Array.isArray(payload.profiles) || !payload.profiles.length) {
    preview.style.display = 'block';
    preview.innerHTML = `<span class="ei-preview-error">No profiles found in this file.</span>`;
    return;
  }

  // Per-profile validation
  const existingNames = Object.values(getAllProfiles()).map(p => p.name.toLowerCase());
  const valid  = [];
  const errors = [];

  payload.profiles.forEach((p, i) => {
    const label = `Profile ${i + 1}`;

    if (typeof p.name !== 'string' || !p.name.trim()) {
      errors.push(`${label}: missing name`); return;
    }
    if (!VALID_DEPTS.includes(p.dept)) {
      errors.push(`"${p.name}": unknown dept "${p.dept}" (must be CNGB, IENG, or FE)`); return;
    }
    if (typeof p.semData !== 'object' || Array.isArray(p.semData)) {
      errors.push(`"${p.name}": semData is malformed`); return;
    }
    if (typeof p.semHistory !== 'object' || Array.isArray(p.semHistory)) {
      errors.push(`"${p.name}": semHistory is malformed`); return;
    }

    const dupe = existingNames.includes(p.name.trim().toLowerCase());
    const semCount = Object.keys(p.semHistory || {}).length;
    valid.push({ ...p, _dupe: dupe, _semCount: semCount });
  });

  const toImport = valid.filter(p => !p._dupe);
  const skipped  = valid.filter(p => p._dupe);

  // Build preview
  let html = '<div class="ei-preview-list">';
  valid.forEach(p => {
    const meta = `${p.dept} · ${p._semCount} semester(s) saved`;
    html += `<div class="ei-preview-item ${p._dupe ? 'ei-preview-skip' : 'ei-preview-new'}">
      <span class="ei-preview-dot">${p._dupe ? '○' : '●'}</span>
      <div style="flex:1;min-width:0;">
        <div class="ei-preview-name">${_gpaEiEsc(p.name)}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:2px;">${meta}</div>
      </div>
      <span class="ei-preview-tag">${p._dupe ? 'skip — exists' : 'new'}</span>
    </div>`;
  });
  errors.forEach(e => {
    html += `<div class="ei-preview-item ei-preview-error-row">
      <span class="ei-preview-dot">✗</span>
      <span class="ei-preview-name">${_gpaEiEsc(e)}</span>
    </div>`;
  });
  html += '</div>';

  if (toImport.length) {
    html += `<div class="ei-preview-summary">
      ${toImport.length} will be imported${skipped.length ? `, ${skipped.length} skipped` : ''}.
    </div>`;
  } else {
    html += `<div class="ei-preview-summary ei-preview-error">
      Nothing to import — all profiles already exist or are invalid.
    </div>`;
  }

  preview.style.display = 'block';
  preview.innerHTML     = html;

  if (toImport.length) {
    _gpaEiParsed  = toImport;
    btn.disabled  = false;
  }
}

// ── confirm import ────────────────────────────────────────────
function gpaEiConfirmImport() {
  if (!_gpaEiParsed || !_gpaEiParsed.length) return;

  const profiles = getAllProfiles();
  let count = 0;

  _gpaEiParsed.forEach(p => {
    const id = 'prof_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    profiles[id] = {
      name:       p.name.trim(),
      dept:       p.dept,
      semData:    p.semData    || {},
      semHistory: p.semHistory || {},
    };
    count++;
  });

  saveAllProfiles(profiles);
  gpaEiCloseModal();

  // Refresh profile list if visible
  if (typeof renderProfileList === 'function') renderProfileList();
  showToast(`${count} profile(s) imported ✓`);
}

// ── utility ───────────────────────────────────────────────────
function _gpaEiEsc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
