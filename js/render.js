// ═══════════════════════════════════════════
//  RENDER FUNCTIONS
// ═══════════════════════════════════════════

// ─── Computed Stats ───
function getStats() {
  const total = STUDENTS.length;
  const passed = STUDENTS.filter(s => s.result === "PASS").length;
  const failed = total - passed;
  const distinction = STUDENTS.filter(s => s.sgpa && s.sgpa >= 8).length;
  const firstClass = STUDENTS.filter(s => s.sgpa && s.sgpa >= 6.5 && s.sgpa < 8).length;
  const secondClass = STUDENTS.filter(s => s.sgpa && s.sgpa < 6.5).length;

  return { total, passed, failed, distinction, firstClass, secondClass };
}

// Only count actual FF grades (not null = subject not taken)
const countFails = s => Object.values(s.grades).filter(g => g === "FF").length;

// Helper to safely calculate percentages
const safePercent = (num, denom) => denom > 0 ? (num / denom * 100) : 0;

// ─── Hero Stats ───
function renderHeroStats() {
  const { total, passed, failed } = getStats();
  const el = document.getElementById('heroStats');
  const items = [
    { num: total, lbl: "Total Students", cls: "" },
    { num: passed, lbl: "Passed", cls: "green" },
    { num: failed, lbl: "Failed", cls: "red" },
    { num: `${safePercent(passed, total).toFixed(1)}%`, lbl: "Pass Rate", cls: "accent" },
  ];
  el.innerHTML = items.map(i =>
    `<div class="stat-box"><div class="num ${i.cls}">${i.num}</div><div class="lbl">${i.lbl}</div></div>`
  ).join('');
}

// ─── Grade chip helper ───
// g can be a grade string, 'AU' (absent), or null (subject not taken by this student)
function gradeChip(g) {
  if (g === null || g === undefined) {
    return `<span class="grade-chip" style="background:#F0F3FA;color:#B0BAD4">—</span>`;
  }
  if (g === 'AU') {
    return `<span class="grade-chip" style="background:#FFF3E0;color:#E65100;font-size:10px">AU</span>`;
  }
  return `<span class="grade-chip grade-${g}">${g}</span>`;
}

// ─── Render Table Header (Dynamic) ───
function renderTableHeader() {
  const thead = document.getElementById('tableHead');
  if (!thead) return;

  // If no subjects loaded yet, show placeholder
  if (SUBJECTS.length === 0) {
    thead.innerHTML = `
      <tr>
        <th>#</th>
        <th>Seat No.</th>
        <th>Student Name</th>
        <th>Result</th>
        <th>Total</th>
        <th>SGPA</th>
        <th colspan="5" style="text-align:center;color:var(--muted);font-weight:400">
          Upload PDF to load subjects
        </th>
      </tr>`;
    return;
  }

  const subjectHeaders = SUBJECTS.map(sub =>
    `<th>${SUB_SHORT[sub] || sub}</th>`
  ).join('');

  // Calculate total marks (assuming 100 per subject)
  const totalMarks = SUBJECTS.length * 100;

  thead.innerHTML = `
    <tr>
      <th>#</th>
      <th>Seat No.</th>
      <th>Student Name</th>
      <th>Result</th>
      <th>Total /${totalMarks}</th>
      <th>SGPA</th>
      ${subjectHeaders}
    </tr>`;
}

