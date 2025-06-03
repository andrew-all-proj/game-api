interface FrameRect {
  x: number
  y: number
  w: number
  h: number
}

export interface AttachmentPoint {
  x: number
  y: number
}

export interface AttachmentPointPart {
  attachToBody?: AttachmentPoint
  attachToHead?: AttachmentPoint
  attachLeftArm?: AttachmentPoint
  attachRightArm?: AttachmentPoint
}

export interface FrameData {
  frame: FrameRect
  points: AttachmentPointPart
}

export interface SpriteAtlas {
  frames: Record<string, FrameData>
  meta: {
    image: string
    size: { w: number; h: number }
    scale: string
    date: string
  }
}
