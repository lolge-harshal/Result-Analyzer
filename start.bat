@echo off
title SCET Result Portal
color 0A
echo.
echo  =====================================================
echo   SCET Result Portal - Starting...
echo  =====================================================
echo.

:: Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Python is not installed or not in PATH.
    echo.
    echo  Please install Python from https://www.python.org/downloads/
    echo  Make sure to check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)

echo  [OK] Python found.

:: Always use "python -m pip" — avoids pip.exe launcher issues on Windows
echo  [..] Checking dependencies...

python -m pip show flask >nul 2>&1
if errorlevel 1 goto install_deps
python -m pip show pdfplumber >nul 2>&1
if errorlevel 1 goto install_deps
python -m pip show google-genai >nul 2>&1
if errorlevel 1 goto install_deps
python -m pip show python-dotenv >nul 2>&1
if errorlevel 1 goto install_deps
goto deps_done

:install_deps
echo  [..] Installing required packages (first time only)...
python -m pip install flask flask-cors pdfplumber "google-genai>=1.0.0" python-dotenv
if errorlevel 1 (
    echo.
    echo  [ERROR] Failed to install packages.
    echo.
    echo  Try running this window as Administrator:
    echo  Right-click start.bat ^> "Run as administrator"
    echo.
    pause
    exit /b 1
)

:deps_done
echo  [OK] Dependencies ready.
echo.

:: First-run: create .env if it doesn't exist or is empty
setlocal enabledelayedexpansion
set NEED_KEY=0
if not exist ".env" set NEED_KEY=1
if exist ".env" (
    for /f "usebackq delims=" %%A in (".env") do (
        set LINE=%%A
    )
    if "!LINE!"=="GEMINI_API_KEY=" set NEED_KEY=1
    if "!LINE!"=="" set NEED_KEY=1
)

if !NEED_KEY!==1 (
    echo  -----------------------------------------------------
    echo   FIRST-TIME SETUP
    echo  -----------------------------------------------------
    echo   A Gemini API key enables AI-powered PDF parsing.
    echo   Get a FREE key at: https://aistudio.google.com/app/apikey
    echo.
    set /p API_KEY="  Enter your Gemini API key (or press Enter to skip): "
    if not "!API_KEY!"=="" (
        echo GEMINI_API_KEY=!API_KEY!> .env
        echo  [OK] API key saved to .env
    ) else (
        echo  [--] Skipped. Using offline parser only.
        echo       You can add it later by editing the .env file.
        echo GEMINI_API_KEY=> .env
    )
    echo  -----------------------------------------------------
    echo.
)

echo  [..] Starting server... Browser will open automatically.
echo.
echo  To stop the server, close this window or press Ctrl+C
echo.

python server.py

pause
