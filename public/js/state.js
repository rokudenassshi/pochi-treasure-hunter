window.GameState = {
  floor: 1,
  gold: 0,
  player: {
    tapLevel: 1,
    critLevel: 0,
    critDamageLevel: 0,
    goggles: null,
    compass: null,
  },
  inventory: [],
  alliesOwned: [],
  partyLevel: 1,
  enemy: null,
  runHighestFloorReached: 1,
  bossTimeLeft: 0,
  pendingBossFloor: null,
  lastAutoTick: performance.now(),
  recentAutoDamage: 0,
  recentAutoWindowStart: performance.now(),
  nextItemId: 1,
  itemSettings: {
    autoDiscardRarity: "none",
    autoDiscardAttackPercent: 0,
    lockedItemIds: [],
  },
  settings: {
    autoChallengeBoss: true,
  },
  records: {
    dungeonClearCount: 0,
  },
  treasures: Object.fromEntries(
    (window.GameConfig?.treasureDefinitions || []).map((treasure) => [
      treasure.id,
      0,
    ]),
  ),
};
