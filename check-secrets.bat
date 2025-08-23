@echo off
echo Scanning for secrets in the codebase...
python -m detect_secrets scan --baseline .secrets.baseline --exclude-files "node_modules/.*" --exclude-files "\.git/.*" --exclude-files "\.next/.*" --exclude-files "package-lock\.json" .

if %errorlevel% neq 0 (
    echo.
    echo ❌ SECRETS DETECTED! Please review and remove them before committing.
    exit /b 1
) else (
    echo.
    echo ✅ No secrets detected. Safe to commit!
    exit /b 0
)