// GPA Calculator (ui.js)
// This file powers the front-end logic for the GPA calculator, including
// profile management, semester course editing, GPA calculations, transcript
// generation, image export, and swipe navigation.
// It interacts with localStorage to persist profiles and their data.
// Global state variables: activeProfileId, activeDept, activeKey, semData,
// semHistory, whatIfMode, realSnapshotBySem, etc.

// Profile list management
// Filter for profile department: 'ALL', 'CNGB', 'IENG', or 'FE'
let profileFilter = 'ALL';

/**
 * Sets the department filter for profiles and re-renders the profile list.
 * @param {string} f - Filter value: 'ALL', 'CNGB', 'IENG', 'FE'
 */
function setProfileFilter(f) {
  profileFilter = f;
  ['ALL', 'CNGB', 'IENG', 'FE'].forEach(d => {
    document.getElementById('filterTab_' + d)?.classList.toggle('active', d === f);
  });
  renderProfileList();
}

/**
 * Renders the list of profiles (cards) in the sidebar based on current filter.
 * Also highlights the active profile.
 */
function renderProfileList() {
  const profiles = getAllProfiles();
  const list = document.getElementById('profileList');
  list.innerHTML = '';
  const ids = Object.keys(profiles).filter(id => profileFilter === 'ALL' || (profiles[id].dept || 'CNGB') === profileFilter);
  if (!ids.length) {
    list.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:20px 0;">No profiles' + (profileFilter !== 'ALL' ? ' for ' + profileFilter : '') + '. Create one above.</div>';
    return;
  }
  ids.forEach(id => {
    const p = profiles[id];
    const cnt = Object.keys(p.semHistory || {}).length;
    const cum = calcCumulative(p.semHistory || {});
    const dept = p.dept || 'CNGB';
    const card = document.createElement('div');
    card.className = 'profile-card' + (id === activeProfileId ? ' is-active' : '');
    card.innerHTML = `
      <div class="pc-info">
        <div class="pc-name">${p.name}<span class="dept-badge">${dept}</span></div>
        <div class="pc-meta">${cnt} semester${cnt !== 1 ? 's' : ''} saved${cum ? ' · ' + cum.val + ' GPA' : ''}${cum?.honor ? ' · ' + cum.honor : ''}</div>
      </div>
      <div class="pc-actions">
        ${id !== activeProfileId
          ? `<button class="pc-btn load" onclick="loadProfile('${id}')">Load</button>`
          : '<span style="font-size:11px;color:var(--accent);font-family:\'DM Mono\',monospace;">Active</span>'}
        <button class="pc-btn" style="color:#c8a030;border-color:#3a2a10;" onclick="openRenameModal('${id}')">Rename</button>
        <button class="pc-btn del" onclick="askDeleteProfile('${id}')">Del</button>
      </div>`;
    list.appendChild(card);
  });
}

//Semester UI (Course List, Saving, Loading)
/**
 * Saves the current course rows data (grades/credits) for the active semester.
 * In "what-if" mode, it restores from snapshot to avoid corrupting real data.
 * @param {string} key - Semester key e.g., "Year 1|Fall"
 */
function persist(key) {
  // In what-if mode the DOM contains hypothetical grades — use the real snapshot
  // to avoid corrupting semData with what-if values
  if (whatIfMode) {
    const snap = realSnapshotBySem[key];
    if (snap) {
      const rows = document.querySelectorAll('.course-row');
      const saved = [];
      rows.forEach((row, i) => {
        const credEl = row.querySelector('.spin-val');
        const isElect = row.classList.contains('elective');
        const existingGrade = (semData[activeDept + '|' + key] || [])[i]?.grade ?? '';
        const realGrade = snap[i] !== undefined ? snap[i] : existingGrade;
        saved.push({
          grade: realGrade,
          credits: isElect ? parseInt(credEl.textContent) : parseInt(row.dataset.credits),
          elective: isElect
        });
      });
      semData[activeDept + '|' + key] = saved;
      persistToProfile();
    }
    // No snapshot = haven't visited this sem in what-if mode, semData already clean
    return;
  }
  const rows = document.querySelectorAll('.course-row');
  const snap = [];
  rows.forEach(row => {
    const gradeEl = row.querySelector('.grade-select');
    const credEl = row.querySelector('.spin-val');
    const isElect = row.classList.contains('elective');
    snap.push({
      grade: gradeEl ? gradeEl.value : '',
      credits: isElect ? parseInt(credEl.textContent) : parseInt(row.dataset.credits),
      elective: isElect
    });
  });
  semData[activeDept + '|' + key] = snap;
  persistToProfile();
}

/**
 * Loads courses for the currently active semester (activeKey) from semData or presets.
 * Builds the course list DOM, then updates GPA calculations and history strip.
 */
