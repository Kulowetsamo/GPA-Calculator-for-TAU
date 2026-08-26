// ── screen / history ──────────────────────────────────────────
let _currentScreen='calc';

function showScreen(name,fromPopState){
  // Close image overlay if open
  const ov=document.getElementById('imgOverlay');
  if(ov) ov.style.display='none';

  // Close any open modals
<<<<<<< HEAD
  ['newProfileModal','deleteModal','resetModal','renameModal','addExamModal'].forEach(id=>{
=======
  ['newProfileModal','deleteModal','resetModal','renameModal','targetModal','addExamModal'].forEach(id=>{
>>>>>>> 7a9e9ed77c984f1d9e044c5cb07a69927b807f2d
    document.getElementById(id)?.classList.remove('open');
  });

  document.getElementById('calcScreen').classList.toggle('active',name==='calc');
  document.getElementById('gradeScreen').classList.toggle('active',name==='grade');
  document.getElementById('transcriptScreen').classList.toggle('active',name==='transcript');
  document.getElementById('profileScreen').classList.toggle('active',name==='profiles');
  document.getElementById('examsScreen')?.classList.toggle('active',name==='exams');
  document.getElementById('navCalc').classList.toggle('active',name==='calc');
  document.getElementById('navGrade').classList.toggle('active',name==='grade');
  document.getElementById('navTranscript').classList.toggle('active',name==='transcript');
  document.getElementById('navProfiles').classList.toggle('active',name==='profiles');
  document.getElementById('navExams')?.classList.toggle('active',name==='exams');
  if(name==='profiles')   renderProfileList();
  if(name==='transcript') renderTranscript();
  if(name==='grade')      initGradeScreen();
  if(name==='exams')      renderExamsScreen();

  if(!fromPopState){
    if(name==='calc'){
      // Going to calc: pop back to the sentinel (one entry in stack)
      // replaceState so the sentinel IS the calc entry
      history.replaceState({screen:'calc'},'','');
    } else {
      // Going to a non-calc screen: push on top of sentinel
      // so back button always lands on sentinel → calc
      if(_currentScreen==='calc'){
        history.pushState({screen:name},'','');
      } else {
        // Switching between non-calc screens: replace current entry
        history.replaceState({screen:name},'','');
      }
    }
  }
  _currentScreen=name;
}

window.addEventListener('popstate',function(e){
  const screen=(e.state&&e.state.screen)||'calc';

  // Image overlay back
  const ov=document.getElementById('imgOverlay');
  if(ov&&ov.style.display!=='none'){
    ov.style.display='none';
    _currentScreen='transcript';
    return;
  }

  if(screen==='calc'){
    // Arrived at sentinel — show calc
    showScreen('calc',true);
  } else {
    // Some other state (e.g. imgOverlay pushed state) — go to calc
    showScreen('calc',true);
    // Replace whatever state we landed on with calc sentinel
    history.replaceState({screen:'calc'},'','');
  }
});

// ── semester navigation ───────────────────────────────────────
function currentKey(){ return document.getElementById('yearSel').value+'|'+document.getElementById('semSel').value; }

function onDeptChange(){
  if (activeProfileId) {
    document.getElementById('deptSel').value = activeDept;
    return;
  }
  persist(activeKey);
  activeDept=document.getElementById('deptSel').value;
  persistToProfile();
  loadCourses();
  if(window.updateSwipeDots) updateSwipeDots();
  if(typeof grSyncScaleToDept==='function') grSyncScaleToDept();
}

function updateSummerOptionState(){
  const yearSel=document.getElementById('yearSel');
  const semSel=document.getElementById('semSel');
  const summerOpt=document.getElementById('summerOpt');
  if(!yearSel||!semSel||!summerOpt) return;
  const isYear4=yearSel.value==='Year 4';
  summerOpt.disabled=isYear4;
  summerOpt.hidden=isYear4;
  if(isYear4 && semSel.value==='Summer') semSel.value='Fall';
}

function onYearChange(){
  document.getElementById('semSel').value='Fall';
  updateSummerOptionState();
  switchSemester();
}

function switchSemester(){
  persist(activeKey);
  updateSummerOptionState();
  activeKey=currentKey();
  loadCourses();
  if(window.updateSwipeDots) updateSwipeDots();
}

// ── profile actions ───────────────────────────────────────────
function loadProfile(id){
  persist(activeKey); persistToProfile();
  setActiveProfileId(id);
  loadActiveProfile();
  document.getElementById('deptSel').value=activeDept;
  loadCourses(); updateHistoryStrip(); updateCumulative(); renderProfileList();
  if(typeof flushPendingSave==='function') flushPendingSave();
}

// ── Android back button bridge ────────────────────────────────
const _OVERLAY_IDS=['newProfileModal','deleteModal','resetModal','renameModal',
  'addCourseModal','tplPickModal','addExamModal','gpaEiModal',
  'grSaveModal','grDeleteModal','grRenameModal','grSaveCourseModal'];

function overlayOpen(){
  const ov=document.getElementById('imgOverlay');
  if(ov&&ov.style.display!=='none') return true;
  return _OVERLAY_IDS.some(id=>{
    const m=document.getElementById(id);
    return m&&(m.classList.contains('open')||m.style.display==='flex');
  })||!!document.querySelector('.course-picker-overlay.open');
}

// Close the topmost overlay / modal. Returns true if something was closed.
function closeTopOverlay(){
  const ov=document.getElementById('imgOverlay');
  if(ov&&ov.style.display!=='none'){ ov.style.display='none'; return true; }
  for(const id of _OVERLAY_IDS){
    const m=document.getElementById(id);
    if(!m) continue;
    if(m.style.display==='flex'){
      if(id==='gpaEiModal'&&typeof gpaEiCloseModal==='function'){ gpaEiCloseModal(); }
      else{ m.style.display='none'; }
      return true;
    }
    if(m.classList.contains('open')){ m.classList.remove('open'); return true; }
  }
  const picker=document.querySelector('.course-picker-overlay.open');
  if(picker){ picker.classList.remove('open'); return true; }
  // Exams course detail → back to its semester list
  if(_currentScreen==='exams'&&typeof exViewCourse!=='undefined'&&exViewCourse){ closeExamCourse(); return true; }
  return false;
}

window.handleBackButton = function(){
  if(closeTopOverlay()) return true;
  if(_currentScreen !== 'calc'){
    showScreen('calc');
    return true;
  }
  return false;
};

// ── keyboard controls (desktop) ───────────────────────────────
document.addEventListener('keydown',function(e){
  const t=document.activeElement;
  const typing=t&&(t.tagName==='INPUT'||t.tagName==='SELECT'||t.tagName==='TEXTAREA'||t.isContentEditable);

  // Esc: close topmost overlay, else head back to Calc
  if(e.key==='Escape'){
    if(closeTopOverlay()){ e.preventDefault(); return; }
    if(!typing&&_currentScreen!=='calc') showScreen('calc');
    return;
  }

  if(typing||e.ctrlKey||e.metaKey||e.altKey) return;
  if(e.key.startsWith('Arrow')){
    if(overlayOpen()) return;
    const dir=e.key==='ArrowRight'?1:-1;
    if(_currentScreen==='calc'&&window.calcSemNav){ window.calcSemNav(dir); }
    else if(_currentScreen==='exams'&&typeof examsSemNav==='function'){ examsSemNav(dir); }
    return;
  }
  if(overlayOpen()) return;

  // 1-5: jump between tabs
  const tabMap=['calc','grade','transcript','exams','profiles'];
  if(e.key>='1'&&e.key<='5'&&!isNaN(+e.key)){ showScreen(tabMap[+e.key-1]); return; }

  // T: toggle theme
  if(e.key==='t'||e.key==='T'){ toggleTheme(); return; }

  // Transcript shortcuts
  if(_currentScreen==='transcript'){
    if(e.key==='p'||e.key==='P'){ if(typeof printTranscript==='function') printTranscript(); }
    else if(e.key==='c'||e.key==='C'){ if(typeof copyTranscript==='function') copyTranscript(); }
  }
});


loadTheme();
loadActiveProfile();
updateSummerOptionState();
loadCourses();
updateSwipeDots();
history.replaceState({screen:'calc'},'','');