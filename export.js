// ═══════════════════════════════════════════════════════════════
// export.js — transcript image generation + share/save/copy
//
// Everything here reproduces a snapshot of the transcript (text or
// canvas image) and hands it off via clipboard / Web Share / the
// Android bridge / a file download. It reads app state (semHistory,
// semData, activeDept, etc. from storage.js/data.js) and a handful
// of DOM ids owned by index.html (exportImgBtn, imgOverlay,
// overlayImg) but does not render or own any of the main screens —
// those live in ui.js. Depends on: storage.js, data.js, calc.js
// having already run (SEM_ORDER, semHistory, semData, activeDept,
// getCoursePresets/getElectivePresets, calcCumulative, semNumber).
// ═══════════════════════════════════════════════════════════════

// showToast(msg, duration, showUndo) is defined in ui.js and is
// globally available by the time this file's functions are called.

// ── plain-text transcript (for share / copy) ────────────────────
function buildShareText(){
  const profiles=getAllProfiles();
  const name=activeProfileId&&profiles[activeProfileId]?profiles[activeProfileId].name:'GPA';
  const presets=getCoursePresets(); const electives=getElectivePresets();
  const lines=[`${activeDept} GPA — ${name}`,``];
  SEM_ORDER.filter(([y,s])=>semHistory[y+'|'+s]).forEach(([year,sem])=>{
    const key=year+'|'+sem;
    const dataKey=activeDept+'|'+key;
    const yIdx=['Year 1','Year 2','Year 3','Year 4'].indexOf(year)+1;
    const semN=semNumber(sem);
    const saved=semData[dataKey]||[];
    const preset=[...(presets[key]||[])].sort((a,b)=>b[1]-a[1]);
    const elects=electives[key]||[];
    lines.push(`── Year ${yIdx} · ${sem==='Summer'?'Summer School':'Semester '+semN}  (GPA: ${semHistory[key].gpa.toFixed(2)}) ──`);
    const allCourses=[
      ...preset.map((c,i)=>({name:c[0],cr:c[1],grade:saved[i]?.grade||'',isZero:c[1]===0})),
      ...elects.map((nm,j)=>{const idx=preset.length+j;return{name:nm,cr:saved[idx]?.credits||3,grade:saved[idx]?.grade||'',isZero:false};})
    ];
    saved.slice(preset.length+elects.length).forEach(extra=>{
      if(extra?.retake&&extra.name) allCourses.push({name:extra.name,cr:extra.credits||3,grade:extra.grade||'',isZero:false});
    });
    allCourses.forEach(({name,cr,grade,isZero})=>{
      if(grade==='SKIP') return;
      const g=isZero?(grade||'—'):(grade||'FF');
      lines.push(`${g.padEnd(3)}  ${isZero?'—  ':(String(cr)+'cr')}  ${name}`);
    });
    lines.push('');
  });
  const cum=calcCumulative(semHistory);
  if(cum){ lines.push(`Cumulative GPA: ${cum.val}`); if(cum.honor) lines.push(cum.honor); }
  return lines.join('\n');
}

async function shareTranscript() {
  const text = buildShareText();
  const shared = await shareText(text, 'GPA Transcript');
  if (!shared) {
    copyTranscript();
  }
}

async function shareText(text, title) {
  if (typeof Android !== 'undefined' && Android.shareText) {
    try {
      Android.shareText(text, title);
      return true;
    } catch (e) {
      console.warn('Android shareText failed:', e);
    }
  }

  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return true;
    } catch (e) {
      if (e && e.name === 'AbortError') return true;
      console.warn('Web share failed:', e);
    }
  }

  return false;
}

function copyTranscript() {
  const text = buildShareText();
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => showToast('Copied ✓', 2000));
  } else {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    showToast('Copied ✓', 2000);
  }
}

// ── image share & save ─────────────────────────────
window._lastExportDataUrl = null;
window._lastExportName = null;

// Share image – Android bridge if available, otherwise Web Share API or download fallback
window.shareImage = async function() {
  if (!window._lastExportDataUrl) {
    showToast('No image to share. Export first.');
    return;
  }

  if (typeof Android !== 'undefined' && Android.shareImage) {
    try {
      Android.shareImage(window._lastExportDataUrl, window._lastExportName || 'GPA_Transcript.png');
      return;
    } catch (e) {
      console.warn('Android shareImage failed:', e);
    }
  }

  try {
    const response = await fetch(window._lastExportDataUrl);
    const blob = await response.blob();
    const file = new File([blob], window._lastExportName || 'GPA_Transcript.png', { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      await navigator.share({ files: [file], title: 'GPA Transcript' });
      return;
    }
  } catch (e) {
    console.warn('Web share failed:', e);
  }

  downloadImg();
};

// Save image – Android bridge if available, otherwise download via anchor
window.downloadImg = function() {
  if (!window._lastExportDataUrl) {
    showToast('No image to save');
    return;
  }

  if (typeof Android !== 'undefined' && Android.saveImage) {
    try {
      Android.saveImage(window._lastExportDataUrl, window._lastExportName || 'GPA_Transcript.png');
      return;
    } catch (e) {
      console.warn('Android saveImage failed:', e);
    }
  }

  const a = document.createElement('a');
  a.href = window._lastExportDataUrl;
  a.download = window._lastExportName || 'GPA_Transcript.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Saved ✓');
};

