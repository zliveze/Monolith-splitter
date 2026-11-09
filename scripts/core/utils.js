const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

// ─── Helpers: Language Detection, EOL & Hashing ──────────

function detectLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.py':
    case '.pyw':
      return { lang: 'python', family: 'indentation', ext, name: 'Python' };
    case '.rb':
      return { lang: 'ruby', family: 'end_block', ext, name: 'Ruby' };
    case '.js':
    case '.jsx':
    case '.mjs':
    case '.cjs':
      return { lang: 'javascript', family: 'curly_brace', ext, name: 'JavaScript' };
    case '.ts':
    case '.tsx':
      return { lang: 'typescript', family: 'curly_brace', ext, name: 'TypeScript' };
    case '.java':
      return { lang: 'java', family: 'curly_brace', ext, name: 'Java' };
    case '.kt':
    case '.kts':
      return { lang: 'kotlin', family: 'curly_brace', ext, name: 'Kotlin' };
    case '.cs':
      return { lang: 'csharp', family: 'curly_brace', ext, name: 'C#' };
    case '.cpp':
    case '.cc':
    case '.cxx':
    case '.c':
    case '.h':
    case '.hpp':
    case '.hxx':
      return { lang: 'cpp', family: 'curly_brace', ext, name: 'C/C++' };
    case '.go':
      return { lang: 'go', family: 'curly_brace', ext, name: 'Go' };
    case '.rs':
      return { lang: 'rust', family: 'curly_brace', ext, name: 'Rust' };
    case '.php':
      return { lang: 'php', family: 'curly_brace', ext, name: 'PHP' };
    case '.swift':
      return { lang: 'swift', family: 'curly_brace', ext, name: 'Swift' };
    case '.html':
    case '.vue':
    case '.svelte':
      return { lang: 'web_template', family: 'markup', ext, name: 'Web Template' };
    case '.json':
      return { lang: 'json', family: 'data', ext, name: 'JSON' };
    default:
      return { lang: 'generic', family: 'curly_brace', ext, name: 'Generic' };
  }
}

function detectEol(content) {
  const crlfCount = (content.match(/\r\n/g) || []).length;
  const lfCount = (content.match(/[^\r]\n/g) || []).length;
  return crlfCount >= lfCount ? '\r\n' : '\n';
}

function getTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function resolveAndCheck(p, label) {
  const abs = path.resolve(p);
  if (!fs.existsSync(abs)) {
    console.error(`[ERROR] ${label || 'File'} not found: ${abs}`);
    process.exit(1);
  }
  return abs;
}

function hasCommand(cmd) {
  try {
    const isWin = process.platform === 'win32';
    const checkCmd = isWin ? 'where' : 'which';
    execFileSync(checkCmd, [cmd], { stdio: 'pipe' });
    return true;
  } catch (e) {
    return false;
  }
}
module.exports = { detectLanguage, detectEol, getTimestamp, sha256, resolveAndCheck, hasCommand };
