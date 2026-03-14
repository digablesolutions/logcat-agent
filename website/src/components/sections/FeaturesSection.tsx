import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Terminal, GitBranch } from 'lucide-react';
import { CodeWithCopy } from '@/components/CodeWithCopy';

export function FeaturesSection() {
  const cli = 'npx tsx src/cli/main.ts';

  return (
    <section className="space-y-12" data-section-key="features">
      <div className="space-y-4 text-center">
        <h2 className="reveal-up whoosh text-4xl font-bold text-slate-800 dark:text-slate-100">
          Powerful Features
        </h2>
        <p className="mx-auto max-w-2xl text-xl text-slate-600 dark:text-slate-300">
          Everything you need for efficient Android debugging and log analysis
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card className="group border-0 bg-white/80 shadow-lg backdrop-blur-xs transition-all duration-300 hover:shadow-2xl dark:bg-slate-800/80">
          <CardHeader className="pb-4">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-green-500 to-emerald-500 transition-transform group-hover:scale-110">
              <Terminal size={24} className="text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              CLI Tool
            </CardTitle>
            <CardDescription className="text-lg text-slate-600 dark:text-slate-300">
              Command-line interface for streaming and analyzing logcat output in real-time
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge className="border-0 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Real-time streaming
              </Badge>
              <Badge className="border-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                Pattern detection
              </Badge>
              <Badge className="border-0 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Device management
              </Badge>
              <Badge className="border-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                Wireless debugging
              </Badge>
            </div>
            <CodeWithCopy
              cmd={`${cli} stream -b main,crash -p I`}
              note="Basic logcat streaming with pattern detection"
            />
          </CardContent>
        </Card>

        <Card className="group border-0 bg-white/80 shadow-lg backdrop-blur-xs transition-all duration-300 hover:shadow-2xl dark:bg-slate-800/80">
          <CardHeader className="pb-4">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-green-600 transition-transform group-hover:scale-110">
              <GitBranch size={24} className="text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              AI Analysis
            </CardTitle>
            <CardDescription className="text-lg text-slate-600 dark:text-slate-300">
              Error summarization with intelligent debugging suggestions (OpenAI, Gemini, or local
              SLM)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className="border-green-200 text-green-700 dark:border-green-700 dark:text-green-300"
              >
                Error classification
              </Badge>
              <Badge
                variant="outline"
                className="border-emerald-200 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300"
              >
                Root cause analysis
              </Badge>
              <Badge
                variant="outline"
                className="border-green-200 text-green-700 dark:border-green-700 dark:text-green-300"
              >
                Fix suggestions
              </Badge>
            </div>
            <div className="space-y-3">
              <CodeWithCopy
                cmd={`OPENAI_API_KEY=sk-... ${cli} stream --provider openai`}
                note="OpenAI • macOS/Linux"
              />
              <CodeWithCopy
                cmd={`$env:OPENAI_API_KEY="sk-..."; ${cli} stream --provider openai`}
                note="OpenAI • Windows PowerShell"
              />
              <CodeWithCopy
                cmd={`GEMINI_API_KEY=... ${cli} stream --provider gemini --model gemini-1.5-flash-latest`}
                note="Gemini • macOS/Linux"
              />
              <CodeWithCopy
                cmd={`$env:GEMINI_API_KEY="..."; ${cli} stream --provider gemini --model gemini-1.5-flash-latest`}
                note="Gemini • Windows PowerShell"
              />
              <CodeWithCopy
                cmd={`OPENAI_BASE_URL=http://localhost:11434/v1 ${cli} stream --provider openai --model llama3.1:8b-instruct`}
                note="Local SLM (Ollama) • macOS/Linux"
              />
              <CodeWithCopy
                cmd={`$env:OPENAI_BASE_URL="http://localhost:11434/v1"; ${cli} stream --provider openai --model llama3.1:8b-instruct`}
                note="Local SLM (Ollama) • Windows PowerShell"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
