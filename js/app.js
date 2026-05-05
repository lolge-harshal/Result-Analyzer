// ═══════════════════════════════════════════
//  NAVIGATION, TOAST & INIT
// ═══════════════════════════════════════════

// ─── Navigation ───
function showPage(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');

  if (btn) {
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  } else {
    const names = ['results', 'analysis', 'downloads'];
    document.querySelectorAll('nav button').forEach((b, i) => {
      names[i] === id ? b.classList.add('active') : b.classList.remove('active');
    });
  }
}

function scrollDownloads() {
  setTimeout(() => document.querySelector('.download-grid')?.scrollIntoView({ behavior: 'smooth' }), 100);
}

// ─── Toast ───
function showToast(msg, duration = 3000) {
  const t = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), duration);
}

// ─── Server Not Running Modal ───
function showServerError() {
  // Remove existing modal if any
  const existing = document.getElementById('serverErrorModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'serverErrorModal';
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(11,27,62,0.7);z-index:9999;
    display:flex;align-items:center;justify-content:center;padding:20px;
  `;
  modal.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:36px;max-width:480px;width:100%;
                box-shadow:0 20px 60px rgba(0,0,0,0.3);text-align:center;">
      <div style="font-size:52px;margin-bottom:16px">⚠️</div>
      <h2 style="font-family:'Syne',sans-serif;font-size:20px;font-weight:800;
                 color:#0B1B3E;margin-bottom:12px">Server Not Running</h2>
      <p style="color:#6B7BA4;font-size:14px;line-height:1.7;margin-bottom:24px">
        The local server needs to be running before you can upload a PDF.<br><br>
        Please <strong>double-click <code style="background:#F0F3FA;padding:2px 6px;
        border-radius:4px;color:#1A48C4">start.bat</code></strong> (Windows) or
        <strong><code style="background:#F0F3FA;padding:2px 6px;border-radius:4px;
        color:#1A48C4">start.sh</code></strong> (Mac/Linux) in the project folder,
        then try uploading again.
      </p>
      <button onclick="document.getElementById('serverErrorModal').remove()"
        style="background:linear-gradient(135deg,#1A48C4,#0E35A0);color:#fff;
               border:none;padding:12px 28px;border-radius:10px;font-size:14px;
               font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;">
        OK, Got It
      </button>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// ─── PDF Upload Handler ───
async function handlePDFUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.name.toLowerCase().endsWith('.pdf')) {
    showToast('❌ Please upload a PDF file');
    event.target.value = '';
    return;
  }

  showToast('⏳ Processing PDF… Please wait', 30000);

  try {
    const students = await parsePDFFile(file);

    // Update STUDENTS array
    STUDENTS.length = 0;
    STUDENTS.push(...students);

    // Re-render everything
    renderTableHeader();
    renderHeroStats();
    filterTable();
    renderAnalysis();
    renderDownloads();

    showToast(`✅ Loaded ${students.length} students successfully!`);

    // Persist to localStorage
    localStorage.setItem('studentData', JSON.stringify(students));
    localStorage.setItem('studentDataTimestamp', new Date().toISOString());
    localStorage.setItem('subjectData', JSON.stringify({
      codes: SUBJECTS,
      short: SUB_SHORT,
      full: SUB_FULL
    }));

  } catch (error) {
    console.error('PDF upload error:', error);

    if (error.message === 'LOCAL_SERVER_NOT_RUNNING') {
      showServerError();
      showToast('❌ Server not running — see instructions', 5000);
    } else {
      showToast('❌ Error: ' + error.message, 6000);
    }
  }

  event.target.value = '';
}

// ─── Init: Load from localStorage if available ───
const savedData = localStorage.getItem('studentData');
const savedSubjects = localStorage.getItem('subjectData');

if (savedData) {
  try {
    const parsedData = JSON.parse(savedData);
    STUDENTS.length = 0;
    STUDENTS.push(...parsedData);

    if (savedSubjects) {
      const subjectData = JSON.parse(savedSubjects);
      SUBJECTS.length = 0;
      SUBJECTS.push(...subjectData.codes);
      Object.assign(SUB_SHORT, subjectData.short);
      Object.assign(SUB_FULL, subjectData.full);
    }

    const ts = localStorage.getItem('studentDataTimestamp');
    console.log(`Loaded ${STUDENTS.length} students from localStorage (saved: ${ts})`);
  } catch (e) {
    console.error('Error loading saved data:', e);
  }
}

renderTableHeader();
renderHeroStats();
filterTable();
renderAnalysis();
renderDownloads();
