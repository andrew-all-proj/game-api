import { BadRequestException } from '@nestjs/common'
import * as sharp from 'sharp'
import { FrameData, SpriteAtlas } from 'src/datatypes/common/SpriteAtlas'
import { SelectedPartsKey } from 'src/modules/monster/dto/monster.args'
import * as gameDb from 'game-db'
import config from 'src/config'
import { loadAtlasJson, loadSpriteSheetBuffer } from './SpriteSheetBuffer'
import * as fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { EntityManager } from 'typeorm'

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
  bodyX?: number
  bodyY?: number
  baseScale?: number
}

/**
 * Assembles a single PNG avatar (stay frame) and returns a Buffer and dimensions.
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
  options?: {
    // координаты/масштаб видовой сцены, НЕ размер выходного файла
    bodyX?: number // по умолчанию 0
    bodyY?: number // по умолчанию 145 (как на фронте)
    baseScale?: number // по умолчанию 0.16 (как на фронте)
  }
}): Promise<{ png: Buffer; width: number; height: number }> {
  const frames = atlasJson.frames
  if (!frames) throw new Error('Atlas frames not found')

  // Входные параметры сцены (не размеры итогового файла!)
  const bodyX = Math.round(options?.bodyX ?? 0)
  const bodyY = Math.round(options?.bodyY ?? 145)
  const scale = options?.baseScale ?? 0.16

  const bodyKey = getStayFrameKey(frames, selectedPartsKey.bodyKey)
  if (!bodyKey) throw new BadRequestException(`Stay frame not found for bodyKey=${selectedPartsKey.bodyKey}`)
  const headKey = selectedPartsKey.headKey ? getStayFrameKey(frames, selectedPartsKey.headKey) : null
  const leftKey = selectedPartsKey.leftArmKey ? getStayFrameKey(frames, selectedPartsKey.leftArmKey) : null
  const rightKey = selectedPartsKey.rightArmKey ? getStayFrameKey(frames, selectedPartsKey.rightArmKey) : null

  const bodyRec = frames[bodyKey] as FrameData
  const headRec = headKey ? (frames[headKey] as FrameData) : undefined
  const leftRec = leftKey ? (frames[leftKey] as FrameData) : undefined
  const rightRec = rightKey ? (frames[rightKey] as FrameData) : undefined

  const bodyF = bodyRec.frame
  const headF = headRec?.frame
  const leftF = leftRec?.frame
  const rightF = rightRec?.frame

  // точки крепления (координаты, НЕ размеры)
  const bodyPts = bodyRec.points || {}
  const headPts = headRec?.points || {}
  const leftPts = leftRec?.points || {}
  const rightPts = rightRec?.points || {}

  // сколько места «над телом» занимает голова (по точке крепления)
  const headHeightAbove = Math.round((headPts.attachToBody?.y ?? 0) * scale)

  // вырезаем тайлы строго по frame.w/h
  const [bodyBuf, headBuf, leftBuf, rightBuf] = await Promise.all([
    extractFrame(spriteSheetBuffer, bodyF),
    headF ? extractFrame(spriteSheetBuffer, headF) : Promise.resolve(null),
    leftF ? extractFrame(spriteSheetBuffer, leftF) : Promise.resolve(null),
    rightF ? extractFrame(spriteSheetBuffer, rightF) : Promise.resolve(null),
  ])

  // Слои + прямоугольники после масштабирования — чтобы посчитать баундинг
  type Placed = { input: Buffer; left: number; top: number; w: number; h: number }
  const placed: Placed[] = []

  // left arm
  if (leftBuf && leftF) {
    const w = Math.max(1, Math.round(leftF.w * scale))
    const h = Math.max(1, Math.round(leftF.h * scale))
    const x = bodyX + Math.round(((bodyPts.attachLeftArm?.x ?? 0) - (leftPts.attachToBody?.x ?? 0)) * scale)
    const y =
      bodyY + headHeightAbove + Math.round(((bodyPts.attachLeftArm?.y ?? 0) - (leftPts.attachToBody?.y ?? 0)) * scale)
    placed.push({ input: await sharp(leftBuf).resize(w, h).toBuffer(), left: x, top: y, w, h })
  }

  // body
  {
    const w = Math.max(1, Math.round(bodyF.w * scale))
    const h = Math.max(1, Math.round(bodyF.h * scale))
    const x = bodyX
    const y = bodyY + headHeightAbove
    placed.push({ input: await sharp(bodyBuf).resize(w, h).toBuffer(), left: x, top: y, w, h })
  }

  // head
  if (headBuf && headF) {
    const w = Math.max(1, Math.round(headF.w * scale))
    const h = Math.max(1, Math.round(headF.h * scale))
    const x = bodyX + Math.round(((bodyPts.attachToHead?.x ?? 0) - (headPts.attachToBody?.x ?? 0)) * scale)
    const y =
      bodyY + headHeightAbove + Math.round(((bodyPts.attachToHead?.y ?? 0) - (headPts.attachToBody?.y ?? 0)) * scale)
    placed.push({ input: await sharp(headBuf).resize(w, h).toBuffer(), left: x, top: y, w, h })
  }

  // right arm
  if (rightBuf && rightF) {
    const w = Math.max(1, Math.round(rightF.w * scale))
    const h = Math.max(1, Math.round(rightF.h * scale))
    const x = bodyX + Math.round(((bodyPts.attachRightArm?.x ?? 0) - (rightPts.attachToBody?.x ?? 0)) * scale)
    const y =
      bodyY + headHeightAbove + Math.round(((bodyPts.attachRightArm?.y ?? 0) - (rightPts.attachToBody?.y ?? 0)) * scale)
    placed.push({ input: await sharp(rightBuf).resize(w, h).toBuffer(), left: x, top: y, w, h })
  }

  // ---- только FrameRect: считаем баундинг по w/h каждого слоя ----
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const p of placed) {
    minX = Math.min(minX, p.left)
    minY = Math.min(minY, p.top)
    maxX = Math.max(maxX, p.left + p.w)
    maxY = Math.max(maxY, p.top + p.h)
  }

  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    throw new Error('Nothing to render: computed empty bounding box')
  }

  const outW = Math.max(1, Math.round(maxX - minX))
  const outH = Math.max(1, Math.round(maxY - minY))

  // нормализуем координаты в (0,0)
  const layers = placed.map<sharp.OverlayOptions>((p) => ({
    input: p.input,
    left: Math.round(p.left - minX),
    top: Math.round(p.top - minY),
  }))

  const canvas = sharp({
    create: {
      width: outW,
      height: outH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })

  const png = await canvas.composite(layers).png().toBuffer()
  return { png, width: outW, height: outH }
}

export const createAvatarMonster = async (
  selectedPartsKey: SelectedPartsKey,
  monsterId: string,
  manager: EntityManager,
  options?: AvatarOptions,
): Promise<{ fileId: string; url: string }> => {
  const files = await gameDb.Entities.File.find({
    where: { contentType: gameDb.datatypes.ContentTypeEnum.MAIN_SPRITE_SHEET_MONSTERS },
  })
  if (files.length === 0) throw new BadRequestException('Sprite sheet not found')

  const jsonFiles = files.filter((f) => f.fileType === gameDb.datatypes.FileTypeEnum.JSON)
  const imageFiles = files.filter((f) => f.fileType === gameDb.datatypes.FileTypeEnum.IMAGE)

  const atlasJson =
    jsonFiles.length === 1
      ? jsonFiles[0]
      : jsonFiles.reduce((max, item) => ((item.version ?? 0) > (max.version ?? 0) ? item : max))

  const spriteSheet =
    imageFiles.length === 1
      ? imageFiles[0]
      : imageFiles.reduce((max, item) => ((item.version ?? 0) > (max.version ?? 0) ? item : max))

  if (!atlasJson?.url || !spriteSheet?.url) {
    throw new BadRequestException('Invalid MAIN_SPRITE_SHEET_MONSTERS entries')
  }

  const atlasJsonFile = `${config.fileUploadDir}/${atlasJson.url}`
  const spriteSheetFile = `${config.fileUploadDir}/${spriteSheet.url}`

  const atlasJsonParsed = loadAtlasJson(atlasJsonFile)
  const spriteSheetBuffer = loadSpriteSheetBuffer(spriteSheetFile)

  const { png } = await renderMonsterAvatarPNG({
    atlasJson: atlasJsonParsed,
    spriteSheetBuffer,
    selectedPartsKey,
    options,
  })

  const imageId = uuidv4()
  const filePath = `${config.fileUploadDir}/${imageId}.png`
  await fs.promises.writeFile(filePath, png)

  await manager.save(
    gameDb.Entities.File.create({
      id: imageId,
      monsterId,
      fileType: gameDb.datatypes.FileTypeEnum.IMAGE,
      contentType: gameDb.datatypes.ContentTypeEnum.AVATAR_MONSTER,
      url: `${imageId}.png`,
    }),
  )

  return { fileId: imageId, url: `${imageId}.png` }
}
