// ── storage ───────────────────────────────────────────────────
function getAllProfiles(){ try{ return JSON.parse(localStorage.getItem('gpa_profiles'))||{}; }catch(e){ return {}; } }
function saveAllProfiles(p){ localStorage.setItem('gpa_profiles',JSON.stringify(p)); }
function getActiveProfileId(){ return localStorage.getItem('gpa_activeProfile')||null; }
function setActiveProfileId(id){ localStorage.setItem('gpa_activeProfile',id); }

let activeKey='Year 1|Fall';
let semData={}, semHistory={};
let activeProfileId=null, deleteTargetId=null, deletedProfile=null;

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

function calcCumulative(sh){
  const keys=Object.keys(sh);
  if(!keys.length) return null;
  let pts=0,cr=0;
  keys.forEach(k=>{pts+=sh[k].gpa*sh[k].credits;cr+=sh[k].credits;});
  if(!cr) return null;
  const gpa=pts/cr;
  let honor='';
  if(gpa>=3.5)      honor='★ High Honor';
  else if(gpa>=3.0) honor='✦ Honor';
  else if(gpa<2.0)  honor='⚠ Below 2.0';
  return {val:gpa.toFixed(2),honor};
}