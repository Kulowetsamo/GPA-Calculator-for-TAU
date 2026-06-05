// ── gr_export_import.js ───────────────────────────────────────
// Export and import for both grade templates (gr_storage.js)
// and scale presets (gr_scale_templates.js).
//
// Adds two buttons to each template list:
//   • Export all  — downloads a .json file  (or copies to clipboard)
//   • Import      — accepts a .json file or pasted text
//
// Drop after gr_calc.js, gr_storage.js, gr_scale_templates.js.
// No existing files need to change.
// ─────────────────────────────────────────────────────────────

const EI_VERSION = 1;   // bump if the schema changes

// ── patch grShowScreen & initGradeScreen ──────────────────────
(function () {
  const _origInit = window.initGradeScreen;
  window.initGradeScreen = function () {
    _origInit.apply(this, arguments);
    _eiInjectGradeButtons();
    _eiInjectModal();
  };

  const _origShow = window.grShowScreen;
  window.grShowScreen = function (name) {
    _origShow.apply(this, arguments);
    if (name === 'templates') _eiInjectGradeButtons();
    if (name === 'scale')     _eiInjectScaleButtons();
  };
})();

// ── inject export/import buttons into the grade templates card ─
function _eiInjectGradeButtons() {
  if (document.getElementById('eiGradeExportRow')) return;
  // Find the saved-templates section heading and append below the list
  const noSaved = document.getElementById('grNoSaved');
  if (!noSaved) return;

  const row = document.createElement('div');
  row.id        = 'eiGradeExportRow';
  row.className = 'ei-action-row';
  row.innerHTML = `
    <button class="gr-btn-ghost ei-btn" onclick="eiExportGradeTemplates()">↓ Export grade templates</button>
    <button class="gr-btn-ghost ei-btn" onclick="eiOpenImport('grade')">↑ Import grade templates</button>
  `;
  noSaved.insertAdjacentElement('afterend', row);
}

// ── inject export/import buttons into the scale presets card ───
function _eiInjectScaleButtons() {
  if (document.getElementById('eiScaleExportRow')) return;
  const noSaved = document.getElementById('stNoSaved');
  if (!noSaved) return;

  const row = document.createElement('div');
  row.id        = 'eiScaleExportRow';
  row.className = 'ei-action-row';
  row.innerHTML = `
    <button class="gr-btn-ghost ei-btn" onclick="eiExportScaleTemplates()">↓ Export scale presets</button>
    <button class="gr-btn-ghost ei-btn" onclick="eiOpenImport('scale')">↑ Import scale presets</button>
  `;
  noSaved.insertAdjacentElement('afterend', row);
}

