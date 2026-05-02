// ── storage.js ────────────────────────────────────────────────
//
// ADDING A BUILT-IN TEMPLATE
// ──────────────────────────
// Append an object to _RAW_BUILTINS. All fields:
//
//   name            string   — shown in the list
//   weights         object   — must sum to 100
//     .midterm      number   (%) — 0 if unused
//     .final        number   (%) — 0 if unused
//     .quizzes      number   (%) — 0 if unused
//     .bonusQuizzes number   (%) — 0 if unused
//   midtermCount    number   — how many Midterm rows (1, 2, 3 …) (ignored if hasMidterm=false)
//   hasQuizzes      boolean  — show Quizzes row?
//   hasBonusQuiz    boolean  — show Bonus Quizzes row?
//   hasMidterm      boolean  — show Midterm section? (default true)
//   hasFinal        boolean  — show Final exam row? (default true)
//   extras          array    — OPTIONAL extra components, e.g.:
//     [
//       { label: 'Speaking',   weight: 15 },
//       { label: 'Attendance', weight: 5  },
//     ]
//     Each extra gets its own grade input row.
//     Their weights count toward the 100% total.
//
// IDs are auto-assigned — do NOT add an id field yourself.
//
// ── EXAMPLE ──────────────────────────────────────────────────
//   {
//     name: 'English — Speaking + Attendance',
//     weights: { midterm: 30, final: 50, quizzes: 0, bonusQuizzes: 0 },
//     midtermCount: 2,
//     hasQuizzes: false,
//     hasBonusQuiz: false,
//     hasMidterm: true,
//     hasFinal: true,
//     extras: [
//       { label: 'Speaking',   weight: 15 },
//       { label: 'Attendance', weight: 5  },
//     ],
//   },
// ─────────────────────────────────────────────────────────────

const _RAW_BUILTINS = [
  {
    name: 'English — Speaking + Attendance',
    weights: { midterm: 0, final: 0, quizzes: 0, bonusQuizzes: 0 },
    midtermCount: 0,
    hasQuizzes: false,
    hasBonusQuiz: false,
    hasMidterm: false,
    hasFinal: false,
    extras: [
      { label: 'Midterm 1', weight: 15 },
      { label: 'Midterm 2', weight: 20 },
      { label: 'Speaking 1', weight: 10 },
      { label: 'Speaking 2', weight: 15 },
      { label: 'Speaking 3', weight: 15 },
      { label: 'Quiz', weight: 5 },
      { label: 'Attendance', weight: 10 },
      { label: 'End-of-course Interview', weight: 10 },
    ],
  },
  {
    name: '2 MT · 1 Final · 10% Bonus Quizzes',
    weights: { midterm: 40, final: 50, quizzes: 0, bonusQuizzes: 10 },
    midtermCount: 2,
    hasQuizzes: false,
    hasBonusQuiz: true,
    hasMidterm: true,
    hasFinal: true,
  },
  {
    name: '1 MT · Quizzes · 1 Final',
    weights: { midterm: 30, final: 50, quizzes: 20, bonusQuizzes: 0 },
    midtermCount: 1,
    hasQuizzes: true,
    hasBonusQuiz: false,
    hasMidterm: true,
    hasFinal: true,
  },
  {
    name: '2 MT · Quizzes · Bonus · 1 Final',
    weights: { midterm: 35, final: 45, quizzes: 10, bonusQuizzes: 10 },
    midtermCount: 2,
    hasQuizzes: true,
    hasBonusQuiz: true,
    hasMidterm: true,
    hasFinal: true,
  },
  {
    name: '3 MT · 1 Final',
    weights: { midterm: 50, final: 50, quizzes: 0, bonusQuizzes: 0 },
    midtermCount: 3,
    hasQuizzes: false,
    hasBonusQuiz: false,
    hasMidterm: true,
    hasFinal: true,
  },
  {
    name: 'English · Speaking · Attendance',
    weights: { midterm: 30, final: 50, quizzes: 0, bonusQuizzes: 0 },
    midtermCount: 2,
    hasQuizzes: false,
    hasBonusQuiz: false,
    hasMidterm: true,
    hasFinal: true,
    extras: [
      { label: 'Speaking',   weight: 15 },
      { label: 'Attendance', weight: 5  },
    ],
  },

  // ── ADD YOUR TEMPLATES BELOW THIS LINE ────────────────────────

  // ── END OF CUSTOM TEMPLATES ───────────────────────────────────
];

// Auto-assign stable IDs
const BUILTIN_TEMPLATES = _RAW_BUILTINS.map((t, i) => ({
  extras: [],
  hasMidterm: true,      // defaults for safety
  hasFinal: true,
  ...t,
  id: '__builtin_' + (i + 1),
  builtin: true,
}));

// ── localStorage keys ─────────────────────────────────────────
const STORAGE_KEY = 'gradecalc_templates';
const ACTIVE_KEY  = 'gradecalc_active';

function _readAll() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch (e) { return []; }
}
function _writeAll(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

// Normalize template (add missing fields for backward compat)
function _normalize(tpl) {
  return {
    extras: [],
    hasMidterm: true,
    hasFinal: true,
    ...tpl,
  };
}

// ── Public API ────────────────────────────────────────────────
function getBuiltinTemplates() { return BUILTIN_TEMPLATES; }
function getSavedTemplates()   { return _readAll().map(_normalize); }

function getTemplateById(id) {
  if (id && id.startsWith('__builtin')) {
    return BUILTIN_TEMPLATES.find(t => t.id === id) || null;
  }
  const saved = _readAll().find(t => t.id === id);
  return saved ? _normalize(saved) : null;
}

function saveTemplate(data) {
  const all = _readAll();
  const tpl = {
    extras: [],
    hasMidterm: true,
    hasFinal: true,
    ...data,
    id: 'tpl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    createdAt: Date.now(),
    builtin: false,
  };
  all.push(tpl);
  _writeAll(all);
  return tpl;
}

function updateTemplate(id, changes) {
  if (id.startsWith('__builtin')) return false;
  const all = _readAll();
  const idx = all.findIndex(t => t.id === id);
  if (idx === -1) return false;
  all[idx] = { extras: [], hasMidterm: true, hasFinal: true, ...all[idx], ...changes, id, builtin: false };
  _writeAll(all);
  return true;
}

function deleteTemplate(id) {
  if (id.startsWith('__builtin')) return false;
  _writeAll(_readAll().filter(t => t.id !== id));
  if (getActiveTemplateId() === id) clearActiveTemplate();
  return true;
}

function getActiveTemplateId()   { return localStorage.getItem(ACTIVE_KEY) || null; }
function setActiveTemplateId(id) { localStorage.setItem(ACTIVE_KEY, id); }
function clearActiveTemplate()   { localStorage.removeItem(ACTIVE_KEY); }