import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, ChevronRight, Terminal } from 'lucide-react';
import { CodeWithCopy } from '@/components/CodeWithCopy';

export function ObservabilitySection() {
  const cli = 'npx tsx src/cli/main.ts';

  return (
    <section className="space-y-8" data-section-key="observability">
      <Card className="border-0 bg-linear-to-br from-green-50 to-emerald-50 shadow-xl dark:from-green-950 dark:to-emerald-950">
        <CardHeader className="pb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-green-500 to-emerald-600">
            <BarChart3 size={24} className="text-white" />
          </div>
          <CardTitle className="reveal-up text-2xl font-bold text-slate-800 dark:text-slate-100">
            Observability: Loki + Grafana
          </CardTitle>
          <CardDescription className="text-lg text-slate-600 dark:text-slate-300">
            Push logs to Grafana Loki and visualize with comprehensive dashboards
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100">
                <Terminal size={18} />
                Ingest to Loki
              </h3>
              <div className="space-y-3">
                <CodeWithCopy
                  cmd={`${cli} stream-all --export-jsonl .\\logs --loki-url http://localhost:3100/loki/api/v1/push`}
                  note="Windows PowerShell"
                />
                <CodeWithCopy
                  cmd={`${cli} stream-all --export-jsonl ./logs --loki-url http://localhost:3100/loki/api/v1/push`}
                  note="macOS/Linux"
                />
              </div>
              <div className="rounded-lg bg-white/60 p-4 dark:bg-slate-800/60">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  <strong>Labels:</strong> job, device, priority, tag, pat, severity. Unmatched logs
                  use pat="none".
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100">
                <BarChart3 size={18} />
                Dashboard Features
              </h3>
              <div className="space-y-3 rounded-lg bg-white/60 p-4 dark:bg-slate-800/60">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Import{' '}
                  <code className="rounded bg-slate-200 px-2 py-1 text-xs dark:bg-slate-700">
                    reports/grafana/logcat-overview.json
                  </code>{' '}
                  into Grafana.
                </p>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <li className="flex items-start gap-2">
                    <ChevronRight size={16} className="mt-0.5 text-green-500" />
                    Filters: device, priority, pattern (pat), severity
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight size={16} className="mt-0.5 text-green-500" />
                    Toggle unmatched: "Include unmatched (pat=none)"
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight size={16} className="mt-0.5 text-green-500" />
                    Tables have drilldowns to Explore
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
