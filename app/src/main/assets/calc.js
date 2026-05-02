// Grades exists before there is a profile
let _pendingSave = null; // {key, dept} set when user tries to save without a profile

function flushPendingSave(){
  if(!_pendingSave || !activeProfileId) return;
  const {key, dept, snap} = _pendingSave;
  _pendingSave = null;
  // Inject the grades to newly added profile
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
  showScreen('calc');
}

// Calculation Helpers
function recalculate(){
  let pts=0,cr=0;
  const wiForSem = whatIfMode ? (whatIfGradesBySem[activeKey]||{}) : null;
  document.querySelectorAll('.course-row').forEach((row,i)=>{
    if(row.dataset.zeroCr==='1') return;
    const c=parseInt(row.dataset.credits)||0;
    // In what-if mode, use the what-if override for this row if present
    const g = (wiForSem && wiForSem[i] !== undefined)
      ? wiForSem[i]
      : row.querySelector('.grade-select').value;
    if(g==='SKIP') return;
    pts+=(GRADE_POINTS[g]??0.0)*c; cr+=c;
  });
  document.getElementById('semGpa').textContent    = cr>0?(pts/cr).toFixed(2):'—';
  document.getElementById('semCredits').textContent = cr>0?cr+' credits':'';
  // Purple tint on sem GPA banner when what-if is active
  const semBanner = document.querySelector('#calcScreen .banner:not(.cum)');
  if(semBanner) semBanner.classList.toggle('whatif-active', whatIfMode);
}

