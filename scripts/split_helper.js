#!/usr/bin/env node
/**
 * split_helper.js — Monolith Splitter v2.1 (Universal Polyglot Edition)
 * Modular CLI Coordinator & Router.
 * Zero-dependency.
 *
 * Architecture:
 *   scripts/
 *   ├── split_helper.js          (Coordinator Router)
 *   ├── core/
 *   │   ├── utils.js             (Language detection, EOL, Hashing, Command check)
 *   │   └── lexical_scanner.js   (Polyglot AST scanner, brace/block matcher, structural AST)
 *   └── commands/
 *       ├── backup.js            (backup, restore, clean-backup)
 *       ├── survey.js            (survey, polyglot patterns)
 *       ├── slice.js             (slice, multi-range, seam wrappers)
 *       ├── replace_range.js     (replace-range, in-place bottom-up slimming)
 *       ├── check_syntax.js      (check-syntax, polyglot compilers + structural AST)
 *       ├── verify_parity.js     (verify-parity, 4-Axis parity gate)
 *       ├── diff_lines.js        (diff-lines, line overlap counter)
 *       └── validate_env.js      (validate-env, Chrome extension environment blocker scanner)
 */

const { cmdBackup, cmdRestore, cmdCleanBackup } = require('./commands/backup');
const { cmdSurvey } = require('./commands/survey');
const { cmdSlice } = require('./commands/slice');
const { cmdReplaceRange } = require('./commands/replace_range');
const { cmdCheckSyntax } = require('./commands/check_syntax');
const { cmdVerifyParity } = require('./commands/verify_parity');
const { cmdDiffLines } = require('./commands/diff_lines');
const { cmdValidateEnv } = require('./commands/validate_env');

// ─── MAIN ROUTER ─────────────────────────────────────────

const [,, command, ...args] = process.argv;

const COMMANDS = {
  'backup':        () => cmdBackup(args[0]),
  'restore':       () => cmdRestore(args),
  'survey':        () => cmdSurvey(args[0]),
  'slice':         () => cmdSlice(args),
  'replace-range': () => cmdReplaceRange(args),
  'check-syntax':  () => cmdCheckSyntax(args),
  'verify-parity': () => cmdVerifyParity(args[0], args.slice(1)),
  'diff-lines':    () => cmdDiffLines(args),
  'clean-backup':  () => cmdCleanBackup(args[0]),
  'validate-env':  () => cmdValidateEnv(args[0]),
};

if (COMMANDS[command]) {
  COMMANDS[command]();
} else {
  console.log(`
Monolith Splitter CLI v2.1 (Universal Polyglot Edition)
Supports ALL Languages: JavaScript, TypeScript, Python, Java, C#, C++, Go, Rust, PHP, Ruby, etc.
Usage: node split_helper.js <command> [arguments]

Commands:
  backup <file>                                      Timestamped snapshot + SHA-256 + line count
  restore <file> [--backup <path>]                   Rollback file from .bak snapshot
  survey <file>                                      Universal Lexical AST scanner with exact startLine/endLine/lineCount,
                                                     polyglot symbols, DOM IDs, events, and member calls (this.* / self.*)
  slice <file> <ranges> <target> [flags]             Verbatim extraction across single or multiple ranges
                                                     Ranges: "274-600,5200-5850" or "startLine endLine"
    --strip-indent                                   Auto-dedent per extracted range
    --class-wrapper <ClassName>                      Wrap inside a single class declaration (JS / TS)
    --with-proxy-seam                                Auto-generate transparent Proxy constructor
    --export-class                                   Add browser & CommonJS export snippet
    --partial-class <ClassName>                      Wrap in public partial class Name { ... } (C# Seam)
    --namespace <Name>                               Wrap in namespace Name { ... } (C# / C++)
    --package <Name>                                 Prepend package Name (Go / Java)
    --header <text> / --header-file <path>           Prepend header
    --footer <text> / --footer-file <path>           Append footer
    --append                                         Append to target file
    --eol <lf|crlf>                                  Preserve or force specific line ending
    --dry-run                                        Preview extraction metadata without writing to disk
  replace-range <file> <start> <end> [flags]         In-place line-range replacement for bottom-up Coordinator slimming
    --with "<text>" / --with-file "<path>"           Replace range with text (omitting deletes lines)
    --eol <lf|crlf>                                  Line ending style
  check-syntax <files...>                            Polyglot syntax validation (Node, Python, PHP, Go, JSON, and Structural AST)
  verify-parity <backup> <targets...>                4-Axis Parity Gate:
                                                     Axis 1: Symbols (missing & duplicates across any language)
                                                     Axis 2: DOM IDs
                                                     Axis 3: Event Listeners by type
                                                     Axis 4: Orphan Member Audit (this.* / self.*)
  diff-lines <fileA> <fileB>                         Compare content line overlap between two files
  clean-backup <file_or_bak_path>                    Clean both .bak and .bak.<timestamp> files
  validate-env [dir]                                 Scan for forbidden '_' prefixes in extensions & check manifest
`);
}