// ── canvas rendering ─────────────────────────────────────────
// Builds the { yIdx, semN, sem, key, courses[] } list the canvas
// renderer draws from. Mirrors the transcript DOM's course list,
// including retake/summer-added rows appended past the preset+
// elective slots.
function _buildExportSemBlocks() {
  const presets = getCoursePresets();
  const electives = getElectivePresets();
  const savedSems = SEM_ORDER.filter(([y, s]) => semHistory[y + '|' + s]);
  const semBlocks = [];

  savedSems.forEach(([year, sem]) => {
    const key = year + '|' + sem;
    const dataKey = activeDept + '|' + key;
    const yIdx = ['Year 1', 'Year 2', 'Year 3', 'Year 4'].indexOf(year) + 1;
    const semN = semNumber(sem);
    const savedD = semData[dataKey] || [];
    const preset = [...(presets[key] || [])].sort((a, b) => b[1] - a[1]);
    const elects = electives[key] || [];
    const courses = [
      ...preset.map((c, i) => ({ name: c[0], cr: c[1], grade: savedD[i]?.grade || '', isZero: c[1] === 0 })),
      ...elects.map((nm, j) => {
        const idx = preset.length + j;
        return { name: nm, cr: savedD[idx]?.credits || 3, grade: savedD[idx]?.grade || '', isZero: false };
      }),
    ];
    savedD.slice(preset.length + elects.length).forEach(extra => {
      if (extra?.retake && extra.name) {
        courses.push({ name: extra.name, cr: extra.credits || 3, grade: extra.grade || '', isZero: false });
      }
    });
    const filteredCourses = courses.filter(c => c.grade !== 'SKIP');
    semBlocks.push({ yIdx, semN, sem, key, courses: filteredCourses });
  });

  return semBlocks;
}

