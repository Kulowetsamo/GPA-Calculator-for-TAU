// Screen / History (navigation between tabs: Calc, Transcript, Profiles)
let _currentScreen = 'calc'; // Tracks which screen is active

/*
 * Switches the active screen/tab and updates the browser history for back button support.
 * Also closes any open modals or image overlays.
 * @param {string} name - Target screen name: 'calc', 'transcript', or 'profiles'
 * @param {boolean} fromPopState - True if called from the popstate event (history back/forward)
 */
function showScreen(name, fromPopState) {
  const ov = document.getElementById('imgOverlay');
  if (ov) ov.style.display = 'none';
  
  ['newProfileModal', 'deleteModal', 'resetModal', 'renameModal', 'targetModal'].forEach(id => {
    document.getElementById(id)?.classList.remove('open');
  });

  // Visibility of Main Screen Containers
  document.getElementById('calcScreen').classList.toggle('active', name === 'calc');
  document.getElementById('transcriptScreen').classList.toggle('active', name === 'transcript');
  document.getElementById('profileScreen').classList.toggle('active', name === 'profiles');
  // Active state on navigation buttons
  document.getElementById('navCalc').classList.toggle('active', name === 'calc');
  document.getElementById('navTranscript').classList.toggle('active', name === 'transcript');
  document.getElementById('navProfiles').classList.toggle('active', name === 'profiles');

  // Refresh dynamic content when switching to a screen that needs it
  if (name === 'profiles') renderProfileList();
  if (name === 'transcript') renderTranscript();

  // History management: ensures the back button always returns to the Calc screen
  if (!fromPopState) {
    if (name === 'calc') {
      // Going to calc: replace state so the calc screen becomes the sentinel entry
      history.replaceState({ screen: 'calc' }, '', '');
    } else {
      // Going to a non-calc screen: push on top of sentinel
      // so back button always lands on sentinel → calc
      if (_currentScreen === 'calc') {
        history.pushState({ screen: name }, '', '');
      } else {
        // Switching between non-calc screens: replace current entry
        history.replaceState({ screen: name }, '', '');
      }
    }
  }
  _currentScreen = name;
}

window.addEventListener('popstate', function (e) {
  const screen = (e.state && e.state.screen) || 'calc';

  // If image overlay is open, close it and stop propagation
  const ov = document.getElementById('imgOverlay');
  if (ov && ov.style.display !== 'none') {
    ov.style.display = 'none';
    _currentScreen = 'transcript';
    return;
  }

  if (screen === 'calc') {
    showScreen('calc', true);
  } else {
    showScreen('calc', true);
    history.replaceState({ screen: 'calc' }, '', '');
  }
});

// Semester Navigation
/**
 * Gets the current semester key based on dropdown selections.
 * @returns {string} Key in format "Year X|Fall/Spring"
 */
function currentKey() {
  return document.getElementById('yearSel').value + '|' + document.getElementById('semSel').value;
}

/**
 * Handles department selection change.
 * If a profile is active, the department selector is disabled.
 * Otherwise, updates the active department, persists current semester data, and reloads courses.
 */
function onDeptChange() {
  if (activeProfileId) {
    // Prevent department change when a profile is loaded
    document.getElementById('deptSel').value = activeDept;
    return;
  }
  persist(activeKey);               // Save current semester's grades before switching
  activeDept = document.getElementById('deptSel').value;
  persistToProfile();               // Persist department change to profile
  loadCourses();                    // Reload courses for the new department
  if (window.updateSwipeDots) updateSwipeDots();
}

/**
 * When the Year is changed, go back to Fall Semester automatically.
 */
function onYearChange() {
  document.getElementById('semSel').value = 'Fall';
  switchSemester();
}

/**
 * Switches to the semester currently selected in the year/semester dropdowns.
 * Saves the outgoing semester's data, updates activeKey, and loads the new semester.
 */
function switchSemester() {
  persist(activeKey);               // Save current semester data
  activeKey = currentKey();         // Update active semester key
  loadCourses();                    // Load courses for the new semester
  if (window.updateSwipeDots) updateSwipeDots();
}

// Profile Actions
/**
 * Loads a different profile by ID.
 * Saves current semester data, updates active profile ID, reloads all state,
 * refreshes UI components.
 * @param {string} id - Profile ID to load
 */
function loadProfile(id) {
  persist(activeKey);               // Save current semester data to old profile
  persistToProfile();               // Ensure old profile data is stored
  setActiveProfileId(id);           // Update active profile ID in localStorage
  loadActiveProfile();              // Reload semData/semHistory/activeDept
  document.getElementById('deptSel').value = activeDept;
  loadCourses();                    // Load courses for the new profile's current semester
  updateHistoryStrip();             // Refresh the semester history chips
  updateCumulative();               // Recompute cum. GPA
  renderProfileList();              // Update profile list highlight
  if (typeof flushPendingSave === 'function') flushPendingSave();
}

// ── Android back button bridge (for WebView integration) ────────────────────────────────
/**
 * Exposed to Android WebView to handle hardware back button.
 * Returns true if the event was consumed (UI changed), false if the app should exit.
 * Priority: 1) close image overlay, 2) close any modal, 3) go to calc screen if not already,
 * 4) let Android exit the app.
 * @returns {boolean} True if back press was handled internally, false otherwise.
 */
window.handleBackButton = function () {
  // 1. Image overlay open → close it
  const ov = document.getElementById('imgOverlay');
  if (ov && ov.style.display !== 'none') {
    ov.style.display = 'none';
    return true;
  }
  // 2. Any modal open → close it
  const modals = ['newProfileModal', 'deleteModal', 'resetModal', 'renameModal', 'targetModal'];
  const openModal = modals.find(id => document.getElementById(id)?.classList.contains('open'));
  if (openModal) {
    document.getElementById(openModal).classList.remove('open');
    return true;
  }
  // 3. Not on calc tab → go to calc
  if (_currentScreen !== 'calc') {
    showScreen('calc');
    return true;
  }
  // 4. Already on calc → Exit the app
  return false;
};

// Initilization
loadTheme();                // Light/Dark Theme
loadActiveProfile();        // Load the active Profile
loadCourses();              // Load courses for the active semester
updateSwipeDots();          // Initialize touch swipe
// Establish the calc screen as the base history entry (sentinel)
history.replaceState({ screen: 'calc' }, '', '');
