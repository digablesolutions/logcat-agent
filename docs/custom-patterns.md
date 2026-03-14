# Custom Patterns

You can extend the built-in pattern set with your own domain-specific rules using a JSON file. This is useful for vendor or device-specific logs, app-specific error signatures, or team conventions that are not worth hard-coding into the default registry.

## File format

Provide a JSON array. Each entry supports JavaScript regular-expression syntax.

- `name`: string, required
- `regex`: string, required
- `flags`: string, optional, defaults to `m`
- `severity`: `error` | `warning` | `info`, required
- `description`: string, optional

Example:

```json
[
  {
    "name": "TPV ScalarService AIOOBE",
    "regex": "ScalarService.*ArrayIndexOutOfBoundsException",
    "flags": "mi",
    "severity": "error",
    "description": "Array index out of bounds in TPV ScalarService"
  },
  {
    "name": "SICP Command Error",
    "regex": "SICP:.*(ERROR|FAIL|INVALID)",
    "severity": "warning",
    "description": "SICP command returned an error"
  }
]
```

See [patterns.tpv.json](../patterns.tpv.json) for a working example you can copy.

## How the file is loaded

You can provide the file path in two ways:

1. CLI flag, highest precedence: `--patterns-file <path>`
2. Environment variable: `LOGCAT_PATTERNS_FILE=<path>`

If neither is provided, only the built-in patterns are used.

## CLI workflows

List patterns with built-ins plus your custom file:

- PowerShell: `$env:LOGCAT_PATTERNS_FILE="./patterns.tpv.json"; npx tsx src/cli/main.ts patterns --list`
- macOS/Linux: `LOGCAT_PATTERNS_FILE=./patterns.tpv.json npx tsx src/cli/main.ts patterns --list`

Test a message against the merged registry:

```sh
npx tsx src/cli/main.ts patterns --patterns-file ./patterns.tpv.json --test "ScalarService crashed with ArrayIndexOutOfBoundsException"
```

Stream using custom patterns:

- PowerShell: `$env:LOGCAT_PATTERNS_FILE="./patterns.tpv.json"; npx tsx src/cli/main.ts stream -b main,crash -p I`
- PowerShell, custom only: `$env:LOGCAT_PATTERNS_FILE="./patterns.tpv.json"; npx tsx src/cli/main.ts stream -b main,crash -p I --custom-patterns-only`
- PowerShell, env-driven custom only: `$env:LOGCAT_PATTERNS_FILE="./patterns.tpv.json"; $env:LOGCAT_PATTERNS_MODE="custom"; npx tsx src/cli/main.ts stream -b main,crash -p I`
- macOS/Linux: `LOGCAT_PATTERNS_FILE=./patterns.tpv.json npx tsx src/cli/main.ts stream -b main,crash -p I`
- macOS/Linux, custom only: `LOGCAT_PATTERNS_FILE=./patterns.tpv.json npx tsx src/cli/main.ts stream -b main,crash -p I --custom-patterns-only`
- macOS/Linux, env-driven custom only: `LOGCAT_PATTERNS_FILE=./patterns.tpv.json LOGCAT_PATTERNS_MODE=custom npx tsx src/cli/main.ts stream -b main,crash -p I`

## Validation and pitfalls

- Invalid regex entries are skipped and reported to stderr.
- Descriptions are optional.
- The merged set is `[defaults, ...custom]`; identical names do not override built-ins.

## Programmatic API

If you are integrating at code level, see `src/pipeline/customPatterns.ts`.