// Export as image – generates canvas and shows overlay with corrected button handlers
window.exportAsImage = async function() {
  const btn = document.getElementById('exportImgBtn');
  if (btn) {
    btn.textContent = 'Generating…';
    btn.disabled = true;
  }
  try {
    // Wait for fonts
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    if (document.fonts && document.fonts.load) {
      await Promise.all([
        document.fonts.load('10px "DM Mono"'),
        document.fonts.load('bold 17px "DM Mono"'),
        document.fonts.load('600 10px "DM Mono"'),
      ]).catch(() => {});
    }

    const isLight = document.body.classList.contains('light');
    const BG = isLight ? '#f5f5f0' : '#0f0f0f';
    const SURF = isLight ? '#ffffff' : '#1a1a1a';
    const BOR = isLight ? '#dddbd0' : '#2e2e2e';
    const TEXT = isLight ? '#1a1a1a' : '#f0f0f0';
    const ACC = isLight ? '#5a8a00' : '#c8f060';
    const MUT = isLight ? '#888' : '#666';
    const SAVBG = isLight ? '#eef5e8' : '#1a2e1a';
    const FONT = '"DM Mono", ui-monospace, "Courier New", monospace';

    const profiles = getAllProfiles();
    const profileName = activeProfileId && profiles[activeProfileId] ? profiles[activeProfileId].name : '—';
    const cum = calcCumulative(semHistory);
    const semBlocks = _buildExportSemBlocks();

    const SC = 2, W = 380, PAD = 22, INNER = W - PAD * 2;

    let H = PAD + 14 + 6 + 22 + 10;
    semBlocks.forEach(b => { H += 18 + 7 + b.courses.length * (28 + 4) + 16; });
    if (cum) H += 54 + 12;
    H += 20 + PAD;

    const MAX_H = 16384;
    if (H * SC > MAX_H) {
      showToast('Too many semesters to export as image');
      if (btn) { btn.textContent = 'Export as Image'; btn.disabled = false; }
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = W * SC;
    canvas.height = H * SC;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      showToast('Canvas not supported');
      if (btn) { btn.textContent = 'Export as Image'; btn.disabled = false; }
      return;
    }
    ctx.scale(SC, SC);

    function rr(x, y, w, h, r, fill, stroke, sw) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h);
      ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = sw || 1; ctx.stroke(); }
    }

    function trunc(str, maxW) {
      if (ctx.measureText(str).width <= maxW) return str;
      let short = str;
      while (short.length > 1 && ctx.measureText(short + '…').width > maxW) short = short.slice(0, -1);
      return short + '…';
    }

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    let y = PAD;

    ctx.font = `600 10px ${FONT}`;
    ctx.fillStyle = ACC;
    ctx.fillText(activeDept, PAD, y + 11);
    ctx.font = `10px ${FONT}`;
    ctx.fillStyle = MUT;
    const sub = 'GPA Calculator';
    ctx.fillText(sub, W - PAD - ctx.measureText(sub).width, y + 11);
    y += 14 + 6;

    ctx.font = `bold 17px ${FONT}`;
    ctx.fillStyle = TEXT;
    ctx.fillText(trunc(profileName, INNER), PAD, y + 17);
    y += 22 + 10;

    semBlocks.forEach(({ yIdx, semN, sem, key, courses }) => {
      ctx.font = `500 9px ${FONT}`;
      ctx.fillStyle = MUT;
      ctx.fillText('YEAR ' + yIdx + ' · ' + (sem === 'Summer' ? 'SUMMER SCHOOL' : 'SEM ' + semN), PAD, y + 12);
      ctx.font = `bold 13px ${FONT}`;
      ctx.fillStyle = ACC;
      const gStr = semHistory[key].gpa.toFixed(2);
      ctx.fillText(gStr, W - PAD - ctx.measureText(gStr).width, y + 12);
      y += 18 + 7;
      courses.forEach(({ name, cr, grade, isZero }) => {
        const g = isZero ? (grade || '—') : (grade || 'FF');
        const gC = isZero ? (grade === 'S' ? '#80e080' : grade === 'U' ? '#e08080' : (grade ? ACC : MUT)) : (grade ? ACC : '#c06060');
        rr(PAD, y, INNER, 26, 5, SURF, BOR, 0.8);
        ctx.font = `bold 12px ${FONT}`;
        ctx.fillStyle = gC;
        ctx.fillText(g, PAD + 10, y + 17);
        ctx.font = `10px ${FONT}`;
        ctx.fillStyle = MUT;
        ctx.fillText(isZero ? '—' : cr + 'cr', PAD + 46, y + 17);
        ctx.font = `11px ${FONT}`;
        ctx.fillStyle = TEXT;
        ctx.fillText(trunc(name, INNER - 86 - 8), PAD + 84, y + 17);
        y += 28 + 4;
      });
      y += 16;
    });

    if (cum) {
      rr(PAD, y, INNER, 50, 8, SAVBG, '#2a3a1a', 1);
      ctx.font = `500 9px ${FONT}`;
      ctx.fillStyle = MUT;
      ctx.fillText('CUMULATIVE GPA', PAD + 12, y + 16);
      if (cum.honor) {
        ctx.font = `11px ${FONT}`;
        ctx.fillStyle = ACC;
        ctx.fillText(cum.honor, PAD + 12, y + 34);
      }
      ctx.font = `bold 24px ${FONT}`;
      ctx.fillStyle = ACC;
      ctx.fillText(cum.val, W - PAD - 12 - ctx.measureText(cum.val).width, y + 36);
      y += 54 + 12;
    }

    ctx.font = `9px ${FONT}`;
    ctx.fillStyle = MUT;
    const foot = 'Generated with GPA Calculator';
    ctx.fillText(foot, W / 2 - ctx.measureText(foot).width / 2, y + 13);

    const dataUrl = canvas.toDataURL('image/png');
    window._lastExportDataUrl = dataUrl;
    window._lastExportName = activeDept + '_GPA_' + profileName.replace(/\s+/g, '_') + '.png';

    const overlayImg = document.getElementById('overlayImg');
    if (overlayImg) overlayImg.src = dataUrl;
    const overlay = document.getElementById('imgOverlay');
    if (overlay) {
      overlay.style.display = 'flex';
      // Force the overlay buttons to call our Android‑only functions
      setTimeout(() => {
        const btns = overlay.querySelectorAll('button');
        for (let i = 0; i < btns.length; i++) {
          const txt = btns[i].innerText;
          if (txt === 'Share') btns[i].onclick = window.shareImage;
          else if (txt === 'Save') btns[i].onclick = window.downloadImg;
        }
      }, 50);
    }
    showToast('Image ready – use Share or Save');
  } catch (e) {
    console.error('Export failed:', e);
    showToast('Export failed: ' + (e.message || 'unknown error'));
  } finally {
    if (btn) {
      btn.textContent = 'Export as Image';
      btn.disabled = false;
    }
  }
};

// Close overlay
window.closeImgOverlay = function() {
  const overlay = document.getElementById('imgOverlay');
  if (overlay) overlay.style.display = 'none';
};