export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const absBytes = Math.abs(bytes);
  const k = 1000;
  const sizes = ['B', 'kB', 'MB', 'GB'];
  const i = Math.floor(Math.log(absBytes) / Math.log(k));
  const byteValue = parseFloat((absBytes / Math.pow(k, i)).toFixed(1));
  return `${bytes < 0 ? -byteValue : byteValue} ${sizes[i]}`;
}

export function parseCommaList(input: string): Set<string> {
  const result = new Set<string>();
  for (const raw of input.split(',')) {
    const trimmed = raw.trim();
    if (trimmed !== '') result.add(trimmed);
  }
  return result;
}

export function matchesPattern(value: string, pattern: string): boolean {
  const parts = pattern.split('*');
  if (parts.length === 1) return value === pattern;

  const first = parts[0];
  const last = parts[parts.length - 1];
  if (
    value.length < first.length + last.length ||
    !value.startsWith(first) ||
    !value.endsWith(last)
  ) {
    return false;
  }

  let pos = first.length;
  const end = value.length - last.length;
  for (let i = 1; i < parts.length - 1; i++) {
    const part = parts[i];
    const index = value.indexOf(part, pos);
    if (index === -1 || index + part.length > end) return false;
    pos = index + part.length;
  }
  return true;
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
