import { SpriteAtlas } from '../datatypes/common/SpriteAtlas'
import * as fs from 'fs'

interface GlobalCache {
  atlasJsonParsed: SpriteAtlas | null
  spriteSheetBuffer: Buffer | null
  lastLoaded: Date | null
}

const globalCache: GlobalCache = {
  atlasJsonParsed: null,
  spriteSheetBuffer: null,
  lastLoaded: null,
}

export function loadAtlasJson(atlasJsonFile: string): SpriteAtlas {
  if (!globalCache.atlasJsonParsed) {
    const content = fs.readFileSync(atlasJsonFile, 'utf-8')
    globalCache.atlasJsonParsed = JSON.parse(content) as SpriteAtlas
    globalCache.lastLoaded = new Date()
  }
  if (!globalCache.atlasJsonParsed) {
    throw new Error('Atlas JSON is not loaded')
  }
  return globalCache.atlasJsonParsed
}

export function loadSpriteSheetBuffer(spriteSheetFile: string): Buffer {
  if (!globalCache.spriteSheetBuffer) {
    globalCache.spriteSheetBuffer = fs.readFileSync(spriteSheetFile)
  }
  if (!globalCache.spriteSheetBuffer) {
    throw new Error('SpriteSheet buffer is not loaded')
  }
  return globalCache.spriteSheetBuffer
}
