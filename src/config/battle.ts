export const DEFAULT_TURN_MS = 15_000
export const DEFAULT_GRACE_MS = 250
export const SATIETY_COST = 25
export const MAX_MISSED_TURNS = 3
export const FIRST_TURN_EXTRA_MS = 15_000
export const PASS_GAIN = 3
export const TTL_BATTLE = 180
export const REWARD_CONFIG = {
  food: { chance: 1.0, min: 1, max: 2 }, // как сейчас: еда всегда, 1–2 шт
  mutagen: { chance: 1.0, min: 1, max: 1 }, // 25% шанс, 1 ед.
  skill: { chance: 1.0, min: 1, max: 1 }, // 10% шанс дать скилл
}
