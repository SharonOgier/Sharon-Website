@echo off
cd /d "%~dp0"
del .git\index.lock 2>nul
git add .
git commit -m "update"
git branch -m master main
pause