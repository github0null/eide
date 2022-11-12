@echo off

python3.exe --version >nul 2>&1

IF %errorlevel% EQU 0 (
    python3.exe %*
) else (
    python.exe %*
)