// ─── Results Table ───
function renderTable() {
  const tbody = document.getElementById('tableBody');

  // Handle empty state
  if (STUDENTS.length === 0 || SUBJECTS.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="20" style="text-align:center;padding:40px;color:var(--muted)">
          <div style="font-size:48px;margin-bottom:15px">📤</div>
          <div style="font-size:16px;font-weight:600;margin-bottom:8px">No Data Available</div>
          <div style="font-size:14px">Upload a PDF file to view student results</div>
        </td>
      </tr>`;
    document.getElementById('tableCount').textContent = '0 students';
    document.getElementById('paginationEl').innerHTML = '';
    return;
  }

  const start = (currentPage - 1) * PER_PAGE;
  const slice = filteredStudents.slice(start, start + PER_PAGE);

  tbody.innerHTML = slice.map((s, i) => `
    <tr class="${s.result === 'PASS' ? 'pass-row' : 'fail-row'}">
      <td>${start + i + 1}</td>
      <td class="seat-cell">${s.seat || 'N/A'}</td>
      <td class="name-cell">${s.name || 'N/A'}</td>
      <td><span class="result-badge ${(s.result || 'fail').toLowerCase()}">${s.result || 'N/A'}</span></td>
      <td class="total-marks">${s.total || 0}</td>
      <td class="sgpa-num">${s.sgpa || '—'}</td>
      ${SUBJECTS.map(sub => {
    const grade = s.grades ? s.grades[sub] : null;
    const marks = (s.marks && s.marks[sub] != null) ? s.marks[sub] : null;
    return `<td>${gradeChip(grade)}<br>
          <span class="marks-num" style="font-size:11px;color:var(--muted)">${marks !== null ? marks : '—'}</span>
        </td>`;
  }).join('')}
    </tr>`).join('');

  document.getElementById('tableCount').textContent = `${filteredStudents.length} students`;
  renderPagination();
}

// ─── Pagination ───
function renderPagination() {
  const pages = Math.ceil(filteredStudents.length / PER_PAGE);
  const el = document.getElementById('paginationEl');
  if (pages <= 1) { el.innerHTML = ''; return; }

  let html = `<span class="page-info">Showing ${(currentPage - 1) * PER_PAGE + 1}–${Math.min(currentPage * PER_PAGE, filteredStudents.length)} of ${filteredStudents.length}</span>`;
  html += `<button class="page-btn" onclick="goPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>‹</button>`;

  for (let p = 1; p <= pages; p++) {
    if (pages > 7 && (p > 2 && p < pages - 1 && Math.abs(p - currentPage) > 1)) {
      if (p === 3 || p === pages - 2) html += '<span style="padding:0 4px;color:var(--muted)">…</span>';
      continue;
    }
    html += `<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="goPage(${p})">${p}</button>`;
  }

  html += `<button class="page-btn" onclick="goPage(${currentPage + 1})" ${currentPage === pages ? 'disabled' : ''}>›</button>`;
  el.innerHTML = html;
}

// ─── Analysis Page ───
function renderAnalysis() {
  const { total, passed, failed, distinction, firstClass, secondClass } = getStats();

  // Handle empty student array
  if (STUDENTS.length === 0) {
    document.getElementById('summaryTable').innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--muted)">No student data available. Please upload a PDF.</td></tr>';
    document.getElementById('passfailBars').innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">No data to display</div>';
    document.getElementById('sgpaChart').innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">No data to display</div>';
    document.getElementById('failGrid').innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">No data to display</div>';
    document.getElementById('subjectTable').innerHTML = '<thead><tr><th>#</th><th>Subject</th><th>Appeared</th>' + GRADE_ORDER.map(g => `<th>${g}</th>`).join('') + '<th>Passed</th><th>Pass%</th></tr></thead><tbody><tr><td colspan="15" style="text-align:center;padding:20px;color:var(--muted)">No data to display</td></tr></tbody>';
    document.getElementById('subjectPassChart').innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">No data to display</div>';
    document.getElementById('classToppers').innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">No data to display</div>';
    document.getElementById('subjectToppers').innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">No data to display</div>';
    return;
  }

  // Result Summary table
  const summary = [
    [1, "Students Appeared", total, "100%"],
    [2, "Total Students Passed", passed, `${safePercent(passed, total).toFixed(2)}%`],
    [3, "Passed with Distinction (SGPA ≥ 8.0)", distinction, `${safePercent(distinction, total).toFixed(2)}%`],
    [4, "Passed with First Class (SGPA 6.5–8.0)", firstClass, `${safePercent(firstClass, total).toFixed(2)}%`],
    [5, "Passed with Second Class (SGPA < 6.5)", secondClass, `${safePercent(secondClass, total).toFixed(2)}%`],
    [6, "Students Cleared under ATKT", "NA", "NA"],
    [7, "Students Promoted to Higher Class", "NA", "NA"],
    [8, "Students Failed", failed, `${safePercent(failed, total).toFixed(2)}%`],
  ];
  document.getElementById('summaryTable').innerHTML = summary.map(r =>
    `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`
  ).join('');

  // Pass/Fail progress bars
  const pfBars = [
    { lbl: "Pass Rate", val: safePercent(passed, total), color: "var(--green)" },
    { lbl: "Distinction", val: safePercent(distinction, total), color: "var(--accent)" },
    { lbl: "First Class", val: safePercent(firstClass, total), color: "var(--blue)" },
    { lbl: "Second Class", val: safePercent(secondClass, total), color: "var(--teal)" },
    { lbl: "Failed", val: safePercent(failed, total), color: "var(--red)" },
  ];
  document.getElementById('passfailBars').innerHTML = pfBars.map(b => `
    <div class="prog-row">
      <div class="prog-label">${b.lbl}</div>
      <div class="prog-bar-wrap">
        <div class="prog-bar" style="width:${b.val}%;background:${b.color}" data-w="${b.val}"></div>
      </div>
      <div class="prog-val">${b.val.toFixed(1)}%</div>
    </div>`).join('');

  // SGPA distribution chart
  const sgpaBuckets = [
    { lbl: "<5.0", min: 0, max: 5 },
    { lbl: "5–6", min: 5, max: 6 },
    { lbl: "6–6.5", min: 6, max: 6.5 },
    { lbl: "6.5–7", min: 6.5, max: 7 },
    { lbl: "7–7.5", min: 7, max: 7.5 },
    { lbl: "7.5–8", min: 7.5, max: 8 },
    { lbl: "8+", min: 8, max: 100 },
  ];
  const maxCount = Math.max(0, ...sgpaBuckets.map(b =>
    STUDENTS.filter(s => s.sgpa && s.sgpa >= b.min && s.sgpa < b.max).length
  ));
  const colors = ['#FF7A85', '#FFB347', '#FFD700', '#7BC8A4', '#4A90D9', 'var(--blue)', 'var(--accent)'];

  document.getElementById('sgpaChart').innerHTML = `
    <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:8px;letter-spacing:.5px">SGPA DISTRIBUTION</div>
    <div class="chart-bars">
      ${sgpaBuckets.map((b, i) => {
    const cnt = STUDENTS.filter(s => s.sgpa && s.sgpa >= b.min && s.sgpa < b.max).length;
    const h = maxCount > 0 ? (cnt / maxCount * 88) : 0;
    return `<div class="bar-wrap">
          <div class="bar-val">${cnt || ''}</div>
          <div class="bar" style="height:${h}px;background:${colors[i]}"></div>
          <div class="bar-lbl">${b.lbl}</div>
        </div>`;
  }).join('')}
    </div>`;

  // Failure distribution
  const failBuckets = [
    { label: "Failed in All\nSubjects", count: STUDENTS.filter(s => countFails(s) >= 7).length },
    { label: "Failed in\n4 Subjects", count: STUDENTS.filter(s => countFails(s) === 4).length },
    { label: "Failed in\n3 Subjects", count: STUDENTS.filter(s => countFails(s) === 3).length },
    { label: "Failed in\n2 Subjects", count: STUDENTS.filter(s => countFails(s) === 2).length },
    { label: "Failed in\n1 Subject", count: STUDENTS.filter(s => countFails(s) === 1).length },
    { label: "All Clear", count: STUDENTS.filter(s => countFails(s) === 0).length },
  ];
  document.getElementById('failGrid').innerHTML = failBuckets.map(b => `
    <div class="fail-box">
      <div class="f-num">${b.count}</div>
      <div class="f-lbl">${b.label.replace('\n', '<br>')}</div>
    </div>`).join('');

  // Subject-wise grade distribution table
  const gradeColors = {
    "EX": "#E65100", "AA": "#1B5E20", "AB": "#0D47A1", "BB": "#283593",
    "BC": "#4A148C", "CC": "#006064", "CD": "#33691E", "DD": "#F57F17",
    "DE": "#BF360C", "EE": "#880E4F", "FF": "#B71C1C"
  };
  const subRows = SUBJECTS.map((sub, i) => {
    const counts = {};
    GRADE_ORDER.forEach(g => { counts[g] = STUDENTS.filter(s => s.grades[sub] === g).length; });
    const passedSub = GRADE_ORDER.filter(g => g !== "FF").reduce((a, g) => a + counts[g], 0);
    const pct = safePercent(passedSub, total).toFixed(1);
    return `<tr>
      <td>${i + 1}</td>
      <td style="text-align:left">${sub}<br><span style="font-weight:400;font-size:11px;color:var(--muted)">${SUB_FULL[sub]}</span></td>
      <td>${total}</td>
      ${GRADE_ORDER.map(g => `<td style="color:${counts[g] ? gradeColors[g] : ''};font-weight:${counts[g] ? '700' : '400'}">${counts[g] || '—'}</td>`).join('')}
      <td>${passedSub}</td>
      <td class="pass-pct ${parseFloat(pct) < 60 ? 'low' : ''}">${pct}%</td>
    </tr>`;
  });
  document.getElementById('subjectTable').innerHTML = `
    <thead><tr>
      <th>#</th><th>Subject</th><th>Appeared</th>
      ${GRADE_ORDER.map(g => `<th>${g}</th>`).join('')}
      <th>Passed</th><th>Pass%</th>
    </tr></thead>
    <tbody>${subRows.join('')}</tbody>`;

  // Subject-wise Passing Percentage Bar Chart
  const subPassData = SUBJECTS.map(sub => {
    const appeared = STUDENTS.filter(s => s.grades[sub] != null).length;
    const passedSub = GRADE_ORDER.filter(g => g !== "FF")
      .reduce((a, g) => a + STUDENTS.filter(s => s.grades[sub] === g).length, 0);
    const pct = appeared > 0 ? parseFloat((passedSub / appeared * 100).toFixed(1)) : 0;
    return { sub, label: SUB_SHORT[sub] || sub, full: SUB_FULL[sub] || sub, pct, passedSub, appeared };
  });

  const barColors = [
    '#4A6CF7', '#3ABEF9', '#00C9A7', '#F5A623', '#E84855',
    '#7B61FF', '#2CB67D', '#FF7A85', '#FFB347', '#4A90D9',
    '#9B59B6', '#1ABC9C', '#E67E22', '#2ECC71', '#E74C3C'
  ];

  const chartHeight = 220;
  const barMinH = 4;

  document.getElementById('subjectPassChart').innerHTML = `
    <div class="subpass-chart-wrap">
      <div class="subpass-y-axis">
        ${[100, 80, 60, 40, 20, 0].map(v => `
          <div class="subpass-y-label" style="bottom:${v / 100 * chartHeight}px">${v}%</div>
          <div class="subpass-grid-line" style="bottom:${v / 100 * chartHeight}px"></div>
        `).join('')}
      </div>
      <div class="subpass-bars-area">
        ${subPassData.map((d, i) => {
    const barH = Math.max(barMinH, d.pct / 100 * chartHeight);
    const color = barColors[i % barColors.length];
    const textColor = d.pct < 50 ? 'var(--red)' : d.pct < 75 ? 'var(--accent)' : 'var(--green)';
    return `
            <div class="subpass-bar-col" title="${d.full}: ${d.pct}% (${d.passedSub}/${d.appeared})">
              <div class="subpass-pct-label" style="color:${textColor}">${d.pct}%</div>
              <div class="subpass-bar-inner" style="height:${barH}px;background:${color}"></div>
              <div class="subpass-sub-label">${d.label}</div>
            </div>`;
  }).join('')}
      </div>
    </div>`;

  // Class Toppers
  const toppers = [...STUDENTS].filter(s => s.sgpa).sort((a, b) => b.sgpa - a.sgpa).slice(0, 5);
  const rankBg = ['rank-1', 'rank-2', 'rank-3', 'rank-n', 'rank-n'];
  document.getElementById('classToppers').innerHTML = toppers.map((s, i) => `
    <div class="topper-row">
      <div class="rank-badge ${rankBg[i]}">${i + 1}</div>
      <div class="topper-info">
        <div class="topper-name">${s.name}</div>
        <div class="topper-seat">${s.seat}</div>
      </div>
      <div>
        <div class="topper-sgpa">${s.sgpa}</div>
        <div class="topper-marks">${s.total}/700</div>
      </div>
    </div>`).join('');

  // Subject Toppers
  const subToppers = SUBJECTS.map(sub => {
    if (STUDENTS.length === 0) return { sub, name: "N/A", seat: "N/A", marks: 0 };
    const best = STUDENTS.reduce((a, b) => b.marks[sub] > a.marks[sub] ? b : a);
    return { sub, name: best.name, seat: best.seat, marks: best.marks[sub] };
  });
  document.getElementById('subjectToppers').innerHTML = subToppers.map(t => `
    <div class="sub-topper-row">
      <div>
        <div style="font-weight:600;font-size:13px">${t.name}</div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:3px">
          <span class="sub-topper-code">${t.sub}</span>
          <span style="font-size:11.5px;color:var(--muted)">${SUB_SHORT[t.sub]}</span>
        </div>
      </div>
      <div class="sub-topper-marks">${t.marks}<span style="font-size:12px;font-weight:500;color:var(--muted)">/100</span></div>
    </div>`).join('');
}

