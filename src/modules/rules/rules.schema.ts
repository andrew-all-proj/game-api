import { z } from 'zod'
import * as db from 'game-db'

export const RewardItemType = z.enum(db.datatypes.UserInventoryTypeEnum)
export type RewardItemType = z.infer<typeof RewardItemType>

const RewardRangeSchema = z
  .object({
    min: z.number().int().nonnegative(),
    max: z.number().int().nonnegative(),
  })
  .refine((o) => o.max >= o.min, { message: 'reward.range: max must be >= min' })

const RewardEntrySchema = z.object({
  type: RewardItemType,
  chance: z.number().min(0).max(1),
  range: RewardRangeSchema,
})
export type RewardEntry = z.infer<typeof RewardEntrySchema>

const LevelRangeSchema = z
  .object({
    min: z.number().int().positive(),
    max: z.number().int().positive(),
  })
  .refine((o) => o.max >= o.min, { message: 'level.max must be >= level.min' })

const LevelRewardRuleSchema = z.object({
  level: LevelRangeSchema,
  rewards: z.array(RewardEntrySchema).min(1),
})
export type LevelRewardRule = z.infer<typeof LevelRewardRuleSchema>

const BattleSchema = z.object({
  maxTurnsMs: z.number().positive().default(15000),
  graceMs: z.number().nonnegative().default(0.25),
  firstTurnExtraSec: z.number().nonnegative().default(15),
  passGain: z.number().int().nonnegative().default(3),
  ttlBattleSec: z.number().int().positive().default(180),
  satietyCostStartBattle: z.number().int().nonnegative().default(25),
  maxMissedTurns: z.number().int().nonnegative().default(5),
})

const BattleExpRewardsSchema = z.object({
  winExp: z.number().int().nonnegative(),
  loseExp: z.number().int().nonnegative(),
})

const RewardSchema = z
  .object({
    battleExpRewards: BattleExpRewardsSchema,
    levels: z.array(LevelRewardRuleSchema).nonempty(),
  })
  .superRefine((val, ctx) => {
    const sorted = [...val.levels].sort((a, b) => a.level.min - b.level.min)
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1].level
      const cur = sorted[i].level
      if (cur.min <= prev.max) {
        ctx.addIssue({
          code: 'custom',
          message: `Overlapping reward level ranges: [${prev.min},${prev.max}] overlaps [${cur.min},${cur.max}]`,
          path: ['levels', i, 'level'],
        })
      }
    }
  })

export const FoodRequestSchema = z.object({
  quantityFood: z.number().int().positive(),
  periodHours: z.number().int().positive(),
})

export type FoodRequest = z.infer<typeof FoodRequestSchema>

const BaseMonsterStatsSchema = z.object({
  healthPoints: z.number().int().positive(),
  stamina: z.number().int().nonnegative(),
  strength: z.number().int().nonnegative(),
  defense: z.number().int().nonnegative(),
  evasion: z.number().int().nonnegative(),
  experiencePoints: z.number().int().nonnegative(),
  level: z.number().int().positive(),
  satiety: z.number().int().nonnegative(),
})

const MonsterLevelRowSchema = z.object({
  level: z.number().int().positive(),
  exp: z.number().int().nonnegative(),
  modifier: z.number().positive(),
})

const MonsterStartingStatsSchema = z
  .object({
    monster: BaseMonsterStatsSchema,
    costToCreateMonster: z.number().int().nonnegative(),
    monsterLevels: z.array(MonsterLevelRowSchema).nonempty(),
  })
  .superRefine((val, ctx) => {
    const rows = [...val.monsterLevels].sort((a, b) => a.level - b.level)
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].level <= rows[i - 1].level) {
        ctx.addIssue({
          code: 'custom',
          message: 'monsterLevels.level must strictly increase',
          path: ['monsterLevels', i, 'level'],
        })
      }
      if (rows[i].exp < rows[i - 1].exp) {
        ctx.addIssue({
          code: 'custom',
          message: 'monsterLevels.exp must be non-decreasing',
          path: ['monsterLevels', i, 'exp'],
        })
      }
    }
  })

export const RulesSchema = z.object({
  version: z.string().min(1), // "1.0.0"
  battle: BattleSchema,
  reward: RewardSchema,
  monsterStartingStats: MonsterStartingStatsSchema,
  foodRequest: FoodRequestSchema,
})

export type Rules = z.infer<typeof RulesSchema>
export type Reward = z.infer<typeof RewardSchema>

