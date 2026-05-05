"""
SCET Result Portal - Local PDF Parser Server
Run this file to start the local server, then open the portal in your browser.
"""

import re
import os
import json
import tempfile
from collections import defaultdict
from flask import Flask, request, jsonify
from flask_cors import CORS
import pdfplumber

# Load .env if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

app = Flask(__name__)
CORS(app)

VALID_GRADES = {"EX", "AA", "AB", "BB", "BC", "CC", "CD", "DD", "DE", "EE", "FF"}

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()


# ─── Gemini Parser ────────────────────────────────────────────────────────────

def _clean_gemini_json(raw):
    """Strip markdown fences and return clean JSON string."""
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r'^```[a-z]*\n?', '', raw)
        raw = re.sub(r'\n?```$', '', raw)
    return raw.strip()


def _has_student_data(page_text):
    """Return True if this page contains at least one seat number (student record)."""
    return bool(re.search(r'\b2[0-9]\d{11,15}\b', page_text))


def _extract_pages(pdf_path):
    """Return list of (page_num, page_text) for pages that have student data."""
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            if text.strip():
                pages.append((i + 1, text))
    return pages


def _gemini_call(client, prompt):
    """Make a single Gemini API call and return the text response."""
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt,
        config={
            "max_output_tokens": 4096,
            "temperature": 0
        }
    )
    return response.text


def _gemini_extract_subjects(client, pages):
    """One Gemini call on the first few pages to extract subject metadata."""
    sample = "\n\n".join(f"--- PAGE {n} ---\n{t}" for n, t in pages[:3])
    prompt = f"""
You are a precise data extraction assistant. Below is raw text from a university exam result PDF.

Extract the subject information and return ONLY a valid compact JSON object — no markdown, no explanation.

Schema:
{{
  "subjects": ["CODE1", "CODE2", ...],
  "subjectNames": {{ "CODE1": "Full Subject Name", ... }},
  "subjectShort": {{ "CODE1": "Short abbreviation max 15 chars", ... }}
}}

Rules:
- List every unique subject code that appears, in the order they first appear.
- Subject codes look like: 25AF1000BS301, 25AF1245PC302, 25AFAIPC304, etc.
- subjectNames: full name exactly as printed (e.g. "DATA STRUCTURES").
- subjectShort: short abbreviation using initials of key words, max 15 chars.
  Skip stop words: AND OF THE FOR IN WITH A AN BY TO.
- Return ONLY the JSON. No markdown fences.

PDF TEXT:
{sample}
"""
    raw = _gemini_call(client, prompt)
    data = json.loads(_clean_gemini_json(raw))
    return data.get("subjects", []), data.get("subjectNames", {}), data.get("subjectShort", {})


def _gemini_extract_page(client, page_num, page_text, subjects):
    """
    Extract all student records from a single page.
    Each page has 2-3 students and its own subject header — self-contained.
    Returns list of student dicts.
    """
    subjects_str = json.dumps(subjects)
    prompt = f"""
You are a precise data extraction assistant. Below is raw text from ONE page of a university exam result PDF.

All subject codes in this exam: {subjects_str}

Extract ALL student records from this page and return ONLY a compact JSON array.
No markdown, no explanation — just the raw JSON array.

Each student object must follow this exact schema:
{{
  "seat": "full seat/enrollment number as printed",
  "name": "STUDENT FULL NAME IN CAPS",
  "result": "PASS" or "FAIL",
  "total": <integer total marks, 0 if not found>,
  "sgpa": <float e.g. 7.45, or null if FAIL or not printed>,
  "marks": {{ "CODE": <integer or null> }},
  "grades": {{ "CODE": "AA" or "FF" etc., or null }}
}}

Important notes:
- A student's seat number is a long numeric string (14-16 digits).
- Names appear in ALL CAPS after the seat number.
- PASS students have an SGPA printed (e.g. 7.45). FAIL students have null.
- "total" is the single 3-4 digit integer on its own line (e.g. 621, 534) — this is the grand total marks.
- Per-subject marks are on the line with 11 three-digit numbers (e.g. "044 040 061 050 047 051 054 068 065 073 068"). Use these as the marks for each subject in order.
- Grades are on the line with patterns like "5/EE/15 8/BB/8 6.5/CD/19.5" — the middle part (EE, BB, CD etc.) is the grade for each subject in order.
- For marks/grades: use null ONLY if the subject is genuinely not in this student's subject list (different elective).
- This page may have 1, 2, or 3 students — extract all of them.
- Return ONLY the JSON array. No markdown fences, no extra text.

PAGE {page_num} TEXT:
{page_text}
"""
    raw = _gemini_call(client, prompt)
    parsed = json.loads(_clean_gemini_json(raw))
    if isinstance(parsed, dict) and "students" in parsed:
        return parsed["students"]
    if isinstance(parsed, list):
        return parsed
    return []


