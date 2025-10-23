import * as gameDb from 'game-db'
import config from '../../../config'
import { v4 as uuidv4 } from 'uuid'
import { UserSelectedBodyPartInput } from '../dto/user.args'
import * as sharp from 'sharp'
import { EntityManager } from 'typeorm'

type CacheEntry<T> = { value: T; etag?: string; loadedAt: number }
const svgCache = new Map<string, CacheEntry<string>>()
const DEFAULT_TTL = 60 * 60 * 1000
const isFresh = (e?: CacheEntry<any>, ttl = DEFAULT_TTL) => !!e && Date.now() - e.loadedAt < ttl

function toPublicUrl(path: string) {
  return `${config.fileUrlPrefix}${path}`
}

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

async function resolveLatestAvatarSpriteSvg(): Promise<{ url: string }> {
  const files = await gameDb.Entities.File.find({
    where: {
      contentType: gameDb.datatypes.ContentTypeEnum.SPRITE_SHEET_USER_AVATAR,
      fileType: gameDb.datatypes.FileTypeEnum.IMAGE,
    },
  })

  const svgFiles = files.filter((f: any) => String(f.url).toLowerCase().endsWith('.svg'))
  if (!svgFiles.length) throw new Error('Sprite SVG not found')

  const latest =
    svgFiles.length === 1
      ? svgFiles[0]
      : svgFiles.reduce((max: any, it: any) => ((it.version ?? 0) > (max.version ?? 0) ? it : max))

  return { url: toPublicUrl(latest.url) }
}

async function loadSpriteSvgText(url: string, ttlMs = DEFAULT_TTL): Promise<string> {
  const c = svgCache.get(url)
  if (isFresh(c, ttlMs)) return c!.value

  const { text, etag, notModified } = await fetchTextWithETag(url, c?.etag)
  if (notModified && c) return c.value

  svgCache.set(url, { value: text, etag, loadedAt: Date.now() })
  return text
}

function extractSymbol(
  svgText: string,
  symbolId: string,
): { symbolMarkup: string; viewBox: string; vbW: number; vbH: number } {
  const re = new RegExp(`<symbol\\s+[^>]*id=["']${symbolId}["'][^>]*>([\\s\\S]*?)<\\/symbol>`, 'i')
  const m = svgText.match(re)
  if (!m) throw new Error(`symbol not found: ${symbolId}`)

  const fullSymbolMatch = svgText.slice(m.index!, m.index! + m[0].length) // весь <symbol ...>...</symbol>
  const viewBoxMatch = fullSymbolMatch.match(/viewBox=["']([^"']+)["']/i)
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 142 142'
  const [, , vbW, vbH] = viewBox.split(/\s+/).map(Number)

  return { symbolMarkup: fullSymbolMatch, viewBox, vbW, vbH }
}

function composeAvatarSvgWithUse(
  baseViewBox: string,
  symbols: Array<{ id: string; symbolMarkup: string; vbW: number; vbH: number }>,
  scale = 1,
): string {
  const [minX, minY, vbW, vbH] = baseViewBox.split(/\s+/).map(Number)
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1

  const tx = minX + (vbW - vbW * s) / 2
  const ty = minY + (vbH - vbH * s) / 2

  const defs = symbols.map((sy) => sy.symbolMarkup).join('\n')
  const uses = symbols.map((sy) => `<use href="#${sy.id}" x="0" y="0" width="${vbW}" height="${vbH}" />`).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="${baseViewBox}"
     preserveAspectRatio="xMidYMid meet">
  <defs>
    ${defs}
  </defs>
  <g transform="translate(${tx} ${ty}) scale(${s})">
    ${uses}
  </g>
</svg>`
}

export const createAvatar = async (
  bodyParts: UserSelectedBodyPartInput,
  manager: EntityManager,
): Promise<{ fileId: string; url: string; pngBuffer: Buffer }> => {
  const { url: spriteUrl } = await resolveLatestAvatarSpriteSvg()
  const svgText = await loadSpriteSvgText(spriteUrl)

  const headId = `ava-head_${bodyParts.headPartId}`
  const bodyId = `ava-clothes_${bodyParts.bodyPartId}`
  const emotionId = `ava-emotion_${bodyParts.emotionPartId}`

  const head = extractSymbol(svgText, headId)
  const body = extractSymbol(svgText, bodyId)
  const emotion = extractSymbol(svgText, emotionId)

  const baseViewBox = body.viewBox || head.viewBox || emotion.viewBox || '0 0 142 142'

  const composedSvg = composeAvatarSvgWithUse(baseViewBox, [
    { id: bodyId, symbolMarkup: body.symbolMarkup, vbW: body.vbW, vbH: body.vbH },
    { id: headId, symbolMarkup: head.symbolMarkup, vbW: head.vbW, vbH: head.vbH },
    { id: emotionId, symbolMarkup: emotion.symbolMarkup, vbW: emotion.vbW, vbH: emotion.vbH },
  ])

  const pngBuffer = await sharp(Buffer.from(composedSvg), { density: 300 })
    .resize(142, 142, { fit: 'contain' })
    .png()
    .toBuffer()

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
