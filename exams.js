// ── Exams tab ─────────────────────────────────────────────────
// examData (declared in storage.js) is an array of entries scoped to the
// active profile and persisted via persistToProfile(), same as semData.
// Entry shape:
// { id, dept, semKey, courseName, courseIndex, credits,
//   type, score, maxScore, weight, date }

const EXAM_TYPES = ['Midterm','Final','Quiz','Homework','Project','Other'];

function _examId(){ return 'ex_'+Date.now()+'_'+Math.floor(Math.random()*1000); }

// courses eligible for exam-tracking: required (non-elective, non-zero-credit)
// courses for the profile's department, across every semester, in the same
// order loadCourses() uses so courseIndex lines up with semData rows.
function getPresetsForDept(dept){ return dept==='IENG'?IENG_PRESETS:dept==='FE'?FE_PRESETS:CNGB_PRESETS; }
function getElectivesForDept(dept){ return dept==='IENG'?IENG_ELECTIVES:dept==='FE'?FE_ELECTIVES:CNGB_ELECTIVES; }

function buildExamCourseOptions(){
  if(!activeProfileId) return [];
  const dept=activeDept;
  const presets=getPresetsForDept(dept);
  const opts=[];
  SEM_ORDER.forEach(([year,sem])=>{
    const key=year+'|'+sem;
    const preset=presets[key]||[];
    const sorted=[...preset].sort((a,b)=>b[1]-a[1]);
    sorted.forEach(([name,credits],idx)=>{
      if(credits>0) opts.push({name,semKey:key,courseIndex:idx,credits,semLabel:year+' · '+sem,dept});
    });
  });
  return opts;
}

function ensureSemDataArrayForDept(dept,key){
  const dataKey=dept+'|'+key;
  if(semData[dataKey]) return semData[dataKey];
  const preset=getPresetsForDept(dept)[key]||[];
  const elects=getElectivesForDept(dept)[key]||[];
  const sorted=[...preset].sort((a,b)=>b[1]-a[1]);
  const arr=sorted.map(([,credits])=>({grade:'',credits,elective:false}));
  elects.forEach(()=>arr.push({grade:'',credits:3,elective:true}));
  semData[dataKey]=arr;
  return arr;
}

function recomputeSemHistoryFromData(dept,key){
  const arr=semData[dept+'|'+key]||[];
  let pts=0,cr=0;
  arr.forEach(e=>{
    if(!e) return;
    const c=e.credits||0, g=e.grade;
    if(!g||g==='SKIP') return;
    pts+=(GRADE_POINTS[g]??0)*c; cr+=c;
  });
  if(cr>0) semHistory[key]={gpa:pts/cr,credits:cr};
}

// ── percent → letter estimate ───────────────────────────────────
function pctToPoints(pct){
  if(pct>=90) return 4.0;
  if(pct>=85) return 3.5;
  if(pct>=80) return 3.0;
  if(pct>=75) return 2.5;
  if(pct>=70) return 2.0;
  if(pct>=65) return 1.5;
  if(pct>=60) return 1.0;
  if(pct>=50) return 0.5;
  return 0.0;
}
function pointsToGradeForDept(points,dept){
  const codes=(DEPT_GRADE_CODES[dept]||DEPT_GRADE_CODES.CNGB).filter(c=>c!=='SKIP');
  let best=codes[0],bestDiff=Infinity;
  codes.forEach(c=>{
    const diff=Math.abs((GRADE_POINTS[c]??0)-points);
    if(diff<bestDiff){bestDiff=diff;best=c;}
  });
  return best;
}
function pctToGrade(pct,dept){
  // Prefer the user's customizable scale from the Grade tab (gr_calc.js),
  // which is stored per-department in localStorage and may have been
  // edited away from the app defaults. Falls back to a built-in curve
  // if gr_calc.js isn't loaded for some reason.
  if(typeof grLoadScale==='function'){
    try{
      const scale=grLoadScale(dept);
      if(Array.isArray(scale)&&scale.length){
        for(const [min,code] of scale){ if(pct>=min) return code; }
        return scale[scale.length-1][1];
      }
    }catch(e){}
  }
  return pointsToGradeForDept(pctToPoints(pct),dept);
}

function courseGroupKey(e){ return e.dept+'|'+e.semKey+'|'+e.courseIndex+'|'+e.courseName; }

