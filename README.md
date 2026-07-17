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
├── style.css           — main app styles (dark/light theme, layout)
├── gr_style.css        — Grade Calc styles
├── data.js             — course data for CNGB, IENG, FE; grade point table
├── gr_storage.js       — Grade Calc template storage and built-in template definitions
├── gr_calc.js          — Grade Calc engine and screen controller (initGradeScreen)
├── storage.js          — GPA profile storage helpers; semData / semHistory state
├── calc.js             — GPA calculation, What-if mode, Target GPA
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
