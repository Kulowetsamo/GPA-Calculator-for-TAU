// ── gr_needed.js ─────────────────────────────────────────────
// "What do I need?" panel — drop this file after gr_calc.js
// It patches:
//   1. grCalc()           → also calls grNeededCalc() after each recalc
//   2. initGradeScreen()  → injects the panel HTML after the result card
//   3. New functions for the panel logic
// ─────────────────────────────────────────────────────────────

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
  // Guard: only inject once
  if (document.getElementById('grNeededPanel')) return;

  // Find the result card inside grCalcScreen and insert after it
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

  // ── collect weights (same logic as grCalc) ────────────────
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
  // Current score-so-far from components that have a value
  // (mirrors computeGrade but we need the partial total and
  //  to know which components are still missing)

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

  // Extra component grades
  const extraGrades = [];
  document.querySelectorAll('#grExtraGradesContainer .gr-extra-grade-input').forEach(inp => {
    extraGrades.push(inp.value === '' ? null : parseFloat(inp.value));
  });

  // ── build "locked" score (what is already earned) ─────────
  let locked = 0;
  let missingFinalW = 0;   // effective weight of the final that is still missing

  if (mtVisible && mtW > 0 && mtAvg !== null)
    locked += mtAvg * mtW / 100;

  if (finVisible && finW > 0) {
    if (finEntered !== null) locked += finEntered * finW / 100;
    else                     missingFinalW = finW;     // this is what we'll solve for
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
      locked += parseFloat(g);   // extras contribute their raw pts (see computeGrade)
  });

  // ── decide what we are solving for ────────────────────────
  // Priority: final exam > quizzes > midterm (first blank one)
  // We look for the first component that is visible AND has weight AND is blank.
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
    // Everything is filled — just show what they already have vs target
    solveLabel = null;
  }

  // ── get selected target ────────────────────────────────────
  const activeBtn = document.querySelector('.gr-needed-pill-active');
  if (!activeBtn) { panel.style.display = 'none'; return; }
  const targetMin  = parseFloat(activeBtn.dataset.min);
  const targetCode = activeBtn.dataset.code;

  // Show the panel (we have enough context now)
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
  const rounded = Math.ceil(needed * 10) / 10;   // round up to 1 dp

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
    // Also show all other reachable grades in a compact table
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
