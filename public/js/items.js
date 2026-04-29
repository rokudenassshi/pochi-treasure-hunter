(function () {
  const state = window.GameState;
  const {
    equipmentTypeDefinitions,
    equipmentNameTiers = [],
    rarities,
    legendaryDropRate = 1 / 100000,
    optionPool,
    optionDuplicateRate = 0.12,
    optionRollDistribution = {},
    legendaryTitles = [],
    equipmentMainStatRolls = {},
    synthesisMainStatStep = 0.001,
  } = window.GameConfig;
  const BASE_ITEM_DROP_CHANCE = 0.1;
  const MAX_ITEM_DROP_CHANCE = 1;

  function getTreasureItemDropRateBonus() {
    return window.GameRebirth?.getItemDropRateBonus
      ? window.GameRebirth.getItemDropRateBonus()
      : 0;
  }

  function getTreasureDroppedEquipmentAttackBonus() {
    return window.GameRebirth?.getDroppedEquipmentAttackBonus
      ? window.GameRebirth.getDroppedEquipmentAttackBonus()
      : 0;
  }

  function weightedRarity() {
    const legendary = rarities.find((rarity) => rarity.key === "legendary");
    if (legendary && Math.random() < legendaryDropRate) return legendary;

    const roll = Math.random();
    let accumulatedRate = 0;
    for (const rarity of rarities.filter((entry) => entry.key !== "legendary")) {
      accumulatedRate += rarity.rate;
      if (roll <= accumulatedRate) return rarity;
    }
    return rarities[0];
  }

  function applyUpperTailPenalty(t, start = 0.8, strength = 1) {
    if (strength <= 1 || t <= start) return t;
    const normalized = (t - start) / (1 - start);
    return start + Math.pow(normalized, strength) * (1 - start);
  }

  function rollBiasedValue(
    min,
    max,
    bias = 2.2,
    digits = 3,
    upperTailStart = 0.8,
    upperTailPenalty = 1,
  ) {
    const biased = Math.pow(Math.random(), bias);
    const t = applyUpperTailPenalty(biased, upperTailStart, upperTailPenalty);
    const rolled = min + (max - min) * t;
    return Number(rolled.toFixed(digits));
  }

  function rollOptionValue(optionDef) {
    const digits = Number.isInteger(optionDef.digits) ? optionDef.digits : 3;
    return rollBiasedValue(
      optionDef.min,
      optionDef.max,
      optionDef.rarityBias ?? optionRollDistribution.bias ?? 2.2,
      digits,
      optionDef.upperTailStart ?? optionRollDistribution.upperTailStart ?? 0.75,
      optionDef.upperTailPenalty ?? optionRollDistribution.upperTailPenalty ?? 2.2,
    );
  }

  function normalizePercent(value) {
    return Math.max(0.001, Number((Number(value) || 0).toFixed(3)));
  }

  function getMainStatFloorMax(rollConfig, floor) {
    const floorBand = Math.max(1, Math.ceil(Math.max(1, floor) / 100));
    return (
      rollConfig.maxBase +
      (floorBand - 1) * (rollConfig.maxPerHundredFloors || 0)
    );
  }

  function rollMainStatPercent(type) {
    const rollConfig = equipmentMainStatRolls[type];
    return normalizePercent(
      rollBiasedValue(
        rollConfig.minBase,
        getMainStatFloorMax(rollConfig, state.floor),
        rollConfig.bias,
        3,
        rollConfig.upperTailStart ?? 0.7,
        rollConfig.upperTailPenalty ?? 3.2,
      ) + getTreasureDroppedEquipmentAttackBonus(),
    );
  }

  function buildOptionRoll(optionDef) {
    return {
      key: optionDef.key,
      label: optionDef.label,
      unit: optionDef.unit,
      value: rollOptionValue(optionDef),
    };
  }

  function buildRandomOptions(rarity) {
    const pool = [...optionPool];
    const pickedDefs = [];
    const options = [];

    for (let index = 0; index < rarity.optionCount; index += 1) {
      const shouldDuplicate =
        pickedDefs.length > 0 &&
        (pool.length === 0 || Math.random() < optionDuplicateRate);

      if (shouldDuplicate) {
        const duplicateIndex = Math.floor(Math.random() * pickedDefs.length);
        options.push(buildOptionRoll(pickedDefs[duplicateIndex]));
        continue;
      }

      if (pool.length === 0) break;

      const poolIndex = Math.floor(Math.random() * pool.length);
      const picked = pool.splice(poolIndex, 1)[0];
      pickedDefs.push(picked);
      options.push(buildOptionRoll(picked));
    }

    return options;
  }

  function buildLegendaryTitle() {
    if (!legendaryTitles.length) return null;

    const titleDef =
      legendaryTitles[Math.floor(Math.random() * legendaryTitles.length)];
    const digits = Number.isInteger(titleDef.digits) ? titleDef.digits : 3;

    return {
      key: titleDef.key,
      name: titleDef.name,
      effectKey: titleDef.effectKey,
      label: titleDef.label,
      unit: titleDef.unit,
      value: rollBiasedValue(
        titleDef.min,
        titleDef.max,
        titleDef.bias ?? 3.4,
        digits,
        titleDef.upperTailStart ?? 0.55,
        titleDef.upperTailPenalty ?? 4.2,
      ),
    };
  }

  function applyLegendaryTitleEffect(item) {
    const legendaryTitle = item.legendaryTitle;
    if (!legendaryTitle?.effectKey) return item;

    const titleValue = Number(legendaryTitle.value) || 0;
    if (titleValue <= 0) return item;

    item[legendaryTitle.effectKey] =
      (item[legendaryTitle.effectKey] || 0) + titleValue;
    return item;
  }

  function applyOptionsToItem(item, options) {
    item.options = options;
    item.attackPercent = item.attackPercent || 0;
    item.allyAttackPercent = item.allyAttackPercent || 0;
    item.tapDamagePercent = 0;
    item.allyDamagePercent = 0;
    item.critBonus = 0;
    item.critDamageBonus = 0;
    item.superCritChance = 0;
    item.goldGainPercent = 0;
    item.itemDropRatePercent = 0;
    item.bossDamagePercent = 0;
    item.normalEnemyDamagePercent = 0;
    item.extraTreasureChance = 0;
    item.treasureRarityBonusPercent = 0;
    item.allyAttackIntervalReductionSeconds = 0;
    item.bossTimeBonusSeconds = 0;

    for (const option of options) {
      item[option.key] = (item[option.key] || 0) + option.value;
    }

    return applyLegendaryTitleEffect(item);
  }

  function getEquipmentTierForFloor(floor) {
    const safeFloor = Math.max(1, Number(floor) || 1);
    for (const tier of equipmentNameTiers) {
      if (safeFloor >= tier.minFloor && safeFloor <= tier.maxFloor) {
        return tier;
      }
    }
    return equipmentNameTiers[equipmentNameTiers.length - 1];
  }

  function buildItemName(typeDef, tier, legendaryTitle) {
    const baseName = `${tier.prefix}${typeDef.label}`;
    if (!legendaryTitle?.name) return baseName;
    return `《${legendaryTitle.name}》${baseName}`;
  }

  function createDropItem() {
    const rarity = weightedRarity();
    const typeKeys = Object.keys(equipmentTypeDefinitions);
    const type = typeKeys[Math.floor(Math.random() * typeKeys.length)];
    const typeDef = equipmentTypeDefinitions[type];
    const tier = getEquipmentTierForFloor(state.floor);
    const mainStatKey = typeDef.mainStatKey;
    const legendaryTitle =
      rarity.key === "legendary" ? buildLegendaryTitle() : null;
    const item = {
      id: state.nextItemId++,
      type,
      name: buildItemName(typeDef, tier, legendaryTitle),
      synthesisCount: 0,
      rarity: rarity.key,
      rarityName: rarity.name,
      optionCount: rarity.optionCount,
      legendaryTitle,
      [mainStatKey]: rollMainStatPercent(type),
    };

    return applyOptionsToItem(item, buildRandomOptions(rarity));
  }

  function getEquippedItems() {
    return [state.player.goggles, state.player.compass].filter(Boolean);
  }

  function getEquippedOptionTotal(key) {
    return getEquippedItems().reduce((total, item) => total + (item[key] || 0), 0);
  }

  function getItemDropChance() {
    return Math.min(
      MAX_ITEM_DROP_CHANCE,
      BASE_ITEM_DROP_CHANCE +
        getEquippedOptionTotal("itemDropRatePercent") +
        getTreasureItemDropRateBonus() +
        (window.GameAllies?.getItemDropRateBonus
          ? window.GameAllies.getItemDropRateBonus()
          : 0),
    );
  }

  function getItemDisplayName(item) {
    if (!item) return "";
    const synthesisCount = Math.max(0, Number(item.synthesisCount) || 0);
    if (synthesisCount <= 0) return item.name || "";
    return `${item.name}＋${synthesisCount}`;
  }

  function tryDropItem() {
    if (Math.random() > getItemDropChance()) return;

    const item = createDropItem();
    const itemName = getItemDisplayName(item);
    state.inventory.unshift(item);
    window.GameUI.addLog(`装備ドロップ: ${item.rarityName} ${itemName} を入手。`);

    if (shouldAutoDiscardItem(item)) {
      state.inventory = state.inventory.filter((entry) => entry.id !== item.id);
      window.GameUI.addLog(`自動破棄: ${item.rarityName} ${itemName} を捨てた。`);
    }
  }

  function getItemMainStatPercent(item) {
    const typeDef = equipmentTypeDefinitions[item?.type];
    if (!typeDef?.mainStatKey) return 0;
    return Math.max(0, Number(item[typeDef.mainStatKey]) || 0);
  }

  function shouldAutoDiscardRarity(itemRarity) {
    if (state.itemSettings.autoDiscardRarity === "none") {
      return false;
    }

    const rarityKeys = rarities.map((rarity) => rarity.key);
    const autoDiscardThreshold = rarityKeys.indexOf(
      state.itemSettings.autoDiscardRarity,
    );
    const itemRarityIndex = rarityKeys.indexOf(itemRarity);

    return (
      autoDiscardThreshold >= 0 &&
      itemRarityIndex >= 0 &&
      itemRarityIndex <= autoDiscardThreshold
    );
  }

  function shouldAutoDiscardAttack(item) {
    const thresholdPercent =
      Math.max(0, Number(state.itemSettings.autoDiscardAttackPercent) || 0) /
      100;
    if (thresholdPercent <= 0) return false;
    return getItemMainStatPercent(item) < thresholdPercent;
  }

  function shouldAutoDiscardItem(item) {
    return shouldAutoDiscardRarity(item.rarity) || shouldAutoDiscardAttack(item);
  }

  function isItemLocked(itemId) {
    return state.itemSettings.lockedItemIds.includes(itemId);
  }

  function toggleItemLock(itemId) {
    const index = state.itemSettings.lockedItemIds.indexOf(itemId);
    if (index >= 0) {
      state.itemSettings.lockedItemIds.splice(index, 1);
      return;
    }
    state.itemSettings.lockedItemIds.push(itemId);
  }

  function discardUnlockedItems() {
    const equippedIds = new Set(getEquippedItems().map((item) => item.id));
    let discardedCount = 0;

    state.inventory = state.inventory.filter((item) => {
      const isEquipped = equippedIds.has(item.id);
      const locked = isItemLocked(item.id);
      if (!isEquipped && !locked) {
        discardedCount += 1;
        return false;
      }
      return true;
    });

    return discardedCount;
  }

  function findItemById(itemId) {
    return (
      state.inventory.find((item) => item.id === itemId) ||
      getEquippedItems().find((item) => item.id === itemId) ||
      null
    );
  }

  function canUseAsSynthesisMaterial(baseItemId, materialItemId) {
    const baseItem = findItemById(baseItemId);
    const materialItem = state.inventory.find((item) => item.id === materialItemId);
    return Boolean(
      baseItem &&
        materialItem &&
        baseItem.id !== materialItem.id &&
        baseItem.type === materialItem.type &&
        !isItemLocked(materialItem.id),
    );
  }

  function synthesizeItem(baseItemId, materialItemId) {
    if (!canUseAsSynthesisMaterial(baseItemId, materialItemId)) return false;

    const baseItem = findItemById(baseItemId);
    const typeDef = equipmentTypeDefinitions[baseItem.type];
    baseItem.synthesisCount = Math.max(0, Number(baseItem.synthesisCount) || 0) + 1;
    baseItem[typeDef.mainStatKey] = normalizePercent(
      (baseItem[typeDef.mainStatKey] || 0) + synthesisMainStatStep,
    );
    state.inventory = state.inventory.filter((item) => item.id !== materialItemId);
    return true;
  }

  function canSynthesizeItem(itemId) {
    const item = findItemById(itemId);
    if (!item) return false;
    return state.inventory.some((entry) =>
      canUseAsSynthesisMaterial(item.id, entry.id),
    );
  }

  function getSynthesizableMaterialIds(baseItemId) {
    const baseItem = findItemById(baseItemId);
    if (!baseItem) return [];
    return state.inventory
      .filter((entry) => canUseAsSynthesisMaterial(baseItem.id, entry.id))
      .map((entry) => entry.id);
  }

  function bulkSynthesizeItem(baseItemId) {
    const materialIds = getSynthesizableMaterialIds(baseItemId);
    let synthesizedCount = 0;

    for (const materialItemId of materialIds) {
      if (synthesizeItem(baseItemId, materialItemId)) {
        synthesizedCount += 1;
      }
    }

    return synthesizedCount;
  }

  function formatOption(option) {
    if (option.unit === "%") {
      return `${option.label} +${(option.value * 100).toFixed(1)}%`;
    }
    if (option.unit === "秒") {
      const value = Number.isInteger(option.value)
        ? String(option.value)
        : option.value.toFixed(1);
      return `${option.label} +${value}秒`;
    }
    return `${option.label} +${option.value.toFixed(2)}`;
  }

  function formatLegendaryTitleEffect(legendaryTitle) {
    if (!legendaryTitle) return "";
    return `称号 ${legendaryTitle.name}: ${formatOption(legendaryTitle)}`;
  }

  function getMainStatLine(item) {
    const typeDef = equipmentTypeDefinitions[item.type];
    const mainValue = typeDef.mainStatKey === "attackPercent"
      ? item.attackPercent || 0
      : item.allyAttackPercent || 0;
    return `${typeDef.mainStatLabel} +${window.GameUI.formatPercent(mainValue, 1)}%`;
  }

  function itemDetail(item) {
    const typeDef = equipmentTypeDefinitions[item.type];
    const lines = [typeDef.label, getMainStatLine(item)];
    if (item.legendaryTitle) {
      lines.push(formatLegendaryTitleEffect(item.legendaryTitle));
    }
    if (item.options?.length) {
      item.options.forEach((option) => lines.push(formatOption(option)));
    } else {
      lines.push("オプションなし");
    }
    return lines.join(" / ");
  }

  window.GameItems = {
    createDropItem,
    tryDropItem,
    getEquippedItems,
    getEquippedOptionTotal,
    getItemDropChance,
    getItemDisplayName,
    itemDetail,
    isItemLocked,
    toggleItemLock,
    discardUnlockedItems,
    findItemById,
    canUseAsSynthesisMaterial,
    synthesizeItem,
    getSynthesizableMaterialIds,
    bulkSynthesizeItem,
    canSynthesizeItem,
    shouldAutoDiscardRarity,
    shouldAutoDiscardAttack,
    shouldAutoDiscardItem,
  };
})();
