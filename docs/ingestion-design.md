# Ingestion and Retention

This document describes the current ingestion architecture for streaming logcat from many Android devices, persisting enriched events, forwarding to observability backends, and keeping AI costs predictable.

## Goals

- Ingest continuous logs from many devices, such as meeting-room displays across a floor.
- Persist raw and enriched events for 24 hours or longer with low overhead.
- Detect patterns and summarize activity by device and day.
- Control AI spend via batching, sampling, and backpressure.

## Architecture overview

- Per-device log stream feeds a local processing node, this tool.
- Pattern detection and enrichment fan out to pluggable sinks:
  - JSONL file sink with daily rotation
  - Optional Loki sink for search and dashboards
- Optional scheduled summarization turns a day of JSONL into JSON, Markdown, and HTML reports.

```text
[ADB device x N]
  |
  v
[streamer] -> [filters] -> [pattern matcher] -> [enrichment: device, priority, tag, pat, severity]
                                  |
                                  +--> [sink: JSONL daily rotation]
                                  +--> [sink: Loki push]
  |
  +--> [AI analyzer: rate-limited, sampled]

[summarize] -> [daily JSON / Markdown / HTML report]
```

## Key components

### Pluggable sinks

- Location: `src/ingest/*`
- The pipeline produces enriched records that can be written to multiple sinks concurrently.

### JSONL exporter

- File: `src/ingest/jsonlExporter.ts`
- Appends records to `baseDir/YYYY-MM-DD/<device>.jsonl`
- Uses buffered writes with a flush interval and batch size
- Rotates automatically by day

### Loki sink

- File: `src/ingest/lokiSink.ts`
- Pushes batches to `POST /loki/api/v1/push` with gzip and small retry/backoff
- Groups lines by label set before pushing
- Labels sent:
  - `job=logcat-agent`
  - `device`
  - `priority`
  - `tag`
  - `pat`
  - `severity`

### AI analysis

- Uses the shared provider abstraction and limiter
- Sampling and daily budget controls bound spend
- Best for anomalies, matched signatures, or scheduled summarization rather than every single line

## Running many devices

- `stream-all` attaches to all connected devices concurrently.
- Each line is tagged with the device serial.
- Backpressure can drop lower-priority lines first under throttle.
- Optional per-tag throttling handles especially noisy components.

## Cost controls

- Disable AI for bulk ingestion with `--no-ai`.
- Analyze at most once per signature per window with `--ai-sample-per-signature`.
- Cap daily analyses with `--ai-daily-budget`.
- Prefer scheduled summarization for broad daily reporting.

## Daily summaries

The `summarize` command reads JSONL and computes:

- counts by priority and pattern
- top signatures per device
- time slices with spikes

It writes JSON, Markdown, and HTML artifacts and can optionally POST to an endpoint.

## Storage and retention

- Directory structure: `<baseDir>/<YYYY-MM-DD>/<device>.jsonl`
- Retention policies can delete logs based on:
  - age, for example `--retention-days 7`
  - total size, for example `--retention-size 5` for 5 GB
- Retention can run:
  - manually via `npx tsx src/cli/main.ts cleanup --dir ./logs --days 7 --size 5`
  - automatically while using `stream` or `stream-all`

## CLI flags

### JSONL

- `--export-jsonl <dir>`: enable JSONL export
- `--retention-days <n>`: delete logs older than `n` days
- `--retention-size <n>`: delete oldest logs when total size exceeds `n` GB

### Cleanup

- `npx tsx src/cli/main.ts cleanup --dir <path> --days <n> --size <n>`: run manual retention cleanup

### Loki

- `--loki-url <http(s)://host:3100/loki/api/v1/push>`
- `--loki-tenant <id>`
- `--loki-batch-ms <ms>`
- `--loki-batch-size <n>`

### Rate controls

- `--max-rate <n>`: max lines per second per device before dropping
- `--drop-verbosity <levels>`: for example `V,D` or `V,D,I`
- `--tag-throttle <n>`: optional per-tag moving-window limit

### AI controls

- `--no-ai`
- `--ai-sample-per-signature <ms>`
- `--ai-daily-budget <n>`

## Failure modes to keep in mind

- Device disconnects should reconnect cleanly and mark the session closure.
- Very chatty tags should be constrained by per-device and per-tag throttles.
- Loki pushes are retried, but they are not backed by a durable queue.
- `pat="none"` and `severity="none"` are intentional labels for unmatched lines.

## Observability

- Dashboard: `reports/grafana/logcat-overview.json`
- Variables: `device`, `priority`, `pat`, `severity`
- The dashboard supports including or excluding unmatched logs and includes drill-down links into Explore.
