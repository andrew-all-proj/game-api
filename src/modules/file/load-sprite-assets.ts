import config from '../../config'
import type { SpriteAtlas } from '../../datatypes/common/SpriteAtlas'
import { BadRequestException } from '@nestjs/common'
import * as gameDb from 'game-db'

//TODO REMOVE EXCEPTION USE SIMPEL ERROR

const DEFAULT_TTL_MS = 60 * 60 * 1000 // 1 hour
export default DEFAULT_TTL_MS

interface CacheEntry<T = Buffer> {
  value: T
  etag?: string
  loadedAt: number
}

interface SpriteRefs {
  contentType: gameDb.datatypes.ContentTypeEnum
  jsonId: string | number
  imgId: string | number
  jsonPath: string
  imgPath: string
  jsonVersion?: number | null
  imgVersion?: number | null
}

/** ===== In-memory caches ===== */
const cache = {
  sprites: new Map<gameDb.datatypes.ContentTypeEnum, CacheEntry<SpriteRefs>>(),
  json: new Map<string, CacheEntry<SpriteAtlas>>(),
  bin: new Map<string, CacheEntry<Buffer>>(),
}

// in case of simultaneous requests for the same contentType
const pending = {
  sprites: new Map<gameDb.datatypes.ContentTypeEnum, Promise<SpriteRefs>>(),
}

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
  if (res.status === 304) return { buffer: Buffer.alloc(0), etag, notModified: true }
  if (!res.ok) throw new Error(`Fetch failed ${res.status} ${res.statusText} for ${url}`)

  const ab = await res.arrayBuffer()
  const buf = Buffer.from(ab)
  const newEtag = res.headers.get('etag') ?? undefined
  return { buffer: buf, etag: newEtag || etag }
}

/** ===== DB → SpriteRefs (cache с TTL) ===== */
async function resolveSpriteRefsFromDb(contentType: gameDb.datatypes.ContentTypeEnum): Promise<SpriteRefs> {
  const files = await gameDb.Entities.File.find({ where: { contentType } })
  if (files.length === 0) throw new BadRequestException('Sprite sheet not found')

  const jsonFiles = files.filter((f) => f.fileType === gameDb.datatypes.FileTypeEnum.JSON)
  const imageFiles = files.filter((f) => f.fileType === gameDb.datatypes.FileTypeEnum.IMAGE)

  const newest = <T extends { version?: number | null }>(arr: T[]) =>
    arr.length === 1 ? arr[0] : arr.reduce((max, it) => ((it.version ?? 0) > (max.version ?? 0) ? it : max))

  const atlasJson = newest(jsonFiles)
  const spriteSheet = newest(imageFiles)

  if (!atlasJson?.url || !spriteSheet?.url) {
    throw new BadRequestException('Invalid sprite file entries (empty url)')
  }

  return {
    contentType,
    jsonId: atlasJson.id,
    imgId: spriteSheet.id,
    jsonPath: atlasJson.url,
    imgPath: spriteSheet.url,
    jsonVersion: atlasJson.version ?? null,
    imgVersion: spriteSheet.version ?? null,
  }
}

/** Public: Get only links (with cache by contentType) */
export async function getSpriteRefs(
  contentType: gameDb.datatypes.ContentTypeEnum,
  opts?: { ttlMs?: number; force?: boolean },
): Promise<{ atlasJsonUrl: string; spriteSheetUrl: string; meta: Omit<SpriteRefs, 'jsonPath' | 'imgPath'> }> {
  const ttl = opts?.ttlMs ?? DEFAULT_TTL_MS
  const fresh = cache.sprites.get(contentType)

  if (!opts?.force && isFresh(fresh, ttl)) {
    const v = fresh!.value
    return {
      atlasJsonUrl: toPublicUrl(v.jsonPath),
      spriteSheetUrl: toPublicUrl(v.imgPath),
      meta: {
        contentType: v.contentType,
        jsonId: v.jsonId,
        imgId: v.imgId,
        jsonVersion: v.jsonVersion,
        imgVersion: v.imgVersion,
      },
    }
  }

  let p = pending.sprites.get(contentType)
  if (!p) {
    p = resolveSpriteRefsFromDb(contentType)
      .then((refs) => {
        cache.sprites.set(contentType, { value: refs, loadedAt: Date.now() })
        return refs
      })
      .finally(() => pending.sprites.delete(contentType))
    pending.sprites.set(contentType, p)
  }

  const refs = await p
  return {
    atlasJsonUrl: toPublicUrl(refs.jsonPath),
    spriteSheetUrl: toPublicUrl(refs.imgPath),
    meta: {
      contentType: refs.contentType,
      jsonId: refs.jsonId,
      imgId: refs.imgId,
      jsonVersion: refs.jsonVersion,
      imgVersion: refs.imgVersion,
    },
  }
}

/** Public: Get ready-made data (atlas + buffer) by contentType */
export async function loadSpriteAssets(
  contentType: gameDb.datatypes.ContentTypeEnum,
  opts?: { ttlMs?: number },
): Promise<{ atlasJson: SpriteAtlas; spriteSheet: Buffer; urls: { atlasJsonUrl: string; spriteSheetUrl: string } }> {
  const { atlasJsonUrl, spriteSheetUrl } = await getSpriteRefs(contentType, { ttlMs: opts?.ttlMs })

  {
    const c = cache.json.get(atlasJsonUrl)
    if (isFresh(c, opts?.ttlMs ?? DEFAULT_TTL_MS)) {
      // ok
    } else {
      try {
        const { buffer, etag, notModified } = await fetchBuffer(atlasJsonUrl, c?.etag)
        if (!notModified) {
          const parsed = JSON.parse(buffer.toString('utf8')) as SpriteAtlas
          cache.json.set(atlasJsonUrl, { value: parsed, etag, loadedAt: Date.now() })
        }
      } catch (e) {
        const refs = await getSpriteRefs(contentType, { force: true })
        const { buffer, etag } = await fetchBuffer(refs.atlasJsonUrl)
        const parsed = JSON.parse(buffer.toString('utf8')) as SpriteAtlas
        cache.json.set(refs.atlasJsonUrl, { value: parsed, etag, loadedAt: Date.now() })
      }
    }
  }

  {
    const c = cache.bin.get(spriteSheetUrl)
    if (isFresh(c, opts?.ttlMs ?? DEFAULT_TTL_MS)) {
      // ok
    } else {
      try {
        const { buffer, etag, notModified } = await fetchBuffer(spriteSheetUrl, c?.etag)
        if (!notModified) {
          cache.bin.set(spriteSheetUrl, { value: buffer, etag, loadedAt: Date.now() })
        }
      } catch (e) {
        const refs = await getSpriteRefs(contentType, { force: true })
        const { buffer, etag } = await fetchBuffer(refs.spriteSheetUrl)
        cache.bin.set(refs.spriteSheetUrl, { value: buffer, etag, loadedAt: Date.now() })
      }
    }
  }

  const atlasJson = cache.json.get(atlasJsonUrl)!.value
  const spriteSheet = cache.bin.get(spriteSheetUrl)!.value
  return { atlasJson, spriteSheet, urls: { atlasJsonUrl, spriteSheetUrl } }
}

export function invalidateSpriteCache(contentType?: gameDb.datatypes.ContentTypeEnum) {
  if (!contentType) {
    cache.sprites.clear()
    return
  }
  cache.sprites.delete(contentType)
}
