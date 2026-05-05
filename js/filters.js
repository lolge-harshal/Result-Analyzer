// ═══════════════════════════════════════════
//  FILTER & PAGINATION
// ═══════════════════════════════════════════

let filteredStudents = [...STUDENTS];
let currentPage = 1;
const PER_PAGE = 15;

function filterTable() {
  const q  = document.getElementById('searchInput').value.toLowerCase();
  const rf = document.getElementById('resultFilter').value;
  const sf = document.getElementById('sgpaFilter').value;

  filteredStudents = STUDENTS.filter(s => {
    const matchQ = !q || s.name.toLowerCase().includes(q) || s.seat.includes(q);
    const matchR = !rf || s.result === rf;
    let matchS = true;
    if      (sf === 'distinction') matchS = s.sgpa && s.sgpa >= 8;
    else if (sf === 'first')       matchS = s.sgpa && s.sgpa >= 6.5 && s.sgpa < 8;
    else if (sf === 'second')      matchS = s.sgpa && s.sgpa < 6.5;
    return matchQ && matchR && matchS;
  });

  currentPage = 1;
  renderTable();
}

function goPage(p) {
  const pages = Math.ceil(filteredStudents.length / PER_PAGE);
  if (p < 1 || p > pages) return;
  currentPage = p;
  renderTable();
}
