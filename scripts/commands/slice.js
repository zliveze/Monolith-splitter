const fs = require('fs');
const path = require('path');
const { resolveAndCheck, detectEol } = require('../core/utils');
function parseRanges(rangesStr, totalLines) {
  const result = [];
  const parts = rangesStr.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    let start, end;
    if (trimmed.includes('-')) {
      const sp = trimmed.split('-');
      start = parseInt(sp[0], 10);
      end = parseInt(sp[1], 10);
    } else if (trimmed.includes(':')) {
      const sp = trimmed.split(':');
      start = parseInt(sp[0], 10);
      end = parseInt(sp[1], 10);
    } else {
      start = parseInt(trimmed, 10);
      end = start;
    }

    if (isNaN(start) || isNaN(end) || start < 1 || end < start || start > totalLines) {
      console.error(`[ERROR] Invalid range: "${part}" (file has ${totalLines} lines)`);
      process.exit(1);
    }

    if (end > totalLines) end = totalLines;
    result.push({ start, end });
  }

  return result;
}

function detectCommonIndent(lines) {
  let minIndent = Infinity;
  for (const line of lines) {
    if (!line.trim()) continue;
    const match = line.match(/^(\s*)/);
    const indent = match ? match[1].length : 0;
    if (indent < minIndent) minIndent = indent;
  }
  return minIndent === Infinity ? 0 : minIndent;
}

function stripIndent(lines) {
  const minIndent = detectCommonIndent(lines);
  if (minIndent === 0) return lines;
  return lines.map(line => {
    if (!line.trim()) return '';
    return line.slice(minIndent);
  });
}

