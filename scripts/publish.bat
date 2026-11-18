@echo off
REM Windows wrapper for publish.sh
REM Runs the publish script in Git for Windows bash (not the WSL bash found on PATH),
REM so git uses Git Credential Manager.

REM Get the directory where this batch file is located
set SCRIPT_DIR=%~dp0

REM Change to project root (parent of scripts directory)
cd /d "%SCRIPT_DIR%\.."

REM Configure git to use Git Bash and Notepad++
git config --global core.editor "'C:/Program Files/Notepad++/notepad++.exe' -multiInst -notabbar -nosession -noPlugin"
git config --global core.shell "C:/Program Files/Git/bin/bash.exe"

set "GIT_BASH=C:\Program Files\Git\bin\bash.exe"
set TAG=%1

if "%TAG%"=="" (
    "%GIT_BASH%" scripts/publish.sh
) else (
    "%GIT_BASH%" scripts/publish.sh %TAG%
)
