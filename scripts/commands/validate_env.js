const fs = require('fs');
const path = require('path');
function cmdValidateEnv(targetDir) {
  const rootDir = path.resolve(targetDir || '.');
  if (!fs.existsSync(rootDir)) {
    console.error(`[ERROR] Directory not found: ${rootDir}`);
    process.exit(1);
  }

  const forbiddenUnderscores = [];
  const allowedUnderscores = new Set(['_locales', '_metadata', '.git', 'node_modules', '__pycache__']);

  function scan(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name === '.git' || ent.name === 'node_modules' || ent.name === '__pycache__') continue;

      const fullPath = path.join(dir, ent.name);
      const relPath = path.relative(rootDir, fullPath);

      if (ent.name.startsWith('_') && !allowedUnderscores.has(ent.name)) {
        forbiddenUnderscores.push({
          path: relPath,
          type: ent.isDirectory() ? 'directory' : 'file',
          reason: "Chrome Extensions strictly reserve filenames starting with '_'. Having this file will prevent the extension from loading."
        });
      }

      if (ent.isDirectory()) {
        scan(fullPath);
      }
    }
  }

  scan(rootDir);

  const manifestPath = path.join(rootDir, 'manifest.json');
  const manifestCheck = { exists: false, missingFiles: [] };

  if (fs.existsSync(manifestPath)) {
    manifestCheck.exists = true;
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      if (Array.isArray(manifest.content_scripts)) {
        manifest.content_scripts.forEach(cs => {
          if (Array.isArray(cs.js)) {
            cs.js.forEach(f => {
              if (!fs.existsSync(path.join(rootDir, f))) {
                manifestCheck.missingFiles.push({ type: 'content_script_js', file: f });
              }
            });
          }
          if (Array.isArray(cs.css)) {
            cs.css.forEach(f => {
              if (!fs.existsSync(path.join(rootDir, f))) {
                manifestCheck.missingFiles.push({ type: 'content_script_css', file: f });
              }
            });
          }
        });
      }

      if (manifest.background && manifest.background.service_worker) {
        const sw = manifest.background.service_worker;
        if (!fs.existsSync(path.join(rootDir, sw))) {
          manifestCheck.missingFiles.push({ type: 'service_worker', file: sw });
        }
      }
    } catch (e) {
      manifestCheck.parseError = e.message;
    }
  }

  const isClean = forbiddenUnderscores.length === 0 && manifestCheck.missingFiles.length === 0;

  console.log(JSON.stringify({
    status: isClean ? 'ENVIRONMENT_CLEAN' : 'ISSUES_DETECTED',
    scannedDirectory: rootDir,
    forbiddenUnderscoreCount: forbiddenUnderscores.length,
    forbiddenUnderscores,
    manifestCheck
  }, null, 2));

  if (!isClean) process.exit(1);
}

module.exports = { cmdValidateEnv };
