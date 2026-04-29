(function () {
  const state = window.GameState;
  const { equipmentTypeDefinitions } = window.GameConfig;

  const els = {
    floorValue: document.getElementById("floorValue"),
    goldValue: document.getElementById("goldValue"),
    dpsValue: document.getElementById("dpsValue"),
    enemyButton: document.getElementById("enemyButton"),
    enemyArea: document.getElementById("enemyArea"),
    hpFill: document.getElementById("hpFill"),
    hpText: document.getElementById("hpText"),
    timerText: document.getElementById("timerText"),
    challengeBossBtn: document.getElementById("challengeBossBtn"),
    escapeBossBtn: document.getElementById("escapeBossBtn"),
    tapInfo: document.getElementById("tapInfo"),
    critInfo: document.getElementById("critInfo"),
    log: document.getElementById("log"),
    tapLevelText: document.getElementById("tapLevelText"),
    critLevelText: document.getElementById("critLevelText"),
    critDmgLevelText: document.getElementById("critDmgLevelText"),
    tapDescriptionText: document.getElementById("tapDescriptionText"),
    critDescriptionText: document.getElementById("critDescriptionText"),
    critDmgDescriptionText: document.getElementById("critDmgDescriptionText"),
    rebirthDescriptionText: document.getElementById("rebirthDescriptionText"),
    buyTapBtn: document.getElementById("buyTapBtn"),
    buyCritBtn: document.getElementById("buyCritBtn"),
    buyCritDmgBtn: document.getElementById("buyCritDmgBtn"),
    maxTapBtn: document.getElementById("maxTapBtn"),
    maxCritBtn: document.getElementById("maxCritBtn"),
    maxCritDmgBtn: document.getElementById("maxCritDmgBtn"),
    rebirthBtn: document.getElementById("rebirthBtn"),
    buyTapCost: document.getElementById("buyTapCost"),
    buyCritCost: document.getElementById("buyCritCost"),
    buyCritDmgCost: document.getElementById("buyCritDmgCost"),
    allyList: document.getElementById("allyList"),
    itemEquipPane: document.getElementById("item-tab-equip"),
    itemTreasurePane: document.getElementById("item-tab-treasure"),
    recordStatusPane: document.getElementById("record-tab-record"),
    recordSettingsPane: document.getElementById("record-tab-settings"),
    recordVersionText: document.getElementById("recordVersionText"),
    gogglesSlot: document.getElementById("gogglesSlot"),
    compassSlot: document.getElementById("compassSlot"),
    itemSettingsSection: document.getElementById("itemSettingsSection"),
    inventoryList: document.getElementById("inventoryList"),
    statusList: document.getElementById("statusList"),
    recordSettingsList: document.getElementById("recordSettingsList"),
    screens: {
      battle: document.getElementById("screen-battle"),
      upgrade: document.getElementById("screen-upgrade"),
      party: document.getElementById("screen-party"),
      equip: document.getElementById("screen-equip"),
      record: document.getElementById("screen-record"),
    },
  };

  let synthesisBaseItemId = null;
  let currentTab = "upgrade";
  let currentScreen = "upgrade";
  let currentItemTab = "equip";
  let currentRecordTab = "record";
  let currentEquipInventoryTab = "goggles";
  let lastBattleRenderAt = 0;
  const BATTLE_RENDER_INTERVAL_MS = 66;

  function enemyButton() {
    return els.enemyButton;
  }

  function enemyArea() {
    return els.enemyArea;
  }

  function formatNumber(value) {
    return Math.floor(value).toLocaleString("ja-JP");
  }

  function formatPercent(value, digits = 0) {
    return (value * 100).toFixed(digits);
  }

  function setTextIfChanged(element, text) {
    if (element.textContent !== text) {
      element.textContent = text;
    }
  }

  function setDisplayIfChanged(element, value) {
    if (element.style.display !== value) {
      element.style.display = value;
    }
  }

  function addLog(text) {
    const entry = document.createElement("div");
    entry.textContent = text;
    els.log.prepend(entry);
    while (els.log.children.length > 5) {
      els.log.removeChild(els.log.lastChild);
    }
  }

  function renderBattle(force = false) {
    const enemy = state.enemy;
    if (!enemy) return;

    const now = performance.now();
    if (!force && now - lastBattleRenderAt < BATTLE_RENDER_INTERVAL_MS) return;
    lastBattleRenderAt = now;

    if (now - state.recentAutoWindowStart > 1000) {
      state.recentAutoDamage = 0;
      state.recentAutoWindowStart = now;
    }

    setTextIfChanged(els.floorValue, `${enemy.floor || state.floor}F`);
    setTextIfChanged(els.goldValue, formatNumber(state.gold));
    setTextIfChanged(els.dpsValue, formatNumber(state.recentAutoDamage));
    setTextIfChanged(els.enemyButton, "");
    els.enemyButton.style.backgroundImage = enemy.icon
      ? `url("${enemy.icon}")`
      : "";
    els.enemyButton.classList.toggle("is-boss", Boolean(enemy.isBoss));
    els.enemyButton.setAttribute("aria-label", `${enemy.name || "敵"}を攻撃`);
    setDisplayIfChanged(
      els.challengeBossBtn,
      !enemy.isBoss && state.pendingBossFloor !== null ? "inline-flex" : "none",
    );
    setDisplayIfChanged(els.escapeBossBtn, enemy.isBoss ? "inline-flex" : "none");
    els.hpFill.style.width = `${Math.max(0, enemy.hp / enemy.maxHp) * 100}%`;
    setTextIfChanged(
      els.hpText,
      `${formatNumber(enemy.hp)} / ${formatNumber(enemy.maxHp)}`,
    );
    setTextIfChanged(
      els.tapInfo,
      `攻撃力: ${formatNumber(window.GameBattle.calcTapDamage())}`,
    );
    setTextIfChanged(
      els.critInfo,
      `会心率 ${Math.floor(window.GameBattle.calcCritChance() * 100)}% / 超会心率 ${(window.GameBattle.calcSuperCritChance() * 100).toFixed(1)}%`,
    );
    setTextIfChanged(
      els.timerText,
      enemy.isBoss
      ? `残り ${Math.ceil(state.bossTimeLeft)}秒`
      : state.pendingBossFloor !== null
        ? `ボス: ${state.pendingBossFloor}F`
        : "--",
    );
  }

  function renderUpgrade() {
    const costs = window.GameBattle.getUpgradeCosts();
    const descriptions = window.GameBattle.getUpgradeDescriptions();
    const rewardCount = window.GameRebirth?.getRebirthRewardCount
      ? window.GameRebirth.getRebirthRewardCount()
      : 0;
    const extraTreasureChance = window.GameRebirth?.getExtraTreasureChance
      ? window.GameRebirth.getExtraTreasureChance()
      : 0;
    const nextUnlockTreasureChance =
      window.GameRebirth?.getNextUnlockTreasureChance
        ? window.GameRebirth.getNextUnlockTreasureChance()
        : 0;
    const nextRebirthExtraTreasureCount =
      window.GameRebirth?.getNextRebirthExtraTreasureCount
        ? window.GameRebirth.getNextRebirthExtraTreasureCount()
        : 0;
    const rebirthStartingGoldBonus = window.GameRebirth?.getRebirthStartingGoldBonus
      ? window.GameRebirth.getRebirthStartingGoldBonus()
      : 0;
    const reachFloor = window.GameRebirth?.getReachFloor
      ? window.GameRebirth.getReachFloor()
      : Math.max(0, (Number(state.floor) || 1) - 1);

    els.tapLevelText.textContent = `Lv.${state.player.tapLevel}`;
    els.critLevelText.textContent = `Lv.${state.player.critLevel}`;
    els.critDmgLevelText.textContent = `Lv.${state.player.critDamageLevel}`;
    els.tapDescriptionText.textContent = descriptions.tap;
    els.critDescriptionText.textContent = descriptions.crit;
    els.critDmgDescriptionText.textContent = descriptions.critDamage;
    els.buyTapCost.textContent = `費用 ${formatNumber(costs.tap)}G`;
    els.buyCritCost.textContent = `費用 ${formatNumber(costs.crit)}G`;
    els.buyCritDmgCost.textContent = `費用 ${formatNumber(costs.critDamage)}G`;
    els.buyTapBtn.disabled = state.gold < costs.tap;
    els.buyCritBtn.disabled = state.gold < costs.crit;
    els.buyCritDmgBtn.disabled = state.gold < costs.critDamage;
    els.maxTapBtn.disabled = state.gold < costs.tap;
    els.maxCritBtn.disabled = state.gold < costs.crit;
    els.maxCritDmgBtn.disabled = state.gold < costs.critDamage;
    els.rebirthDescriptionText.textContent =
      `現在撃破 ${formatNumber(reachFloor)}F / 50Fごとに加算量 +1ずつ増加 / 今回 ${formatNumber(rewardCount)}個${nextRebirthExtraTreasureCount > 0 ? ` / 鍵確定 +${formatNumber(nextRebirthExtraTreasureCount)}個` : ""}${extraTreasureChance > 0 ? ` / 追加秘宝率 ${formatPercent(extraTreasureChance, 0)}%` : ""}${rebirthStartingGoldBonus > 0 ? ` / 開始ゴールド +${formatNumber(rebirthStartingGoldBonus)}` : ""}`;
    els.rebirthBtn.disabled = rewardCount <= 0;
  }

  function formatSeconds(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  function renderParty() {
    const {
      allyTemplates,
      getOwnedAlly,
      getAllyAttack,
      getAllyAttackIntervalSeconds,
      getPartyLevel,
      getPartyAttackBonus,
      getPartyUpgradeCost,
      getPartyUpgradeAmount,
      canUpgradePartyLevel,
    } = window.GameAllies;
    const partyLevel = getPartyLevel();
    const partyAttackBonus = formatNumber(getPartyAttackBonus());
    const partyUpgradeCost = getPartyUpgradeCost();
    const partyUpgradeAmount = formatNumber(getPartyUpgradeAmount());
    const canUpgradeParty = canUpgradePartyLevel();

    function allySummary(ally) {
      const interval = formatSeconds(getAllyAttackIntervalSeconds(ally));
      return `攻撃 ${formatNumber(getAllyAttack(ally))} / ${interval}秒ごとに攻撃`;
    }

    const partyCard = `
      <div class="row-card">
        <div class="row-top">
          <div>
            <div class="item-name">パーティーレベル Lv.${partyLevel}</div>
            <div class="small">仲間全体の攻撃力 +${partyAttackBonus}</div>
          </div>
        </div>
        <div class="actions">
          <button class="btn primary" data-upgrade-party="1" ${!canUpgradeParty || state.gold < partyUpgradeCost ? "disabled" : ""}>全員攻撃 +${partyUpgradeAmount} / ${canUpgradeParty ? `${formatNumber(partyUpgradeCost)}G` : "--"}</button>
        </div>
      </div>
    `;

    const allyCards = allyTemplates
      .map((template) => {
        const ally = getOwnedAlly(template.id);
        if (!ally) {
          const interval = formatSeconds(
            getAllyAttackIntervalSeconds(template),
          );
          return `<div class="row-card"><div class="row-top"><div><div class="item-name">${template.name}</div><div class="small">攻撃 ${template.baseAtk} / ${interval}秒ごとに攻撃</div></div><div class="small">雇用 ${formatNumber(template.hireCost)}G</div></div><div class="actions"><button class="btn good" data-hire="${template.id}" ${state.gold < template.hireCost || state.alliesOwned.length >= 10 ? "disabled" : ""}>雇用</button></div></div>`;
        }

        return `<div class="row-card"><div class="row-top"><div><span class="item-name">${ally.name}</span><div class="small">${allySummary(ally)}</div></div></div></div>`;
      })
      .join("");

    els.allyList.innerHTML = `${partyCard}${allyCards}`;
  }

  function renderInventoryActions(item, isLocked, lockBtnClass, lockBtnText) {
    /*
      const { canSynthesizeItem, canUseAsSynthesisMaterial } = window.GameItems;

      if (synthesisBaseItemId !== null) {
        if (item.id === synthesisBaseItemId) {
          return '<button class="btn primary" disabled>合成元</button><button class="btn" data-cancel-synthesis="1">キャンセル</button>';
        }
        if (
          !item.isEquipped &&
          canUseAsSynthesisMaterial(synthesisBaseItemId, item.id)
        ) {
          return `<button class="btn good" data-synthesis-material="${item.id}">素材にする</button><button class="btn" data-cancel-synthesis="1">キャンセル</button>`;
        }
        return '<button class="btn" disabled>合成不可</button><button class="btn" data-cancel-synthesis="1">キャンセル</button>';
      }

      const synthButton = canSynthesizeItem(item.id)
        ? `<button class="btn primary" data-start-synthesis="${item.id}">合成</button>`
        : "";
      const bulkSynthButton = canSynthesizeItem(item.id)
        ? `<button class="btn primary" data-bulk-synthesis="${item.id}">一括合成</button>`
        : "";
    */

    if (item.isEquipped) {
      return `<button class="btn danger" data-unequip="${item.equipSlot}">外す</button>`;
    }

    return `<button class="btn good" data-equip="${item.id}">装備</button><button class="btn ${lockBtnClass}" data-toggle-lock="${item.id}">${lockBtnText}</button><button class="btn warn" data-discard="${item.id}" ${isLocked ? "disabled" : ""}>捨てる</button>`;
  }

  function renderSlot(slotKey, item) {
    const typeDef = equipmentTypeDefinitions[slotKey];
    const itemDetail = window.GameItems.itemDetail;
    const getItemDisplayName = window.GameItems.getItemDisplayName;

    if (!item) {
      return `<div class="equip-slot-header"><div><div class="item-name">未装備</div></div></div><div class="small equip-slot-detail">${typeDef.description}</div>`;
    }

    return `<div class="equip-slot-header"><div class="equip-slot-title"><div class="item-name">${getItemDisplayName(item)}</div></div><button class="btn danger equip-slot-button" data-unequip="${slotKey}">外す</button></div><div class="equip-slot-meta"><div class="rarity-badge rarity-${item.rarity}">${item.rarityName}</div></div><div class="small equip-slot-detail">${itemDetail(item)}</div>`;
  }

  function renderEquip() {
    const { isItemLocked, getItemDisplayName, itemDetail } = window.GameItems;

    els.gogglesSlot.className = "row-card equip-slot-card";
    els.compassSlot.className = "row-card equip-slot-card";
    els.gogglesSlot.innerHTML = renderSlot("goggles", state.player.goggles);
    els.compassSlot.innerHTML = renderSlot("compass", state.player.compass);

    const equipped = [];
    if (state.player.goggles) {
      equipped.push({
        ...state.player.goggles,
        isEquipped: true,
        equipSlot: "goggles",
      });
    }
    if (state.player.compass) {
      equipped.push({
        ...state.player.compass,
        isEquipped: true,
        equipSlot: "compass",
      });
    }

    const allItems = [
      ...equipped,
      ...state.inventory.map((item) => ({ ...item, isEquipped: false })),
    ];

    /*
      if (
        synthesisBaseItemId !== null &&
        !allItems.some(
          (item) =>
            item.id === synthesisBaseItemId &&
            window.GameItems.canSynthesizeItem(item.id),
        )
      ) {
        synthesisBaseItemId = null;
      }

      const synthesisBaseItem =
        synthesisBaseItemId !== null
          ? allItems.find((item) => item.id === synthesisBaseItemId) || null
          : null;
      if (
        synthesisBaseItem &&
        (synthesisBaseItem.type === "goggles" || synthesisBaseItem.type === "compass")
      ) {
        currentEquipInventoryTab = synthesisBaseItem.type;
      }
    */

    const filteredItems = allItems.filter(
      (item) => item.type === currentEquipInventoryTab,
    );
    const currentTypeLabel =
      equipmentTypeDefinitions[currentEquipInventoryTab]?.label ||
      equipmentTypeDefinitions.goggles.label;
    const inventoryTabs = `
      <div class="item-subtabs">
        <button class="item-tab-btn equip-inventory-tab-btn ${currentEquipInventoryTab === "goggles" ? "active" : ""}" data-equip-inventory-tab="goggles">ゴーグル</button>
        <button class="item-tab-btn equip-inventory-tab-btn ${currentEquipInventoryTab === "compass" ? "active" : ""}" data-equip-inventory-tab="compass">コンパス</button>
      </div>
    `;
    /*
      const synthesisStatus = synthesisBaseItem
        ? `<div class="row-card"><div class="row-top"><div><div class="item-name">合成中: ${getItemDisplayName(synthesisBaseItem)}</div><div class="small">${itemDetail(synthesisBaseItem)}</div></div></div><div class="actions"><button class="btn" data-cancel-synthesis="1">キャンセル</button></div></div>`
        : "";
    */

    els.inventoryList.innerHTML = `${inventoryTabs}${
      filteredItems.length === 0
        ? '<div class="row-card small">まだ装備を持っていません。</div>'
        : filteredItems
            .map((item) => {
              const isLocked = isItemLocked(item.id);
              const lockBtnClass = isLocked ? "locked" : "";
              const lockBtnText = isLocked ? "ロック中" : "ロック";
              const actions = renderInventoryActions(
                item,
                isLocked,
                lockBtnClass,
                lockBtnText,
              );
              return `<div class="row-card"><div class="row-top"><div><div class="item-name">${item.isEquipped ? "【装備中】" : ""}${getItemDisplayName(item)}</div><div class="rarity-badge rarity-${item.rarity}">${item.rarityName}</div><div class="small">${itemDetail(item)}</div></div></div><div class="actions">${actions}</div></div>`;
            })
            .join("")
    }`;

    els.itemSettingsSection.innerHTML = `
      <div class="section-title">装備設定</div>
      <div class="equip-settings-list">
        <div class="row-card equip-setting-card">
          <div class="item-name">自動破棄</div>
          <select id="autoDiscardRaritySelect" class="btn equip-setting-control equip-setting-select">
            ${[
              ["none", "なし"],
              ["common", "コモン"],
              ["uncommon", "アンコモン"],
              ["rare", "レア"],
              ["epic", "エピック"],
              ["legendary", "レジェンダリー"],
            ]
              .map(
                ([rarity, label]) =>
                  `<option value="${rarity}" ${state.itemSettings.autoDiscardRarity === rarity ? "selected" : ""}>${label}</option>`,
                )
              .join("")}
          </select>
        </div>
        <div class="row-card equip-setting-card">
          <div>
            <div class="item-name">攻撃力で自動破棄</div>
            <div class="small">主ステータスがこの値未満なら捨てる（0で無効）</div>
          </div>
          <input
            id="autoDiscardAttackInput"
            class="btn equip-setting-control equip-setting-number"
            type="number"
            min="0"
            step="0.1"
            inputmode="decimal"
            value="${Number(state.itemSettings.autoDiscardAttackPercent) || 0}"
          >
        </div>
        <div class="row-card equip-setting-card">
          <div class="item-name">一括破棄</div>
          <button class="btn warn equip-setting-control equip-setting-button" id="bulkDiscardBtn">実行</button>
        </div>
      </div>
    `;
  }

  function renderTreasure() {
    if (!window.GameRebirth) return;

    const playerAttackBonus = window.GameRebirth.getPlayerAttackBonus();
    const allyAttackBonus = window.GameRebirth.getAllyAttackBonus();
    const allyAttackIntervalReductionSeconds =
      window.GameRebirth.getAllyAttackIntervalReductionSeconds();
    const goldBonus = window.GameRebirth.getGoldBonus();
    const playerUpgradeCostReduction =
      window.GameRebirth.getPlayerUpgradeCostReduction();
    const allyUpgradeCostReduction =
      window.GameRebirth.getAllyUpgradeCostReduction();
    const critChanceBonus = window.GameRebirth.getCritChanceBonus();
    const critDamageBonus = window.GameRebirth.getCritDamageBonus();
    const tapAllyAttackChanceBonus =
      window.GameRebirth.getTapAllyAttackChanceBonus();
    const superCritChanceBonus = window.GameRebirth.getSuperCritChanceBonus();
    const itemDropRateBonus = window.GameRebirth.getItemDropRateBonus();
    const droppedEquipmentAttackBonus =
      window.GameRebirth.getDroppedEquipmentAttackBonus();
    const extraTreasureChance = window.GameRebirth.getExtraTreasureChance();
    const floorSkipChance = window.GameRebirth.getFloorSkipChance();
    const nextRebirthExtraTreasureCount =
      window.GameRebirth.getNextRebirthExtraTreasureCount();
    const rebirthStartingGoldBonus = window.GameRebirth.getRebirthStartingGoldBonus();
    const enemyGoldDoubleChance = window.GameRebirth.getEnemyGoldDoubleChance();
    const bossTreasureRewardCount = window.GameRebirth.getBossTreasureRewardCount();
    const bossTreasureRewardFloorOffset =
      window.GameRebirth.getBossTreasureRewardFloorOffset();
    const bossDamagePercent = window.GameRebirth.getBossDamagePercent();
    const bossTimeBonusSeconds = window.GameRebirth.getBossTimeBonusSeconds();
    const ownedTreasures = window.GameRebirth.getOwnedTreasureEntries();
    const treasureEffectSummary = [];
    if (playerAttackBonus > 0) {
      treasureEffectSummary.push(
        `プレイヤー攻撃力 +${formatNumber(playerAttackBonus)}`,
      );
    }
    if (allyAttackBonus > 0) {
      treasureEffectSummary.push(
        `仲間攻撃力 +${formatNumber(allyAttackBonus)}`,
      );
    }
    if (allyAttackIntervalReductionSeconds > 0) {
      treasureEffectSummary.push(
        `仲間攻撃間隔: -${formatSeconds(allyAttackIntervalReductionSeconds)}秒`,
      );
    }
    if (goldBonus > 0) {
      treasureEffectSummary.push(`ゴールド +${formatNumber(goldBonus)}`);
    }
    if (playerUpgradeCostReduction > 0) {
      treasureEffectSummary.push(
        `プレイヤー強化費用 -${formatNumber(playerUpgradeCostReduction)}`,
      );
    }
    if (allyUpgradeCostReduction > 0) {
      treasureEffectSummary.push(
        `仲間強化費用 -${formatNumber(allyUpgradeCostReduction)}`,
      );
    }
    if (critChanceBonus > 0) {
      treasureEffectSummary.push(
        `会心率 +${formatPercent(critChanceBonus, 0)}%`,
      );
    }
    if (critDamageBonus > 0) {
      treasureEffectSummary.push(
        `クリティカルダメージ +${formatPercent(critDamageBonus, 0)}%`,
      );
    }
    if (tapAllyAttackChanceBonus > 0) {
      treasureEffectSummary.push(
        `タップ時仲間追撃率 +${formatPercent(tapAllyAttackChanceBonus, 0)}%`,
      );
    }
    if (superCritChanceBonus > 0) {
      treasureEffectSummary.push(
        `超会心率 +${formatPercent(superCritChanceBonus, 1)}%`,
      );
    }
    if (itemDropRateBonus > 0) {
      treasureEffectSummary.push(
        `装備ドロップ率 +${formatPercent(itemDropRateBonus, 0)}%`,
      );
    }
    if (droppedEquipmentAttackBonus > 0) {
      treasureEffectSummary.push(
        `ドロップ装備攻撃力 +${formatPercent(droppedEquipmentAttackBonus, 1)}%`,
      );
    }
    if (extraTreasureChance > 0) {
      treasureEffectSummary.push(
        `追加秘宝率 +${formatPercent(extraTreasureChance, 0)}%`,
      );
    }
    if (floorSkipChance > 0) {
      treasureEffectSummary.push(
        `次階層スキップ率 +${formatPercent(floorSkipChance, 0)}%`,
      );
    }
    if (nextRebirthExtraTreasureCount > 0) {
      treasureEffectSummary.push(
        `次転生追加秘宝確定: +${formatNumber(nextRebirthExtraTreasureCount)}個`,
      );
    }
    if (rebirthStartingGoldBonus > 0) {
      treasureEffectSummary.push(
        `転生開始ゴールド +${formatNumber(rebirthStartingGoldBonus)}`,
      );
    }
    if (enemyGoldDoubleChance > 0) {
      treasureEffectSummary.push(
        `敵ゴールド2倍率 +${formatPercent(enemyGoldDoubleChance, 0)}%`,
      );
    }
    if (bossTreasureRewardCount > 0) {
      treasureEffectSummary.push(
        `ボス撃破秘宝 +${formatNumber(bossTreasureRewardCount)}個（${formatNumber(bossTreasureRewardFloorOffset)}F相当）`,
      );
    }
    if (bossDamagePercent > 0) {
      treasureEffectSummary.push(
        `ボスダメージ +${formatPercent(bossDamagePercent, 0)}%`,
      );
    }
    if (bossTimeBonusSeconds > 0) {
      treasureEffectSummary.push(
        `ボス制限時間 +${formatNumber(bossTimeBonusSeconds)}秒`,
      );
    }
    const treasureRows = ownedTreasures
      .map((treasure) => {
        const effectLines = [];
        if (treasure.totalAttackBonus) {
          effectLines.push(`合計攻撃力 +${formatNumber(treasure.totalAttackBonus)}`);
        }
        if (treasure.totalAllyAttackBonus) {
          effectLines.push(
            `合計仲間攻撃力 +${formatNumber(treasure.totalAllyAttackBonus)}`,
          );
        }
        if (treasure.totalAllyAttackIntervalReductionSeconds) {
          effectLines.push(
            `仲間攻撃間隔: -${formatSeconds(treasure.totalAllyAttackIntervalReductionSeconds)}秒`,
          );
        }
        if (treasure.totalGoldBonus) {
          effectLines.push(`合計ゴールド +${formatNumber(treasure.totalGoldBonus)}`);
        }
        if (treasure.totalPlayerUpgradeCostReduction) {
          effectLines.push(
            `合計プレイヤー強化費用 -${formatNumber(treasure.totalPlayerUpgradeCostReduction)}`,
          );
        }
        if (treasure.totalAllyUpgradeCostReduction) {
          effectLines.push(
            `合計仲間強化費用 -${formatNumber(treasure.totalAllyUpgradeCostReduction)}`,
          );
        }
        if (treasure.totalCritChanceBonus) {
          effectLines.push(
            `合計会心率 +${formatPercent(treasure.totalCritChanceBonus, 0)}%`,
          );
        }
        if (treasure.totalCritDamageBonus) {
          effectLines.push(
            `合計クリティカルダメージ +${formatPercent(treasure.totalCritDamageBonus, 0)}%`,
          );
        }
        if (treasure.totalTapAllyAttackChanceBonus) {
          effectLines.push(
            `合計タップ時仲間追撃率 +${formatPercent(treasure.totalTapAllyAttackChanceBonus, 0)}%`,
          );
        }
        if (treasure.totalSuperCritChanceBonus) {
          effectLines.push(
            `合計超会心率 +${formatPercent(treasure.totalSuperCritChanceBonus, 1)}%`,
          );
        }
        if (treasure.totalItemDropRateBonus) {
          effectLines.push(
            `合計装備ドロップ率 +${formatPercent(treasure.totalItemDropRateBonus, 0)}%`,
          );
        }
        if (treasure.totalDroppedEquipmentAttackBonus) {
          effectLines.push(
            `合計ドロップ装備攻撃力 +${formatPercent(treasure.totalDroppedEquipmentAttackBonus, 1)}%`,
          );
        }
        if (treasure.totalExtraTreasureChance) {
          effectLines.push(
            `合計追加秘宝率 +${formatPercent(treasure.totalExtraTreasureChance, 0)}%`,
          );
        }
        if (treasure.totalFloorSkipChance) {
          effectLines.push(
            `合計次階層スキップ率 +${formatPercent(treasure.totalFloorSkipChance, 0)}%`,
          );
        }
        if (treasure.totalNextRebirthExtraTreasureCount) {
          effectLines.push(
            `次転生追加秘宝確定: +${formatNumber(treasure.totalNextRebirthExtraTreasureCount)}個`,
          );
        }
        if (treasure.totalRebirthStartingGoldBonus) {
          effectLines.push(
            `合計転生開始ゴールド +${formatNumber(treasure.totalRebirthStartingGoldBonus)}`,
          );
        }
        if (treasure.totalEnemyGoldDoubleChance) {
          effectLines.push(
            `合計敵ゴールド2倍率 +${formatPercent(treasure.totalEnemyGoldDoubleChance, 0)}%`,
          );
        }
        if (treasure.totalBossTreasureRewardCount) {
          effectLines.push(
            `合計ボス撃破秘宝 +${formatNumber(treasure.totalBossTreasureRewardCount)}個`,
          );
        }
        if (treasure.totalBossDamagePercent) {
          effectLines.push(
            `合計ボスダメージ +${formatPercent(treasure.totalBossDamagePercent, 0)}%`,
          );
        }
        if (treasure.totalBossTimeBonusSeconds) {
          effectLines.push(
            `合計ボス制限時間 +${formatNumber(treasure.totalBossTimeBonusSeconds)}秒`,
          );
        }
        return `<div class="row-card"><div class="row-top"><div><div class="item-name">${treasure.name} x${formatNumber(treasure.count)}</div><div class="small">${treasure.description}${effectLines.length ? ` / ${effectLines.join(" / ")}` : ""}</div></div></div></div>`;
      })
      .join("");
    const treasureListContent =
      treasureRows ||
      '<div class="row-card"><div class="small">まだ秘宝を持っていません。</div></div>';

    els.itemTreasurePane.innerHTML = `
      <div class="panel-inner-gap">
        <div class="section-title">秘宝一覧</div>
        <div class="list">
          <div class="row-card">
            <div class="item-name">秘宝効果</div>
            <div class="small">${treasureEffectSummary.join(" / ") || "まだ秘宝効果はありません。"}</div>
          </div>
          ${treasureListContent}
        </div>
      </div>
    `;
  }

  function renderStatus() {
    const tapDamage = window.GameBattle.calcTapDamage();
    const critChance = window.GameBattle.calcCritChance();
    const critMultiplier = window.GameBattle.calcCritMultiplier();
    const superCritChance = window.GameBattle.calcSuperCritChance();
    const goldGainPercent = window.GameBattle.getGoldGainPercent();
    const tapAllyAttackChance = window.GameBattle.getTapAllyAttackChance();
    const bossDamagePercent = window.GameBattle.getBossDamagePercent();
    const itemDropChance = window.GameItems.getItemDropChance();
    const itemDropBonus = window.GameItems.getEquippedOptionTotal(
      "itemDropRatePercent",
    );
    const bossTimeLimit = window.GameEnemies.getBossTimeLimit();
    const bossTimeBonus = window.GameEnemies.getBossTimeBonusSeconds();
    const treasureAttackBonus = window.GameRebirth?.getPlayerAttackBonus
      ? window.GameRebirth.getPlayerAttackBonus()
      : 0;
    const treasureAllyAttackBonus = window.GameRebirth?.getAllyAttackBonus
      ? window.GameRebirth.getAllyAttackBonus()
      : 0;
    const treasureAllyAttackIntervalReductionSeconds =
      window.GameRebirth?.getAllyAttackIntervalReductionSeconds
        ? window.GameRebirth.getAllyAttackIntervalReductionSeconds()
        : 0;
    const treasureGoldBonus = window.GameRebirth?.getGoldBonus
      ? window.GameRebirth.getGoldBonus()
      : 0;
    const treasurePlayerUpgradeCostReduction =
      window.GameRebirth?.getPlayerUpgradeCostReduction
        ? window.GameRebirth.getPlayerUpgradeCostReduction()
        : 0;
    const treasureAllyUpgradeCostReduction =
      window.GameRebirth?.getAllyUpgradeCostReduction
        ? window.GameRebirth.getAllyUpgradeCostReduction()
        : 0;
    const treasureItemDropRateBonus = window.GameRebirth?.getItemDropRateBonus
      ? window.GameRebirth.getItemDropRateBonus()
      : 0;
    const treasureDroppedEquipmentAttackBonus =
      window.GameRebirth?.getDroppedEquipmentAttackBonus
        ? window.GameRebirth.getDroppedEquipmentAttackBonus()
        : 0;
    const treasureExtraTreasureChance = window.GameRebirth?.getExtraTreasureChance
      ? window.GameRebirth.getExtraTreasureChance()
      : 0;
    const treasureFloorSkipChance = window.GameRebirth?.getFloorSkipChance
      ? window.GameRebirth.getFloorSkipChance()
      : 0;
    const treasureNextRebirthExtraTreasureCount =
      window.GameRebirth?.getNextRebirthExtraTreasureCount
        ? window.GameRebirth.getNextRebirthExtraTreasureCount()
        : 0;
    const treasureRebirthStartingGoldBonus =
      window.GameRebirth?.getRebirthStartingGoldBonus
        ? window.GameRebirth.getRebirthStartingGoldBonus()
        : 0;
    const treasureBossTreasureRewardCount =
      window.GameRebirth?.getBossTreasureRewardCount
        ? window.GameRebirth.getBossTreasureRewardCount()
        : 0;
    const ownedTreasureCount = window.GameRebirth?.getOwnedTreasureEntries
      ? window.GameRebirth.getOwnedTreasureEntries().length
      : 0;
    const totalTreasureCount = window.GameRebirth?.getTreasureEntries
      ? window.GameRebirth.getTreasureEntries().length
      : 0;
    const gogglesAttack = state.player.goggles?.attackPercent || 0;
    const compassAttack = state.player.compass?.allyAttackPercent || 0;
    const partyLevel = window.GameAllies?.getPartyLevel
      ? window.GameAllies.getPartyLevel()
      : 1;
    const partyAttackBonus = window.GameAllies?.getPartyAttackBonus
      ? window.GameAllies.getPartyAttackBonus()
      : 0;
    const activeAllies = window.GameAllies?.getActiveAllies
      ? window.GameAllies.getActiveAllies()
      : [];
    const totalAllyAttack = activeAllies.reduce(
      (total, ally) => total + (window.GameAllies?.getAllyAttack?.(ally) || 0),
      0,
    );

    const playerLines = [];
    if (tapDamage > 1) {
      playerLines.push(`攻撃力: ${formatNumber(tapDamage)}`);
    }
    if (gogglesAttack > 0) {
      playerLines.push(`ゴーグル攻撃力: +${formatPercent(gogglesAttack, 1)}%`);
    }
    if (treasureAttackBonus > 0) {
      playerLines.push(`秘宝攻撃力: +${formatNumber(treasureAttackBonus)}`);
    }
    if (critChance > 0.05) {
      playerLines.push(`会心率: ${formatPercent(critChance, 0)}%`);
    }
    if (critMultiplier > 1.5) {
      playerLines.push(`会心威力: ${formatPercent(critMultiplier, 0)}%`);
    }
    if (superCritChance > 0) {
      playerLines.push(`超会心率: ${formatPercent(superCritChance, 1)}%`);
    }
    if (goldGainPercent > 0) {
      playerLines.push(`ゴールド倍率: +${formatPercent(goldGainPercent, 0)}%`);
    }
    if (treasureGoldBonus > 0) {
      playerLines.push(`秘宝ゴールド +${formatNumber(treasureGoldBonus)}`);
    }
    if (treasureRebirthStartingGoldBonus > 0) {
      playerLines.push(
        `転生開始ゴールド +${formatNumber(treasureRebirthStartingGoldBonus)}`,
      );
    }
    if (treasurePlayerUpgradeCostReduction > 0) {
      playerLines.push(
        `プレイヤー強化費用: -${formatNumber(treasurePlayerUpgradeCostReduction)}`,
      );
    }

    const allyLines = [];
    if (totalAllyAttack > 0) {
      allyLines.push(`仲間合計攻撃力: ${formatNumber(totalAllyAttack)}`);
    }
    if (compassAttack > 0) {
      allyLines.push(`コンパス攻撃力: +${formatPercent(compassAttack, 1)}%`);
    }
    if (partyLevel > 1) {
      allyLines.push(`パーティーレベル: Lv.${partyLevel}`);
    }
    if (partyAttackBonus > 0) {
      allyLines.push(`全体攻撃補正: +${formatNumber(partyAttackBonus)}`);
    }
    if (treasureAllyAttackBonus > 0) {
      allyLines.push(`秘宝仲間攻撃力: +${formatNumber(treasureAllyAttackBonus)}`);
    }
    if (treasureAllyAttackIntervalReductionSeconds > 0) {
      allyLines.push(
        `仲間攻撃間隔: -${formatSeconds(treasureAllyAttackIntervalReductionSeconds)}秒`,
      );
    }
    if (tapAllyAttackChance > 0) {
      allyLines.push(
        `タップ時仲間追撃率: ${formatPercent(tapAllyAttackChance, 1)}%`,
      );
    }
    if (treasureAllyUpgradeCostReduction > 0) {
      allyLines.push(
        `仲間強化費用: -${formatNumber(treasureAllyUpgradeCostReduction)}`,
      );
    }

    const equipmentLines = [];
    if (itemDropBonus + treasureItemDropRateBonus > 0) {
      equipmentLines.push(`装備ドロップ率: ${formatPercent(itemDropChance, 1)}%`);
    }
    if (treasureDroppedEquipmentAttackBonus > 0) {
      equipmentLines.push(
        `ドロップ装備攻撃力: +${formatPercent(treasureDroppedEquipmentAttackBonus, 1)}%`,
      );
    }
    if (bossDamagePercent > 0) {
      equipmentLines.push(
        `ボスダメージ: +${formatPercent(bossDamagePercent, 1)}%`,
      );
    }
    if (bossTimeBonus > 0) {
      equipmentLines.push(
        `ボス制限時間: ${bossTimeLimit}秒 (+${bossTimeBonus}秒)`,
      );
    }

    const collectionLines = [];
    const recordLines = [
      `ダンジョン攻略数: ${formatNumber(state.records?.dungeonClearCount || 0)}回`,
    ];
    if (totalTreasureCount > 0) {
      collectionLines.push(
        `秘宝コンプ率: ${formatNumber(ownedTreasureCount)}/${formatNumber(totalTreasureCount)}`,
      );
    }
    if (treasureExtraTreasureChance > 0) {
      collectionLines.push(
        `追加秘宝率: ${formatPercent(treasureExtraTreasureChance, 0)}%`,
      );
    }
    if (treasureFloorSkipChance > 0) {
      collectionLines.push(
        `次階層スキップ率: ${formatPercent(treasureFloorSkipChance, 0)}%`,
      );
    }
    if (treasureNextRebirthExtraTreasureCount > 0) {
      collectionLines.push(
        `次転生追加秘宝確定: +${formatNumber(treasureNextRebirthExtraTreasureCount)}個`,
      );
    }
    if (treasureBossTreasureRewardCount > 0) {
      collectionLines.push(
        `ボス撃破秘宝: +${formatNumber(treasureBossTreasureRewardCount)}個`,
      );
    }

    if (els.recordVersionText) {
      els.recordVersionText.textContent = window.GameVersion
        ? `v${window.GameVersion}`
        : "";
    }

    function createStatusCard(title, lines) {
      if (!lines.length) return "";
      return `<div class="row-card"><div class="item-name">${title}</div><div class="small">${lines.join("<br>")}</div></div>`;
    }

    const statusCards = [
      createStatusCard("記録", recordLines),
      createStatusCard("プレイヤー", playerLines),
      createStatusCard("仲間", allyLines),
      createStatusCard("装備", equipmentLines),
      createStatusCard("収集", collectionLines),
    ]
      .filter(Boolean)
      .join("");

    els.statusList.innerHTML =
      statusCards ||
      '<div class="row-card"><div class="small">まだ表示できるステータスはありません。</div></div>';
  }

  function renderRecordSettings() {
    els.recordSettingsList.innerHTML = `
      <div class="row-card">
        <div class="row-top">
          <div>
            <div class="item-name">自動ボス挑戦</div>
            <div class="small">ボスに挑戦可能になったら自動でボス戦を開始します。</div>
          </div>
          <label class="small" style="display:flex; align-items:center; gap:8px;">
            <input id="autoChallengeBossCheckbox" type="checkbox" ${state.settings?.autoChallengeBoss ? "checked" : ""}>
            有効
          </label>
        </div>
      </div>
    `;
  }

  function startSynthesis(itemId) {
    /*
      if (!window.GameItems.canSynthesizeItem(itemId)) return false;
      synthesisBaseItemId = itemId;
      renderEquip();
    */
    void itemId;
    return false;
  }

  function cancelSynthesis() {
    // synthesisBaseItemId = null;
  }

  function getSynthesisBaseItemId() {
    // return synthesisBaseItemId;
    return null;
  }

  function switchItemTab(tab) {
    currentItemTab = tab === "treasure" ? "treasure" : "equip";
    document
      .querySelectorAll("[data-item-tab]")
      .forEach((btn) =>
        btn.classList.toggle("active", btn.dataset.itemTab === currentItemTab),
      );
    els.itemEquipPane.classList.toggle("active", currentItemTab === "equip");
    els.itemTreasurePane.classList.toggle(
      "active",
      currentItemTab === "treasure",
    );
  }

  function switchEquipInventoryTab(tab) {
    currentEquipInventoryTab = tab === "compass" ? "compass" : "goggles";
    renderEquip();
  }

  function switchRecordTab(tab) {
    currentRecordTab = tab === "settings" ? "settings" : "record";
    document
      .querySelectorAll(".record-tab-btn")
      .forEach((btn) =>
        btn.classList.toggle(
          "active",
          btn.dataset.recordTab === currentRecordTab,
        ),
      );
    els.recordStatusPane.classList.toggle("active", currentRecordTab === "record");
    els.recordSettingsPane.classList.toggle(
      "active",
      currentRecordTab === "settings",
    );
  }

  function updateTabButtons() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      if (!btn.dataset.label) btn.dataset.label = btn.textContent;
      const isActiveTab = btn.dataset.tab === currentTab;
      btn.classList.toggle("active", isActiveTab);
      btn.textContent =
        isActiveTab && currentScreen === currentTab ? "閉じる" : btn.dataset.label;
    });
  }

  function showScreen(screenKey, activeTab) {
    currentScreen = screenKey;
    currentTab = activeTab;
    updateTabButtons();
    Object.entries(els.screens).forEach(([key, screen]) =>
      screen.classList.toggle("active", key === screenKey),
    );
  }

  function switchTab(tab) {
    if (tab === currentTab && currentScreen === tab) {
      showScreen("battle", currentTab);
      return;
    }
    showScreen(tab, tab);
  }

  function render() {
    renderBattle(true);
    renderUpgrade();
    renderParty();
    renderEquip();
    renderTreasure();
    renderStatus();
    renderRecordSettings();
    updateTabButtons();
    switchItemTab(currentItemTab);
    switchRecordTab(currentRecordTab);
  }

  window.GameUI = {
    els,
    enemyButton,
    enemyArea,
    formatNumber,
    formatPercent,
    addLog,
    renderBattle,
    renderUpgrade,
    renderParty,
    renderEquip,
    renderTreasure,
    renderStatus,
    renderRecordSettings,
    render,
    switchTab,
    switchItemTab,
    switchEquipInventoryTab,
    switchRecordTab,
    startSynthesis,
    cancelSynthesis,
    getSynthesisBaseItemId,
  };
})();
