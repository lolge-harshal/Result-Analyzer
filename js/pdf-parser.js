// ═══════════════════════════════════════════
//  PDF PARSER — Sends PDF to local Python server
//  Server must be running via start.bat / start.sh
// ═══════════════════════════════════════════

const SERVER_URL = 'http://localhost:8080';

/**
 * Check if the local server is running.
 * Returns true if reachable, false otherwise.
 */
async function checkServerHealth() {
  try {
    const res = await fetch(`${SERVER_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Main function: send PDF to local server, get back structured JSON.
 * Called from app.js handlePDFUpload().
 */
async function parsePDFFile(file) {
  // 1. Check server is running
  const serverUp = await checkServerHealth();
  if (!serverUp) {
    throw new Error(
      'LOCAL_SERVER_NOT_RUNNING'
    );
  }

  // 2. Send PDF as multipart form data
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${SERVER_URL}/parse-pdf`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown server error' }));
    throw new Error(err.error || `Server error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.students || data.students.length === 0) {
    throw new Error('No student records found in PDF. Please check the file.');
  }

  // 3. Update global subject arrays from server response
  updateGlobalSubjects(data);

  console.log(`✅ Parsed ${data.students.length} students, ${data.subjects.length} subjects`);
  return data.students;
}

/**
 * Update global SUBJECTS, SUB_SHORT, SUB_FULL arrays from server response.
 */
function updateGlobalSubjects(data) {
  SUBJECTS.length = 0;
  SUBJECTS.push(...data.subjects);

  Object.keys(SUB_SHORT).forEach(k => delete SUB_SHORT[k]);
  Object.assign(SUB_SHORT, data.subjectShort);

  Object.keys(SUB_FULL).forEach(k => delete SUB_FULL[k]);
  Object.assign(SUB_FULL, data.subjectNames);

  console.log('✅ Global subjects updated:', SUBJECTS);
}

window.parsePDFFile = parsePDFFile;
window.checkServerHealth = checkServerHealth;