function loadCourses() {
  const list = document.getElementById('courseList');
  list.innerHTML = '';
  const key = activeKey;
  const dataKey = activeDept + '|' + key;
  const saved = semData[dataKey] || null;
  const preset = getCoursePresets()[key] || [];
  const elects = getElectivePresets()[key] || [];
  const sorted = [...preset].sort((a, b) => b[1] - a[1]);
  sorted.forEach(([name, credits], i) => {
    list.appendChild(makeCourseRow(name, credits, saved?.[i]?.grade || '', false));
  });
  elects.forEach((name, j) => {
    const idx = sorted.length + j;
    list.appendChild(makeCourseRow(name, saved?.[idx]?.credits || 3, saved?.[idx]?.grade || '', true));
  });
  recalculate();                       // Update GPA for this semester
  updateHistoryStrip();                // Refresh semester history chips
  updateCumulative();                  // Recalculate cum. GPA
  if (whatIfMode) _onWhatIfSemSwitch();
  else {
    document.querySelector('#calcScreen .banner:not(.cum)')?.classList.remove('whatif-active');
  }
}

/**
 * Creates a DOM row for a single course.
 * @param {string} name - Course name
 * @param {number} credits - Credit value (or default 3 for electives)
 * @param {string} savedGrade - Previously selected grade
 * @param {boolean} isElective - Whether this is an elective (0 Credit course or not)
 * @returns {HTMLElement} The course row div
 */
