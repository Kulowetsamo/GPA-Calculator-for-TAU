// ── storage (localStorage helpers) ───────────────────────────────────
/**
 * Retrieves all profiles from localStorage.
 * @returns {Object} Dictionary of profile objects, or empty object if none exist.
 */
function getAllProfiles() {
  try {
    return JSON.parse(localStorage.getItem('gpa_profiles')) || {};
  } catch (e) {
    return {};
  }
}

/**
 * Saves all profiles to localStorage.
 * @param {Object} p - Dictionary of profile objects.
 */
function saveAllProfiles(p) {
  localStorage.setItem('gpa_profiles', JSON.stringify(p));
}

/**
 * Gets the ID of the currently active profile.
 * @returns {string|null} Active profile ID or null.
 */
function getActiveProfileId() {
  return localStorage.getItem('gpa_activeProfile') || null;
}

/**
 * Sets the active profile ID in localStorage.
 * @param {string} id - Profile ID to set as active.
 */
function setActiveProfileId(id) {
  localStorage.setItem('gpa_activeProfile', id);
}

// ── global state variables ─────────────────────────────────────────
let activeKey = 'Year 1|Fall';        // Currently selected semester (e.g., "Year 1|Fall")
let semData = {};                     // Holds grades/credits for each department+semester key
let semHistory = {};                  // Holds calculated GPA and credits per semester key
let activeProfileId = null;           // ID of the loaded profile
let deleteTargetId = null;            // Temporarily stores profile ID scheduled for deletion
let deletedProfile = null;            // Stores deleted profile data for undo

/**
 * Enables or disables the department selector based on whether a profile is active.
 * Profiles are tied to a specific department; selector is disabled when a profile is loaded.
 */
function updateDeptSelectState() {
  const deptSel = document.getElementById('deptSel');
  if (!deptSel) return;
  const hasActiveProfile = (activeProfileId !== null);
  deptSel.disabled = hasActiveProfile;
}

/**
 * Loads the active profile from localStorage into global state (semData, semHistory, activeDept).
 * Also updates the UI elements that display the active profile name and department selector.
 */
function loadActiveProfile() {
  activeProfileId = getActiveProfileId();
  const profiles = getAllProfiles();
  if (activeProfileId && profiles[activeProfileId]) {
    semData = profiles[activeProfileId].semData || {};
    semHistory = profiles[activeProfileId].semHistory || {};
    activeDept = profiles[activeProfileId].dept || 'CNGB';
    document.getElementById('deptSel').value = activeDept;
    document.getElementById('activeProfileName').textContent = profiles[activeProfileId].name;
    document.getElementById('activeProfileBarName').textContent = profiles[activeProfileId].name;
  } else {
    // No active profile: reset state to defaults
    semData = {};
    semHistory = {};
    activeDept = 'CNGB';
    document.getElementById('deptSel').value = 'CNGB';
    document.getElementById('activeProfileName').textContent = 'No Profile';
    document.getElementById('activeProfileBarName').textContent = 'None';
  }
  updateDeptSelectState();
}

/**
 * Persists the current global state (semData, semHistory, activeDept) to the active profile in localStorage.
 * Does nothing if no profile is active.
 */
function persistToProfile() {
  if (!activeProfileId) return;
  const profiles = getAllProfiles();
  if (!profiles[activeProfileId]) return;
  profiles[activeProfileId].semData = semData;
  profiles[activeProfileId].semHistory = semHistory;
  profiles[activeProfileId].dept = activeDept;
  saveAllProfiles(profiles);
}

/**
 * Calculates cumulative GPA and honor designation from semester history.
 * @param {Object} sh - Semester history object (keys: semester keys, values: {gpa, credits})
 * @returns {Object|null} Object with `val` (GPA string) and `honor` (string), or null if no data.
 */
function calcCumulative(sh) {
  const keys = Object.keys(sh);
  if (!keys.length) return null;
  let pts = 0, cr = 0;
  keys.forEach(k => {
    pts += sh[k].gpa * sh[k].credits;
    cr += sh[k].credits;
  });
  if (!cr) return null;
  const gpa = pts / cr;
  let honor = '';
  if (gpa >= 3.5) honor = '★ High Honor';
  else if (gpa >= 3.0) honor = '✦ Honor';
  else if (gpa < 2.0) honor = '⚠ Below 2.0';
  return { val: gpa.toFixed(2), honor };
}