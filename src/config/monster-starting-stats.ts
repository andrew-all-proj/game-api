export const monsterStartingStats = {
  monster: {
    healthPoints: 100,
    stamina: 60,
    strength: 12,
    defense: 10,
    evasion: 5,
    experiencePoints: 0,
    level: 1,
    satiety: 50,
  },
  monsterAttacks: [
    {
      name: 'Дать леща',
      modifier: 0.8,
      energyCost: 12,
      cooldown: 0,
    },
    {
      name: 'Пнуть',
      modifier: 1.2,
      energyCost: 18,
      cooldown: 0,
    },
  ],
  monsterDefenses: [
    {
      name: 'Блок',
      modifier: 1,
      energyCost: 16,
      cooldown: 0,
    },
    {
      name: 'Уклон',
      modifier: 1.3,
      energyCost: 18,
      cooldown: 0,
    },
  ],
}

export const costToCreateMonster = 200
