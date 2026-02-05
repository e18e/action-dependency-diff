export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const absBytes = Math.abs(bytes);
  const k = 1000;
  const sizes = ['B', 'kB', 'MB', 'GB'];
  const i = Math.floor(Math.log(absBytes) / Math.log(k));
  const byteValue = parseFloat((absBytes / Math.pow(k, i)).toFixed(1));
  return `${bytes < 0 ? -byteValue : byteValue} ${sizes[i]}`;
}
