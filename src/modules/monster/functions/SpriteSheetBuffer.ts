import config from '../../../config'
import type { SpriteAtlas } from '../../../datatypes/common/SpriteAtlas'

interface CacheEntry<T = Buffer> {
  value: T
  etag?: string
  loadedAt: number
}

const cache = {
  json: new Map<string, CacheEntry<SpriteAtlas>>(),
  bin: new Map<string, CacheEntry<Buffer>>(),
}

const DEFAULT_TTL_MS = 3600000 // 1 hour

function isFresh(e?: CacheEntry<any>, ttl = DEFAULT_TTL_MS) {
  return !!e && Date.now() - e.loadedAt < ttl
}

function toPublicUrl(path: string): string {
  return `${config.fileUrlPrefix}${path}`
}

async function fetchBuffer(
  url: string,
  etag?: string,
): Promise<{ buffer: Buffer; etag?: string; notModified?: boolean }> {
  const headers: Record<string, string> = {}
  if (etag) headers['If-None-Match'] = etag

  const res = await fetch(url, { headers })
  if (res.status === 304) {
    return { buffer: Buffer.alloc(0), etag, notModified: true }
  }
  if (!res.ok) {
    throw new Error(`Fetch failed ${res.status} ${res.statusText} for ${url}`)
  }
  const ab = await res.arrayBuffer()
  const buf = Buffer.from(ab)
  const newEtag = res.headers.get('etag') ?? undefined
  return { buffer: buf, etag: newEtag || etag }
}

/** JSON-atlas */
export async function loadAtlasJsonFromUrl(pathOrRef: string, opts?: { ttlMs?: number }): Promise<SpriteAtlas> {
  const url = toPublicUrl(pathOrRef)
  const ttl = opts?.ttlMs ?? DEFAULT_TTL_MS

  const c = cache.json.get(url)
  if (isFresh(c, ttl)) return c!.value

  const { buffer, etag, notModified } = await fetchBuffer(url, c?.etag)
  if (notModified && c) return c.value

  const parsed = JSON.parse(buffer.toString('utf8')) as SpriteAtlas
  cache.json.set(url, { value: parsed, etag, loadedAt: Date.now() })
  return parsed
}

/** SPRITE-list */
export async function loadSpriteSheetBufferFromUrl(pathOrRef: string, opts?: { ttlMs?: number }): Promise<Buffer> {
  const url = toPublicUrl(pathOrRef)
  const ttl = opts?.ttlMs ?? DEFAULT_TTL_MS

  const c = cache.bin.get(url)
  if (isFresh(c, ttl)) return c!.value

  const { buffer, etag, notModified } = await fetchBuffer(url, c?.etag)
  if (notModified && c) return c.value

  cache.bin.set(url, { value: buffer, etag, loadedAt: Date.now() })
  return buffer
}
