const fs = require('fs');

// ─── Lexical Scanner: Polyglot Comments, Strings & Blocks ─

/**
 * Replaces comments and strings with spaces, keeping exact newlines intact.
 * Line and character offsets are preserved 1:1 across all languages.
 */
function stripCommentsAndStringsKeepLines(content, langInfo) {
  let result = '';
  let i = 0;
  const len = content.length;
  const isPython = langInfo && (langInfo.lang === 'python' || langInfo.ext === '.py' || langInfo.ext === '.pyw');
  const isRuby = langInfo && (langInfo.lang === 'ruby' || langInfo.ext === '.rb');
  const isPhp = langInfo && (langInfo.lang === 'php' || langInfo.ext === '.php');

  while (i < len) {
    const ch = content[i];
    const next = content[i + 1];

    // Python / Ruby / PHP single-line comment # ...
    if ((isPython || isRuby || isPhp) && ch === '#') {
      result += ' ';
      i++;
      while (i < len && content[i] !== '\n') {
        result += ' ';
        i++;
      }
      continue;
    }

    // Python triple-quoted string """ ... """ or ''' ... '''
    if (isPython && ((ch === '"' && content[i + 1] === '"' && content[i + 2] === '"') ||
                     (ch === "'" && content[i + 1] === "'" && content[i + 2] === "'"))) {
      const q3 = content.slice(i, i + 3);
      result += '   ';
      i += 3;
      while (i < len && content.slice(i, i + 3) !== q3) {
        if (content[i] === '\\' && i + 1 < len) {
          result += content[i + 1] === '\n' ? '\n' : '  ';
          i += 2;
        } else {
          result += content[i] === '\n' ? '\n' : ' ';
          i++;
        }
      }
      if (i < len) {
        result += '   ';
        i += 3;
      }
      continue;
    }

    // C-style single-line comment //
    if (!isPython && !isRuby && ch === '/' && next === '/') {
      result += '  ';
      i += 2;
      while (i < len && content[i] !== '\n') {
        result += ' ';
        i++;
      }
      continue;
    }

    // C-style multi-line comment /* ... */
    if (!isPython && !isRuby && ch === '/' && next === '*') {
      result += '  ';
      i += 2;
      while (i < len && !(content[i] === '*' && content[i + 1] === '/')) {
        result += content[i] === '\n' ? '\n' : ' ';
        i++;
      }
      if (i < len) {
        result += '  ';
        i += 2;
      }
      continue;
    }

    // Single quote string '...'
    if (ch === "'") {
      result += ' ';
      i++;
      while (i < len && content[i] !== "'") {
        if (content[i] === '\\' && i + 1 < len) {
          result += content[i + 1] === '\n' ? '\n' : '  ';
          i += 2;
        } else {
          result += content[i] === '\n' ? '\n' : ' ';
          i++;
        }
      }
      if (i < len) { result += ' '; i++; }
      continue;
    }

    // Double quote string "..."
    if (ch === '"') {
      result += ' ';
      i++;
      while (i < len && content[i] !== '"') {
        if (content[i] === '\\' && i + 1 < len) {
          result += content[i + 1] === '\n' ? '\n' : '  ';
          i += 2;
        } else {
          result += content[i] === '\n' ? '\n' : ' ';
          i++;
        }
      }
      if (i < len) { result += ' '; i++; }
      continue;
    }

    // Template literal `...`
    if (ch === '`') {
      result += ' ';
      i++;
      while (i < len && content[i] !== '`') {
        if (content[i] === '\\' && i + 1 < len) {
          result += content[i + 1] === '\n' ? '\n' : '  ';
          i += 2;
        } else {
          result += content[i] === '\n' ? '\n' : ' ';
          i++;
        }
      }
      if (i < len) { result += ' '; i++; }
      continue;
    }

    result += ch;
    i++;
  }

  return result;
}

/**
 * Finds matching closing brace '}' starting from openBraceOffset in raw content.
 */
function findMatchingCloseBrace(content, openBraceOffset) {
  let depth = 0;
  let i = openBraceOffset;
  const len = content.length;

  while (i < len) {
    const ch = content[i];
    const next = content[i + 1];

    if (ch === '/' && next === '/') {
      while (i < len && content[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < len && !(content[i] === '*' && content[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      i++;
      while (i < len && content[i] !== quote) {
        if (content[i] === '\\') i++;
        i++;
      }
      i++;
      continue;
    }

    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
    i++;
  }

  return -1;
}

/**
 * Finds Python block end line based on indentation.
 */
function findPythonBlockEnd(lines, startLineIdx, baseIndent) {
  let lastNonEmpty = startLineIdx + 1;
  for (let i = startLineIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '' || line.trim().startsWith('#')) {
      continue;
    }
    const indent = (line.match(/^[ \t]*/)[0] || '').length;
    if (indent <= baseIndent) {
      return lastNonEmpty;
    }
    lastNonEmpty = i + 1;
  }
  return lines.length;
}

function offsetToLineNumber(content, offset) {
  if (offset < 0) return null;
  return content.slice(0, offset).split(/\r?\n/).length;
}

function validateStructuralSyntax(absPath, langInfo) {
  const content = fs.readFileSync(absPath, 'utf8');
  const stack = [];
  const clean = stripCommentsAndStringsKeepLines(content, langInfo);

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === '{' || ch === '(' || ch === '[') {
      stack.push({ ch, offset: i });
    } else if (ch === '}' || ch === ')' || ch === ']') {
      if (stack.length === 0) {
        const line = offsetToLineNumber(content, i);
        return { file: absPath, status: 'SYNTAX_ERROR', error: `Unexpected closing '${ch}' with no matching opening delimiter at line ${line}` };
      }
      const top = stack.pop();
      const expected = top.ch === '{' ? '}' : (top.ch === '(' ? ')' : ']');
      if (ch !== expected) {
        const line = offsetToLineNumber(content, i);
        const openLine = offsetToLineNumber(content, top.offset);
        return { file: absPath, status: 'SYNTAX_ERROR', error: `Mismatched closing '${ch}' at line ${line}, expected '${expected}' matching '${top.ch}' at line ${openLine}` };
      }
    }
  }

  if (stack.length > 0) {
    const unclosed = stack[stack.length - 1];
    const line = offsetToLineNumber(content, unclosed.offset);
    return { file: absPath, status: 'SYNTAX_ERROR', error: `Unclosed delimiter '${unclosed.ch}' opened at line ${line}` };
  }

  return { file: absPath, status: 'VALID_SYNTAX', mode: 'STRUCTURAL_AST' };
}
module.exports = { stripCommentsAndStringsKeepLines, findMatchingCloseBrace, findPythonBlockEnd, offsetToLineNumber, validateStructuralSyntax };
