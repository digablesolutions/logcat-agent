import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, AlertTriangle, ChevronRight, TrendingUp } from 'lucide-react';
import { CodeWithCopy } from '@/components/CodeWithCopy';

export function AdvancedSection() {
  const cli = 'npx tsx src/cli/main.ts';

  return (
    <section className="mt-8 space-y-12" data-section-key="cli">
      <div className="space-y-4 text-center">
        <h2 className="reveal-up whoosh text-4xl font-bold text-slate-800 dark:text-slate-100">
          Advanced Real-time Analysis
        </h2>
        <p className="mx-auto max-w-3xl text-xl text-slate-600 dark:text-slate-300">
          Proactive monitoring with anomaly detection, trend analysis, and performance insights
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <Card className="group border-0 bg-white/80 shadow-lg backdrop-blur-xs transition-all duration-300 hover:shadow-2xl dark:bg-slate-800/80">
          <CardHeader className="pb-4">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-green-500 to-emerald-500 transition-transform group-hover:scale-110">
              <AlertTriangle size={24} className="text-white" />
            </div>
            <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-100">
              Anomaly Detection
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-300">
              Automatically detect unusual patterns and error spikes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <li className="flex items-start gap-2">
                <ChevronRight size={16} className="mt-0.5 text-green-500" />
                Frequency anomalies and error spikes
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight size={16} className="mt-0.5 text-green-500" />
                New error pattern detection
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight size={16} className="mt-0.5 text-green-500" />
                Tag activity pattern changes
              </li>
            </ul>
            <CodeWithCopy
              cmd={`${cli} realtime --profile debug`}
              note="High sensitivity anomaly detection"
            />
          </CardContent>
        </Card>

        <Card className="group border-0 bg-white/80 shadow-lg backdrop-blur-xs transition-all duration-300 hover:shadow-2xl dark:bg-slate-800/80">
          <CardHeader className="pb-4">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-green-600 transition-transform group-hover:scale-110">
              <TrendingUp size={24} className="text-white" />
            </div>
            <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-100">
              Trend Analysis
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-300">
              Monitor changes in error rates and performance over time
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <li className="flex items-start gap-2">
                <ChevronRight size={16} className="mt-0.5 text-green-500" />
                Error rate trend monitoring
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight size={16} className="mt-0.5 text-green-500" />
                Warning pattern escalation
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight size={16} className="mt-0.5 text-green-500" />
                Performance degradation alerts
              </li>
            </ul>
            <CodeWithCopy
              cmd={`${cli} realtime --profile production`}
              note="Conservative trend monitoring"
            />
          </CardContent>
        </Card>

        <Card className="group border-0 bg-white/80 shadow-lg backdrop-blur-xs transition-all duration-300 hover:shadow-2xl dark:bg-slate-800/80">
          <CardHeader className="pb-4">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-green-600 to-teal-600 transition-transform group-hover:scale-110">
              <Activity size={24} className="text-white" />
            </div>
            <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-100">
              Performance Monitoring
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-300">
              Deep insights into memory, GC, ANRs, and I/O bottlenecks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <li className="flex items-start gap-2">
                <ChevronRight size={16} className="mt-0.5 text-green-500" />
                Memory pressure & GC monitoring
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight size={16} className="mt-0.5 text-green-500" />
                ANR and I/O bottleneck detection
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight size={16} className="mt-0.5 text-green-500" />
                Battery drain & network issues
              </li>
            </ul>
            <CodeWithCopy
              cmd={`${cli} realtime --profile performance`}
              note="Performance-focused monitoring"
            />
          </CardContent>
        </Card>
      </div>

      {/* Analysis Profiles */}
      <Card className="border-0 bg-linear-to-br from-green-50 to-emerald-50 shadow-xl dark:from-green-950 dark:to-emerald-950">
        <CardHeader className="pb-6 text-center">
          <CardTitle className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Analysis Profiles
          </CardTitle>
          <CardDescription className="text-lg text-slate-600 dark:text-slate-300">
            Pre-configured settings optimized for different use cases
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                name: 'development',
                desc: 'Active development',
                sensitivity: 'Moderate',
                interval: '15s',
                features: 'All features enabled, balanced',
                color: 'from-green-500 to-emerald-500',
              },
              {
                name: 'production',
                desc: 'Production monitoring',
                sensitivity: 'Conservative',
                interval: '30s',
                features: 'High confidence, less noise',
                color: 'from-emerald-500 to-green-600',
              },
              {
                name: 'debug',
                desc: 'Intensive troubleshooting',
                sensitivity: 'High',
                interval: '5s',
                features: 'Maximum sensitivity',
                color: 'from-green-600 to-teal-600',
              },
              {
                name: 'performance',
                desc: 'Performance optimization',
                sensitivity: 'Moderate',
                interval: '10s',
                features: 'Focus on performance issues',
                color: 'from-teal-500 to-green-500',
              },
              {
                name: 'minimal',
                desc: 'Lightweight monitoring',
                sensitivity: 'Low',
                interval: '60s',
                features: 'Basic anomaly detection only',
                color: 'from-emerald-600 to-teal-500',
              },
            ].map((profile) => (
              <div
                key={profile.name}
                className="space-y-3 rounded-lg bg-white/60 p-4 dark:bg-slate-800/60"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-8 w-8 bg-linear-to-br ${profile.color} flex items-center justify-center rounded-lg`}
                  >
                    <code className="text-xs font-bold text-white">
                      {profile.name[0].toUpperCase()}
                    </code>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                      {profile.name}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300">{profile.desc}</p>
                  </div>
                </div>
                <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  <div>
                    <strong>Sensitivity:</strong> {profile.sensitivity}
                  </div>
                  <div>
                    <strong>Interval:</strong> {profile.interval}
                  </div>
                  <div>
                    <strong>Features:</strong> {profile.features}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
