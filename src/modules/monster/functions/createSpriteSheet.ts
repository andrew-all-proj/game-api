import * as sharp from 'sharp'
import { FrameData, SpriteAtlas } from '../../../datatypes/common/SpriteAtlas'
import { SelectedPartsKey } from '../../monster/dto/monster.args'
import * as gameDb from 'game-db'
import config from '../../../config'
import { v4 as uuidv4 } from 'uuid'
import { EntityManager } from 'typeorm'
import { loadSpriteAssets } from '../../file/load-sprite-assets'

export async function createCustomSpriteSheet({
  atlasJson,
  spriteSheetBuffer,
  selectedPartsKey,
}: {
  atlasJson: SpriteAtlas
  spriteSheetBuffer: Buffer
  selectedPartsKey: SelectedPartsKey
  monsterId: string
}): Promise<{
  imageId: string
  atlasId: string
  pngBuffer: Buffer
  atlasJsonBuffer: Buffer
}> {
  //
  // 1. Отфильтровать только те кадры, которые относятся к выбранным частям монстра
  //
  const framesToInclude = Object.entries(atlasJson.frames).filter(([key]) => {
    // Берём базовую часть до "/stay/" — это твоя логика принадлежности к конкретному варианту внешности
    const bodyBase = selectedPartsKey.bodyKey.split('/stay/')[0]
    const headBase = selectedPartsKey.headKey.split('/stay/')[0]
    const leftBase = selectedPartsKey.leftArmKey.split('/stay/')[0]
    const rightBase = selectedPartsKey.rightArmKey ? selectedPartsKey.rightArmKey.split('/stay/')[0] : null

    return (
      key.startsWith(bodyBase) ||
      key.startsWith(headBase) ||
      key.startsWith(leftBase) ||
      (rightBase ? key.startsWith(rightBase) : false)
    )
  })

  //
  // 2. Сгруппировать по анимации и по типу части
  //
  // ожидаемый ключ формата:
  //   body/body_2/stay/body_2_0
  // где:
  //   [0] = тип части "body" | "head" | "left_arm" | "right_arm"
  //   [2] = тип анимации "stay" | "hit" | ...
  //
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
    const parts = key.split('/') // ['body','body_2','stay','body_2_0']
    const partType = parts[0] // body, head, left_arm, right_arm
    const animationType = parts[2] // stay, hit, walk, ...

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

  //
  // 3. Теперь собираем конечный спрайт
  //
  // Мы будем выкладывать анимации построчно:
  //  - каждая анимация => одна строка
  //  - кадры анимации идут слева направо в этой строке
  //
  // Для кадра:
  //  - достаём body/head/left/right
  //  - для каждого из них вырезаем bitmap из исходного spriteSheetBuffer
  //
  const layers: { input: Buffer; left: number; top: number }[] = []

  let totalWidth = 0
  let totalHeight = 0

  // atlasFrames: итоговый json-атлас для нового спрайта
  const atlasFrames: Record<string, { frame: { x: number; y: number; w: number; h: number } }> = {}

  for (const animation of Object.keys(groupedByAnimation)) {
    // координаты текущей "строки"
    let rowWidth = 0
    let rowHeight = 0

    const bodyFrames = groupedByAnimation[animation].body
    const headFrames = groupedByAnimation[animation].head
    const leftArmFrames = groupedByAnimation[animation].leftArm
    const rightArmFrames = groupedByAnimation[animation].rightArm

    // считаем, что количество кадров определяется телом (bodyFrames.length)
    for (let i = 0; i < bodyFrames.length; i++) {
      const bodyFrameData = bodyFrames[i][1]
      const bodyRect = bodyFrameData.frame

      const headRect = headFrames?.[i]?.[1]?.frame
      const leftRect = leftArmFrames?.[i]?.[1]?.frame
      const rightRect = rightArmFrames?.[i]?.[1]?.frame

      // берём исходные куски
      const baseSharp = sharp(spriteSheetBuffer)

      const bodyBufPromise = baseSharp
        .clone()
        .extract({
          left: bodyRect.x,
          top: bodyRect.y,
          width: bodyRect.w,
          height: bodyRect.h,
        })
        .toBuffer()

      const headBufPromise = headRect
        ? baseSharp
            .clone()
            .extract({
              left: headRect.x,
              top: headRect.y,
              width: headRect.w,
              height: headRect.h,
            })
            .toBuffer()
        : Promise.resolve<Buffer | null>(null)

      const leftBufPromise = leftRect
        ? baseSharp
            .clone()
            .extract({
              left: leftRect.x,
              top: leftRect.y,
              width: leftRect.w,
              height: leftRect.h,
            })
            .toBuffer()
        : Promise.resolve<Buffer | null>(null)

      const rightBufPromise = rightRect
        ? baseSharp
            .clone()
            .extract({
              left: rightRect.x,
              top: rightRect.y,
              width: rightRect.w,
              height: rightRect.h,
            })
            .toBuffer()
        : Promise.resolve<Buffer | null>(null)

      const [bodyBuf, headBuf, leftBuf, rightBuf] = await Promise.all([
        bodyBufPromise,
        headBufPromise,
        leftBufPromise,
        rightBufPromise,
      ])

      // база позиционирования = тело
      // тело кладём в (offsetX, offsetY)
      // всё остальное центрируем на тело:
      //
      // центр тела:
      //    cxBody = offsetX + bodyRect.w / 2
      //    cyBody = offsetY + bodyRect.h / 2
      //
      // для каждого слоя partRect:
      //    left = cxBody - partRect.w / 2
      //    top  = cyBody - partRect.h / 2
      //
      // порядок наложения слоёв:
      //   1. тело
      //   2. левая рука
      //   3. правая рука
      //   4. голова
      //
      // (можно менять порядок if нужно визуально)
      //
      const offsetX = rowWidth
      const offsetY = totalHeight

      const cxBody = offsetX + bodyRect.w / 2
      const cyBody = offsetY + bodyRect.h / 2

      // тело (body) — кладём чётко по offsetX/offsetY
      if (bodyBuf) {
        layers.push({
          input: bodyBuf,
          left: offsetX,
          top: offsetY,
        })
      }

      // левая рука
      if (leftBuf && leftRect) {
        const leftX = Math.round(cxBody - leftRect.w / 2)
        const leftY = Math.round(cyBody - leftRect.h / 2)
        layers.push({
          input: leftBuf,
          left: leftX,
          top: leftY,
        })
      }

      // правая рука
      if (rightBuf && rightRect) {
        const rightX = Math.round(cxBody - rightRect.w / 2)
        const rightY = Math.round(cyBody - rightRect.h / 2)
        layers.push({
          input: rightBuf,
          left: rightX,
          top: rightY,
        })
      }

      // голова
      if (headBuf && headRect) {
        const headX = Math.round(cxBody - headRect.w / 2)
        const headY = Math.round(cyBody - headRect.h / 2)
        layers.push({
          input: headBuf,
          left: headX,
          top: headY,
        })
      }

      // теперь нам нужно посчитать габариты ИТОГОВОГО кадра
      // он должен включать всё, что мы положили в этом кадре
      //
      // давай соберём bbox (minX, minY, maxX, maxY) с учётом всех частей
      let minX = offsetX
      let minY = offsetY
      let maxX = offsetX + bodyRect.w
      let maxY = offsetY + bodyRect.h

      if (leftRect) {
        const leftX = Math.round(cxBody - leftRect.w / 2)
        const leftY = Math.round(cyBody - leftRect.h / 2)
        minX = Math.min(minX, leftX)
        minY = Math.min(minY, leftY)
        maxX = Math.max(maxX, leftX + leftRect.w)
        maxY = Math.max(maxY, leftY + leftRect.h)
      }

      if (rightRect) {
        const rightX = Math.round(cxBody - rightRect.w / 2)
        const rightY = Math.round(cyBody - rightRect.h / 2)
        minX = Math.min(minX, rightX)
        minY = Math.min(minY, rightY)
        maxX = Math.max(maxX, rightX + rightRect.w)
        maxY = Math.max(maxY, rightY + rightRect.h)
      }

      if (headRect) {
        const headX = Math.round(cxBody - headRect.w / 2)
        const headY = Math.round(cyBody - headRect.h / 2)
        minX = Math.min(minX, headX)
        minY = Math.min(minY, headY)
        maxX = Math.max(maxX, headX + headRect.w)
        maxY = Math.max(maxY, headY + headRect.h)
      }

      const frameW = maxX - offsetX
      const frameH = maxY - offsetY

      // сохраняем инфу в итоговый атлас
      // ключи можно оставить такими же: `${animation}_${i}`
      atlasFrames[`${animation}_${i}`] = {
        frame: {
          x: rowWidth,
          y: totalHeight,
          w: frameW,
          h: frameH,
        },
      }

      // увеличиваем ширину строки на ширину текущего кадра
      rowWidth += frameW
      // высота строки — макс. от всех кадров
      rowHeight = Math.max(rowHeight, frameH)
    }

    // после всех кадров этой анимации:
    totalWidth = Math.max(totalWidth, rowWidth)
    totalHeight += rowHeight
  }

  if (totalWidth === 0 || totalHeight === 0) {
    throw new Error(`totalWidth (${totalWidth}) or totalHeight (${totalHeight}) is zero! Check frame calculations.`)
  }

  // соберём итоговое изображение
  const finalImage = sharp({
    create: {
      width: totalWidth,
      height: totalHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })

  const imageId = uuidv4()
  const atlasId = uuidv4()

  const atlasJsonData = {
    frames: atlasFrames,
    meta: {
      image: `${imageId}.png`,
      size: { w: totalWidth, h: totalHeight },
      scale: '1',
      date: new Date().toISOString(),
    },
  }

  // композитим все собранные слои на прозрачный канвас
  const pngBuffer = await finalImage.composite(layers).png().toBuffer()

  const atlasJsonBuffer = Buffer.from(JSON.stringify(atlasJsonData, null, 2), 'utf8')

  return { imageId, atlasId, pngBuffer, atlasJsonBuffer }
}

export const createSpriteSheetMonster = async (
  selectedPartsKey: SelectedPartsKey,
  monsterId: string,
  manager: EntityManager,
): Promise<{
  fileId: string
  pngBuffer: Buffer
  atlasId: string
  atlasJsonBuffer: Buffer
  imageUrl: string
  atlasUrl: string
}> => {
  const { atlasJson, spriteSheet } = await loadSpriteAssets(gameDb.datatypes.ContentTypeEnum.MAIN_SPRITE_SHEET_MONSTERS)

  const { imageId, atlasId, pngBuffer, atlasJsonBuffer } = await createCustomSpriteSheet({
    atlasJson,
    spriteSheetBuffer: spriteSheet,
    selectedPartsKey,
    monsterId,
  })

  const imageUrl = `${config.s3.prefix}/${imageId}.png`
  const atlasUrl = `${config.s3.prefix}/${atlasId}.json`

  await manager.save(
    gameDb.Entities.File.create({
      id: imageId,
      monsterId,
      fileType: gameDb.datatypes.FileTypeEnum.IMAGE,
      contentType: gameDb.datatypes.ContentTypeEnum.SPRITE_SHEET_MONSTER,
      url: imageUrl,
    }),
  )

  await manager.save(
    gameDb.Entities.File.create({
      id: atlasId,
      monsterId,
      fileType: gameDb.datatypes.FileTypeEnum.JSON,
      contentType: gameDb.datatypes.ContentTypeEnum.SPRITE_SHEET_MONSTER,
      url: atlasUrl,
    }),
  )

  return {
    fileId: imageId,
    pngBuffer,
    atlasId,
    atlasJsonBuffer,
    imageUrl,
    atlasUrl,
  }
}
