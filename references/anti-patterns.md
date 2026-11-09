# The Monolith Refactoring Traps & AI Anti-Patterns

When tasked with splitting a massive monolithic file (1,000–15,000+ lines across Python, Java, C#, C++, Go, Rust, PHP, Ruby, TypeScript, or JavaScript), AI coding assistants fall into predictable, catastrophic traps. This document breaks down each failure mode with real-world examples and explains why **Verbatim Transplantation** is the only safe approach.

---

## 1. The "Concise Rewrite" Trap (Hallucination of Brevity)

### The Failure Mode
The user asks: *"Split this file into smaller, cleaner modules."*  
The LLM interprets "cleaner" as an invitation to rewrite working functions into "modern, concise" versions.

### What Actually Happens

```javascript
// BEFORE (Original — 45 lines, handles edge cases)
function parseApiResponse(raw, fallbackSiteId) {
  if (!raw) return { success: false, records: [], siteId: fallbackSiteId };
  let parsed;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    console.error('[API] JSON parse failed, trying regex fallback:', e);
    const matched = raw.match(/\{.*"result"\s*:\s*\[(.*)\].*\}/s);
    if (!matched) return { success: false, records: [], siteId: fallbackSiteId };
    try { parsed = JSON.parse(matched[0]); } catch (_) { return { success: false, records: [] }; }
  }
  const items = parsed.result?.items || parsed.items || parsed.data || [];
  const siteId = parsed.siteId || parsed.site_id || fallbackSiteId;
  return {
    success: true,
    records: items.filter(r => r && (r.id || r.code)).map(r => ({ ...r, _synced: true })),
    siteId: String(siteId).trim()
  };
}

// AFTER (What the AI writes — "cleaner", but silently broken)
const parseApiResponse = (raw) => {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return { success: true, records: data.items || [], siteId: data.siteId };
};
// ❌ Edge-case regex fallback: GONE
// ❌ Null check: GONE -> crashes on undefined
// ❌ Legacy field fallbacks (result.items, data): GONE
// ❌ Record validation and _synced flag: GONE
// ❌ Site ID trimming & string coercion: GONE
```

**Result:** Code passes linting, compiles without errors, but explodes in production when encountering the first non-standard API response.

---

## 2. The Template Truncation (The `// ... TODO` Disaster)

### The Failure Mode
A monolithic UI file typically contains thousands of lines of inline HTML templates (dropdowns, modals, 50-field forms, tables). When generating the new file, the LLM runs low on context or output budget:

```javascript
// What the AI outputs:
renderForm() {
  return `
    <div class="patient-form">
      <input id="patient-name" placeholder="Full Name" />
      <input id="patient-dob" type="date" />
      <!-- TODO: Add remaining 48 medical fields from original file -->
      <button id="btn-submit">Submit</button>
    </div>
  `;
}
```

**Result:** 80% of the UI vanishes. Form submissions fail because mandatory fields are missing from the DOM.

---

## 3. The Hallucinated Helper Trap

### The Failure Mode
The LLM sees 30 lines of bespoke date parsing or currency formatting and decides: *"A utility function would be much cleaner here!"*

```javascript
// What the AI writes:
import { formatDate, formatCurrency } from '../utils/helpers.js';

// BUT: helpers.js DOES NOT EXIST, or does not export those functions.
// Even if the AI creates helpers.js, its implementation subtly differs
// from the original regex (e.g. DD/MM/YYYY vs YYYY-MM-DD).
```

**Result:** `TypeError: formatDate is not a function` at runtime, or silent data corruption when dates are parsed with swapped day/month fields.

---

## 4. Context & Scope Drift (The Orphan `this` / `self`)

### The Failure Mode
In a monolith, inner functions freely close over outer scope variables or access `this` / `self` properties of a parent class.

```javascript
// Inside the original 11,000-line class:
class MonolithUI {
  bindEvents() {
    btnScan.onclick = () => {
      this.scannedRecords.push(record); // `this` is MonolithUI
      this.updateProgress();             // `this` has updateProgress
    };
  }
}

// What the AI extracts into tab_scan.js:
class TabScan {
  bindEvents() {
    btnScan.onclick = () => {
      this.scannedRecords.push(record); // ❌ `this` is TabScan! scannedRecords is undefined!
      this.updateProgress();             // ❌ TypeError: this.updateProgress is not a function!
    };
  }
}
```

**The Fix**: Use `--with-proxy-seam` (for JS/TS) or Mixins / Delegation seams (for Python/Java/C#).

---

## 5. The Python Indentation Mangling Trap

### The Failure Mode
In Python, indentation *is* syntax. When an LLM reproduces a 300-line Python method, it frequently:
- Accidentally shifts indentation from 4 spaces to 2 spaces.
- Mixes tabs and spaces (`TabError: inconsistent use of tabs and spaces in indentation`).
- Misaligns multi-line `try/except` or `async with` blocks, silently placing statements outside the exception handler!

**The Fix**: Physical line slicing via `split_helper.js slice <src> <start> <end> --strip-indent` uses mathematical whitespace detection (`detectCommonIndent`), guaranteeing zero indentation drift.

---

## 6. The C# Partial Class Visibility Trap

### The Failure Mode
When splitting a 5,000-line C# class into multiple files, AI agents often:
- Create separate classes without the `partial` modifier, causing compiler errors when methods reference private fields.
- Put split files in mismatched namespaces, breaking dependency resolution.

**The Fix**: Use `--partial-class <ClassName> --namespace <Ns>` to generate 100% compliant C# partial class companions.

---

## 7. The Go Package Mismatch Trap

### The Failure Mode
In Go, all `.go` files in a folder must declare the exact same package name. AI models often invent sub-packages (e.g. `package handlers` inside a `package main` folder), instantly breaking `go build`:
```
found packages handlers (scan.go) and main (server.go) in /src/api
```

**The Fix**: Use `--package <name>` to enforce uniform package headers across all split Go files.

---

## 8. The Shifting Line Numbers Trap (Top-Down Editing)

### The Failure Mode
When modularizing a 10,000-line file, the AI surveys the original file and finds:
- Module A is at lines 200–500.
- Module B is at lines 2,000–3,000.
- Module C is at lines 6,000–7,500.

The AI extracts Module A, and then immediately deletes lines 200–500 from the source file.  
**Result:** Every line number below line 500 is now shifted up by 301 lines!
When the AI subsequently runs `slice src 2000 3000 moduleB.js`, it slices lines 2,301–3,301 of the original code, completely corrupting Module B.

### The Solution: The Immutable Snapshot & Bottom-Up Principle
1. **Always slice from `<source_file>.bak`**: The backup snapshot is immutable; its line numbers NEVER shift.
2. **Slim the Coordinator bottom-up**: When replacing or removing extracted blocks from the original file, use `replace-range` starting from the **highest line number to the lowest** (bottom-up: Module C first, then B, then A).

---

## 9. Token Exhaustion & Silent Cutoffs

Generating a 4,000-line module through LLM output tokens takes ~30,000–60,000 tokens and 2–5 minutes, with high probability of hitting the model's `max_tokens` ceiling mid-file.

**The Fix**: Physical line slicing executes on disk in **5 milliseconds** using **0 LLM output tokens**.

---

## The Rule: Verbatim Transplant (Physical Code Slicing)

Every failure mode above is caused by **asking the LLM to reproduce code from memory**.

The `monolith-splitter` skill replaces generation with **deterministic physical slicing**:

$$\text{Refactoring} = \text{Topological Relocation} \quad (\Delta\text{Logic} \equiv 0)$$

1. **Extract lines directly from disk** via `split_helper.js slice`. Zero LLM tokens spent on reproducing code bodies.
2. **Preserve every byte**: every null-check, regex fallback, DOM attribute, inline style, and comment remains identical.
3. **Wire seams explicitly**: inject `(worker, uiContext)` or use partial classes so member references resolve cleanly.
4. **Gate with 100% 4-Axis parity verification**: mathematically prove that `symbols(backup) ⊆ symbols(split)` before claiming completion.
