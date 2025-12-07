import { Injectable } from '@nestjs/common'
import { RulesSchema, Rules, DefaultRules } from './rules.schema'
import * as fs from 'fs'
import * as path from 'path'
import { logger } from '../../functions/logger'
import * as gameDb from 'game-db'

const DEFAULT_TTL_MS = 60_000

@Injectable()
export class RulesService {
  private cache?: { value: Rules; loadedAt: number }

  constructor() {}

  async getRules(opts?: { force?: boolean; ttlMs?: number }): Promise<Rules> {
    const ttl = opts?.ttlMs ?? DEFAULT_TTL_MS

    if (!opts?.force && this.cache && Date.now() - this.cache.loadedAt < ttl) {
      return this.cache.value
    }

    const hardDefaults: Rules = RulesSchema.parse(DefaultRules)

    let finalRules: Rules = hardDefaults

    try {
      const row = await gameDb.Entities.Rule.findOne({ where: { isActive: true } })
      if (row?.data) {
        const parsed = RulesSchema.parse(row.data)
        finalRules = parsed
        this.cache = { value: finalRules, loadedAt: Date.now() }
        return finalRules
      } else {
        logger.warn('No active rules row in DB, fallback to file/defaults')
      }
    } catch (e) {
      logger.warn(`DB rules invalid or not found, fallback to file/defaults: ${String(e)}`)
    }

    try {
      const p = path.join(__dirname, 'default-rules.json')
      const raw = fs.readFileSync(p, 'utf8')
      const fileRules = RulesSchema.parse(JSON.parse(raw))
      finalRules = fileRules
    } catch (e) {
      logger.error(`Default rules file invalid or missing, fallback to hard defaults: ${String(e)}`)
    }

    this.cache = { value: finalRules, loadedAt: Date.now() }
    return finalRules
  }

  async refresh(): Promise<Rules> {
    this.cache = undefined
    return this.getRules({ force: true })
  }
}
