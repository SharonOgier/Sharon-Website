@echo off
cd /d "%~dp0"
del .git\index.lock 2>nul
git add .
git commit -m "update"
git push origin main
pause