import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { ExternalLink, Play, Pause, Terminal, X, Zap, Smartphone } from 'lucide-react';

export interface HeroSectionRefs {
  demoVideoRef: React.MutableRefObject<HTMLVideoElement | null>;
  heroVideoRef: React.MutableRefObject<HTMLVideoElement | null>;
  mainVideoRef: React.MutableRefObject<HTMLVideoElement | null>;
  demoSectionRef: React.MutableRefObject<HTMLDivElement | null>;
}

export function HeroSection({
  showDemo,
  setShowDemo,
  refs,
  mainVideoReady,
  mainPlaying,
  toggleMainPlayback,
}: Readonly<{
  showDemo: boolean;
  setShowDemo: (v: boolean) => void;
  refs: HeroSectionRefs;
  mainVideoReady: boolean;
  mainPlaying: boolean;
  toggleMainPlayback: () => void;
}>) {
  const { demoVideoRef, mainVideoRef, demoSectionRef } = refs;
  return (
    <section className="space-y-8 py-12 text-center">
      <div className="mb-8 flex items-center justify-center gap-4">
        <div className="float-animation flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-green-500 to-emerald-600">
          <Smartphone size={32} className="text-white" />
        </div>
        <div
          className="float-animation flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-500 to-green-600"
          style={{ animationDelay: '1s' }}
        >
          <Terminal size={32} className="text-white" />
        </div>
        <div
          className="float-animation flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-green-600 to-teal-600"
          style={{ animationDelay: '2s' }}
        >
          <Zap size={32} className="text-white" />
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-5xl font-bold leading-tight md:text-7xl">
          <span className="text-green-600">AI-Powered</span>
          <br />
          <span className="text-slate-800 dark:text-slate-100">Android Debugging</span>
        </h1>
        <p className="mx-auto max-w-3xl text-xl leading-relaxed text-slate-600 md:text-2xl dark:text-slate-300">
          Real-time logcat streaming with intelligent error analysis, pattern detection, and
          automated debugging suggestions powered by OpenAI, Gemini, or a local SLM
          (OpenAI‑compatible)
        </p>
        <div className="flex justify-center">
          <a
            href="https://github.com/digablesolutions/logcat-agent#local-slms-openai-compatible"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-sm text-emerald-800 transition-colors hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:hover:bg-emerald-800"
            aria-label="Learn how to run with a local SLM via OPENAI_BASE_URL"
          >
            <span className="font-medium">Local SLMs</span>
            <span className="opacity-80">Run with OPENAI_BASE_URL</span>
            <ExternalLink size={14} />
          </a>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center gap-4 pt-8 sm:flex-row">
        <Button
          asChild
          size="lg"
          className="rounded-xl bg-linear-to-r from-green-600 to-emerald-600 px-8 py-3 text-lg font-semibold text-white shadow-lg transition-all hover:from-green-700 hover:to-emerald-700 hover:shadow-xl"
        >
          <a
            href="https://github.com/digablesolutions/logcat-agent#readme"
            target="_blank"
            rel="noreferrer"
            aria-label="Get started with the README"
          >
            <Play size={20} className="mr-2" />
            Get Started
          </a>
        </Button>
        <Dialog open={showDemo} onOpenChange={setShowDemo}>
          <DialogTrigger asChild>
            <Button
              size="lg"
              variant="secondary"
              className="rounded-xl border border-border bg-white/70 px-8 py-3 text-lg font-semibold transition-all hover:bg-slate-50 dark:bg-slate-800/70 dark:hover:bg-slate-800"
              aria-label="Open the demo video in a modal"
            >
              <Play size={18} className="mr-2" />
              Watch demo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogClose asChild>
              <button
                type="button"
                aria-label="Close"
                className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-900 hover:bg-white"
              >
                <X size={18} />
              </button>
            </DialogClose>
            <video
              ref={demoVideoRef}
              className="h-auto w-full"
              src={`${import.meta.env.BASE_URL}demo1.mp4`}
              controls
              autoPlay
              muted
              playsInline
              poster={`${import.meta.env.BASE_URL}poster.png`}
            >
              <track
                src={`${import.meta.env.BASE_URL}captions.vtt`}
                kind="captions"
                srcLang="en"
                label="English"
                default
              />
            </video>
          </DialogContent>
        </Dialog>
        <Button
          asChild
          variant="outline"
          size="lg"
          className="rounded-xl border-2 bg-transparent px-8 py-3 text-lg font-semibold transition-all hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <a
            href="https://github.com/digablesolutions/logcat-agent"
            target="_blank"
            rel="noreferrer"
            aria-label="View repository on GitHub"
          >
            <ExternalLink size={20} className="mr-2" />
            View on GitHub
          </a>
        </Button>
      </div>

      {/* Hero Video */}
      <div id="demo" ref={demoSectionRef} className="pt-8">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl border border-border bg-black/90 shadow-xl">
          <video
            ref={mainVideoRef}
            src={mainVideoReady ? `${import.meta.env.BASE_URL}demo1.mp4` : undefined}
            className="h-auto w-full"
            autoPlay={mainVideoReady && mainPlaying}
            muted
            playsInline
            loop
            preload="metadata"
            poster={`${import.meta.env.BASE_URL}poster.png`}
            aria-label="Logcat Agent demo video"
          >
            {mainVideoReady && (
              <track
                src={`${import.meta.env.BASE_URL}captions.vtt`}
                kind="captions"
                srcLang="en"
                label="English"
                default
              />
            )}
            Your browser does not support the video tag.
          </video>
          {/* Overlay play/pause control */}
          <div className="absolute bottom-3 left-3">
            <button
              type="button"
              onClick={toggleMainPlayback}
              aria-label={mainPlaying ? 'Pause video' : 'Play video'}
              aria-pressed={!mainPlaying}
              className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-slate-900 shadow transition hover:bg-white dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              {mainPlaying ? <Pause size={16} /> : <Play size={16} />}
              <span className="text-sm font-medium">{mainPlaying ? 'Pause' : 'Play'}</span>
            </button>
          </div>
        </div>
        <p className="mt-3 text-center text-sm text-slate-600 dark:text-slate-400">
          Tip: place assets in{' '}
          <code className="rounded bg-slate-200 px-1 dark:bg-slate-700">website/public</code> —
          video: <code className="rounded bg-slate-200 px-1 dark:bg-slate-700">demo1.mp4</code>,
          poster: <code className="rounded bg-slate-200 px-1 dark:bg-slate-700">poster.png</code>,
          captions:{' '}
          <code className="rounded bg-slate-200 px-1 dark:bg-slate-700">captions.vtt</code>
        </p>
      </div>
    </section>
  );
}
