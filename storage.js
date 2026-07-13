// ── storage ───────────────────────────────────────────────────
function getAllProfiles(){ try{ return JSON.parse(localStorage.getItem('gpa_profiles'))||{}; }catch(e){ return {}; } }
function saveAllProfiles(p){ localStorage.setItem('gpa_profiles',JSON.stringify(p)); }
function getActiveProfileId(){ return localStorage.getItem('gpa_activeProfile')||null; }
function setActiveProfileId(id){ localStorage.setItem('gpa_activeProfile',id); }

let activeKey='Year 1|Fall';
let semData={}, semHistory={};
let activeProfileId=null, deleteTargetId=null, deleteTargetName=null, deletedProfile=null;

function updateDeptSelectState() {
    const deptSel = document.getElementById('deptSel');
    if (!deptSel) return;
    const hasActiveProfile = (activeProfileId !== null);
    deptSel.disabled = hasActiveProfile;
}

function loadActiveProfile(){
  activeProfileId=getActiveProfileId();
  const profiles=getAllProfiles();
  if(activeProfileId&&profiles[activeProfileId]){
    semData    = profiles[activeProfileId].semData    ||{};
    semHistory = profiles[activeProfileId].semHistory ||{};
    activeDept = profiles[activeProfileId].dept       ||'CNGB';
    document.getElementById('deptSel').value=activeDept;
    document.getElementById('activeProfileName').textContent    =profiles[activeProfileId].name;
    document.getElementById('activeProfileBarName').textContent =profiles[activeProfileId].name;
  } else {
    semData={}; semHistory={};
    activeDept = 'CNGB';
    document.getElementById('deptSel').value = 'CNGB';
    document.getElementById('activeProfileName').textContent    ='No Profile';
    document.getElementById('activeProfileBarName').textContent ='None';
  }
  updateDeptSelectState();
}

function persistToProfile(){
  if(!activeProfileId) return;
  const profiles=getAllProfiles();
  if(!profiles[activeProfileId]) return;
  profiles[activeProfileId].semData    =semData;
  profiles[activeProfileId].semHistory =semHistory;
  profiles[activeProfileId].dept       =activeDept;
  saveAllProfiles(profiles);
}

function computeCumulative(profile){
  if(!profile) return null;
  const profileSemData=profile.semData||{};
  const profileSemHistory=profile.semHistory||{};
  const dept=profile.dept||'CNGB';
  const presets=dept==='IENG'?IENG_PRESETS:dept==='FE'?FE_PRESETS:CNGB_PRESETS;
  const electives=dept==='IENG'?IENG_ELECTIVES:dept==='FE'?FE_ELECTIVES:CNGB_ELECTIVES;
  const latestCourses=new Map();

  for(const [year,sem] of SEM_ORDER){
    const key=year+'|'+sem;
    if(!profileSemHistory[key]) continue;
    const saved=profileSemData[dept+'|'+key]||[];
    const required=[...(presets[key]||[])].sort((a,b)=>b[1]-a[1]);
    const courses=[
      ...required.map(([name,credits])=>({name,credits})),
      ...(electives[key]||[]).map(name=>({name,credits:3}))
    ];
    courses.forEach((course,index)=>{
      const entry=saved[index]||{};
      const grade=entry.grade||'';
      if(grade&&grade!=='SKIP'){
        latestCourses.set(course.name,{credits:entry.credits!==undefined?entry.credits:course.credits,grade});
      }
    });
    // Retake rows are saved after the regular course rows. Supporting them also
    // keeps cGPA compatible with profiles created in the Instructor version.
    saved.slice(courses.length).forEach(entry=>{
      if(entry?.retake&&entry.name&&entry.grade&&entry.grade!=='SKIP'){
        latestCourses.set(entry.name,{credits:entry.credits||3,grade:entry.grade});
      }
    });
  }

  let pts=0,cr=0;
  latestCourses.forEach(({credits,grade})=>{
    pts+=(GRADE_POINTS[grade]??0)*credits;
    cr+=credits;
  });
  if(!cr) return null;
  const gpa=pts/cr;
  let honor='';
  if(gpa>=3.5)      honor='★ High Honor';
  else if(gpa>=3.0) honor='✦ Honor';
  else if(gpa<2.0)  honor='⚠ Below 2.0';
  return {val:gpa.toFixed(2),honor};
}

// Compatibility helper for transcript, target, and export code.
function calcCumulative(){
  const profiles=getAllProfiles();
  const id=getActiveProfileId();
  return id&&profiles[id]?computeCumulative(profiles[id]):null;
}
