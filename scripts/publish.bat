@echo off
REM Windows wrapper for publish.sh
REM Runs the publish script in Git Bash

REM Get the directory where this batch file is located
set SCRIPT_DIR=%~dp0

REM Change to project root (parent of scripts directory)
cd /d "%SCRIPT_DIR%\.."

set TAG=%1

if "%TAG%"=="" (
    bash scripts/publish.sh
) else (
    bash scripts/publish.sh %TAG%
)
