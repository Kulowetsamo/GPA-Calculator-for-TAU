// ── gr_scale_templates.js ─────────────────────────────────────
// Adds named scale presets to the Scale sub-tab.
// Drop after gr_calc.js (and gr_needed.js if present).
//
// ADDING A BUILT-IN SCALE PRESET
// ────────────────────────────────
// Append an object to _RAW_SCALE_BUILTINS:
//   {
//     name:   'My University Scale',
//     scale:  [
//       [90, 'AA', 'Excellent'],
//       [85, 'BA', 'Very Good+'],
//       [80, 'BB', 'Very Good'],
//       [75, 'CB', 'Good+'],
//       [70, 'CC', 'Good'],
//       [65, 'DC', 'Satisfactory+'],
//       [60, 'DD', 'Satisfactory'],
//       [50, 'FD', 'Conditional Fail'],
//       [0,  'FF', 'Fail'],          // always 0, always last
//     ],
//   }
// IDs are auto-assigned — do NOT add an id field yourself.
// ─────────────────────────────────────────────────────────────

const _RAW_SCALE_BUILTINS = [
  {
    name: 'TAU Standard',
    scale: [
      [90, 'AA', 'Excellent'],
      [85, 'BA', 'Very Good+'],
      [80, 'BB', 'Very Good'],
      [75, 'CB', 'Good+'],
      [70, 'CC', 'Good'],
      [65, 'DC', 'Satisfactory+'],
      [60, 'DD', 'Satisfactory'],
      [50, 'FD', 'Conditional Fail'],
      [0,  'FF', 'Fail'],
    ],
  },
  {
    name: 'Lenient (AA from 85)',
    scale: [
      [85, 'AA', 'Excellent'],
      [80, 'BA', 'Very Good+'],
      [70, 'BB', 'Very Good'],
      [60, 'CB', 'Good+'],
      [50, 'CC', 'Good'],
      [45, 'DC', 'Satisfactory+'],
      [40, 'DD', 'Satisfactory'],
      [35, 'FD', 'Conditional Fail'],
      [0,  'FF', 'Fail'],
    ],
  },

  // ── ADD YOUR SCALE PRESETS BELOW THIS LINE ────────────────
];

// Auto-assign IDs
const BUILTIN_SCALE_TEMPLATES = _RAW_SCALE_BUILTINS.map((t, i) => ({
  ...t,
  id:      '__scale_builtin_' + (i + 1),
  builtin: true,
}));

// ── localStorage ──────────────────────────────────────────────
const SCALE_TPL_KEY        = 'gradecalc_scale_templates';
const SCALE_TPL_ACTIVE_KEY = 'gradecalc_scale_active_tpl';

function _stReadAll()      { try { return JSON.parse(localStorage.getItem(SCALE_TPL_KEY)) || []; } catch(e) { return []; } }
function _stWriteAll(arr)  { localStorage.setItem(SCALE_TPL_KEY, JSON.stringify(arr)); }

function stGetSaved()      { return _stReadAll(); }
function stGetById(id) {
  if (id && id.startsWith('__scale_builtin'))
    return BUILTIN_SCALE_TEMPLATES.find(t => t.id === id) || null;
  return _stReadAll().find(t => t.id === id) || null;
}

function stSave(name, scale) {
  const all = _stReadAll();
  const tpl = {
    name, scale,
    id:        'stpl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    createdAt: Date.now(),
    builtin:   false,
  };
  all.push(tpl);
  _stWriteAll(all);
  return tpl;
}

function stDelete(id) {
  if (id.startsWith('__scale_builtin')) return false;
  _stWriteAll(_stReadAll().filter(t => t.id !== id));
  if (stGetActiveId() === id) stClearActive();
  return true;
}

function stRename(id, name) {
  if (id.startsWith('__scale_builtin')) return false;
  const all = _stReadAll();
  const idx = all.findIndex(t => t.id === id);
  if (idx === -1) return false;
  all[idx] = { ...all[idx], name };
  _stWriteAll(all);
  return true;
}

function stGetActiveId()   { return localStorage.getItem(SCALE_TPL_ACTIVE_KEY) || null; }
function stSetActiveId(id) { localStorage.setItem(SCALE_TPL_ACTIVE_KEY, id); }
function stClearActive()   { localStorage.removeItem(SCALE_TPL_ACTIVE_KEY); }

