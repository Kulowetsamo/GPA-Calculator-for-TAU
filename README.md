GPA Calculator for Türkiye-Azerbaijan University's three departments:

- **CNGB** – Computer Engineering  
- **IENG** – Industrial Engineering  
- **FE** – Food Engineering  

The app runs in any modern browser and can also be packaged as a native Android application using a simple WebView wrapper.

## Table of Contents

- [Features](#features)
- [Live Demo](#live-demo)
- [Getting Started](#getting-started)
  - [Web App](#web-app)
  - [Android App](#android-app)
- [Project Structure](#project-structure)
- [Usage Guide](#usage-guide)

## Features

All mandatory and elective courses for three departments are given, just select your department, year, and courses.

Automatically recalculates every time you change a grade. See your term GPA, earned credits, and cumulative GPA including honors status (High Honor ★, Honor ✦, or warning ⚠).

What-if Mode temporarily overrides any grade to see how it would affect your cumulative GPA without saving the changes.

Target GPA Calculator helps students to calculate average GPA they need for their goal.

Create different profiles (e.g. one for each department, or one for a friend). Profiles store all grades and GPA history independently.

 **Transcript View** – A clean, printable transcript that shows saved semester GPAs and the cumulative progress (It can be copied/shared/downloaded).

Toggle between dark and light themes that automatically follow the system preference.

## Live Demo

The latest version is hosted on GitHub Pages:

🔗 **[kulowetsamo.github.io/GPA-Calculator-for-TAU](https://kulowetsamo.github.io/GPA-Calculator-for-TAU/)**

You can also download the pre‑built Android APK from the [Releases page](https://github.com/Kulowetsamo/GPA-Calculator-for-TAU/releases).

### Web App

1. **Clone the repository**
   ```bash
   git clone https://github.com/Kulowetsamo/GPA-Calculator-for-TAU.git
   cd GPA-Calculator-for-TAU
   
2. Open in browser
  Simply open index.html in any web browser (Chrome, Firefox, Edge, Safari, etc.). No build step or web server is required.

3. Start using – Select your department, pick a year/semester, enter grades, and the app will do the rest.

(Note: All data is stored in your browser's localStorage. Clearing your browser data will remove saved profiles and grades.)
Android App
The repository includes a complete Android project in the app/ folder.

Prerequisites:

## Android Studio

Build steps:
  1. Open the project in Android Studio.
  2. Sync Gradle files.
  3. Build → Build APK or run on an emulator/device.

The Android app simply loads index.html from the assets folder, so any changes made to the HTML/CSS/JS files will be automatically reflected in the APK after a rebuild.

## Project Structure

GPA-Calculator-for-TAU/
├── index.html            # Main web app shell
├── style.css             # Complete stylesheet (dark/light themes)
├── app.js                # Screen navigation, profile management, Android bridge
├── calc.js               # GPA calculation, what-if logic, save/load mechanics
├── data.js               # Course presets for CNGB, IENG, FE and grade scales
├── storage.js            # localStorage helpers (profiles, active profile, etc.)
├── app/                  # Android wrapper project
│   ├── build.gradle.kts
│   ├── proguard-rules.pro
│   └── src/
│       └── main/
│           ├── AndroidManifest.xml
│           ├── assets/ # All files needed for building APK Version
│           └── java/com/metu/gpacalc/
│               └── MainActivity.java  # WebView host + JavaScript bridge
├── build.gradle.kts      # Root Gradle build file
├── settings.gradle.kts
├── gradle/
├── gradlew / gradlew.bat
└── .gitignore

## Usage Guide

1. Choose your department and semester
Use the three dropdowns at the top of the Calculator screen to select Department, Year, and Semester. The course list will update automatically.

2. Enter grades
For each course, select a letter grade from the dropdown. The semester GPA and credits are recalculated immediately. Courses marked with SKIP or S/U (zero‑credit) are ignored in the calculation.

3. Save the semester
Press the Save GPA button. This stores the current semester’s GPA and credits in the profile’s history and updates the cumulative GPA.

4. Create a profile (optional)
Navigate to the Profiles tab (bottom navigation) and click + New Profile. Give it a name and assign a department. Once a profile is active, your saved semester data will be tied to it.

5. Use What‑If mode
Click the What‑If button to enter temporary grade overrides. Change any grade to see the projected impact on your cumulative GPA. The changes are not saved; exit what‑if mode to return to your real grades.

6. Set a target GPA
Click Target GPA, enter your desired cumulative GPA, and the tool will calculate the average grade you need in remaining semesters.

7. View and share your transcript
Switch to the View tab to see a full transcript of saved semesters. Use the share button to copy a text summary or save the transcript as an image.
