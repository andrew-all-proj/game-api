import * as gameDb from 'game-db'
import config from '../../../config'
import { v4 as uuidv4 } from 'uuid'
import { UserSelectedBodyPartInput } from '../dto/user.args'
import * as sharp from 'sharp'
import { EntityManager } from 'typeorm'

type CacheEntry<T> = { value: T; etag?: string; loadedAt: number }
const textCache = new Map<string, CacheEntry<string>>()
const binCache = new Map<string, CacheEntry<Buffer>>()
const DEFAULT_TTL = 60 * 60 * 1000
const isFresh = (e?: CacheEntry<any>, ttl = DEFAULT_TTL) => !!e && Date.now() - e.loadedAt < ttl

function toPublicUrl(path: string) {
  return `${config.fileUrlPrefix}${path}`
}

/* ----------------------------- fetch helpers ----------------------------- */

async function fetchTextWithETag(
  url: string,
  etag?: string,
): Promise<{ text: string; etag?: string; notModified?: boolean }> {
  const headers: Record<string, string> = {}
  if (etag) headers['If-None-Match'] = etag

  const res = await fetch(url, { headers })
  if (res.status === 304) return { text: '', etag, notModified: true }
  if (!res.ok) throw new Error(`Fetch failed ${res.status} ${res.statusText} for ${url}`)

  const text = await res.text()
  const newEtag = res.headers.get('etag') ?? undefined
  return { text, etag: newEtag || etag }
}

async function fetchBufferWithETag(
  url: string,
  etag?: string,
): Promise<{ buffer: Buffer; etag?: string; notModified?: boolean }> {
  const headers: Record<string, string> = {}
  if (etag) headers['If-None-Match'] = etag

  const res = await fetch(url, { headers })
  if (res.status === 304) return { buffer: Buffer.alloc(0), etag, notModified: true }
  if (!res.ok) throw new Error(`Fetch failed ${res.status} ${res.statusText} for ${url}`)

  const ab = await res.arrayBuffer()
  const buffer = Buffer.from(ab)
  const newEtag = res.headers.get('etag') ?? undefined
  return { buffer, etag: newEtag || etag }
}

/* ------------------------- resolve latest PNG/JSON ------------------------ */

async function resolveLatestSpritePngAndAtlasJson(): Promise<{ pngUrl: string; jsonUrl: string }> {
  const files = await gameDb.Entities.File.find({
    where: {
      contentType: gameDb.datatypes.ContentTypeEnum.SPRITE_SHEET_USER_AVATAR,
    },
  })

  const pngFiles = files.filter(
    (f: any) => f.fileType === gameDb.datatypes.FileTypeEnum.IMAGE && String(f.url).toLowerCase().endsWith('.png'),
  )
  const jsonFiles = files.filter(
    (f: any) => f.fileType === gameDb.datatypes.FileTypeEnum.JSON && String(f.url).toLowerCase().endsWith('.json'),
  )

  if (!pngFiles.length) throw new Error('Sprite PNG not found')
  if (!jsonFiles.length) throw new Error('Sprite atlas JSON not found')

  const latestPng =
    pngFiles.length === 1
      ? pngFiles[0]
      : pngFiles.reduce((max: any, it: any) => ((it.version ?? 0) > (max.version ?? 0) ? it : max))

  const latestJson =
    jsonFiles.length === 1
      ? jsonFiles[0]
      : jsonFiles.reduce((max: any, it: any) => ((it.version ?? 0) > (max.version ?? 0) ? it : max))

  return { pngUrl: toPublicUrl(latestPng.url), jsonUrl: toPublicUrl(latestJson.url) }
}

/* ------------------------------- caching IO ------------------------------ */

async function loadTextCached(url: string, ttlMs = DEFAULT_TTL): Promise<string> {
  const c = textCache.get(url)
  if (isFresh(c, ttlMs)) return c!.value
  const { text, etag, notModified } = await fetchTextWithETag(url, c?.etag)
  if (notModified && c) return c.value
  textCache.set(url, { value: text, etag, loadedAt: Date.now() })
  return text
}

async function loadBufferCached(url: string, ttlMs = DEFAULT_TTL): Promise<Buffer> {
  const c = binCache.get(url)
  if (isFresh(c, ttlMs)) return c!.value
  const { buffer, etag, notModified } = await fetchBufferWithETag(url, c?.etag)
  if (notModified && c) return c.value
  binCache.set(url, { value: buffer, etag, loadedAt: Date.now() })
  return buffer
}

/* -------------------------------- atlas types ---------------------------- */

