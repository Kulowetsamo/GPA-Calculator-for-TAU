// ── gr_calc.js ────────────────────────────────────────────────

const DEFAULT_LETTER_SCALE = [
  [90, 'AA', 'Excellent'],
  [85, 'BA', 'Very Good+'],
  [80, 'BB', 'Very Good'],
  [75, 'CB', 'Good+'],
  [70, 'CC', 'Good'],
  [65, 'DC', 'Satisfactory+'],
  [60, 'DD', 'Satisfactory'],
  [50, 'FD', 'Conditional Fail'],
  [0,  'FF', 'Fail'],
];

const SCALE_STORAGE_KEY = 'gradecalc_scale';

function grLoadScale() {
  try {
    const raw = localStorage.getItem(SCALE_STORAGE_KEY);
    if (!raw) return DEFAULT_LETTER_SCALE.map(r => [...r]);
    const parsed = JSON.parse(raw);
    if (parsed.length === 9) return parsed;
  } catch(e) {}
  return DEFAULT_LETTER_SCALE.map(r => [...r]);
}

function grSaveScale(scale) {
  localStorage.setItem(SCALE_STORAGE_KEY, JSON.stringify(scale));
}

function grResetScale() {
  localStorage.removeItem(SCALE_STORAGE_KEY);
  return DEFAULT_LETTER_SCALE.map(r => [...r]);
}

let LETTER_SCALE = grLoadScale();

function letterGrade(score) {
  for (const [min, code, desc] of LETTER_SCALE) {
    if (score >= min) return { code, desc };
  }
  return { code: 'FF', desc: 'Fail' };
}

function computeGrade(state) {
  const { weights, midterms, final, quizzes, lab, bonusQuiz,
          extraGrades = [], extraWeights = [], extraLabels = [] } = state;

  const w = {
    midterm:      parseFloat(weights.midterm)      || 0,
    final:        parseFloat(weights.final)         || 0,
    quizzes:      parseFloat(weights.quizzes)       || 0,
    lab:          parseFloat(weights.lab)           || 0,
    bonusQuizzes: parseFloat(weights.bonusQuizzes)  || 0,
  };

  const extraTotal = extraWeights.reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const weightTotal = w.midterm + w.final + w.quizzes + w.lab + w.bonusQuizzes + extraTotal;

  let score = 0;
  const breakdown = [];

  const validMts = midterms.filter(v => v !== null && v !== '');
  if (validMts.length > 0 && w.midterm > 0) {
    const avg     = validMts.reduce((s, v) => s + parseFloat(v), 0) / validMts.length;
    const contrib = avg * w.midterm / 100;
    score += contrib;
    breakdown.push({ label: `Midterm avg (${avg.toFixed(1)}) × ${w.midterm}%`, contribution: contrib });
  }

  if (final !== null && final !== '' && w.final > 0) {
    const contrib = parseFloat(final) * w.final / 100;
    score += contrib;
    breakdown.push({ label: `Final × ${w.final}%`, contribution: contrib });
  }

  if (quizzes !== null && quizzes !== '' && w.quizzes > 0) {
    const contrib = parseFloat(quizzes) * w.quizzes / 100;
    score += contrib;
    breakdown.push({ label: `Quizzes × ${w.quizzes}%`, contribution: contrib });
  }

  if (lab !== null && lab !== '' && w.lab > 0) {
    const contrib = parseFloat(lab) * w.lab / 100;
    score += contrib;
    breakdown.push({ label: `Lab avg (${parseFloat(lab).toFixed(1)}) × ${w.lab}%`, contribution: contrib });
  }

  if (bonusQuiz !== null && bonusQuiz !== '' && w.bonusQuizzes > 0) {
    const contrib = parseFloat(bonusQuiz) * w.bonusQuizzes / 100;
    score += contrib;
    breakdown.push({ label: `Bonus quizzes × ${w.bonusQuizzes}%`, contribution: contrib });
  }

  extraGrades.forEach((grade, i) => {
    const wt    = parseFloat(extraWeights[i]) || 0;
    const label = extraLabels[i] || `Extra ${i + 1}`;
    if (grade !== null && grade !== '' && wt > 0) {
      const contrib = parseFloat(grade) * wt / weightTotal;
      score += contrib;
      breakdown.push({ label: `${label} × ${wt}%`, contribution: contrib });
    }
  });

  return { score, letter: letterGrade(score), breakdown, weightTotal };
}

// ── Grade Screen Controller ───────────────────────────────────

let _gradeScreenReady = false;

// State
let grMidterms = [null, null];
let grQuizEntries = [null];
let grLabEntries  = [null];
let grCurrentExtraDefs = [];
let _grDeleteTargetId = null;
let _grRenameTargetId = null;
let _grCurrentScreen  = 'calc';
let _grToastTimer;

