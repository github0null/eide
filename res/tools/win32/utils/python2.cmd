@echo off

python2.exe --version >nul 2>&1

IF %errorlevel% EQU 0 (
    python2.exe %*
) else (
    python.exe %*
)