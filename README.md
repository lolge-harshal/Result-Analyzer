# SCET Result Portal

**B.Tech CSE (AI & ML) — Semester Result Viewer**

A local web app to upload, view, and export university exam results from PDF.

---

## Requirements

- **Python 3.10+** — Download from [python.org](https://www.python.org/downloads/)
  - During installation on Windows, check **"Add Python to PATH"**

---

## How to Run

### Windows
Double-click **`start.bat`**

### Mac / Linux
Open Terminal in this folder and run:
```
bash start.sh
```

The browser will open automatically at `http://localhost:8080`.  
To stop the server, press **Ctrl+C** in the terminal.

---

## First-Time Setup (Gemini AI — Optional but Recommended)

On first run, you'll be asked for a **Gemini API key**.  
This enables AI-powered PDF parsing for more accurate results.

1. Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Sign in with a Google account
3. Click **"Create API Key"** — it's free
4. Paste the key when prompted

> If you skip this, the app still works using the built-in offline parser.  
> You can add the key later by editing the `.env` file:
> ```
> GEMINI_API_KEY=your_key_here
> ```

---

## How to Use

1. Run the app using the steps above
2. Click **"Upload PDF"** and select the university result PDF
3. Results load automatically — browse, search, filter
4. Go to **Downloads** tab to export as Excel, CSV, or JSON

---

## Tabs

| Tab | Description |
|-----|-------------|
| 📊 Results | Full student result table with grades and marks |
| 📈 Analysis | Pass/fail stats, SGPA distribution, toppers |
| ⬇️ Downloads | Export data as Excel (.xlsx), CSV, or JSON |
