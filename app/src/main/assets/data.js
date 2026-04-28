// Grade System
const GRADES       = ["AA","BA","BB","CB","CC","DC","DD","FD","FF","SKIP"];
const GRADE_POINTS = {AA:4.0,BA:3.5,BB:3.0,CB:2.5,CC:2.0,DC:1.5,DD:1.0,FD:0.5,FF:0.0};
const ZERO_CR_GRADES = ["S","U","SKIP"];

const SEM_ORDER = [
  ["Year 1","Fall"],["Year 1","Spring"],
  ["Year 2","Fall"],["Year 2","Spring"],
  ["Year 3","Fall"],["Year 3","Spring"],
  ["Year 4","Fall"],["Year 4","Spring"],
];

// CNGB Courses
const CNGB_PRESETS = {
  "Year 1|Fall": [
    ["PHYS 105 · General Physics I",4],
    ["MATH 119 · Calculus with Analytic Geometry",5],
    ["BIOL 109 · Intro to Molecular Biology",3],
    ["CNGB 100 · Computer Engineering Orientation",0],
    ["CNGB 111 · Intro to Computer Eng. Concepts",4],
    ["ENG 101 · English for Academic Purposes I",4],
    ["OHS 101 · Occupational Health and Safety I",0],
    ["IS 100 · Intro to Information Technologies",0],
  ],
  "Year 1|Spring": [
    ["PHYS 106 · General Physics II",4],
    ["MATH 120 · Calculus of Several Variables",5],
    ["MATH 260 · Basic Linear Algebra",3],
    ["BA 100 · Career Planning",0],
    ["CNGB 140 · C Programming",4],
    ["ENG 102 · English for Academic Purposes II",4],
  ],
  "Year 2|Fall": [
    ["MATH 219 · Differential Equations",4],
    ["HIST 2205 · History of the Turkish Revolution I",0],
    ["EE 281 · Electrical Circuits",4],
    ["CNGB 213 · Data Structures",4],
    ["CNGB 223 · Discrete Computational Structures",3],
    ["ENG 211 · Academic Speaking Skills",3],
  ],
  "Year 2|Spring": [
    ["HIST 2206 · History of the Turkish Revolution II",0],
    ["CNGB 222 · Statistical Methods",3],
    ["CNGB 232 · Logic Design",4],
    ["CNGB 242 · Programming Language Concepts",4],
    ["CNGB 280 · Formal Languages & Abstract Machines",3],
  ],
  "Year 3|Fall": [
    ["CNGB 300 · Summer Practice I",0],
    ["CNGB 315 · Algorithms",3],
    ["CNGB 331 · Computer Organization",3],
    ["CNGB 351 · Data Management & File Structures",3],
    ["TURK 105 · Turkish I",0],
    ["OHS 301 · Occupational Health and Safety II",0],
  ],
  "Year 3|Spring": [
    ["CNGB 334 · Intro to Operating Systems",3],
    ["CNGB 336 · Intro to Embedded Systems",3],
    ["CNGB 350 · Software Engineering",3],
    ["CNGB 384 · Signals and Systems",3],
    ["TURK 106 · Turkish II",0],
  ],
  "Year 4|Fall": [
    ["CNGB 400 · Summer Practice II",0],
    ["CNGB 435 · Data Communications and Networking",3],
    ["CNGB 477 · Intro to Computer Graphics",3],
    ["CNGB 491 · Computer Engineering Design I",4],
  ],
  "Year 4|Spring": [
    ["CNGB 492 · Computer Engineering Design II",4],
  ],
};
const CNGB_ELECTIVES = {
  "Year 2|Spring": ["Nontechnical Elective"],
  "Year 3|Fall":   ["Restricted Elective","Nontechnical Elective"],
  "Year 3|Spring": ["Nontechnical Elective"],
  "Year 4|Fall":   ["Technical Elective 1","Technical Elective 2"],
  "Year 4|Spring": ["Free Elective","Technical Elective 1","Technical Elective 2","Technical Elective 3"],
};

