(function () {
  const state = window.GameState;
  const SUPER_CRIT_MULTIPLIER = 10;
  const MAX_SUPER_CRIT_CHANCE = 0.1;
  const PLAYER_TAP_UPGRADE_AMOUNT = 1;
  const PLAYER_CRIT_CHANCE_UPGRADE = 0.01;
  const PLAYER_CRIT_DAMAGE_UPGRADE = 0.01;
  const PLAYER_TAP_UPGRADE_COST_SCALE = 1.24;
  const PLAYER_CRIT_UPGRADE_COST_SCALE = 1.33;
  const PLAYER_CRIT_DAMAGE_UPGRADE_COST_SCALE = 1.34;
  const MAX_FLOATING_DAMAGE_NODES = 12;

  function getTreasureAttackBonus() {
    return window.GameRebirth?.getPlayerAttackBonus
      ? window.GameRebirth.getPlayerAttackBonus()
      : 0;
  }

  function getTreasureGoldBonus() {
    return window.GameRebirth?.getGoldBonus
      ? window.GameRebirth.getGoldBonus()
      : 0;
  }

  function getTreasureEnemyGoldDoubleChance() {
    return window.GameRebirth?.getEnemyGoldDoubleChance
      ? window.GameRebirth.getEnemyGoldDoubleChance()
      : 0;
  }

  function getTreasurePlayerUpgradeCostReduction() {
    return window.GameRebirth?.getPlayerUpgradeCostReduction
      ? window.GameRebirth.getPlayerUpgradeCostReduction()
      : 0;
  }

  function getTreasureCritChanceBonus() {
    return window.GameRebirth?.getCritChanceBonus
      ? window.GameRebirth.getCritChanceBonus()
      : 0;
  }

  function getTreasureCritDamageBonus() {
    return window.GameRebirth?.getCritDamageBonus
      ? window.GameRebirth.getCritDamageBonus()
      : 0;
  }

  function getTreasureTapAllyAttackChanceBonus() {
    return window.GameRebirth?.getTapAllyAttackChanceBonus
      ? window.GameRebirth.getTapAllyAttackChanceBonus()
      : 0;
  }

  function getTreasureSuperCritChanceBonus() {
    return window.GameRebirth?.getSuperCritChanceBonus
      ? window.GameRebirth.getSuperCritChanceBonus()
      : 0;
  }

  function getTreasureBossDamagePercent() {
    return window.GameRebirth?.getBossDamagePercent
      ? window.GameRebirth.getBossDamagePercent()
      : 0;
  }

  function getTreasureFloorSkipChance() {
    return window.GameRebirth?.getFloorSkipChance
      ? window.GameRebirth.getFloorSkipChance()
      : 0;
  }

  function getEquippedOptionTotal(key) {
    return window.GameItems?.getEquippedOptionTotal
      ? window.GameItems.getEquippedOptionTotal(key)
      : 0;
  }

  function getGogglesAttackPercent() {
    return Math.max(0, state.player.goggles?.attackPercent || 0);
  }

  function calcTapDamageForLevel(level) {
    const base =
      Math.max(1, 1 + (level - 1) * PLAYER_TAP_UPGRADE_AMOUNT) +
      getTreasureAttackBonus();
    const totalPercent =
      getGogglesAttackPercent() + getEquippedOptionTotal("tapDamagePercent");
    let damage = Math.floor(base * (1 + totalPercent));
    if (totalPercent > 0 && damage <= base) damage = base + 1;
    return Math.max(1, damage);
  }

  function calcTapDamage() {
    return calcTapDamageForLevel(state.player.tapLevel);
  }

  function calcCritChance() {
    const base = 0.05 + state.player.critLevel * PLAYER_CRIT_CHANCE_UPGRADE;
    return Math.min(
      1,
      base + getEquippedOptionTotal("critBonus") + getTreasureCritChanceBonus(),
    );
  }

  function calcCritMultiplier() {
    const base = 1.5 + state.player.critDamageLevel * PLAYER_CRIT_DAMAGE_UPGRADE;
    return (
      base +
      getEquippedOptionTotal("critDamageBonus") +
      getTreasureCritDamageBonus()
    );
  }

  function calcSuperCritChance() {
    return Math.min(
      MAX_SUPER_CRIT_CHANCE,
      getEquippedOptionTotal("superCritChance") +
        getTreasureSuperCritChanceBonus(),
    );
  }

  function getGoldGainPercent() {
    return getEquippedOptionTotal("goldGainPercent");
  }

  function getTapAllyAttackChance() {
    return Math.min(
      1,
      getEquippedOptionTotal("tapAllyAttackChance") +
        getTreasureTapAllyAttackChanceBonus(),
    );
  }

  function getBossDamagePercent() {
    return (
      getEquippedOptionTotal("bossDamagePercent") + getTreasureBossDamagePercent()
    );
  }

  function applyBossDamageBonus(amount) {
    if (!state.enemy?.isBoss) return amount;
    const bonus = getBossDamagePercent();
    if (bonus <= 0) return amount;
    let damage = Math.floor(amount * (1 + bonus));
    if (damage <= amount) damage = amount + 1;
    return damage;
  }

  function showFloatingDamage(amount, isCrit, clientX, clientY, isSuperCrit) {
    const enemyArea = window.GameUI.enemyArea();
    const floatingNodes = enemyArea.querySelectorAll(".floating-dmg");
    if (floatingNodes.length >= MAX_FLOATING_DAMAGE_NODES) {
      floatingNodes[0].remove();
    }
    const rect = enemyArea.getBoundingClientRect();
    const node = document.createElement("div");
    node.className = "floating-dmg";
    node.style.left = `${(clientX ?? rect.left + rect.width / 2) - rect.left}px`;
    node.style.top = `${(clientY ?? rect.top + rect.height / 2) - rect.top}px`;
    node.style.color = isSuperCrit ? "#ff8ff3" : isCrit ? "#ffd36a" : "#eef3ff";
    node.textContent = isSuperCrit
      ? `超会心 ${window.GameUI.formatNumber(amount)}`
      : isCrit
        ? `会心 ${window.GameUI.formatNumber(amount)}`
        : window.GameUI.formatNumber(amount);
    enemyArea.appendChild(node);
    setTimeout(() => node.remove(), 780);
  }

  function formatTreasureRewardSummary(rewardEntries) {
    if (!rewardEntries.length) return "";
    return rewardEntries
      .map((treasure) => `${treasure.name}${treasure.rewardedCount}個`)
      .join("、");
  }

  function canSkipNextFloor(clearedFloor) {
    const nextFloor = clearedFloor + 1;
    const destinationFloor = clearedFloor + 2;
    return nextFloor % 10 !== 0 && destinationFloor % 10 !== 0;
  }

  function shouldSkipNextFloor(clearedFloor) {
    const chance = getTreasureFloorSkipChance();
    if (chance <= 0) return false;
    if (!canSkipNextFloor(clearedFloor)) return false;
    return Math.random() < chance;
  }

  function defeatEnemy() {
    const enemy = state.enemy;
    const clearedFloor = Math.max(1, Number(enemy?.floor) || state.floor);
    const goldGainPercent = getGoldGainPercent();
    const isDoubleGold = Math.random() < getTreasureEnemyGoldDoubleChance();
    let enemyGold = Math.floor(
      enemy.gold * (isDoubleGold ? 2 : 1) * (1 + goldGainPercent),
    );
    if (goldGainPercent > 0 && enemyGold <= enemy.gold) {
      enemyGold = enemy.gold + 1;
    }
    let reward = enemyGold + getTreasureGoldBonus();
    if (getTreasureGoldBonus() > 0 && reward <= enemy.gold) {
      reward = enemy.gold + getTreasureGoldBonus();
    }

    state.gold += reward;
    window.GameUI.addLog(`${window.GameUI.formatNumber(reward)}G 獲得。`);
    window.GameItems.tryDropItem();

    if (enemy.isBoss) {
      const bossTreasureRewards = window.GameRebirth?.grantBossDefeatTreasures
        ? window.GameRebirth.grantBossDefeatTreasures(clearedFloor)
        : [];
      if (bossTreasureRewards.length > 0) {
        window.GameUI.addLog(
          `ボス秘宝: ${formatTreasureRewardSummary(bossTreasureRewards)}を入手。`,
        );
      }
      state.pendingBossFloor = null;
      state.floor = clearedFloor + 1;
    } else {
      const nextFloor = clearedFloor + 1;
      const destinationFloor = clearedFloor + 2;
      if (shouldSkipNextFloor(clearedFloor)) {
        state.pendingBossFloor = null;
        state.floor = destinationFloor;
        window.GameUI.addLog(
          `${window.GameUI.formatNumber(nextFloor)}F をスキップして ${window.GameUI.formatNumber(destinationFloor)}F へ進んだ。`,
        );
      } else if (nextFloor % 10 === 0) {
        state.pendingBossFloor = nextFloor;
        state.floor = nextFloor - 1;
        window.GameUI.addLog(`${state.pendingBossFloor}F のボスに挑戦できます。`);
      } else {
        state.floor = nextFloor;
      }
    }

    window.GameEnemies.spawnEnemy();
  }

  function damageEnemy(
    amount,
    isCrit = false,
    source = "tap",
    clientX = null,
    clientY = null,
    isSuperCrit = false,
  ) {
    if (!state.enemy) return;
    const finalAmount = applyBossDamageBonus(amount);
    state.enemy.hp = Math.max(0, state.enemy.hp - finalAmount);
    state.recentAutoDamage += finalAmount;
    if (source !== "ally") {
      showFloatingDamage(finalAmount, isCrit, clientX, clientY, isSuperCrit);
    }
    if (state.enemy.hp <= 0) defeatEnemy();
    window.GameUI.renderBattle();
  }

  function onTapEnemy(event) {
    const tappedEnemy = state.enemy;
    const tapDamage = calcTapDamage();
    const superCrit = Math.random() < calcSuperCritChance();
    const crit = !superCrit && Math.random() < calcCritChance();
    const damage = Math.floor(
      tapDamage *
        (superCrit
          ? SUPER_CRIT_MULTIPLIER
          : crit
            ? calcCritMultiplier()
            : 1),
    );

    damageEnemy(
      damage,
      crit || superCrit,
      "tap",
      event.clientX,
      event.clientY,
      superCrit,
    );

    if (
      state.enemy === tappedEnemy &&
      state.enemy.hp > 0 &&
      Math.random() < getTapAllyAttackChance()
    ) {
      window.GameAllies.triggerTapAllyAttack();
    }
  }

  function getUpgradeDescriptions() {
    return {
      tap: `攻撃力が ${PLAYER_TAP_UPGRADE_AMOUNT} 増加`,
      crit: `会心率が ${Math.round(PLAYER_CRIT_CHANCE_UPGRADE * 100)}% 増加`,
      critDamage: `会心威力が ${Math.round(PLAYER_CRIT_DAMAGE_UPGRADE * 100)}% 増加`,
    };
  }

  function applyPlayerUpgradeCostReduction(baseCost) {
    return Math.max(1, baseCost - getTreasurePlayerUpgradeCostReduction());
  }

  function getUpgradeCosts() {
    return {
      tap: applyPlayerUpgradeCostReduction(
        Math.floor(
          20 * Math.pow(PLAYER_TAP_UPGRADE_COST_SCALE, state.player.tapLevel - 1),
        ),
      ),
      crit: applyPlayerUpgradeCostReduction(
        Math.floor(
          45 * Math.pow(PLAYER_CRIT_UPGRADE_COST_SCALE, state.player.critLevel),
        ),
      ),
      critDamage: applyPlayerUpgradeCostReduction(
        Math.floor(
          70 *
            Math.pow(
              PLAYER_CRIT_DAMAGE_UPGRADE_COST_SCALE,
              state.player.critDamageLevel,
            ),
        ),
      ),
    };
  }

  function purchaseUpgrade(type) {
    const costs = getUpgradeCosts();
    const cost =
      type === "tap"
        ? costs.tap
        : type === "crit"
          ? costs.crit
          : costs.critDamage;
    if (state.gold < cost) return;

    state.gold -= cost;
    if (type === "tap") state.player.tapLevel += 1;
    if (type === "crit") state.player.critLevel += 1;
    if (type === "critDamage") state.player.critDamageLevel += 1;

    window.GameUI.addLog("プレイヤーを強化した。");
    window.GameUI.render();
    window.GameSave.save();
  }

  window.GameBattle = {
    calcTapDamage,
    calcCritChance,
    calcCritMultiplier,
    calcSuperCritChance,
    getTapAllyAttackChance,
    getBossDamagePercent,
    getGoldGainPercent,
    getUpgradeCosts,
    getUpgradeDescriptions,
    purchaseUpgrade,
    damageEnemy,
    onTapEnemy,
  };
})();