function makeCourseRow(name, credits, savedGrade, isElective) {
  const isZero = (!isElective && credits === 0);
  const row = document.createElement('div');
  row.className = 'course-row' + (isElective ? ' elective' : '') + (isZero ? ' zero-cr' : '');
  row.dataset.credits = credits;
  row.dataset.zeroCr = isZero ? '1' : '0';

  const nameEl = document.createElement('div');
  nameEl.className = 'course-name';
  nameEl.textContent = name;
  row.appendChild(nameEl);

  if (isElective) {
    const spin = document.createElement('div');
    spin.className = 'credit-spin';
    const minus = document.createElement('button');
    minus.className = 'spin-btn';
    minus.textContent = '−';
    const val = document.createElement('span');
    val.className = 'spin-val';
    val.textContent = credits;
    const plus = document.createElement('button');
    plus.className = 'spin-btn';
    plus.textContent = '+';
    minus.onclick = () => {
      let v = parseInt(val.textContent);
      if (v > 0) {
        val.textContent = v - 1;
        row.dataset.credits = v - 1;
        recalculate();
      }
    };
    plus.onclick = () => {
      let v = parseInt(val.textContent);
      if (v < 9) {
        val.textContent = v + 1;
        row.dataset.credits = v + 1;
        recalculate();
      }
    };
    spin.appendChild(minus);
    spin.appendChild(val);
    spin.appendChild(plus);
    row.appendChild(spin);
  } else {
    row.appendChild(Object.assign(document.createElement('div'), {
      className: 'course-credits',
      textContent: isZero ? '—' : credits
    }));
  }

  const sel = document.createElement('select');
  if (isZero) {
    // Zero-credit courses' grades: S, U, or SKIP
    sel.appendChild(Object.assign(document.createElement('option'), { value: '', textContent: '—' }));
    [['S', 'Passed'], ['U', 'Not Passed'], ['SKIP', "Didn't Take"]].forEach(([v, t]) => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = t;
      if (v === savedGrade) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.className = 'grade-select' + (savedGrade === 'S' ? ' zero-pass' : savedGrade === 'U' ? ' zero-fail has-grade' : savedGrade ? ' has-grade' : '');
    sel.onchange = () => {
      sel.className = 'grade-select' + (sel.value === 'S' ? ' zero-pass' : sel.value === 'U' ? ' zero-fail has-grade' : sel.value ? ' has-grade' : '');
      row.classList.toggle('graded', sel.value !== '' && sel.value !== 'SKIP');
      persist(activeKey);
    };
  } else {
    sel.className = 'grade-select' + (savedGrade ? ' has-grade' : '');
    sel.appendChild(Object.assign(document.createElement('option'), { value: '', textContent: '—' }));
    GRADES.filter(g => g !== 'SKIP').forEach(g => {
      const opt = document.createElement('option');
      opt.value = g;
      opt.textContent = g;
      if (g === savedGrade) opt.selected = true;
      sel.appendChild(opt);
    });
    const skipOpt = document.createElement('option');
    skipOpt.value = 'SKIP';
    skipOpt.textContent = "Didn't Take";
    if (savedGrade === 'SKIP') skipOpt.selected = true;
    sel.appendChild(skipOpt);
    sel.onchange = () => {
      sel.classList.toggle('has-grade', sel.value !== '');
      row.classList.toggle('graded', sel.value !== '' && sel.value !== 'SKIP');
      recalculate();
      persist(activeKey);
    };
  }
  if (savedGrade && savedGrade !== 'SKIP') row.classList.add('graded');
  row.appendChild(sel);
  return row;
}

/**
 * Updates the horizontal history strip (chips) showing saved semesters and their GPAs.
 * Chips are clickable to switch semesters.
 */
function updateHistoryStrip() {
  const wrap = document.getElementById('historyWrap');
  wrap.innerHTML = '';
  SEM_ORDER.forEach(([year, sem]) => {
    const key = year + '|' + sem;
    if (!semHistory[key]) return;
    const yIdx = ['Year 1', 'Year 2', 'Year 3', 'Year 4'].indexOf(year) + 1;
    const semNum = sem === 'Fall' ? 1 : 2;
    const chip = document.createElement('div');
    chip.className = 'chip' + (key === activeKey ? ' active-chip' : '');
    chip.innerHTML = `<div class="chip-label">Y${yIdx}S${semNum}</div><div class="chip-gpa">${semHistory[key].gpa.toFixed(2)}</div>`;
    chip.onclick = () => {
      const [y, s] = key.split('|');
      document.getElementById('yearSel').value = y;
      document.getElementById('semSel').value = s;
      switchSemester();
    };
    wrap.appendChild(chip);
  });
}

/**
 * Updates the cum. GPA banner.
 * If provided with a what-if GPA, displays it in purple and shows delta vs real.
 * @param {number|null} wiGpa - Optional what-if cumulative GPA
 */
function updateCumulative(wiGpa) {
  const keys = Object.keys(semHistory);
  const banner = document.getElementById('cumBanner');
  const badge = document.getElementById('honorBadge');
  const cumLabel = document.getElementById('cumLabel');
  const cumGpaEl = document.getElementById('cumGpa');
  const cumSubsEl = document.getElementById('cumSubs');
  if (!keys.length) {
    cumGpaEl.textContent = '—';
    cumSubsEl.textContent = '';
    badge.style.display = 'none';
    banner.className = 'banner cum';
    cumLabel.textContent = 'Cumulative';
    banner.classList.remove('whatif-active');
    return;
  }
  let pts = 0, cr = 0;
  keys.forEach(k => {
    pts += semHistory[k].gpa * semHistory[k].credits;
    cr += semHistory[k].credits;
  });
  const realGpa = cr > 0 ? pts / cr : 0;

  // If a what-if cum. GPA is provided, show it in purple instead
  const displayGpa = (wiGpa != null) ? wiGpa : realGpa;
  cumGpaEl.textContent = displayGpa.toFixed(2);
  cumSubsEl.textContent = keys.length + ' semester' + (keys.length > 1 ? 's' : '');

  banner.className = 'banner cum';
  badge.style.display = 'none';
  cumLabel.textContent = 'Cumulative';
  banner.classList.remove('whatif-active');

  if (wiGpa != null) {
    // What-if mode: show purple, add what-if label
    banner.classList.add('whatif-active');
    cumLabel.textContent = 'Cumulative (What-If)';
    // Delta hint
    const diff = wiGpa - realGpa;
    if (Math.abs(diff) >= 0.005) {
      cumSubsEl.textContent = (diff > 0 ? '▲ +' : '▼ ') + diff.toFixed(2) + ' vs real · ' + keys.length + ' sem' + (keys.length > 1 ? 's' : '');
    }
  } else {
    if (realGpa < 2.0) {
      banner.classList.add('danger');
      cumLabel.textContent = 'Cumulative ⚠';
    } else if (realGpa >= 3.5) {
      banner.classList.add('high-honor');
      badge.style.display = 'inline-block';
      badge.className = 'honor-badge high';
      badge.textContent = '★ High Honor';
    } else if (realGpa >= 3.0) {
      badge.style.display = 'inline-block';
      badge.className = 'honor-badge';
      badge.textContent = '✦ Honor Student';
    }
  }
}

// Modals (new profile, delete, rename, reset)
let _modalDept = 'CNGB';

/**
 * Sets the department for the new profile modal UI.
 * @param {string} d - Department code ('CNGB', 'IENG', 'FE')
 */
function selectModalDept(d) {
  _modalDept = d;
  ['CNGB', 'IENG', 'FE'].forEach(x => document.getElementById('mdept_' + x).classList.toggle('active', x === d));
}

function openNewProfileModal() {
  _modalDept = activeDept;
  ['CNGB', 'IENG', 'FE'].forEach(x => document.getElementById('mdept_' + x).classList.toggle('active', x === _modalDept));
  document.getElementById('profileNameInput').value = '';
  document.getElementById('newProfileModal').classList.add('open');
  setTimeout(() => document.getElementById('profileNameInput').focus(), 100);
}
function closeNewProfileModal() { document.getElementById('newProfileModal').classList.remove('open'); }

function confirmNewProfile() {
  const name = document.getElementById('profileNameInput').value.trim();
  if (!name) return;
  const profiles = getAllProfiles();
  const id = 'profile_' + Date.now();
  profiles[id] = { name, dept: _modalDept, semData: {}, semHistory: {} };
  saveAllProfiles(profiles);
  closeNewProfileModal();
  loadProfile(id);
}

let deleteTargetId = null;
function askDeleteProfile(id) {
  const profiles = getAllProfiles();
  deleteTargetId = id;
  document.getElementById('deleteModalText').textContent = `Delete "${profiles[id]?.name}"? This cannot be undone.`;
  document.getElementById('deleteModal').classList.add('open');
}
function closeDeleteModal() { document.getElementById('deleteModal').classList.remove('open'); deleteTargetId = null; }

function confirmDelete() {
  if (!deleteTargetId) return;
  const profiles = getAllProfiles();
  const name = profiles[deleteTargetId]?.name;
  deletedProfile = { id: deleteTargetId, data: JSON.parse(JSON.stringify(profiles[deleteTargetId])) };
  delete profiles[deleteTargetId];
  saveAllProfiles(profiles);
  if (activeProfileId === deleteTargetId) {
    localStorage.removeItem('gpa_activeProfile');
    activeProfileId = null;
    semData = {};
    semHistory = {};
    document.getElementById('activeProfileName').textContent = 'No Profile';
    document.getElementById('activeProfileBarName').textContent = 'None';
    updateDeptSelectState();
    loadCourses();
    updateHistoryStrip();
    updateCumulative();
  }
  closeDeleteModal();
  renderProfileList();
  showToast(`"${name}" deleted`, 5000, true);
}

/**
 * Undo the last profile deletion if the toast is still visible.
 */
function undoDelete() {
  if (!deletedProfile) return;
  const profiles = getAllProfiles();
  profiles[deletedProfile.id] = deletedProfile.data;
  saveAllProfiles(profiles);
  if (!activeProfileId) {
    setActiveProfileId(deletedProfile.id);
    loadActiveProfile();
    loadCourses();
    updateHistoryStrip();
    updateCumulative();
  }
  deletedProfile = null;
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
  document.getElementById('toast').classList.remove('show');
  renderProfileList();
  showToast('Restored ✓', 2000, false);
}

function confirmReset() { document.getElementById('resetModal').classList.add('open'); }
function closeResetModal() { document.getElementById('resetModal').classList.remove('open'); }
function doReset() { semData = {}; semHistory = {}; if (activeProfileId) persistToProfile(); loadCourses(); closeResetModal(); }

let toastTimer = null;
/**
 * Shows a temporary notification toast.
 * @param {string} msg - Message to display
 * @param {number} duration - Milliseconds to show
 * @param {boolean} showUndo - Whether to show an "Undo" button
 */
function showToast(msg, duration = 2000, showUndo = false) {
  const t = document.getElementById('toast');
  const msgEl = document.getElementById('toastMsg');
  const undo = document.getElementById('toastUndo');
  const bar = document.getElementById('toastBar');
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
  msgEl.textContent = msg;
  undo.style.display = showUndo ? 'block' : 'none';
  bar.style.transition = 'none';
  bar.style.width = '100%';
  t.classList.add('show');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    bar.style.transition = `width ${duration}ms linear`;
    bar.style.width = '0%';
  }));
  toastTimer = setTimeout(() => { t.classList.remove('show'); deletedProfile = null; toastTimer = null; }, duration);
}

