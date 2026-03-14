import React from 'react';
import { Shield, Terminal, Zap } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

export function Footer() {
  return (
    <footer className="space-y-8 border-t border-border py-12 text-center">
      <div className="flex justify-center">
        <ThemeToggle />
      </div>
      <div className="space-y-4">
        <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          Built with TypeScript, Node.js, OpenAI/Gemini, and Local SLM.
        </p>
        <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-600 dark:text-slate-400">
          <span className="flex items-center gap-2">
            <Shield size={16} />
            Privacy-first
          </span>
          <span className="flex items-center gap-2">
            <Terminal size={16} />
            Local processing
          </span>
          <span className="flex items-center gap-2">
            <Zap size={16} />
            Opt-in AI
          </span>
        </div>
      </div>
    </footer>
  );
}