function initGradeScreen() {
  if (_gradeScreenReady) return;
  _gradeScreenReady = true;

  const scroll = document.getElementById('gradeScreenScroll');
  scroll.innerHTML = `
    <!-- Header -->
    <div class="gr-header">
      <div>
        <div class="gr-header-title">Grade Calc</div>
        <div class="gr-header-sub" id="grHeaderSub">AA · BA · BB · CB · CC · DC · DD · FD · FF</div>
      </div>
      <button class="gr-btn-ghost" id="grSaveTemplateBtn" onclick="grOpenSaveModal()" style="font-size:11px;">Save Template</button>
    </div>

    <!-- Sub-nav -->
    <div class="gr-nav">
      <button class="gr-nav-btn gr-active" id="grNavCalc" onclick="grShowScreen('calc')">Calc</button>
      <button class="gr-nav-btn" id="grNavTemplates" onclick="grShowScreen('templates')">Templates</button>
      <button class="gr-nav-btn" id="grNavScale" onclick="grShowScreen('scale')">Scale</button>
    </div>

    <!-- CALC sub-screen -->
    <div class="gr-screen gr-active" id="grCalcScreen">
      <div class="gr-main">

        <div class="gr-active-bar" id="grActiveBar" style="display:none;">
          <div>
            <div class="gr-active-bar-label">Active Template</div>
            <div class="gr-active-bar-name" id="grActiveBarName">—</div>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="gr-btn-ghost" style="font-size:10px;" onclick="clearActiveTemplate();grLoadActiveTemplate();grRenderCalcFromTemplate()">Clear</button>
            <button class="gr-btn-ghost" style="font-size:10px;color:var(--accent2);border-color:rgba(144,144,208,0.3);" onclick="grUpdateActiveTemplate()">Update</button>
          </div>
        </div>

        <div class="gr-card">
          <div class="gr-card-label">Component Weights</div>
          <div class="gr-field-row" id="grMtWeightRow">
            <span class="gr-field-label">Midterm weight</span>
            <input class="gr-field-input" type="number" id="grMtPct" value="40" min="0" max="100" oninput="grCheckWeights();grCalc()">
            <span class="gr-field-unit">%</span>
          </div>
          <div class="gr-field-row" id="grFinalWeightRow">
            <span class="gr-field-label">Final exam weight</span>
            <input class="gr-field-input" type="number" id="grFinPct" value="60" min="0" max="100" oninput="grCheckWeights();grCalc()">
            <span class="gr-field-unit">%</span>
          </div>
          <div class="gr-field-row" id="grQuizWeightRow">
            <span class="gr-field-label">Quizzes weight</span>
            <input class="gr-field-input" type="number" id="grQuizPct" value="0" min="0" max="100" oninput="grCheckWeights();grCalc()">
            <span class="gr-field-unit">%</span>
          </div>
          <div class="gr-field-row" id="grLabWeightRow" style="display:none;">
            <span class="gr-field-label">Lab weight</span>
            <input class="gr-field-input" type="number" id="grLabPct" value="0" min="0" max="100" oninput="grCheckWeights();grCalc()">
            <span class="gr-field-unit">%</span>
          </div>
          <div class="gr-field-row" id="grBonusWeightRow">
            <span class="gr-field-label">Bonus quizzes weight</span>
            <input class="gr-field-input" type="number" id="grBonusPct" value="0" min="0" max="100" oninput="grCheckWeights();grCalc()">
            <span class="gr-field-unit">%</span>
          </div>
          <div id="grToggleBtns" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
            <button class="gr-btn-ghost" style="font-size:10px;" onclick="grToggleRow('grMtWeightRow','grMidtermCard')">± Midterm</button>
            <button class="gr-btn-ghost" style="font-size:10px;" onclick="grToggleRow('grFinalWeightRow','grFinalGradeRow')">± Final</button>
            <button class="gr-btn-ghost" style="font-size:10px;" onclick="grToggleRow('grQuizWeightRow','grQuizCard')">± Quizzes</button>
            <button class="gr-btn-ghost" style="font-size:10px;" onclick="grToggleRow('grLabWeightRow','grLabCard')">± Lab</button>
            <button class="gr-btn-ghost" style="font-size:10px;" onclick="grToggleRow('grBonusWeightRow','grBonusGradeRow')">± Bonus</button>
          </div>
          <div class="gr-weight-status" id="grWeightStatus"></div>
        </div>

        <div class="gr-card" id="grMidtermCard">
          <div class="gr-card-label-row">
            <div class="gr-card-label">Midterm Grades</div>
            <button class="gr-add-btn" id="grAddMidtermBtn" onclick="grAddMidterm()">+ add</button>
          </div>
          <div id="grMidtermList"></div>
        </div>

        <div class="gr-card" id="grQuizCard">
          <div class="gr-card-label-row">
            <div class="gr-card-label">Quiz Grades</div>
            <button class="gr-add-btn" id="grAddQuizBtn" onclick="grAddQuiz()">+ add</button>
          </div>
          <div id="grQuizList"></div>
        </div>

        <div class="gr-card" id="grLabCard">
          <div class="gr-card-label-row">
            <div class="gr-card-label">Lab Grades</div>
            <button class="gr-add-btn" id="grAddLabBtn" onclick="grAddLab()">+ add</button>
          </div>
          <div id="grLabList"></div>
        </div>

        <div class="gr-card">
          <div class="gr-card-label">Other Grades</div>
          <div class="gr-field-row" id="grFinalGradeRow">
            <span class="gr-field-label">Final exam</span>
            <input class="gr-field-input" type="number" id="grFinGrade" placeholder="—" min="0" max="100" oninput="grCalc()">
            <span class="gr-field-unit">/100</span>
          </div>
          <div class="gr-field-row" id="grBonusGradeRow">
            <span class="gr-field-label">Bonus quizzes (avg)</span>
            <input class="gr-field-input" type="number" id="grBonusGrade" placeholder="—" min="0" max="100" oninput="grCalc()">
            <span class="gr-field-unit">/100</span>
          </div>
          <div id="grExtraGradesContainer"></div>
          <button class="gr-add-btn" id="grAddExtraBtn" style="margin-top:8px;" onclick="grAddUserExtra()">+ add extra</button>
        </div>

        <div class="gr-result-card" id="grResultCard">
          <div class="gr-result-score" id="grResScore">—</div>
          <div class="gr-result-letter" id="grResLetter"></div>
          <div class="gr-result-divider"></div>
          <div id="grResBreakdown"></div>
          <div class="gr-result-divider" style="margin-top:12px;"></div>
          <button class="gr-btn-accent gr-btn-full" style="margin-top:12px;" onclick="grOpenSaveCourseModal()">Save to Course</button>
        </div>

      </div>
    </div>

    <!-- SCALE sub-screen -->
    <div class="gr-screen" id="grScaleScreen">
      <div class="gr-main">
        <div class="gr-card">
          <div class="gr-card-label-row">
            <div class="gr-card-label">Grade Scale Thresholds</div>
            <button class="gr-btn-ghost" style="font-size:10px;" onclick="grResetScaleUI()">Reset defaults</button>
          </div>
          <p style="font-size:11px;color:var(--muted);margin-bottom:16px;line-height:1.7;">
            Set the minimum score required for each letter grade.<br>
            FF has a fixed threshold of 0 and cannot be changed.
          </p>
          <div id="grScaleRows"></div>
        </div>

      </div>
    </div>

    <!-- TEMPLATES sub-screen -->
    <div class="gr-screen" id="grTemplatesScreen">
      <div class="gr-main">
        <div class="gr-card">
          <div class="gr-card-label">Saved Templates</div>
          <p style="font-size:11px;color:var(--muted);margin-bottom:14px;line-height:1.7;">
            Load a template to auto-fill weights and component structure.<br>
            Templates marked <span style="color:var(--muted);">preset</span> are built-in and cannot be deleted.
          </p>
          <div class="gr-section-heading">Built-in Presets</div>
          <div class="gr-tpl-list" id="grBuiltinList"></div>
          <div class="gr-section-heading" style="margin-top:20px;">Your Saved Templates</div>
          <div class="gr-tpl-list" id="grSavedList"></div>
          <div id="grNoSaved" style="font-size:11px;color:var(--muted);padding:8px 0;display:none;">No saved templates yet. Use "Save Template" on the Calc tab.</div>
        </div>
      </div>
    </div>
  `;

  // Inject modals and toast into body (outside gradeScreen to avoid overflow:hidden clipping)
  if (!document.getElementById('grSaveModal')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="grSaveModal">
        <div class="gr-modal">
          <h2>Save Template</h2>
          <p>Give this weight configuration a name so you can reload it anytime.</p>
          <input type="text" id="grSaveModalInput" placeholder="e.g. English — 2 MT 1 Final" maxlength="50"
                 onkeydown="if(event.key==='Enter') grConfirmSaveTemplate()"/>
          <div class="gr-modal-btns">
            <button class="gr-btn-ghost" onclick="grCloseSaveModal()">Cancel</button>
            <button class="gr-btn-accent" onclick="grConfirmSaveTemplate()">Save</button>
          </div>
        </div>
      </div>
      <div id="grDeleteModal">
        <div class="gr-modal">
          <h2>Delete Template</h2>
          <p id="grDeleteModalText">Are you sure?</p>
          <div class="gr-modal-btns">
            <button class="gr-btn-ghost" onclick="grCloseDeleteModal()">Cancel</button>
            <button class="gr-btn-danger" onclick="grConfirmDeleteTemplate()">Delete</button>
          </div>
        </div>
      </div>
      <div id="grRenameModal">
        <div class="gr-modal">
          <h2>Rename Template</h2>
          <p>Enter a new name for this template.</p>
          <input type="text" id="grRenameInput" placeholder="New name" maxlength="50"
                 onkeydown="if(event.key==='Enter') grConfirmRename()"/>
          <div class="gr-modal-btns">
            <button class="gr-btn-ghost" onclick="grCloseRenameModal()">Cancel</button>
            <button class="gr-btn-accent" onclick="grConfirmRename()">Rename</button>
          </div>
        </div>
      </div>
      <div id="grToast"></div>
      <div id="grSaveCourseModal">
        <div class="gr-modal">
          <h2>Save to Course</h2>
          <p id="grSaveCourseDesc">Choose a course from the current semester to apply this grade.</p>
          <div id="grCoursePickerList" style="display:flex;flex-direction:column;gap:6px;max-height:260px;overflow-y:auto;margin-bottom:14px;"></div>
          <div class="gr-modal-btns">
            <button class="gr-btn-ghost" onclick="grCloseSaveCourseModal()">Cancel</button>
          </div>
        </div>
      </div>
    `);
  }

  // Init
  LETTER_SCALE = grLoadScale();

  grRenderMidterms();
  grRenderQuizzes();
  grRenderLabs();
  grCheckWeights();
  grLoadActiveTemplate();
  if (getActiveTemplateId()) grRenderCalcFromTemplate();
  _grAttachSwipe();
}

// ── sub-screen nav ────────────────────────────────────────────
function grShowScreen(name) {
  document.getElementById('grCalcScreen').classList.toggle('gr-active', name === 'calc');
  document.getElementById('grTemplatesScreen').classList.toggle('gr-active', name === 'templates');
  document.getElementById('grScaleScreen').classList.toggle('gr-active', name === 'scale');
  document.getElementById('grNavCalc').classList.toggle('gr-active', name === 'calc');
  document.getElementById('grNavTemplates').classList.toggle('gr-active', name === 'templates');
  document.getElementById('grNavScale').classList.toggle('gr-active', name === 'scale');
  if (name === 'templates') grRenderTemplatesScreen();
  if (name === 'scale') grRenderScaleScreen();
  _grCurrentScreen = name;
}

// ── toast ─────────────────────────────────────────────────────
function grShowToast(msg) {
  const el = document.getElementById('grToast');
  if (!el) return;
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(_grToastTimer);
  _grToastTimer = setTimeout(() => { el.style.opacity = '0'; }, 2200);
}

// ── toggle rows ───────────────────────────────────────────────
function grToggleRow(weightRowId, targetId) {
  const wr = document.getElementById(weightRowId);
  const target = document.getElementById(targetId);
  const hidden = wr.style.display === 'none';
  wr.style.display = hidden ? '' : 'none';
  target.style.display = hidden ? '' : 'none';
  if (!hidden) {
    const inp = wr.querySelector('input');
    if (inp) inp.value = 0;
    if (targetId === 'grMidtermCard') { grMidterms = [null, null]; grRenderMidterms(); }
    else if (targetId === 'grQuizCard') { grQuizEntries = [null]; grRenderQuizzes(); }
    else if (targetId === 'grLabCard') { grLabEntries = [null]; grRenderLabs(); }
    else { const gi = target.querySelector('input'); if (gi) gi.value = ''; }
  }
  grCheckWeights(); grCalc();
}

// ── midterms ──────────────────────────────────────────────────
function grRenderMidterms() {
  const list = document.getElementById('grMidtermList');
  if (!list) return;
  list.innerHTML = '';
  grMidterms.forEach((val, i) => {
    const row = document.createElement('div');
    row.className = 'gr-mt-row';
    row.innerHTML =
      `<span class="gr-mt-label">Midterm ${i + 1}</span>
       <input class="gr-field-input" type="number" placeholder="—" min="0" max="100"
         value="${val !== null && val !== undefined ? val : ''}"
         oninput="grMidterms[${i}]=this.value===''?null:parseFloat(this.value);grCalc()">
       <span class="gr-field-unit">/100</span>
       ${!getActiveTemplateId() && grMidterms.length > 1
         ? `<button class="gr-remove-btn" onclick="grRemoveMidterm(${i})">×</button>`
         : '<span style="width:20px;"></span>'}`;
    list.appendChild(row);
  });
}

function grAddMidterm() { grMidterms.push(null); grRenderMidterms(); grCalc(); }
function grRemoveMidterm(i) { grMidterms.splice(i, 1); grRenderMidterms(); grCalc(); }

// ── quizzes ───────────────────────────────────────────────────
function grRenderQuizzes() {
  const list = document.getElementById('grQuizList');
  if (!list) return;
  list.innerHTML = '';
  grQuizEntries.forEach((val, i) => {
    const row = document.createElement('div');
    row.className = 'gr-mt-row';
    row.innerHTML =
      `<span class="gr-mt-label">Quiz ${i + 1}</span>
       <input class="gr-field-input" type="number" placeholder="—" min="0" max="100"
         value="${val !== null && val !== undefined ? val : ''}"
         oninput="grQuizEntries[${i}]=this.value===''?null:parseFloat(this.value);grCalc()">
       <span class="gr-field-unit">/100</span>
       ${!getActiveTemplateId() && grQuizEntries.length > 1
         ? `<button class="gr-remove-btn" onclick="grRemoveQuiz(${i})">×</button>`
         : '<span style="width:20px;"></span>'}`;
    list.appendChild(row);
  });
}

function grAddQuiz() { grQuizEntries.push(null); grRenderQuizzes(); grCalc(); }
function grRemoveQuiz(i) { grQuizEntries.splice(i, 1); grRenderQuizzes(); grCalc(); }

// ── labs ─────────────────────────────────────────────────────────────
function grRenderLabs() {
  const list = document.getElementById('grLabList');
  if (!list) return;
  list.innerHTML = '';
  grLabEntries.forEach((val, i) => {
    const row = document.createElement('div');
    row.className = 'gr-mt-row';
    row.innerHTML =
      `<span class="gr-mt-label">Lab ${i + 1}</span>
       <input class="gr-field-input" type="number" placeholder="—" min="0" max="100"
         value="${val !== null && val !== undefined ? val : ''}"
         oninput="grLabEntries[${i}]=this.value===''?null:parseFloat(this.value);grCalc()">
       <span class="gr-field-unit">/100</span>
       ${!getActiveTemplateId() && grLabEntries.length > 1
         ? `<button class="gr-remove-btn" onclick="grRemoveLab(${i})">×</button>`
         : '<span style="width:20px;"></span>'}`;
    list.appendChild(row);
  });
}

function grAddLab()      { grLabEntries.push(null); grRenderLabs(); grCalc(); }
function grRemoveLab(i)  { grLabEntries.splice(i, 1); grRenderLabs(); grCalc(); }

// ── weights check ─────────────────────────────────────────────
function grGv(id) {
  const v = parseFloat(document.getElementById(id)?.value);
  return isNaN(v) ? 0 : v;
}

function grCheckWeights() {
  let total = 0;
  if (document.getElementById('grMtWeightRow')?.style.display !== 'none') total += grGv('grMtPct');
  if (document.getElementById('grFinalWeightRow')?.style.display !== 'none') total += grGv('grFinPct');
  if (document.getElementById('grQuizWeightRow')?.style.display !== 'none') total += grGv('grQuizPct');
  if (document.getElementById('grLabWeightRow')?.style.display !== 'none') total += grGv('grLabPct');
  if (document.getElementById('grBonusWeightRow')?.style.display !== 'none') total += grGv('grBonusPct');
  total += grCurrentExtraDefs.reduce((s, ex) => s + (ex.weight || 0), 0);
  const el = document.getElementById('grWeightStatus');
  if (!el) return;
  el.className = 'gr-weight-status ok';
  el.textContent = `Weights sum to ${total}%`;
}

// ── compute & display ─────────────────────────────────────────
function grCalc() {
  const extraGrades = [];
  document.querySelectorAll('#grExtraGradesContainer .gr-extra-grade-input').forEach(inp => {
    extraGrades.push(inp.value === '' ? null : parseFloat(inp.value));
  });

  const validQ = grQuizEntries.filter(v => v !== null && v !== '');
  const quizzesAvg = validQ.length > 0 ? validQ.reduce((s, v) => s + parseFloat(v), 0) / validQ.length : null;

  const validL = grLabEntries.filter(v => v !== null && v !== '');
  const labAvg = validL.length > 0 ? validL.reduce((s, v) => s + parseFloat(v), 0) / validL.length : null;

  const weights = {
    midterm:      document.getElementById('grMtWeightRow')?.style.display !== 'none' ? grGv('grMtPct') : 0,
    final:        document.getElementById('grFinalWeightRow')?.style.display !== 'none' ? grGv('grFinPct') : 0,
    quizzes:      document.getElementById('grQuizWeightRow')?.style.display !== 'none' ? grGv('grQuizPct') : 0,
    lab:          document.getElementById('grLabWeightRow')?.style.display !== 'none' ? grGv('grLabPct') : 0,
    bonusQuizzes: document.getElementById('grBonusWeightRow')?.style.display !== 'none' ? grGv('grBonusPct') : 0,
  };

  const finVal = document.getElementById('grFinGrade')?.value;
  const bonVal = document.getElementById('grBonusGrade')?.value;

  const state = {
    weights,
    midterms: document.getElementById('grMidtermCard')?.style.display !== 'none' ? grMidterms : [],
    final:    document.getElementById('grFinalGradeRow')?.style.display !== 'none' ? (finVal === '' ? null : parseFloat(finVal)) : null,
    quizzes:  document.getElementById('grQuizCard')?.style.display !== 'none' ? quizzesAvg : null,
    lab:      document.getElementById('grLabCard')?.style.display !== 'none' ? labAvg : null,
    bonusQuiz:document.getElementById('grBonusGradeRow')?.style.display !== 'none' ? (bonVal === '' ? null : parseFloat(bonVal)) : null,
    extraGrades,
    extraWeights: grCurrentExtraDefs.map(ex => ex.weight),
    extraLabels:  grCurrentExtraDefs.map(ex => ex.label),
  };

  const hasAny = (state.midterms.length && state.midterms.some(v => v !== null)) ||
                 state.final !== null || state.quizzes !== null || state.lab !== null || state.bonusQuiz !== null ||
                 extraGrades.some(v => v !== null);

  const card = document.getElementById('grResultCard');
  if (!card) return;
  if (!hasAny) { card.style.display = 'none'; return; }

  const { score, letter, breakdown } = computeGrade(state);
  document.getElementById('grResScore').textContent  = score.toFixed(2);
  document.getElementById('grResLetter').textContent = `${letter.code} — ${letter.desc}`;
  document.getElementById('grResBreakdown').innerHTML = breakdown.map(b =>
    `<div class="gr-breakdown-row"><span>${b.label}</span><span class="bval">${b.contribution.toFixed(2)}</span></div>`
  ).join('');
  card.style.display = 'block';
}

// ── extra grades ──────────────────────────────────────────────

// grCurrentExtraDefs: [{ label, weight, grade }]
// fromTemplate=true locks labels/weights and hides add/remove buttons

function grRenderExtras(savedGrades, fromTemplate) {
  const container = document.getElementById('grExtraGradesContainer');
  if (!container) return;
  container.innerHTML = '';

  const addBtn = document.getElementById('grAddExtraBtn');
  if (addBtn) addBtn.style.display = fromTemplate ? 'none' : '';

  grCurrentExtraDefs.forEach((ex, idx) => {
    const row = document.createElement('div');
    row.className = 'gr-field-row gr-extra-grade-row';
    const savedVal = savedGrades && savedGrades[idx] !== undefined && savedGrades[idx] !== null
      ? savedGrades[idx] : (ex.grade !== undefined ? ex.grade : '');

    if (fromTemplate) {
      // Template extras: label+weight locked, no remove button
      row.innerHTML =
        `<span class="gr-field-label">${grEscHtml(ex.label)} <span style="color:var(--muted);font-size:10px;">(${ex.weight}%)</span></span>
         <input class="gr-field-input gr-extra-grade-input" type="number" placeholder="—" min="0" max="100"
           value="${savedVal}" oninput="grCalc()">
         <span class="gr-field-unit">/100</span>`;
    } else {
      // User-added extras: editable name+weight, removable
      row.innerHTML =
        `<span class="gr-field-label" style="display:flex;flex-direction:column;gap:3px;flex:1;">
           <input class="gr-inline-input gr-extra-label-input" type="text" placeholder="Name" maxlength="24"
             value="${grEscHtml(ex.label)}"
             oninput="grCurrentExtraDefs[${idx}].label=this.value;grCheckWeights();">
           <span style="display:flex;align-items:center;gap:4px;">
             <input class="gr-inline-input gr-extra-weight-input" type="number" placeholder="0" min="0" max="100"
               value="${ex.weight || ''}"
               style="width:42px;"
               oninput="grCurrentExtraDefs[${idx}].weight=parseFloat(this.value)||0;grCheckWeights();grCalc();">
             <span style="font-size:10px;color:var(--muted);">%</span>
           </span>
         </span>
         <input class="gr-field-input gr-extra-grade-input" type="number" placeholder="—" min="0" max="100"
           value="${savedVal}" oninput="grCurrentExtraDefs[${idx}].grade=this.value===''?null:parseFloat(this.value);grCalc()">
         <span class="gr-field-unit">/100</span>
         <button class="gr-remove-btn" onclick="grRemoveExtra(${idx})">×</button>`;
    }
    container.appendChild(row);
  });

  grCheckWeights();
}

function grRenderExtraGradesFromTemplate(tpl) {
  grCurrentExtraDefs = (tpl.extras || []).map(ex => ({ ...ex }));
  const savedGrades = (tpl.grades && tpl.grades.extraGrades) || [];
  grRenderExtras(savedGrades, true);
}

function grClearExtraGrades() {
  const c = document.getElementById('grExtraGradesContainer');
  if (c) c.innerHTML = '';
  grCurrentExtraDefs = [];
  const addBtn = document.getElementById('grAddExtraBtn');
  if (addBtn) addBtn.style.display = '';
}

function grAddUserExtra() {
  grCurrentExtraDefs.push({ label: '', weight: 0, grade: null });
  grRenderExtras(null, false);
}

function grRemoveExtra(i) {
  grCurrentExtraDefs.splice(i, 1);
  grRenderExtras(null, false);
  grCalc();
}

// ── active template bar ───────────────────────────────────────
function grLoadActiveTemplate() {
  const id  = getActiveTemplateId();
  const bar = document.getElementById('grActiveBar');
  const toggleBtns = document.getElementById('grToggleBtns');
  const addMtBtn   = document.getElementById('grAddMidtermBtn');
  const addQBtn    = document.getElementById('grAddQuizBtn');
  if (!bar) return;
  if (!id) {
    bar.style.display = 'none';
    if (toggleBtns) toggleBtns.style.display = '';
    if (addMtBtn)   addMtBtn.style.display = '';
    if (addQBtn)    addQBtn.style.display = '';
    grClearExtraGrades();
    document.getElementById('grMtWeightRow').style.display    = '';
    document.getElementById('grFinalWeightRow').style.display = '';
    document.getElementById('grQuizWeightRow').style.display  = '';
    document.getElementById('grBonusWeightRow').style.display = '';
    document.getElementById('grMidtermCard').style.display    = '';
    document.getElementById('grFinalGradeRow').style.display  = '';
    document.getElementById('grQuizCard').style.display       = '';
    document.getElementById('grLabWeightRow').style.display   = 'none';
    document.getElementById('grLabCard').style.display        = 'none';
    document.getElementById('grBonusGradeRow').style.display  = '';
    grCheckWeights(); grCalc(); return;
  }
  const tpl = getTemplateById(id);
  if (!tpl) { bar.style.display = 'none'; grClearExtraGrades(); grCheckWeights(); grCalc(); return; }
  bar.style.display = '';
  if (toggleBtns) toggleBtns.style.display = 'none';
  if (addMtBtn)   addMtBtn.style.display = 'none';
  if (addQBtn)    addQBtn.style.display = 'none';
  document.getElementById('grActiveBarName').textContent = tpl.name;
  grRenderExtraGradesFromTemplate(tpl);
  grCheckWeights(); grCalc();
}

function grRenderCalcFromTemplate() {
  const id = getActiveTemplateId();
  if (!id) return;
  const tpl = getTemplateById(id);
  if (!tpl) return;

  grRenderExtraGradesFromTemplate(tpl);

  const hasMidterm = tpl.hasMidterm !== false;
  const hasFinal   = tpl.hasFinal !== false;
  const hasQuizzes = tpl.hasQuizzes || false;
  const hasLab     = tpl.hasLab || false;
  const hasBonus   = tpl.hasBonusQuiz || false;

  document.getElementById('grMtWeightRow').style.display    = hasMidterm ? '' : 'none';
  document.getElementById('grFinalWeightRow').style.display = hasFinal   ? '' : 'none';
  document.getElementById('grQuizWeightRow').style.display  = hasQuizzes ? '' : 'none';
  document.getElementById('grLabWeightRow').style.display   = hasLab     ? '' : 'none';
  document.getElementById('grBonusWeightRow').style.display = hasBonus   ? '' : 'none';
  document.getElementById('grMidtermCard').style.display    = hasMidterm ? '' : 'none';
  document.getElementById('grFinalGradeRow').style.display  = hasFinal   ? '' : 'none';
  document.getElementById('grQuizCard').style.display       = hasQuizzes ? '' : 'none';
  document.getElementById('grLabCard').style.display        = hasLab     ? '' : 'none';
  document.getElementById('grBonusGradeRow').style.display  = hasBonus   ? '' : 'none';

  document.getElementById('grMtPct').value    = tpl.weights.midterm || 0;
  document.getElementById('grFinPct').value   = tpl.weights.final || 0;
  document.getElementById('grQuizPct').value  = tpl.weights.quizzes || 0;
  document.getElementById('grLabPct').value   = tpl.weights.lab || 0;
  document.getElementById('grBonusPct').value = tpl.weights.bonusQuizzes || 0;

  grMidterms = hasMidterm ? Array(tpl.midtermCount || 1).fill(null) : [];

  if (hasQuizzes) {
    const sq = tpl.grades && tpl.grades.quizEntries;
    grQuizEntries = (sq && sq.length) ? sq.map(v => v !== undefined ? v : null) : [null];
  } else {
    grQuizEntries = [null];
  }

  if (hasLab) {
    const sl = tpl.grades && tpl.grades.labEntries;
    grLabEntries = (sl && sl.length) ? sl.map(v => v !== undefined ? v : null) : [null];
  } else {
    grLabEntries = [null];
  }

  if (tpl.grades) {
    if (hasMidterm && tpl.grades.midterms) grMidterms = tpl.grades.midterms.map(v => v !== undefined ? v : null);
    if (hasFinal)  document.getElementById('grFinGrade').value   = tpl.grades.final     ?? '';
    if (hasBonus)  document.getElementById('grBonusGrade').value = tpl.grades.bonusQuiz ?? '';
  } else {
    document.getElementById('grFinGrade').value   = '';
    document.getElementById('grBonusGrade').value = '';
  }

  grRenderMidterms();
  grRenderQuizzes();
  grRenderLabs();
  grCheckWeights();
  grCalc();
  grLoadActiveTemplate();
}

function grUpdateActiveTemplate() {
  const id = getActiveTemplateId();
  if (!id || id.startsWith('__builtin')) { grShowToast('Built-in templates cannot be updated'); return; }
  const extraGrades = [];
  document.querySelectorAll('#grExtraGradesContainer .gr-extra-grade-input').forEach(inp => {
    extraGrades.push(inp.value === '' ? null : parseFloat(inp.value));
  });
  const grades = {
    midterms:    [...grMidterms],
    final:       document.getElementById('grFinGrade').value   === '' ? null : parseFloat(document.getElementById('grFinGrade').value),
    quizEntries: [...grQuizEntries],
    bonusQuiz:   document.getElementById('grBonusGrade').value === '' ? null : parseFloat(document.getElementById('grBonusGrade').value),
    extraGrades,
  };
  const weights = { midterm: grGv('grMtPct'), final: grGv('grFinPct'), quizzes: grGv('grQuizPct'), lab: grGv('grLabPct'), bonusQuizzes: grGv('grBonusPct') };
  updateTemplate(id, {
    weights,
    midtermCount: grMidterms.length,
    hasMidterm:   document.getElementById('grMidtermCard').style.display !== 'none',
    hasFinal:     document.getElementById('grFinalGradeRow').style.display !== 'none',
    hasQuizzes:   document.getElementById('grQuizCard').style.display !== 'none',
    hasLab:       document.getElementById('grLabCard').style.display !== 'none',
    hasBonusQuiz: document.getElementById('grBonusWeightRow').style.display !== 'none',
    grades,
    extras: grCurrentExtraDefs,
  });
  grShowToast('Template updated ✓');
}

// ── save modal ────────────────────────────────────────────────
function grOpenSaveModal() {
  document.getElementById('grSaveModalInput').value = '';
  document.getElementById('grSaveModal').classList.add('open');
  setTimeout(() => document.getElementById('grSaveModalInput').focus(), 80);
}
function grCloseSaveModal() { document.getElementById('grSaveModal').classList.remove('open'); }

function grConfirmSaveTemplate() {
  const name = document.getElementById('grSaveModalInput').value.trim();
  if (!name) { document.getElementById('grSaveModalInput').focus(); return; }
  const extraGrades = [];
  document.querySelectorAll('#grExtraGradesContainer .gr-extra-grade-input').forEach(inp => {
    extraGrades.push(inp.value === '' ? null : parseFloat(inp.value));
  });
  const tpl = saveTemplate({
    name,
    weights:      { midterm: grGv('grMtPct'), final: grGv('grFinPct'), quizzes: grGv('grQuizPct'), lab: grGv('grLabPct'), bonusQuizzes: grGv('grBonusPct') },
    midtermCount: grMidterms.length,
    hasMidterm:   document.getElementById('grMidtermCard').style.display !== 'none',
    hasFinal:     document.getElementById('grFinalGradeRow').style.display !== 'none',
    hasQuizzes:   document.getElementById('grQuizCard').style.display !== 'none',
    hasLab:       document.getElementById('grLabCard').style.display !== 'none',
    hasBonusQuiz: document.getElementById('grBonusWeightRow').style.display !== 'none',
    grades: {
      midterms:    [...grMidterms],
      final:       document.getElementById('grFinGrade').value   === '' ? null : parseFloat(document.getElementById('grFinGrade').value),
      quizEntries: [...grQuizEntries],
      labEntries:  [...grLabEntries],
      bonusQuiz:   document.getElementById('grBonusGrade').value === '' ? null : parseFloat(document.getElementById('grBonusGrade').value),
      extraGrades,
    },
    extras: grCurrentExtraDefs,
  });
  setActiveTemplateId(tpl.id);
  grLoadActiveTemplate();
  grCloseSaveModal();
  grShowToast('Template saved ✓');
}

// ── templates screen ──────────────────────────────────────────
function grRenderTemplatesScreen() {
  const activeId = getActiveTemplateId();

  const bl = document.getElementById('grBuiltinList');
  if (!bl) return;
  bl.innerHTML = '';
  getBuiltinTemplates().forEach(tpl => {
    const isActive = tpl.id === activeId;
    const item = document.createElement('div');
    item.className = 'gr-tpl-item' + (isActive ? ' gr-active-tpl' : '');
    item.innerHTML =
      `<div class="gr-tpl-item-info">
         <div class="gr-tpl-item-name">${grEscHtml(tpl.name)}</div>
         <div class="gr-tpl-item-meta">${tpl.hasMidterm !== false ? `MT×${tpl.weights.midterm}%` : 'No MT'} · ${tpl.hasFinal !== false ? `Final×${tpl.weights.final}%` : 'No Final'}${tpl.hasQuizzes ? ' · Quiz×'+tpl.weights.quizzes+'%' : ''}${tpl.hasBonusQuiz ? ' · Bonus×'+tpl.weights.bonusQuizzes+'%' : ''} · ${tpl.midtermCount} midterm(s)${tpl.extras && tpl.extras.length ? ' · extras' : ''}</div>
       </div>
       <span class="gr-tpl-item-badge builtin">preset</span>`;
    item.onclick = () => { grLoadTemplate(tpl.id); };
    bl.appendChild(item);
  });

  const sl = document.getElementById('grSavedList');
  const noSaved = document.getElementById('grNoSaved');
  const saved = getSavedTemplates();
  sl.innerHTML = '';
  noSaved.style.display = saved.length === 0 ? '' : 'none';
  saved.forEach(tpl => {
    const isActive = tpl.id === activeId;
    const item = document.createElement('div');
    item.className = 'gr-tpl-item' + (isActive ? ' gr-active-tpl' : '');
    item.innerHTML =
      `<div class="gr-tpl-item-info" style="cursor:pointer;">
         <div class="gr-tpl-item-name">${grEscHtml(tpl.name)}</div>
         <div class="gr-tpl-item-meta">${tpl.hasMidterm !== false ? `MT×${tpl.weights.midterm}%` : 'No MT'} · ${tpl.hasFinal !== false ? `Final×${tpl.weights.final}%` : 'No Final'}${tpl.hasQuizzes ? ' · Quiz×'+tpl.weights.quizzes+'%' : ''}${tpl.hasBonusQuiz ? ' · Bonus×'+tpl.weights.bonusQuizzes+'%' : ''} · ${tpl.midtermCount} midterm(s)${tpl.extras && tpl.extras.length ? ' · extras' : ''}</div>
       </div>
       <div class="gr-tpl-actions">
         <button class="gr-btn-ghost" style="font-size:10px;" onclick="event.stopPropagation();grOpenRenameModal('${tpl.id}')">Rename</button>
         <button class="gr-btn-danger" style="font-size:10px;" onclick="event.stopPropagation();grOpenDeleteModal('${tpl.id}','${grEscHtml(tpl.name)}')">Del</button>
       </div>`;
    item.querySelector('.gr-tpl-item-info').onclick = () => { grLoadTemplate(tpl.id); };
    sl.appendChild(item);
  });
}

function grLoadTemplate(id) {
  setActiveTemplateId(id);
  grRenderCalcFromTemplate();
  grShowScreen('calc');
  grShowToast('Template loaded ✓');
}

function grEscHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── delete modal ──────────────────────────────────────────────
function grOpenDeleteModal(id, name) {
  _grDeleteTargetId = id;
  document.getElementById('grDeleteModalText').textContent = `Delete "${name}"? This cannot be undone.`;
  document.getElementById('grDeleteModal').classList.add('open');
}
function grCloseDeleteModal() { document.getElementById('grDeleteModal').classList.remove('open'); }
function grConfirmDeleteTemplate() {
  if (!_grDeleteTargetId) return;
  deleteTemplate(_grDeleteTargetId);
  _grDeleteTargetId = null;
  grCloseDeleteModal();
  grRenderTemplatesScreen();
  grLoadActiveTemplate();
  grShowToast('Template deleted');
}

// ── rename modal ──────────────────────────────────────────────
function grOpenRenameModal(id) {
  _grRenameTargetId = id;
  const tpl = getTemplateById(id);
  document.getElementById('grRenameInput').value = tpl ? tpl.name : '';
  document.getElementById('grRenameModal').classList.add('open');
  setTimeout(() => document.getElementById('grRenameInput').focus(), 80);
}
function grCloseRenameModal() { document.getElementById('grRenameModal').classList.remove('open'); }
function grConfirmRename() {
  const name = document.getElementById('grRenameInput').value.trim();
  if (!name || !_grRenameTargetId) return;
  updateTemplate(_grRenameTargetId, { name });
  _grRenameTargetId = null;
  grCloseRenameModal();
  grRenderTemplatesScreen();
  grLoadActiveTemplate();
  grShowToast('Renamed ✓');
}

// ── scale screen ──────────────────────────────────────────────

function grRenderScaleScreen() {
  const container = document.getElementById('grScaleRows');
  if (!container) return;
  container.innerHTML = '';

  // All rows except FF (last), which is always 0
  LETTER_SCALE.slice(0, -1).forEach((entry, i) => {
    const [min, code, desc] = entry;
    const row = document.createElement('div');
    row.className = 'gr-field-row';
    row.innerHTML =
      `<span class="gr-field-label" style="display:flex;align-items:center;gap:8px;">
         <span style="color:var(--accent);font-weight:500;width:24px;">${code}</span>
         <span style="color:var(--muted);font-size:11px;">${desc}</span>
       </span>
       <input class="gr-field-input" type="number" min="1" max="100"
         value="${min}"
         data-index="${i}"
         oninput="grScaleInputChanged(this)">
       <span class="gr-field-unit">pts</span>`;
    container.appendChild(row);
  });

  // FF row — locked at 0
  const ffRow = document.createElement('div');
  ffRow.className = 'gr-field-row';
  ffRow.innerHTML =
    `<span class="gr-field-label" style="display:flex;align-items:center;gap:8px;">
       <span style="color:var(--danger);font-weight:500;width:24px;">FF</span>
       <span style="color:var(--muted);font-size:11px;">Fail</span>
     </span>
     <input class="gr-field-input" type="number" value="0" disabled
       style="opacity:0.35;cursor:not-allowed;">
     <span class="gr-field-unit">pts</span>`;
  container.appendChild(ffRow);

}

function grScaleInputChanged(input) {
  const i   = parseInt(input.dataset.index);
  const val = parseInt(input.value);
  if (isNaN(val) || val < 0 || val > 100) return;

  LETTER_SCALE[i][0] = val;

  // Enforce descending order: nudge neighbours to stay consistent
  for (let j = i - 1; j >= 0; j--) {
    if (LETTER_SCALE[j][0] <= LETTER_SCALE[j + 1][0]) {
      LETTER_SCALE[j][0] = LETTER_SCALE[j + 1][0] + 1;
    }
  }
  for (let j = i + 1; j < LETTER_SCALE.length - 1; j++) {
    if (LETTER_SCALE[j][0] >= LETTER_SCALE[j - 1][0]) {
      LETTER_SCALE[j][0] = LETTER_SCALE[j - 1][0] - 1;
    }
  }

  grSaveScale(LETTER_SCALE);

  // Refresh inputs to show nudged values
  const inputs = document.querySelectorAll('#grScaleRows input[data-index]');
  inputs.forEach(inp => {
    const idx = parseInt(inp.dataset.index);
    inp.value = LETTER_SCALE[idx][0];
  });

  grCalc(); // re-run result with new scale
}


function grResetScaleUI() {
  LETTER_SCALE = grResetScale();
  grRenderScaleScreen();
  grCalc();
  grShowToast('Scale reset to defaults ✓');
}

// ── save to course ────────────────────────────────────────────

function grOpenSaveCourseModal() {
  const resultCard = document.getElementById('grResultCard');
  if (!resultCard || resultCard.style.display === 'none') {
    grShowToast('Calculate a grade first'); return;
  }

  if (!activeProfileId) {
    grShowToast('No active profile — set one in Calc tab first'); return;
  }

  // Get the letter grade currently shown
  const letterText = document.getElementById('grResLetter').textContent; // e.g. "AA — Excellent"
  const letterCode = letterText.split('—')[0].trim();

  const key    = activeKey;   // e.g. "Year 1|Fall"
  const dept   = activeDept;  // e.g. "CNGB"
  const dataKey = dept + '|' + key;

  const presets   = getCoursePresets();    // { "Year 1|Fall": [[name,cr],...], ... }
  const electives = getElectivePresets();  // { "Year 1|Fall": [name,...], ... }

  // loadCourses sorts presets by credits descending before rendering/saving
  const sortedPreset = [...(presets[key] || [])].sort((a, b) => b[1] - a[1]);
  const electList    = electives[key] || [];

  // Saved semData for this semester (indexed by sorted position)
  const saved = (semData && semData[dataKey]) || [];

  // Build course list with correct semData index for each course
  const courseList = [];

  sortedPreset.forEach(([name, credits], i) => {
    if (credits === 0) return; // skip zero-credit
    courseList.push({ name, credits, semIndex: i });
  });

  electList.forEach((name, j) => {
    const idx     = sortedPreset.length + j;
    const credits = saved[idx]?.credits || 3;
    courseList.push({ name, credits, semIndex: idx });
  });

  const list = document.getElementById('grCoursePickerList');
  list.innerHTML = '';

  if (!courseList.length) {
    list.innerHTML = '<div style="font-size:11px;color:var(--muted);padding:8px 0;">No courses found. Make sure a profile and semester are active in the Calc tab.</div>';
  } else {
    document.getElementById('grSaveCourseDesc').textContent =
      `Applying grade ${letterCode} · ${key.replace('|', ' ')}. Pick a course:`;

    courseList.forEach(course => {
      const btn = document.createElement('button');
      btn.className = 'gr-course-pick-btn';
      btn.innerHTML =
        `<span class="gr-cpb-name">${grEscHtml(course.name)}</span>
         <span class="gr-cpb-cr">${course.credits} cr</span>`;
      btn.onclick = () => grConfirmSaveToCourse(course, letterCode, dataKey, sortedPreset.length);
      list.appendChild(btn);
    });
  }

  document.getElementById('grSaveCourseModal').classList.add('open');
}

function grCloseSaveCourseModal() {
  document.getElementById('grSaveCourseModal').classList.remove('open');
}

function grConfirmSaveToCourse(course, gradeCode, dataKey, presetCount) {
  grCloseSaveCourseModal();

  if (typeof semData === 'undefined') {
    grShowToast('No active profile/semester'); return;
  }

  // Ensure the semData array exists and is long enough
  if (!semData[dataKey]) semData[dataKey] = [];
  const courses = semData[dataKey];

  // Pad array up to the required index if needed
  while (courses.length <= course.semIndex) {
    courses.push({ grade: '', credits: 3, elective: false });
  }

  // Write the grade into the correct slot
  courses[course.semIndex].grade   = gradeCode;
  courses[course.semIndex].credits = course.credits;
  if (course.semIndex >= presetCount) courses[course.semIndex].elective = true;

  // Recompute semester GPA from all filled slots and save to semHistory
  const gp = typeof GRADE_POINTS !== 'undefined' ? GRADE_POINTS : {};
  let pts = 0, cr = 0;
  courses.forEach(c => {
    if (c.grade && gp[c.grade] !== undefined && c.credits > 0 && c.grade !== 'SKIP') {
      pts += gp[c.grade] * c.credits;
      cr  += c.credits;
    }
  });

  if (cr > 0) {
    semHistory[activeKey] = { gpa: pts / cr, credits: cr };
  }

  // Persist and fully refresh the GPA calc UI
  persistToProfile();
  loadCourses();
  updateHistoryStrip();
  updateCumulative();

  grShowToast(`${gradeCode} saved to ${course.name.split('·')[0].trim()} ✓`);
}

// ── swipe between sub-tabs ────────────────────────────────────
(function(){
  const GR_TABS = ['calc', 'templates', 'scale'];
  let tx0 = 0, ty0 = 0, swiping = false;

  function grCurrentTabIdx() {
    return GR_TABS.indexOf(_grCurrentScreen);
  }

  function grSwipeTo(idx) {
    if (idx < 0 || idx >= GR_TABS.length) return;
    grShowScreen(GR_TABS[idx]);
  }

  document.addEventListener('DOMContentLoaded', function() {
    // area may not exist yet — attach after initGradeScreen builds it
  });

  // Called after initGradeScreen injects the DOM
  window._grAttachSwipe = function() {
    const area = document.getElementById('gradeScreenScroll');
    if (!area || area._grSwipeAttached) return;
    area._grSwipeAttached = true;

    area.addEventListener('touchstart', e => {
      tx0 = e.touches[0].clientX;
      ty0 = e.touches[0].clientY;
      swiping = true;
    }, { passive: true });

    area.addEventListener('touchmove', e => {
      if (!swiping) return;
      if (Math.abs(e.touches[0].clientX - tx0) > Math.abs(e.touches[0].clientY - ty0) * 1.5
          && Math.abs(e.touches[0].clientX - tx0) > 30) e.preventDefault();
    }, { passive: false });

    area.addEventListener('touchend', e => {
      if (!swiping) return; swiping = false;
      const dx = e.changedTouches[0].clientX - tx0;
      const dy = e.changedTouches[0].clientY - ty0;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        grSwipeTo(dx < 0 ? grCurrentTabIdx() + 1 : grCurrentTabIdx() - 1);
      }
    }, { passive: true });
  };
})();