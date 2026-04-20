@echo off
cd /d "C:\Users\mudau\Desktop\New Apps\intelligence-secure-scalable"

echo === Pulling remote changes (rebase) ===
git pull --rebase origin main

echo.
echo === Pushing to origin/main ===
git push origin main

echo.
echo === Final log ===
git log --oneline -6
