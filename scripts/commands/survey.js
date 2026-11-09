const fs = require('fs');
const { resolveAndCheck, detectLanguage, detectEol } = require('../core/utils');
const { stripCommentsAndStringsKeepLines, findMatchingCloseBrace, findPythonBlockEnd, offsetToLineNumber } = require('../core/lexical_scanner');
function getSymbolPatternsForLang(langInfo) {
  if (langInfo.lang === 'python') {
    return [
      { type: 'class', regex: /(?:^|\n)[ \t]*class\s+([a-zA-Z0-9_]+)\s*(?:\([^)]*\))?[^{:\n]*:/g },
      { type: 'function', regex: /(?:^|\n)[ \t]*(?:async\s+)?def\s+([a-zA-Z0-9_]+)\s*\([^)]*\)\s*(?:->[^:\n]+)?\s*:/g }
    ];
  }

  if (['csharp', 'java', 'kotlin'].includes(langInfo.lang)) {
    return [
      { type: 'class', regex: /(?:^|\n)\s*(?:(?:public|private|protected|internal|static|abstract|final|sealed|partial)\s+)*(?:class|interface|struct|record|enum)\s+([a-zA-Z0-9_]+)[^{]*\{/g },
      { type: 'method', regex: /(?:^|\n)\s*(?:(?:public|private|protected|internal|static|virtual|override|abstract|async|final|synchronized|sealed)\s+)*(?:(?:Task<[a-zA-Z0-9_<>, ?[\]]+>|ValueTask<[a-zA-Z0-9_<>, ?[\]]+>|ResponseEntity<[a-zA-Z0-9_<>, ?[\]]+>|List<[a-zA-Z0-9_<>, ?[\]]+>|Map<[a-zA-Z0-9_<>, ?[\]]+>|[a-zA-Z0-9_<>[\]?]+)\s+)+([a-zA-Z0-9_]+)\s*\([^)]*\)\s*(?:where[^{]+)?\{/g },
      { type: 'constructor', regex: /(?:^|\n)\s*(?:public|protected|private|internal)?\s*([A-Z][a-zA-Z0-9_]+)\s*\([^)]*\)\s*(?::[^{]+)?\{/g }
    ];
  }

  if (langInfo.lang === 'go') {
    return [
      { type: 'method', regex: /(?:^|\n)\s*func\s*\([^)]+\)\s*([a-zA-Z0-9_]+)\s*\([^)]*\)[^{]*\{/g },
      { type: 'function', regex: /(?:^|\n)\s*func\s+([a-zA-Z0-9_]+)\s*\([^)]*\)[^{]*\{/g },
      { type: 'type', regex: /(?:^|\n)\s*type\s+([a-zA-Z0-9_]+)\s+(?:struct|interface)\s*\{/g }
    ];
  }

  if (langInfo.lang === 'rust') {
    return [
      { type: 'function', regex: /(?:^|\n)\s*(?:pub(?:\([^)]+\))?\s+)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)[^{]*\{/g },
      { type: 'type', regex: /(?:^|\n)\s*(?:pub(?:\([^)]+\))?\s+)?(?:struct|enum|trait)\s+([a-zA-Z0-9_]+)[^{]*\{/g },
      { type: 'impl', regex: /(?:^|\n)\s*impl(?:\s*<[^>]*>)?\s+(?:[a-zA-Z0-9_:]+\s+for\s+)?([a-zA-Z0-9_:]+)[^{]*\{/g }
    ];
  }

  if (langInfo.lang === 'php') {
    return [
      { type: 'class', regex: /(?:^|\n)\s*(?:abstract\s+|final\s+)?(?:class|trait|interface)\s+([a-zA-Z0-9_]+)[^{]*\{/g },
      { type: 'function', regex: /(?:^|\n)\s*(?:(?:public|protected|private|static|abstract|final)\s+)*function\s+([a-zA-Z0-9_]+)\s*\([^)]*\)[^{]*\{/g }
    ];
  }

  if (langInfo.lang === 'cpp') {
    return [
      { type: 'class', regex: /(?:^|\n)\s*(?:class|struct)\s+([a-zA-Z0-9_]+)(?:\s*:[^{]+)?\s*\{/g },
      { type: 'function', regex: /(?:^|\n)\s*(?:(?:inline|static|virtual|explicit|friend|constexpr)\s+)*(?:[a-zA-Z0-9_:*&<>[\]]+\s+)+([a-zA-Z0-9_]+(?:::[a-zA-Z0-9_]+)?)\s*\([^)]*\)\s*(?:const)?\s*\{/g }
    ];
  }

  // JavaScript / TypeScript / Generic default
  return [
    { type: 'class', regex: /(?:^|\n)\s*(?:export\s+)?class\s+([a-zA-Z0-9_$]+)[^{]*\{/g },
    { type: 'function', regex: /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s*([a-zA-Z0-9_$]+)\s*\([^)]*\)\s*\{/g },
    { type: 'static_method', regex: /(?:^|\n)\s*static\s+(?:async\s+)?([a-zA-Z0-9_$]+)\s*\([^)]*\)\s*\{/g },
    { type: 'getter', regex: /(?:^|\n)\s*get\s+([a-zA-Z0-9_$]+)\s*\(\s*\)\s*\{/g },
    { type: 'setter', regex: /(?:^|\n)\s*set\s+([a-zA-Z0-9_$]+)\s*\([^)]*\)\s*\{/g },
    { type: 'private_method', regex: /(?:^|\n)\s*#([a-zA-Z0-9_$]+)\s*\([^)]*\)\s*\{/g },
    { type: 'generator_method', regex: /(?:^|\n)\s*(?:async\s+)?\*\s*([a-zA-Z0-9_$]+)\s*\([^)]*\)\s*\{/g },
    { type: 'prototype_method', regex: /(?:^|\n)\s*([a-zA-Z0-9_$]+)\.prototype\.([a-zA-Z0-9_$]+)\s*=\s*(?:async\s+)?function\s*\([^)]*\)\s*\{/g },
    { type: 'class_arrow_method', regex: /(?:^|\n)\s*([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/g },
    { type: 'method', regex: /(?:^|\n)\s*(?:async\s+)?([a-zA-Z0-9_$]+)\s*\([^)]*\)\s*\{/g },
    { type: 'arrow_function', regex: /(?:^|\n)\s*(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g },
    { type: 'arrow_function', regex: /(?:^|\n)\s*(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?[a-zA-Z0-9_$]+\s*=>/g }
  ];
}

function cmdSurvey(sourcePath) {
  const absSource = resolveAndCheck(sourcePath, 'Source file');
  const langInfo = detectLanguage(absSource);
  const rawContent = fs.readFileSync(absSource, 'utf8');
  const lines = rawContent.split(/\r?\n/);
  const cleanContent = stripCommentsAndStringsKeepLines(rawContent, langInfo);

  const symbols = [];
  const domQueries = new Set();
  const eventListeners = [];
  const eventCountsByType = {};
  const memberCalls = new Set();
  const sectionComments = [];

  const symbolPatterns = getSymbolPatternsForLang(langInfo);
  const excludedMethods = new Set([
    'if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'else', 'try', 'new',
    'typeof', 'delete', 'void', 'throw', 'await', 'import', 'package', 'using', 'from'
  ]);
  const capturedOffsets = new Set();

  for (const { type, regex } of symbolPatterns) {
    let match;
    while ((match = regex.exec(cleanContent)) !== null) {
      let matchOffset = match.index;
      if (cleanContent[matchOffset] === '\n') matchOffset++;
      else if (cleanContent[matchOffset] === '\r' && cleanContent[matchOffset + 1] === '\n') matchOffset += 2;

      if (capturedOffsets.has(matchOffset)) continue;

      let name;
      let className = null;
      if (type === 'prototype_method') {
        className = match[1];
        name = match[2];
      } else {
        name = match[1];
      }

      if (excludedMethods.has(name)) continue;

      const startLine = offsetToLineNumber(rawContent, matchOffset);
      let endLine = null;
      let lineCount = null;

      if (langInfo.lang === 'python') {
        const lineIdx = startLine - 1;
        const baseIndent = (lines[lineIdx].match(/^[ \t]*/)[0] || '').length;
        endLine = findPythonBlockEnd(lines, lineIdx, baseIndent);
        lineCount = endLine - startLine + 1;
      } else {
        const braceOffset = cleanContent.indexOf('{', matchOffset);
        if (braceOffset !== -1) {
          const closeOffset = findMatchingCloseBrace(rawContent, braceOffset);
          if (closeOffset !== -1) {
            endLine = offsetToLineNumber(rawContent, closeOffset);
            lineCount = endLine - startLine + 1;
          }
        }
      }

      capturedOffsets.add(matchOffset);
      symbols.push({
        type,
        name: type === 'private_method' ? `#${name}` : name,
        className,
        startLine,
        endLine,
        lineCount,
        raw: lines[startLine - 1] ? lines[startLine - 1].trim() : ''
      });
    }
  }

  // Sort symbols by startLine
  symbols.sort((a, b) => a.startLine - b.startLine);

  // Section comments (// =====... or # =====... headers)
  const sectionRegex = /^\s*(?:\/\/|#)\s*={3,}\s*$/;
  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    if (sectionRegex.test(line)) {
      const nextLine = lines[idx + 1];
      if (nextLine && /^\s*(?:\/\/|#)/.test(nextLine) && !sectionRegex.test(nextLine)) {
        sectionComments.push({
          line: lineNum,
          title: nextLine.trim().replace(/^(?:\/\/|#)\s*/, '').replace(/\s*$/, '')
        });
      }
    }
  });

  // DOM IDs & Query Selectors (active for web templates / JS / TS)
  const isWebOrJs = ['javascript', 'typescript', 'web_template'].includes(langInfo.lang);
  if (isWebOrJs) {
    const idAttrRegex = /id\s*=\s*['"`]([a-zA-Z0-9_-]+)['"`]/g;
    const getElemRegex = /getElementById\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    const qsRegex = /querySelector(?:All)?\s*\(\s*['"`]#([a-zA-Z0-9_-]+)/g;

    let dm;
    while ((dm = idAttrRegex.exec(rawContent)) !== null) domQueries.add(dm[1]);
    while ((dm = getElemRegex.exec(rawContent)) !== null) domQueries.add(dm[1]);
    while ((dm = qsRegex.exec(rawContent)) !== null) domQueries.add(dm[1]);

    const eventRegex = /\.addEventListener\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let em;
    while ((em = eventRegex.exec(rawContent)) !== null) {
      const evType = em[1];
      const lineNum = offsetToLineNumber(rawContent, em.index);
      eventListeners.push({ event: evType, line: lineNum });
      eventCountsByType[evType] = (eventCountsByType[evType] || 0) + 1;
    }
  }

  // Member calls audit: this.foo() for JS/C#/Java/PHP or self.foo() for Python
  const memberRegex = langInfo.lang === 'python' ? /self\.([a-zA-Z0-9_]+)\s*\(/g : /this\.([a-zA-Z0-9_$]+)\s*\(/g;
  let mm;
  while ((mm = memberRegex.exec(cleanContent)) !== null) {
    memberCalls.add(mm[1]);
  }

  console.log(JSON.stringify({
    file: absSource,
    language: langInfo.name,
    family: langInfo.family,
    totalLines: lines.length,
    totalBytes: fs.statSync(absSource).size,
    detectedEol: detectEol(rawContent) === '\r\n' ? 'CRLF' : 'LF',
    symbolCount: symbols.length,
    symbols,
    sectionComments,
    domQueryCount: domQueries.size,
    domQueries: Array.from(domQueries).sort(),
    eventListenerCount: eventListeners.length,
    eventCountsByType,
    memberCallCount: memberCalls.size,
    memberCalls: Array.from(memberCalls).sort()
  }, null, 2));
}
module.exports = { cmdSurvey, getSymbolPatternsForLang };
