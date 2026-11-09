# Architectural Seam Patterns for Polyglot Monolith Splitting

A **Seam** (Michael Feathers, *Working Effectively with Legacy Code*) is a place where you can alter program structure and behavior without editing in that place.

When decomposing a 1,000–15,000+ line monolith across **any programming language** (Python, Java, C#, C++, Go, Rust, PHP, Ruby, TypeScript, JavaScript), choosing the right Seam pattern ensures that verbatim-extracted code runs without broken references, scope drift, or member call paradoxes.

---

## Pattern 1: The Transparent Proxy Seam (JavaScript / TypeScript / Python)

### Ideal For
Object-Oriented codebases and components where sub-methods frequently reference parent properties (`this.scannedRecords`, `this.activeTab`, `this.updateProgress()`).

### The Problem It Solves
When verbatim-transplanting methods into a child class, `this` now points to the child instance. If the child doesn't declare `this.updateProgress()`, runtime crashes with:
```
TypeError: this.updateProgress is not a function
```

### The Seam Architecture
Generated automatically via `split_helper.js slice ... --class-wrapper TabScanUI --with-proxy-seam`:

```javascript
class TabScanUI {
  constructor(uiContext, ...args) {
    this.uiContext = uiContext;

    // Transparent Seam Proxy
    return new Proxy(this, {
      get(target, prop, receiver) {
        // 1. If property/method exists on child, execute it
        if (prop in target) {
          const val = Reflect.get(target, prop, receiver);
          return typeof val === 'function' ? val.bind(target) : val;
        }
        // 2. Otherwise, transparently delegate & bind to the Coordinator
        if (uiContext && prop in uiContext) {
          const val = Reflect.get(uiContext, prop, uiContext);
          return typeof val === 'function' ? val.bind(uiContext) : val;
        }
        return undefined;
      },
      set(target, prop, value, receiver) {
        if (prop in target) return Reflect.set(target, prop, value, receiver);
        if (uiContext && prop in uiContext) return Reflect.set(uiContext, prop, value, uiContext);
        return Reflect.set(target, prop, value, receiver);
      }
    });
  }

  // Verbatim transplanted methods:
  render() { ... }
  bindEvents(root) {
    // `this.scannedRecords` -> transparently reads from uiContext
    // `this.updateProgress()` -> transparently calls uiContext.updateProgress()
  }
}
```

---

## Pattern 2: The Partial Class Seam (C# / .NET / Unity)

### Ideal For
Massive C# files (e.g. 10,000-line ASP.NET Core `Controller`, EF Core `DbContext`, Unity `MonoBehaviour`, or God Service classes).

### The Architecture
C# natively supports splitting a single class definition across multiple physical files using the `partial` keyword. This is the **cleanest zero-rewrite seam in software engineering**:
- Zero runtime overhead.
- All private fields, properties, and methods are shared seamlessly across all files.
- Zero changes to existing call sites.

### CLI Implementation
```bash
node split_helper.js slice MonolithController.cs.bak 450-890 PatientEndpoints.cs \
  --partial-class PatientController \
  --namespace Hospital.Api
```

Generated file:
```csharp
namespace Hospital.Api
{
    public partial class PatientController
    {
        // 100% Verbatim transplanted endpoints & private helpers
        [HttpGet("{id}")]
        public async Task<IActionResult> GetPatient(int id)
        {
            return await _repo.FindByIdAsync(id);
        }
    }
}
```

Coordinator file (`PatientController.cs`):
```csharp
namespace Hospital.Api
{
    public partial class PatientController : ControllerBase
    {
        private readonly IPatientRepo _repo;
        public PatientController(IPatientRepo repo) => _repo = repo;
        // Remaining coordinator logic...
    }
}
```

---

## Pattern 3: The Package Directory Seam (Go)

### Ideal For
Massive Go files (e.g. 5,000-line `server.go`, `handlers.go`, or `models.go`).

### The Architecture
In Go, **all files in the same directory sharing the same package name are compiled as a single compilation unit**:
- All unexported types, functions, constants, and variables are visible across all files in that directory.
- No imports needed between sibling files.

### CLI Implementation
```bash
node split_helper.js slice server.go.bak 350-920 handlers_patient.go \
  --package main \
  --strip-indent
```

Result:
```go
package main

// Verbatim transplanted HTTP handlers & receiver methods
func (s *Server) handleGetPatient(w http.ResponseWriter, r *http.Request) {
    // Exactly matches original logic, can access s.db, s.cache, etc.
}
```

---

## Pattern 4: The Submodule Package & Mixin Seam (Python)

### Ideal For
Massive Python files (e.g. 4,000-line Django `views.py`, FastAPI routers, PyTorch training loops, or Flask models).

### Seam Strategy A: Submodule Directory (`views/`)
Turn `views.py` into a package directory:
```
views/
├── __init__.py        # Re-exports all symbols to preserve original import paths
├── patient_views.py  # Sliced verbatim
└── billing_views.py  # Sliced verbatim
```

`__init__.py`:
```python
# Preserves 100% backward compatibility for all external callers!
from .patient_views import *
from .billing_views import *
```

### Seam Strategy B: Mixin Decomposition for God Classes
For a 6,000-line `class MonolithService`:
```python
# patient_service.py (sliced verbatim from .bak)
class PatientMixin:
    def get_patient(self, pid):
        return self.db.find(pid)

# service.py (Coordinator)
class MonolithService(PatientMixin, BillingMixin, AuditMixin):
    def __init__(self, db):
        self.db = db
```
`self.db` resolves across all mixins without modifying a single line of function logic!

---

## Pattern 5: Dependency Injection & Delegate Seam (Java / Spring Boot)

### Ideal For
Spring Boot `@Service`, `@RestController`, or Android God Activities.

### The Architecture
Extract cohesive clusters into `@Component` or `@Service` delegates, then inject them into the Coordinator via constructor injection:

```java
// Sliced into PatientServiceDelegate.java
@Component
public class PatientServiceDelegate {
    private final IPatientRepository repo;
    public PatientServiceDelegate(IPatientRepository repo) { this.repo = repo; }

    // Verbatim transplanted business methods:
    public PatientDTO processPatient(Long id) { ... }
}

// Coordinator (PatientController.java)
@RestController
public class PatientController {
    private final PatientServiceDelegate patientDelegate;

    public PatientController(PatientServiceDelegate patientDelegate) {
        this.patientDelegate = patientDelegate;
    }

    @GetMapping("/{id}")
    public ResponseEntity<PatientDTO> get(@PathVariable Long id) {
        return ResponseEntity.ok(patientDelegate.processPatient(id));
    }
}
```

---

## Pattern 6: Trait / Module Extension Seam (PHP / Rust / Ruby)

### PHP (Laravel / Symfony)
Use Traits to split 8,000-line Eloquent Models or Controllers with zero rewrite:
```php
// app/Traits/PatientAttributes.php
trait PatientAttributes {
    public function getFullNameAttribute() {
        return "{$this->first_name} {$this->last_name}";
    }
}

// app/Models/Patient.php (Coordinator)
class Patient extends Model {
    use PatientAttributes, PatientRelationships;
}
```

### Rust (`mod` Tree & Trait Impl)
```rust
// In coordinator lib.rs or mod.rs:
pub mod patient;
pub mod billing;

pub use patient::*;
pub use billing::*;
```

---

## Pattern 7: The Coordinator Delegation Seam (Browser MV3 / Vanilla JS)

### Ideal For
Chrome Extensions (Manifest V3), legacy IIFE scripts, and web apps with zero build step.

```javascript
(function(window) {
  'use strict';

  class TabScanUI {
    static getTemplate() { return `...verbatim HTML template...`; }
    static bindEvents(root, uiContext) {
      if (!root) return null;
      const self = new TabScanUI(root, uiContext);
      self.bindEvents();
      return self;
    }

    constructor(root, uiContext) {
      this.root = root;
      this.ui = uiContext;
    }

    bindEvents() {
      const root = this.root;
      const ui = this.ui;
      (function() {
        // ... verbatim original event binding ...
        // `this.worker`, `this.panel`, etc. work 100% identically!
      }).call(ui);
    }
  }

  window.TabScanUI = TabScanUI;
})(window);
```

---

## Universal Decision Matrix

| Language / Framework | Recommended Seam Pattern | Monolith Splitter CLI Flags | Zero-Rewrite Guarantee |
|:---|:---|:---|:---:|
| **C# (.NET Core / Unity)** | Pattern 2 (Partial Class) | `--partial-class Name --namespace Ns` | **100%** (Native compiler) |
| **Go (Gin, Fiber, Stdlib)** | Pattern 3 (Package Directory) | `--package <pkg> --strip-indent` | **100%** (Package scope) |
| **Python (Django / FastAPI)** | Pattern 4 (Submodule / Mixin) | `--strip-indent` + `__init__.py` | **100%** (Module re-export) |
| **Java (Spring Boot / Android)** | Pattern 5 (DI / Delegate) | `--class-wrapper Name` + DI | **100%** (Spring IoC) |
| **Rust (Actix / Tokio)** | Pattern 6 (`mod` Tree) | `--strip-indent` + `pub use` | **100%** (Module system) |
| **PHP (Laravel / Symfony)** | Pattern 6 (Traits) | `--header "trait Name {" --footer "}"` | **100%** (Trait composition) |
| **TypeScript / ES6 Class** | Pattern 1 (Transparent Proxy) | `--class-wrapper Name --with-proxy-seam` | **100%** (Runtime Proxy) |
| **Chrome MV3 / Vanilla JS** | Pattern 7 (Coordinator Delegation) | `--class-wrapper Name` + `.call(ui)` | **100%** (Context binding) |
