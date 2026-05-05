#!/bin/bash

echo ""
echo " ====================================================="
echo "  SCET Result Portal - Starting..."
echo " ====================================================="
echo ""

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    if ! command -v python &> /dev/null; then
        echo " [ERROR] Python is not installed."
        echo " Please install Python from https://www.python.org/downloads/"
        exit 1
    else
        PYTHON=python
    fi
else
    PYTHON=python3
fi

echo " [OK] Python found: $($PYTHON --version)"

# Install / verify dependencies
echo " [..] Checking dependencies..."
MISSING=""
for pkg in flask pdfplumber google.genai dotenv; do
    $PYTHON -c "import $pkg" > /dev/null 2>&1
    if [ $? -ne 0 ]; then
        MISSING="yes"
    fi
done

if [ -n "$MISSING" ]; then
    echo " [..] Installing required packages (first time only)..."
    $PYTHON -m pip install flask flask-cors pdfplumber "google-genai>=1.0.0" python-dotenv
fi

echo " [OK] Dependencies ready."
echo ""

# First-run: create .env if it doesn't exist
if [ ! -f ".env" ]; then
    echo " ─────────────────────────────────────────────────────"
    echo "  FIRST-TIME SETUP"
    echo " ─────────────────────────────────────────────────────"
    echo "  A Gemini API key enables AI-powered PDF parsing."
    echo "  Get a FREE key at: https://aistudio.google.com/app/apikey"
    echo ""
    read -p "  Enter your Gemini API key (or press Enter to skip): " API_KEY
    if [ -n "$API_KEY" ]; then
        echo "GEMINI_API_KEY=$API_KEY" > .env
        echo " [OK] API key saved to .env"
    else
        echo " [--] Skipped. Using offline parser only."
        echo "      You can add it later: echo 'GEMINI_API_KEY=your_key' > .env"
        touch .env
    fi
    echo " ─────────────────────────────────────────────────────"
    echo ""
fi

echo " [..] Starting server... Browser will open automatically."
echo " To stop the server, press Ctrl+C"
echo ""

$PYTHON server.py
