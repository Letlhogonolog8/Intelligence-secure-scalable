const { execSync } = require('child_process');
const cwd = 'C:\\Users\\mudau\\Desktop\\New Apps\\intelligence-secure-scalable';
const tsc = cwd + '\\node_modules\\typescript\\bin\\tsc';

function run(tsconfig) {
  try {
    const out = execSync(`node "${tsc}" -p ${tsconfig} --noEmit`, { cwd, encoding: 'utf8', timeout: 90000 });
    console.log('[' + tsconfig + '] CLEAN');
    if (out) console.log(out);
  } catch (e) {
    console.log('[' + tsconfig + '] ERRORS:');
    if (e.stdout) console.log(e.stdout);
    if (e.stderr) console.error(e.stderr);
  }
}

run('tsconfig.server.json');
run('tsconfig.json');
