// ═══════════════════════════════════════════
//  EXPORT / DOWNLOAD FUNCTIONS
// ═══════════════════════════════════════════

// Helper: get stats (mirrors render.js getStats but usable here)
function _getExportStats() {
  const total = STUDENTS.length;
  const passed = STUDENTS.filter(s => s.result === "PASS").length;
  const failed = total - passed;
  const distinction = STUDENTS.filter(s => s.sgpa && s.sgpa >= 8).length;
  const firstClass = STUDENTS.filter(s => s.sgpa && s.sgpa >= 6.5 && s.sgpa < 8).length;
  const secondClass = STUDENTS.filter(s => s.sgpa && s.sgpa < 6.5).length;
  return { total, passed, failed, distinction, firstClass, secondClass };
}

// Safe mark/grade accessor — returns '—' for null (elective not taken)
const safeM = (s, sub) => (s.marks && s.marks[sub] != null) ? s.marks[sub] : '—';
const safeG = (s, sub) => (s.grades && s.grades[sub]) ? s.grades[sub] : '—';

function downloadStudentExcel() {
  const wb = XLSX.utils.book_new();
  const totalMarks = SUBJECTS.length * 100;
  const headers = [
    "Sr.No", "Seat Number", "Student Name", "Result",
    `Total Marks (out of ${totalMarks})`, "SGPA",
    ...SUBJECTS.map(s => `${s} - ${SUB_SHORT[s] || s} (Marks)`),
    ...SUBJECTS.map(s => `${s} Grade`)
  ];
  const rows = STUDENTS.map((s, i) => [
    i + 1, s.seat, s.name, s.result, s.total, s.sgpa || "—",
    ...SUBJECTS.map(sub => safeM(s, sub)),
    ...SUBJECTS.map(sub => safeG(s, sub))
  ]);
  const ws = XLSX.utils.aoa_to_sheet([
    ["Dr. Babasaheb Ambedkar Technological University"],
    ["B.Tech CSE (AI & ML) | Shreeyash College of Engineering & Technology"],
    [],
    headers,
    ...rows
  ]);
  ws['!cols'] = [
    { wch: 6 }, { wch: 18 }, { wch: 30 }, { wch: 8 }, { wch: 14 }, { wch: 7 },
    ...SUBJECTS.map(() => ({ wch: 16 })),
    ...SUBJECTS.map(() => ({ wch: 10 }))
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Student Results");
  XLSX.writeFile(wb, "SCET_StudentResults.xlsx");
  showToast("Student Results Excel downloaded!");
}

function downloadAnalysisExcel() {
  const { total, passed, failed, distinction, firstClass, secondClass } = _getExportStats();
  const wb = XLSX.utils.book_new();

  // Sheet 1: Result Summary
  const summaryData = [
    ["SHREEYASH COLLEGE OF ENGINEERING & TECHNOLOGY"],
    ["Result Analysis — B.Tech CSE AI & ML"],
    [],
    ["Sr.No", "Particulars", "Students Count", "Percentage (%)"],
    [1, "Students Appeared", total, "100%"],
    [2, "Total Students Passed", passed, `${(passed / total * 100).toFixed(2)}%`],
    [3, "Passed with Distinction (SGPA ≥ 8.0)", distinction, `${(distinction / total * 100).toFixed(2)}%`],
    [4, "Passed with First Class (SGPA 6.5–8.0)", firstClass, `${(firstClass / total * 100).toFixed(2)}%`],
    [5, "Passed with Second Class (SGPA < 6.5)", secondClass, `${(secondClass / total * 100).toFixed(2)}%`],
    [6, "Students Cleared under ATKT", "NA", "NA"],
    [7, "Students Promoted to Higher Class", "NA", "NA"],
    [8, "Students Failed", failed, `${(failed / total * 100).toFixed(2)}%`],
    [],
    ["FAILURE DISTRIBUTION"],
    ["Failed All", "Failed 4", "Failed 3", "Failed 2", "Failed 1", "All Clear"],
    [
      STUDENTS.filter(s => countFails(s) >= 7).length,
      STUDENTS.filter(s => countFails(s) === 4).length,
      STUDENTS.filter(s => countFails(s) === 3).length,
      STUDENTS.filter(s => countFails(s) === 2).length,
      STUDENTS.filter(s => countFails(s) === 1).length,
      STUDENTS.filter(s => countFails(s) === 0).length,
    ]
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
  ws1['!cols'] = [{ wch: 6 }, { wch: 45 }, { wch: 16 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Result Summary");

  // Sheet 2: Subject Grade Distribution
  const subHeaders = ["Sr.No", "Subject Code", "Subject Name", "Appeared", ...GRADE_ORDER, "Passed", "Pass%"];
  const subRows = SUBJECTS.map((sub, i) => {
    const counts = GRADE_ORDER.map(g => STUDENTS.filter(s => s.grades[sub] === g).length);
    const appeared = STUDENTS.filter(s => s.grades[sub] != null).length;
    const passedSub = GRADE_ORDER
      .filter(g => g !== "FF")
      .reduce((a, g) => a + STUDENTS.filter(s => s.grades[sub] === g).length, 0);
    const pct = appeared > 0 ? (passedSub / appeared * 100).toFixed(1) : '0.0';
    return [i + 1, sub, SUB_FULL[sub] || sub, appeared, ...counts, passedSub, `${pct}%`];
  });
  const ws2 = XLSX.utils.aoa_to_sheet([subHeaders, ...subRows]);
  ws2['!cols'] = [{ wch: 5 }, { wch: 16 }, { wch: 40 }, { wch: 9 }, ...GRADE_ORDER.map(() => ({ wch: 6 })), { wch: 8 }, { wch: 8 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Subject Grade Distribution");

  // Sheet 3: Toppers
  const toppers = [...STUDENTS].filter(s => s.sgpa).sort((a, b) => b.sgpa - a.sgpa).slice(0, 5);
  const classTopRows = toppers.map((s, i) => [i + 1, s.name, s.seat, s.total, s.sgpa]);
  const subTopRows = SUBJECTS.map((sub, i) => {
    const eligible = STUDENTS.filter(s => s.marks[sub] != null);
    if (eligible.length === 0) return [i + 1, sub, SUB_FULL[sub] || sub, 'N/A', 'N/A', 'N/A'];
    const best = eligible.reduce((a, b) => (b.marks[sub] > a.marks[sub] ? b : a));
    return [i + 1, sub, SUB_FULL[sub] || sub, best.name, best.seat, best.marks[sub]];
  });
  const ws3 = XLSX.utils.aoa_to_sheet([
    ["CLASS TOPPERS"],
    ["Rank", "Name", "Seat Number", "Total Marks", "SGPA"],
    ...classTopRows,
    [],
    ["SUBJECT TOPPERS"],
    ["Sr.No", "Subject Code", "Subject Name", "Topper Name", "Seat Number", "Marks /100"],
    ...subTopRows
  ]);
  ws3['!cols'] = [{ wch: 6 }, { wch: 30 }, { wch: 18 }, { wch: 14 }, { wch: 8 }];
  XLSX.utils.book_append_sheet(wb, ws3, "Toppers");

  XLSX.writeFile(wb, "SCET_ResultAnalysis.xlsx");
  showToast("Result Analysis Excel downloaded!");
}

function downloadCSV() {
  const headers = [
    "Sr.No", "Seat Number", "Student Name", "Result", "Total Marks", "SGPA",
    ...SUBJECTS.map(s => `${SUB_SHORT[s] || s} Marks`),
    ...SUBJECTS.map(s => `${SUB_SHORT[s] || s} Grade`)
  ];
  const rows = STUDENTS.map((s, i) => [
    i + 1, s.seat, `"${s.name}"`, s.result, s.total, s.sgpa || "",
    ...SUBJECTS.map(sub => safeM(s, sub)),
    ...SUBJECTS.map(sub => safeG(s, sub))
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'SCET_Results.csv';
  a.click();
  showToast("CSV file downloaded!");
}

function downloadJSON() {
  const { total, passed, failed, distinction, firstClass, secondClass } = _getExportStats();
  const analytics = {
    institute: "Shreeyash College of Engineering & Technology",
    totalStudents: total,
    passed, failed,
    passPercentage: parseFloat((passed / total * 100).toFixed(2)),
    distinction, firstClass, secondClass,
    subjectWise: SUBJECTS.reduce((acc, sub) => {
      const counts = {};
      GRADE_ORDER.forEach(g => { counts[g] = STUDENTS.filter(s => s.grades[sub] === g).length; });
      const appeared = STUDENTS.filter(s => s.grades[sub] != null).length;
      const passedSub = GRADE_ORDER.filter(g => g !== "FF").reduce((a, g) => a + counts[g], 0);
      acc[sub] = {
        fullName: SUB_FULL[sub] || sub,
        appeared,
        gradeDistribution: counts,
        passed: passedSub,
        passPercentage: appeared > 0 ? parseFloat((passedSub / appeared * 100).toFixed(1)) : 0
      };
      return acc;
    }, {}),
    toppers: [...STUDENTS].filter(s => s.sgpa).sort((a, b) => b.sgpa - a.sgpa).slice(0, 5)
      .map(s => ({ name: s.name, seat: s.seat, sgpa: s.sgpa, total: s.total }))
  };
  const data = { analytics, students: STUDENTS };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'SCET_Results.json';
  a.click();
  showToast("JSON data downloaded!");
}

function exportCurrentView() {
  const wb = XLSX.utils.book_new();
  const headers = [
    "Sr.No", "Seat Number", "Student Name", "Result", "Total Marks", "SGPA",
    ...SUBJECTS.map(s => `${SUB_SHORT[s] || s} (Marks)`),
    ...SUBJECTS.map(s => `${SUB_SHORT[s] || s} (Grade)`)
  ];
  const rows = filteredStudents.map((s, i) => [
    i + 1, s.seat, s.name, s.result, s.total, s.sgpa || "—",
    ...SUBJECTS.map(sub => safeM(s, sub)),
    ...SUBJECTS.map(sub => safeG(s, sub))
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, "Filtered Results");
  XLSX.writeFile(wb, `SCET_Filtered_${Date.now()}.xlsx`);
  showToast(`Exported ${filteredStudents.length} students!`);
}

function downloadChartImage() {
  const chartEl = document.getElementById('subjectPassChart');
  if (!chartEl || !chartEl.querySelector('.subpass-chart-wrap')) {
    showToast('❌ No chart to download — upload a PDF first');
    return;
  }

  const btn = document.getElementById('downloadChartBtn');
  const originalText = btn.innerHTML;
  btn.innerHTML = `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Generating…`;
  btn.disabled = true;

  try {
    // ── Build data ──────────────────────────────────────────────────────────
    const barColors = [
      '#4A6CF7', '#3ABEF9', '#00C9A7', '#F5A623', '#E84855',
      '#7B61FF', '#2CB67D', '#FF7A85', '#FFB347', '#4A90D9',
      '#9B59B6', '#1ABC9C', '#E67E22', '#2ECC71', '#E74C3C'
    ];

    const data = SUBJECTS.map((sub, i) => {
      const appeared = STUDENTS.filter(s => s.grades[sub] != null).length;
      const passedSub = GRADE_ORDER.filter(g => g !== 'FF')
        .reduce((a, g) => a + STUDENTS.filter(s => s.grades[sub] === g).length, 0);
      const pct = appeared > 0 ? parseFloat((passedSub / appeared * 100).toFixed(1)) : 0;
      const rawFull = SUB_FULL[sub] || SUB_SHORT[sub] || sub;
      const label = rawFull.split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
      return { label, pct, color: barColors[i % barColors.length] };
    });

    // ── Canvas dimensions ───────────────────────────────────────────────────
    const scale = 2;                  // retina
    const barW = 90;                 // bar column width px (logical)
    const barGap = 16;
    const padLeft = 64;                 // y-axis area
    const padRight = 30;
    const padTop = 70;                 // room for title + pct label
    const padBottom = 90;                 // room for subject name labels
    const chartH = 220;               // height of bar area
    const labelLines = 3;                 // max lines for subject name

    const totalW = padLeft + data.length * (barW + barGap) - barGap + padRight;
    const totalH = padTop + chartH + padBottom;

    const canvas = document.createElement('canvas');
    canvas.width = totalW * scale;
    canvas.height = totalH * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    // ── Background ──────────────────────────────────────────────────────────
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, totalW, totalH);

    // ── Header bar ──────────────────────────────────────────────────────────
    ctx.fillStyle = '#0B1B3E';
    ctx.fillRect(0, 0, totalW, 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px "Arial", sans-serif';
    ctx.fillText('📊  SUBJECT-WISE PASSING PERCENTAGE', 16, 26);

    // ── Y-axis grid lines & labels ──────────────────────────────────────────
    const yTicks = [0, 20, 40, 60, 80, 100];
    ctx.textAlign = 'right';
    ctx.font = '11px "Arial", sans-serif';

    yTicks.forEach(v => {
      const y = padTop + chartH - (v / 100 * chartH);
      // grid line
      ctx.strokeStyle = '#E0E5F2';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(totalW - padRight, y);
      ctx.stroke();
      ctx.setLineDash([]);
      // label
      ctx.fillStyle = '#6B7BA4';
      ctx.fillText(v + '%', padLeft - 6, y + 4);
    });

    // ── Bars ────────────────────────────────────────────────────────────────
    data.forEach((d, i) => {
      const x = padLeft + i * (barW + barGap);
      const barH = Math.max(3, d.pct / 100 * chartH);
      const y = padTop + chartH - barH;

      // bar
      ctx.fillStyle = d.color;
      // rounded top corners
      const r = 5;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + barW - r, y);
      ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
      ctx.lineTo(x + barW, y + barH);
      ctx.lineTo(x, y + barH);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();

      // percentage label above bar
      const pctColor = d.pct < 50 ? '#E84855' : d.pct < 75 ? '#F5A623' : '#2CB67D';
      ctx.fillStyle = pctColor;
      ctx.font = 'bold 12px "Arial", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.pct + '%', x + barW / 2, y - 6);

      // subject name below bar — wrap into multiple lines
      ctx.fillStyle = '#0B1B3E';
      ctx.font = '10px "Arial", sans-serif';
      ctx.textAlign = 'center';
      const words = d.label.split(' ');
      const lines = [];
      let cur = '';
      words.forEach(w => {
        const test = cur ? cur + ' ' + w : w;
        if (ctx.measureText(test).width > barW + 10) {
          if (cur) lines.push(cur);
          cur = w;
        } else {
          cur = test;
        }
      });
      if (cur) lines.push(cur);

      const lineH = 13;
      const labelY = padTop + chartH + 10;
      lines.slice(0, labelLines).forEach((ln, li) => {
        ctx.fillText(ln, x + barW / 2, labelY + li * lineH);
      });
    });

    // ── Download ────────────────────────────────────────────────────────────
    const link = document.createElement('a');
    link.download = 'SCET_SubjectWise_PassPercentage.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('✅ Chart downloaded as PNG!');

  } catch (err) {
    console.error('Chart download error:', err);
    showToast('❌ Failed to download chart');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}
