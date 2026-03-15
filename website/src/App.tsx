import React from 'react';
import { Terminal, Smartphone, Zap, BarChart3, GitBranch } from 'lucide-react';
import { AdaptiveVideoRail } from '@/components/AdaptiveVideoRail';
import { CLISection } from '@/components/CLISection';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Footer } from '@/components/Footer';
import { HeroSection } from '@/components/sections/HeroSection';
import { FeaturesSection } from '@/components/sections/FeaturesSection';
const AdvancedSection = React.lazy(() =>
  import('@/components/sections/AdvancedSection').then((m) => ({ default: m.AdvancedSection })),
);
const QuickStartSection = React.lazy(() =>
  import('@/components/sections/QuickStartSection').then((m) => ({ default: m.QuickStartSection })),
);
const CommonCommandsSection = React.lazy(() =>
  import('@/components/sections/CommonCommandsSection').then((m) => ({
    default: m.CommonCommandsSection,
  })),
);
const ObservabilitySection = React.lazy(() =>
  import('@/components/sections/ObservabilitySection').then((m) => ({
    default: m.ObservabilitySection,
  })),
);
import { useIntersectionReveals } from '@/hooks/useIntersectionReveals';
import { useActiveSectionVideo } from '@/hooks/useActiveSectionVideo';

const cli = 'npx tsx src/cli/main.ts';

const getInitialMainPlaying = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }

  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