let renameTargetId = null;
function openRenameModal(id) {
  renameTargetId = id;
  const profiles = getAllProfiles();
  document.getElementById('renameInput').value = profiles[id]?.name || '';
  document.getElementById('renameModal').classList.add('open');
  setTimeout(() => document.getElementById('renameInput').focus(), 100);
}
function closeRenameModal() { document.getElementById('renameModal').classList.remove('open'); renameTargetId = null; }
function confirmRename() {
  const name = document.getElementById('renameInput').value.trim();
  if (!name || !renameTargetId) return;
  const profiles = getAllProfiles();
  profiles[renameTargetId].name = name;
  saveAllProfiles(profiles);
  if (renameTargetId === activeProfileId) {
    document.getElementById('activeProfileName').textContent = name;
    document.getElementById('activeProfileBarName').textContent = name;
  }
  closeRenameModal();
  renderProfileList();
}

// Theme ( Light / Dark Mode)
/**
 * Toggles between light and dark theme.
 */
function toggleTheme() {
  const isLight = document.body.classList.toggle('light');
  localStorage.setItem('gpa_theme', isLight ? 'light' : 'dark');
  document.getElementById('themeIcon').innerHTML = isLight
    ? '<path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z"/>'
    : '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
}
function loadTheme() {
  if (localStorage.getItem('gpa_theme') === 'light') {
    document.body.classList.add('light');
    document.getElementById('themeIcon').innerHTML = '<path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z"/>';
  }
}