// ─── Downloads Page ───
function renderDownloads() {
  const cards = [
    {
      icon: "📗", cls: "xlsx",
      title: "Student Results — Excel (.xlsx)",
      desc: "Complete marksheet with all 38 students, subject-wise marks, grades, SGPA, and result status. Color-coded for Pass/Fail.",
      meta: "38 students · 7 subjects · All grades",
      fn: downloadStudentExcel
    },
    {
      icon: "📘", cls: "xlsx",
      title: "Result Analysis — Excel (.xlsx)",
      desc: "Full formatted result analysis: summary, failure distribution, subject-wise grade distribution, class & subject toppers.",
      meta: "Result summary · Toppers · Grade stats",
      fn: downloadAnalysisExcel
    },
    {
      icon: "📄", cls: "csv",
      title: "Student Results — CSV (.csv)",
      desc: "Plain CSV file with all student data, marks and grades. Ideal for importing into any spreadsheet tool or database.",
      meta: "UTF-8 · Comma-separated · 38 rows",
      fn: downloadCSV
    },
    {
      icon: "📦", cls: "json",
      title: "Full Data — JSON (.json)",
      desc: "Complete structured data export including all student records and computed result analytics in JSON format.",
      meta: "Pretty-printed · All fields included",
      fn: downloadJSON
    },
  ];

  document.getElementById('downloadGrid').innerHTML = cards.map((c, i) => `
    <div class="dl-card">
      <div class="dl-icon ${c.cls}">${c.icon}</div>
      <div>
        <div class="dl-title">${c.title}</div>
        <div class="dl-desc">${c.desc}</div>
      </div>
      <div class="dl-meta">${c.meta}</div>
      <button class="btn btn-primary" onclick="dlCards[${i}].fn()">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Download
      </button>
    </div>`).join('');

  window.dlCards = cards;
}
