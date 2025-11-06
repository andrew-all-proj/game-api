import { BadRequestException } from '@nestjs/common'
import * as sharp from 'sharp'
import { SpriteAtlas } from '../../../datatypes/common/SpriteAtlas'
import { SelectedPartsKey } from '../../monster/dto/monster.args'
import * as gameDb from 'game-db'
import config from '../../../config'
import { v4 as uuidv4 } from 'uuid'
import { EntityManager } from 'typeorm'
import { loadSpriteAssets } from '../../file/load-sprite-assets'

function getStayFrameKey(frames: SpriteAtlas['frames'], keyOrBase: string): string | null {
  if (frames[keyOrBase as keyof typeof frames]) return keyOrBase
  const stayIdx = keyOrBase.indexOf('/stay/')
  const base = stayIdx !== -1 ? keyOrBase.slice(0, stayIdx) : keyOrBase.replace(/\/[^/]+$/, '')
  const prefix = `${base}/stay/`
  const list = Object.keys(frames)
    .filter((n) => n.startsWith(prefix))
    .sort()
  return list[0] ?? null
}

async function extractFrame(buf: Buffer, f: { x: number; y: number; w: number; h: number }) {
  return sharp(buf).extract({ left: f.x, top: f.y, width: f.w, height: f.h }).png().toBuffer()
}

type AvatarOptions = {
  width?: number
  height?: number
  baseScale?: number
}

/**
 * Склеивает слои монстра по центру без точек крепления
 */
export async function renderMonsterAvatarPNG({
  atlasJson,
  spriteSheetBuffer,
  selectedPartsKey,
  options,
}: {
  atlasJson: SpriteAtlas
  spriteSheetBuffer: Buffer
  selectedPartsKey: SelectedPartsKey
  options?: AvatarOptions
}): Promise<{ pngBuffer: Buffer; width: number; height: number }> {
  const frames = atlasJson.frames
  if (!frames) throw new Error('Atlas frames not found')

  const scale = options?.baseScale ?? 1

  const bodyKey = getStayFrameKey(frames, selectedPartsKey.bodyKey)
  if (!bodyKey) throw new BadRequestException(`Stay frame not found for bodyKey=${selectedPartsKey.bodyKey}`)
  const headKey = selectedPartsKey.headKey ? getStayFrameKey(frames, selectedPartsKey.headKey) : null
  const leftKey = selectedPartsKey.leftArmKey ? getStayFrameKey(frames, selectedPartsKey.leftArmKey) : null
  const rightKey = selectedPartsKey.rightArmKey ? getStayFrameKey(frames, selectedPartsKey.rightArmKey) : null

  const frameKeys = [rightKey, bodyKey, headKey, leftKey].filter(Boolean) as string[]

  // Вырезаем кадры
  const buffers = await Promise.all(frameKeys.map((key) => extractFrame(spriteSheetBuffer, frames[key].frame)))

  // Преобразуем в массив слоёв с размерами
  const layers = await Promise.all(
    buffers.map(async (buf, i) => {
      const f = frames[frameKeys[i]].frame
      const w = Math.max(1, Math.round(f.w * scale))
      const h = Math.max(1, Math.round(f.h * scale))
      const resized = await sharp(buf).resize(w, h).toBuffer()
      return { input: resized, w, h }
    }),
  )

  // Определяем максимальные размеры холста
  const maxW = Math.max(...layers.map((l) => l.w))
  const maxH = Math.max(...layers.map((l) => l.h))

  const outW = options?.width ?? maxW
  const outH = options?.height ?? maxH

  // Центрируем все части
  const compositeLayers = layers.map((l) => ({
    input: l.input,
    left: Math.round((outW - l.w) / 2),
    top: Math.round((outH - l.h) / 2),
  }))

  const canvas = sharp({
    create: {
      width: outW,
      height: outH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })

  const pngBuffer = await canvas.composite(compositeLayers).png().toBuffer()
  return { pngBuffer, width: outW, height: outH }
}

export const createAvatarMonster = async (
  selectedPartsKey: SelectedPartsKey,
  monsterId: string,
  manager: EntityManager,
  options?: AvatarOptions,
): Promise<{ fileId: string; url: string; pngBuffer: Buffer }> => {
  const { atlasJson, spriteSheet } = await loadSpriteAssets(gameDb.datatypes.ContentTypeEnum.BASE_SPRITE_SHEET_MONSTERS)

  const { pngBuffer } = await renderMonsterAvatarPNG({
    atlasJson: atlasJson,
    spriteSheetBuffer: spriteSheet,
    selectedPartsKey,
    options,
  })

  const imageId = uuidv4()
  const url = `${config.s3.prefix}/${imageId}.png`

  await manager.save(
    gameDb.Entities.File.create({
      id: imageId,
      monsterId,
      fileType: gameDb.datatypes.FileTypeEnum.IMAGE,
      contentType: gameDb.datatypes.ContentTypeEnum.AVATAR_MONSTER,
      url,
    }),
  )

  return { fileId: imageId, url, pngBuffer }
}