def parse_pdf_with_gemini(pdf_file):
    """
    Strategy: process the PDF page by page.
    Each page is self-contained (has its own subject header + 2-3 students).
    One Gemini call per page = no output token limit issues, ever.
    """
    from google import genai

    client = genai.Client(api_key=GEMINI_API_KEY)

    # Save uploaded FileStorage to a temp file
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        pdf_file.save(tmp)
        tmp_path = tmp.name

    try:
        print("  [Gemini] Extracting pages from PDF...")
        all_pages = _extract_pages(tmp_path)
        student_pages = [(n, t) for n, t in all_pages if _has_student_data(t)]
        print(f"  [Gemini] Found {len(all_pages)} pages total, "
              f"{len(student_pages)} contain student records")

        # Step 1: Extract subject metadata from first few pages
        print("  [Gemini] Extracting subject metadata...")
        subjects, subject_names, subject_short = _gemini_extract_subjects(client, all_pages)
        print(f"  [Gemini] Found {len(subjects)} subjects: {subjects}")

        if not subjects:
            raise ValueError("Could not extract subject codes from PDF")

        # Step 2: Process each student page individually
        all_students = []
        seen_seats = set()

        for idx, (page_num, page_text) in enumerate(student_pages):
            print(f"  [Gemini] Page {page_num} ({idx+1}/{len(student_pages)})...")
            try:
                students = _gemini_extract_page(client, page_num, page_text, subjects)
                added = 0
                for s in students:
                    seat = str(s.get("seat", "")).strip()
                    if not seat:
                        continue
                    if seat in seen_seats:
                        continue
                    seen_seats.add(seat)
                    s.setdefault("marks", {})
                    s.setdefault("grades", {})
                    for code in subjects:
                        s["marks"].setdefault(code, None)
                        s["grades"].setdefault(code, None)
                    all_students.append(s)
                    added += 1
                print(f"    → {added} student(s) added (total: {len(all_students)})")
            except Exception as e:
                print(f"    → ERROR on page {page_num}: {e}")

        if not all_students:
            raise ValueError("No student records extracted by Gemini")

        print(f"\n=== GEMINI PARSE SUMMARY ===")
        print(f"  Students : {len(all_students)}")
        print(f"  Subjects : {len(subjects)}")

        return {
            "subjects": subjects,
            "subjectNames": subject_names,
            "subjectShort": subject_short,
            "students": all_students
        }

    finally:
        os.unlink(tmp_path)


# ─── Legacy pdfplumber helpers ────────────────────────────────────────────────

def make_short_name(full_name):
    name = re.sub(r'\(.*?\)', '', full_name).strip()
    words = name.split()
    stop = {'AND', 'THE', 'OF', 'TO', 'IN', 'FOR', 'WITH', 'A', 'AN', 'AT', 'BY'}
    words = [w for w in words if w.upper() not in stop]
    if not words:
        return full_name[:12]
    if len(words) <= 2:
        return ' '.join(words)[:15]
    abbr = ''.join(w[0] for w in words[:-1])
    return f"{abbr}.{words[-1]}"[:15]


def extract_lines_from_words(page):
    words = page.extract_words()
    if not words:
        return []
    rows = defaultdict(list)
    for w in words:
        y_bucket = round(w['top'] / 4) * 4
        rows[y_bucket].append((w['x0'], w['text']))
    lines = []
    for y in sorted(rows.keys()):
        row_words = sorted(rows[y], key=lambda x: x[0])
        lines.append(' '.join(t for _, t in row_words))
    return lines


