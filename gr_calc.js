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

  // Lab carves out its own share; all other components scale down by (100 - labW) / 100
  const labW  = w.lab;
  const scale = labW > 0 ? (100 - labW) / 100 : 1;

  let score = 0;
  const breakdown = [];

  const validMts = midterms.filter(v => v !== null && v !== '');
  if (validMts.length > 0 && w.midterm > 0) {
    const avg   = validMts.reduce((s, v) => s + parseFloat(v), 0) / validMts.length;
    const effW  = w.midterm * scale;
    const contrib = avg * effW / 100;
    score += contrib;
    breakdown.push({ label: `Midterm avg (${avg.toFixed(1)}) × ${effW.toFixed(1)}%`, contribution: contrib });
  }

  if (final !== null && final !== '' && w.final > 0) {
    const effW  = w.final * scale;
    const contrib = parseFloat(final) * effW / 100;
    score += contrib;
    breakdown.push({ label: `Final × ${effW.toFixed(1)}%`, contribution: contrib });
  }

  if (quizzes !== null && quizzes !== '' && w.quizzes > 0) {
    const effW  = w.quizzes * scale;
    const contrib = parseFloat(quizzes) * effW / 100;
    score += contrib;
    breakdown.push({ label: `Quizzes × ${effW.toFixed(1)}%`, contribution: contrib });
  }

  if (lab !== null && lab !== '' && w.lab > 0) {
    const contrib = parseFloat(lab) * w.lab / 100;
    score += contrib;
    breakdown.push({ label: `Lab avg (${parseFloat(lab).toFixed(1)}) × ${w.lab}%`, contribution: contrib });
  }

  if (bonusQuiz !== null && bonusQuiz !== '' && w.bonusQuizzes > 0) {
    const effW  = w.bonusQuizzes * scale;
    const contrib = parseFloat(bonusQuiz) * effW / 100;
    score += contrib;
    breakdown.push({ label: `Bonus quizzes × ${effW.toFixed(1)}%`, contribution: contrib });
  }

  extraGrades.forEach((grade, i) => {
    const wt    = parseFloat(extraWeights[i]) || 0;
    const label = extraLabels[i] || `Extra ${i + 1}`;
    if (grade !== null && grade !== '' && wt > 0) {
      const contrib = parseFloat(grade);
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
            <span class="gr-field-unit" id="grFinWeightDisplay">%</span>
          </div>
          <div class="gr-field-row" id="grBonusGradeRow">
            <span class="gr-field-label">Bonus quizzes (avg)</span>
            <input class="gr-field-input" type="number" id="grBonusGrade" placeholder="—" min="0" max="100" oninput="grCalc()">
            <span class="gr-field-unit" id="grBonusWeightDisplay">%</span>
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
  grUpdateWeightLabels();

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
  const labW  = document.getElementById('grLabWeightRow')?.style.display !== 'none' ? grGv('grLabPct') : 0;
  const scale = labW > 0 ? (100 - labW) / 100 : 1;

  let total = 0;
  if (document.getElementById('grMtWeightRow')?.style.display !== 'none') total += grGv('grMtPct') * scale;
  if (document.getElementById('grFinalWeightRow')?.style.display !== 'none') total += grGv('grFinPct') * scale;
  if (document.getElementById('grQuizWeightRow')?.style.display !== 'none') total += grGv('grQuizPct') * scale;
  if (document.getElementById('grLabWeightRow')?.style.display !== 'none') total += labW;
  if (document.getElementById('grBonusWeightRow')?.style.display !== 'none') total += grGv('grBonusPct') * scale;
  total += grCurrentExtraDefs.reduce((s, ex) => s + (ex.weight || 0), 0);

  const el = document.getElementById('grWeightStatus');
  if (!el) return;
  el.className = 'gr-weight-status ok';
  el.textContent = `Weights sum to ${total.toFixed(1)}%`;

  grUpdateWeightLabels();
}

// ── update weight labels for Final and Bonus rows ─────────────
function grUpdateWeightLabels() {
  const finEl = document.getElementById('grFinWeightDisplay');
  const bonEl = document.getElementById('grBonusWeightDisplay');

  const labW  = document.getElementById('grLabWeightRow')?.style.display !== 'none' ? grGv('grLabPct') : 0;
  const scale = labW > 0 ? (100 - labW) / 100 : 1;

  if (finEl) {
    const w = parseFloat(document.getElementById('grFinPct').value) || 0;
    finEl.textContent = labW > 0 ? `${w}% → ${(w * scale).toFixed(1)}%` : w + '%';
  }
  if (bonEl) {
    const w = parseFloat(document.getElementById('grBonusPct').value) || 0;
    bonEl.textContent = labW > 0 ? `${w}% → ${(w * scale).toFixed(1)}%` : w + '%';
  }

  // Annotate the weight input units in the weights card
  const annotations = [
    ['grMtWeightRow',    'grMtPct',   'grMtWeightUnit'],
    ['grFinalWeightRow', 'grFinPct',  'grFinWeightUnit'],
    ['grQuizWeightRow',  'grQuizPct', 'grQuizWeightUnit'],
    ['grBonusWeightRow', 'grBonusPct','grBonusWeightUnit'],
  ];

  annotations.forEach(([rowId, inputId, unitId]) => {
    const row = document.getElementById(rowId);
    if (!row || row.style.display === 'none') return;
    let unit = row.querySelector('.gr-field-unit');
    if (!unit) return;
    unit.id = unitId;
    const w = parseFloat(document.getElementById(inputId)?.value) || 0;
    unit.textContent = labW > 0 ? `% → ${(w * scale).toFixed(1)}%` : '%';
  });
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
      // Template extras: label+weight locked, unit shows "X pts" and max = weight
      const maxPts = ex.weight || 100;
      row.innerHTML =
        `<span class="gr-field-label">${grEscHtml(ex.label)} <span style="color:var(--muted);font-size:10px;">(${ex.weight}%)</span></span>
         <input class="gr-field-input gr-extra-grade-input" type="number" placeholder="—" min="0" max="${maxPts}"
           value="${savedVal}" oninput="grCalc()">
         <span class="gr-field-unit">${maxPts} pts</span>`;
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

// ── 1. Patch grCalc to also refresh the needed panel ─────────
(function () {
  const _orig = window.grCalc;
  window.grCalc = function () {
    _orig.apply(this, arguments);
    grNeededCalc();
  };
})();

// ── 2. Inject panel HTML right after initGradeScreen fires ───
(function () {
  const _origInit = window.initGradeScreen;
  window.initGradeScreen = function () {
    _origInit.apply(this, arguments);
    _grInjectNeededPanel();
  };
})();

function _grInjectNeededPanel() {
  if (document.getElementById('grNeededPanel')) return;
  const resultCard = document.getElementById('grResultCard');
  if (!resultCard) return;

  const panel = document.createElement('div');
  panel.id        = 'grNeededPanel';
  panel.className = 'gr-card gr-needed-panel';
  panel.style.display = 'none';   // hidden until there is something to show
  panel.innerHTML = `
    <div class="gr-card-label-row">
      <div class="gr-card-label">What do I need?</div>
      <button class="gr-btn-ghost gr-needed-collapse-btn"
              style="font-size:10px;" onclick="grNeededToggle()">Hide</button>
    </div>

    <!-- target selector -->
    <div class="gr-needed-target-row">
      <span class="gr-field-label" style="font-size:12px;">Target grade</span>
      <div class="gr-needed-pills" id="grNeededPills"></div>
    </div>

    <!-- result area -->
    <div id="grNeededResult"></div>
  `;

  resultCard.insertAdjacentElement('afterend', panel);

  // Build the pill buttons from the current scale
  grNeededBuildPills();
}

// ── 3. Build pill buttons from LETTER_SCALE ───────────────────
function grNeededBuildPills() {
  const container = document.getElementById('grNeededPills');
  if (!container) return;
  container.innerHTML = '';

  // Each entry in LETTER_SCALE: [minScore, code, desc]
  // Offer every grade except FF (last row) as a target
  const targets = LETTER_SCALE.slice(0, -1).map(([min, code]) => ({ min, code }));

  targets.forEach(({ min, code }) => {
    const btn = document.createElement('button');
    btn.className    = 'gr-needed-pill';
    btn.textContent  = code;
    btn.dataset.min  = min;
    btn.dataset.code = code;
    btn.title        = `Need ≥ ${min} pts`;
    btn.onclick      = () => {
      document.querySelectorAll('.gr-needed-pill').forEach(b => b.classList.remove('gr-needed-pill-active'));
      btn.classList.add('gr-needed-pill-active');
      grNeededCalc();
    };
    container.appendChild(btn);
  });

  // Select DD (≥60) by default — the minimum passing grade
  const ddBtn = [...container.querySelectorAll('.gr-needed-pill')]
    .find(b => b.dataset.code === 'DD');
  if (ddBtn) ddBtn.classList.add('gr-needed-pill-active');
}

// ── 4. Main calculation ───────────────────────────────────────
function grNeededCalc() {
  const panel = document.getElementById('grNeededPanel');
  const out   = document.getElementById('grNeededResult');
  if (!panel || !out) return;

  const labVisible   = document.getElementById('grLabWeightRow')?.style.display  !== 'none';
  const mtVisible    = document.getElementById('grMtWeightRow')?.style.display   !== 'none';
  const finVisible   = document.getElementById('grFinalWeightRow')?.style.display !== 'none';
  const quizVisible  = document.getElementById('grQuizWeightRow')?.style.display  !== 'none';
  const bonusVisible = document.getElementById('grBonusWeightRow')?.style.display !== 'none';

  const labW    = labVisible   ? grGv('grLabPct')   : 0;
  const scale   = labW > 0 ? (100 - labW) / 100 : 1;
  const mtW     = (mtVisible   ? grGv('grMtPct')    : 0) * scale;
  const finW    = (finVisible  ? grGv('grFinPct')   : 0) * scale;
  const quizW   = (quizVisible ? grGv('grQuizPct')  : 0) * scale;
  const bonusW  = (bonusVisible? grGv('grBonusPct') : 0) * scale;

  // ── what has already been entered? ────────────────────────
  const validMts = grMidterms.filter(v => v !== null && v !== '');
  const mtAvg    = validMts.length > 0
    ? validMts.reduce((s, v) => s + parseFloat(v), 0) / validMts.length
    : null;

  const validQ   = grQuizEntries.filter(v => v !== null && v !== '');
  const quizAvg  = validQ.length > 0
    ? validQ.reduce((s, v) => s + parseFloat(v), 0) / validQ.length
    : null;

  const validL   = grLabEntries.filter(v => v !== null && v !== '');
  const labAvg   = validL.length > 0
    ? validL.reduce((s, v) => s + parseFloat(v), 0) / validL.length
    : null;

  const finVal   = document.getElementById('grFinGrade')?.value;
  const finEntered = (finVal !== '' && finVal !== undefined && finVal !== null)
    ? parseFloat(finVal) : null;

  const bonVal   = document.getElementById('grBonusGrade')?.value;
  const bonEntered = (bonVal !== '' && bonVal !== undefined && bonVal !== null)
    ? parseFloat(bonVal) : null;

  const extraGrades = [];
  document.querySelectorAll('#grExtraGradesContainer .gr-extra-grade-input').forEach(inp => {
    extraGrades.push(inp.value === '' ? null : parseFloat(inp.value));
  });

  let locked = 0;
  let missingFinalW = 0;

  if (mtVisible && mtW > 0 && mtAvg !== null)
    locked += mtAvg * mtW / 100;

  if (finVisible && finW > 0) {
    if (finEntered !== null) locked += finEntered * finW / 100;
    else                     missingFinalW = finW;
  }

  if (quizVisible && quizW > 0 && quizAvg !== null)
    locked += quizAvg * quizW / 100;

  if (labVisible && labW > 0 && labAvg !== null)
    locked += labAvg * labW / 100;

  if (bonusVisible && bonusW > 0 && bonEntered !== null)
    locked += bonEntered * bonusW / 100;

  grCurrentExtraDefs.forEach((ex, i) => {
    const w = ex.weight || 0;
    const g = extraGrades[i];
    if (g !== null && g !== undefined && w > 0)
      locked += parseFloat(g);
  });

  // ── decide what we are solving for ────────────────────────
  let solveLabel = null;
  let solveEffW  = 0;

  if (finVisible && finW > 0 && finEntered === null) {
    solveLabel = 'Final exam';
    solveEffW  = finW;
  } else if (quizVisible && quizW > 0 && quizAvg === null) {
    solveLabel = 'Quizzes avg';
    solveEffW  = quizW;
  } else if (mtVisible && mtW > 0 && mtAvg === null) {
    solveLabel = 'Midterm avg';
    solveEffW  = mtW;
  } else {
    solveLabel = null;
  }

  const activeBtn = document.querySelector('.gr-needed-pill-active');
  if (!activeBtn) { panel.style.display = 'none'; return; }
  const targetMin  = parseFloat(activeBtn.dataset.min);
  const targetCode = activeBtn.dataset.code;
  panel.style.display = '';

  // ── build output ───────────────────────────────────────────
  if (!solveLabel) {
    // All filled — just show the comparison
    const resultEl = document.getElementById('grResScore');
    const current  = resultEl ? parseFloat(resultEl.textContent) : null;
    if (current === null || isNaN(current)) { out.innerHTML = ''; return; }

    const diff = (current - targetMin).toFixed(1);
    const met  = current >= targetMin;
    out.innerHTML = `
      <div class="gr-needed-summary ${met ? 'gr-needed-ok' : 'gr-needed-warn'}">
        ${met
          ? `You already reached <strong>${targetCode}</strong> (${targetMin} pts).
             Current score: <strong>${current.toFixed(2)}</strong>
             — <strong>+${diff}</strong> above threshold.`
          : `Your current score (<strong>${current.toFixed(2)}</strong>) is
             <strong>${Math.abs(diff)}</strong> pts short of ${targetCode} (${targetMin} pts).`
        }
      </div>`;
    return;
  }

  // ── solve: needed = (target − locked) / (effW / 100) ──────
  const needed = (targetMin - locked) / (solveEffW / 100);
  const rounded = Math.ceil(needed * 10) / 10;

  let html = '';

  if (rounded <= 0) {
    html = `<div class="gr-needed-summary gr-needed-ok">
      You've already secured <strong>${targetCode}</strong> regardless of your ${solveLabel}. 🎉
    </div>`;
  } else if (rounded > 100) {
    html = `<div class="gr-needed-summary gr-needed-warn">
      <strong>${targetCode}</strong> is out of reach — you would need
      <strong>${rounded.toFixed(1)}/100</strong> on your ${solveLabel},
      which exceeds the maximum.
    </div>`;
  } else {
    const rows = LETTER_SCALE.slice(0, -1).map(([min, code]) => {
      const n = (min - locked) / (solveEffW / 100);
      return { code, min, needed: n };
    });

    html = `
      <div class="gr-needed-summary gr-needed-ok">
        For <strong>${targetCode}</strong> you need at least
        <strong>${rounded.toFixed(1)} / 100</strong> on your ${solveLabel}.
      </div>
      <div class="gr-needed-table-wrap">
        <table class="gr-needed-table">
          <thead>
            <tr>
              <th>Grade</th>
              <th>Threshold</th>
              <th>${solveLabel} needed</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => {
              const nr = Math.ceil(r.needed * 10) / 10;
              const impossible = nr > 100;
              const free       = nr <= 0;
              const isTarget   = r.code === targetCode;
              return `<tr class="${isTarget ? 'gr-needed-target-row' : ''}
                                 ${impossible ? 'gr-needed-row-dim' : ''}">
                <td class="gr-needed-cell-grade" style="color:${isTarget ? 'var(--accent)' : 'var(--text)'}">
                  ${r.code}
                </td>
                <td class="gr-needed-cell-thresh">≥ ${r.min}</td>
                <td class="gr-needed-cell-score ${impossible ? '' : 'gr-needed-cell-bold'}">
                  ${free       ? '—  (already secured)'
                  : impossible ? '> 100 (impossible)'
                  :              nr.toFixed(1) + ' / 100'}
                </td>
                <td class="gr-needed-cell-icon">
                  ${free ? '✓' : impossible ? '✗' : ''}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  out.innerHTML = html;
}

// ── 5. Collapse toggle ────────────────────────────────────────
let _grNeededCollapsed = false;
function grNeededToggle() {
  _grNeededCollapsed = !_grNeededCollapsed;
  const result = document.getElementById('grNeededResult');
  const trow   = document.querySelector('.gr-needed-target-row');
  const btn    = document.querySelector('.gr-needed-collapse-btn');
  if (result) result.style.display = _grNeededCollapsed ? 'none' : '';
  if (trow)   trow.style.display   = _grNeededCollapsed ? 'none' : '';
  if (btn)    btn.textContent       = _grNeededCollapsed ? 'Show' : 'Hide';
}

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
];

const BUILTIN_SCALE_TEMPLATES = _RAW_SCALE_BUILTINS.map((t, i) => ({
  ...t,
  id:      '__scale_builtin_' + (i + 1),
  builtin: true,
}));

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

(function () {
  const _orig = window.initGradeScreen;
  window.initGradeScreen = function () {
    _orig.apply(this, arguments);
    _stInjectUI();
  };
})();

(function () {
  const _orig = window.grShowScreen;
  window.grShowScreen = function (name) {
    _orig.apply(this, arguments);
    if (name === 'scale') _stRenderTemplateList();
  };
})();

function _stInjectUI() {
  if (document.getElementById('stTemplateSection')) return;

  const scaleMain = document.querySelector('#grScaleScreen .gr-main');
  if (!scaleMain) return;

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

function _stRenderActiveBar() {
  const bar  = document.getElementById('stActiveBar');
  const name = document.getElementById('stActiveBarName');
  if (!bar) return;
  const id  = stGetActiveId();
  const tpl = id ? stGetById(id) : null;
  bar.style.display = tpl ? '' : 'none';
  if (name && tpl) name.textContent = tpl.name;
}

function _stRenderTemplateList() {
  const activeId = stGetActiveId();

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

function stLoadPreset(id) {
  const tpl = stGetById(id);
  if (!tpl) return;

  LETTER_SCALE.length = 0;
  tpl.scale.forEach(row => LETTER_SCALE.push([...row]));
  grSaveScale(LETTER_SCALE);

  stSetActiveId(id);

  if (typeof grRenderScaleScreen === 'function') grRenderScaleScreen();
  if (typeof grCalc             === 'function') grCalc();
  if (typeof grNeededBuildPills === 'function') grNeededBuildPills(), grNeededCalc();

  _stRenderActiveBar();
  _stRenderTemplateList();
  grShowToast('Scale preset loaded ✓');
}

function _stCurrentScale() {
  return LETTER_SCALE.map(r => [...r]);
}

function stClearAndReset() {
  stClearActive();
  grResetScaleUI();
  _stRenderActiveBar();
  _stRenderTemplateList();
}

function stUpdateActive() {
  const id = stGetActiveId();
  if (!id || id.startsWith('__scale_builtin')) {
    grShowToast('Built-in presets cannot be updated'); return;
  }
  stRename(id, stGetById(id)?.name || 'Unnamed');
  const all = _stReadAll();
  const idx = all.findIndex(t => t.id === id);
  if (idx !== -1) {
    all[idx].scale = _stCurrentScale();
    _stWriteAll(all);
  }
  grShowToast('Scale preset updated ✓');
  _stRenderTemplateList();
}

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

const EI_VERSION = 1;

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

function _eiInjectGradeButtons() {
  if (document.getElementById('eiGradeExportRow')) return;
  const anchor = document.getElementById('grSavedList');
  if (!anchor) return;

  const row = document.createElement('div');
  row.id        = 'eiGradeExportRow';
  row.className = 'ei-action-row';
  row.innerHTML = `
    <button class="gr-btn-ghost ei-btn" onclick="eiExportGradeTemplatesAll()">↓ Export All</button>
    <button class="gr-btn-ghost ei-btn" onclick="eiExportGradeTemplateCurrent()">↓ Export Current</button>
    <button class="gr-btn-ghost ei-btn" onclick="eiShareGradeTemplates()">↗ Share</button>
    <button class="gr-btn-ghost ei-btn" onclick="eiOpenImport('grade')">↑ Import</button>
  `;
  anchor.insertAdjacentElement('afterend', row);
}

function _eiInjectScaleButtons() {
  if (document.getElementById('eiScaleExportRow')) return;
  const anchor = document.getElementById('stSavedList');
  if (!anchor) return;

  const row = document.createElement('div');
  row.id        = 'eiScaleExportRow';
  row.className = 'ei-action-row';
  row.innerHTML = `
    <button class="gr-btn-ghost ei-btn" onclick="eiExportScaleTemplatesAll()">↓ Export All</button>
    <button class="gr-btn-ghost ei-btn" onclick="eiExportScaleTemplateCurrent()">↓ Export Current</button>
    <button class="gr-btn-ghost ei-btn" onclick="eiShareScaleTemplates()">↗ Share</button>
    <button class="gr-btn-ghost ei-btn" onclick="eiOpenImport('scale')">↑ Import</button>
  `;
  anchor.insertAdjacentElement('afterend', row);
}
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

let _eiMode      = 'grade';
let _eiParsed    = null;

function eiExportGradeTemplatesAll() {
  const saved = getSavedTemplates();
  if (!saved.length) { grShowToast('No saved grade templates to export'); return; }

  const payload = {
    _type:    'grade_templates',
    _version: EI_VERSION,
    exported: new Date().toISOString(),
    templates: saved.map(t => {
      const { id, createdAt, builtin, ...rest } = t;
      return rest;
    }),
  };
  _eiDownload('grade_templates_all.json', payload);
  grShowToast(`Exported ${saved.length} grade template(s) ✓`);
}

function eiExportGradeTemplateCurrent() {
  const activeId = getActiveTemplateId();
  if (!activeId) { grShowToast('No active grade template'); return; }
  const tpl = getTemplateById(activeId);
  if (!tpl) { grShowToast('Active template not found'); return; }
  const { id, createdAt, builtin, ...clean } = tpl;
  const payload = {
    _type:    'grade_templates',
    _version: EI_VERSION,
    exported: new Date().toISOString(),
    templates: [clean],
  };
  const safeName = (tpl.name || 'template').replace(/[^a-z0-9_\-]/gi, '_').toLowerCase();
  _eiDownload(`grade_${safeName}.json`, payload);
  grShowToast(`Exported "${tpl.name}" ✓`);
}

function eiExportScaleTemplatesAll() {
  const saved = stGetSaved();
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
  _eiDownload('scale_presets_all.json', payload);
  grShowToast(`Exported ${saved.length} scale preset(s) ✓`);
}

function eiExportScaleTemplateCurrent() {
  // remove the currentScaleTemplateId check entirely
  const activeId = stGetActiveId();
  if (!activeId) { grShowToast('No active scale preset'); return; }
  const tpl = stGetById(activeId);
  if (!tpl) { grShowToast('Active scale preset not found'); return; }
  const { id, createdAt, builtin, ...clean } = tpl;
  const payload = {
    _type:    'scale_templates',
    _version: EI_VERSION,
    exported: new Date().toISOString(),
    templates: [clean],
  };
  const safeName = (tpl.name || 'scale').replace(/[^a-z0-9_\-]/gi, '_').toLowerCase();
  _eiDownload(`scale_${safeName}.json`, payload);
  grShowToast(`Exported "${tpl.name}" ✓`);
}

function eiShareGradeTemplates() {
  const saved = getSavedTemplates();
  if (!saved.length) { grShowToast('No saved grade templates to share'); return; }
  const payload = {
    _type:    'grade_templates',
    _version: EI_VERSION,
    exported: new Date().toISOString(),
    templates: saved.map(t => {
      const { id, createdAt, builtin, ...rest } = t;
      return rest;
    }),
  };
  _eiShare(JSON.stringify(payload, null, 2), 'grade_templates.json');
}

function eiShareScaleTemplates() {
  const saved = stGetSaved();
  if (!saved.length) { grShowToast('No saved scale presets to share'); return; }
  const payload = {
    _type:    'scale_templates',
    _version: EI_VERSION,
    exported: new Date().toISOString(),
    templates: saved.map(t => {
      const { id, createdAt, builtin, ...rest } = t;
      return rest;
    }),
  };
  _eiShare(JSON.stringify(payload, null, 2), 'scale_presets.json');
}

function _eiShare(jsonString, filename) {
  if (typeof Android !== 'undefined' && Android.shareText) {
    try {
      Android.shareText(jsonString, `Share ${filename}`);
      grShowToast('Opening share sheet...');
      return;
    } catch (e) {
      grShowToast('Share error: ' + e.message);
    }
  }

  if (navigator.share) {
    navigator.share({ title: `Share ${filename}`, text: jsonString })
      .then(() => grShowToast('Shared ✓'))
      .catch((e) => {
        if (e && e.name === 'AbortError') return;
        grShowToast('Share failed');
      });
    return;
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(jsonString)
      .then(() => grShowToast('Copied to clipboard (share not available)'))
      .catch(() => grShowToast('Share failed'));
  } else {
    grShowToast('Share not supported');
  }
}

function _eiDownload(filename, payload) {
  const json = JSON.stringify(payload, null, 2);

  if (typeof Android !== 'undefined' && Android.exportFile) {
    try {
      Android.exportFile(json, filename);
      return;
    } catch (e) {
      grShowToast('Export error: ' + e.message);
    }
  }

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
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json)
        .then(() => grShowToast('Copied to clipboard (download not available)'))
        .catch(() => grShowToast('Export failed'));
    } else {
      grShowToast('Export failed — no file support');
    }
  }
}

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

function eiOnFileChosen(input) {
  const file = input.files[0];
  if (!file) return;
  document.getElementById('eiFileChosen').textContent = file.name;
  const reader = new FileReader();
  reader.onload = e => _eiValidateAndPreview(e.target.result);
  reader.readAsText(file);
}

function eiOnPaste(textarea) {
  _eiValidateAndPreview(textarea.value.trim());
}

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

function eiConfirmImport() {
  if (!_eiParsed || !_eiParsed.length) return;

  let count = 0;
  if (_eiMode === 'grade') {
    _eiParsed.forEach(t => {
      const { _dupe, ...data } = t;
      saveTemplate(data);
      count++;
    });
    if (typeof grRenderTemplatesScreen === 'function') grRenderTemplatesScreen();
  } else {
    _eiParsed.forEach(t => {
      const { _dupe, ...data } = t;
      stSave(data.name, data.scale);
      count++;
    });
    if (typeof _stRenderTemplateList === 'function') _stRenderTemplateList();
  }

  eiCloseModal();
  grShowToast(`${count} template(s) imported ✓`);
}