// Small helpers for MCP tool results.
export function ok<T extends Record<string, unknown>>(text: string, structuredContent: T) {
  return { content: [{ type: "text" as const, text }], structuredContent };
}
/** Errors never carry a transaction proposal (PayBox rule: no proposal inside isError). */
export function fail(text: string) {
  return { isError: true as const, content: [{ type: "text" as const, text }] };
}
