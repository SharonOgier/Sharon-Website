@echo off
cd /d "%~dp0"
git add .
git commit -m "update"
git stash
git pull origin master --rebase
git stash pop
git push origin master
pause