function cmdSlice(args) {
  const sourcePath = args[0];
  let rangesArg = args[1];
  let targetPath = args[2];

  let nextIdx = 3;
  if (args[1] && args[2] && !isNaN(parseInt(args[1], 10)) && !isNaN(parseInt(args[2], 10))) {
    rangesArg = `${args[1]}-${args[2]}`;
    targetPath = args[3];
    nextIdx = 4;
  }

  if (!sourcePath || !rangesArg || !targetPath) {
    console.error(`Usage: node split_helper.js slice <source> <ranges> <target> [flags]
Ranges: "274-600,5200-5850" or "startLine endLine"
Flags:
  --strip-indent
  --class-wrapper <ClassName>     (JavaScript / TypeScript class wrapper)
  --with-proxy-seam               (Auto Proxy delegating to Coordinator)
  --export-class                  (Browser & CJS exports)
  --partial-class <ClassName>     (C# partial class seam)
  --namespace <Name>              (C# / C++ namespace wrapper)
  --package <Name>                (Go / Java package declaration)
  --header <text> / --header-file <path>
  --footer <text> / --footer-file <path>
  --append
  --eol <lf|crlf>
  --dry-run
`);
    process.exit(1);
  }

  const absSource = resolveAndCheck(sourcePath, 'Source file');
  const rawContent = fs.readFileSync(absSource, 'utf8');
  const sourceLines = rawContent.split(/\r?\n/);
  const totalLines = sourceLines.length;

  const ranges = parseRanges(rangesArg, totalLines);

  let stripIndentFlag = false;
  let classWrapper = null;
  let withProxySeam = false;
  let exportClass = false;
  let partialClass = null;
  let namespaceWrapper = null;
  let packageHeader = null;
  let header = '';
  let footer = '';
  let appendMode = false;
  let eol = detectEol(rawContent);
  let dryRun = false;

  for (let i = nextIdx; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--strip-indent') stripIndentFlag = true;
    else if (flag === '--class-wrapper' && args[i + 1]) classWrapper = args[++i];
    else if (flag === '--with-proxy-seam') withProxySeam = true;
    else if (flag === '--export-class') exportClass = true;
    else if (flag === '--partial-class' && args[i + 1]) partialClass = args[++i];
    else if (flag === '--namespace' && args[i + 1]) namespaceWrapper = args[++i];
    else if (flag === '--package' && args[i + 1]) packageHeader = args[++i];
    else if (flag === '--header' && args[i + 1] !== undefined) header = args[++i];
    else if (flag === '--header-file' && args[i + 1]) header = fs.readFileSync(args[++i], 'utf8');
    else if (flag === '--footer' && args[i + 1] !== undefined) footer = args[++i];
    else if (flag === '--footer-file' && args[i + 1]) footer = fs.readFileSync(args[++i], 'utf8');
    else if (flag === '--append') appendMode = true;
    else if (flag === '--eol' && args[i + 1]) eol = args[++i].toLowerCase() === 'crlf' ? '\r\n' : '\n';
    else if (flag === '--dry-run') dryRun = true;
  }

  const extractedBlocks = [];
  let totalExtractedLines = 0;

  for (const { start, end } of ranges) {
    let block = sourceLines.slice(start - 1, end);
    totalExtractedLines += block.length;
    if (stripIndentFlag) {
      block = stripIndent(block);
    }
    extractedBlocks.push(block.join(eol));
  }

  let bodyContent = extractedBlocks.join(eol + eol);

  // 1. C# Partial Class Wrapper
  if (partialClass) {
    const indented = bodyContent.split(eol).map(l => l.trim() ? '    ' + l : '').join(eol);
    bodyContent = `public partial class ${partialClass}${eol}{${eol}${indented}${eol}}${eol}`;
  }

  // 2. JavaScript / TypeScript Class Wrapper
  if (classWrapper) {
    const indentedBody = bodyContent.split(eol).map(l => l.trim() ? '  ' + l : '').join(eol);
    let proxyConstructor = '';

    if (withProxySeam) {
      proxyConstructor = [
        `  constructor(uiContext) {`,
        `    this._ui = uiContext;`,
        `    return new Proxy(this, {`,
        `      get(target, prop, receiver) {`,
        `        if (prop in target) {`,
        `          const val = target[prop];`,
        `          return typeof val === 'function' ? val.bind(target) : val;`,
        `        }`,
        `        if (target._ui && prop in target._ui) {`,
        `          const val = target._ui[prop];`,
        `          return typeof val === 'function' ? val.bind(target._ui) : val;`,
        `        }`,
        `        return undefined;`,
        `      },`,
        `      set(target, prop, value) {`,
        `        if (prop in target) { target[prop] = value; return true; }`,
        `        if (target._ui && prop in target._ui) { target._ui[prop] = value; return true; }`,
        `        target[prop] = value;`,
        `        return true;`,
        `      }`,
        `    });`,
        `  }`,
        ``
      ].join(eol);
    }

    bodyContent = `class ${classWrapper} {` + eol + proxyConstructor + indentedBody + eol + `}` + eol;
  }

  // 3. Namespace Wrapper (C# / C++)
  if (namespaceWrapper) {
    const indented = bodyContent.split(eol).map(l => l.trim() ? '    ' + l : '').join(eol);
    bodyContent = `namespace ${namespaceWrapper}${eol}{${eol}${indented}${eol}}${eol}`;
  }

  // 4. Package Header (Go / Java)
  if (packageHeader) {
    header = `package ${packageHeader}${eol}${eol}` + (header ? header : '');
  }

  // 5. Export class block for JS
  let exportSnippet = '';
  if (classWrapper && exportClass) {
    exportSnippet = [
      eol,
      `if (typeof window !== 'undefined') window.${classWrapper} = ${classWrapper};`,
      `if (typeof module !== 'undefined' && module.exports) module.exports = ${classWrapper};`
    ].join(eol) + eol;
  }

  const finalOutput = (header ? header + eol : '') + bodyContent + exportSnippet + (footer ? eol + footer : '') + eol;

  if (dryRun) {
    console.log(JSON.stringify({
      status: 'DRY_RUN',
      source: absSource,
      target: path.resolve(targetPath),
      ranges,
      totalLinesExtracted: totalExtractedLines,
      eol: eol === '\r\n' ? 'CRLF' : 'LF',
      classWrapper,
      withProxySeam,
      partialClass,
      namespaceWrapper,
      packageHeader,
      targetSizeBytes: Buffer.byteLength(finalOutput, 'utf8'),
      preview: finalOutput.split(eol).slice(0, 8).join(eol) + (finalOutput.split(eol).length > 8 ? eol + '...' : '')
    }, null, 2));
    return;
  }

  const absTarget = path.resolve(targetPath);
  const baseTarget = path.basename(absTarget);

  if (baseTarget.startsWith('_') && !['locales', 'metadata'].some(x => baseTarget.startsWith('_' + x))) {
    console.warn(`[WARNING] Target filename '${baseTarget}' starts with '_'. Chrome Extensions strictly reserve '_' prefixes! Use 'temp-' prefix or os.tmpdir() instead.`);
  }

  fs.mkdirSync(path.dirname(absTarget), { recursive: true });

  if (appendMode && fs.existsSync(absTarget)) {
    fs.appendFileSync(absTarget, eol + finalOutput, { encoding: 'utf8' });
  } else {
    fs.writeFileSync(absTarget, finalOutput, { encoding: 'utf8' });
  }

  console.log(JSON.stringify({
    status: 'SUCCESS',
    mode: appendMode ? 'APPEND' : 'CREATE',
    source: absSource,
    target: absTarget,
    ranges,
    linesExtracted: totalExtractedLines,
    eol: eol === '\r\n' ? 'CRLF' : 'LF',
    withProxySeam,
    partialClass,
    targetSizeBytes: fs.statSync(absTarget).size
  }, null, 2));
}
module.exports = { cmdSlice, parseRanges, detectCommonIndent, stripIndent };
