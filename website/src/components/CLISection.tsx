import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CodeWithCopy } from '@/components/CodeWithCopy';

export interface CLISectionProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  commands: { c: string; d?: string; previewSrc?: string }[];
  videoKey?: string;
  onPreview?: (src: string | null) => void;
}

export const CLISection = React.memo(function CLISection({
  title,
  description,
  icon,
  commands,
  videoKey,
  onPreview,
}: Readonly<CLISectionProps>) {
  return (
    <Card
      className="border-0 bg-white/80 shadow-xl backdrop-blur-xs dark:bg-slate-800/80"
      data-section-key={videoKey ?? undefined}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="reveal-up flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900/5 dark:bg-white/5">
              {icon}
            </div>
          )}
          <div>
            <CardTitle className="reveal-up text-xl">{title}</CardTitle>
            {description && <CardDescription className="reveal-up">{description}</CardDescription>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {commands.map((it) => (
          <div
            key={it.c}
            className="reveal-up"
            onMouseEnter={() => onPreview?.(it.previewSrc ?? null)}
            onFocus={() => onPreview?.(it.previewSrc ?? null)}
            onMouseLeave={() => onPreview?.(null)}
            onBlur={() => onPreview?.(null)}
          >
            <CodeWithCopy cmd={it.c} note={it.d ?? ''} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
});
