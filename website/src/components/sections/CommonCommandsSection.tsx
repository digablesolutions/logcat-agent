import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CodeWithCopy } from '@/components/CodeWithCopy';

export function CommonCommandsSection() {
  const cli = 'npx tsx src/cli/main.ts';

  return (
    <section className="space-y-8" data-section-key="common">
      <div className="space-y-4 text-center">
        <h2 className="reveal-up whoosh text-3xl font-bold text-slate-800 dark:text-slate-100">
          Common Commands
        </h2>
        <p className="text-lg text-slate-600 dark:text-slate-300">
          Essential commands to get you started quickly
        </p>
      </div>
      <Card className="border-0 bg-white/80 shadow-xl backdrop-blur-xs dark:bg-slate-800/80">
        <CardContent className="space-y-6 p-8">
          {[
            {
              c: `${cli} stream -b crash -p E`,
              d: 'Monitor crash logs with error priority',
            },
            {
              c: `${cli} stream --tags MyApp --no-ai`,
              d: 'Filter by app tag without AI analysis',
            },
            {
              c: `${cli} stream --model gpt-4o --provider openai`,
              d: 'Use OpenAI GPT-4o for enhanced analysis',
            },
            {
              c: `${cli} stream --model gemini-1.5-flash-latest --provider gemini`,
              d: 'Use Google Gemini 1.5 Flash for fast analysis',
            },
            {
              c: `${cli} stream --wifi --wifi-qr --wifi-timeout 90000`,
              d: 'Wireless: QR pair + connect then stream',
            },
            {
              c: `${cli} stream --wifi --wifi-target 10.0.0.25:41847`,
              d: 'Wireless: manual target when mDNS is blocked',
            },
          ].map((cmd) => (
            <div key={cmd.c} className="group">
              <CodeWithCopy cmd={cmd.c} note={cmd.d} />
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
