# Logcat Analysis Agent

[![CI](https://github.com/digablesolutions/logcat-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/digablesolutions/logcat-agent/actions/workflows/ci.yml)

This repository contains an AI-assisted logcat analysis agent with advanced real-time monitoring capabilities. The agent connects to Android devices via `adb`, streams logcat output, and provides intelligent analysis including pattern detection, anomaly detection, trend analysis, and performance monitoring.

## Features

### 🔍 Basic Analysis

- **Pattern Detection**: Detects common error patterns and exceptions
- **AI-Powered Insights**: Uses OpenAI or Gemini to analyze errors and suggest solutions
- **Real-time Streaming**: Live analysis of logcat streams with color-coded output
- **Wireless Debugging**: One‑shot Wi‑Fi discovery/pair/connect and terminal QR pairing

### 🤖 Real-time AI Analysis

- **Proactive Analysis**: Continuously analyzes log streams for potential issues
- **Anomaly Detection**: Identifies unusual patterns, frequency spikes, and new error types
- **Trend Analysis**: Monitors changes in error rates, warning patterns, and performance metrics
- **Performance Monitoring**: Detects memory pressure, GC issues, ANRs, and I/O bottlenecks
- **Configurable Profiles**: Pre-built configurations for development, production, debug, and performance scenarios

## Quick start

1. Use Node.js 22.12+ and install dependencies:

   ```sh
   npm ci
   ```

2. Create a `.env` file with your AI provider key (choose one):

   ```env
   # OpenAI (default provider)
   OPENAI_API_KEY=sk-...

   # Or Google Gemini
   GEMINI_API_KEY=...
   ```

   Tip: See `.env.example` for all available options, including `OPENAI_BASE_URL` for local SLMs and `OPENAI_TIMEOUT_MS`.

   Or, to use a local SLM via an OpenAI-compatible server (no key required), set a base URL:

   ```env
   # Example: Ollama on localhost
   OPENAI_BASE_URL=http://localhost:11434/v1
   # Optional: override request timeout (ms). Defaults to 60000 when using a base URL.
   OPENAI_TIMEOUT_MS=60000
   ```

3. **Basic logcat streaming** with pattern detection:

   ```sh
  npx tsx src/cli/main.ts stream -b main,crash -p I
   ```

4. **Real-time AI analysis** (recommended):

   ```sh
  npx tsx src/cli/main.ts realtime --profile development
   ```

5. Optional: Use custom patterns via a JSON file (see [docs/custom-patterns.md](./docs/custom-patterns.md)):
   - PowerShell
    - `$env:LOGCAT_PATTERNS_FILE="./patterns.tpv.json"; npx tsx src/cli/main.ts stream -b main,crash -p I`
   - macOS/Linux
    - `LOGCAT_PATTERNS_FILE=./patterns.tpv.json npx tsx src/cli/main.ts stream -b main,crash -p I`

   To use only your custom patterns (no built-ins), either pass the flag or set env mode:
   - Flag: `--custom-patterns-only`
   - Env: `LOGCAT_PATTERNS_MODE=custom`

## Commands

### `stream` - Basic Analysis

Traditional logcat streaming with pattern detection and reactive AI analysis.

```sh
npx tsx src/cli/main.ts stream [options]
```

**Options:**

- `-s, --serial <serial>` - Target device serial
- `-b, --buffers <list>` - Comma-separated buffers (default: main,crash)
- `-p, --min-priority <P>` - Minimum priority V|D|I|W|E|F (default: I)
- `-t, --tags <list>` - Include specific tags
- `--no-ai` - Disable AI analysis
- `--provider <provider>` - AI provider: `openai` or `gemini` (default: `openai`)
- `--model <name>` - AI model (OpenAI default: `gpt-4o-mini`; Gemini default: `gemini-1.5-flash-latest`)
- `--patterns-file <path>` - JSON file with custom patterns
- `--custom-patterns-only` - Use only patterns from `--patterns-file`
- `--export-jsonl <dir>` - Export matched events to rotating JSONL files under `<dir>`
- `--retention-days <n>` - Delete logs older than N days
- `--retention-size <n>` - Delete oldest logs when total size exceeds N GB
- `--ai-sample-per-signature <ms>` - Min milliseconds between AI calls per signature (env LOGCAT_AI_SAMPLE_PER_SIGNATURE_MS, default 3600000)
- `--ai-daily-budget <n>` - Max AI analyses per day (env LOGCAT_AI_BUDGET_PER_DAY, default 50)

Wi‑Fi (Wireless debugging) options:

- `--wifi` – Attempt Wi‑Fi discovery/pair/connect before streaming
- `--wifi-qr` – Display a Wireless debugging QR (scan on device to pair)
- `--wifi-name <name>` – Custom name for QR (default: `debug-XXXX`)
- `--wifi-pass <pass>` – Pairing password (default: random)
- `--wifi-timeout <ms>` – Discovery timeout (default: 90000)
- `--wifi-pair <host:port>` – Manually pair to a specific host:port (bypass mDNS)
- `--wifi-target <host:port>` – Manually connect to host:port (bypass mDNS)

### `stream-all` - Multi-device Ingestion

Attach to all connected devices concurrently, with per-device rate limits and JSONL export.

```sh
npx tsx src/cli/main.ts stream-all --export-jsonl ./logs --max-rate 80 --drop-verbosity V,D
```

Options:

- `--max-rate <n>` - Max lines/sec per device before dropping (default 50)
- `--drop-verbosity <levels>` - Comma list of verbosity to drop under throttle, e.g. `V,D` or `V,D,I`
- All `stream` options like `--buffers`, `--min-priority`, `--patterns-file`, `--custom-patterns-only`
- `--tag-throttle <n>` - Optional per-tag moving window max lines/sec; drop when exceeded

### `realtime` - Advanced Real-time Analysis

Continuous AI-powered analysis with proactive insights, anomaly detection, and trend monitoring.

```sh
npx tsx src/cli/main.ts realtime [options]
```

**Options:**

- All options from `stream` command, plus:
- `--profile <name>` - Analysis profile: development, production, debug, performance, minimal
- `--window-size <number>` - Analysis window size (overrides profile)
- `--analysis-interval <ms>` - Analysis interval in milliseconds (overrides profile)
- `--anomaly-threshold <number>` - Anomaly detection threshold 0-1 (overrides profile)
- `--disable-trends` - Disable trend analysis
- `--disable-performance` - Disable performance monitoring
- `--disable-proactive` - Disable proactive analysis
- `--list-profiles` - List available analysis profiles

Provider/model examples:

```sh
# OpenAI (default)
OPENAI_API_KEY=sk-... npx tsx src/cli/main.ts realtime --profile development --provider openai --model gpt-4o-mini

# Google Gemini
GEMINI_API_KEY=... npx tsx src/cli/main.ts realtime --profile development --provider gemini --model gemini-1.5-flash-latest
```

### `summarize` - JSONL (daily report)

After a day of ingestion with `--export-jsonl`, produce a JSON/Markdown/HTML summary.

```sh
npx tsx src/cli/main.ts summarize --dir ./logs --day 2025-08-08 --out ./reports
```

### `cleanup` - Retention Policy

Manually trigger cleanup of old logs based on age or size.

```sh
npx tsx src/cli/main.ts cleanup --dir ./logs --days 7 --size 5
```

**Options:**

- `--dir <path>` - Base directory for logs
- `--days <number>` - Maximum age in days
- `--size <number>` - Maximum total size in GB
- `--dry-run` - List files that would be deleted without deleting them

### `tcp` - Philips SICP over TCP

Send one-shot SICP or raw TCP requests directly from the host to a display.

```sh
npx tsx src/cli/main.ts tcp --remote-host 10.0.0.25 --get-serial 1
```

**Options:**

- `--remote-host <host>` - Remote host or IP to connect to
- `-p, --port <port>` - TCP port (default: 5000)
- `--get-serial <id>` - Request the serial number for a monitor ID
- `--restart <id>` - Request a monitor restart for a monitor ID
- `--target <code>` - Restart target (`0x00` Android, `0x01` scalar)
- `--send-sicp <control,group,data...>` - Send a structured SICP frame
- `--send-hex <hex>` - Send raw hex bytes
- `--timeout <ms>` - One-shot response timeout (default: 2000)
- `--retry-500ms` - Retry once after 500 ms when exactly one request was sent

### `wifi` - Wireless Debugging Helper

Discover ADB-over-Wi‑Fi via mDNS, render a QR for pairing, and auto pair/connect.

```sh
npx tsx src/cli/main.ts wifi [options]
```

Options:

- `--no-qr` – Do not display QR code
- `--name <name>` – Custom Wireless debugging name (default: `debug-XXXX`)
- `--pass <pass>` – Pairing password (default: random)
- `--timeout <ms>` – Discovery timeout (default: 90000; 0 = never)

### Analysis Profiles

| Profile       | Use Case                  | Sensitivity  | Interval | Features                       |
| ------------- | ------------------------- | ------------ | -------- | ------------------------------ |
| `development` | Active development        | Moderate     | 15s      | All features enabled, balanced |
| `production`  | Production monitoring     | Conservative | 30s      | High confidence, less noise    |
| `debug`       | Intensive troubleshooting | High         | 5s       | Maximum sensitivity            |
| `performance` | Performance optimization  | Moderate     | 10s      | Focus on performance issues    |
| `minimal`     | Lightweight monitoring    | Low          | 60s      | Basic anomaly detection only   |

## Real-time Analysis Features

### 🚨 Anomaly Detection

- **Frequency Anomalies**: Detects unusual spikes in log frequency for specific tags
- **Error Spikes**: Identifies sudden increases in error rates
- **New Error Patterns**: Alerts on previously unseen error signatures
- **Tag Pattern Changes**: Monitors for unusual activity patterns

### 📈 Trend Analysis

- **Error Rate Trends**: Tracks changes in error rates over time
- **Warning Patterns**: Monitors warning frequency and escalation
- **Tag Frequency Changes**: Analyzes changes in component activity
- **Performance Degradation**: Identifies degrading performance trends

### ⚡ Performance Monitoring

- **Memory Pressure**: Detects OOM conditions, heap issues, memory warnings
- **GC Pressure**: Monitors garbage collection frequency and duration
- **ANR Detection**: Identifies Application Not Responding events
- **I/O Bottlenecks**: Detects slow file operations, database locks
- **Battery Drain**: Monitors power consumption issues
- **Network Issues**: Identifies connectivity and timeout problems

## Examples

### Basic Usage

```sh
# Stream with AI analysis
npx tsx src/cli/main.ts stream --serial emulator-5554

# Real-time analysis for development
npx tsx src/cli/main.ts realtime --profile development --serial emulator-5554

# Production monitoring with conservative settings
npx tsx src/cli/main.ts realtime --profile production --min-priority W

# Debug mode with high sensitivity
npx tsx src/cli/main.ts realtime --profile debug --analysis-interval 3000
```

Wi‑Fi quick start and manual overrides

```sh
# QR pairing + discovery + stream (90s timeout)
npx tsx src/cli/main.ts stream --wifi --wifi-qr --wifi-timeout 90000

# If mDNS is blocked: pair explicitly with host:pair_port and on‑device code
npx tsx src/cli/main.ts stream --wifi --wifi-pair 10.0.0.25:37119 --wifi-pass 123456

# Connect directly (skip discovery) using host:connect_port shown on the device
npx tsx src/cli/main.ts stream --wifi --wifi-target 10.0.0.25:41847
```

### Advanced Configuration

```sh
# Custom configuration overriding profile
npx tsx src/cli/main.ts realtime \
   --profile development \
   --window-size 100 \
   --anomaly-threshold 0.8 \
   --disable-proactive

# Performance-focused monitoring
npx tsx src/cli/main.ts realtime \
   --profile performance \
   --tags "ActivityManager,WindowManager,System.gc" \
   --min-priority I
```

### Summarize JSONL (daily report)

After a day of ingestion with `--export-jsonl`, produce a JSON/Markdown/HTML summary.

```sh
npx tsx src/cli/main.ts summarize --dir ./logs --day 2025-08-08 --out ./reports
```

PowerShell example:

```powershell
npx tsx src/cli/main.ts summarize --dir .\logs --day 2025-08-08 --out .\reports
```

Optional HTTP export:

```sh
npx tsx src/cli/main.ts summarize --dir ./logs --day 2025-08-08 --http-endpoint https://example.com/ingest/log-summary
```

## Project structure

- `docs/` – architecture notes and user guides
- `src/` – source code for the agent and its CLI
- `src/adb/` – modules for interacting with `adb` and parsing logcat output
- `src/pipeline/` – core pipeline including types, pattern registry, filters and pattern detection
- `src/ai/` – AI providers and real-time analysis engine
  - `src/ai/realtime/` – real-time analysis components (anomaly detection, trend analysis, performance monitoring)
- `src/cli/` – CLI entry point built with Commander
- `test/` – unit tests using Vitest

## Documentation

- [docs/README.md](./docs/README.md) – documentation index
- [docs/architecture.md](./docs/architecture.md) – current architecture and operational tradeoffs
- [docs/ingestion-design.md](./docs/ingestion-design.md) – multi-device ingestion, sinks, and retention
- [docs/custom-patterns.md](./docs/custom-patterns.md) – JSON custom-pattern format and CLI usage
- [docs/real-device-testing.md](./docs/real-device-testing.md) – real-device and Wi-Fi debugging guide

## Testing

Run the test suite:

```sh
npm test
```

## Real device testing

If you want to run the agent against a real Android device or emulator, see the step-by-step guide in [docs/real-device-testing.md](./docs/real-device-testing.md).

## Custom patterns

You can extend built-in detection rules with a JSON file. See [docs/custom-patterns.md](./docs/custom-patterns.md) and the example [patterns.tpv.json](./patterns.tpv.json).

Quick examples:

- PowerShell (merge built-ins + custom):
  - `$env:LOGCAT_PATTERNS_FILE="./patterns.tpv.json"; npx tsx src/cli/main.ts stream -b main,crash -p I`
- PowerShell (custom-only):
  - `$env:LOGCAT_PATTERNS_FILE="./patterns.tpv.json"; npx tsx src/cli/main.ts stream -b main,crash -p I --custom-patterns-only`
  - or `$env:LOGCAT_PATTERNS_FILE="./patterns.tpv.json"; $env:LOGCAT_PATTERNS_MODE="custom"; npx tsx src/cli/main.ts stream -b main,crash -p I`

JSONL export examples:

- macOS/Linux: `npx tsx src/cli/main.ts stream --export-jsonl ./logs`
- Windows PowerShell: `npx tsx src/cli/main.ts stream --export-jsonl .\\logs`

## Optional: Grafana Loki sink and dashboards

Push logs to a local or remote Grafana Loki instance for fast search and dashboards.

CLI flags:

- `--loki-url http://localhost:3100/loki/api/v1/push`
- `--loki-tenant <id>` (optional)
- `--loki-batch-ms 1000` (optional)
- `--loki-batch-size 500` (optional)

Examples:

- Windows PowerShell
  - `npx tsx src/cli/main.ts stream-all --export-jsonl .\logs --loki-url http://localhost:3100/loki/api/v1/push`
- macOS/Linux
  - `npx tsx src/cli/main.ts stream-all --export-jsonl ./logs --loki-url http://localhost:3100/loki/api/v1/push`

Labels sent to Loki:

- `job=logcat-agent`
- `device=<serial>`
- `priority` (V/D/I/W/E/F)
- `tag` (Android tag)
- `pat` (pattern name). Unmatched lines are labeled `pat="none"`.
- `severity` (pattern severity: info|warning|error; `none` for unmatched)

Dashboard: `reports/grafana/logcat-overview.json`

- Import this JSON in Grafana (Dashboards → New → Import).
- Variables available on the dashboard:
  - `device`, `priority`, `pat` (pattern), `severity`
  - Toggle: “Include unmatched (pat=none)” to include/exclude unmatched logs
- Tables (Top patterns/Top tags) include drill-down links to Explore with filters applied.

### Windows 11 local dev notes

## Local SLMs (OpenAI-compatible)

You can run Small Language Models locally (privacy, low cost) using an OpenAI‑compatible server such as Ollama, LM Studio, vLLM/TGI, or NVIDIA NIM.

Use the existing OpenAI provider and pass a base URL:

```sh
# Ollama (Llama 3.1 8B instruct)
npx tsx src/cli/main.ts stream --provider openai --openai-base-url http://localhost:11434/v1 --model llama3.1:8b-instruct

# Real-time with local model
npx tsx src/cli/main.ts realtime --provider openai --openai-base-url http://localhost:11434/v1 --model llama3.1:8b-instruct --profile development

# vLLM or LM Studio
npx tsx src/cli/main.ts stream --provider openai --openai-base-url http://localhost:8000/v1 --model qwen2-7b-instruct

# NVIDIA NIM (Mistral)
npx tsx src/cli/main.ts realtime --provider openai --openai-base-url https://your-nim-endpoint/v1 --model mistral-large --profile production
```

Environment variables for local endpoints:

```env
# Point the OpenAI provider to a local or self-hosted server
OPENAI_BASE_URL=http://localhost:11434/v1

# Optional: request timeout in ms
# Defaults to 60000 when OPENAI_BASE_URL is set; 30000 otherwise
OPENAI_TIMEOUT_MS=60000

# Not required when using a local server with OPENAI_BASE_URL
# OPENAI_API_KEY=
```

Notes:

- If `OPENAI_API_KEY` is not set but a base URL is provided, the CLI will use the local server.
- Keep prompts concise and JSON‑only for deterministic outputs.
- Use sampling/budget flags to bound compute: `--ai-sample-per-signature`, `--ai-daily-budget`.

- Install Node.js 22.12+
- Install Android Platform Tools (adb) and ensure `adb` is on PATH
- Optional: run Loki via Docker Desktop:
  - `docker run -d --name loki -p 3100:3100 grafana/loki:2.9.0 -config.file=/etc/loki/local-config.yaml`
  - Open Grafana and add a Loki datasource (UID can be left default), then import `reports/grafana/logcat-overview.json`

## Contributing

1. Add new patterns to `src/pipeline/patterns.ts`
2. Extend real-time analysis capabilities in `src/ai/realtime/`
3. Create new analysis profiles in `src/ai/profiles.ts`
4. Add tests for new functionality
