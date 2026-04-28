(function () {
  const state = window.GameState;
  const { allyTemplates } = window.GameConfig;
  const MIN_ALLY_ATTACK_INTERVAL_SECONDS = 1;
  const PARTY_UPGRADE_COST_SCALE = 1.24;
  const PARTY_ATTACK_UPGRADE_AMOUNT = 1;
  const PARTY_UPGRADE_BASE_COST = (() => {
    const definedCosts = allyTemplates
      .map((template) => Math.max(0, Number(template?.upgradeBase) || 0))
      .filter((cost) => cost > 0);
    return definedCosts.length > 0 ? Math.min(...definedCosts) : 60;
  })();

  function getOwnedAlly(id) {
    return state.alliesOwned.find((ally) => ally.id === id) || null;
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

  function getTreasureAllyAttackBonus() {
    return window.GameRebirth?.getAllyAttackBonus
      ? window.GameRebirth.getAllyAttackBonus()
      : 0;
  }

  function getTreasureAllyAttackIntervalReductionSeconds() {
    return window.GameRebirth?.getAllyAttackIntervalReductionSeconds
      ? window.GameRebirth.getAllyAttackIntervalReductionSeconds()
      : 0;
  }

  function getTreasureAllyUpgradeCostReduction() {
    return window.GameRebirth?.getAllyUpgradeCostReduction
      ? window.GameRebirth.getAllyUpgradeCostReduction()
      : 0;
  }

  function getPartyLevel() {
    return Math.max(1, Number(state.partyLevel) || 1);
  }

  function getPartyAttackBonus() {
    return Math.max(
      0,
      (getPartyLevel() - 1) * PARTY_ATTACK_UPGRADE_AMOUNT,
    );
  }

  function getPartyUpgradeBaseCost() {
    return PARTY_UPGRADE_BASE_COST;
  }

  function getPartyUpgradeCost() {
    const baseCost = getPartyUpgradeBaseCost();
    if (baseCost <= 0) return 0;

    return Math.max(
      1,
      Math.floor(
        baseCost * Math.pow(PARTY_UPGRADE_COST_SCALE, getPartyLevel() - 1),
      ) - getTreasureAllyUpgradeCostReduction(),
    );
  }

  function canUpgradePartyLevel() {
    return getActiveAllies().length > 0;
  }

  function getAllyAttackIntervalSeconds(ally) {
    const atkSpeed = Number(ally?.atkSpeed) || 0.1;
    const baseInterval = 1 / atkSpeed;
    const reducedInterval =
      baseInterval - getTreasureAllyAttackIntervalReductionSeconds();
    return Math.max(MIN_ALLY_ATTACK_INTERVAL_SECONDS, reducedInterval);
  }

  function getAllyAttack(ally) {
    const base =
      Math.max(1, Number(ally?.baseAtk) || 1) +
      getPartyAttackBonus() +
      getTreasureAllyAttackBonus();
    const totalPercent =
      getCompassAttackPercent() + getEquippedOptionTotal("allyDamagePercent");
    let damage = Math.floor(base * (1 + totalPercent));
    if (totalPercent > 0 && damage <= base) damage = base + 1;
    return Math.max(1, damage);
  }

  function performAllyAttack(ally) {
    if (!state.enemy || !ally) return false;
    window.GameBattle.damageEnemy(getAllyAttack(ally), false, "ally");
    return true;
  }

  function hireAlly(template) {
    if (
      state.alliesOwned.length >= 10 ||
      getOwnedAlly(template.id) ||
      state.gold < template.hireCost
    ) {
      return;
    }

    state.gold -= template.hireCost;
    state.alliesOwned.push({
      ...template,
      baseAtk: Math.max(1, Number(template.baseAtk) || 1),
      lastAttackAt: performance.now(),
    });
    window.GameUI.addLog(`${template.name} を雇用した。`);
    window.GameUI.render();
    window.GameSave.save();
  }

  function upgradePartyLevel() {
    if (!canUpgradePartyLevel()) return false;

    const cost = getPartyUpgradeCost();
    if (state.gold < cost) return false;

    state.gold -= cost;
    state.partyLevel = getPartyLevel() + 1;
    window.GameUI.addLog(
      `パーティーレベルが Lv.${getPartyLevel()} になった。`,
    );
    window.GameUI.render();
    window.GameSave.save();
    return true;
  }

  function getPartyUpgradeAmount() {
    return PARTY_ATTACK_UPGRADE_AMOUNT;
  }

  function triggerTapAllyAttack() {
    if (!state.enemy) return false;
    const activeAllies = getActiveAllies();
    if (activeAllies.length === 0) return false;
    const ally = activeAllies[Math.floor(Math.random() * activeAllies.length)];
    return performAllyAttack(ally);
  }

  function autoAttack(now) {
    const targetEnemy = state.enemy;
    if (!targetEnemy) return;

    for (const ally of getActiveAllies()) {
      if (!state.enemy || state.enemy !== targetEnemy || targetEnemy.hp <= 0) {
        break;
      }

      if (typeof ally.lastAttackAt !== "number") ally.lastAttackAt = now;
      const interval = getAllyAttackIntervalSeconds(ally) * 1000;
      if (now - ally.lastAttackAt >= interval) {
        ally.lastAttackAt = now;
        performAllyAttack(ally);
      }
    }
  }

  window.GameAllies = {
    allyTemplates,
    getOwnedAlly,
    getActiveAllies,
    getPartyLevel,
    getPartyAttackBonus,
    getPartyUpgradeCost,
    getPartyUpgradeAmount,
    canUpgradePartyLevel,
    getAllyAttack,
    getAllyAttackIntervalSeconds,
    hireAlly,
    upgradePartyLevel,
    triggerTapAllyAttack,
    autoAttack,
  };
})();