// IENG Courses
const IENG_PRESETS = {
  "Year 1|Fall": [
    ["IEB 113E · Intro to Industrial Eng. & Ethics",2],
    ["FIZ 101E · Physics I",3],
    ["FIZ 101EL · Physics I Laboratory",1],
    ["BIL 100E · Intro to Programming (Python)",2],
    ["MAT 103E · Mathematics I",4],
    ["TUR 121 · Türk Dili I",0],
    ["ING 100 · EAP Through Global Goals",3],
    ["ATA 121 · Atatürk İlk & İnkılap Tarihi I",0],
  ],
  "Year 1|Spring": [
    ["FIZ 102E · Physics II",3],
    ["FIZ 102EL · Physics II Laboratory",1],
    ["KIM 101E · General Chemistry I",3],
    ["KIM 101EL · General Chemistry I Lab",1],
    ["IEB 112E · Intro to Manufacturing Systems",3],
    ["MAT 104E · Mathematics II",4],
    ["DAN 102 · Girişimcilik & Kariyer Danışmanlığı",0],
    ["ING 112A · Basics of Academic Writing",2],
  ],
  "Year 2|Fall": [
    ["IEB 213E · Data Manag. in Industrial Syst.",3],
    ["IEB 210E · Linear Algebra for Industrial Eng.",3],
    ["EKO 201E · Economics",3],
    ["IEB 215E · System Thinking and Analysis",2],
    ["IEB 252E · Theory of Probability",3],
    ["ING 201A · Essentials of Research Paper Writing",2],
  ],
  "Year 2|Spring": [
    ["MEK 205E · Engineering Mechanics",3],
    ["IEB 232E · Ergonomics",3],
    ["IEB 311E · Statistics",3],
    ["IEB 331E · Operations Research I",3],
    ["IEB 201E · Industrial Engineering Applications in Python",2],
    ["HUK 201 · İş Hukuku",3],
  ],
  "Year 3|Fall": [
    ["IEB 341E · Work Analysis and Design",3],
    ["IEB 421E · Production Planning & Control",3],
    ["IEB 332E · Operations Research II",3],
    ["IEB 305E · Data Analytics for Business",3],
  ],
  "Year 3|Spring": [
    ["IEB 312E · Engineering Economics",3],
    ["IEB 322E · System Simulation",3],
    ["IEB 308E · Quality Engineering",2],
  ],
  "Year 4|Fall": [
    ["IEB 4901E · Industrial Engineering Design I",4],
    ["IEB 411E · Integrated Manufacturing Systems",2],
    ["IEB 431E · Management and Organization",3],
    ["IEB 449 · End. Müh. Uyg. Seminer Dersi",0],
  ],
  "Year 4|Spring": [
    ["IEB 412E · Principles of Human Resources Management",3],
    ["IEB 4902E · Industrial Engineering Design II",4],
    ["ATA 122 · Atatürk İlk & İnkılap Tarihi II",0],
    ["TUR 122 · Türk Dili II",0],
  ],
};
const IENG_ELECTIVES = {
  "Year 3|Fall":   ["5th Sem Elective (Functional)","5th Sem Elective (Analytical)"],
  "Year 3|Spring": ["6th Sem Elective (Functional)","6th Sem Elective (Analytical)","6th Sem Elective (ITB)"],
  "Year 4|Fall":   ["7th Sem Elective (Functional)","7th Sem Elective (Analytical)"],
  "Year 4|Spring": ["8th Sem Elective (Functional)","8th Sem Elective (Analytical)"],
};

// FE Courses
const FE_PRESETS = {
  "Year 1|Fall": [
    ["BEB 650 · Basic Information & Communication Tech.",2],
    ["FİZ 117 · General Physics Laboratory",2],
    ["FİZ 127 · Physics I",5],
    ["GMÜ 101 · Introduction to Food Engineering",4],
    ["İNG 111 · Integrated Skills I",3],
    ["KİM 119 · Chemistry Laboratory I",2],
    ["KİM 159 · General Chemistry",4],
    ["MAT 123 · Mathematics I",6],
    ["TKD 103 · Turkish Language I",2],
  ],
  "Year 1|Spring": [
    ["FİZ 128 · Physics II",5],
    ["GMÜ 102 · Technical Drawing",2],
    ["GMÜ 104 · Computer Programming",5],
    ["GMÜ 106 · Biology",3],
    ["İNG 112 · Integrated Skills II",3],
    ["KİM 160 · Organic Chemistry",4],
    ["MAT 124 · Mathematics II",6],
    ["TKD 104 · Turkish Language II",2],
  ],
  "Year 2|Fall": [
    ["AİT 203 · Atatürk's Principles & Hist. of His Ref. I",2],
    ["GMÜ 205 · Food Chemistry I",4],
    ["GMÜ 215 · General Microbiology",5],
    ["GMÜ 225 · General Microbiology Laboratory",3],
    ["GMÜ 231 · Engineering Mathematics",5],
    ["GMÜ 235 · Material and Energy Balances",5],
    ["İST 118 · Uygulamalı İstatistik",5],
    ["MÜH 103 · Occupational Health and Safety I",1],
  ],
  "Year 2|Spring": [
    ["AİT 204 · Atatürk's Principles & Hist. of His Ref. II",2],
    ["GMÜ 202 · Food Chemistry II",3],
    ["GMÜ 206 · Instrumental Analysis Laboratory",3],
    ["GMÜ 210 · Instrumental Analysis",5],
    ["GMÜ 242 · Fluid Mechanics",5],
    ["GMÜ 248 · Food Microbiology",5],
    ["GMÜ 254 · Food Microbiology Laboratory",3],
    ["MÜH 104 · Occupational Health and Safety II",1],
  ],
  "Year 3|Fall": [
    ["GMÜ 309 · Food Chemistry Laboratory",3],
    ["GMÜ 311 · Unit Operations I",5],
    ["GMÜ 313 · Heat Transfer",4],
    ["GMÜ 319 · Engineering Thermodynamics",4],
    ["GMÜ 321 · Mass Transfer",4],
  ],
  "Year 3|Spring": [
    ["GMÜ 334 · Chemical Reaction Engineering",3],
    ["GMÜ 370 · Food Technology I",4],
    ["GMÜ 372 · Food Technology Lab. I",2],
    ["GMÜ 376 · Unit Operations II",3],
    ["GMÜ 378 · Unit Operations Laboratory",3],
  ],
  "Year 4|Fall": [
    ["GMÜ 427 · Food Technology II",4],
    ["GMÜ 429 · Food Technology Laboratory II",3],
    ["GMÜ 445 · Food Engineering Plant Design",5],
    ["GMÜ 467 · Food Safety and Legislation",4],
    ["MÜH 401 · Multi-Disciplined Project Work",1],
  ],
  "Year 4|Spring": [
    ["GMÜ 438 · Training",8],
    ["GMÜ 440 · Graduation Project",4],
  ],
};
const FE_ELECTIVES = {};

// Helpers
let activeDept = 'CNGB';
function getCoursePresets(){ return activeDept==='IENG'?IENG_PRESETS:activeDept==='FE'?FE_PRESETS:CNGB_PRESETS; }
function getElectivePresets(){ return activeDept==='IENG'?IENG_ELECTIVES:activeDept==='FE'?FE_ELECTIVES:CNGB_ELECTIVES; }