def parse_subject_names(full_text):
    """
    Extract code->name from lines like:
      25AF1000BS301 : ENGINEERING MATHEMATICS - III (Credit :3)
    Also builds a prefix lookup so truncated column codes (e.g. 25AF1000BS30)
    can be matched to their full names.
    """
    subjects = {}
    pattern = re.compile(
        r'([A-Z0-9]{5,})\s*:\s*([A-Z][A-Z0-9\s\-&/(),\u2013]+?)\s*\(Credit\s*:\s*[\d.]+\s*\)',
        re.IGNORECASE
    )
    for m in pattern.finditer(full_text):
        code = m.group(1).strip()
        name = re.sub(r'\s+', ' ', m.group(2)).strip()
        subjects[code] = name
    return subjects


def resolve_subject_names(column_codes, raw_names):
    """
    Map truncated column codes (e.g. '25AF1000BS30') to full subject names.
    Strategy: for each column code, find the raw_names key that starts with
    that column code (the column code is a prefix of the full PDF code).
    Falls back to the column code itself if no match found.
    """
    resolved_names = {}
    resolved_short = {}

    for col_code in column_codes:
        # Direct match first
        if col_code in raw_names:
            resolved_names[col_code] = raw_names[col_code]
            resolved_short[col_code] = make_short_name(raw_names[col_code])
            continue

        # Prefix match: find a raw code that starts with col_code
        match = None
        for raw_code, name in raw_names.items():
            if raw_code.startswith(col_code):
                match = name
                break

        if match:
            resolved_names[col_code] = match
            resolved_short[col_code] = make_short_name(match)
        else:
            # No match — keep the code as-is
            resolved_names[col_code] = col_code
            resolved_short[col_code] = col_code[:15]

    return resolved_names, resolved_short


def parse_column_subjects(lines, start_idx):
    if start_idx >= len(lines):
        return []

    line_a = re.sub(r'Total\s+Marks\s*\(\d+\)', '', lines[start_idx]).strip()
    tokens_a = line_a.split()

    code_pat = re.compile(r'^(25AF|24AF|BT|BTES|BTBS|BTCO|BTCOL|BTCOS|BTHM|BTUHV)', re.IGNORECASE)
    subject_tokens = [t for t in tokens_a if code_pat.match(t)]

    if not subject_tokens:
        return []

    if start_idx + 1 < len(lines):
        line_b = lines[start_idx + 1].strip()
        tokens_b = line_b.split()
        is_suffix = (
            len(tokens_b) >= 2 and
            all(re.match(r'^[A-Z0-9]{1,5}$', t) for t in tokens_b) and
            not any(code_pat.match(t) for t in tokens_b)
        )
        if is_suffix and len(tokens_b) <= len(subject_tokens):
            merged = []
            for j, tok in enumerate(subject_tokens):
                merged.append(tok + tokens_b[j] if j < len(tokens_b) else tok)
            return merged

    return subject_tokens


def parse_grade_line(line):
    tokens = []
    grade_re = re.compile(r'\d+(?:\.\d+)?/([A-Z]{2})/\d+(?:\.\d+)?(?:\([^)]*\))?')
    for part in line.split():
        m = grade_re.match(part)
        if m and m.group(1) in VALID_GRADES:
            tokens.append(m.group(1))
        elif part == 'AU':
            tokens.append('AU')
    return tokens


def parse_totals_line(line):
    line = line.replace('|', '')
    nums = re.findall(r'\((\d{2,3})\)|(?<![/.\d])(\d{2,3})(?![/.\d])', line)
    result = []
    for paren, bare in nums:
        result.append(int(paren if paren else bare))
    return result


# ─── Legacy pdfplumber main parser ────────────────────────────────────────────

