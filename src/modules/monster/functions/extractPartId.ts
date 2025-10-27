export function extractPartId(key: unknown): number {
  if (!key || typeof key !== 'string') return 0
  const parts = key.split('/')

  for (const segment of parts) {
    const match = segment.match(/_(\d+)/)
    if (match) {
      return Number(match[1])
    }
  }

  return 0
}