// ── shared modal (injected once) ──────────────────────────────
function _eiInjectModal() {
  if (document.getElementById('eiModal')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="eiModal" style="
        display:none;position:fixed;inset:0;
        background:rgba(0,0,0,0.78);backdrop-filter:blur(6px);
        -webkit-backdrop-filter:blur(6px);z-index:310;
        align-items:center;justify-content:center;padding:20px;">
      <div class="gr-modal" style="max-width:420px;">
        <h2 id="eiModalTitle">Import Templates</h2>
        <p id="eiModalDesc" style="margin-bottom:10px;">
          Paste JSON below, or choose a file. Existing templates with the same
          name are skipped — duplicates are never overwritten.
        </p>

        <!-- file picker -->
        <label class="ei-file-label">
          <span id="eiFileChosen">No file chosen</span>
          <input type="file" id="eiFileInput" accept=".json,application/json"
                 style="display:none;" onchange="eiOnFileChosen(this)">
          <span class="ei-file-btn">Choose file</span>
        </label>

        <!-- paste area -->
        <textarea id="eiPasteArea" class="ei-textarea"
                  placeholder='Or paste JSON here…'
                  oninput="eiOnPaste(this)"></textarea>

        <!-- preview -->
        <div id="eiPreview" class="ei-preview" style="display:none;"></div>

        <div class="gr-modal-btns" style="margin-top:14px;">
          <button class="gr-btn-ghost"  onclick="eiCloseModal()">Cancel</button>
          <button class="gr-btn-accent" id="eiConfirmBtn"
                  onclick="eiConfirmImport()" disabled>Import</button>
        </div>
      </div>
    </div>
  `);
}

// ── state ─────────────────────────────────────────────────────
let _eiMode      = 'grade';   // 'grade' | 'scale'
let _eiParsed    = null;      // validated parsed payload

// ── EXPORT ────────────────────────────────────────────────────
function eiExportGradeTemplates() {
  const saved = getSavedTemplates();    // from gr_storage.js
  if (!saved.length) { grShowToast('No saved grade templates to export'); return; }

  const payload = {
    _type:    'grade_templates',
    _version: EI_VERSION,
    exported: new Date().toISOString(),
    templates: saved.map(t => {
      // strip runtime-only fields, keep everything structural
      const { id, createdAt, builtin, ...rest } = t;
      return rest;
    }),
  };
  _eiDownload('grade_templates.json', payload);
  grShowToast(`Exported ${saved.length} grade template(s) ✓`);
}

function eiExportScaleTemplates() {
  const saved = stGetSaved();           // from gr_scale_templates.js
  if (!saved.length) { grShowToast('No saved scale presets to export'); return; }

  const payload = {
    _type:    'scale_templates',
    _version: EI_VERSION,
    exported: new Date().toISOString(),
    templates: saved.map(t => {
      const { id, createdAt, builtin, ...rest } = t;
      return rest;
    }),
  };
  _eiDownload('scale_presets.json', payload);
  grShowToast(`Exported ${saved.length} scale preset(s) ✓`);
}

function _eiDownload(filename, payload) {
  const json = JSON.stringify(payload, null, 2);
  // Try file download first; fall back to clipboard
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
    // WebView / restricted env — copy to clipboard instead
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json)
        .then(() => grShowToast('Copied to clipboard (file download not available)'))
        .catch(() => grShowToast('Export failed — try a desktop browser'));
    } else {
      grShowToast('Export failed — file download not supported here');
    }
  }
}

// ── IMPORT — modal open ────────────────────────────────────────
function eiOpenImport(mode) {
  _eiMode   = mode;
  _eiParsed = null;

  const title = document.getElementById('eiModalTitle');
  const desc  = document.getElementById('eiModalDesc');
  if (title) title.textContent = mode === 'grade' ? 'Import Grade Templates' : 'Import Scale Presets';
  if (desc)  desc.textContent  =
    'Paste JSON below or choose a .json file. Templates that already exist ' +
    '(same name) will be skipped.';

  document.getElementById('eiPasteArea').value   = '';
  document.getElementById('eiFileChosen').textContent = 'No file chosen';
  document.getElementById('eiPreview').style.display  = 'none';
  document.getElementById('eiPreview').innerHTML      = '';
  document.getElementById('eiConfirmBtn').disabled    = true;

  document.getElementById('eiModal').style.display = 'flex';
}

function eiCloseModal() {
  document.getElementById('eiModal').style.display = 'none';
  _eiParsed = null;
}

// ── file chosen ───────────────────────────────────────────────
function eiOnFileChosen(input) {
  const file = input.files[0];
  if (!file) return;
  document.getElementById('eiFileChosen').textContent = file.name;
  const reader = new FileReader();
  reader.onload = e => _eiValidateAndPreview(e.target.result);
  reader.readAsText(file);
}

// ── paste ─────────────────────────────────────────────────────
function eiOnPaste(textarea) {
  _eiValidateAndPreview(textarea.value.trim());
}

// ── validate + preview ────────────────────────────────────────
function _eiValidateAndPreview(raw) {
  const preview = document.getElementById('eiPreview');
  const btn     = document.getElementById('eiConfirmBtn');
  _eiParsed     = null;
  btn.disabled  = true;
  preview.style.display = 'none';
  preview.innerHTML     = '';

  if (!raw) return;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (e) {
    preview.style.display = 'block';
    preview.innerHTML = `<span class="ei-preview-error">Invalid JSON — check for missing commas or brackets.</span>`;
    return;
  }

  // Type check
  const expectedType = _eiMode === 'grade' ? 'grade_templates' : 'scale_templates';
  if (payload._type !== expectedType) {
    preview.style.display = 'block';
    preview.innerHTML = `<span class="ei-preview-error">
      Wrong file type — expected <strong>${expectedType}</strong>,
      got <strong>${payload._type || 'unknown'}</strong>.
    </span>`;
    return;
  }

  if (!Array.isArray(payload.templates) || !payload.templates.length) {
    preview.style.display = 'block';
    preview.innerHTML = `<span class="ei-preview-error">No templates found in this file.</span>`;
    return;
  }

  // Per-item validation
  const items    = payload.templates;
  const errors   = [];
  const valid    = [];

  if (_eiMode === 'grade') {
    const existing = getSavedTemplates().map(t => t.name.toLowerCase());
    items.forEach((t, i) => {
      if (typeof t.name !== 'string' || !t.name.trim()) {
        errors.push(`Item ${i + 1}: missing name`); return;
      }
      if (!t.weights || typeof t.weights !== 'object') {
        errors.push(`"${t.name}": missing weights`); return;
      }
      const dupe = existing.includes(t.name.trim().toLowerCase());
      valid.push({ ...t, _dupe: dupe });
    });
  } else {
    const existing = stGetSaved().map(t => t.name.toLowerCase());
    items.forEach((t, i) => {
      if (typeof t.name !== 'string' || !t.name.trim()) {
        errors.push(`Item ${i + 1}: missing name`); return;
      }
      if (!Array.isArray(t.scale) || t.scale.length !== 9) {
        errors.push(`"${t.name}": scale must have exactly 9 entries`); return;
      }
      const dupe = existing.includes(t.name.trim().toLowerCase());
      valid.push({ ...t, _dupe: dupe });
    });
  }

  const toImport = valid.filter(t => !t._dupe);
  const skipped  = valid.filter(t => t._dupe);

  // Build preview HTML
  let html = '<div class="ei-preview-list">';
  valid.forEach(t => {
    html += `<div class="ei-preview-item ${t._dupe ? 'ei-preview-skip' : 'ei-preview-new'}">
      <span class="ei-preview-dot">${t._dupe ? '○' : '●'}</span>
      <span class="ei-preview-name">${grEscHtml(t.name)}</span>
      <span class="ei-preview-tag">${t._dupe ? 'skip — exists' : 'new'}</span>
    </div>`;
  });
  errors.forEach(e => {
    html += `<div class="ei-preview-item ei-preview-error-row">
      <span class="ei-preview-dot">✗</span>
      <span class="ei-preview-name">${grEscHtml(e)}</span>
    </div>`;
  });
  html += '</div>';

  if (toImport.length) {
    html += `<div class="ei-preview-summary">
      ${toImport.length} will be imported${skipped.length ? `, ${skipped.length} skipped` : ''}.
    </div>`;
  } else {
    html += `<div class="ei-preview-summary ei-preview-error">
      Nothing to import — all templates already exist or are invalid.
    </div>`;
  }

  preview.style.display = 'block';
  preview.innerHTML     = html;

  if (toImport.length) {
    _eiParsed    = toImport;
    btn.disabled = false;
  }
}

// ── confirm import ────────────────────────────────────────────
function eiConfirmImport() {
  if (!_eiParsed || !_eiParsed.length) return;

  let count = 0;
  if (_eiMode === 'grade') {
    _eiParsed.forEach(t => {
      const { _dupe, ...data } = t;
      saveTemplate(data);       // from gr_storage.js
      count++;
    });
    if (typeof grRenderTemplatesScreen === 'function') grRenderTemplatesScreen();
  } else {
    _eiParsed.forEach(t => {
      const { _dupe, ...data } = t;
      stSave(data.name, data.scale);   // from gr_scale_templates.js
      count++;
    });
    if (typeof _stRenderTemplateList === 'function') _stRenderTemplateList();
  }

  eiCloseModal();
  grShowToast(`${count} template(s) imported ✓`);
}