// Transcript (Full detailed view of all Semesters combined)
/**
 * Renders the entire academic transcript in the designated container.
 * Includes semester headers, courses with grades, cum. GPA, and action buttons.
 */
function renderTranscript() {
  const wrap = document.getElementById('transcriptWrap');
  wrap.innerHTML = '';
  const profiles = getAllProfiles();
  const profileName = activeProfileId && profiles[activeProfileId] ? profiles[activeProfileId].name : null;

  const header = document.createElement('div');
  header.className = 'transcript-header';
  header.innerHTML = `<span class="transcript-title">${activeDept}</span><span class="transcript-sub">GPA Calculator</span>`;
  wrap.appendChild(header);

  const pName = document.createElement('div');
  pName.className = 'transcript-profile';
  pName.textContent = profileName || 'No Profile';
  wrap.appendChild(pName);

  const savedSems = SEM_ORDER.filter(([y, s]) => semHistory[y + '|' + s]);
  if (!savedSems.length) {
    const msg = document.createElement('div');
    msg.className = 'no-data-msg';
    msg.innerHTML = 'No saved semesters yet.<br>Save semester GPAs in the Calc tab.';
    wrap.appendChild(msg);
    renderTranscriptActions(wrap);
    return;
  }

  const presets = getCoursePresets();
  const electives = getElectivePresets();

  savedSems.forEach(([year, sem]) => {
    const key = year + '|' + sem;
    const dataKey = activeDept + '|' + key;
    const yIdx = ['Year 1', 'Year 2', 'Year 3', 'Year 4'].indexOf(year) + 1;
    const semN = sem === 'Fall' ? 1 : 2;
    const saved = semData[dataKey] || [];
    const preset = [...(presets[key] || [])].sort((a, b) => b[1] - a[1]);
    const elects = electives[key] || [];

    const semDiv = document.createElement('div');
    semDiv.className = 'transcript-sem';
    const semH = document.createElement('div');
    semH.className = 'transcript-sem-header';
    semH.innerHTML = `<span class="transcript-sem-title">Year ${yIdx} · Semester ${semN}</span><span class="transcript-sem-gpa">${semHistory[key].gpa.toFixed(2)} GPA</span>`;
    semDiv.appendChild(semH);

    const allCourses = [
      ...preset.map((c, i) => ({ name: c[0], cr: c[1], grade: saved[i]?.grade || '', isZero: c[1] === 0 })),
      ...elects.map((name, j) => { const idx = preset.length + j; return { name, cr: saved[idx]?.credits || 3, grade: saved[idx]?.grade || '', isZero: false }; })
    ];

    allCourses.forEach(({ name, cr, grade, isZero }) => {
      if (grade === 'SKIP') return;
      const row = document.createElement('div');
      row.className = 'transcript-course';
      let gradeClass = '', gradeText = '';
      if (isZero) {
        gradeText = grade === 'S' ? 'S' : grade === 'U' ? 'U' : '—';
        gradeClass = grade === 'S' ? 'pass' : grade === 'U' ? 'fail' : 'empty';
      } else {
        gradeText = grade || 'FF';
        gradeClass = grade === '' ? 'empty' : '';
      }
      row.innerHTML = `
        <span class="transcript-course-name">${name}</span>
        <span class="transcript-course-cr">${isZero ? '—' : cr + 'cr'}</span>
        <span class="transcript-course-grade ${gradeClass}">${gradeText}</span>`;
      semDiv.appendChild(row);
    });
    wrap.appendChild(semDiv);
  });

  const cum = calcCumulative(semHistory);
  if (cum) {
    const cumDiv = document.createElement('div');
    cumDiv.className = 'transcript-cum' + (parseFloat(cum.val) < 2 ? ' danger' : '');
    cumDiv.innerHTML = `
      <div class="transcript-cum-left">
        <div class="label">Cumulative GPA</div>
        ${cum.honor ? `<div class="transcript-honor">${cum.honor}</div>` : ''}
      </div>
      <div class="transcript-cum-gpa">${cum.val}</div>`;
    wrap.appendChild(cumDiv);
  }

  renderTranscriptActions(wrap);
}

