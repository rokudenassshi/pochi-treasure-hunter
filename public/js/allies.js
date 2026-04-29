(function () {
  const state = window.GameState;
  const { allyTemplates } = window.GameConfig;
  const MIN_ALLY_ATTACK_INTERVAL_SECONDS = 1;
  const MAX_ALLIES = 5;
  const HIRE_COSTS = [1000, 3000, 5000, 10000, 20000];
  const ALLY_UPGRADE_COST_SCALE = 1.3;
  const templateMap = new Map(allyTemplates.map((template) => [template.id, template]));

  function getAllyTemplate(jobId) {
    return templateMap.get(jobId) || null;
  }

  function getOwnedAlly(uid) {
    return state.alliesOwned.find((ally) => ally.uid === uid || ally.id === uid) || null;
  }

  function getActiveAllies() {
    return state.alliesOwned;
  }

  function getEquippedOptionTotal(key) {
    return window.GameItems?.getEquippedOptionTotal
      ? window.GameItems.getEquippedOptionTotal(key)
      : 0;
  }

  function getCompassAttackPercent() {
    return Math.max(0, state.player.compass?.allyAttackPercent || 0);
  }

  function getTreasureAllyAttackIntervalReductionSeconds() {
    return window.GameRebirth?.getAllyAttackIntervalReductionSeconds
      ? window.GameRebirth.getAllyAttackIntervalReductionSeconds()
      : 0;
  }

  function getTreasureAllyJobAttackBonus(jobId) {
    return window.GameRebirth?.getAllyJobAttackBonus
      ? window.GameRebirth.getAllyJobAttackBonus(jobId)
      : 0;
  }

  function getNextHireCost() {
    return HIRE_COSTS[state.alliesOwned.length] || null;
  }

  function canHireAlly() {
    const cost = getNextHireCost();
    return state.alliesOwned.length < MAX_ALLIES && cost !== null;
  }

  function getNextAllyUid() {
    const nextId = Math.max(1, Math.floor(Number(state.nextAllyId) || 1));
    state.nextAllyId = nextId + 1;
    return `ally-${nextId}`;
  }

  function getAllyLevel(ally) {
    return Math.max(1, Math.floor(Number(ally?.level) || 1));
  }

  function getAllyUpgradeAttackAmount(ally) {
    return Math.max(0, Math.floor(Number(ally?.upgradeAtkAmount) || 0));
  }

  function canUpgradeAlly(ally) {
    if (!ally || ally.canUpgrade === false) return false;
    return getAllyUpgradeAttackAmount(ally) > 0;
  }

  function getAllyUpgradeCost(ally) {
    if (!canUpgradeAlly(ally)) return null;
    const baseCost = Math.max(1, Math.floor(Number(ally.upgradeBase) || 1));
    return Math.max(
      1,
      Math.floor(baseCost * Math.pow(ALLY_UPGRADE_COST_SCALE, getAllyLevel(ally) - 1)),
    );
  }

  function getAllyRawAttack(ally) {
    const baseAtk = Math.max(0, Math.floor(Number(ally?.baseAtk) || 0));
    return (
      baseAtk +
      getTreasureAllyJobAttackBonus(ally?.jobId || ally?.id) +
      (getAllyLevel(ally) - 1) * getAllyUpgradeAttackAmount(ally)
    );
  }

  function applyAllyDamageBonus(base) {
    if (base <= 0) return 0;
    const totalPercent =
      getCompassAttackPercent() + getEquippedOptionTotal("allyDamagePercent");
    let damage = Math.floor(base * (1 + totalPercent));
    if (totalPercent > 0 && damage <= base) damage = base + 1;
    return Math.max(1, damage);
  }

  function getAllyAttackIntervalSeconds(ally) {
    const attackIntervalSeconds = Number(ally?.attackIntervalSeconds) || 0;
    if (attackIntervalSeconds <= 0) return 0;
    const reducedInterval =
      attackIntervalSeconds - getTreasureAllyAttackIntervalReductionSeconds();
    return Math.max(MIN_ALLY_ATTACK_INTERVAL_SECONDS, reducedInterval);
  }

  function canAutoAttack(ally) {
    return !ally?.tapPursuitRatio && getAllyAttackIntervalSeconds(ally) > 0;
  }

  function getAllyAttack(ally) {
    if (!canAutoAttack(ally)) return 0;
    return applyAllyDamageBonus(getAllyRawAttack(ally));
  }

  function getAllyTapPursuitAttack(ally, tapDamage = 0) {
    const ratio = Math.max(0, Number(ally?.tapPursuitRatio) || 0);
    if (ratio <= 0) return 0;
    const tapPursuitBase = Math.max(
      1,
      Math.floor(Math.max(0, Number(tapDamage) || 0) * ratio),
    );
    const base =
      tapPursuitBase +
      (getAllyLevel(ally) - 1) * getAllyUpgradeAttackAmount(ally);
    return applyAllyDamageBonus(base);
  }

  function performAllyAttack(ally) {
    if (!state.enemy || !ally) return false;
    const attack = getAllyAttack(ally);
    if (attack <= 0) return false;
    window.GameBattle.damageEnemy(attack, false, "ally");
    return true;
  }

  function hireAlly(template) {
    const cost = getNextHireCost();
    if (!template || !canHireAlly() || cost === null || state.gold < cost) {
      return false;
    }

    state.gold -= cost;
    state.alliesOwned.push({
      ...template,
      uid: getNextAllyUid(),
      jobId: template.id,
      level: 1,
      lastAttackAt: performance.now(),
    });
    window.GameUI.addLog(`${template.name} を雇用した。`);
    window.GameUI.render();
    window.GameSave.save();
    return true;
  }

  function upgradeAlly(uid) {
    const ally = getOwnedAlly(uid);
    if (!canUpgradeAlly(ally)) return false;

    const cost = getAllyUpgradeCost(ally);
    if (cost === null || state.gold < cost) return false;

    state.gold -= cost;
    ally.level = getAllyLevel(ally) + 1;
    window.GameUI.addLog(`${ally.name} が Lv.${ally.level} になった。`);
    window.GameUI.render();
    window.GameSave.save();
    return true;
  }

  function triggerTapAllyAttack() {
    if (!state.enemy) return false;
    const activeAllies = getActiveAllies().filter((ally) => getAllyAttack(ally) > 0);
    if (activeAllies.length === 0) return false;
    const ally = activeAllies[Math.floor(Math.random() * activeAllies.length)];
    return performAllyAttack(ally);
  }

  function triggerTapPursuits(tapDamage) {
    if (!state.enemy) return false;
    const targetEnemy = state.enemy;
    let triggered = false;

    for (const ally of getActiveAllies()) {
      if (!state.enemy || state.enemy !== targetEnemy || targetEnemy.hp <= 0) {
        break;
      }

      const attack = getAllyTapPursuitAttack(ally, tapDamage);
      if (attack <= 0) continue;
      window.GameBattle.damageEnemy(attack, false, "ally");
      triggered = true;
    }

    return triggered;
  }

  function autoAttack(now) {
    const targetEnemy = state.enemy;
    if (!targetEnemy) return;

    for (const ally of getActiveAllies()) {
      if (!state.enemy || state.enemy !== targetEnemy || targetEnemy.hp <= 0) {
        break;
      }
      if (!canAutoAttack(ally) || getAllyAttack(ally) <= 0) continue;

      if (typeof ally.lastAttackAt !== "number") ally.lastAttackAt = now;
      const interval = getAllyAttackIntervalSeconds(ally) * 1000;
      if (now - ally.lastAttackAt >= interval) {
        ally.lastAttackAt = now;
        performAllyAttack(ally);
      }
    }
  }

  function getTreasureRewardBonusCount() {
    return getActiveAllies().reduce(
      (total, ally) => total + Math.max(0, Math.floor(Number(ally.treasureRewardBonusCount) || 0)),
      0,
    );
  }

  function getItemDropRateBonus() {
    return getActiveAllies().reduce(
      (total, ally) => total + Math.max(0, Number(ally.itemDropRateBonus) || 0),
      0,
    );
  }

  function getGoldGainPercent() {
    return getActiveAllies().reduce(
      (total, ally) => total + Math.max(0, Number(ally.goldGainPercent) || 0),
      0,
    );
  }

  window.GameAllies = {
    allyTemplates,
    MAX_ALLIES,
    getAllyTemplate,
    getOwnedAlly,
    getActiveAllies,
    getNextHireCost,
    canHireAlly,
    getAllyLevel,
    canUpgradeAlly,
    getAllyUpgradeCost,
    getAllyUpgradeAttackAmount,
    getAllyRawAttack,
    getAllyAttack,
    getAllyTapPursuitAttack,
    getAllyAttackIntervalSeconds,
    hireAlly,
    upgradeAlly,
    triggerTapAllyAttack,
    triggerTapPursuits,
    getTreasureRewardBonusCount,
    getItemDropRateBonus,
    getGoldGainPercent,
    autoAttack,
  };
})();
