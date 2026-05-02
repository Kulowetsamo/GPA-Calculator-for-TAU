// ── screen / history ──────────────────────────────────────────
let _currentScreen='calc';

function showScreen(name,fromPopState){
  // Close image overlay if open
  const ov=document.getElementById('imgOverlay');
  if(ov) ov.style.display='none';

  // Close any open modals
  ['newProfileModal','deleteModal','resetModal','renameModal','targetModal'].forEach(id=>{
    document.getElementById(id)?.classList.remove('open');
  });

  document.getElementById('calcScreen').classList.toggle('active',name==='calc');
  document.getElementById('gradeScreen').classList.toggle('active',name==='grade');
  document.getElementById('transcriptScreen').classList.toggle('active',name==='transcript');
  document.getElementById('profileScreen').classList.toggle('active',name==='profiles');
  document.getElementById('navCalc').classList.toggle('active',name==='calc');
  document.getElementById('navGrade').classList.toggle('active',name==='grade');
  document.getElementById('navTranscript').classList.toggle('active',name==='transcript');
  document.getElementById('navProfiles').classList.toggle('active',name==='profiles');
  if(name==='profiles')   renderProfileList();
  if(name==='transcript') renderTranscript();
  if(name==='grade')      initGradeScreen();

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
}

function onYearChange(){
  document.getElementById('semSel').value='Fall';
  switchSemester();
}

function switchSemester(){
  persist(activeKey);
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
window.handleBackButton = function(){
  // 1. Image overlay open → close it
  const ov = document.getElementById('imgOverlay');
  if(ov && ov.style.display !== 'none'){
    ov.style.display = 'none';
    return true;
  }
  // 2. Any modal open → close it
  const modals = ['newProfileModal','deleteModal','resetModal','renameModal','targetModal'];
  const grModals = ['grSaveModal','grDeleteModal','grRenameModal','grSaveCourseModal'];
  const openGrModal = grModals.find(id => document.getElementById(id)?.classList.contains('open'));
  if(openGrModal){ document.getElementById(openGrModal).classList.remove('open'); return true; }
  const openModal = modals.find(id => document.getElementById(id)?.classList.contains('open'));
  if(openModal){
    document.getElementById(openModal).classList.remove('open');
    return true;
  }
  // 3. Not on calc tab → go to calc
  if(_currentScreen !== 'calc'){
    showScreen('calc');
    return true;
  }
  // 4. Already on calc → let Android exit the app
  return false;
};


loadTheme();
loadActiveProfile();
loadCourses();
updateSwipeDots();
// Establish the calc sentinel as the base history entry
history.replaceState({screen:'calc'},'','');