/**
 * Appends action buttons (Share, Copy, Export as Image) to a transcript container.
 * @param {HTMLElement} wrap - Container to append actions to
 */
function renderTranscriptActions(wrap) {
  const actions = document.createElement('div');
  actions.className = 'transcript-actions';
  actions.innerHTML = `
    <button class="transcript-btn" onclick="shareTranscript()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
      Share
    </button>
    <button class="transcript-btn" onclick="copyTranscript()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
      Copy
    </button>
    <button class="transcript-btn" id="exportImgBtn" onclick="exportAsImage()" style="grid-column:1/-1;border-color:#2a3a4a;color:var(--accent2);">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      Export as Image
    </button>`;
  wrap.appendChild(actions);
}

/**
 * Builds plain-text representation of the transcript for sharing or copying.
 * @returns {string} Multi-line string with transcript data
 */
function buildShareText() {
  const profiles = getAllProfiles();
  const name = activeProfileId && profiles[activeProfileId] ? profiles[activeProfileId].name : 'GPA';
  const presets = getCoursePresets();
  const electives = getElectivePresets();
  const lines = [`${activeDept} GPA — ${name}`, ``];
  SEM_ORDER.filter(([y, s]) => semHistory[y + '|' + s]).forEach(([year, sem]) => {
    const key = year + '|' + sem;
    const dataKey = activeDept + '|' + key;
    const yIdx = ['Year 1', 'Year 2', 'Year 3', 'Year 4'].indexOf(year) + 1;
    const semN = sem === 'Fall' ? 1 : 2;
    const saved = semData[dataKey] || [];
    const preset = [...(presets[key] || [])].sort((a, b) => b[1] - a[1]);
    const elects = electives[key] || [];
    lines.push(`── Year ${yIdx} · Semester ${semN}  (GPA: ${semHistory[key].gpa.toFixed(2)}) ──`);
    const allCourses = [
      ...preset.map((c, i) => ({ name: c[0], cr: c[1], grade: saved[i]?.grade || '', isZero: c[1] === 0 })),
      ...elects.map((nm, j) => { const idx = preset.length + j; return { name: nm, cr: saved[idx]?.credits || 3, grade: saved[idx]?.grade || '', isZero: false }; })
    ];
    allCourses.forEach(({ name, cr, grade, isZero }) => {
      if (grade === 'SKIP') return;
      const g = isZero ? (grade || '—') : (grade || 'FF');
      lines.push(`${g.padEnd(3)}  ${isZero ? '—  ' : (String(cr) + 'cr')}  ${name}`);
    });
    lines.push('');
  });
  const cum = calcCumulative(semHistory);
  if (cum) { lines.push(`Cumulative GPA: ${cum.val}`); if (cum.honor) lines.push(cum.honor); }
  return lines.join('\n');
}

/**
 * Shares transcript text using Web Share API if available, otherwise copies to clipboard.
 */
function shareTranscript() {
  const text = buildShareText();
  if (navigator.share) { navigator.share({ title: 'GPA Transcript', text }).catch(() => { }); }
  else { copyTranscript(); }
}
/**
 * Copies transcript text to clipboard.
 */
function copyTranscript() {
  const text = buildShareText();
  if (navigator.clipboard) { navigator.clipboard.writeText(text).then(() => showToast('Copied ✓', 2000)); }
  else {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Copied ✓', 2000);
  }
}

// Image export & Share
window._lastExportDataUrl = null;
window._lastExportBlobPromise = null;

/**
 * Shares the last exported image via Android bridge (if available).
 */
function shareImage() {
  if (!window._lastExportDataUrl) { showToast('No image to share. Export first.'); return; }
  try {
    Android.shareImage(window._lastExportDataUrl, window._lastExportName || 'GPA_Transcript.png');
  } catch (e) { showToast('Share failed'); }
}

/**
 * Saves the last exported image via Android bridge (if available).
 */
function downloadImg() {
  if (!window._lastExportDataUrl) { showToast('No image to save'); return; }
  try {
    Android.saveImage(window._lastExportDataUrl, window._lastExportName || 'GPA_Transcript.png');
  } catch (e) { showToast('Save failed'); }
}

/**
 * Exports the current transcript as a PNG image using an offscreen canvas.
 * Displays the generated image in a modal overlay.
 */
