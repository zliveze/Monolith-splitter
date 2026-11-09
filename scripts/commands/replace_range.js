const fs = require('fs');
const { resolveAndCheck, detectEol } = require('../core/utils');
function cmdReplaceRange(args) {
  const filePath = args[0];
  const startLine = parseInt(args[1], 10);
  const endLine = parseInt(args[2], 10);

  if (!filePath || isNaN(startLine) || isNaN(endLine)) {
    console.error('Usage: node split_helper.js replace-range <file> <startLine> <endLine> [--with "<text>" | --with-file "<path>"] [--eol <lf|crlf>]');
    process.exit(1);
  }

  const absFile = resolveAndCheck(filePath, 'Target file');
  const rawContent = fs.readFileSync(absFile, 'utf8');
  let eol = detectEol(rawContent);
  const lines = rawContent.split(/\r?\n/);
  const totalLines = lines.length;

  if (startLine < 1 || startLine > totalLines || endLine < startLine || endLine > totalLines) {
    console.error(`[ERROR] Invalid range: ${startLine}-${endLine} (file has ${totalLines} lines)`);
    process.exit(1);
  }

  let replacement = '';
  for (let i = 3; i < args.length; i++) {
    if (args[i] === '--with' && args[i + 1] !== undefined) {
      replacement = args[++i];
    } else if (args[i] === '--with-file' && args[i + 1]) {
      replacement = fs.readFileSync(args[++i], 'utf8');
    } else if (args[i] === '--eol' && args[i + 1]) {
      eol = args[++i].toLowerCase() === 'crlf' ? '\r\n' : '\n';
    }
  }

  const before = lines.slice(0, startLine - 1);
  const after = lines.slice(endLine);

  let replacementLines = [];
  if (replacement.length > 0) {
    replacementLines = replacement.split(/\r?\n/);
  }

  const updatedLines = before.concat(replacementLines, after);
  const updatedContent = updatedLines.join(eol);

  fs.writeFileSync(absFile, updatedContent, { encoding: 'utf8' });

  console.log(JSON.stringify({
    status: 'SUCCESS',
    file: absFile,
    startLine,
    endLine,
    deletedLinesCount: endLine - startLine + 1,
    insertedLinesCount: replacementLines.length,
    totalLinesBefore: totalLines,
    totalLinesAfter: updatedLines.length,
    eol: eol === '\r\n' ? 'CRLF' : 'LF',
    sizeBytesAfter: fs.statSync(absFile).size
  }, null, 2));
}
module.exports = { cmdReplaceRange };
