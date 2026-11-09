const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { detectLanguage, hasCommand } = require('../core/utils');
const { validateStructuralSyntax } = require('../core/lexical_scanner');
function cmdCheckSyntax(filePaths) {
  if (!filePaths || filePaths.length === 0) {
    console.error('[ERROR] Provide one or more file paths.');
    process.exit(1);
  }

  const results = [];
  let allPass = true;

  filePaths.forEach(fp => {
    const absPath = path.resolve(fp);
    if (!fs.existsSync(absPath)) {
      results.push({ file: fp, status: 'NOT_FOUND' });
      allPass = false;
      return;
    }

    const langInfo = detectLanguage(absPath);
    const ext = langInfo.ext;

    // 1. JavaScript / CommonJS / ESM
    if (['.js', '.mjs', '.cjs'].includes(ext)) {
      try {
        execFileSync(process.execPath, ['--check', absPath], { stdio: 'pipe' });
        results.push({ file: absPath, status: 'VALID_SYNTAX', mode: 'COMMONJS' });
        return;
      } catch (err) {
        const stderr = err.stderr ? err.stderr.toString().trim() : err.message;
        const isEsmSyntax = stderr.includes('Cannot use import statement') ||
                            stderr.includes("Unexpected token 'export'") ||
                            stderr.includes('export class') ||
                            stderr.includes('import ');

        if (isEsmSyntax && ext === '.js') {
          const tmpMjs = path.join(os.tmpdir(), `syntax_check_${crypto.randomUUID()}.mjs`);
          try {
            fs.copyFileSync(absPath, tmpMjs);
            execFileSync(process.execPath, ['--check', tmpMjs], { stdio: 'pipe' });
            fs.unlinkSync(tmpMjs);
            results.push({ file: absPath, status: 'VALID_SYNTAX', mode: 'ESM_MODULE' });
            return;
          } catch (mjsErr) {
            if (fs.existsSync(tmpMjs)) fs.unlinkSync(tmpMjs);
            const mjsStderr = mjsErr.stderr ? mjsErr.stderr.toString().trim() : mjsErr.message;
            allPass = false;
            results.push({ file: absPath, status: 'SYNTAX_ERROR', error: mjsStderr });
            return;
          }
        }

        allPass = false;
        results.push({ file: absPath, status: 'SYNTAX_ERROR', error: stderr.split('\n').slice(0, 5).join('\n') });
        return;
      }
    }

    // 2. Python (.py, .pyw)
    if (['.py', '.pyw'].includes(ext)) {
      const pyBin = process.platform === 'win32' ? (hasCommand('python') ? 'python' : 'py') : 'python3';
      if (hasCommand(pyBin)) {
        try {
          execFileSync(pyBin, ['-m', 'py_compile', absPath], { stdio: 'pipe' });
          results.push({ file: absPath, status: 'VALID_SYNTAX', mode: 'PYTHON_COMPILER' });
          return;
        } catch (pyErr) {
          allPass = false;
          const pyStderr = pyErr.stderr ? pyErr.stderr.toString().trim() : pyErr.message;
          results.push({ file: absPath, status: 'SYNTAX_ERROR', error: pyStderr });
          return;
        }
      }
    }

    // 3. PHP (.php)
    if (ext === '.php' && hasCommand('php')) {
      try {
        execFileSync('php', ['-l', absPath], { stdio: 'pipe' });
        results.push({ file: absPath, status: 'VALID_SYNTAX', mode: 'PHP_LINT' });
        return;
      } catch (phpErr) {
        allPass = false;
        const phpStderr = phpErr.stderr ? phpErr.stderr.toString().trim() : phpErr.message;
        results.push({ file: absPath, status: 'SYNTAX_ERROR', error: phpStderr });
        return;
      }
    }

    // 4. Go (.go)
    if (ext === '.go' && hasCommand('gofmt')) {
      try {
        execFileSync('gofmt', ['-e', absPath], { stdio: 'pipe' });
        results.push({ file: absPath, status: 'VALID_SYNTAX', mode: 'GOFMT' });
        return;
      } catch (goErr) {
        allPass = false;
        const goStderr = goErr.stderr ? goErr.stderr.toString().trim() : goErr.message;
        results.push({ file: absPath, status: 'SYNTAX_ERROR', error: goStderr });
        return;
      }
    }

    // 5. JSON (.json)
    if (ext === '.json') {
      try {
        JSON.parse(fs.readFileSync(absPath, 'utf8'));
        results.push({ file: absPath, status: 'VALID_SYNTAX', mode: 'JSON_PARSE' });
        return;
      } catch (jsonErr) {
        allPass = false;
        results.push({ file: absPath, status: 'SYNTAX_ERROR', error: jsonErr.message });
        return;
      }
    }

    // 6. Universal Structural Token AST Check (Java, C#, C++, Rust, Swift, Kotlin, etc.)
    const check = validateStructuralSyntax(absPath, langInfo);
    if (check.status !== 'VALID_SYNTAX') {
      allPass = false;
    }
    results.push(check);
  });

  console.log(JSON.stringify({ overallPass: allPass, results }, null, 2));
  if (!allPass) process.exit(1);
}
module.exports = { cmdCheckSyntax };
