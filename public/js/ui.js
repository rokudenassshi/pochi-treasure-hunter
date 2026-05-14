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

  const COMPACT_NUMBER_THRESHOLD = 1_000_000;
  const COMPACT_NUMBER_BASE = 1_000;

  function formatCompactSuffix(index) {
    let suffix = "";
    let value = index;
    do {
      suffix = String.fromCharCode(97 + (value % 26)) + suffix;
      value = Math.floor(value / 26) - 1;
    } while (value >= 0);
    return suffix;
  }

  function formatCompactNumber(absValue, exponent) {
    const scaled = absValue / Math.pow(COMPACT_NUMBER_BASE, exponent);
    const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
    const factor = Math.pow(10, digits);
    const truncated = Math.floor(scaled * factor) / factor;
    return `${truncated.toFixed(digits)}${formatCompactSuffix(exponent - 2)}`;
  }

  function formatNumber(value) {
    const number = Math.floor(value);
    if (!Number.isFinite(number)) return String(number);

    const absValue = Math.abs(number);
    if (absValue < COMPACT_NUMBER_THRESHOLD) {
      return number.toLocaleString("ja-JP");
    }

    const exponent = Math.floor(
      Math.log(absValue) / Math.log(COMPACT_NUMBER_BASE),
    );
    return `${number < 0 ? "-" : ""}${formatCompactNumber(absValue, exponent)}`;
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
    setDisplayIfChanged(
      els.escapeBossBtn,
      enemy.isBoss ? "inline-flex" : "none",
    );
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
    const nextUnlockTreasureChance = window.GameRebirth
      ?.getNextUnlockTreasureChance
      ? window.GameRebirth.getNextUnlockTreasureChance()
      : 0;
    const nextRebirthExtraTreasureCount = window.GameRebirth
      ?.getNextRebirthExtraTreasureCount
      ? window.GameRebirth.getNextRebirthExtraTreasureCount()
      : 0;
    const rebirthStartingGoldBonus = window.GameRebirth
      ?.getRebirthStartingGoldBonus
      ? window.GameRebirth.getRebirthStartingGoldBonus()
      : 0;
    const allyTreasureRewardBonus = window.GameAllies
      ?.getTreasureRewardBonusCount
      ? window.GameAllies.getTreasureRewardBonusCount()
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
    els.rebirthDescriptionText.textContent = `現在撃破 ${formatNumber(reachFloor)}F / 50Fごとに秘宝 +1、100Fごとに追加 +1 / 今回 ${formatNumber(rewardCount)}個${allyTreasureRewardBonus > 0 ? ` / 盗賊 +${formatNumber(allyTreasureRewardBonus)}個` : ""}${nextRebirthExtraTreasureCount > 0 ? ` / 鍵確定 +${formatNumber(nextRebirthExtraTreasureCount)}個` : ""}${extraTreasureChance > 0 ? ` / 追加秘宝率 ${formatPercent(extraTreasureChance, 0)}%` : ""}${rebirthStartingGoldBonus > 0 ? ` / 開始ゴールド +${formatNumber(rebirthStartingGoldBonus)}` : ""}`;
    els.rebirthBtn.disabled = rewardCount <= 0;
  }

  function formatSeconds(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  function renderParty() {
    const {
      allyTemplates,
      MAX_ALLIES,
      getActiveAllies,
      getNextHireCost,
      canHireAlly,
      getAllyAttack,
      getAllyTapPursuitAttack,
      getAllyAttackIntervalSeconds,
      getAllyUpgradeCost,
      getAllyUpgradeAttackAmount,
      getAllyTreasureRewardBonusCount,
      canUpgradeAlly,
    } = window.GameAllies;
    const activeAllies = getActiveAllies();
    const nextHireCost = getNextHireCost();
    const canHire = canHireAlly();
    const tapDamage = window.GameBattle.calcTapDamage();

    function allySummary(ally) {
      const lines = [];
      const interval = formatSeconds(getAllyAttackIntervalSeconds(ally));
      const attack = getAllyAttack(ally);
      const pursuitAttack = getAllyTapPursuitAttack(ally, tapDamage);
      if (attack > 0) {
        lines.push(`攻撃 ${formatNumber(attack)} / ${interval}秒ごと`);
      }
      if (pursuitAttack > 0) {
        lines.push(`タップ追撃 ${formatNumber(pursuitAttack)}`);
      }
      const treasureRewardBonusCount = getAllyTreasureRewardBonusCount
        ? getAllyTreasureRewardBonusCount(ally)
        : Math.max(0, Math.floor(Number(ally.treasureRewardBonusCount) || 0));
      if (treasureRewardBonusCount > 0) {
        lines.push(`秘宝 +${formatNumber(treasureRewardBonusCount)}個`);
      }
      if (ally.itemDropRateBonus > 0) {
        lines.push(
          `装備ドロップ率 +${formatPercent(ally.itemDropRateBonus, 0)}%`,
        );
      }
      if (ally.goldGainPercent > 0) {
        lines.push(`獲得ゴールド +${formatPercent(ally.goldGainPercent, 0)}%`);
      }
      return lines.join(" / ") || "特殊効果なし";
    }

    const partyCard = `
      <div class="row-card">
        <div class="row-top">
          <div>
            <div class="item-name">仲間 ${formatNumber(activeAllies.length)} / ${formatNumber(MAX_ALLIES)}</div>
            <div class="small">${canHire ? `次の雇用 ${formatNumber(nextHireCost)}G` : "これ以上雇用できません"}</div>
          </div>
        </div>
      </div>
    `;

    const hireCards = allyTemplates
      .map((template) => {
        const disabled = !canHire || state.gold < nextHireCost;
        return `<div class="row-card"><div class="row-top"><div><div class="item-name">${template.name}</div><div class="small">${template.description}</div><div class="small">${allySummary(template)}</div></div><div class="small">${canHire ? `${formatNumber(nextHireCost)}G` : "--"}</div></div><div class="actions"><button class="btn good" data-hire="${template.id}" ${disabled ? "disabled" : ""}>雇用</button></div></div>`;
      })
      .join("");

    const ownedCards = activeAllies
      .map((ally, index) => {
        const upgradeCost = getAllyUpgradeCost(ally);
        const upgradeAmount = getAllyUpgradeAttackAmount(ally);
        const upgradeDisabled =
          upgradeCost === null || state.gold < upgradeCost;
        const upgradeButton = canUpgradeAlly(ally)
          ? `<button class="btn primary" data-upgrade-ally="${ally.uid}" ${upgradeDisabled ? "disabled" : ""}>攻撃 +${formatNumber(upgradeAmount)} / ${formatNumber(upgradeCost)}G</button>`
          : '<button class="btn" disabled>強化不可</button>';
        return `<div class="row-card"><div class="row-top"><div><span class="item-name">${formatNumber(index + 1)}. ${ally.name} Lv.${formatNumber(ally.level || 1)}</span><div class="small">${allySummary(ally)}</div></div></div><div class="actions">${upgradeButton}</div></div>`;
      })
      .join("");
    const ownedList =
      ownedCards ||
      '<div class="row-card"><div class="small">まだ仲間を雇用していません。</div></div>';

    els.allyList.innerHTML = `${partyCard}<div class="section-title">雇用する職業</div>${hireCards}<div class="section-title">雇用中の仲間</div>${ownedList}`;
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

  function renderEquipSettingsContent() {
    const rarityOptions = [
      ["none", "なし"],
      ["common", "コモン"],
      ["uncommon", "アンコモン"],
      ["rare", "レア"],
      ["epic", "エピック"],
      ["legendary", "レジェンダリー"],
    ];
    const filters = state.itemSettings.autoDiscardFilters || {};
    const renderFilterSettings = (type) => {
      const typeDef = equipmentTypeDefinitions[type];
      const filter = filters[type] || {};
      const rarity = filter.rarity || "none";
      const attackPercent = Math.max(0, Number(filter.attackPercent) || 0);
      return `
        <div class="row-card equip-filter-card">
          <div class="equip-filter-title">
            <div class="item-name">${typeDef.label}</div>
          </div>
          <label class="equip-setting-field">
            <span class="small">レアリティ</span>
            <select class="btn equip-setting-control equip-setting-select" data-auto-discard-rarity-type="${type}">
              ${rarityOptions
                .map(
                  ([optionRarity, label]) =>
                    `<option value="${optionRarity}" ${rarity === optionRarity ? "selected" : ""}>${label}</option>`,
                )
                .join("")}
            </select>
          </label>
          <label class="equip-setting-field">
            <span class="small">${typeDef.mainStatLabel}</span>
            <input
              class="btn equip-setting-control equip-setting-number"
              type="number"
              min="0"
              step="0.1"
              inputmode="decimal"
              value="${attackPercent}"
              data-auto-discard-attack-type="${type}"
            >
          </label>
        </div>
      `;
    };

    return `
      <div class="equip-settings-list">
        ${renderFilterSettings("goggles")}
        ${renderFilterSettings("compass")}
      </div>
    `;
  }

  function closeEquipSettings() {
    document.getElementById("equipSettingsModal")?.remove();
  }

  function openEquipSettings() {
    closeEquipSettings();
    const modal = document.createElement("div");
    modal.id = "equipSettingsModal";
    modal.className = "modal equip-settings-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "equipSettingsModalTitle");
    modal.innerHTML = `
      <div class="modal-content equip-settings-modal-content">
        <div class="equip-settings-modal-header">
          <h3 id="equipSettingsModalTitle">装備フィルター</h3>
          <button class="btn equip-settings-close-button" type="button" id="closeEquipSettingsBtn">閉じる</button>
        </div>
        ${renderEquipSettingsContent()}
      </div>
    `;
    document.body.appendChild(modal);
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
      <div class="equip-settings-launch">
        <button class="btn warn equip-setting-button" type="button" id="bulkDiscardBtn">一括破棄</button>
        <button class="btn equip-settings-open-button" type="button" id="openEquipSettingsBtn">装備フィルター</button>
      </div>
    `;
  }

  function renderTreasure() {
    if (!window.GameRebirth) return;

    const playerAttackBonus = window.GameRebirth.getPlayerAttackBonus();
    const allyJobAttackBonuses = window.GameRebirth.getAllyJobAttackBonuses();
    const allyAttackIntervalReductionSeconds =
      window.GameRebirth.getAllyAttackIntervalReductionSeconds();
    const goldBonus = window.GameRebirth.getGoldBonus();
    const playerUpgradeCostReduction =
      window.GameRebirth.getPlayerUpgradeCostReduction();
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
    const rebirthStartingGoldBonus =
      window.GameRebirth.getRebirthStartingGoldBonus();
    const enemyGoldDoubleChance = window.GameRebirth.getEnemyGoldDoubleChance();
    const bossTreasureRewardCount =
      window.GameRebirth.getBossTreasureRewardCount();
    const bossTreasureRewardFloorOffset =
      window.GameRebirth.getBossTreasureRewardFloorOffset();
    const bossDamagePercent = window.GameRebirth.getBossDamagePercent();
    const thiefTreasureRewardBonusCount =
      window.GameRebirth.getThiefTreasureRewardBonusCount();
    const fighterTapPursuitRatioBonus =
      window.GameRebirth.getFighterTapPursuitRatioBonus();
    const ownedTreasures = window.GameRebirth.getOwnedTreasureEntries();

    function formatAllyJobAttackBonusLines(bonuses, prefix = "") {
      return Object.entries(bonuses || {})
        .filter(([, bonus]) => bonus > 0)
        .map(([jobId, bonus]) => {
          const jobName =
            window.GameAllies?.getAllyTemplate?.(jobId)?.name || jobId;
          return `${prefix}${jobName}攻撃力 +${formatNumber(bonus)}`;
        });
    }

    const treasureEffectSummary = [];
    if (playerAttackBonus > 0) {
      treasureEffectSummary.push(
        `プレイヤー攻撃力 +${formatNumber(playerAttackBonus)}`,
      );
    }
    treasureEffectSummary.push(
      ...formatAllyJobAttackBonusLines(allyJobAttackBonuses),
    );
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
    if (thiefTreasureRewardBonusCount > 0) {
      treasureEffectSummary.push(
        `盗賊秘宝 +${formatNumber(thiefTreasureRewardBonusCount)}個`,
      );
    }
    if (fighterTapPursuitRatioBonus > 0) {
      treasureEffectSummary.push(
        `闘士追撃倍率 +${formatPercent(fighterTapPursuitRatioBonus, 0)}%`,
      );
    }
    const treasureRows = ownedTreasures
      .map((treasure) => {
        const effectLines = [];
        if (treasure.totalAttackBonus) {
          effectLines.push(
            `合計攻撃力 +${formatNumber(treasure.totalAttackBonus)}`,
          );
        }
        effectLines.push(
          ...formatAllyJobAttackBonusLines(
            treasure.totalAllyJobAttackBonus,
            "合計",
          ),
        );
        if (treasure.totalAllyAttackIntervalReductionSeconds) {
          effectLines.push(
            `仲間攻撃間隔: -${formatSeconds(treasure.totalAllyAttackIntervalReductionSeconds)}秒`,
          );
        }
        if (treasure.totalGoldBonus) {
          effectLines.push(
            `合計ゴールド +${formatNumber(treasure.totalGoldBonus)}`,
          );
        }
        if (treasure.totalPlayerUpgradeCostReduction) {
          effectLines.push(
            `合計プレイヤー強化費用 -${formatNumber(treasure.totalPlayerUpgradeCostReduction)}`,
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
        if (treasure.totalThiefTreasureRewardBonusCount) {
          effectLines.push(
            `合計盗賊秘宝 +${formatNumber(treasure.totalThiefTreasureRewardBonusCount)}個`,
          );
        }
        if (treasure.totalFighterTapPursuitRatioBonus) {
          effectLines.push(
            `合計闘士追撃倍率 +${formatPercent(treasure.totalFighterTapPursuitRatioBonus, 0)}%`,
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
    const multiStrikeChance = window.GameBattle.getMultiStrikeChance();
    const tapExtraAttackCount = window.GameBattle.getTapExtraAttackCount();
    const goldGainPercent = window.GameBattle.getGoldGainPercent();
    const enemyGoldTenfoldChance =
      window.GameBattle.getEnemyGoldTenfoldChance();
    const tapAllyAttackChance = window.GameBattle.getTapAllyAttackChance();
    const allyRallyChance = window.GameBattle.getAllyRallyChance();
    const bossDamagePercent = window.GameBattle.getBossDamagePercent();
    const normalEnemyDamagePercent =
      window.GameBattle.getNormalEnemyDamagePercent();
    const itemDropChance = window.GameItems.getItemDropChance();
    const itemDropBonus = window.GameItems.getEquippedOptionTotal(
      "itemDropRatePercent",
    );
    const allyGoldGainPercent = window.GameAllies?.getGoldGainPercent
      ? window.GameAllies.getGoldGainPercent()
      : 0;
    const allyItemDropRateBonus = window.GameAllies?.getItemDropRateBonus
      ? window.GameAllies.getItemDropRateBonus()
      : 0;
    const allyTreasureRewardBonus = window.GameAllies
      ?.getTreasureRewardBonusCount
      ? window.GameAllies.getTreasureRewardBonusCount()
      : 0;
    const bossTimeLimit = window.GameEnemies.getBossTimeLimit();
    const bossTimeBonus = window.GameEnemies.getBossTimeBonusSeconds();
    const treasureAttackBonus = window.GameRebirth?.getPlayerAttackBonus
      ? window.GameRebirth.getPlayerAttackBonus()
      : 0;
    const treasureAllyAttackIntervalReductionSeconds = window.GameRebirth
      ?.getAllyAttackIntervalReductionSeconds
      ? window.GameRebirth.getAllyAttackIntervalReductionSeconds()
      : 0;
    const treasureFighterTapPursuitRatioBonus = window.GameRebirth
      ?.getFighterTapPursuitRatioBonus
      ? window.GameRebirth.getFighterTapPursuitRatioBonus()
      : 0;
    const equipmentAllyAttackIntervalReductionSeconds =
      window.GameItems.getEquippedOptionTotal(
        "allyAttackIntervalReductionSeconds",
      );
    const equipmentAllyAttackIntervalMultiplier = window.GameAllies
      ?.getEquipmentAllyAttackIntervalMultiplier
      ? window.GameAllies.getEquipmentAllyAttackIntervalMultiplier()
      : 1;
    const treasureGoldBonus = window.GameRebirth?.getGoldBonus
      ? window.GameRebirth.getGoldBonus()
      : 0;
    const treasurePlayerUpgradeCostReduction = window.GameRebirth
      ?.getPlayerUpgradeCostReduction
      ? window.GameRebirth.getPlayerUpgradeCostReduction()
      : 0;
    const treasureItemDropRateBonus = window.GameRebirth?.getItemDropRateBonus
      ? window.GameRebirth.getItemDropRateBonus()
      : 0;
    const treasureDroppedEquipmentAttackBonus = window.GameRebirth
      ?.getDroppedEquipmentAttackBonus
      ? window.GameRebirth.getDroppedEquipmentAttackBonus()
      : 0;
    const treasureExtraTreasureChance = window.GameRebirth
      ?.getExtraTreasureChance
      ? window.GameRebirth.getExtraTreasureChance()
      : 0;
    const treasureRarityBonusPercent = window.GameRebirth
      ?.getTreasureRarityBonusPercent
      ? window.GameRebirth.getTreasureRarityBonusPercent()
      : 0;
    const treasureFloorSkipChance = window.GameRebirth?.getFloorSkipChance
      ? window.GameRebirth.getFloorSkipChance()
      : 0;
    const equipmentFloorSkipChance =
      window.GameItems.getEquippedOptionTotal("floorSkipChance");
    const floorSkipChance = window.GameBattle.getFloorSkipChance();
    const treasureNextRebirthExtraTreasureCount = window.GameRebirth
      ?.getNextRebirthExtraTreasureCount
      ? window.GameRebirth.getNextRebirthExtraTreasureCount()
      : 0;
    const treasureRebirthStartingGoldBonus = window.GameRebirth
      ?.getRebirthStartingGoldBonus
      ? window.GameRebirth.getRebirthStartingGoldBonus()
      : 0;
    const treasureBossTreasureRewardCount = window.GameRebirth
      ?.getBossTreasureRewardCount
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
    if (multiStrikeChance > 0) {
      playerLines.push(`連撃率: ${formatPercent(multiStrikeChance, 1)}%`);
    }
    if (tapExtraAttackCount > 0) {
      playerLines.push(
        `タップ追加攻撃: +${formatNumber(tapExtraAttackCount)}回`,
      );
    }
    if (goldGainPercent > 0) {
      playerLines.push(`ゴールド倍率: +${formatPercent(goldGainPercent, 0)}%`);
    }
    if (enemyGoldTenfoldChance > 0) {
      playerLines.push(
        `敵撃破ゴールド10倍: ${formatPercent(enemyGoldTenfoldChance, 1)}%`,
      );
    }
    if (allyGoldGainPercent > 0) {
      playerLines.push(
        `商人ゴールド: +${formatPercent(allyGoldGainPercent, 0)}%`,
      );
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
    if (treasureAllyAttackIntervalReductionSeconds > 0) {
      allyLines.push(
        `仲間攻撃間隔: -${formatSeconds(treasureAllyAttackIntervalReductionSeconds)}秒`,
      );
    }
    if (equipmentAllyAttackIntervalReductionSeconds > 0) {
      allyLines.push(
        `装備仲間攻撃間隔: -${formatSeconds(equipmentAllyAttackIntervalReductionSeconds)}秒`,
      );
    }
    if (equipmentAllyAttackIntervalMultiplier < 1) {
      allyLines.push(
        `装備仲間攻撃間隔: x${equipmentAllyAttackIntervalMultiplier.toFixed(2)}`,
      );
    }
    if (tapAllyAttackChance > 0) {
      allyLines.push(
        `タップ時仲間追撃率: ${formatPercent(tapAllyAttackChance, 1)}%`,
      );
    }
    if (allyRallyChance > 0) {
      allyLines.push(`仲間号令率: ${formatPercent(allyRallyChance, 1)}%`);
    }
    if (treasureFighterTapPursuitRatioBonus > 0) {
      allyLines.push(
        `闘士追撃倍率: +${formatPercent(treasureFighterTapPursuitRatioBonus, 0)}%`,
      );
    }
    const equipmentLines = [];
    if (itemDropBonus + treasureItemDropRateBonus + allyItemDropRateBonus > 0) {
      equipmentLines.push(
        `装備ドロップ率: ${formatPercent(itemDropChance, 1)}%`,
      );
    }
    if (allyItemDropRateBonus > 0) {
      equipmentLines.push(
        `商人ドロップ率: +${formatPercent(allyItemDropRateBonus, 0)}%`,
      );
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
    if (normalEnemyDamagePercent > 0) {
      equipmentLines.push(
        `通常敵ダメージ: +${formatPercent(normalEnemyDamagePercent, 1)}%`,
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
    if (treasureRarityBonusPercent > 0) {
      collectionLines.push(
        `高レア秘宝率: +${formatPercent(treasureRarityBonusPercent, 0)}%`,
      );
    }
    if (floorSkipChance > 0) {
      collectionLines.push(
        `次階層スキップ率: ${formatPercent(floorSkipChance, 0)}%`,
      );
    }
    if (equipmentFloorSkipChance > 0 && treasureFloorSkipChance > 0) {
      collectionLines.push(
        `装備探索加速: +${formatPercent(equipmentFloorSkipChance, 0)}%`,
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
    if (allyTreasureRewardBonus > 0) {
      collectionLines.push(
        `盗賊秘宝: +${formatNumber(allyTreasureRewardBonus)}個`,
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
    els.recordStatusPane.classList.toggle(
      "active",
      currentRecordTab === "record",
    );
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
        isActiveTab && currentScreen === currentTab
          ? "閉じる"
          : btn.dataset.label;
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
    openEquipSettings,
    closeEquipSettings,
    switchTab,
    switchItemTab,
    switchEquipInventoryTab,
    switchRecordTab,
    startSynthesis,
    cancelSynthesis,
    getSynthesisBaseItemId,
  };
})();
