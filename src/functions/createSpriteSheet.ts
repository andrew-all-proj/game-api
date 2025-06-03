import * as fs from 'fs'
import * as sharp from 'sharp'
import { FrameData, SpriteAtlas } from '../datatypes/common/SpriteAtlas'
import { BadRequestException } from '@nestjs/common'
import { SelectedPartsKey } from '../modules/monster/dto/monster.args'
import * as gameDb from 'game-db'
import config from '../config'
import { v4 as uuidv4 } from 'uuid'

export async function createCustomSpriteSheet({
  atlasJson,
  spriteSheetBuffer,
  selectedPartsKey,
  monsterId,
}: {
  atlasJson: SpriteAtlas
  spriteSheetBuffer: Buffer
  selectedPartsKey: SelectedPartsKey
  monsterId: string
}) {
  // filter parts
  const framesToInclude = Object.entries(atlasJson.frames).filter(
    ([key]) =>
      key.startsWith(selectedPartsKey.bodyKey.split('/stay/')[0]) ||
      key.startsWith(selectedPartsKey.headKey.split('/stay/')[0]) ||
      key.startsWith(selectedPartsKey.leftArmKey.split('/stay/')[0]) ||
      (selectedPartsKey.rightArmKey && key.startsWith(selectedPartsKey.rightArmKey.split('/stay/')[0])),
  )

  // group animation
  const groupedByAnimation: Record<
    string,
    {
      body: [string, FrameData][]
      head: [string, FrameData][]
      leftArm: [string, FrameData][]
      rightArm: [string, FrameData][]
    }
  > = {}

  for (const [key, frameData] of framesToInclude) {
    const parts = key.split('/') // [body, body_2, stay, body_2_0]
    const partType = parts[0] // body, head, left_arm, right_arm
    const animationType = parts[2] // stay, hit, etc.

    if (!groupedByAnimation[animationType]) {
      groupedByAnimation[animationType] = {
        body: [],
        head: [],
        leftArm: [],
        rightArm: [],
      }
    }

    if (partType === 'body') {
      groupedByAnimation[animationType].body.push([key, frameData])
    } else if (partType === 'head') {
      groupedByAnimation[animationType].head.push([key, frameData])
    } else if (partType === 'left_arm') {
      groupedByAnimation[animationType].leftArm.push([key, frameData])
    } else if (partType === 'right_arm') {
      groupedByAnimation[animationType].rightArm.push([key, frameData])
    }
  }

  const layers: { input: Buffer; left: number; top: number }[] = []
  let totalWidth = 0
  let totalHeight = 0

  const atlasFrames: Record<string, { frame: { x: number; y: number; w: number; h: number } }> = {}

  for (const animation in groupedByAnimation) {
    let rowWidth = 0
    let rowHeight = 0

    const bodyFrames = groupedByAnimation[animation].body
    const headFrames = groupedByAnimation[animation].head
    const leftArmFrames = groupedByAnimation[animation].leftArm
    const rightArmFrames = groupedByAnimation[animation].rightArm

    for (let i = 0; i < bodyFrames.length; i++) {
      const bodyFrame = bodyFrames[i][1].frame
      const bodyPoints = bodyFrames[i][1].points

      const headFrame = headFrames?.[i]?.[1]?.frame
      const headPoints = headFrames?.[i]?.[1]?.points

      const leftArmFrame = leftArmFrames?.[i]?.[1]?.frame
      const leftArmPoints = leftArmFrames?.[i]?.[1]?.points

      const rightArmFrame = rightArmFrames?.[i]?.[1]?.frame
      const rightArmPoints = rightArmFrames?.[i]?.[1]?.points

      const baseSharp = sharp(spriteSheetBuffer)

      const bodyPromise = baseSharp
        .clone()
        .extract({
          left: bodyFrame.x,
          top: bodyFrame.y,
          width: bodyFrame.w,
          height: bodyFrame.h,
        })
        .toBuffer()

      const headPromise = headFrame
        ? baseSharp
            .clone()
            .extract({
              left: headFrame.x,
              top: headFrame.y,
              width: headFrame.w,
              height: headFrame.h,
            })
            .toBuffer()
        : Promise.resolve(null)

      const leftArmPromise = leftArmFrame
        ? baseSharp
            .clone()
            .extract({
              left: leftArmFrame.x,
              top: leftArmFrame.y,
              width: leftArmFrame.w,
              height: leftArmFrame.h,
            })
            .toBuffer()
        : Promise.resolve(null)

      const rightArmPromise = rightArmFrame
        ? baseSharp
            .clone()
            .extract({
              left: rightArmFrame.x,
              top: rightArmFrame.y,
              width: rightArmFrame.w,
              height: rightArmFrame.h,
            })
            .toBuffer()
        : Promise.resolve(null)

      const [bodyBuffer, headBuffer, leftArmBuffer, rightArmBuffer] = await Promise.all([
        bodyPromise,
        headPromise,
        leftArmPromise,
        rightArmPromise,
      ])

      const headHeightAbove = headPoints?.attachToBody?.y ?? 0

      const offsetX = rowWidth
      const offsetY = totalHeight

      if (leftArmBuffer) {
        const leftArmOffsetX = offsetX + (bodyPoints?.attachLeftArm?.x ?? 0) - (leftArmPoints?.attachToBody?.x ?? 0)
        const leftArmOffsetY =
          offsetY + headHeightAbove + (bodyPoints?.attachLeftArm?.y ?? 0) - (leftArmPoints?.attachToBody?.y ?? 0)
        layers.push({
          input: leftArmBuffer,
          left: leftArmOffsetX,
          top: leftArmOffsetY,
        })
      }

      layers.push({
        input: bodyBuffer,
        left: offsetX,
        top: offsetY + headHeightAbove,
      })

      if (headBuffer) {
        const headOffsetX = offsetX + (bodyPoints?.attachToHead?.x ?? 0) - (headPoints?.attachToBody?.x ?? 0)
        const headOffsetY =
          offsetY + headHeightAbove + (bodyPoints?.attachToHead?.y ?? 0) - (headPoints?.attachToBody?.y ?? 0)
        layers.push({
          input: headBuffer,
          left: headOffsetX,
          top: headOffsetY,
        })
      }

      if (rightArmBuffer) {
        const rightArmOffsetX = offsetX + (bodyPoints?.attachRightArm?.x ?? 0) - (rightArmPoints?.attachToBody?.x ?? 0)
        const rightArmOffsetY =
          offsetY + headHeightAbove + (bodyPoints?.attachRightArm?.y ?? 0) - (rightArmPoints?.attachToBody?.y ?? 0)
        layers.push({
          input: rightArmBuffer,
          left: rightArmOffsetX,
          top: rightArmOffsetY,
        })
      }

      const bodyRightEdge = rowWidth + bodyFrame.w

      const headRightEdge = headBuffer
        ? rowWidth + (bodyPoints?.attachToHead?.x ?? 0) - (headPoints?.attachToBody?.x ?? 0) + headFrame.w
        : 0

      const leftArmRightEdge = leftArmBuffer
        ? offsetX + (bodyPoints?.attachLeftArm?.x ?? 0) + leftArmFrame.w - (leftArmPoints?.attachToBody?.x ?? 0)
        : 0

      const rightArmRightEdge = rightArmBuffer
        ? offsetX + (bodyPoints?.attachRightArm?.x ?? 0) - (rightArmPoints?.attachToBody?.x ?? 0) + rightArmFrame.w
        : 0

      const frameWidth = Math.max(bodyRightEdge, headRightEdge, leftArmRightEdge, rightArmRightEdge) - offsetX

      const frameHeight = bodyFrame.h + headFrame.h - (headFrame.h - headHeightAbove)

      const key = `${animation}_${i}`
      atlasFrames[key] = { frame: { x: rowWidth, y: totalHeight, w: frameWidth, h: frameHeight } }

      rowWidth += frameWidth
      rowHeight = frameHeight
    }
    totalWidth = Math.max(totalWidth, rowWidth)
    totalHeight += rowHeight
  }

  if (totalWidth === 0 || totalHeight === 0) {
    throw new Error(`❌ totalWidth (${totalWidth}) or totalHeight (${totalHeight}) is zero! Check frame calculations.`)
  }

  const finalImage = sharp({
    create: {
      width: totalWidth,
      height: totalHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
  const imageId = uuidv4()

  await gameDb.Entities.File.create({
    id: imageId,
    monsterId: monsterId,
    fileType: gameDb.datatypes.FileTypeEnum.IMAGE,
    contentType: gameDb.datatypes.ContentTypeEnum.SPRITE_SHEET_MONSTER,
    url: `${imageId}.png`,
  }).save()

  const atlasJsonData = {
    frames: atlasFrames,
    meta: {
      image: `${imageId}.png`,
      size: { w: totalWidth, h: totalHeight },
      scale: '1',
      date: new Date().toISOString(),
    },
  }

  const atlasId = uuidv4()
  const atlasPath = `${config.fileUploadDir}/${atlasId}.json`

  await Promise.all([
    finalImage.composite(layers).png().toFile(`${config.fileUploadDir}/${imageId}.png`),
    fs.promises.writeFile(atlasPath, JSON.stringify(atlasJsonData, null, 2)),
  ])

  await gameDb.Entities.File.create({
    id: atlasId,
    monsterId: monsterId,
    fileType: gameDb.datatypes.FileTypeEnum.JSON,
    contentType: gameDb.datatypes.ContentTypeEnum.SPRITE_SHEET_MONSTER,
    url: `${atlasId}.json`,
  }).save()
}

const globalCache = {
  atlasJsonParsed: null, // SpriteAtlas | null
  spriteSheetBuffer: null as Buffer | null, // Buffer | null
  lastLoaded: null as Date | null, // Date | null
}

function loadAtlasJson(atlasJsonFile: string) {
  if (!globalCache.atlasJsonParsed) {
    const content = fs.readFileSync(atlasJsonFile, 'utf-8')
    globalCache.atlasJsonParsed = JSON.parse(content)
    globalCache.lastLoaded = new Date()
  }
  if (!globalCache.atlasJsonParsed) {
    throw new Error('Atlas JSON is not loaded')
  }
  return globalCache.atlasJsonParsed
}

function loadSpriteSheetBuffer(spriteSheetFile: string) {
  if (!globalCache.spriteSheetBuffer) {
    globalCache.spriteSheetBuffer = fs.readFileSync(spriteSheetFile)
  }
  if (!globalCache.spriteSheetBuffer) {
    throw new Error('SpriteSheet buffer is not loaded')
  }
  return globalCache.spriteSheetBuffer
}

export const createSpriteSheetMonster = async (selectedPartsKey, monsterId) => {
  const files = await gameDb.Entities.File.find({
    where: { contentType: gameDb.datatypes.ContentTypeEnum.MAIN_SPRITE_SHEET_MONSTERS },
  })

  if (files.length === 0) {
    throw new BadRequestException('Sprite sheet not found')
  }

  // JSON max version
  const jsonFiles = files.filter((file) => file.fileType === gameDb.datatypes.FileTypeEnum.JSON)
  const atlasJson =
    jsonFiles.length === 1
      ? jsonFiles[0]
      : jsonFiles.reduce((max, item) => ((item.version ?? 0) > (max.version ?? 0) ? item : max))

  // IMAGE max version
  const imageFiles = files.filter((file) => file.fileType === gameDb.datatypes.FileTypeEnum.IMAGE)
  const spriteSheet =
    imageFiles.length === 1
      ? imageFiles[0]
      : imageFiles.reduce((max, item) => ((item.version ?? 0) > (max.version ?? 0) ? item : max))

  if (!atlasJson || !atlasJson.id || !spriteSheet || !spriteSheet.id) {
    return false
  }

  const atlasJsonFile = `${config.fileUploadDir}/${atlasJson.url}`
  const spriteSheetFile = `${config.fileUploadDir}/${spriteSheet.url}`

  const atlasJsonParsed = loadAtlasJson(atlasJsonFile)
  const spriteSheetBuffer = loadSpriteSheetBuffer(spriteSheetFile)

  await createCustomSpriteSheet({
    atlasJson: atlasJsonParsed,
    spriteSheetBuffer: spriteSheetBuffer,
    selectedPartsKey,
    monsterId: monsterId,
  })

  return false
}
