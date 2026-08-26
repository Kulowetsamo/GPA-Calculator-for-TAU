// ── Exams tab ─────────────────────────────────────────────────
<<<<<<< HEAD
// Flow: pick a semester → tap a course → log results (free-form or
// structured from a Grade-tab template).
//
=======
>>>>>>> 7a9e9ed77c984f1d9e044c5cb07a69927b807f2d
// examData (declared in storage.js) is an array of entries scoped to the
// active profile and persisted via persistToProfile(), same as semData.
// Entry shape:
// { id, dept, semKey, courseName, courseIndex, credits,
<<<<<<< HEAD
//   type, score, maxScore, weight, date,
//   planned:true }          — optional; template component awaiting a score
//                             (score === null until the user fills it in)

const EXAM_TYPES = ['Midterm','Final','Quiz','Homework','Project','Other'];
const EXAM_SEM_STORAGE_KEY = 'gpa_exams_sem';

let exSelectedSem = null;   // 'Year 1|Fall' — semester picked on the Exams tab
let exViewCourse = null;    // group key when a course detail view is open
=======
//   type, score, maxScore, weight, date }

const EXAM_TYPES = ['Midterm','Final','Quiz','Homework','Project','Other'];
>>>>>>> 7a9e9ed77c984f1d9e044c5cb07a69927b807f2d

function _examId(){ return 'ex_'+Date.now()+'_'+Math.floor(Math.random()*1000); }

// courses eligible for exam-tracking: required (non-elective, non-zero-credit)
// courses for the profile's department, across every semester, in the same
// order loadCourses() uses so courseIndex lines up with semData rows.
function getPresetsForDept(dept){ return dept==='IENG'?IENG_PRESETS:dept==='FE'?FE_PRESETS:CNGB_PRESETS; }
function getElectivesForDept(dept){ return dept==='IENG'?IENG_ELECTIVES:dept==='FE'?FE_ELECTIVES:CNGB_ELECTIVES; }

