(function () {
  const state = window.GameState;
  const { treasureDefinitions = [], treasureRewardRarities = {} } =
    window.GameConfig;
  const REBIRTH_FLOOR_INTERVAL = 50;
  const NEXT_UNLOCK_TREASURE_CHANCE = 0.01;
  const NEXT_UNLOCK_TREASURE_FLOOR_INTERVAL = 100;
  const ALLY_JOB_ATTACK_BONUS_JOB_IDS = ["warrior", "swordsman", "hunter"];
  const TREASURE_RARITY_BONUS_STEPS = {
    common: 0,
    uncommon: 1,
    rare: 2,
    epic: 3,
  };
  const treasureDefinitionMap = new Map(
    treasureDefinitions.map((treasure) => [treasure.id, treasure]),
  );
  let treasureSummaryCache = null;

  function createDefaultTreasures() {
    return Object.fromEntries(
      treasureDefinitions.map((treasure) => [treasure.id, 0]),
    );
  }

  function invalidateTreasureSummary() {
    treasureSummaryCache = null;
  }

  function getTreasureDefinition(treasureId) {
    return treasureDefinitionMap.get(treasureId) || null;
  }

  function getTreasureMaxCount(treasureId) {
    const maxCount = Number(getTreasureDefinition(treasureId)?.maxCount);
    if (!Number.isFinite(maxCount) || maxCount < 0) return null;
    return Math.floor(maxCount);
  }

  function clampTreasureCount(treasureId, count) {
    const normalizedCount = Math.max(0, Math.floor(Number(count) || 0));
    const maxCount = getTreasureMaxCount(treasureId);
    return maxCount === null
      ? normalizedCount
      : Math.min(normalizedCount, maxCount);
  }

  function isTreasureAtMax(treasureId, treasures = ensureTreasures()) {
    const maxCount = getTreasureMaxCount(treasureId);
    if (maxCount === null) return false;
    return clampTreasureCount(treasureId, treasures[treasureId]) >= maxCount;
  }

  function ensureTreasures() {
    if (!state.treasures || typeof state.treasures !== "object") {
      state.treasures = createDefaultTreasures();
      invalidateTreasureSummary();
      return state.treasures;
    }

    let mutated = false;
    for (const treasure of treasureDefinitions) {
      const normalizedCount = clampTreasureCount(
        treasure.id,
        state.treasures[treasure.id],
      );
      if (state.treasures[treasure.id] !== normalizedCount) {
        state.treasures[treasure.id] = normalizedCount;
        mutated = true;
      }
    }
    if (mutated) invalidateTreasureSummary();
    return state.treasures;
  }

  function recordReachedFloor(floor) {
    const nextFloor = Math.max(1, Number(floor) || 1);
    state.runHighestFloorReached = Math.max(
      Math.max(1, Number(state.runHighestFloorReached) || 1),
      nextFloor,
    );
    return state.runHighestFloorReached;
  }

  function getReachFloor() {
    if (state.pendingBossFloor !== null) {
      return Math.max(1, Number(state.pendingBossFloor) - 1);
    }
    return Math.max(0, (Number(state.floor) || 1) - 1);
  }

  function getAllyTreasureRewardBonusCount() {
    return window.GameAllies?.getTreasureRewardBonusCount
      ? window.GameAllies.getTreasureRewardBonusCount()
      : 0;
  }

  function getEquippedOptionTotal(key) {
    return window.GameItems?.getEquippedOptionTotal
      ? window.GameItems.getEquippedOptionTotal(key)
      : 0;
  }

  function getBaseRebirthRewardCount() {
    const tierCount = Math.floor(getReachFloor() / REBIRTH_FLOOR_INTERVAL);
    return (tierCount * (tierCount + 1)) / 2;
  }

  function getRebirthRewardCount() {
    const baseRewardCount = getBaseRebirthRewardCount();
    if (baseRewardCount <= 0) return 0;
    return baseRewardCount + getAllyTreasureRewardBonusCount();
  }

  function canRebirth() {
    return getBaseRebirthRewardCount() > 0;
  }

  function getTreasureCount(treasureId) {
    return clampTreasureCount(treasureId, ensureTreasures()[treasureId]);
  }

  function addTreasure(treasureId, amount) {
    if (amount <= 0) return;
    const treasures = ensureTreasures();
    const nextCount = clampTreasureCount(
      treasureId,
      getTreasureCount(treasureId) + amount,
    );
    if (treasures[treasureId] === nextCount) return 0;
    const addedAmount = nextCount - getTreasureCount(treasureId);
    treasures[treasureId] = nextCount;
    invalidateTreasureSummary();
    return addedAmount;
  }

  function removeTreasure(treasureId, amount) {
    if (amount <= 0) return 0;
    const treasures = ensureTreasures();
    const currentCount = getTreasureCount(treasureId);
    const nextCount = clampTreasureCount(treasureId, currentCount - amount);
    if (treasures[treasureId] === nextCount) return 0;
    const removedAmount = currentCount - nextCount;
    treasures[treasureId] = nextCount;
    invalidateTreasureSummary();
    return removedAmount;
  }

  function buildTreasureSummary() {
    const treasures = ensureTreasures();
    const entries = [];
    const ownedEntries = [];
    let playerAttackBonus = 0;
    const allyJobAttackBonuses = Object.fromEntries(
      ALLY_JOB_ATTACK_BONUS_JOB_IDS.map((jobId) => [jobId, 0]),
    );
    let allyAttackIntervalReductionSeconds = 0;
    let goldBonus = 0;
    let playerUpgradeCostReduction = 0;
    let critChanceBonus = 0;
    let critDamageBonus = 0;
    let tapAllyAttackChanceBonus = 0;
    let superCritChanceBonus = 0;
    let itemDropRateBonus = 0;
    let droppedEquipmentAttackBonus = 0;
    let extraTreasureChance = 0;
    let floorSkipChance = 0;
    let nextRebirthExtraTreasureCount = 0;
    let rebirthStartingGoldBonus = 0;
    let enemyGoldDoubleChance = 0;
    let bossTreasureRewardCount = 0;
    let bossTreasureRewardFloorOffset = 0;
    let bossDamagePercent = 0;

    for (const treasure of treasureDefinitions) {
      const count = Math.max(0, Number(treasures[treasure.id]) || 0);
      const totalAttackBonus = count * (Number(treasure.attackBonus) || 0);
      const totalAllyJobAttackBonus = Object.fromEntries(
        ALLY_JOB_ATTACK_BONUS_JOB_IDS.map((jobId) => [
          jobId,
          count * (Number(treasure.allyJobAttackBonus?.[jobId]) || 0),
        ]),
      );
      const totalAllyAttackIntervalReductionSeconds =
        count * (Number(treasure.allyAttackIntervalReductionSeconds) || 0);
      const totalGoldBonus = count * (Number(treasure.goldBonus) || 0);
      const totalPlayerUpgradeCostReduction =
        count * (Number(treasure.playerUpgradeCostReduction) || 0);
      const totalCritChanceBonus =
        count * (Number(treasure.critChanceBonus) || 0);
      const totalCritDamageBonus =
        count * (Number(treasure.critDamageBonus) || 0);
      const totalTapAllyAttackChanceBonus =
        count * (Number(treasure.tapAllyAttackChanceBonus) || 0);
      const totalSuperCritChanceBonus =
        count * (Number(treasure.superCritChanceBonus) || 0);
      const totalItemDropRateBonus =
        count * (Number(treasure.itemDropRateBonus) || 0);
      const totalDroppedEquipmentAttackBonus =
        count * (Number(treasure.droppedEquipmentAttackBonus) || 0);
      const totalExtraTreasureChance =
        count * (Number(treasure.extraTreasureChance) || 0);
      const totalFloorSkipChance =
        count * (Number(treasure.floorSkipChance) || 0);
      const totalNextRebirthExtraTreasureCount =
        count * (Number(treasure.nextRebirthExtraTreasureCount) || 0);
      const totalRebirthStartingGoldBonus =
        count * (Number(treasure.rebirthStartingGoldBonus) || 0);
      const totalEnemyGoldDoubleChance =
        count * (Number(treasure.enemyGoldDoubleChance) || 0);
      const totalBossTreasureRewardCount =
        count * (Number(treasure.bossTreasureRewardCount) || 0);
      const totalBossTreasureRewardFloorOffset =
        count * (Number(treasure.bossTreasureRewardFloorOffset) || 0);
      const totalBossDamagePercent =
        count * (Number(treasure.bossDamagePercent) || 0);
      const entry = {
        ...treasure,
        count,
        totalAttackBonus,
        totalAllyJobAttackBonus,
        totalAllyAttackIntervalReductionSeconds,
        totalGoldBonus,
        totalPlayerUpgradeCostReduction,
        totalCritChanceBonus,
        totalCritDamageBonus,
        totalTapAllyAttackChanceBonus,
        totalSuperCritChanceBonus,
        totalItemDropRateBonus,
        totalDroppedEquipmentAttackBonus,
        totalExtraTreasureChance,
        totalFloorSkipChance,
        totalNextRebirthExtraTreasureCount,
        totalRebirthStartingGoldBonus,
        totalEnemyGoldDoubleChance,
        totalBossTreasureRewardCount,
        totalBossTreasureRewardFloorOffset,
        totalBossDamagePercent,
      };

      entries.push(entry);
      if (count > 0) ownedEntries.push(entry);
      playerAttackBonus += totalAttackBonus;
      for (const jobId of ALLY_JOB_ATTACK_BONUS_JOB_IDS) {
        allyJobAttackBonuses[jobId] += totalAllyJobAttackBonus[jobId];
      }
      allyAttackIntervalReductionSeconds +=
        totalAllyAttackIntervalReductionSeconds;
      goldBonus += totalGoldBonus;
      playerUpgradeCostReduction += totalPlayerUpgradeCostReduction;
      critChanceBonus += totalCritChanceBonus;
      critDamageBonus += totalCritDamageBonus;
      tapAllyAttackChanceBonus += totalTapAllyAttackChanceBonus;
      superCritChanceBonus += totalSuperCritChanceBonus;
      itemDropRateBonus += totalItemDropRateBonus;
      droppedEquipmentAttackBonus += totalDroppedEquipmentAttackBonus;
      extraTreasureChance += totalExtraTreasureChance;
      floorSkipChance += totalFloorSkipChance;
      nextRebirthExtraTreasureCount += totalNextRebirthExtraTreasureCount;
      rebirthStartingGoldBonus += totalRebirthStartingGoldBonus;
      enemyGoldDoubleChance += totalEnemyGoldDoubleChance;
      bossTreasureRewardCount += totalBossTreasureRewardCount;
      bossTreasureRewardFloorOffset += totalBossTreasureRewardFloorOffset;
      bossDamagePercent += totalBossDamagePercent;
    }

    treasureSummaryCache = {
      entries,
      ownedEntries,
      playerAttackBonus,
      allyJobAttackBonuses,
      allyAttackIntervalReductionSeconds,
      goldBonus,
      playerUpgradeCostReduction,
      critChanceBonus,
      critDamageBonus,
      tapAllyAttackChanceBonus,
      superCritChanceBonus,
      itemDropRateBonus,
      droppedEquipmentAttackBonus,
      extraTreasureChance,
      floorSkipChance,
      nextRebirthExtraTreasureCount,
      rebirthStartingGoldBonus,
      enemyGoldDoubleChance,
      bossTreasureRewardCount,
      bossTreasureRewardFloorOffset,
      bossDamagePercent,
    };
    return treasureSummaryCache;
  }

  function getTreasureSummary() {
    return treasureSummaryCache || buildTreasureSummary();
  }

  function getTreasureEntries() {
    return getTreasureSummary().entries;
  }

  function getOwnedTreasureEntries() {
    return getTreasureSummary().ownedEntries;
  }

  function getPlayerAttackBonus() {
    return getTreasureSummary().playerAttackBonus;
  }

  function getAllyJobAttackBonus(jobId) {
    if (!ALLY_JOB_ATTACK_BONUS_JOB_IDS.includes(jobId)) return 0;
    return Math.max(
      0,
      Math.floor(Number(getTreasureSummary().allyJobAttackBonuses[jobId]) || 0),
    );
  }

  function getAllyJobAttackBonuses() {
    return { ...getTreasureSummary().allyJobAttackBonuses };
  }

  function getGoldBonus() {
    return getTreasureSummary().goldBonus;
  }

  function getAllyAttackIntervalReductionSeconds() {
    return getTreasureSummary().allyAttackIntervalReductionSeconds;
  }

  function getPlayerUpgradeCostReduction() {
    return getTreasureSummary().playerUpgradeCostReduction;
  }

  function getCritChanceBonus() {
    return getTreasureSummary().critChanceBonus;
  }

  function getCritDamageBonus() {
    return getTreasureSummary().critDamageBonus;
  }

  function getTapAllyAttackChanceBonus() {
    return getTreasureSummary().tapAllyAttackChanceBonus;
  }

  function getSuperCritChanceBonus() {
    return getTreasureSummary().superCritChanceBonus;
  }

  function getItemDropRateBonus() {
    return getTreasureSummary().itemDropRateBonus;
  }

  function getDroppedEquipmentAttackBonus() {
    return Math.max(0, getTreasureSummary().droppedEquipmentAttackBonus);
  }

  function getExtraTreasureChance() {
    return Math.min(
      1,
      getTreasureSummary().extraTreasureChance +
        getEquippedOptionTotal("extraTreasureChance"),
    );
  }

  function getTreasureRarityBonusPercent() {
    return Math.max(0, getEquippedOptionTotal("treasureRarityBonusPercent"));
  }

  function getFloorSkipChance() {
    return Math.min(1, getTreasureSummary().floorSkipChance);
  }

  function getNextRebirthExtraTreasureCount() {
    return Math.max(
      0,
      Math.floor(getTreasureSummary().nextRebirthExtraTreasureCount),
    );
  }

  function getRebirthStartingGoldBonus() {
    return Math.max(
      0,
      Math.floor(getTreasureSummary().rebirthStartingGoldBonus),
    );
  }

  function getEnemyGoldDoubleChance() {
    return Math.min(1, Math.max(0, getTreasureSummary().enemyGoldDoubleChance));
  }

  function getBossTreasureRewardCount() {
    return Math.max(
      0,
      Math.floor(getTreasureSummary().bossTreasureRewardCount),
    );
  }

  function getBossTreasureRewardFloorOffset() {
    return Math.max(
      0,
      Math.floor(getTreasureSummary().bossTreasureRewardFloorOffset),
    );
  }

  function getBossDamagePercent() {
    return getTreasureSummary().bossDamagePercent;
  }

  function rollExtraTreasureRewardCount() {
    return Math.random() < getExtraTreasureChance() ? 1 : 0;
  }

  function consumeNextRebirthTreasureEffects() {
    const consumedEntries = [];

    for (const treasure of treasureDefinitions) {
      const extraTreasureCount = Math.max(
        0,
        Number(treasure.nextRebirthExtraTreasureCount) || 0,
      );
      if (extraTreasureCount <= 0) continue;

      const consumedCount = removeTreasure(
        treasure.id,
        getTreasureCount(treasure.id),
      );
      if (consumedCount <= 0) continue;

      consumedEntries.push({
        ...treasure,
        consumedCount,
        grantedTreasureCount: consumedCount * extraTreasureCount,
      });
    }

    return consumedEntries;
  }

  function getAttackBonus() {
    return getPlayerAttackBonus();
  }

  function getEligibleTreasureDefinitionsForFloor(reachFloor) {
    const treasures = ensureTreasures();
    return treasureDefinitions.filter(
      (treasure) =>
        reachFloor >= (Number(treasure.unlockFloor) || 1) &&
        !isTreasureAtMax(treasure.id, treasures),
    );
  }

  function getNextUnlockTreasureFloor(reachFloor = getReachFloor()) {
    const safeReachFloor = Math.max(0, Math.floor(Number(reachFloor) || 0));
    if (
      safeReachFloor < NEXT_UNLOCK_TREASURE_FLOOR_INTERVAL ||
      safeReachFloor % NEXT_UNLOCK_TREASURE_FLOOR_INTERVAL !== 0
    ) {
      return null;
    }

    const unlockFloors = treasureDefinitions
      .map((treasure) => Number(treasure.unlockFloor) || 1)
      .filter((unlockFloor) => unlockFloor > safeReachFloor)
      .sort((a, b) => a - b);

    return unlockFloors[0] || null;
  }

  function getNextUnlockTreasureChance() {
    const nextUnlockFloor = getNextUnlockTreasureFloor();
    if (nextUnlockFloor === null) return 0;
    const eligibleTreasures = getEligibleTreasureDefinitionsForFloor(
      nextUnlockFloor,
    ).filter(
      (treasure) => (Number(treasure.unlockFloor) || 1) === nextUnlockFloor,
    );
    return eligibleTreasures.length > 0 ? NEXT_UNLOCK_TREASURE_CHANCE : 0;
  }

  function getEligibleTreasureDefinitions() {
    return getEligibleTreasureDefinitionsForFloor(getReachFloor());
  }

  function getTreasureRewardWeight(treasure) {
    const rarityKey = treasure?.rewardRarity || "common";
    const rarityWeight = Number(treasureRewardRarities[rarityKey]?.weight);
    const rarityBonusStep = TREASURE_RARITY_BONUS_STEPS[rarityKey] || 0;
    const rarityBonusMultiplier =
      1 + getTreasureRarityBonusPercent() * rarityBonusStep;
    if (Number.isFinite(rarityWeight) && rarityWeight > 0) {
      return rarityWeight * rarityBonusMultiplier;
    }
    return (Number(treasureRewardRarities.common?.weight) || 1) *
      rarityBonusMultiplier;
  }

  function pickWeightedTreasure(treasures) {
    const weightedTreasures = treasures
      .map((treasure) => ({
        treasure,
        weight: getTreasureRewardWeight(treasure),
      }))
      .filter((entry) => entry.weight > 0);

    if (weightedTreasures.length === 0) return null;

    const totalWeight = weightedTreasures.reduce(
      (sum, entry) => sum + entry.weight,
      0,
    );
    if (totalWeight <= 0) return weightedTreasures[0].treasure;

    let roll = Math.random() * totalWeight;
    for (const entry of weightedTreasures) {
      roll -= entry.weight;
      if (roll <= 0) return entry.treasure;
    }

    return weightedTreasures[weightedTreasures.length - 1].treasure;
  }

  function grantTreasureRewards(rewardCount, rewardFloor = getReachFloor()) {
    if (rewardCount <= 0) return [];

    const rewards = new Map();

    for (let index = 0; index < rewardCount; index += 1) {
      const eligibleTreasures =
        getEligibleTreasureDefinitionsForFloor(rewardFloor);
      if (eligibleTreasures.length === 0) break;
      const treasure = pickWeightedTreasure(eligibleTreasures);
      if (!treasure) break;
      const addedAmount = addTreasure(treasure.id, 1);
      if (addedAmount <= 0) continue;
      rewards.set(treasure.id, (rewards.get(treasure.id) || 0) + addedAmount);
    }

    return treasureDefinitions
      .filter((treasure) => rewards.has(treasure.id))
      .map((treasure) => ({
        ...treasure,
        rewardedCount: rewards.get(treasure.id) || 0,
      }));
  }

  function grantNextUnlockTreasureReward() {
    const nextUnlockFloor = getNextUnlockTreasureFloor();
    if (
      nextUnlockFloor === null ||
      Math.random() >= NEXT_UNLOCK_TREASURE_CHANCE
    ) {
      return [];
    }

    const eligibleTreasures = getEligibleTreasureDefinitionsForFloor(
      nextUnlockFloor,
    ).filter(
      (treasure) => (Number(treasure.unlockFloor) || 1) === nextUnlockFloor,
    );
    const treasure = pickWeightedTreasure(eligibleTreasures);
    if (!treasure) return [];

    const addedAmount = addTreasure(treasure.id, 1);
    if (addedAmount <= 0) return [];

    return [
      {
        ...treasure,
        rewardedCount: addedAmount,
      },
    ];
  }

  function mergeRewardEntries(...rewardEntryLists) {
    const rewards = new Map();

    for (const rewardEntries of rewardEntryLists) {
      for (const treasure of rewardEntries) {
        rewards.set(
          treasure.id,
          (rewards.get(treasure.id) || 0) + treasure.rewardedCount,
        );
      }
    }

    return treasureDefinitions
      .filter((treasure) => rewards.has(treasure.id))
      .map((treasure) => ({
        ...treasure,
        rewardedCount: rewards.get(treasure.id) || 0,
      }));
  }

  function grantRebirthTreasures(rewardCount) {
    if (rewardCount <= 0) return [];

    const rewardFloor = getReachFloor();
    const rewards = new Map();
    const dagger = getTreasureDefinition("dagger");
    const canGrantDagger =
      dagger &&
      rewardFloor >= (Number(dagger.unlockFloor) || 1) &&
      !isTreasureAtMax(dagger.id);

    let remainingRewardCount = rewardCount;
    if (canGrantDagger) {
      const addedAmount = addTreasure(dagger.id, 1);
      if (addedAmount > 0) {
        rewards.set(dagger.id, addedAmount);
        remainingRewardCount -= 1;
      }
    }

    for (const treasure of grantTreasureRewards(
      remainingRewardCount,
      rewardFloor,
    )) {
      rewards.set(
        treasure.id,
        (rewards.get(treasure.id) || 0) + treasure.rewardedCount,
      );
    }

    return treasureDefinitions
      .filter((treasure) => rewards.has(treasure.id))
      .map((treasure) => ({
        ...treasure,
        rewardedCount: rewards.get(treasure.id) || 0,
      }));
  }

  function getBossTreasureRewardFloor(bossFloor) {
    const rewardCount = getBossTreasureRewardCount();
    if (rewardCount <= 0) return null;
    const safeBossFloor = Math.max(1, Number(bossFloor) || 1);
    const rewardBandCount =
      Math.floor(Math.max(0, safeBossFloor - 10) / 100) + 1;
    const rewardFloor = Math.max(
      REBIRTH_FLOOR_INTERVAL,
      getBossTreasureRewardFloorOffset() * rewardBandCount,
    );
    return rewardFloor;
  }

  function grantBossDefeatTreasures(bossFloor) {
    const rewardCount = getBossTreasureRewardCount();
    const rewardFloor = getBossTreasureRewardFloor(bossFloor);
    if (rewardCount <= 0 || rewardFloor === null) return [];
    return grantTreasureRewards(rewardCount, rewardFloor);
  }

  function formatRewardSummary(rewardEntries) {
    if (!rewardEntries.length) return "";
    return rewardEntries
      .map((treasure) => `${treasure.name}${treasure.rewardedCount}個`)
      .join("、");
  }

  function resetProgressForRebirth() {
    const goggles = state.player.goggles;
    const compass = state.player.compass;
    const startingGoldBonus = getRebirthStartingGoldBonus();

    state.floor = 1;
    state.gold = startingGoldBonus;
    state.player = {
      tapLevel: 1,
      critLevel: 0,
      critDamageLevel: 0,
      goggles,
      compass,
    };
    state.alliesOwned = [];
    state.partyLevel = 1;
    state.enemy = null;
    state.runHighestFloorReached = 1;
    state.bossTimeLeft = 0;
    state.pendingBossFloor = null;
    state.lastAutoTick = performance.now();
    state.recentAutoDamage = 0;
    state.recentAutoWindowStart = performance.now();
  }

  function recordDungeonClear() {
    if (!state.records || typeof state.records !== "object") {
      state.records = {};
    }
    state.records.dungeonClearCount =
      Math.max(0, Math.floor(Number(state.records.dungeonClearCount) || 0)) + 1;
  }

  function rebirth() {
    const rewardCount = getRebirthRewardCount();
    if (rewardCount <= 0) return false;
    const allyTreasureRewardBonus = getAllyTreasureRewardBonusCount();
    const extraRewardCount = rollExtraTreasureRewardCount();
    const consumedEntries = consumeNextRebirthTreasureEffects();
    const guaranteedExtraRewardCount = consumedEntries.reduce(
      (total, entry) => total + entry.grantedTreasureCount,
      0,
    );
    const rewardedTreasures = grantRebirthTreasures(
      rewardCount + extraRewardCount + guaranteedExtraRewardCount,
    );
    const nextUnlockRewardedTreasures = grantNextUnlockTreasureReward();
    const allRewardedTreasures = mergeRewardEntries(
      rewardedTreasures,
      nextUnlockRewardedTreasures,
    );

    recordDungeonClear();
    resetProgressForRebirth();
    window.GameEnemies.spawnEnemy();

    const rewardNotes = [];
    if (allyTreasureRewardBonus > 0) {
      rewardNotes.push(`盗賊効果で秘宝${allyTreasureRewardBonus}個が増え`);
    }
    if (guaranteedExtraRewardCount > 0) {
      rewardNotes.push(
        `秘宝庫の鍵で追加秘宝${guaranteedExtraRewardCount}個が確定し`,
      );
    }
    if (extraRewardCount > 0) {
      rewardNotes.push("追加秘宝が発動し");
    }
    if (nextUnlockRewardedTreasures.length > 0) {
      rewardNotes.push("通常よりレアな秘宝をゲット");
    }

    if (allRewardedTreasures.length > 0) {
      window.GameUI.addLog(
        `次のダンジョンへ行った。${rewardNotes.length ? `${rewardNotes.join("、")}、` : ""}${formatRewardSummary(allRewardedTreasures)}を入手した。`,
      );
    } else if (rewardNotes.length > 0) {
      window.GameUI.addLog(
        `次のダンジョンへ行った。${rewardNotes.join("、")}。`,
      );
    } else {
      window.GameUI.addLog("次のダンジョンへ行った。");
    }

    window.GameUI.render();
    window.GameSave.save();
    return true;
  }

  window.GameRebirth = {
    REBIRTH_FLOOR_INTERVAL,
    recordReachedFloor,
    getReachFloor,
    getRebirthRewardCount,
    canRebirth,
    getTreasureCount,
    getTreasureEntries,
    getOwnedTreasureEntries,
    getPlayerAttackBonus,
    getAllyJobAttackBonus,
    getAllyJobAttackBonuses,
    getAllyAttackIntervalReductionSeconds,
    getGoldBonus,
    getPlayerUpgradeCostReduction,
    getCritChanceBonus,
    getCritDamageBonus,
    getTapAllyAttackChanceBonus,
    getSuperCritChanceBonus,
    getItemDropRateBonus,
    getDroppedEquipmentAttackBonus,
    getExtraTreasureChance,
    getTreasureRarityBonusPercent,
    getNextUnlockTreasureChance,
    getFloorSkipChance,
    getNextRebirthExtraTreasureCount,
    getRebirthStartingGoldBonus,
    getEnemyGoldDoubleChance,
    getBossTreasureRewardCount,
    getBossTreasureRewardFloorOffset,
    getBossTreasureRewardFloor,
    getBossDamagePercent,
    getAttackBonus,
    grantBossDefeatTreasures,
    rebirth,
  };
})();
