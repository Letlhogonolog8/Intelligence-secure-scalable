const { execSync } = require('child_process');
const cwd = 'C:\\Users\\mudau\\Desktop\\New Apps\\intelligence-secure-scalable';
const run = (cmd) => { try { return execSync(cmd, { cwd, encoding: 'utf8', shell: true }); } catch(e) { return (e.stdout||'') + (e.stderr||''); } };

console.log('=== STATUS ===');
console.log(run('git status'));
console.log('=== REMOTE ===');
console.log(run('git remote -v'));
console.log('=== GITIGNORE .env ===');
console.log(run('git check-ignore -v .env || echo NOT_IGNORED'));
console.log('=== DIFF (staged/unstaged) ===');
console.log(run('git diff --name-only && git diff --name-only --cached'));
