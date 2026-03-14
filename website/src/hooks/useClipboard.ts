import * as React from 'react';

export function useClipboard() {
  const [copied, setCopied] = React.useState<string | null>(null);
  const copy = React.useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(text);
    window.setTimeout(() => setCopied(null), 1500);
  }, []);
  return { copied, copy } as const;
}