type AtlasFrame = {
  frame: { x: number; y: number; w: number; h: number }
  rotated?: boolean
  trimmed?: boolean
  spriteSourceSize?: { x: number; y: number; w: number; h: number }
  sourceSize?: { w: number; h: number }
}
type AtlasHash = {
  frames: Record<string, AtlasFrame>
  meta?: any
}

/** найти фрейм по имени с возможными вариантами ключей */
function getFrame(atlas: AtlasHash, name: string): { key: string; f: AtlasFrame } | null {
  // чаще всего ключи = "ava-head_1.png" или "ava-head_1"
  if (atlas.frames[name]) return { key: name, f: atlas.frames[name] }
  if (atlas.frames[`${name}.png`]) return { key: `${name}.png`, f: atlas.frames[`${name}.png`] }
  if (atlas.frames[`${name}.svg`]) return { key: `${name}.svg`, f: atlas.frames[`${name}.svg`] }
  return null
}

/* ----------------------- compose avatar from PNG sheet -------------------- */

async function extractFrameBufferFromSheet(sheet: Buffer, f: AtlasFrame): Promise<Buffer> {
  const { x, y, w, h } = f.frame
  let img = sharp(sheet).extract({ left: x, top: y, width: w, height: h })
  if (f.rotated) {
    // большинство атласиаторов крутят на 90° CW — повернём обратно
    img = img.rotate(90)
  }
  return await img.png().toBuffer()
}

export const createAvatar = async (
  bodyParts: UserSelectedBodyPartInput,
  manager: EntityManager,
): Promise<{ fileId: string; url: string; pngBuffer: Buffer }> => {
  // 1) получаем свежие PNG + JSON
  const { pngUrl, jsonUrl } = await resolveLatestSpritePngAndAtlasJson()
  const [sheetBuffer, atlasText] = await Promise.all([loadBufferCached(pngUrl), loadTextCached(jsonUrl)])

  let atlas: AtlasHash
  try {
    atlas = JSON.parse(atlasText)
  } catch (e) {
    throw new Error(`Atlas JSON parse failed: ${String(e)}`)
  }

  // 2) имена полных частей (НЕ иконок)
  const headName = `ava-head_${bodyParts.headPartId}`
  const bodyName = `ava-clothes_${bodyParts.bodyPartId}`
  const emotionName = `ava-emotion_${bodyParts.emotionPartId}`

  const headFrame = getFrame(atlas, headName)
  const bodyFrame = getFrame(atlas, bodyName)
  const emotionFrame = getFrame(atlas, emotionName)

  if (!bodyFrame) throw new Error(`Frame not found: ${bodyName}`)
  if (!headFrame) throw new Error(`Frame not found: ${headName}`)
  if (!emotionFrame) throw new Error(`Frame not found: ${emotionName}`)

  // 3) достаём куски из sheets
  const [bodyBuf, headBuf, emotionBuf] = await Promise.all([
    extractFrameBufferFromSheet(sheetBuffer, bodyFrame.f),
    extractFrameBufferFromSheet(sheetBuffer, headFrame.f),
    extractFrameBufferFromSheet(sheetBuffer, emotionFrame.f),
  ])

  // 4) нормируем их до 142x142 и композим по слоям: body -> head -> emotion
  const CANVAS = { w: 142, h: 142 }

  const bodyResized = await sharp(bodyBuf).resize(CANVAS.w, CANVAS.h, { fit: 'contain' }).toBuffer()
  const headResized = await sharp(headBuf).resize(CANVAS.w, CANVAS.h, { fit: 'contain' }).toBuffer()
  const emotionResized = await sharp(emotionBuf).resize(CANVAS.w, CANVAS.h, { fit: 'contain' }).toBuffer()

  const pngBuffer = await sharp({
    create: { width: CANVAS.w, height: CANVAS.h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: bodyResized, left: 0, top: 0 },
      { input: headResized, left: 0, top: 0 },
      { input: emotionResized, left: 0, top: 0 },
    ])
    .png()
    .toBuffer()

  // 5) сохраняем файл в БД
  const imageId = uuidv4()
  const url = `${config.s3.prefix}/${imageId}.png`

  await manager.save(
    gameDb.Entities.File.create({
      id: imageId,
      fileType: gameDb.datatypes.FileTypeEnum.IMAGE,
      contentType: gameDb.datatypes.ContentTypeEnum.AVATAR_PROFESSOR,
      url,
      version: 1,
    }),
  )

  return { fileId: imageId, url, pngBuffer }
}