<<<<<<< HEAD
function _exEsc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _exJs(s){ return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

function _exLoadSelKey(){
  if(exSelectedSem&&SEM_ORDER.some(([y,s])=>y+'|'+s===exSelectedSem)) return exSelectedSem;
  let saved=null;
  try{ saved=localStorage.getItem(EXAM_SEM_STORAGE_KEY); }catch(e){}
  if(saved&&SEM_ORDER.some(([y,s])=>y+'|'+s===saved)){ exSelectedSem=saved; return saved; }
  // fall back to the calculator's current semester
  exSelectedSem=(typeof activeKey==='string'&&SEM_ORDER.some(([y,s])=>y+'|'+s===activeKey))?activeKey:'Year 1|Fall';
  return exSelectedSem;
}

function coursesForSemester(dept,key){
  const preset=getPresetsForDept(dept)[key]||[];
  return [...preset].sort((a,b)=>b[1]-a[1])
    .map(([name,credits],idx)=>({name,credits,courseIndex:idx}))
    .filter(c=>c.credits>0);
}

function _semBaseCount(dept,key){
  const preset=getPresetsForDept(dept)[key]||[];
  const elects=getElectivesForDept(dept)[key]||[];
  return [...preset].sort((a,b)=>b[1]-a[1]).length+elects.length;
}

// Base courses + retake rows added from either tab. Retakes live at the tail
// of semData[dept|key]; their slot index is their absolute array position,
// which is what applyExamGroupGrade writes back to.
function semesterCourseSlots(dept,key){
  const slots=coursesForSemester(dept,key).map(c=>({name:c.name,credits:c.credits,courseIndex:c.courseIndex,isRetake:false}));
  const arr=semData[dept+'|'+key]||[];
  const baseCount=_semBaseCount(dept,key);
  arr.slice(baseCount).forEach((e,j)=>{
    if(e&&e.retake&&e.name) slots.push({name:e.name,credits:e.credits||3,courseIndex:baseCount+j,isRetake:true});
  });
  return slots;
}

function slotIsRetake(dept,semKey,courseIndex){
  const arr=semData[dept+'|'+semKey]||[];
  return !!(arr[courseIndex]&&arr[courseIndex].retake);
=======
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
>>>>>>> 7a9e9ed77c984f1d9e044c5cb07a69927b807f2d
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

<<<<<<< HEAD
// Context of the course currently open in the detail view — lets us build a
// synthetic empty group for courses that have no logged entries yet.
let _examCtx=null;

// _examCtx uses .name (not .courseName), so build its group key explicitly
// rather than reusing courseGroupKey(), which expects an examData entry shape.
function _ctxGroupKey(){
  return _examCtx.dept+'|'+_examCtx.semKey+'|'+_examCtx.courseIndex+'|'+_examCtx.name;
}

function getExamGroup(groupKey){
  const groups=groupExams();
  if(groups[groupKey]) return groups[groupKey];
  if(_examCtx&&_examCtx.dept===activeDept&&_ctxGroupKey()===groupKey){
    return {dept:_examCtx.dept,semKey:_examCtx.semKey,courseIndex:_examCtx.courseIndex,
            courseName:_examCtx.name,credits:_examCtx.credits,isRetake:_examCtx.isRetake,entries:[]};
  }
  return null;
}

=======
>>>>>>> 7a9e9ed77c984f1d9e044c5cb07a69927b807f2d
function groupExams(){
  const groups={};
  (examData||[]).forEach(e=>{
    const k=courseGroupKey(e);
    if(!groups[k]) groups[k]={dept:e.dept,semKey:e.semKey,courseIndex:e.courseIndex,courseName:e.courseName,credits:e.credits,entries:[]};
    groups[k].entries.push(e);
  });
  return groups;
}

<<<<<<< HEAD
function isScored(e){ return e.planned?(e.score!==null&&e.score!==undefined&&!isNaN(e.score)):true; }

function courseAveragePct(entries){
  let wSum=0,wtSum=0;
  entries.forEach(e=>{
    if(!isScored(e)) return;
=======
function courseAveragePct(entries){
  let wSum=0,wtSum=0;
  entries.forEach(e=>{
>>>>>>> 7a9e9ed77c984f1d9e044c5cb07a69927b807f2d
    const max=e.maxScore>0?e.maxScore:100;
    const pct=(e.score/max)*100;
    const w=e.weight>0?e.weight:1;
    wSum+=pct*w; wtSum+=w;
  });
  return wtSum>0?wSum/wtSum:null;
}

<<<<<<< HEAD
// ── Grade-tab template → exam components ─────────────────────
function templateComponents(tpl){
  const w=tpl.weights||{};
  const comps=[];
  const mtCount=tpl.hasMidterm!==false?(parseInt(tpl.midtermCount)||0):0;
  if(mtCount>0&&(w.midterm||0)>0){
    const base=Math.floor((w.midterm/mtCount)*100)/100;
    const last=w.midterm-base*(mtCount-1);
    for(let i=1;i<=mtCount;i++){
      comps.push({label:mtCount===1?'Midterm':'Midterm '+i,weight:i===mtCount?last:base});
    }
  }
  if(tpl.hasFinal!==false&&(w.final||0)>0) comps.push({label:'Final',weight:w.final});
  if(tpl.hasQuizzes&&(w.quizzes||0)>0) comps.push({label:'Quizzes',weight:w.quizzes});
  if(tpl.hasLab&&(w.lab||0)>0) comps.push({label:'Lab',weight:w.lab});
  if(tpl.hasBonusQuiz&&(w.bonusQuizzes||0)>0) comps.push({label:'Bonus Quizzes',weight:w.bonusQuizzes});
  (tpl.extras||[]).forEach(x=>{ if((x.weight||0)>0) comps.push({label:x.label||'Extra',weight:x.weight}); });
  return comps;
}

function tplSummaryText(tpl){
  return templateComponents(tpl).map(c=>`${c.label} ${c.weight}%`).join(' · ')||'No weighted components';
}

function applyTemplateToCourse(groupKey,tplId){
  const g=getExamGroup(groupKey);
  if(!g) return;
  let tpl=null;
  if(typeof getTemplateById==='function'){
    try{ tpl=getTemplateById(tplId); }catch(e){}
  }
  if(!tpl){ showToast('Template not found'); return; }
  const comps=templateComponents(tpl);
  if(!comps.length){ showToast('That template has no weighted components'); return; }
  const existing=new Set(g.entries.map(e=>(e.type||'').trim().toLowerCase()));
  const today=new Date().toISOString().slice(0,10);
  let created=0;
  comps.forEach(c=>{
    if(existing.has(c.label.trim().toLowerCase())) return;
    examData=examData||[];
    examData.push({
      id:_examId(), dept:g.dept, semKey:g.semKey, courseName:g.courseName,
      courseIndex:g.courseIndex, credits:g.credits,
      type:c.label, score:null, maxScore:100, weight:c.weight,
      date:'', planned:true
    });
    existing.add(c.label.trim().toLowerCase());
    created++;
  });
  persistToProfile();
  renderExamsScreen();
  showToast(created?`${created} component${created===1?'':'s'} added from "${tpl.name}"`:`"${tpl.name}" — all components already exist`);
}

function openTplPickModal(groupKey){
  let modal=document.getElementById('tplPickModal');
  if(!modal){
    modal=document.createElement('div');
    modal.id='tplPickModal';
    modal.className='modal-overlay';
    document.body.appendChild(modal);
  }
  let builtins=[],saved=[];
  if(typeof getBuiltinTemplates==='function'){
    try{ builtins=getBuiltinTemplates(); }catch(e){}
  }
  if(typeof getSavedTemplates==='function'){
    try{ saved=getSavedTemplates(); }catch(e){}
  }
  const item=(tpl)=>{
    const badge=tpl.builtin?'built-in':'custom';
    return `<button class="ex-tpl-item" onclick="closeTplPickModal();applyTemplateToCourse('${_exJs(groupKey)}','${_exJs(tpl.id)}')">
      <span class="ex-tpl-name">${_exEsc(tpl.name)}</span>
      <span class="ex-tpl-badge">${badge}</span>
      <span class="ex-tpl-meta">${_exEsc(tplSummaryText(tpl))}</span>
    </button>`;
  };
  modal.innerHTML=`
    <div class="modal" style="max-width:400px;">
      <h2>Add Components from Template</h2>
      <p>Pick a grading template from the Grade tab. Its weighted components (midterms, final, quizzes, extras…) will be added to this course — fill in scores as you get them.</p>
      <div class="ex-tpl-list">
        ${builtins.map(item).join('')}
        ${saved.map(item).join('')}
        ${(builtins.length+saved.length)?'':'<div class="course-picker-empty">No templates found.</div>'}
      </div>
      <div style="display:flex;gap:8px;margin-top:14px;">
        <button class="modal-cancel" style="flex:1;" onclick="closeTplPickModal()">Cancel</button>
      </div>
    </div>`;
  modal.classList.add('open');
}
function closeTplPickModal(){ document.getElementById('tplPickModal')?.classList.remove('open'); }

=======
>>>>>>> 7a9e9ed77c984f1d9e044c5cb07a69927b807f2d
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

<<<<<<< HEAD
  if(exViewCourse){
    const g=getExamGroup(exViewCourse);
    if(g){ renderExamCourseDetail(root,g); return; }
    exViewCourse=null;
  }
  renderExamSemesterView(root);
}

// Step 1+2 — semester picker and its course list
function renderExamSemesterView(root){
  _exLoadSelKey();
  const [selYear,selSem]=exSelectedSem.split('|');
  const yearOpts=['Year 1','Year 2','Year 3','Year 4']
    .map(y=>`<option value="${y}" ${y===selYear?'selected':''}>${y}</option>`).join('');
  const semOpts=['Fall','Spring','Summer']
    .map(s=>`<option value="${s}" ${s===selSem?'selected':''}>${s}</option>`).join('');

  const courses=semesterCourseSlots(activeDept,exSelectedSem);
  const groups=groupExams();

  let listHtml='';
  if(!courses.length){
    listHtml=`<div class="ex-empty"><div class="ex-empty-title">No credit courses this semester</div><div class="ex-empty-sub">Add one with the button above, or pick another semester.</div></div>`;
  } else {
    listHtml='<div class="ex-course-list">'+courses.map(c=>{
      const k=activeDept+'|'+exSelectedSem+'|'+c.courseIndex+'|'+c.name;
      const g=groups[k];
      const total=g?g.entries.length:0;
      const done=g?g.entries.filter(isScored).length:0;
      const avg=g?courseAveragePct(g.entries):null;
      const letter=avg!==null?pctToGrade(avg,activeDept):null;
      return `<button class="ex-course-item" onclick="openExamCourse('${_exJs(exSelectedSem)}',${c.courseIndex},'${_exJs(c.name)}',${c.credits})">
        <span class="ex-ci-name">${_exEsc(c.name)}${c.isRetake?' <span class="ex-ci-retake">RETAKE</span>':''}</span>
        ${c.isRetake?`<span class="ex-ci-del" title="Remove retake course" onclick="event.stopPropagation();removeExamRetake('${_exJs(exSelectedSem)}',${c.courseIndex})">✕</span>`:''}
        <span class="ex-ci-right">
          <span class="ex-ci-count">${done}/${total||0} logged</span>
          <span class="ex-ci-avg">${avg!==null?avg.toFixed(1)+'%':'—'}${letter?' · ≈'+letter:''}</span>
        </span>
        <span class="ex-ci-cr">${c.credits} cr · ${_exEsc(semLabel(exSelectedSem))}</span>
      </button>`;
    }).join('')+'</div>';
  }

  root.innerHTML=`
    <div class="ex-header">
      <div class="ex-title">Exam Results</div>
      <div class="ex-sub">1 — pick a semester · 2 — tap a course (or add one) · 3 — log your grades.</div>
    </div>
    <div class="ex-sem-selects">
      <select id="exYearSel" onchange="_exOnSemChange()">${yearOpts}</select>
      <select id="exSemSel" onchange="_exOnSemChange()">${semOpts}</select>
    </div>
    <div style="padding:0 16px 12px;">
      <button class="ghost-btn" style="width:100%;border-color:var(--accent2);color:var(--accent2);" onclick="openExamAddCourse()">+ Add Course / Retake to this semester</button>
    </div>
    ${listHtml}`;
}

function _exOnSemChange(){
  const y=document.getElementById('exYearSel').value;
  const s=document.getElementById('exSemSel').value;
  exSelectedSem=y+'|'+s;
  try{ localStorage.setItem(EXAM_SEM_STORAGE_KEY,exSelectedSem); }catch(e){}
  const root=document.getElementById('examScreenScroll');
  if(root) renderExamSemesterView(root);
}

// ←/→ on the Exams tab: step through semesters (list view only)
function examsSemNav(delta){
  if(exViewCourse) return false;
  const flat=SEM_ORDER.map(([y,s])=>y+'|'+s);
  const i=flat.indexOf(_exLoadSelKey());
  const ni=Math.max(0,Math.min(flat.length-1,i+delta));
  if(ni===i) return true;
  exSelectedSem=flat[ni];
  try{ localStorage.setItem(EXAM_SEM_STORAGE_KEY,exSelectedSem); }catch(e){}
  const root=document.getElementById('examScreenScroll');
  if(root) renderExamSemesterView(root);
  return true;
}

function openExamCourse(semKey,courseIndex,name,credits){
  _examCtx={dept:activeDept,semKey,courseIndex,name,credits,isRetake:slotIsRetake(activeDept,semKey,courseIndex)};
  exViewCourse=_ctxGroupKey();
  renderExamsScreen();
}
function closeExamCourse(){ exViewCourse=null; renderExamsScreen(); }

// ── Add Course / Retake from the Exams tab ───────────────────
// Writes a retake row into semData[dept|selectedSemester] — the exact same
// storage the Calc tab reads — so the course shows up in BOTH tabs.
function openExamAddCourse(){
  if(!activeProfileId){ showToast('Load a profile first'); return; }
  let modal=document.getElementById('examAddModal');
  if(!modal){
    modal=document.createElement('div');
    modal.id='examAddModal';
    modal.className='course-picker-overlay';
    document.body.appendChild(modal);
  }
  const courses=[],seen=new Set();
  SEM_ORDER.forEach(([year,sem])=>{
    (getPresetsForDept(activeDept)[year+'|'+sem]||[]).forEach(([name,credits])=>{
      if(credits>0&&!seen.has(name)){seen.add(name);courses.push({name,credits,semester:year+' · '+sem});}
    });
  });
  modal.innerHTML=`
    <div class="course-picker-modal" role="dialog" aria-modal="true">
      <div class="course-picker-heading">
        <div><h2>Add Course / Retake</h2><p>Added to <b>${_exEsc(semLabel(exSelectedSem))}</b> in both Exams and Calc tabs.</p></div>
        <button class="course-picker-close" type="button" aria-label="Close">×</button>
      </div>
      <input id="examAddSearch" class="course-picker-search" placeholder="Search by course name or code" autocomplete="off">
      <div id="examAddList" class="course-picker-list"></div>
      <div class="course-picker-footer"><span id="examAddCount"></span><button class="modal-cancel" id="cancelExamAdd">Close</button></div>
    </div>`;
  const list=modal.querySelector('#examAddList');
  const count=modal.querySelector('#examAddCount');
  const add=course=>examAddRetake(course);
  const render=query=>{
    const q=query.trim().toLowerCase();
    const matches=courses.filter(c=>c.name.toLowerCase().includes(q));
    count.textContent=matches.length+' course'+(matches.length===1?'':'s');
    list.innerHTML='';
    if(!matches.length){list.innerHTML='<div class="course-picker-empty">No matching courses.</div>';return;}
    matches.forEach(course=>{
      const item=document.createElement('button');
      item.type='button'; item.className='course-picker-item';
      item.innerHTML='<span class="course-picker-name">'+_exEsc(course.name)+'</span><span class="course-picker-meta">'+_exEsc(course.semester)+' · '+course.credits+' credits</span><span class="course-picker-add">Add</span>';
      item.onclick=()=>{searchEl.blur();modal.classList.remove('open');add(course);};
      list.appendChild(item);
    });
  };
  const searchEl=modal.querySelector('#examAddSearch');
  const close=()=>{searchEl.blur();modal.classList.remove('open');};
  modal.querySelector('#examAddSearch').oninput=e=>render(e.target.value);
  modal.querySelector('.course-picker-close').onclick=close;
  modal.querySelector('#cancelExamAdd').onclick=close;
  modal.onclick=e=>{if(e.target===modal)close();};
  render('');
  modal.classList.add('open');
  searchEl.focus();
}

function examAddRetake(course){
  const arr=ensureSemDataArrayForDept(activeDept,exSelectedSem);
  const dup=arr.some(e=>e&&e.retake&&e.name===course.name);
  if(dup){ showToast('"'+course.name.split(' · ')[0]+'" is already added to this semester'); return; }
  arr.push({grade:'',credits:course.credits,elective:false,retake:true,name:course.name});
  persistToProfile();
  // live-refresh the Calc tab if it is showing this semester
  if(typeof loadCourses==='function'&&activeKey===exSelectedSem) loadCourses();
  const root=document.getElementById('examScreenScroll');
  if(root) renderExamSemesterView(root);
  showToast('Added to '+semLabel(exSelectedSem)+' — visible in Calc & Exams ✓',3000);
}

// ── Remove a retake course (Exams ⨯ chip / detail button) ────
function removeExamRetake(semKey,courseIndex){
  const dataKey=activeDept+'|'+semKey;
  const arr=semData[dataKey];
  if(!arr||!arr[courseIndex]||!arr[courseIndex].retake){ showToast('Not a removable retake row'); return; }
  const name=arr[courseIndex].name;

  // 1) drop exam logs tied to this exact slot…
  examData=(examData||[]).filter(e=>!(e.dept===activeDept&&e.semKey===semKey&&e.courseIndex===courseIndex));
  // 2) …and re-index logs of later retake slots in the same semester,
  //    since removing the row shifts every position after it
  examData.forEach(e=>{
    if(e.dept===activeDept&&e.semKey===semKey&&e.courseIndex>courseIndex) e.courseIndex--;
  });
  // 3) remove the row itself
  arr.splice(courseIndex,1);

  persistToProfile();
  exViewCourse=null;
  if(typeof loadCourses==='function'&&activeKey===semKey) loadCourses();
  const root=document.getElementById('examScreenScroll');
  if(root) renderExamSemesterView(root);
  showToast('Removed "'+name.split(' · ')[0]+'" from '+semLabel(semKey),3000);
}

// Step 3 — one course: entries, running average, apply to Calc
function renderExamCourseDetail(root,g){
  const avg=courseAveragePct(g.entries);
  const letter=avg!==null?pctToGrade(avg,g.dept):null;
  const total=g.entries.length;
  const done=g.entries.filter(isScored).length;
  g.entries.sort((a,b)=>(b.date||'').localeCompare(a.date||''));

  const entryRows=g.entries.map(e=>{
    if(e.planned&&e.score===null){
      return `<div class="ex-entry ex-entry-planned">
        <div class="ex-entry-main">
          <span class="ex-entry-type">${_exEsc(e.type)}</span>
          <span class="ex-entry-weight">wt ${e.weight}%</span>
        </div>
        <div class="ex-entry-sub">
          <input type="number" class="ex-score-input" placeholder="score" min="0" step="0.1"
                 onchange="updatePlannedScore('${e.id}',this.value)">
          <button class="ex-del-btn" onclick="deleteExamEntry('${e.id}')" title="Remove">×</button>
        </div>
      </div>`;
    }
    return `<div class="ex-entry">
      <div class="ex-entry-main">
        <span class="ex-entry-type">${_exEsc(e.type)}</span>
        <span class="ex-entry-score">${e.score}/${e.maxScore}</span>
        ${e.weight?`<span class="ex-entry-weight">wt ${e.weight}%</span>`:''}
      </div>
      <div class="ex-entry-sub">
        <span class="ex-entry-date">${e.date||''}</span>
        <button class="ex-del-btn" onclick="deleteExamEntry('${e.id}')" title="Delete">×</button>
      </div>
    </div>`;
  }).join('');

  root.innerHTML=`
    <div class="ex-header">
      <button class="ex-back-btn" onclick="closeExamCourse()">← All courses</button>
      <div class="ex-group-name" style="margin-top:8px;">${_exEsc(g.courseName)}${g.isRetake?' <span class="ex-ci-retake">RETAKE</span>':''}</div>
      <div class="ex-group-sem">${_exEsc(semLabel(g.semKey))} · ${g.credits} credits</div>
    </div>
    <div class="ex-detail-card">
      <div class="ex-group-avg">
        <div class="ex-avg-pct">${avg!==null?avg.toFixed(1)+'%':'—'}</div>
        <div class="ex-avg-letter">${letter?'≈ '+letter:'no scores yet'}</div>
      </div>
      <div class="ex-detail-meta">${done}/${total} entered</div>
    </div>
    <div class="ex-btn-row">
      <button class="ex-add-btn" onclick="openAddExamModal()">+ Add Result</button>
      <button class="ex-tpl-btn" onclick="openTplPickModal('${_exJs(courseGroupKey(g))}')">📋 From Template</button>
    </div>
    <div class="ex-entries" style="padding:12px 16px 4px;">${entryRows||'<div class="course-picker-empty">Nothing logged yet. Add results manually or start from a template.</div>'}</div>
    ${letter?`<div style="display:flex;gap:8px;padding:0 16px 24px;">
      <button class="ex-apply-btn" onclick="applyExamGroupGrade('${_exJs(courseGroupKey(g))}')">Apply ${letter}</button>
      ${g.isRetake?'':`<button class="ex-apply-btn" style="border-style:dashed;" title="Adds a separate retake attempt in the Calc tab — the latest attempt counts toward cGPA"
              onclick="applyExamGroupGrade('${_exJs(courseGroupKey(g))}',true)">↻ As Retake</button>`}
    </div>`:''}
    ${g.isRetake?`<div style="padding:0 16px 24px;">
      <button class="ex-remove-btn" onclick="removeExamRetake('${_exJs(g.semKey)}',${g.courseIndex})">🗑 Remove retake course</button>
    </div>`:''}`;
}

function updatePlannedScore(id,value){
  const e=(examData||[]).find(x=>x.id===id);
  if(!e) return;
  const v=parseFloat(value);
  if(isNaN(v)||v<0){
    showToast('Enter a valid score');
    renderExamsScreen();
    return;
  }
  e.score=v;
  e.date=new Date().toISOString().slice(0,10);
  delete e.planned;
  persistToProfile();
  renderExamsScreen();
  showToast(`${e.type}: ${v}/${e.maxScore} ✓`);
=======
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
>>>>>>> 7a9e9ed77c984f1d9e044c5cb07a69927b807f2d
}

function deleteExamEntry(id){
  examData=(examData||[]).filter(e=>e.id!==id);
  persistToProfile();
  renderExamsScreen();
  showToast('Exam entry deleted');
}

<<<<<<< HEAD
function applyExamGroupGrade(key,asRetake){
  const g=getExamGroup(key);
  if(!g) return;
  const avg=courseAveragePct(g.entries);
  if(avg===null){ showToast('No scored entries yet'); return; }
  const pending=g.entries.filter(e=>e.planned&&e.score===null).length;
  const letter=pctToGrade(avg,g.dept);
  const arr=ensureSemDataArrayForDept(g.dept,g.semKey);

  if(asRetake&&!g.isRetake){
    // Retakes live in the tail of the semData array (after base course rows),
    // same shape persist() writes for Calc-tab retake rows. Update an existing
    // retake row for this course instead of stacking duplicates.
    const preset=getPresetsForDept(g.dept)[g.semKey]||[];
    const elects=getElectivesForDept(g.dept)[g.semKey]||[];
    const baseCount=[...preset].sort((a,b)=>b[1]-a[1]).length+elects.length;
    const existing=arr.slice(baseCount).find(e=>e&&e.retake&&e.name===g.courseName);
    if(existing){
      existing.grade=letter;
      existing.credits=g.credits;
    } else {
      arr.push({grade:letter,credits:g.credits,elective:false,retake:true,name:g.courseName});
    }
  } else {
    // Direct write — normal course slot, or a slot that IS already a retake row
    arr[g.courseIndex]={grade:letter,credits:(arr[g.courseIndex]&&arr[g.courseIndex].credits)||g.credits,
      elective:!!(arr[g.courseIndex]&&arr[g.courseIndex].elective),
      ...(arr[g.courseIndex]&&arr[g.courseIndex].retake?{retake:true,name:g.courseName}:{})};
  }
  persistToProfile();

  const verb=g.isRetake?' updated in ':' applied'+(asRetake?' as retake to ':' to ');
  let msg=`${letter}${verb}${g.courseName.split(' · ')[0]}${pending?` (${pending} component${pending===1?'':'s'} still unscored)`:''}`;
=======
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
>>>>>>> 7a9e9ed77c984f1d9e044c5cb07a69927b807f2d
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

<<<<<<< HEAD
// ── Add Exam modal (manual entry) ────────────────────────────
function openAddExamModal(){
  if(!activeProfileId){ showToast('Load a profile first'); return; }
  let groupKey=null;
  if(exViewCourse&&getExamGroup(exViewCourse)) groupKey=exViewCourse;
=======
// ── Add Exam modal ───────────────────────────────────────────
function openAddExamModal(){
  if(!activeProfileId){ showToast('Load a profile first'); return; }
>>>>>>> 7a9e9ed77c984f1d9e044c5cb07a69927b807f2d
  let modal=document.getElementById('addExamModal');
  if(!modal){
    modal=document.createElement('div');
    modal.id='addExamModal';
    modal.className='modal-overlay';
    document.body.appendChild(modal);
  }
<<<<<<< HEAD
=======
  const courseOpts=buildExamCourseOptions();
>>>>>>> 7a9e9ed77c984f1d9e044c5cb07a69927b807f2d
  const today=new Date().toISOString().slice(0,10);
  modal.innerHTML=`
    <div class="modal" style="max-width:380px;">
      <h2>Add Exam Result</h2>
<<<<<<< HEAD
      <p>${groupKey?'Logging for the selected course.':'Custom result — type, score and optional weight.'}</p>
=======
      <p>Only required (credit-bearing) courses for this profile's department are listed.</p>
      <select id="examCourseSel" class="ex-modal-select">
        ${courseOpts.map((c,i)=>`<option value="${i}">${_gpaEiEsc(c.name)} — ${_gpaEiEsc(c.semLabel)}</option>`).join('')}
      </select>
>>>>>>> 7a9e9ed77c984f1d9e044c5cb07a69927b807f2d
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
<<<<<<< HEAD
        <button class="modal-confirm" onclick="confirmAddExam('${groupKey?_exJs(groupKey):''}')">Add</button>
      </div>
    </div>`;
  modal.classList.add('open');
}
function closeAddExamModal(){ document.getElementById('addExamModal')?.classList.remove('open'); }

function confirmAddExam(groupKey){
  const modal=document.getElementById('addExamModal');
=======
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
>>>>>>> 7a9e9ed77c984f1d9e044c5cb07a69927b807f2d
  const type=document.getElementById('examTypeSel').value;
  const score=parseFloat(document.getElementById('examScoreInput').value);
  const maxScore=parseFloat(document.getElementById('examMaxInput').value)||100;
  const weight=parseFloat(document.getElementById('examWeightInput').value)||0;
  const date=document.getElementById('examDateInput').value||new Date().toISOString().slice(0,10);

<<<<<<< HEAD
  let course=null;
  if(groupKey){
    const g=getExamGroup(groupKey);
    if(g) course={dept:g.dept,semKey:g.semKey,name:g.courseName,courseIndex:g.courseIndex,credits:g.credits};
  }
  if(!course){
    // fall back to the semester currently picked on the Exams tab
    course=coursesForSemester(activeDept,_exLoadSelKey())[0];
    if(!course){ showToast('No credit courses in this semester'); return; }
    course={dept:activeDept,semKey:exSelectedSem,name:course.name,courseIndex:course.courseIndex,credits:course.credits};
  }
=======
  if(!course){ showToast('Pick a course'); return; }
>>>>>>> 7a9e9ed77c984f1d9e044c5cb07a69927b807f2d
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
