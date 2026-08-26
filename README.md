# GPA Calculator for Türkiye-Azerbaijan University

GPA Calculator for Türkiye-Azerbaijan University's three departments:

* **CNGB** – Computer Engineering
* **IENG** – Industrial Engineering
* **FE** – Food Engineering

The app runs in any modern browser and can also be packaged as a native Android application using a simple WebView wrapper.

## Table of Contents

* [Features](#features)
* [Live Demo](#live-demo)
* [Getting Started](#getting-started)
  * [Web App](#web-app)
  * [Android App](#android-app)
* [Project Structure](#project-structure)
* [Load Order](#load-order)
* [Usage Guide](#usage-guide)
  * [GPA Calculator](#gpa-calculator)
  * [Grade Calculator](#grade-calculator)
* [Profile Export / Import](#profile-export--import)

---

## Features

All mandatory and elective courses for three departments are included — just select your department, year, and semester; the course list updates automatically.
 
The GPA recalculates on every grade change. The status bar shows your term GPA, earned credits, and cumulative GPA including honors status (High Honor ★, Honor ✦, or warning ⚠).
 
**Semester swipe** — swipe left or right on the calculator screen (or tap the dot indicators) to move between semesters without touching the dropdowns.
 
**Profiles** — create separate profiles (e.g. one per student or department). Each profile stores all grades, GPA history, and department independently. Profiles can be exported as JSON and shared or imported on another device.
 
**Profile filter tabs** on the Profiles screen let you filter the list by department (ALL / CNGB / IENG / FE).
 
**Transcript view** — a clean, printable transcript showing saved semester GPAs and cumulative progress. Can be copied as text, shared via the system share sheet, or exported as a PNG image.
 
**Grade Calculator** — a standalone tool for computing a final course score from weighted components. Includes templates, a customisable grading scale, scale presets, and export/import for both templates and scales.
 
**"What do I need?" panel** — displayed below the Grade Calc result, it shows the exact score needed on the first blank component to reach any target letter grade, and a full table from AA to FF.
 
Toggle between **dark and light themes** that automatically follow the system preference.

### What's new in v1.3.1

* **Exam tracker redesign** — the Exams tab is now a guided flow: pick a semester → tap a course → log grades. Courses show how many results are logged plus a running weighted average and estimated letter. From any course you can pull in a **grading template from the Grade tab**, which creates its weighted components (Midterm 1, Final, Quizzes, extras…) as fill-in-later slots — and push the result to the Calc tab either directly or via **↻ As Retake**, which adds a separate retake attempt (latest attempt counts toward cGPA; repeat applies update it instead of duplicating). "Apply" warns if components are still unscored.
* **Add Course / Retake in Exams, synced both ways** — the "+ Add Course / Retake" button on the Exams tab adds a course to the selected semester's Calc data directly, so it appears in **both tabs instantly**; courses added from the Calc tab show up in the Exams list automatically (badged RETAKE). Applying grades to a retake-slot course writes to that attempt directly. Retakes can be removed anytime via the **✕ chip** on the row or the remove button in its detail view — this also cleans up that slot's logged exam results and re-indexes later slots.
* **Backup reminders** — the Profiles screen nudges you when your data has never been exported or the last backup is 14+ days old; any export/share/clipboard copy resets the timer.

### What's new in v1.3.0

* **Confetti celebration** — saving a semester with a 3.0+ GPA triggers a confetti burst (gold for High Honor territory).
* **Animated GPA counters** — semester and cumulative GPAs count up/down smoothly instead of snapping.
* **Cumulative progress bar** — the Cumulative banner now shows your progress toward a perfect 4.00 (color-coded: red under 2.0, gold at 3.5+).
* **Transcript stats card** — best semester, weighted average GPA, total credits, and an SVG sparkline chart of your semester-by-semester GPA trend.
* **True system theme following** — with no saved preference the app now follows the OS light/dark setting live (previously it always started light).
* **Undo for grade edits** — changing any grade shows an "AA → BB"-style toast with an Undo button; restoring also reverts S/U marks on pass/fail courses.
* **Keyboard navigation** — ←/→ arrow keys switch semesters on desktop (ignored while typing or when a modal is open).
* **Print / PDF transcript** — a Print button on the View tab opens the browser print dialog with a clean black-on-white layout.
* **PWA support** — web app manifest + service worker make the hosted app installable on phones and fully offline-capable (skipped automatically inside the Android WebView).
* **Visual polish** — ambient background glow, gradient banners, staggered course-row entrance animation, hover/press micro-interactions on buttons and chips, custom scrollbars.
* **Android assets resynced** — `app/src/main/assets` was stale (missing `exams.js` and `export.js`); all web files are now in sync with the root folder.

---

## Live Demo

The latest version is hosted on GitHub Pages:

🔗 [kulowetsamo.github.io/GPA-Calculator-for-TAU](https://kulowetsamo.github.io/GPA-Calculator-for-TAU/)

You can also download the pre-built Android APK from the [Releases page](https://github.com/Kulowetsamo/GPA-Calculator-for-TAU/releases).

---

## Getting Started

### Web App

1. **Clone the repository**

```bash
git clone https://github.com/Kulowetsamo/GPA-Calculator-for-TAU.git
cd GPA-Calculator-for-TAU
```

2. **Open in browser** — open `index.html` in any modern browser (Chrome, Firefox, Edge, Safari). No build step or web server is required.

3. **Start using** — select your department, pick a year/semester, enter grades, and the app will do the rest.

> **Note:** All data is stored in your browser's `localStorage`. Clearing browser data will remove saved profiles and grades. Use the export feature to back up your data before clearing.

### Android App

The repository includes a complete Android project in the `app/` folder.

**Prerequisites:** Android Studio

**Build steps:**

1. Open the project in Android Studio.
2. Sync Gradle files.
3. **Build → Build APK** or run on an emulator/device.

The Android app loads `index.html` from the assets folder. Any changes to HTML/CSS/JS files are reflected in the APK after a rebuild.

> **Android bridges used:** the app calls `Android.shareText(text, title)` for the share sheet and `Android.exportFile(json, filename)` for file downloads. If these bridges are not available the app falls back to the Web Share API and `Blob` download links respectively.

---

## Project Structure

```
├── index.html          — app shell, all screens and modals
├── manifest.webmanifest — PWA manifest (installable web app)
├── service-worker.js   — offline cache for the hosted PWA
├── style.css           — main app styles (dark/light theme, layout)
├── gr_style.css        — Grade Calc styles
├── data.js             — course data for CNGB, IENG, FE; grade point table
├── gr_storage.js       — Grade Calc template storage and built-in template definitions
├── gr_calc.js          — Grade Calc engine and screen controller (initGradeScreen)
├── storage.js          — GPA profile storage helpers; semData / semHistory state
<<<<<<< HEAD
├── calc.js             — GPA calculation and semester save logic
=======
├── calc.js             — GPA calculation, What-if mode, Target GPA
>>>>>>> 7a9e9ed77c984f1d9e044c5cb07a69927b807f2d
├── ui.js               — rendering (course rows, transcript, profile list), swipe navigation, toasts
├── export.js           — transcript image generation and share/save/copy               
└── app.js              — screen routing, semester navigation, Android back-button bridge
```

---

## Load Order

Scripts are loaded with `defer` in this order:

```
gr_storage.js → gr_calc.js → data.js → storage.js → calc.js → ui.js → app.js
```

### Keyboard Controls

| Key | Context | Action |
|---|---|---|
| `1` – `5` | anywhere | Jump to tab: 1 Calc · 2 Grade · 3 View · 4 Exams · 5 Profiles |
| `←` / `→` | Calc tab | Previous / next semester |
| `←` / `→` | Exams tab (course list) | Previous / next semester |
| `Esc` | any overlay/modal open | Close the topmost one (course detail in Exams counts too) |
| `Esc` | on a non-Calc tab | Return to the Calc tab |
| `T` | anywhere | Toggle dark / light theme |
| `P` | View (transcript) tab | Open the print dialog (save as PDF) |
| `C` | View (transcript) tab | Copy transcript as text |

All shortcuts are ignored while you are typing in an input/select/textarea, when a modifier key (`Ctrl`/`Cmd`/`Alt`) is held, or while an overlay is open (except `Esc`). The Android hardware back button follows the same close-overlay → return-to-Calc → exit chain as `Esc`.

---

## Usage Guide

### GPA Calculator

1. **Choose your department and semester** — use the dropdowns at the top of the Calculator screen. The course list updates automatically. The department selector is locked while a profile is active (department is set per profile).
2. **Navigate semesters** — use the Year/Semester dropdowns, or swipe left/right on the calculator screen. The dot strip at the bottom shows your position across all eight semesters.
3. **Enter grades** — select a letter grade from the dropdown on each course row. The semester GPA and credits update instantly. Courses graded `SKIP` or `S/U` (zero-credit) are excluded.
4. **Save the semester** — press **Save GPA**. This writes the semester GPA and credit count into the profile's history and updates the cumulative GPA banner.
5. **Create a profile** *(optional)* — go to the **Profiles** tab and tap **+ New Profile**. Give it a name and choose a department. Once active, all saved data is tied to that profile.
6. **View and share your transcript** — switch to the **View** tab. Use the action buttons to copy a text summary, share via the system share sheet, or export the transcript as a PNG image.
7. **Export or import profiles** — at the bottom of the **Profiles** tab, use the export buttons to download all profiles or just the active one as a `.json` file. Tap **Import** to load a file or paste JSON directly.

---

### Grade Calculator

The **Grade Calc** screen is a standalone tool for computing a final course score from individual components. It works with any grading scheme and is independent of the GPA calculator.

#### Sub-tabs

| Tab | Purpose |
|---|---|
| **Calc** | Enter component weights and grades to compute a final score |
| **Templates** | Save, load, rename, delete, export, and import grading schemes |
| **Scale** | Customise the letter-grade thresholds and manage named scale presets |

#### Calc tab

**Component Weights card**

Set the percentage weight for each component. A live indicator warns you when the total does not equal 100%. Components can be shown or hidden with the toggle buttons (± Midterm, ± Final, ± Quizzes, ± Lab, ± Bonus).

| Component | Notes |
|---|---|
| Midterm | Supports multiple scores; the average is used automatically |
| Final exam | Single score |
| Quizzes | Single average score |
| Lab | Calculated independently — its weight is carved out before the remaining components are scaled, so it does not compress the other weights |
| Bonus quizzes | Treated as an additive bonus on top of the base score |
| Extras | Fully custom rows (label + weight) defined per template |

**Entering grades**

Each enabled component gets its own input row. For Midterms you can add multiple rows with **+ add** and remove any with the × button. Leave a field blank to exclude it from the calculation.

**Result card**

Once at least one grade is entered, the result card shows the computed score (0–100), the corresponding letter grade and description, and a per-component breakdown of each contribution.

Press **Save to Course** to write the calculated letter grade directly into a course slot in the active GPA Calculator semester.

**What do I need? panel**

Below the result card, this panel shows the exact score needed on the first unfilled component (Final → Quizzes → Midterm) to reach a target grade. Tap any letter grade pill to set the target. A full table from AA to FF shows whether each grade is already secured, impossible, or still reachable and at what score. Updates live on every keystroke.

#### Templates tab

Templates store a complete grading scheme (weights, which components are enabled, midterm count, and any extra rows).

**Built-in templates** (read-only):

| Template | Description |
|---|---|
| English — Speaking + Attendance | Custom extras: two midterms, three speaking assessments, a quiz, attendance, and an end-of-course interview |
| 2 MT · 1 Final | Two midterms (60%) + final (40%) |
| 2 MT · 1 Final · 10% Bonus Quizzes | Same as above with a 10% bonus quiz component |
| 1 MT · Quizzes · 1 Final | One midterm (30%) + quizzes (30%) + final (40%) |
| Physics II | Two midterms (60%) + final (40%) + lab (10%) |

**Custom templates** can be saved from the current Calc state with **Save Template**, renamed with the pencil icon, and deleted with the bin icon. An **Update** button in the active-template bar overwrites the loaded template with the current weights.

**Adding a built-in template** (for developers): append an object to `_RAW_BUILTINS` in `gr_storage.js`. The full schema with all supported fields is documented at the top of that file.

**Export / Import** — Export downloads all saved (non-built-in) templates as a `.json` file. Import accepts a file or pasted JSON, shows a preview of what will be added and what will be skipped (same-name duplicates are never overwritten), then writes the new templates on confirm. On Android WebView where file downloads are blocked, export falls back to the clipboard automatically.

#### Scale tab

The grading scale maps numeric scores to letter grades. The default TAU scale is:

| Min score | Letter | Description |
|---|---|---|
| 90 | AA | Excellent |
| 85 | BA | Very Good+ |
| 80 | BB | Very Good |
| 75 | CB | Good+ |
| 70 | CC | Good |
| 65 | DC | Satisfactory+ |
| 60 | DD | Satisfactory |
| 50 | FD | Conditional Fail |
| 0 | FF | Fail |

Each threshold (except FF, which is locked at 0) can be edited directly. The editor enforces strictly descending order — editing one value automatically nudges neighbours to prevent overlaps. Changes are saved to `localStorage` immediately. Press **Reset to defaults** to restore the original scale.

**Scale Presets** — save and reload complete named scales. Three built-in presets are included (TAU Standard, Strict, Lenient). Custom presets can be saved from the current threshold state, updated with the **Update** button, renamed, or deleted. Export / Import works the same way as grade templates.

**Adding a built-in scale preset** (for developers): append an object to `_RAW_SCALE_BUILTINS` in `gr_scale_templates.js`. The schema is documented at the top of that file.

---

## Profile Export / Import

Four buttons appear at the bottom of the Profiles screen:

| Button | Action |
|---|---|
| ↓ Export All | Downloads all profiles as `gpa_profiles_all.json` |
| ↓ Export Current | Downloads the active profile as `gpa_<name>.json` |
| ↗ Share | Opens the system share sheet with the full profiles JSON |
| ↑ Import | Opens the import modal — choose a `.json` file or paste JSON |

On Android WebView, **Export** calls `Android.exportFile(json, filename)` if the bridge is available; otherwise it falls back to copying the JSON to the clipboard. **Share** calls `Android.shareText(text, title)` if available, then tries the Web Share API, then falls back to the clipboard.

### File format

```json
{
  "_type":    "gpa_profiles",
  "_version": 1,
  "exported": "2026-06-05T12:00:00.000Z",
  "profiles": [
    {
      "name":       "Nihad — CNGB",
      "dept":       "CNGB",
      "semData":    { "CNGB|Year 1|Fall": [ ... ] },
      "semHistory": { "Year 1|Fall": { "gpa": 3.65, "credits": 20 } }
    }
  ]
}
```

Profile IDs are stripped on export and regenerated on import, so the same file can be safely imported on any device or browser without ID collisions. Profiles whose name already exists in the destination are skipped — they are never overwritten.
