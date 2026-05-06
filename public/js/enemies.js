(function () {
  const state = window.GameState;
  const { enemyScaling } = window.GameConfig;
  const ENEMY_SLIME_IMAGE = `assets/slime.png?v=${encodeURIComponent(
    window.GameVersion || "dev",
  )}`;

  function getBossHpMultiplier(floor) {
    const baseBonus = enemyScaling.bossHpBonus || 0;
    const veryHighFloorStart = Math.max(
      1,
      Number(enemyScaling.veryHighFloorBossHpBonusStart) || 0,
    );
    if (floor >= veryHighFloorStart) {
      return 1 + (enemyScaling.veryHighFloorBossHpBonus ?? baseBonus);
    }

    const highFloorStart = Math.max(
      1,
      Number(enemyScaling.highFloorBossHpBonusStart) || 0,
    );
    const bonus =
      floor >= highFloorStart
        ? enemyScaling.highFloorBossHpBonus ?? baseBonus
        : baseBonus;
    return 1 + bonus;
  }

  function getNormalHpGrowthRate(floor) {
    const baseRate = enemyScaling.normalHpGrowthRate || 0.037;
    const veryHighFloorStart = Math.max(
      1,
      Number(enemyScaling.veryHighFloorNormalHpGrowthStart) || 0,
    );
    if (floor >= veryHighFloorStart) {
      return enemyScaling.veryHighFloorNormalHpGrowthRate ?? baseRate;
    }

    const highFloorStart = Math.max(
      1,
      Number(enemyScaling.highFloorNormalHpGrowthStart) || 0,
    );
    if (floor >= highFloorStart) {
      return enemyScaling.highFloorNormalHpGrowthRate ?? baseRate;
    }
    return baseRate;
  }

  function getStartingHp() {
    return Math.max(1, Math.floor(Number(enemyScaling.startingHp) || 50));
  }

  function calcNormalEnemyStats(floor) {
    let hp = getStartingHp();
    const tier = Math.floor((floor - 1) / 10);
    const gold = Math.floor(
      (enemyScaling.goldBase + floor * enemyScaling.goldPerFloor) *
        (1 + tier * enemyScaling.goldPerTier),
    );

    if (floor > 1) {
      const previousEnemy = calcEnemyData(floor - 1, false);
      hp = Math.max(
        1,
        Math.floor(previousEnemy.hp * (1 + getNormalHpGrowthRate(floor))),
      );
    }

    return { hp, gold };
  }

  function calcEnemyData(floor, forceBoss = false) {
    const isBoss = forceBoss || floor % 10 === 0;
    let hp;
    let gold;

    if (isBoss) {
      const previousFloor = Math.max(1, floor - 1);
      const previousEnemy = calcEnemyData(previousFloor, false);
      hp = Math.max(1, Math.floor(previousEnemy.hp * getBossHpMultiplier(floor)));
      gold = Math.max(
        1,
        Math.floor(previousEnemy.gold * 1.5),
      );
    } else {
      const normalStats = calcNormalEnemyStats(floor);
      hp = normalStats.hp;
      gold = normalStats.gold;
    }

    return {
      hp,
      maxHp: hp,
      gold,
      isBoss,
      icon: ENEMY_SLIME_IMAGE,
      name: isBoss ? "ボススライム" : "スライム",
      floor,
    };
  }

  function spawnEnemy() {
    state.enemy = calcEnemyData(state.floor);
    window.GameRebirth?.recordReachedFloor?.(state.enemy.floor);
    state.bossTimeLeft = 0;
    window.GameUI.enemyButton().textContent = "";
    if (state.pendingBossFloor !== null && state.settings?.autoChallengeBoss) {
      startBossBattle();
      return;
    }
    window.GameUI.render();
    window.GameSave.save();
  }

  function getBossTimeBonusSeconds() {
    const equipmentBonus = window.GameItems?.getEquippedOptionTotal
      ? window.GameItems.getEquippedOptionTotal("bossTimeBonusSeconds")
      : 0;
    return Math.floor(equipmentBonus);
  }

  function getBossTimeLimit() {
    return 30 + getBossTimeBonusSeconds();
  }

  function startBossBattle() {
    if (state.pendingBossFloor === null) return;
    state.enemy = calcEnemyData(state.pendingBossFloor, true);
    window.GameRebirth?.recordReachedFloor?.(state.enemy.floor);
    const timeLimit = getBossTimeLimit();
    state.bossTimeLeft = timeLimit;
    window.GameUI.enemyButton().textContent = "";
    window.GameUI.addLog(`ボスに挑戦。制限時間は ${timeLimit} 秒。`);
    window.GameUI.render();
    window.GameSave.save();
  }

  function failBoss() {
    if (state.pendingBossFloor !== null) {
      state.floor = Math.max(1, state.pendingBossFloor - 1);
    }
    state.enemy = calcEnemyData(state.floor);
    state.bossTimeLeft = 0;
    window.GameUI.enemyButton().textContent = "";
    window.GameUI.addLog(`ボスに敗北した。${state.floor}F に戻る。`);
    window.GameUI.render();
    window.GameSave.save();
  }

  function escapeBoss() {
    if (!state.enemy?.isBoss) return;
    if (state.pendingBossFloor !== null) {
      state.floor = Math.max(1, state.pendingBossFloor - 1);
    }
    state.enemy = calcEnemyData(state.floor);
    state.bossTimeLeft = 0;
    window.GameUI.enemyButton().textContent = "";
    window.GameUI.addLog(`ボスから逃げた。${state.floor}F に戻る。`);
    window.GameUI.render();
    window.GameSave.save();
  }

  window.GameEnemies = {
    calcEnemyData,
    getBossTimeBonusSeconds,
    getBossTimeLimit,
    spawnEnemy,
    startBossBattle,
    failBoss,
    escapeBoss,
  };
})();