export const DefaultRules: Rules = {
  version: '1.0.0',
  battle: {
    maxTurnsMs: 15000,
    graceMs: 250,
    firstTurnExtraSec: 15,
    passGain: 3,
    ttlBattleSec: 180,
    satietyCostStartBattle: 25,
    maxMissedTurns: 5,
  },
  reward: {
    battleExpRewards: { winExp: 30, loseExp: 15 },
    levels: [
      {
        level: { min: 1, max: 5 },
        rewards: [
          { type: db.datatypes.UserInventoryTypeEnum.FOOD, chance: 1.0, range: { min: 1, max: 2 } },
          { type: db.datatypes.UserInventoryTypeEnum.MUTAGEN, chance: 0.25, range: { min: 1, max: 1 } },
          { type: db.datatypes.UserInventoryTypeEnum.SKILL, chance: 0.1, range: { min: 1, max: 1 } },
        ],
      },
      {
        level: { min: 6, max: 10 },
        rewards: [
          { type: db.datatypes.UserInventoryTypeEnum.FOOD, chance: 1.0, range: { min: 2, max: 3 } },
          { type: db.datatypes.UserInventoryTypeEnum.MUTAGEN, chance: 0.35, range: { min: 1, max: 1 } },
          { type: db.datatypes.UserInventoryTypeEnum.SKILL, chance: 0.15, range: { min: 1, max: 1 } },
        ],
      },
      {
        level: { min: 11, max: 20 },
        rewards: [
          { type: db.datatypes.UserInventoryTypeEnum.FOOD, chance: 1.0, range: { min: 3, max: 3 } },
          { type: db.datatypes.UserInventoryTypeEnum.MUTAGEN, chance: 0.5, range: { min: 1, max: 2 } },
          { type: db.datatypes.UserInventoryTypeEnum.SKILL, chance: 0.25, range: { min: 1, max: 1 } },
        ],
      },
    ],
  },
  monsterStartingStats: {
    monster: {
      healthPoints: 100,
      stamina: 6,
      strength: 12,
      defense: 10,
      evasion: 5,
      experiencePoints: 0,
      level: 1,
      satiety: 50,
    },
    costToCreateMonster: 250,
    monsterLevels: [
      { level: 1, exp: 0, modifier: 1.0 },
      { level: 2, exp: 30, modifier: 1.15 },
      { level: 3, exp: 60, modifier: 1.3 },
      { level: 4, exp: 100, modifier: 1.45 },
      { level: 5, exp: 150, modifier: 1.6 },
      { level: 6, exp: 210, modifier: 1.75 },
      { level: 7, exp: 280, modifier: 1.9 },
      { level: 8, exp: 360, modifier: 2.05 },
      { level: 9, exp: 450, modifier: 2.2 },
      { level: 10, exp: 550, modifier: 2.35 },
      { level: 11, exp: 700, modifier: 2.5 },
      { level: 12, exp: 850, modifier: 2.65 },
      { level: 13, exp: 1050, modifier: 2.8 },
      { level: 14, exp: 1300, modifier: 2.95 },
      { level: 15, exp: 1600, modifier: 3.1 },
      { level: 16, exp: 2000, modifier: 3.25 },
      { level: 17, exp: 2500, modifier: 3.4 },
      { level: 18, exp: 3100, modifier: 3.55 },
      { level: 19, exp: 3800, modifier: 3.7 },
      { level: 20, exp: 4600, modifier: 3.85 },
    ],
  },
  foodRequest: {
    quantityFood: 4,
    periodHours: 24,
  },
}

export function normalizeRules(input: unknown): Rules {
  return RulesSchema.parse(input)
}

function levelInRange(range: { min: number; max: number }, level: number): boolean {
  return level >= range.min && level <= range.max
}

export function getRewardConfigForLevel(rules: Rules, level: number): RewardEntry[] {
  const matches = rules.reward.levels.filter((r) => levelInRange(r.level, level))
  if (!matches.length) return []
  return matches.flatMap((m) => m.rewards)
}

function randInt(min: number, max: number, rng = Math.random): number {
  const a = Math.ceil(min)
  const b = Math.floor(max)
  return Math.floor(rng() * (b - a + 1)) + a
}

export function rollRewards(
  rules: Rules,
  level: number,
  opts?: { rng?: () => number },
): Array<{ type: RewardItemType; quantity: number }> {
  const rng = opts?.rng ?? Math.random
  const conf = getRewardConfigForLevel(rules, level)
  const out: Array<{ type: RewardItemType; quantity: number }> = []
  for (const r of conf) {
    if (rng() <= r.chance) {
      const q = randInt(r.range.min, r.range.max, rng)
      if (q > 0) out.push({ type: r.type, quantity: q })
    }
  }
  return out
}