// ── patch initGradeScreen to inject scale-template UI ─────────
(function () {
  const _orig = window.initGradeScreen;
  window.initGradeScreen = function () {
    _orig.apply(this, arguments);
    _stInjectUI();
  };
})();

// ── patch grShowScreen to refresh template list on tab open ───
(function () {
  const _orig = window.grShowScreen;
  window.grShowScreen = function (name) {
    _orig.apply(this, arguments);
    if (name === 'scale') _stRenderTemplateList();
  };
})();

// ── inject template UI into the Scale screen ──────────────────
function _stInjectUI() {
  if (document.getElementById('stTemplateSection')) return;

  const scaleMain = document.querySelector('#grScaleScreen .gr-main');
  if (!scaleMain) return;

  // ── Active bar (shown when a preset is loaded) ────────────
  const activeBar = document.createElement('div');
  activeBar.id        = 'stActiveBar';
  activeBar.className = 'gr-active-bar';
  activeBar.style.display = 'none';
  activeBar.innerHTML = `
    <div>
      <div class="gr-active-bar-label">Active Scale Preset</div>
      <div class="gr-active-bar-name" id="stActiveBarName">—</div>
    </div>
    <div style="display:flex;gap:6px;">
      <button class="gr-btn-ghost" style="font-size:10px;" onclick="stClearAndReset()">Clear</button>
      <button class="gr-btn-ghost"
              style="font-size:10px;color:var(--accent2);border-color:rgba(144,144,208,0.3);"
              onclick="stUpdateActive()">Update</button>
    </div>`;
  scaleMain.prepend(activeBar);

  // ── Template list card ────────────────────────────────────
  const card = document.createElement('div');
  card.id        = 'stTemplateSection';
  card.className = 'gr-card';
  card.innerHTML = `
    <div class="gr-card-label-row">
      <div class="gr-card-label">Scale Presets</div>
      <button class="gr-btn-ghost" style="font-size:10px;" onclick="stOpenSaveModal()">Save current</button>
    </div>
    <p style="font-size:11px;color:var(--muted);margin-bottom:14px;line-height:1.7;">
      Save and reload complete grading scales. Built-in presets are read-only.
    </p>
    <div class="gr-section-heading">Built-in Presets</div>
    <div class="gr-tpl-list" id="stBuiltinList"></div>
    <div class="gr-section-heading" style="margin-top:20px;">Your Saved Presets</div>
    <div class="gr-tpl-list" id="stSavedList"></div>
    <div id="stNoSaved" style="font-size:11px;color:var(--muted);padding:8px 0;display:none;">
      No saved presets yet. Tweak the thresholds above and press "Save current".
    </div>
  `;
  scaleMain.appendChild(card);

  // ── Modals ────────────────────────────────────────────────
  if (!document.getElementById('stSaveModal')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="stSaveModal" style="
        display:none;position:fixed;inset:0;
        background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);
        -webkit-backdrop-filter:blur(6px);z-index:300;
        align-items:center;justify-content:center;padding:20px;">
        <div class="gr-modal">
          <h2>Save Scale Preset</h2>
          <p>Give this grading scale a name so you can reload it anytime.</p>
          <input type="text" id="stSaveInput" placeholder="e.g. Prof. Smith's Scale" maxlength="50"
                 onkeydown="if(event.key==='Enter') stConfirmSave()"/>
          <div class="gr-modal-btns">
            <button class="gr-btn-ghost"  onclick="stCloseSaveModal()">Cancel</button>
            <button class="gr-btn-accent" onclick="stConfirmSave()">Save</button>
          </div>
        </div>
      </div>

      <div id="stDeleteModal" style="
        display:none;position:fixed;inset:0;
        background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);
        -webkit-backdrop-filter:blur(6px);z-index:300;
        align-items:center;justify-content:center;padding:20px;">
        <div class="gr-modal">
          <h2>Delete Scale Preset</h2>
          <p id="stDeleteText">Are you sure?</p>
          <div class="gr-modal-btns">
            <button class="gr-btn-ghost"   onclick="stCloseDeleteModal()">Cancel</button>
            <button class="gr-btn-danger"  onclick="stConfirmDelete()">Delete</button>
          </div>
        </div>
      </div>

      <div id="stRenameModal" style="
        display:none;position:fixed;inset:0;
        background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);
        -webkit-backdrop-filter:blur(6px);z-index:300;
        align-items:center;justify-content:center;padding:20px;">
        <div class="gr-modal">
          <h2>Rename Scale Preset</h2>
          <p>Enter a new name for this preset.</p>
          <input type="text" id="stRenameInput" placeholder="New name" maxlength="50"
                 onkeydown="if(event.key==='Enter') stConfirmRename()"/>
          <div class="gr-modal-btns">
            <button class="gr-btn-ghost"  onclick="stCloseRenameModal()">Cancel</button>
            <button class="gr-btn-accent" onclick="stConfirmRename()">Rename</button>
          </div>
        </div>
      </div>
    `);
  }

  _stRenderActiveBar();
  _stRenderTemplateList();
}

// ── render active bar ─────────────────────────────────────────
function _stRenderActiveBar() {
  const bar  = document.getElementById('stActiveBar');
  const name = document.getElementById('stActiveBarName');
  if (!bar) return;
  const id  = stGetActiveId();
  const tpl = id ? stGetById(id) : null;
  bar.style.display = tpl ? '' : 'none';
  if (name && tpl) name.textContent = tpl.name;
}

// ── render template list ──────────────────────────────────────
function _stRenderTemplateList() {
  const activeId = stGetActiveId();

  // Built-ins
  const bl = document.getElementById('stBuiltinList');
  if (!bl) return;
  bl.innerHTML = '';
  BUILTIN_SCALE_TEMPLATES.forEach(tpl => {
    const isActive = tpl.id === activeId;
    const item = document.createElement('div');
    item.className = 'gr-tpl-item' + (isActive ? ' gr-active-tpl' : '');
    item.innerHTML = `
      <div class="gr-tpl-item-info">
        <div class="gr-tpl-item-name">${grEscHtml(tpl.name)}</div>
        <div class="gr-tpl-item-meta">${_stScaleSummary(tpl.scale)}</div>
      </div>
      <span class="gr-tpl-item-badge builtin">preset</span>`;
    item.onclick = () => stLoadPreset(tpl.id);
    bl.appendChild(item);
  });

  // Saved
  const sl     = document.getElementById('stSavedList');
  const noSave = document.getElementById('stNoSaved');
  const saved  = stGetSaved();
  sl.innerHTML = '';
  noSave.style.display = saved.length === 0 ? '' : 'none';
  saved.forEach(tpl => {
    const isActive = tpl.id === activeId;
    const item = document.createElement('div');
    item.className = 'gr-tpl-item' + (isActive ? ' gr-active-tpl' : '');
    item.innerHTML = `
      <div class="gr-tpl-item-info" style="cursor:pointer;">
        <div class="gr-tpl-item-name">${grEscHtml(tpl.name)}</div>
        <div class="gr-tpl-item-meta">${_stScaleSummary(tpl.scale)}</div>
      </div>
      <div class="gr-tpl-actions">
        <button class="gr-btn-ghost"  style="font-size:10px;"
                onclick="event.stopPropagation();stOpenRenameModal('${tpl.id}')">Rename</button>
        <button class="gr-btn-danger" style="font-size:10px;"
                onclick="event.stopPropagation();stOpenDeleteModal('${tpl.id}','${grEscHtml(tpl.name)}')">Del</button>
      </div>`;
    item.querySelector('.gr-tpl-item-info').onclick = () => stLoadPreset(tpl.id);
    sl.appendChild(item);
  });
}

// Short human-readable summary, e.g. "AA≥90 · DD≥60 · FF=0"
function _stScaleSummary(scale) {
  if (!scale || !scale.length) return '';
  const aa = scale[0];
  const dd = scale.find(([,code]) => code === 'DD');
  const fd = scale.find(([,code]) => code === 'FD');
  const parts = [];
  if (aa) parts.push(`AA ≥ ${aa[0]}`);
  if (dd) parts.push(`DD ≥ ${dd[0]}`);
  if (fd) parts.push(`FD ≥ ${fd[0]}`);
  parts.push('FF = 0');
  return parts.join(' · ');
}

// ── load a preset into the live scale ────────────────────────
function stLoadPreset(id) {
  const tpl = stGetById(id);
  if (!tpl) return;

  // Deep-copy into LETTER_SCALE and persist
  LETTER_SCALE.length = 0;
  tpl.scale.forEach(row => LETTER_SCALE.push([...row]));
  grSaveScale(LETTER_SCALE);

  stSetActiveId(id);

  // Refresh scale editor + recalculate
  if (typeof grRenderScaleScreen === 'function') grRenderScaleScreen();
  if (typeof grCalc             === 'function') grCalc();
  if (typeof grNeededBuildPills === 'function') grNeededBuildPills(), grNeededCalc();

  _stRenderActiveBar();
  _stRenderTemplateList();
  grShowToast('Scale preset loaded ✓');
}

// ── capture the current live LETTER_SCALE ────────────────────
function _stCurrentScale() {
  return LETTER_SCALE.map(r => [...r]);
}

// ── clear active + reset to TAU default ──────────────────────
function stClearAndReset() {
  stClearActive();
  grResetScaleUI();          // already defined in gr_calc.js
  _stRenderActiveBar();
  _stRenderTemplateList();
}

// ── update the active preset with the current thresholds ─────
function stUpdateActive() {
  const id = stGetActiveId();
  if (!id || id.startsWith('__scale_builtin')) {
    grShowToast('Built-in presets cannot be updated'); return;
  }
  stRename(id, stGetById(id)?.name || 'Unnamed'); // keep name
  const all = _stReadAll();
  const idx = all.findIndex(t => t.id === id);
  if (idx !== -1) {
    all[idx].scale = _stCurrentScale();
    _stWriteAll(all);
  }
  grShowToast('Scale preset updated ✓');
  _stRenderTemplateList();
}

// ── save modal ────────────────────────────────────────────────
let _stDeleteTargetId = null;
let _stRenameTargetId = null;

function stOpenSaveModal() {
  document.getElementById('stSaveInput').value = '';
  const m = document.getElementById('stSaveModal');
  m.style.display = 'flex';
  setTimeout(() => document.getElementById('stSaveInput').focus(), 80);
}
function stCloseSaveModal() { document.getElementById('stSaveModal').style.display = 'none'; }
function stConfirmSave() {
  const name = document.getElementById('stSaveInput').value.trim();
  if (!name) { document.getElementById('stSaveInput').focus(); return; }
  const tpl = stSave(name, _stCurrentScale());
  stSetActiveId(tpl.id);
  stCloseSaveModal();
  _stRenderActiveBar();
  _stRenderTemplateList();
  grShowToast('Scale preset saved ✓');
}

// ── delete modal ──────────────────────────────────────────────
function stOpenDeleteModal(id, name) {
  _stDeleteTargetId = id;
  document.getElementById('stDeleteText').textContent = `Delete "${name}"? This cannot be undone.`;
  document.getElementById('stDeleteModal').style.display = 'flex';
}
function stCloseDeleteModal() { document.getElementById('stDeleteModal').style.display = 'none'; }
function stConfirmDelete() {
  if (!_stDeleteTargetId) return;
  stDelete(_stDeleteTargetId);
  _stDeleteTargetId = null;
  stCloseDeleteModal();
  _stRenderActiveBar();
  _stRenderTemplateList();
  grShowToast('Scale preset deleted');
}

// ── rename modal ──────────────────────────────────────────────
function stOpenRenameModal(id) {
  _stRenameTargetId = id;
  const tpl = stGetById(id);
  document.getElementById('stRenameInput').value = tpl ? tpl.name : '';
  document.getElementById('stRenameModal').style.display = 'flex';
  setTimeout(() => document.getElementById('stRenameInput').focus(), 80);
}
function stCloseRenameModal() { document.getElementById('stRenameModal').style.display = 'none'; }
function stConfirmRename() {
  const name = document.getElementById('stRenameInput').value.trim();
  if (!name || !_stRenameTargetId) return;
  stRename(_stRenameTargetId, name);
  _stRenameTargetId = null;
  stCloseRenameModal();
  _stRenderTemplateList();
  grShowToast('Renamed ✓');
}
