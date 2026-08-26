// ── pending save (grades entered before a profile exists) ─────
let _pendingSave = null; // {key, dept} set when user tries to save without a profile

function flushPendingSave(){
  if(!_pendingSave || !activeProfileId) return;
  const {key, dept, snap} = _pendingSave;
  _pendingSave = null;
  // Inject the snapshotted grades into the now-active profile's semData
  if(snap && snap.length) semData[dept+'|'+key] = snap;
  // Switch context back to where the user was
  activeDept = dept;
  document.getElementById('deptSel').value = dept;
  activeKey = key;
  const [year, sem] = key.split('|');
  document.getElementById('yearSel').value = year;
  document.getElementById('semSel').value  = sem;
  loadCourses();   // renders grades from semData
  saveSemester();  // computes GPA and saves to semHistory
  if(typeof grSyncScaleToDept==='function') grSyncScaleToDept();
  showScreen('calc');
}

// ── calculation helpers ───────────────────────────────────────
function recalculate(){
  let pts=0,cr=0;
  document.querySelectorAll('.course-row').forEach(row=>{
    if(row.dataset.zeroCr==='1') return;
    const c=parseInt(row.dataset.credits)||0;
    const g=row.querySelector('.grade-select').value;
    if(g==='SKIP') return;
    pts+=(GRADE_POINTS[g]??0.0)*c; cr+=c;
  });
  const semGpaEl=document.getElementById('semGpa');
  if(cr>0) animateNumber(semGpaEl,pts/cr); else semGpaEl.textContent='—';
  document.getElementById('semCredits').textContent = cr>0?cr+' credits':'';
}

function saveSemester(){
  if(!activeProfileId){
    const snap=[];
    document.querySelectorAll('.course-row').forEach(row=>{
      const gradeEl=row.querySelector('.grade-select');
      const credEl =row.querySelector('.spin-val');
      const isElect=row.classList.contains('elective');
      snap.push({grade:gradeEl?gradeEl.value:'',credits:isElect?parseInt(credEl.textContent):parseInt(row.dataset.credits),elective:isElect});
    });
    _pendingSave={key:activeKey,dept:activeDept,snap};
    showToast('Create or load a profile first!');
    showScreen('profiles');
    return;
  }
  persist(activeKey);
  let pts=0,cr=0;
  document.querySelectorAll('.course-row').forEach(row=>{
    if(row.dataset.zeroCr==='1') return;
    const c=parseInt(row.dataset.credits)||0;
    const g=row.querySelector('.grade-select').value;
    if(g==='SKIP') return;
    pts+=(GRADE_POINTS[g]??0.0)*c; cr+=c;
  });
  if(cr===0) return;
  const gpa=pts/cr;
  semHistory[activeKey]={gpa,credits:cr};
  persistToProfile(); updateHistoryStrip(); updateCumulative();
  showToast('Semester saved ✓');
  if(typeof launchConfetti==='function'){
    if(gpa>=3.5) launchConfetti('gold');
    else if(gpa>=3.0) launchConfetti('normal');
  }
}
