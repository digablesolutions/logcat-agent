/**
 * Performs basic redaction of potentially sensitive information in log
 * messages before they are sent to a third‑party AI service.  Email
 * addresses, bearer tokens and query parameters are stripped.
 */
export function redactMessage(s: string): string {
  return (
    s
      // emails
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '<email>')
      // bearer tokens / api keys rough patterns
      .replace(/\b(eyJ|ya29|sk-[A-Za-z0-9]{20,})\S*/g, '<token>')
      // urls with query secrets
      .replace(/(?<=[?&])[a-z0-9_]+=[^&\s]+/gi, '<redacted>')
  );
}
