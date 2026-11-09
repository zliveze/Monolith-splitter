const fs = require('fs');
const { resolveAndCheck } = require('../core/utils');
function cmdDiffLines(args) {
  const fileA = args[0];
  const fileB = args[1];

  if (!fileA || !fileB) {
    console.error('Usage: node split_helper.js diff-lines <fileA> <fileB>');
    process.exit(1);
  }

  const absA = resolveAndCheck(fileA, 'File A');
  const absB = resolveAndCheck(fileB, 'File B');

  const linesA = fs.readFileSync(absA, 'utf8').split(/\r?\n/);
  const linesB = fs.readFileSync(absB, 'utf8').split(/\r?\n/);

  const setA = new Set(linesA.map(l => l.trimEnd()));
  const setB = new Set(linesB.map(l => l.trimEnd()));

  const onlyInA = linesA.filter(l => !setB.has(l.trimEnd())).length;
  const onlyInB = linesB.filter(l => !setA.has(l.trimEnd())).length;
  const common = linesA.filter(l => setB.has(l.trimEnd())).length;

  console.log(JSON.stringify({
    fileA: absA,
    fileB: absB,
    linesA: linesA.length,
    linesB: linesB.length,
    commonLines: common,
    onlyInA,
    onlyInB,
    identicalContent: onlyInA === 0 && onlyInB === 0
  }, null, 2));
}
module.exports = { cmdDiffLines };
