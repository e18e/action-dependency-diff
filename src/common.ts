export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const absBytes = Math.abs(bytes);
  const k = 1000;
  const sizes = ['B', 'kB', 'MB', 'GB'];
  const i = Math.floor(Math.log(absBytes) / Math.log(k));
  const byteValue = parseFloat((absBytes / Math.pow(k, i)).toFixed(1));
  return `${bytes < 0 ? -byteValue : byteValue} ${sizes[i]}`;
}

export function parseCommaList(input: string | undefined): string[] {
  if (!input) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const raw of input.split(',')) {
    const trimmed = raw.trim();
    if (trimmed.length > 0 && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }
  return result;
}

export function matchesPattern(value: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (!pattern.includes('*')) {
    return value === pattern;
  }
  // escape all regex special characters except '*', then convert '*' wildcard into '.*'
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(value);
}

export function matchesAnyPattern(
  value: string,
  patterns: Iterable<string>
): boolean {
  for (const pattern of patterns) {
    if (matchesPattern(value, pattern)) {
      return true;
    }
  }
  return false;
}