async function exportAsImage() {
  const btn = document.getElementById('exportImgBtn');
  if (btn) { btn.textContent = 'Generating…'; btn.disabled = true; }

  try {
    // Wait for fonts to be ready
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    // Force-load DM Mono if FontFace API is available
    if (document.fonts && document.fonts.load) {
      await Promise.all([
        document.fonts.load('10px "DM Mono"'),
        document.fonts.load('bold 17px "DM Mono"'),
        document.fonts.load('600 10px "DM Mono"'),
      ]).catch(() => { });
    }

    const isLight = document.body.classList.contains('light');
    const BG = isLight ? '#f5f5f0' : '#0f0f0f', SURF = isLight ? '#ffffff' : '#1a1a1a', BOR = isLight ? '#dddbd0' : '#2e2e2e';
    const TEXT = isLight ? '#1a1a1a' : '#f0f0f0', ACC = isLight ? '#5a8a00' : '#c8f060', MUT = isLight ? '#888' : '#666';
    const SAVBG = isLight ? '#eef5e8' : '#1a2e1a';
    // Safe font stack: DM Mono with monospace fallback for Android
    const FONT = '"DM Mono",ui-monospace,"Courier New",monospace';

    const profiles = getAllProfiles();
    const profileName = activeProfileId && profiles[activeProfileId] ? profiles[activeProfileId].name : '—';
    const savedSems = SEM_ORDER.filter(([y, s]) => semHistory[y + '|' + s]);
    const cum = calcCumulative(semHistory);
    const presets = getCoursePresets();
    const electives = getElectivePresets();

    const SC = 2, W = 380, PAD = 22, INNER = W - PAD * 2;

    const semBlocks = [];
    savedSems.forEach(([year, sem]) => {
      const key = year + '|' + sem;
      const dataKey = activeDept + '|' + key;
      const yIdx = ['Year 1', 'Year 2', 'Year 3', 'Year 4'].indexOf(year) + 1;
      const semN = sem === 'Fall' ? 1 : 2;
      const savedD = semData[dataKey] || [];
      const preset = [...(presets[key] || [])].sort((a, b) => b[1] - a[1]);
      const elects = electives[key] || [];
      const courses = [
        ...preset.map((c, i) => ({ name: c[0], cr: c[1], grade: savedD[i]?.grade || '', isZero: c[1] === 0 })),
        ...elects.map((nm, j) => { const idx = preset.length + j; return { name: nm, cr: savedD[idx]?.credits || 3, grade: savedD[idx]?.grade || '', isZero: false }; })
      ].filter(c => c.grade !== 'SKIP');
      semBlocks.push({ yIdx, semN, key, courses });
    });

    let H = PAD + 14 + 6 + 22 + 10;
    semBlocks.forEach(b => { H += 18 + 7 + b.courses.length * (28 + 4) + 16; });
    if (cum) H += 54 + 12;
    H += 20 + PAD;

    // Cap canvas height to avoid OOM on low-memory Android devices
    const MAX_H = 16384;
    if (H * SC > MAX_H) { showToast('Too many semesters to export as image'); if (btn) { btn.textContent = 'Export as Image'; btn.disabled = false; } return; }

    const canvas = document.createElement('canvas');
    canvas.width = W * SC;
    canvas.height = H * SC;
    const ctx = canvas.getContext('2d');
    if (!ctx) { showToast('Canvas not supported on this device'); if (btn) { btn.textContent = 'Export as Image'; btn.disabled = false; } return; }
    ctx.scale(SC, SC);

    function rr(x, y, w, h, r, fill, stroke, sw) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h);
      ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = sw || 1; ctx.stroke(); }
    }
    function trunc(str, maxW) {
      if (ctx.measureText(str).width <= maxW) return str;
      while (str.length > 1 && ctx.measureText(str + '…').width > maxW) str = str.slice(0, -1);
      return str + '…';
    }

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    let y = PAD;

    ctx.font = `600 10px ${FONT}`;
    ctx.fillStyle = ACC;
    ctx.fillText(activeDept, PAD, y + 11);
    ctx.font = `10px ${FONT}`;
    ctx.fillStyle = MUT;
    const sub = 'GPA Calculator';
    ctx.fillText(sub, W - PAD - ctx.measureText(sub).width, y + 11);
    y += 14 + 6;

    ctx.font = `bold 17px ${FONT}`;
    ctx.fillStyle = TEXT;
    ctx.fillText(trunc(profileName, INNER), PAD, y + 17);
    y += 22 + 10;

    semBlocks.forEach(({ yIdx, semN, key, courses }) => {
      ctx.font = `500 9px ${FONT}`;
      ctx.fillStyle = MUT;
      ctx.fillText('YEAR ' + yIdx + ' · SEM ' + semN, PAD, y + 12);
      ctx.font = `bold 13px ${FONT}`;
      ctx.fillStyle = ACC;
      const gStr = semHistory[key].gpa.toFixed(2);
      ctx.fillText(gStr, W - PAD - ctx.measureText(gStr).width, y + 12);
      y += 18 + 7;
      courses.forEach(({ name, cr, grade, isZero }) => {
        const g = isZero ? (grade === 'S' ? 'S' : grade === 'U' ? 'U' : '—') : (grade || 'FF');
        const gC = isZero ? (grade === 'S' ? '#80e080' : grade === 'U' ? '#e08080' : MUT) : (grade ? ACC : '#c06060');
        rr(PAD, y, INNER, 26, 5, SURF, BOR, 0.8);
        ctx.font = `bold 12px ${FONT}`;
        ctx.fillStyle = gC;
        ctx.fillText(g, PAD + 10, y + 17);
        ctx.font = `10px ${FONT}`;
        ctx.fillStyle = MUT;
        ctx.fillText(isZero ? '—' : cr + 'cr', PAD + 46, y + 17);
        ctx.font = `11px ${FONT}`;
        ctx.fillStyle = TEXT;
        ctx.fillText(trunc(name, INNER - 86 - 8), PAD + 84, y + 17);
        y += 28 + 4;
      });
      y += 16;
    });

    if (cum) {
      rr(PAD, y, INNER, 50, 8, SAVBG, '#2a3a1a', 1);
      ctx.font = `500 9px ${FONT}`;
      ctx.fillStyle = MUT;
      ctx.fillText('CUMULATIVE GPA', PAD + 12, y + 16);
      if (cum.honor) { ctx.font = `11px ${FONT}`; ctx.fillStyle = ACC; ctx.fillText(cum.honor, PAD + 12, y + 34); }
      ctx.font = `bold 24px ${FONT}`;
      ctx.fillStyle = ACC;
      ctx.fillText(cum.val, W - PAD - 12 - ctx.measureText(cum.val).width, y + 36);
      y += 54 + 12;
    }

    ctx.font = `9px ${FONT}`;
    ctx.fillStyle = MUT;
    const foot = 'Generated with GPA Calculator';
    ctx.fillText(foot, W / 2 - ctx.measureText(foot).width / 2, y + 13);

    // ── Generate output ──
    const dataUrl = canvas.toDataURL('image/png');
    window._lastExportDataUrl = dataUrl;
    window._lastExportName = activeDept + '_GPA_' + profileName.replace(/\s+/g, '_') + '.png';

    document.getElementById('overlayImg').src = dataUrl;
    document.getElementById('imgOverlay').style.display = 'flex';

  } catch (e) {
    console.error('Export failed:', e);
    showToast('Export failed: ' + (e.message || 'unknown error'));
  } finally {
    if (btn) { btn.textContent = 'Export as Image'; btn.disabled = false; }
  }
}