function groupExams(){
  const groups={};
  (examData||[]).forEach(e=>{
    const k=courseGroupKey(e);
    if(!groups[k]) groups[k]={dept:e.dept,semKey:e.semKey,courseIndex:e.courseIndex,courseName:e.courseName,credits:e.credits,entries:[]};
    groups[k].entries.push(e);
  });
  return groups;
}

function courseAveragePct(entries){
  let wSum=0,wtSum=0;
  entries.forEach(e=>{
    const max=e.maxScore>0?e.maxScore:100;
    const pct=(e.score/max)*100;
    const w=e.weight>0?e.weight:1;
    wSum+=pct*w; wtSum+=w;
  });
  return wtSum>0?wSum/wtSum:null;
}

// ── rendering ────────────────────────────────────────────────
function renderExamsScreen(){
  const root=document.getElementById('examScreenScroll');
  if(!root) return;

  if(!activeProfileId){
    root.innerHTML=`
      <div class="ex-empty">
        <div class="ex-empty-title">No active profile</div>
        <div class="ex-empty-sub">Create or load a profile first — exam results are saved per profile.</div>
        <button class="new-profile-btn" style="width:auto;margin-top:14px;" onclick="showScreen('profiles')">Go to Profiles</button>
      </div>`;
    return;
  }

  const groups=groupExams();
  const keys=Object.keys(groups);

  let html=`
    <div class="ex-header">
      <div class="ex-title">Exam Results</div>
      <div class="ex-sub">Log scores, watch your running average, and push an estimated grade into your Calc tab.</div>
    </div>
    <button class="save-btn" style="margin:0 16px 14px;width:calc(100% - 32px);" onclick="openAddExamModal()">+ Add Exam Result</button>
  `;

  if(!keys.length){
    html+=`<div class="ex-empty"><div class="ex-empty-title">No exams logged yet</div><div class="ex-empty-sub">Tap "Add Exam Result" to log your first midterm, quiz, or final.</div></div>`;
  } else {
    // newest course activity first
    keys.sort((a,b)=>{
      const la=Math.max(...groups[a].entries.map(e=>e.date||'')), lb=Math.max(...groups[b].entries.map(e=>e.date||''));
      return lb>la?1:lb<la?-1:0;
    });
    html+='<div class="ex-group-list">';
    keys.forEach(k=>{
      const g=groups[k];
      const avg=courseAveragePct(g.entries);
      const dept=g.dept;
      const letter=avg!==null?pctToGrade(avg,dept):null;
      g.entries.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
      html+=`
        <div class="ex-group">
          <div class="ex-group-head">
            <div>
              <div class="ex-group-name">${_gpaEiEsc(g.courseName)}</div>
              <div class="ex-group-sem">${_gpaEiEsc(g.semKey.replace('|',' · '))}</div>
            </div>
            <div class="ex-group-avg">
              <div class="ex-avg-pct">${avg!==null?avg.toFixed(1)+'%':'—'}</div>
              <div class="ex-avg-letter">${letter?'≈ '+letter:''}</div>
            </div>
          </div>
          <div class="ex-entries">
            ${g.entries.map(e=>`
              <div class="ex-entry">
                <div class="ex-entry-main">
                  <span class="ex-entry-type">${_gpaEiEsc(e.type)}</span>
                  <span class="ex-entry-score">${e.score}/${e.maxScore}</span>
                  ${e.weight?`<span class="ex-entry-weight">wt ${e.weight}%</span>`:''}
                </div>
                <div class="ex-entry-sub">
                  <span class="ex-entry-date">${e.date||''}</span>
                  <button class="ex-del-btn" onclick="deleteExamEntry('${e.id}')" title="Delete">×</button>
                </div>
              </div>`).join('')}
          </div>
          ${letter?`<button class="ex-apply-btn" onclick="applyExamGroupGrade('${k.replace(/'/g,"\\'")}')">Apply ${letter} to Calc tab course</button>`:''}
        </div>`;
    });
    html+='</div>';
  }

  root.innerHTML=html;
}

function deleteExamEntry(id){
  examData=(examData||[]).filter(e=>e.id!==id);
  persistToProfile();
  renderExamsScreen();
  showToast('Exam entry deleted');
}

function applyExamGroupGrade(key){
  const groups=groupExams();
  const g=groups[key];
  if(!g) return;
  const avg=courseAveragePct(g.entries);
  if(avg===null) return;
  const letter=pctToGrade(avg,g.dept);
  const arr=ensureSemDataArrayForDept(g.dept,g.semKey);
  if(!arr[g.courseIndex]) arr[g.courseIndex]={grade:'',credits:g.credits,elective:false};
  arr[g.courseIndex].grade=letter;
  persistToProfile();

  let msg=`${letter} applied to ${g.courseName.split(' · ')[0]}`;
  if(semHistory[g.semKey]){
    recomputeSemHistoryFromData(g.dept,g.semKey);
    persistToProfile();
    if(typeof updateHistoryStrip==='function') updateHistoryStrip();
  } else {
    msg+=' — open Calc → Save GPA to lock in that semester\u2019s total';
  }
  if(g.dept===activeDept && g.semKey===activeKey && typeof loadCourses==='function') loadCourses();
  if(typeof updateCumulative==='function') updateCumulative();
  showToast(msg,4500);
}

// ── Add Exam modal ───────────────────────────────────────────
function openAddExamModal(){
  if(!activeProfileId){ showToast('Load a profile first'); return; }
  let modal=document.getElementById('addExamModal');
  if(!modal){
    modal=document.createElement('div');
    modal.id='addExamModal';
    modal.className='modal-overlay';
    document.body.appendChild(modal);
  }
  const courseOpts=buildExamCourseOptions();
  const today=new Date().toISOString().slice(0,10);
  modal.innerHTML=`
    <div class="modal" style="max-width:380px;">
      <h2>Add Exam Result</h2>
      <p>Only required (credit-bearing) courses for this profile's department are listed.</p>
      <select id="examCourseSel" class="ex-modal-select">
        ${courseOpts.map((c,i)=>`<option value="${i}">${_gpaEiEsc(c.name)} — ${_gpaEiEsc(c.semLabel)}</option>`).join('')}
      </select>
      <select id="examTypeSel" class="ex-modal-select">
        ${EXAM_TYPES.map(t=>`<option value="${t}">${t}</option>`).join('')}
      </select>
      <div class="ex-modal-row">
        <input type="number" id="examScoreInput" placeholder="Score" min="0" step="0.1">
        <span class="ex-modal-slash">/</span>
        <input type="number" id="examMaxInput" placeholder="Max" min="1" step="0.1" value="100">
      </div>
      <div class="ex-modal-row">
        <input type="number" id="examWeightInput" placeholder="Weight % (optional)" min="0" max="100" step="1">
        <input type="date" id="examDateInput" value="${today}">
      </div>
      <div style="display:flex;gap:8px;margin-top:4px;">
        <button class="modal-cancel" onclick="closeAddExamModal()">Cancel</button>
        <button class="modal-confirm" onclick="confirmAddExam()">Add</button>
      </div>
    </div>`;
  modal.dataset.courseOpts=JSON.stringify(courseOpts);
  modal.classList.add('open');
  if(!courseOpts.length) showToast('No credit-bearing courses found for this department');
}
function closeAddExamModal(){ document.getElementById('addExamModal')?.classList.remove('open'); }

function confirmAddExam(){
  const modal=document.getElementById('addExamModal');
  const courseOpts=JSON.parse(modal.dataset.courseOpts||'[]');
  const idx=parseInt(document.getElementById('examCourseSel').value);
  const course=courseOpts[idx];
  const type=document.getElementById('examTypeSel').value;
  const score=parseFloat(document.getElementById('examScoreInput').value);
  const maxScore=parseFloat(document.getElementById('examMaxInput').value)||100;
  const weight=parseFloat(document.getElementById('examWeightInput').value)||0;
  const date=document.getElementById('examDateInput').value||new Date().toISOString().slice(0,10);

  if(!course){ showToast('Pick a course'); return; }
  if(isNaN(score) || score<0){ showToast('Enter a valid score'); return; }
  if(maxScore<=0){ showToast('Max score must be greater than 0'); return; }

  examData=examData||[];
  examData.push({
    id:_examId(), dept:course.dept, semKey:course.semKey, courseName:course.name,
    courseIndex:course.courseIndex, credits:course.credits,
    type, score, maxScore, weight, date
  });
  persistToProfile();
  closeAddExamModal();
  renderExamsScreen();
  showToast('Exam result added ✓');
}
