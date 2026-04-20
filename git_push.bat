@echo off
cd /d "C:\Users\mudau\Desktop\New Apps\intelligence-secure-scalable"
echo === Git Status ===
git status
echo.
echo === Git Remote ===
git remote -v
echo.
echo === .gitignore check for .env ===
git check-ignore -v .env
