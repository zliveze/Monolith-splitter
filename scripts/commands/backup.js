const fs = require('fs');
const path = require('path');
const { getTimestamp, sha256, resolveAndCheck } = require('../core/utils');
function cmdBackup(sourcePath) {
  const absSource = resolveAndCheck(sourcePath, 'Source file');
  const dir = path.dirname(absSource);
  const ext = path.extname(absSource);
  const base = path.basename(absSource, ext);
  const ts = getTimestamp();

  const backupPath = path.join(dir, `${base}${ext}.bak.${ts}`);
  const standardBak = path.join(dir, `${base}${ext}.bak`);

  fs.copyFileSync(absSource, backupPath);
  fs.copyFileSync(absSource, standardBak);

  const stat = fs.statSync(absSource);
  const hash = sha256(absSource);
  const lineCount = fs.readFileSync(absSource, 'utf8').split(/\r?\n/).length;

  console.log(JSON.stringify({
    status: 'SUCCESS',
    source: absSource,
    backupFile: backupPath,
    standardBak: standardBak,
    sizeBytes: stat.size,
    lineCount: lineCount,
    sha256: hash,
    timestamp: ts
  }, null, 2));
}

// ─── COMMAND: restore ────────────────────────────────────

function cmdRestore(args) {
  const sourcePath = args[0];
  if (!sourcePath) {
    console.error('Usage: node split_helper.js restore <file> [--backup <specific_bak>]');
    process.exit(1);
  }

  const absSource = path.resolve(sourcePath);
  let bakPath = null;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--backup' && args[i + 1]) {
      bakPath = path.resolve(args[++i]);
    }
  }

  if (!bakPath) {
    const dir = path.dirname(absSource);
    const ext = path.extname(absSource);
    const base = path.basename(absSource, ext);
    bakPath = path.join(dir, `${base}${ext}.bak`);
  }

  if (!fs.existsSync(bakPath)) {
    console.error(`[ERROR] Backup file not found: ${bakPath}`);
    process.exit(1);
  }

  fs.copyFileSync(bakPath, absSource);
  const stat = fs.statSync(absSource);
  const hash = sha256(absSource);
  const lineCount = fs.readFileSync(absSource, 'utf8').split(/\r?\n/).length;

  console.log(JSON.stringify({
    status: 'RESTORED_SUCCESS',
    restoredFile: absSource,
    restoredFrom: bakPath,
    sizeBytes: stat.size,
    lineCount: lineCount,
    sha256: hash
  }, null, 2));
}

function cmdCleanBackup(targetPath) {
  if (!targetPath) {
    console.error('Usage: node split_helper.js clean-backup <file_or_backup_path>');
    process.exit(1);
  }

  const absPath = path.resolve(targetPath);
  const dir = fs.existsSync(absPath) && fs.statSync(absPath).isDirectory() ? absPath : path.dirname(absPath);
  const baseName = path.basename(absPath).replace(/\.bak.*$/, '');

  const removed = [];
  let freedBytes = 0;

  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      if (f.startsWith(baseName) && (f.endsWith('.bak') || f.includes('.bak.'))) {
        const fullBak = path.join(dir, f);
        try {
          const sz = fs.statSync(fullBak).size;
          fs.unlinkSync(fullBak);
          removed.push(fullBak);
          freedBytes += sz;
        } catch (e) {}
      }
    }
  }

  console.log(JSON.stringify({
    status: removed.length > 0 ? 'BACKUPS_CLEANED' : 'NO_BACKUPS_FOUND',
    removedFilesCount: removed.length,
    removedFiles: removed,
    totalFreedBytes: freedBytes
  }, null, 2));
}

// ─── COMMAND: validate-env ───────────────────────────────
module.exports = { cmdBackup, cmdRestore, cmdCleanBackup };
