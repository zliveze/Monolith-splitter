<p align="center">
  <img src="assets/images/banner.svg" alt="Monolith Splitter" width="100%" />
</p>

# Monolith Splitter

> Surgical refactoring CLI and AI agent skill that splits large source files into modular units without rewriting code or hallucinating changes.

[![Version](https://img.shields.io/badge/version-2.1.0-blue.svg?style=flat-square)](package.json)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-green.svg?style=flat-square)](scripts/split_helper.js)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg?style=flat-square)](LICENSE)

---

## Overview

When refactoring a 1,000–10,000+ line monolith, standard LLMs often attempt to rewrite the code from context. This leads to dropped functions, broken indentation in Python, inaccessible private members in C#, and context window timeouts.

**Monolith Splitter** treats splitting as a topological file extraction rather than a code generation task:
- Chunks are extracted **verbatim** from disk (zero rewritten tokens).
- Target files use **language-native seams** (C# `partial class`, Go `package`, JS transparent proxy, Python submodules).
- File parity is verified across 4 dimensions: **Symbols, DOM IDs, Event Listeners, and Member references**.

---

## Installation

### Via skills.sh (Recommended for AI Agents)

Works with Google Antigravity, Claude Code, Cursor, and Windsurf:

```bash
# Global installation
npx skills add https://github.com/zliveze/Monolith-splitter -g

# Project-level installation
npx skills add https://github.com/zliveze/Monolith-splitter --skill "monolith-splitter"
```

### Standalone CLI (Zero Dependencies)

Requires Node.js (>= 18). No `npm install` required:

```bash
node scripts/split_helper.js --help
```

---

## Supported Languages & Seam Architectures

| Language | Target Patterns | Seam Strategy |
|:---|:---|:---|
| **Python** | Django, FastAPI, Flask, Celery | Submodule package (`__init__.py`) / Mixins with `--strip-indent` |
| **C# / .NET** | ASP.NET Core, EF Core, Unity | Native `partial class` companion files via `--partial-class` |
| **Go** | Gin, Fiber, Echo, standard library | Directory-level package decomposition via `--package` |
| **JavaScript / TypeScript** | React, Vue, Node.js, Web Extensions | Transparent Coordinator delegation via `--with-proxy-seam` |
| **Java / Kotlin** | Spring Boot, Android | Spring delegate components / DI |
| **Rust** | Actix, Tokio, Axum | Module tree separation (`mod` & `pub use`) |
| **PHP** | Laravel, Symfony | Trait composition & service injection |
| **C / C++** | Qt, CMake, systems programming | Namespace & translation unit separation |

---

## The 6-Phase Protocol

<p align="center">
  <img src="assets/images/workflow.svg" alt="6-Phase Architecture" width="100%" />
</p>

1. **Survey**: Lexical AST scan identifies symbols, line boundaries (`startLine`, `endLine`), and member calls.
2. **Blueprint**: Select a language-native seam pattern to maintain callability without glue code.
3. **Backup**: Creates an immutable snapshot `<file>.bak` with SHA-256 verification.
4. **Verbatim Slice**: Extracts line ranges directly from disk into modular files.
5. **Parity Gate**: Compares symbols, DOM identifiers, event listeners, and member calls between source and output files.
6. **Slim & Cleanup**: Removes extracted ranges from the coordinator file bottom-up with zero LLM output tokens.

---

## CLI Usage

### 1. Python Monolith (FastAPI / Django)

```bash
# 1. Survey symbols with indentation boundary detection
node scripts/split_helper.js survey app/services/monolith.py

# 2. Create immutable backup
node scripts/split_helper.js backup app/services/monolith.py

# 3. Slice UserService (lines 10-95) with normalized indentation
node scripts/split_helper.js slice app/services/monolith.py.bak 10-95 app/services/user_service.py --strip-indent

# 4. Verify symbol parity
node scripts/split_helper.js verify-parity app/services/monolith.py.bak app/services/user_service.py app/services/monolith.py
```

### 2. C# Monolith (.NET)

```bash
# Extract controller actions into a partial class companion
node scripts/split_helper.js slice Controllers/OrderController.cs.bak 120-340 Controllers/OrderController.Billing.cs \
  --partial-class OrderController \
  --namespace App.Controllers

# Validate curly-brace and structural token balance
node scripts/split_helper.js check-syntax Controllers/OrderController.Billing.cs
```

### 3. JavaScript / TypeScript Monolith

```bash
# Extract multi-range UI logic with a transparent proxy seam
node scripts/split_helper.js slice src/ui.js.bak 200-450,1800-2100 src/tabs/scan_tab.js \
  --class-wrapper ScanTab \
  --with-proxy-seam \
  --strip-indent

# Replace extracted lines in coordinator bottom-up
node scripts/split_helper.js replace-range src/ui.js 1800 2100 --with "    this.scanTab.bindEvents(el);"
node scripts/split_helper.js replace-range src/ui.js 200 450 --with "    \${this.scanTab.render()}"
```

---

## Performance Benchmark

<p align="center">
  <img src="assets/images/benchmark.svg" alt="Benchmark Comparison" width="100%" />
</p>

| Metric | Full LLM Rewrite | Monolith Splitter |
|:---|:---:|:---:|
| **Output Token Consumption** | ~140,000 tokens | **~800 tokens** (routing glue only) |
| **Execution Latency** | 3–6 minutes | **< 3 seconds** (native disk I/O) |
| **Dropped Functions / Edge Cases** | High risk | **0** (byte-exact slicing) |
| **Indentation Errors (Python)** | Frequent | **0** (exact line slicing) |
| **Member Reference Failures** | Common (`this` / `self` loss) | **0** (native proxy & partial seams) |
| **Parity Verification** | Manual review | **100% automated** (4-axis audit) |

---

## Command Reference

| Command | Description |
|:---|:---|
| `survey <file>` | Scans AST/indentation to report symbols, start/end lines, events, and member calls. |
| `backup <file>` | Creates `<file>.bak.<timestamp>` with SHA-256 hash. |
| `restore <file>` | Restores file from the latest `.bak` snapshot. |
| `slice <file> <ranges> <target>` | Verbatim extraction across single or multiple ranges (e.g. `20-80,120-190`). |
| `replace-range <file> <start> <end>` | Replaces or deletes line range directly on disk. |
| `check-syntax <files...>` | Validates syntax via runtime compilers or structural token AST validator. |
| `verify-parity <backup> <targets...>` | Runs 4-Axis Parity Gate: symbols, DOM IDs, events, and unresolved member calls. |
| `clean-backup <file>` | Removes `.bak` and timestamped snapshots after user confirmation. |

---

## License

MIT © [zliveze](https://github.com/zliveze)
