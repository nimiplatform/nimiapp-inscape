export type RewriteVariant = { tone: string; text: string; note: string };
export type RewriteResult = { variants: readonly RewriteVariant[] };

export function parseRewriteResult(text: string): RewriteResult | null {
  try {
    const value: unknown = JSON.parse(
      text.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/, '$1'),
    );
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const object = value as Record<string, unknown>;
    if (
      Object.keys(object).length !== 1 ||
      !Array.isArray(object.variants) ||
      object.variants.length !== 3
    )
      return null;
    const seen = new Set<string>();
    for (const item of object.variants) {
      if (
        !item ||
        typeof item !== 'object' ||
        Array.isArray(item) ||
        Object.keys(item).some((key) => !['tone', 'text', 'note'].includes(key))
      )
        return null;
      for (const [field, max] of [
        ['tone', 60],
        ['text', 900],
        ['note', 300],
      ] as const) {
        if (typeof item[field] !== 'string' || !item[field].trim() || item[field].length > max)
          return null;
      }
      if (seen.has(item.text.trim())) return null;
      seen.add(item.text.trim());
    }
    return object as RewriteResult;
  } catch {
    return null;
  }
}
