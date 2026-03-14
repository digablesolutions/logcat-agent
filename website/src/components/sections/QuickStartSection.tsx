import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronRight, ExternalLink, Play, Shield, Smartphone } from 'lucide-react';

export function QuickStartSection() {
  return (
    <section className="space-y-12" data-section-key="quick">
      <Card className="border-0 bg-linear-to-br from-white to-slate-50 shadow-xl dark:from-slate-800 dark:to-slate-900">
        <CardHeader className="pb-8 text-center">
          <CardTitle className="reveal-up whoosh text-3xl font-bold text-slate-800 dark:text-slate-100">
            Quick Start Guide
          </CardTitle>
          <CardDescription className="text-lg text-slate-600 dark:text-slate-300">
            Get up and running with the logcat agent in just a few minutes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                n: '1',
                t: 'Prerequisites',
                d: 'Install Node.js 22.12+ and ensure ADB is in your PATH',
                icon: <Shield size={24} />,
                color: 'from-green-500 to-emerald-500',
              },
              {
                n: '2',
                t: 'Connect Device',
                d: 'Connect Android device or start emulator',
                icon: <Smartphone size={24} />,
                color: 'from-emerald-500 to-green-600',
              },
              {
                n: '3',
                t: 'Start Streaming',
                d: 'Run the CLI command to begin log analysis',
                icon: <Play size={24} />,
                color: 'from-green-600 to-teal-600',
              },
            ].map((step) => (
              <div key={step.n} className="group space-y-4 text-center">
                <div
                  className={`h-16 w-16 bg-linear-to-br ${step.color} mx-auto flex items-center justify-center rounded-2xl text-white shadow-lg transition-transform group-hover:scale-110`}
                >
                  {step.icon}
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{step.t}</h3>
                  <p className="leading-relaxed text-slate-600 dark:text-slate-300">{step.d}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4 rounded-2xl bg-slate-100 p-6 dark:bg-slate-800">
            <h4 className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
              <ExternalLink size={18} />
              Additional Resources
            </h4>
            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <a
                href="https://github.com/kistradegoods/logcat-agent/blob/main/docs/real-device-testing.md"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-blue-600 transition-colors hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <ChevronRight size={16} />
                Real device testing guide
              </a>
              <a
                href="https://github.com/kistradegoods/logcat-agent/blob/main/docs/custom-patterns.md"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-blue-600 transition-colors hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <ChevronRight size={16} />
                Custom patterns guide
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
