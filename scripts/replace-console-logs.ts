/**
 * Script to replace console.* calls with structured logger
 * Run: tsx scripts/replace-console-logs.ts
 */

import fs from 'fs';
import path from 'path';

const serverDir = path.join(process.cwd(), 'server');

const replacements = [
  { pattern: /console\.log\(/g, replacement: 'logger.info(' },
  { pattern: /console\.warn\(/g, replacement: 'logger.warn(' },
  { pattern: /console\.error\(/g, replacement: 'logger.error(' },
  { pattern: /console\.debug\(/g, replacement: 'logger.debug(' },
];

function processFile(filePath: string): boolean {
  const content = fs.readFileSync(filePath, 'utf-8');
  let modified = content;
  let hasChanges = false;

  // Check if file already imports logger
  const hasLoggerImport = /import.*createLogger.*from.*logger/.test(content);
  
  // Check if file has console.* calls
  const hasConsoleCalls = /console\.(log|warn|error|debug)\(/.test(content);
  
  if (!hasConsoleCalls) {
    return false;
  }

  // Add logger import if not present
  if (!hasLoggerImport) {
    const moduleName = path.basename(filePath, '.ts').replace(/[^a-zA-Z0-9]/g, '-');
    
    // Find the last import statement
    const importRegex = /^import .* from .*;$/gm;
    const imports = content.match(importRegex);
    
    if (imports && imports.length > 0) {
      const lastImport = imports[imports.length - 1];
      const lastImportIndex = content.lastIndexOf(lastImport);
      modified = content.slice(0, lastImportIndex + lastImport.length) + '\n\n' + 
                 `import { createLogger } from ${filePath.includes('utils') ? "'./logger'" : "'./utils/logger'"};\n\nconst logger = createLogger('${moduleName}');\n` +
                 content.slice(lastImportIndex + lastImport.length);
      hasChanges = true;
    }
  }

  // Replace console.* calls
  replacements.forEach(({ pattern, replacement }) => {
    if (pattern.test(modified)) {
      modified = modified.replace(pattern, replacement);
      hasChanges = true;
    }
  });

  if (hasChanges) {
    fs.writeFileSync(filePath, modified, 'utf-8');
    console.log(`✅ Updated: ${path.relative(process.cwd(), filePath)}`);
    return true;
  }

  return false;
}

function walkDirectory(dir: string): void {
  const files = fs.readdirSync(dir);
  let totalUpdated = 0;

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      walkDirectory(filePath);
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      if (processFile(filePath)) {
        totalUpdated++;
      }
    }
  });

  if (totalUpdated > 0) {
    console.log(`\n📊 Total files updated: ${totalUpdated}`);
  }
}

console.log('🔄 Replacing console.* calls with structured logger...\n');
walkDirectory(serverDir);
console.log('\n✅ Console replacement complete!');
