@echo off
setlocal

cd /d "%~dp0"

echo.
echo === Sharon Website Git Push ===
echo.

if exist .git\index.lock (
  echo Removing stale git lock...
  del /f /q .git\index.lock
)

git status
echo.

set /p msg=Enter commit message: 
if "%msg%"=="" set msg=update

echo.
echo Adding files...
git add .

echo.
echo Committing...
git commit -m "%msg%"

echo.
echo Pulling latest changes...
git pull origin main --rebase

echo.
echo Pushing to GitHub...
git push origin main

echo.
echo Done.
pause
endlocal