def parse_pdf_legacy(pdf_file):
    all_subjects_ordered = []
    subject_names = {}
    subject_short = {}
    raw_blocks = []

    with pdfplumber.open(pdf_file) as pdf:

        # Pass 1: extract subject full names from page 1 text
        full_text = ""
        for page in pdf.pages:
            full_text += (page.extract_text() or "") + "\n"
        raw_names = parse_subject_names(full_text)

        current_subjects = []   # persists across pages

        for page in pdf.pages:
            lines = extract_lines_from_words(page)

            # Index lines by their content for easy lookup
            # We'll process sequentially but use lookahead by index
            i = 0
            while i < len(lines):
                line = lines[i]

                # ── Detect subject header ──────────────────────────────────
                if re.search(r'\b(CORE|ELECTIVE)\b', line) and 'Tot.GrP.' in line:
                    parsed = parse_column_subjects(lines, i + 1)
                    if parsed:
                        current_subjects = parsed
                        for code in current_subjects:
                            if code not in subject_names:
                                subject_names[code] = code
                                subject_short[code] = code[:12]
                    i += 1
                    continue

                # ── Detect student record line ─────────────────────────────
                seat_match = re.search(r'\b(2[0-9]\d{11,15})\b', line)
                if seat_match and current_subjects:
                    seat = seat_match.group(1)

                    # Extract name
                    after_seat = line[line.index(seat) + len(seat):]
                    after_seat = re.sub(r'^\s*\(F\)\s*', '', after_seat).strip()
                    nm = re.search(r'^([A-Z][A-Z\s]+?)\s+\d{5}\s*-', after_seat)
                    if nm:
                        name = nm.group(1).strip()
                    else:
                        nm2 = re.match(r'^([A-Z][A-Z\s]+?)\s+(?:PASS|FAIL)', after_seat)
                        name = nm2.group(1).strip() if nm2 else 'UNKNOWN'

                    result = 'PASS' if 'PASS' in line else 'FAIL'

                    # ── Scan ahead for the data lines ──────────────────────
                    # Structure after seat line:
                    #   line+1: ESE marks (3-digit nums) [+ SGPA at end for PASS]
                    #   line+2: "02112 (Whole) ..." CA marks
                    #   line+3: total_marks (single integer like 621)
                    #   line+4: MID marks
                    #   line+5: TOTAL per-subject marks (3-digit, 11 values)
                    #   line+6: grade tokens  X/GG/Y ...
                    #
                    # BUT layout shifts when SGPA is on its own line.
                    # Strategy: scan next 10 lines, identify each by content.

                    sgpa = None
                    total = 0
                    totals_line = ''
                    grade_line = ''

                    lookahead = lines[i+1:i+12]

                    for la_line in lookahead:
                        # SGPA: a float like 6.06 or 7.45 standing alone or at end
                        if sgpa is None and result == 'PASS':
                            sm = re.search(r'\b(\d\.\d{2})\b', la_line)
                            if sm:
                                # Make sure it's not a grade ratio like 6.5/CD
                                if '/' not in la_line or la_line.strip().replace('.','').replace(' ','').isdigit():
                                    sgpa = float(sm.group(1))

                        # Grade line: contains X/GG/Y patterns
                        if re.search(r'\d+(?:\.\d+)?/[A-Z]{2}/\d+', la_line):
                            grade_line = la_line

                        # Total marks line: 11 three-digit numbers (subject totals)
                        # Pattern: multiple 2-3 digit numbers, no slashes
                        nums_only = re.findall(r'\b(\d{2,3})\b', la_line)
                        if (len(nums_only) >= 10 and
                                '/' not in la_line and
                                not re.search(r'[A-Z]{2,}', la_line) and
                                'TOTAL' not in la_line.upper() and
                                'CREDIT' not in la_line.upper() and
                                'INTERNAL' not in la_line.upper()):
                            totals_line = la_line

                        # Overall total: single integer 3-4 digits on its own line
                        stripped = la_line.strip()
                        if re.match(r'^\d{3,4}$', stripped) and total == 0:
                            total = int(stripped)

                    # Parse totals and grades
                    totals = parse_totals_line(totals_line)
                    grade_tokens = parse_grade_line(grade_line)

                    marks  = {}
                    grades = {}
                    for idx, subj in enumerate(current_subjects):
                        grades[subj] = grade_tokens[idx] if idx < len(grade_tokens) else None
                        marks[subj]  = totals[idx]       if idx < len(totals)        else None

                    raw_blocks.append({
                        'subjects': list(current_subjects),
                        'student': {
                            'seat': seat, 'name': name, 'result': result,
                            'total': total, 'sgpa': sgpa,
                            'marks': marks, 'grades': grades
                        }
                    })

                i += 1

    # Build master subject list
    seen_codes = set()
    for block in raw_blocks:
        for code in block['subjects']:
            if code not in seen_codes:
                seen_codes.add(code)
                all_subjects_ordered.append(code)

    # Resolve subject names using prefix matching
    subject_names, subject_short = resolve_subject_names(all_subjects_ordered, raw_names)

    # Fill null for missing subjects
    students = []
    for block in raw_blocks:
        s = block['student']
        for code in all_subjects_ordered:
            s['marks'].setdefault(code, None)
            s['grades'].setdefault(code, None)
        students.append(s)

    # Deduplicate by seat number
    seen_seats = {}
    deduped = []
    for s in students:
        if s['seat'] not in seen_seats:
            seen_seats[s['seat']] = s
            deduped.append(s)
        else:
            existing = seen_seats[s['seat']]
            for code in all_subjects_ordered:
                if existing['grades'].get(code) is None and s['grades'].get(code) is not None:
                    existing['grades'][code] = s['grades'][code]
                    existing['marks'][code]  = s['marks'].get(code)
            if not existing['total'] and s['total']:
                existing['total'] = s['total']
            if not existing['sgpa'] and s['sgpa']:
                existing['sgpa'] = s['sgpa']

    print(f"\n=== LEGACY PARSE SUMMARY ===")
    print(f"  Students : {len(deduped)}")
    print(f"  Subjects : {len(all_subjects_ordered)}")
    if deduped:
        s0 = deduped[0]
        print(f"  Sample   : {s0['seat']} | {s0['name']} | {s0['result']} | {s0['total']} | {s0['sgpa']}")
        print(f"  Grades   : {s0['grades']}")
        print(f"  Marks    : {s0['marks']}")

    return {
        'subjects': all_subjects_ordered,
        'subjectNames': subject_names,
        'subjectShort': subject_short,
        'students': deduped
    }