/**
 * Closes the image export overlay modal.
 */
function closeImgOverlay() {
  document.getElementById('imgOverlay').style.display = 'none';
}

// Touch Gestures for switching between Semesters
(function () {
  const SEM_FLAT = ["Year 1|Fall", "Year 1|Spring", "Year 2|Fall", "Year 2|Spring", "Year 3|Fall", "Year 3|Spring", "Year 4|Fall", "Year 4|Spring"];
  function currentFlatIdx() { return SEM_FLAT.indexOf(document.getElementById('yearSel').value + '|' + document.getElementById('semSel').value); }
  function goToFlat(idx) {
    if (idx < 0 || idx >= SEM_FLAT.length) return;
    const [year, sem] = SEM_FLAT[idx].split('|');
    document.getElementById('yearSel').value = year;
    document.getElementById('semSel').value = sem;
    switchSemester();
    updateSwipeDots();
  }
  window.updateSwipeDots = function () {
    const wrap = document.getElementById('swipeDots');
    if (!wrap) return;
    const cur = currentFlatIdx();
    wrap.innerHTML = '';
    SEM_FLAT.forEach((_, i) => {
      const d = document.createElement('span');
      d.className = 'swipe-dot' + (i === cur ? ' active' : '');
      wrap.appendChild(d);
    });
  };
  let tx0 = 0, ty0 = 0, swiping = false;
  const area = document.getElementById('calcScrollArea');
  area.addEventListener('touchstart', e => { tx0 = e.touches[0].clientX; ty0 = e.touches[0].clientY; swiping = true; }, { passive: true });
  area.addEventListener('touchmove', e => {
    if (!swiping) return;
    if (Math.abs(e.touches[0].clientX - tx0) > Math.abs(e.touches[0].clientY - ty0) * 1.5 && Math.abs(e.touches[0].clientX - tx0) > 30) e.preventDefault();
  }, { passive: false });
  area.addEventListener('touchend', e => {
    if (!swiping) return;
    swiping = false;
    const dx = e.changedTouches[0].clientX - tx0;
    const dy = e.changedTouches[0].clientY - ty0;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) goToFlat(dx < 0 ? currentFlatIdx() + 1 : currentFlatIdx() - 1);
  }, { passive: true });
})();