function saveSemester(){
  if(whatIfMode){showToast('Exit What-If mode first');return;}
  if(!activeProfileId){
    // Snapshot current grades, so that they won't disappear in semester changes.
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
  semHistory[activeKey]={gpa:pts/cr,credits:cr};
  persistToProfile(); updateHistoryStrip(); updateCumulative();
  showToast('Semester saved ✓');
}

// What-if (Retake)
// whatIfGradesBySem: { semKey: { rowIndex: gradeValue } }
// realSnapshotBySem: { semKey: { rowIndex: gradeValue } }
let whatIfMode=false;
let whatIfGradesBySem={};   // what-if overrides, keyed by semKey then row index
let realSnapshotBySem={};   // real grades snapshotted per sem when what-if was entered

Object.defineProperty(window,'whatIfGrades',{get:()=>whatIfGradesBySem[activeKey]||{},set:()=>{}});
Object.defineProperty(window,'realGradeSnapshot',{get:()=>realSnapshotBySem[activeKey]||{},set:()=>{}});

function _snapshotCurrentSem(){
  // Capture the real (DOM) grades for the current semester into realSnapshotBySem
  if(!realSnapshotBySem[activeKey]) realSnapshotBySem[activeKey]={};
  document.querySelectorAll('.course-row:not(.zero-cr) .grade-select').forEach((sel,i)=>{
    realSnapshotBySem[activeKey][i]=sel.value;
  });
}

function toggleWhatIf(){
  whatIfMode=!whatIfMode;
  document.getElementById('whatifToggle').classList.toggle('on',whatIfMode);
  document.getElementById('whatifBar').classList.toggle('active',whatIfMode);
  if(!whatIfMode){
    // Restore all DOM selects to real grades for this sem
    const snap=realSnapshotBySem[activeKey]||{};
    document.querySelectorAll('.course-row:not(.zero-cr) .grade-select').forEach((sel,i)=>{
      const real=snap[i]??'';
      sel.value=real;
      sel.classList.remove('whatif-grade');
      sel.classList.toggle('has-grade',real!==''&&real!=='SKIP');
      sel.parentElement.classList.remove('whatif-changed');
      sel.parentElement.classList.toggle('graded',real!==''&&real!=='SKIP');
      if(sel._realOnchange) sel.onchange=sel._realOnchange;
    });
    whatIfGradesBySem={}; realSnapshotBySem={};
    recalculate(); updateCumulative();
  } else {
    _snapshotCurrentSem();
    attachWhatIfListeners();
    _applyWhatIfToDOM();
    updateWhatIf();
  }
}

// Apply stored what-if grades for the current sem back to the DOM selects
function _applyWhatIfToDOM(){
  const wi=whatIfGradesBySem[activeKey]||{};
  document.querySelectorAll('.course-row:not(.zero-cr) .grade-select').forEach((sel,i)=>{
    if(wi[i]!==undefined){
      sel.value=wi[i];
      sel.classList.add('whatif-grade');
      sel.parentElement.classList.add('whatif-changed');
      sel.classList.toggle('has-grade',wi[i]!=='');
      sel.parentElement.classList.toggle('graded',wi[i]!==''&&wi[i]!=='SKIP');
    } else {
      sel.classList.remove('whatif-grade');
      sel.parentElement.classList.remove('whatif-changed');
    }
  });
}

function attachWhatIfListeners(){
  document.querySelectorAll('.course-row:not(.zero-cr) .grade-select').forEach((sel,i)=>{
    if(!sel._realOnchange) sel._realOnchange=sel.onchange;
    sel.onchange=()=>{
      sel.classList.toggle('has-grade',sel.value!=='');
      sel.parentElement.classList.toggle('graded',sel.value!==''&&sel.value!=='SKIP');
      if(whatIfMode){
        if(!whatIfGradesBySem[activeKey]) whatIfGradesBySem[activeKey]={};
        whatIfGradesBySem[activeKey][i]=sel.value;
        sel.classList.add('whatif-grade');
        sel.parentElement.classList.add('whatif-changed');
        recalculate();
        updateWhatIf();
      } else { sel._realOnchange&&sel._realOnchange(); }
    };
  });
}

// Called when switching semesters in what-if mode — saves current sem's what-if state,
// resets DOM to real grades for the NEW semester, then reapplies any saved what-if overrides
function _onWhatIfSemSwitch(){
  if(!whatIfMode) return;
  // Snapshot real grades for the newly-loaded semester
  _snapshotCurrentSem();
  // Reattach listeners for the new DOM
  attachWhatIfListeners();
  // Apply any previously stored what-if overrides for this semester
  _applyWhatIfToDOM();
  recalculate();
  updateWhatIf();
}

function updateWhatIf(){
  // Current Semester What-If GPA
  const wiForSem=whatIfGradesBySem[activeKey]||{};
  const snap=realSnapshotBySem[activeKey]||{};
  const rows=document.querySelectorAll('.course-row:not(.zero-cr)');
  let wiPts=0,wiCr=0,realPts=0,realCr=0;
  rows.forEach((row,i)=>{
    const credits=parseInt(row.dataset.credits)||0;
    const wiGrade=wiForSem[i]!==undefined?wiForSem[i]:row.querySelector('.grade-select').value;
    const realGrade=snap[i]??'';
    if(wiGrade!==''&&wiGrade!=='SKIP'){wiPts+=(GRADE_POINTS[wiGrade]??0)*credits;wiCr+=credits;}
    if(realGrade!==''&&realGrade!=='SKIP'){realPts+=(GRADE_POINTS[realGrade]??0)*credits;realCr+=credits;}
  });
  const wiSemGpa=wiCr>0?wiPts/wiCr:null;
  const realSemGpa=realCr>0?realPts/realCr:null;
  document.getElementById('whatifGpa').textContent=wiSemGpa!==null?wiSemGpa.toFixed(2):'—';

  const deltaEl=document.getElementById('whatifDelta');
  if(wiSemGpa!==null&&realSemGpa!==null){
    const diff=wiSemGpa-realSemGpa;
    if(Math.abs(diff)<0.005){deltaEl.textContent='No change';deltaEl.className='whatif-delta same';}
    else if(diff>0){deltaEl.textContent=`▲ +${diff.toFixed(2)} from current`;deltaEl.className='whatif-delta up';}
    else{deltaEl.textContent=`▼ ${diff.toFixed(2)} from current`;deltaEl.className='whatif-delta down';}
  } else { deltaEl.textContent=''; }

  // Cum. GPA across all semesters
  // Start from saved semHistory, then overlay what-if overrides for each touched semester
  let cumWiPts=0,cumWiCr=0,cumRealPts=0,cumRealCr=0;
  const allKeys=Object.keys(semHistory);

  allKeys.forEach(key=>{
    const hist=semHistory[key];
    // Real cumulative contribution
    cumRealPts+=hist.gpa*hist.credits; cumRealCr+=hist.credits;

    const wiOverrides=whatIfGradesBySem[key];
    if(wiOverrides&&Object.keys(wiOverrides).length){
      // Rebuild GPA for this semester using what-if overrides merged with real semData
      const dataKey=activeDept+'|'+key;
      const saved=semData[dataKey]||[];
      const preset=[...(getCoursePresets()[key]||[])].sort((a,b)=>b[1]-a[1]);
      const elects=getElectivePresets()[key]||[];
      let sWiPts=0,sWiCr=0;
      let rowIdx=0;
      preset.forEach(([,cr])=>{
        if(cr===0){rowIdx++;return;}
        const g=wiOverrides[rowIdx]!==undefined?wiOverrides[rowIdx]:(saved[rowIdx]?.grade||'');
        if(g!==''&&g!=='SKIP'){sWiPts+=(GRADE_POINTS[g]??0)*cr;sWiCr+=cr;}
        rowIdx++;
      });
      elects.forEach((_,j)=>{
        const idx=preset.length+j;
        const cr=saved[idx]?.credits||3;
        const g=wiOverrides[idx]!==undefined?wiOverrides[idx]:(saved[idx]?.grade||'');
        if(g!==''&&g!=='SKIP'){sWiPts+=(GRADE_POINTS[g]??0)*cr;sWiCr+=cr;}
        rowIdx++;
      });
      if(sWiCr>0){cumWiPts+=sWiPts;cumWiCr+=sWiCr;}
      else{cumWiPts+=hist.gpa*hist.credits;cumWiCr+=hist.credits;}
    } else {
      cumWiPts+=hist.gpa*hist.credits;cumWiCr+=hist.credits;
    }
  });

  // Also factor in current semester if it's NOT in semHistory yet (unsaved)
  // The current-sem what-if contribution is already reflected in wiSemGpa above,
  // but for the cumulative we need to handle it separately if unsaved
  if(!semHistory[activeKey]&&wiSemGpa!==null){
    cumWiPts+=wiSemGpa*wiCr;cumWiCr+=wiCr;
    cumRealPts+=realSemGpa!==null?realSemGpa*realCr:0;cumRealCr+=realSemGpa!==null?realCr:0;
  }

  const cumWiGpa=cumWiCr>0?cumWiPts/cumWiCr:null;
  const cumRealGpa=cumRealCr>0?cumRealPts/cumRealCr:null;
  updateCumulative(cumWiGpa);
}

function resetWhatIf(){
  // Clear what-if overrides for the current semester only
  delete whatIfGradesBySem[activeKey];
  const snap=realSnapshotBySem[activeKey]||{};
  document.querySelectorAll('.course-row:not(.zero-cr) .grade-select').forEach((sel,i)=>{
    const real=snap[i]??'';
    sel.value=real;
    sel.classList.remove('whatif-grade');
    sel.classList.toggle('has-grade',real!==''&&real!=='SKIP');
    sel.parentElement.classList.remove('whatif-changed');
    sel.parentElement.classList.toggle('graded',real!==''&&real!=='SKIP');
  });
  recalculate();
  updateWhatIf();
}

// Target GPA
function openTargetModal(){
  const cum=calcCumulative(semHistory);
  document.getElementById('targetModalDesc').textContent=cum
    ?`Current cumulative: ${cum.val} across ${Object.keys(semHistory).length} semester(s)`
    :'No semesters saved yet — result will be for first semester.';
  document.getElementById('targetInput').value='';
  document.getElementById('targetResult').innerHTML='';
  document.getElementById('targetModal').classList.add('open');
  setTimeout(()=>document.getElementById('targetInput').focus(),100);
}
function closeTargetModal(){ document.getElementById('targetModal').classList.remove('open'); }

function calcTarget(){
  const targetGpa=parseFloat(document.getElementById('targetInput').value);
  const res=document.getElementById('targetResult');
  if(isNaN(targetGpa)||targetGpa<0||targetGpa>4){
    res.innerHTML='<span style="color:#e08080;">Enter a GPA between 0.00 and 4.00</span>';
    return;
  }
  const keys=Object.keys(semHistory);
  let earnedPts=0,earnedCr=0;
  keys.forEach(k=>{earnedPts+=semHistory[k].gpa*semHistory[k].credits;earnedCr+=semHistory[k].credits;});
  const curGpa=earnedCr>0?earnedPts/earnedCr:null;
  const presets=getCoursePresets(); const electives=getElectivePresets();

  function nextCrCount(){
    const nk=SEM_ORDER.map(([y,s])=>y+'|'+s).filter(k=>!semHistory[k])[0]||null;
    if(!nk) return 15;
    const np=(presets[nk]||[]).filter(([,c])=>c>0);
    const ne=(electives[nk]||[]).length;
    return np.reduce((s,[,c])=>s+c,0)+ne*3||15;
  }

  if(curGpa!==null&&targetGpa<curGpa){
    const nc=nextCrCount();
    const minNeeded=(targetGpa*(earnedCr+nc)-earnedPts)/nc;
    const gps2=Object.entries({AA:4.0,BA:3.5,BB:3.0,CB:2.5,CC:2.0,DC:1.5,DD:1.0,FD:0.5,FF:0.0});
    if(minNeeded<=0){
      res.innerHTML=`<span class="target-already">✓ Current GPA: <b>${curGpa.toFixed(2)}</b> — above your floor of ${targetGpa.toFixed(2)}.<br>Even a 0.00 next semester won't drop you below it.</span>`;
    } else {
      const safe=gps2.filter(([,p])=>p>=minNeeded).sort((a,b)=>a[1]-b[1])[0];
      res.innerHTML=`<span class="target-achievable">✓ Current GPA: <b>${curGpa.toFixed(2)}</b> — above your floor of ${targetGpa.toFixed(2)}.<br>`
        +`Min next semester GPA to stay above: <b>${minNeeded.toFixed(2)}</b><br>`
        +`Lowest safe grade: <b>${safe?safe[0]:'AA'}</b> overall (based on ~${nc} credits)</span>`;
    }
    return;
  }
  if(curGpa!==null&&Math.abs(targetGpa-curGpa)<0.005){
    res.innerHTML=`<span class="target-already">✓ You're exactly at ${curGpa.toFixed(2)} — your target!</span>`;
    return;
  }
  const nc=nextCrCount();
  const neededGpa=(targetGpa*(earnedCr+nc)-earnedPts)/nc;
  if(neededGpa>4.0){
    const sems=4-targetGpa>0.001?Math.ceil((targetGpa*earnedCr-earnedPts)/(nc*(4-targetGpa))):Infinity;
    res.innerHTML=`<span class="target-impossible">Not reachable in 1 semester at max GPA (4.00).<br>`
      +(sems!==Infinity?`Needs ~${sems} semester(s) of straight AA grades.`:`A 4.00 target requires perfect scores in all remaining courses.`)+'</span>';
  } else if(neededGpa<0){
    res.innerHTML=`<span class="target-already">✓ Already on track — even a 0.00 next semester keeps you above ${targetGpa.toFixed(2)}.</span>`;
  } else {
    const gps=Object.entries({AA:4.0,BA:3.5,BB:3.0,CB:2.5,CC:2.0,DC:1.5,DD:1.0,FD:0.5,FF:0.0});
    const closest=gps.reduce((best,[g,p])=>Math.abs(p-neededGpa)<Math.abs(best[1]-neededGpa)?[g,p]:best);
    res.innerHTML=`<span class="target-achievable">Next semester GPA needed: <b>${neededGpa.toFixed(2)}</b><br>`
      +`Roughly equivalent to: <b>${closest[0]}</b> grades overall<br>`
      +`(based on ~${nc} credits next semester)</span>`;
  }
}