export default function App() {
  const [showDemo, setShowDemo] = React.useState(false);
  const demoVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const heroVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const mainVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const demoSectionRef = React.useRef<HTMLDivElement | null>(null);
  const [mainVideoReady, setMainVideoReady] = React.useState(false);
  const [mainPlaying, setMainPlaying] = React.useState<boolean>(getInitialMainPlaying);
  const [previewSrc, setPreviewSrc] = React.useState<string | null>(null);
  const videoSources = React.useMemo(
    () => ({
      features: 'demo1.mp4',
      cli: 'demo1.mp4',
      common: 'demo2.mp4',
      observability: 'demo.mp4',
      devices: 'demo1.mp4',
    }),
    [],
  );

  React.useEffect(() => {
    const el = heroVideoRef.current;
    if (!el) return;
    // Loop only the first ~4 seconds for the hero mini video
    const onTimeUpdate = () => {
      if (el.currentTime > 4.0) el.currentTime = 0;
    };
    el.addEventListener('timeupdate', onTimeUpdate);
    return () => el.removeEventListener('timeupdate', onTimeUpdate);
  }, []);

  React.useEffect(() => {
    // Defer loading the main video until it scrolls into view
    const target = demoSectionRef.current;
    if (!target || mainVideoReady) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e.isIntersecting && e.intersectionRatio > 0.2) {
          setMainVideoReady(true);
          obs.disconnect();
        }
      },
      { threshold: [0, 0.2, 0.5, 1] },
    );
    obs.observe(target);
    return () => obs.disconnect();
  }, [mainVideoReady]);

  // Reveal animations
  useIntersectionReveals();

  // Active section for video
  const observedActiveKey = useActiveSectionVideo(120);
  const activeVideoKey = observedActiveKey;
  const railEnabled = activeVideoKey !== null;

  const toggleMainPlayback = () => {
    const v = mainVideoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {
        // Autoplay was prevented.
      });
      setMainPlaying(true);
    } else {
      v.pause();
      setMainPlaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-green-50 to-emerald-100 text-foreground dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Navigation */}
      <nav className="bg-background/80 sticky top-0 z-50 border-b border-border backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-green-500 to-emerald-600">
              <Terminal size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold">Logcat Agent</span>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        {/* Adaptive side video (desktop only) */}
        {railEnabled && (
          <AdaptiveVideoRail
            activeKey={activeVideoKey}
            sources={videoSources}
            overrideSrc={previewSrc}
          />
        )}

        {/* Hero Section */}
        <HeroSection
          showDemo={showDemo}
          setShowDemo={setShowDemo}
          refs={{ demoVideoRef, heroVideoRef, mainVideoRef, demoSectionRef }}
          mainVideoReady={mainVideoReady}
          mainPlaying={mainPlaying}
          toggleMainPlayback={toggleMainPlayback}
        />

        {/* Key Features */}
        <FeaturesSection />

        <React.Suspense
          fallback={
            <div className="mx-auto my-8 max-w-4xl animate-pulse space-y-4 rounded-2xl border border-border bg-white/60 p-6 shadow dark:bg-slate-800/60">
              <div className="h-6 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-48 w-full rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          }
        >
          {/* Advanced Features */}
          <AdvancedSection />

          {/* Quick Start */}
          <QuickStartSection />

          {/* Common Commands */}
          <CommonCommandsSection />

          {/* Observability */}
          <ObservabilitySection />
        </React.Suspense>

        {/* CLI Reference - Collapsible sections */}
        <section className="space-y-8" data-section-key="reference">
          <div className="space-y-4 text-center">
            <h2 className="reveal-up whoosh text-3xl font-bold text-slate-800 dark:text-slate-100">
              Complete CLI Reference
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-300">
              Comprehensive guide to all available commands and options
            </p>
          </div>

          <div className="grid gap-6">
            {/* Devices */}
            <CLISection
              title="Devices"
              description="List connected devices and status"
              icon={<Smartphone size={20} />}
              videoKey="devices"
              commands={[
                { c: `${cli} devices`, d: 'List all connected devices' },
                { c: `${cli} devices --long`, d: 'Show detailed device information' },
              ]}
            />

            {/* Stream */}
            <CLISection
              title="Stream"
              description="Stream logcat with filtering and optional AI analysis"
              icon={<Terminal size={20} />}
              videoKey="cli"
              onPreview={setPreviewSrc}
              commands={[
                {
                  c: `${cli} stream -i --buffers main,crash --min-priority I`,
                  d: 'Interactive device, main+crash buffers, info+',
                  previewSrc: 'demo1.mp4',
                },
                {
                  c: `${cli} stream --serial emulator-5554 --tags MyApp,Auth`,
                  d: 'Specific device and tags',
                  previewSrc: 'demo2.mp4',
                },
                {
                  c: `${cli} stream --filter-expr '*:W'`,
                  d: 'Raw logcat filter expression',
                  previewSrc: 'demo1.mp4',
                },
                { c: `${cli} stream --no-ai`, d: 'Disable AI analysis' },
                { c: `${cli} stream --model gpt-5-mini`, d: 'Choose AI model' },
                {
                  c: `${cli} stream --ai-sample-per-signature 3600000 --ai-daily-budget 50`,
                  d: 'AI sampling + daily budget',
                  previewSrc: 'demo1.mp4',
                },
                {
                  c: `${cli} stream --save-logs --max-lines 10000`,
                  d: 'Save logs and increase in-memory window',
                  previewSrc: 'demo2.mp4',
                },
                {
                  c: `${cli} stream --patterns-file ./patterns.tpv.json`,
                  d: 'Use a custom patterns file (merge with built-ins)',
                  previewSrc: 'demo1.mp4',
                },
                {
                  c: `${cli} stream --patterns-file ./patterns.tpv.json --custom-patterns-only`,
                  d: 'Use only your custom patterns (disable built-ins)',
                  previewSrc: 'demo2.mp4',
                },
                {
                  c: `${cli} stream --export-jsonl ./logs`,
                  d: 'Export matched events to rotating JSONL files',
                  previewSrc: 'demo2.mp4',
                },
                {
                  c: `$env:LOGCAT_PATTERNS_MODE="custom"; ${cli} stream --patterns-file .\\patterns.tpv.json`,
                  d: 'Windows PS: custom-only via env + file',
                  previewSrc: 'demo1.mp4',
                },
                {
                  c: `${cli} stream --wifi --wifi-qr --wifi-timeout 90000`,
                  d: 'Wireless: QR pair + connect then stream',
                  previewSrc: 'demo2.mp4',
                },
                {
                  c: `${cli} stream --wifi --wifi-target 10.0.0.25:41847`,
                  d: 'Wireless: manual target when mDNS is blocked',
                  previewSrc: 'demo2.mp4',
                },
              ]}
            />

            {/* Wi‑Fi */}
            <CLISection
              title="Wi‑Fi"
              description="Discover, pair, and connect ADB over Wi‑Fi"
              icon={<Smartphone size={20} />}
              videoKey="devices"
              onPreview={setPreviewSrc}
              commands={[
                { c: `${cli} wifi`, d: 'Default: show QR + auto pair/connect (90s)' },
                {
                  c: `${cli} wifi --name debug-1234`,
                  d: 'Custom QR name',
                  previewSrc: 'demo2.mp4',
                },
                {
                  c: `${cli} wifi --no-qr --timeout 120000`,
                  d: 'Discovery without QR, wait up to 120s',
                  previewSrc: 'demo2.mp4',
                },
                {
                  c: `${cli} stream --wifi --wifi-pair 10.0.0.25:37119 --wifi-pass 123456`,
                  d: 'Manual pair (on-device code)',
                  previewSrc: 'demo2.mp4',
                },
                {
                  c: `${cli} stream --wifi --wifi-target 10.0.0.25:41847`,
                  d: 'Manual connect (skip discovery)',
                  previewSrc: 'demo2.mp4',
                },
              ]}
            />

            {/* Stream-All */}
            <CLISection
              title="Stream-All"
              description="Multi-device ingestion with per-device rate limits and throttling"
              icon={<Smartphone size={20} />}
              videoKey="cli"
              onPreview={setPreviewSrc}
              commands={[
                {
                  c: `${cli} stream-all --export-jsonl ./logs --max-rate 80 --drop-verbosity V,D`,
                  d: 'Ingest all devices with rate limiting',
                  previewSrc: 'demo2.mp4',
                },
                {
                  c: `${cli} stream-all --export-jsonl ./logs --max-rate 80 --drop-verbosity V,D --tag-throttle 20`,
                  d: 'Add per-tag throttling (20 lines/sec max per tag)',
                  previewSrc: 'demo2.mp4',
                },
                {
                  c: `${cli} stream-all --export-jsonl .\\logs --loki-url http://localhost:3100/loki/api/v1/push`,
                  d: 'Windows: Multi-device with Loki export',
                  previewSrc: 'demo2.mp4',
                },
                {
                  c: `${cli} stream-all --export-jsonl ./logs --loki-url http://localhost:3100/loki/api/v1/push`,
                  d: 'macOS/Linux: Multi-device with Loki export',
                  previewSrc: 'demo2.mp4',
                },
              ]}
            />

            {/* Realtime */}
            <CLISection
              title="Realtime"
              description="Proactive real-time AI analysis (requires OpenAI/Gemini key or OPENAI_BASE_URL)"
              icon={<Zap size={20} />}
              videoKey="cli"
              onPreview={setPreviewSrc}
              commands={[
                {
                  c: `${cli} realtime -i --profile development`,
                  d: 'Start with development profile',
                  previewSrc: 'demo1.mp4',
                },
                {
                  c: `${cli} realtime --serial emulator-5554 --profile performance`,
                  d: 'Performance profile',
                  previewSrc: 'demo1.mp4',
                },
                {
                  c: `${cli} realtime --window-size 200 --analysis-interval 3000`,
                  d: 'Override window and interval',
                  previewSrc: 'demo1.mp4',
                },
                {
                  c: `${cli} realtime --anomaly-threshold 0.7`,
                  d: 'Adjust anomaly threshold',
                  previewSrc: 'demo1.mp4',
                },
                {
                  c: `${cli} realtime --disable-trends --disable-performance --disable-proactive`,
                  d: 'Disable certain analyses',
                  previewSrc: 'demo1.mp4',
                },
                { c: `${cli} realtime --list-profiles`, d: 'List available profiles' },
                {
                  c: `OPENAI_BASE_URL=http://localhost:11434/v1 ${cli} realtime --provider openai --model llama3.1:8b-instruct --profile development`,
                  d: 'Local SLM (Ollama) • macOS/Linux',
                  previewSrc: 'demo1.mp4',
                },
                {
                  c: `$env:OPENAI_BASE_URL="http://localhost:11434/v1"; ${cli} realtime --provider openai --model llama3.1:8b-instruct --profile development`,
                  d: 'Local SLM (Ollama) • Windows PowerShell',
                  previewSrc: 'demo1.mp4',
                },
              ]}
            />

            {/* Summarize */}
            <CLISection
              title="Summarize"
              description="Post-process JSONL to get daily reports (offline)"
              icon={<BarChart3 size={20} />}
              videoKey="cli"
              onPreview={setPreviewSrc}
              commands={[
                {
                  c: `${cli} summarize --dir ./logs --day 2025-08-08 --out ./reports`,
                  d: 'Write JSON/Markdown/HTML reports',
                  previewSrc: 'demo.mp4',
                },
                {
                  c: `${cli} summarize --dir ./logs --day 2025-08-08 --http-endpoint https://example.com/ingest`,
                  d: 'POST summary to an HTTP endpoint',
                  previewSrc: 'demo.mp4',
                },
              ]}
            />

            {/* Patterns */}
            <CLISection
              title="Patterns"
              description="Inspect or test error detection patterns"
              icon={<GitBranch size={20} />}
              videoKey="cli"
              onPreview={setPreviewSrc}
              commands={[
                { c: `${cli} patterns --list`, d: 'List all available patterns' },
                {
                  c: `${cli} patterns --test 'java.lang.NullPointerException'`,
                  d: 'Test a message against patterns',
                  previewSrc: 'demo1.mp4',
                },
                {
                  c: `${cli} patterns --patterns-file ./patterns.tpv.json --list`,
                  d: 'List including your custom patterns',
                  previewSrc: 'demo1.mp4',
                },
                {
                  c: `${cli} patterns --patterns-file ./patterns.tpv.json --custom-patterns-only --list`,
                  d: 'List only your custom patterns',
                  previewSrc: 'demo1.mp4',
                },
                {
                  c: `${cli} patterns --patterns-file ./patterns.tpv.json --custom-patterns-only --test 'FATAL EXCEPTION'`,
                  d: 'Test against custom-only set',
                  previewSrc: 'demo1.mp4',
                },
              ]}
            />
          </div>
        </section>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
}