# ─── Unified parse entry point ────────────────────────────────────────────────

def parse_pdf(pdf_file):
    """
    Try Gemini first if API key is configured.
    Fall back to legacy pdfplumber parser on any error.
    """
    if GEMINI_API_KEY:
        try:
            return parse_pdf_with_gemini(pdf_file)
        except Exception as e:
            print(f"  [Gemini] Failed: {e}. Falling back to legacy parser...")
            # Reset file pointer for pdfplumber
            pdf_file.seek(0)

    print("  [Legacy] Using pdfplumber parser...")
    return parse_pdf_legacy(pdf_file)


# ─── Flask routes ──────────────────────────────────────────────────────────────

@app.route('/parse-pdf', methods=['POST'])
def parse_pdf_route():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    f = request.files['file']
    if not f.filename.lower().endswith('.pdf'):
        return jsonify({'error': 'File must be a PDF'}), 400
    try:
        result = parse_pdf(f)
        return jsonify(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'message': 'SCET Result Portal server is running',
        'gemini': bool(GEMINI_API_KEY)
    })


@app.route('/', methods=['GET'])
def serve_index():
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'index.html')
    with open(path, 'r', encoding='utf-8') as fh:
        return fh.read(), 200, {'Content-Type': 'text/html; charset=utf-8'}


@app.route('/<path:filename>', methods=['GET'])
def serve_static(filename):
    from flask import send_from_directory
    base = os.path.dirname(os.path.abspath(__file__))
    full = os.path.join(base, filename)
    if os.path.isfile(full):
        return send_from_directory(os.path.dirname(full), os.path.basename(full))
    return "Not found", 404


# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == '__main__':
    import webbrowser, threading, time

    port = 8080
    url  = f'http://localhost:{port}'

    print("=" * 55)
    print("  SCET Result Portal - Local Server")
    print("=" * 55)
    if GEMINI_API_KEY:
        print("  Mode  : Gemini AI (with pdfplumber fallback)")
    else:
        print("  Mode  : pdfplumber only (no GEMINI_API_KEY set)")
        print("  Tip   : Add GEMINI_API_KEY to .env for better parsing")
    print(f"  Open  : {url}")
    print(f"  Stop  : Ctrl+C")
    print("=" * 55)

    def open_browser():
        time.sleep(1.5)
        webbrowser.open(url)

    threading.Thread(target=open_browser, daemon=True).start()
    app.run(host='localhost', port=port, debug=False)
