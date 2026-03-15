# Real Device Testing

Use this guide when running the agent against a real Android device or emulator.

## Prerequisites

- Android SDK Platform-Tools installed and `adb` available on `PATH`
- Developer options and USB debugging enabled on the device
- First-time ADB authorization accepted on the device
- Node.js 22.12+

## Quick checks

- List devices: `npx tsx src/cli/main.ts devices`
- If multiple devices are present, note the serial you want to target.

## Streaming without AI

- Interactive device selection: `npx tsx src/cli/main.ts stream -i --buffers main,crash --min-priority I`
- Specific device and tags: `npx tsx src/cli/main.ts stream --serial <serial> --tags MyApp,Auth`

## Streaming with AI

macOS/Linux:

- `OPENAI_API_KEY=sk-... npx tsx src/cli/main.ts stream --model gpt-5-mini --provider openai`
- `GEMINI_API_KEY=... npx tsx src/cli/main.ts stream --model gemini-2.5-flash --provider gemini`
- `OPENAI_BASE_URL=http://localhost:11434/v1 npx tsx src/cli/main.ts stream --model llama3.1:8b-instruct --provider openai`

Windows PowerShell:

- `$env:OPENAI_API_KEY="sk-..."; npx tsx src/cli/main.ts stream --model gpt-5-mini --provider openai`
- `$env:GEMINI_API_KEY="..."; npx tsx src/cli/main.ts stream --model gemini-2.5-flash --provider gemini`
- `$env:OPENAI_BASE_URL="http://localhost:11434/v1"; npx tsx src/cli/main.ts stream --model llama3.1:8b-instruct --provider openai`

## Realtime AI analysis

- Development profile: `OPENAI_API_KEY=sk-... npx tsx src/cli/main.ts realtime -i --profile development --provider openai`
- Gemini development profile: `GEMINI_API_KEY=... npx tsx src/cli/main.ts realtime -i --profile development --provider gemini`
- Local OpenAI-compatible endpoint: `OPENAI_BASE_URL=http://localhost:11434/v1 npx tsx src/cli/main.ts realtime -i --profile development --provider openai --model llama3.1:8b-instruct`
- Performance profile: `OPENAI_API_KEY=sk-... npx tsx src/cli/main.ts realtime --serial <serial> --profile performance --provider openai`
- List profiles: `npx tsx src/cli/main.ts realtime --list-profiles`

## Wireless debugging

1. Enable Wireless debugging under Developer options on the device.
2. Keep the Wireless debugging screen open.
3. Use one of the following flows:

- QR plus discovery plus streaming: `npx tsx src/cli/main.ts stream --wifi --wifi-qr --wifi-timeout 90000`
- Manual pair when mDNS discovery is blocked: `npx tsx src/cli/main.ts stream --wifi --wifi-pair 10.0.0.25:37119 --wifi-pass 123456`
- Direct connect when you already know the connect port: `npx tsx src/cli/main.ts stream --wifi --wifi-target 10.0.0.25:41847`
- Standalone helper with QR: `npx tsx src/cli/main.ts wifi`
- Standalone helper without QR and a longer wait: `npx tsx src/cli/main.ts wifi --no-qr --timeout 120000`

## Patterns utility

- List patterns: `npx tsx src/cli/main.ts patterns --list`
- Test a message: `npx tsx src/cli/main.ts patterns --test "java.lang.NullPointerException"`

## Custom patterns

See [custom-patterns.md](./custom-patterns.md) for the JSON format and loading rules.

- PowerShell: `$env:LOGCAT_PATTERNS_FILE="./patterns.tpv.json"; npx tsx src/cli/main.ts stream -b main,crash -p I`
- macOS/Linux: `LOGCAT_PATTERNS_FILE=./patterns.tpv.json npx tsx src/cli/main.ts stream -b main,crash -p I`
- PowerShell, custom only: `$env:LOGCAT_PATTERNS_FILE="./patterns.tpv.json"; npx tsx src/cli/main.ts stream -b main,crash -p I --custom-patterns-only`
- macOS/Linux, custom only: `LOGCAT_PATTERNS_FILE=./patterns.tpv.json npx tsx src/cli/main.ts stream -b main,crash -p I --custom-patterns-only`

## Troubleshooting

- Device unauthorized: confirm the prompt on the device and retry.
- No devices visible: check the cable, Windows drivers, or ADB over Wi-Fi status.
- Too little signal: lower the minimum priority or add more buffers.
- AI failures: verify the provider key or local endpoint and adjust `LOGCAT_AI_CONCURRENCY`, `LOGCAT_AI_RETRIES`, `OPENAI_TIMEOUT_MS`, or `GEMINI_TIMEOUT_MS` as needed.
