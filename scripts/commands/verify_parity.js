const fs = require('fs');
const path = require('path');
const { resolveAndCheck, detectLanguage } = require('../core/utils');
const { stripCommentsAndStringsKeepLines } = require('../core/lexical_scanner');
const { getSymbolPatternsForLang } = require('./survey');
function extractAllSymbolNames(content, langInfo) {
  const cleanContent = stripCommentsAndStringsKeepLines(content, langInfo);
  const symbols = new Set();
  const patterns = getSymbolPatternsForLang(langInfo);

  const excluded = new Set([
    'if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'else', 'try', 'new',
    'typeof', 'delete', 'void', 'throw', 'await', 'import', 'package', 'using', 'from'
  ]);

  for (const { regex } of patterns) {
    let m;
    while ((m = regex.exec(cleanContent)) !== null) {
      const name = m[1];
      if (name && !excluded.has(name)) {
        symbols.add(name);
      }
    }
  }

  return Array.from(symbols);
}

function extractDomIds(content) {
  const ids = new Set();
  const idAttrRegex = /id\s*=\s*['"`]([a-zA-Z0-9_-]+)['"`]/g;
  const getElemRegex = /getElementById\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  const qsRegex = /querySelector(?:All)?\s*\(\s*['"`]#([a-zA-Z0-9_-]+)/g;

  let m;
  while ((m = idAttrRegex.exec(content)) !== null) ids.add(m[1]);
  while ((m = getElemRegex.exec(content)) !== null) ids.add(m[1]);
  while ((m = qsRegex.exec(content)) !== null) ids.add(m[1]);
  return Array.from(ids);
}

function extractEventsByType(content) {
  const counts = {};
  const eventRegex = /\.addEventListener\s*\(\s*['"`]([^'"`]+)['"`]/g;
  let m;
  while ((m = eventRegex.exec(content)) !== null) {
    const ev = m[1];
    counts[ev] = (counts[ev] || 0) + 1;
  }
  return counts;
}

function cmdVerifyParity(backupPath, targetFiles) {
  const absBak = resolveAndCheck(backupPath, 'Backup file');
  const langInfo = detectLanguage(absBak);

  if (!targetFiles || targetFiles.length === 0) {
    console.error('[ERROR] Provide one or more target split files.');
    process.exit(1);
  }

  const backupContent = fs.readFileSync(absBak, 'utf8');
  const backupSymbols = extractAllSymbolNames(backupContent, langInfo);

  // 1. Symbol Parity: Missing & Duplicate Symbols
  const targetSymbolOccurrences = new Map();
  const missingTargets = [];

  targetFiles.forEach(tf => {
    const absTf = path.resolve(tf);
    if (!fs.existsSync(absTf)) {
      missingTargets.push(absTf);
      return;
    }
    const content = fs.readFileSync(absTf, 'utf8');
    const tfLang = detectLanguage(absTf);
    extractAllSymbolNames(content, tfLang).forEach(sym => {
      if (!targetSymbolOccurrences.has(sym)) {
        targetSymbolOccurrences.set(sym, []);
      }
      targetSymbolOccurrences.get(sym).push(path.basename(absTf));
    });
  });

  const missingSymbols = backupSymbols.filter(sym => !targetSymbolOccurrences.has(sym));
  const duplicateSymbols = [];
  targetSymbolOccurrences.forEach((files, sym) => {
    if (files.length > 1) {
      duplicateSymbols.push({ symbol: sym, foundIn: files });
    }
  });

  // 2. DOM ID Parity (checked if backup has DOM IDs)
  const backupDomIds = extractDomIds(backupContent);
  const targetDomIdSet = new Set();
  if (backupDomIds.length > 0) {
    targetFiles.forEach(tf => {
      const absTf = path.resolve(tf);
      if (fs.existsSync(absTf)) {
        extractDomIds(fs.readFileSync(absTf, 'utf8')).forEach(id => targetDomIdSet.add(id));
      }
    });
  }
  const missingDomIds = backupDomIds.filter(id => !targetDomIdSet.has(id));

  // 3. Event Listener Parity (checked if backup has event listeners)
  const backupEventsByType = extractEventsByType(backupContent);
  const targetEventsByType = {};
  const hasEvents = Object.keys(backupEventsByType).length > 0;
  if (hasEvents) {
    targetFiles.forEach(tf => {
      const absTf = path.resolve(tf);
      if (fs.existsSync(absTf)) {
        const tfEvents = extractEventsByType(fs.readFileSync(absTf, 'utf8'));
        for (const [ev, count] of Object.entries(tfEvents)) {
          targetEventsByType[ev] = (targetEventsByType[ev] || 0) + count;
        }
      }
    });
  }

  const droppedEvents = [];
  if (hasEvents) {
    for (const [ev, bakCount] of Object.entries(backupEventsByType)) {
      const targetCount = targetEventsByType[ev] || 0;
      if (targetCount < bakCount) {
        droppedEvents.push({ event: ev, backupCount: bakCount, targetCount, lost: bakCount - targetCount });
      }
    }
  }

  // 4. Member Calls Audit (this.* or self.*)
  const backupDeclaredSymbols = new Set(backupSymbols);
  const allTargetDeclaredSymbols = new Set(targetSymbolOccurrences.keys());
  const unresolvedMemberCalls = new Set();
  const isPython = langInfo.lang === 'python';
  const memberRegex = isPython ? /self\.([a-zA-Z0-9_]+)\s*\(/g : /this\.([a-zA-Z0-9_$]+)\s*\(/g;

  targetFiles.forEach(tf => {
    const absTf = path.resolve(tf);
    if (fs.existsSync(absTf)) {
      const cleanContent = stripCommentsAndStringsKeepLines(fs.readFileSync(absTf, 'utf8'), detectLanguage(absTf));
      let m;
      while ((m = memberRegex.exec(cleanContent)) !== null) {
        const calledMethod = m[1];
        if (backupDeclaredSymbols.has(calledMethod) && !allTargetDeclaredSymbols.has(calledMethod)) {
          unresolvedMemberCalls.add({ method: calledMethod, calledIn: path.basename(absTf) });
        }
      }
    }
  });

  const totalBackupSymbols = backupSymbols.length;
  const foundSymbolsCount = totalBackupSymbols - missingSymbols.length;
  const coveragePercent = totalBackupSymbols > 0 ? ((foundSymbolsCount / totalBackupSymbols) * 100).toFixed(2) : '100.00';

  const isFullMatch = missingSymbols.length === 0 &&
                      missingDomIds.length === 0 &&
                      droppedEvents.length === 0 &&
                      unresolvedMemberCalls.size === 0 &&
                      missingTargets.length === 0;

  console.log(JSON.stringify({
    status: isFullMatch ? 'FULL_PARITY_VERIFIED' : 'PARITY_MISMATCH',
    language: langInfo.name,
    gateReport: {
      axis1_symbols: {
        backupTotal: totalBackupSymbols,
        foundInTargets: foundSymbolsCount,
        coveragePercent: `${coveragePercent}%`,
        missingSymbols,
        duplicateSymbols
      },
      axis2_domIds: {
        backupTotal: backupDomIds.length,
        missingDomIds: backupDomIds.length > 0 ? missingDomIds : 'NOT_APPLICABLE'
      },
      axis3_events: {
        backupEventsByType,
        targetEventsByType,
        droppedEvents: hasEvents ? droppedEvents : 'NOT_APPLICABLE'
      },
      axis4_orphanMemberAudit: {
        targetKeyword: isPython ? 'self.*' : 'this.*',
        unresolvedCalls: Array.from(unresolvedMemberCalls)
      }
    },
    missingTargetFiles: missingTargets
  }, null, 2));

  if (!isFullMatch) process.exit(2);
}
module.exports = { cmdVerifyParity, extractAllSymbolNames, extractDomIds, extractEventsByType };
