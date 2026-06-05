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
* [Usage Guide](#usage-guide)
  * [GPA Calculator](#usage-guide)
  * [Grade Calculator](#grade-calculator)

---

## Features

All mandatory and elective courses for three departments are given — just select your department, year, and courses.

Automatically recalculates every time you change a grade. See your term GPA, earned credits, and cumulative GPA including honors status (High Honor ★, Honor ✦, or warning ⚠).

**What-if Mode** temporarily overrides any grade to see how it would affect your cumulative GPA without saving the changes.

**Target GPA Calculator** helps students calculate the average GPA they need to reach their goal.

Create different **profiles** (e.g. one for each department, or one for a friend). Profiles store all grades and GPA history independently.

**Transcript View** — a clean, printable transcript that shows saved semester GPAs and the cumulative progress (can be copied, shared, or downloaded).

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

2. **Open in browser** — simply open `index.html` in any modern browser (Chrome, Firefox, Edge, Safari). No build step or web server is required.

3. **Start using** — select your department, pick a year/semester, enter grades, and the app will do the rest.

> **Note:** All data is stored in your browser's `localStorage`. Clearing browser data will remove saved profiles and grades.

### Android App

The repository includes a complete Android project in the `app/` folder.

**Prerequisites:** Android Studio

**Build steps:**

1. Open the project in Android Studio.
2. Sync Gradle files.
3. **Build → Build APK** or run on an emulator/device.

The Android app loads `index.html` from the assets folder, so any changes to the HTML/CSS/JS files are automatically reflected in the APK after a rebuild.

---

## Project Structure

---

## Usage Guide

### GPA Calculator

1. **Choose your department and semester** — use the three dropdowns at the top of the Calculator screen to select Department, Year, and Semester. The course list updates automatically.

2. **Enter grades** — for each course, select a letter grade from the dropdown. The semester GPA and credits are recalculated immediately. Courses marked with `SKIP` or `S/U` (zero-credit) are ignored.

3. **Save the semester** — press **Save GPA**. This stores the current semester's GPA and credits in the profile's history and updates the cumulative GPA.

4. **Create a profile** *(optional)* — navigate to the **Profiles** tab and click **+ New Profile**. Give it a name and assign a department. Once a profile is active, your saved semester data is tied to it.

5. **Use What-If mode** — click **What-If** to enter temporary grade overrides. Change any grade to see the projected impact on your cumulative GPA. Changes are not saved; exit what-if mode to return to your real grades.

6. **Set a target GPA** — click **Target GPA**, enter your desired cumulative GPA, and the tool will calculate the average grade needed in remaining semesters.

7. **View and share your transcript** — switch to the **View** tab to see a full transcript of saved semesters. Use the share button to copy a text summary or save the transcript as an image.

---

### Grade Calculator

The **Grade Calc** screen is a standalone tool for computing a final course score from individual components (midterms, final exam, quizzes, lab, bonus quizzes, and any custom extras). It is separate from the GPA calculator and works with any grading scheme.

#### Sub-tabs

| Tab | Purpose |
|---|---|
| **Calc** | Enter component weights and grades to compute a final score |
| **Templates** | Save, load, rename, and delete grading schemes |
| **Scale** | Customize the letter-grade thresholds (AA / BA / BB … FF) |

#### Calc tab

**Component Weights card**

Set the percentage weight for each component. The total must equal 100% for an accurate result (a live status indicator warns you if it does not). Components can be shown or hidden individually with the toggle buttons (± Midterm, ± Final, ± Quizzes, ± Lab, ± Bonus).

| Component | Notes |
|---|---|
| Midterm | Supports multiple midterm scores; the average is used automatically |
| Final exam | Single score |
| Quizzes | Single average score |
| Lab | Calculated independently — its weight is subtracted from the total before the remaining components are scaled, so it does not compress the other weights |
| Bonus quizzes | Treated as an additive bonus on top of the base score |
| Extras | Fully custom rows (label + weight) defined per template |

**Entering grades**

Each enabled component gets its own input row. For Midterms you can add multiple rows with **+ add** and remove any with the × button. Leave a field blank to exclude that component from the calculation.

**Result card**

Once at least one grade is entered, the result card appears showing:

* The computed score (0–100)
* The corresponding letter grade and description (e.g. *BB — Very Good*)
* A per-component breakdown showing each contribution to the total

You can also press **Save to Course** to write the calculated letter grade directly into a course slot in the active GPA Calculator semester.

#### Templates tab

Templates store a complete grading scheme (weights, which components are enabled, midterm count, and any extra rows) so you can reload it in one tap.

**Built-in templates** (read-only):

| Template | Description |
|---|---|
| English — Speaking + Attendance | Custom extras: two midterms, three speaking assessments, a quiz, attendance, and an end-of-course interview |
| 2 MT · 1 Final | Two midterms (60%) + final (40%) |
| 2 MT · 1 Final · 10% Bonus Quizzes | Same as above with a 10% bonus quiz component |
| 1 MT · Quizzes · 1 Final | One midterm (30%) + quizzes (30%) + final (40%) |
| Physics II | Two midterms (60%) + final (40%) + lab (10%) |

**Custom templates** can be created from the current Calc state with **Save Template**, renamed with the pencil icon, and deleted with the bin icon.

**Adding a built-in template** (for developers): append an object to `_RAW_BUILTINS` in `gr_storage.js`. The full schema with all supported fields is documented at the top of that file.

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

Each threshold (except FF, which is locked at 0) can be edited directly. The editor enforces a strictly descending order — editing one value automatically nudges neighbours to prevent overlaps. Changes are saved to `localStorage` immediately and applied to the current result. Press **Reset to defaults** to restore the original scale.
