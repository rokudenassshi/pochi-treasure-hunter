(function () {
  const state = window.GameState;
  const ui = window.GameUI;
  const SAVE_KEY = "clicker_hackslash_save";
  const INTRO_POPUP_KEY = "pochi_treasure_hunter_intro_seen";

  function saveGame() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("Game save failed", error);
    }
  }

  function updateMobileLayoutWidth() {
    const isTouchPhone = window.matchMedia(
      "(hover: none) and (pointer: coarse) and (max-width: 520px)",
    ).matches;
    if (!isTouchPhone) {
      document.documentElement.style.removeProperty("--app-fixed-width");
      return;
    }

    const width = Math.min(
      window.innerWidth || document.documentElement.clientWidth || 520,
      520,
    );
    document.documentElement.style.setProperty("--app-fixed-width", `${width}px`);
  }

  function showIntroPopupIfNeeded() {
    try {
      if (localStorage.getItem(INTRO_POPUP_KEY) === "1") return;
    } catch (error) {
      console.warn("Intro popup state read failed", error);
    }

    const modal = document.createElement("div");
    modal.className = "modal intro-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "introModalTitle");
    modal.innerHTML = `
      <div class="modal-content intro-modal-content">
        <h3 id="introModalTitle">ポチポチ秘宝ハンター</h3>
        <p>あなたはトレジャーハンターとしてダンジョンを踏破しよう！</p>
        <p>ダンジョンの奥には様々な秘宝が...</p>
        <div class="modal-actions">
          <button class="btn primary" type="button" id="introModalCloseBtn">冒険を始める</button>
        </div>
      </div>
    `;

    function closeIntroPopup() {
      try {
        localStorage.setItem(INTRO_POPUP_KEY, "1");
      } catch (error) {
        console.warn("Intro popup state save failed", error);
      }
      modal.remove();
    }

    document.body.appendChild(modal);
    const closeButton = document.getElementById("introModalCloseBtn");
    closeButton?.focus();
    closeButton?.addEventListener("click", closeIntroPopup);
  }

  function dedupeItems(items) {
    const seenIds = new Set();
    return items.filter((item) => {
      if (!item || typeof item !== "object") return false;
      const itemId = Number(item.id);
      if (!Number.isFinite(itemId) || seenIds.has(itemId)) return false;
      seenIds.add(itemId);
      return true;
    });
  }

  function refreshNextItemId() {
    const knownItems = [
      ...(Array.isArray(state.inventory) ? state.inventory : []),
      state.player?.goggles,
      state.player?.compass,
    ].filter(Boolean);
    const maxId = knownItems.reduce(
      (currentMax, item) => Math.max(currentMax, Number(item.id) || 0),
      0,
    );
    state.nextItemId = Math.max(1, maxId + 1, Number(state.nextItemId) || 1);
  }

  function refreshNextAllyId() {
    const maxId = (Array.isArray(state.alliesOwned) ? state.alliesOwned : [])
      .reduce((currentMax, ally) => {
        const match = String(ally?.uid || "").match(/^ally-(\d+)$/);
        return Math.max(currentMax, match ? Number(match[1]) || 0 : 0);
      }, 0);
    state.nextAllyId = Math.max(1, maxId + 1, Number(state.nextAllyId) || 1);
  }

  function getDefaultTreasures() {
    return Object.fromEntries(
      (window.GameConfig?.treasureDefinitions || []).map((treasure) => [
        treasure.id,
        0,
      ]),
    );
  }

  function normalizeTreasures(treasures) {
    const normalized = getDefaultTreasures();
    if (!treasures || typeof treasures !== "object") return normalized;

    for (const [treasureId, rawCount] of Object.entries(treasures)) {
      if (!(treasureId in normalized)) continue;
      normalized[treasureId] += Math.max(0, Math.floor(Number(rawCount) || 0));
    }

    return normalized;
  }

  function normalizeOwnedAllies(allies) {
    const templateMap = new Map(
      (window.GameConfig?.allyTemplates || []).map((template) => [
        template.id,
        template,
      ]),
    );
    const legacyJobIds = ["warrior", "swordsman", "hunter", "merchant", "fighter"];

    function getLegacyJobId(allyId) {
      const match = String(allyId || "").match(/^ally(\d+)$/);
      if (!match) return "warrior";
      const legacyIndex = Math.max(0, (Number(match[1]) || 1) - 1);
      return legacyJobIds[legacyIndex % legacyJobIds.length] || "warrior";
    }

    return allies
      .slice(0, window.GameAllies?.MAX_ALLIES || 5)
      .map((ally, index) => {
        const jobId = templateMap.has(ally?.jobId || ally?.id)
          ? ally?.jobId || ally?.id
          : getLegacyJobId(ally?.id);
        const template = templateMap.get(jobId);
        if (!template) return null;
        const legacyPartyLevel = Math.max(1, Number(state.partyLevel) || 1);

        return {
          ...template,
          ...ally,
          id: template.id,
          uid: ally?.uid || `ally-${index + 1}`,
          jobId: template.id,
          name: String(template.name),
          level: Math.max(1, Math.floor(Number(ally?.level) || legacyPartyLevel)),
          baseAtk: Math.max(0, Number(template.baseAtk) || 0),
          attackIntervalSeconds: Math.max(
            0,
            Number(template.attackIntervalSeconds) || 0,
          ),
          upgradeAtkAmount: Math.max(0, Number(template.upgradeAtkAmount) || 0),
          upgradeBase: Math.max(0, Number(template.upgradeBase) || 0),
        };
      })
      .filter(Boolean);
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return false;

      Object.assign(state, parsed);

      state.player = {
        tapLevel: Math.max(1, Number(state.player?.tapLevel) || 1),
        critLevel: Math.max(0, Number(state.player?.critLevel) || 0),
        critDamageLevel: Math.max(0, Number(state.player?.critDamageLevel) || 0),
        goggles: state.player?.goggles || null,
        compass: state.player?.compass || null,
      };
      state.inventory = dedupeItems(
        Array.isArray(parsed.inventory) ? parsed.inventory : [],
      );
      state.alliesOwned = normalizeOwnedAllies(
        Array.isArray(parsed.alliesOwned) ? parsed.alliesOwned : [],
      );
      refreshNextAllyId();
      state.partyLevel = Math.max(1, Number(parsed.partyLevel) || 1);
      state.itemSettings = {
        autoDiscardRarity: "none",
        autoDiscardAttackPercent: 0,
        lockedItemIds: [],
        ...(parsed.itemSettings || {}),
      };
      state.itemSettings.autoDiscardAttackPercent = Math.max(
        0,
        Number(state.itemSettings.autoDiscardAttackPercent) || 0,
      );
      if (!Array.isArray(state.itemSettings.lockedItemIds)) {
        state.itemSettings.lockedItemIds = [];
      }
      state.settings = {
        autoChallengeBoss: false,
        ...(parsed.settings || {}),
      };
      state.records = {
        dungeonClearCount: Math.max(
          0,
          Math.floor(Number(parsed.records?.dungeonClearCount) || 0),
        ),
      };
      state.treasures = normalizeTreasures(parsed.treasures);

      state.runHighestFloorReached = Math.max(
        1,
        Number(state.runHighestFloorReached) || 1,
        Number(state.floor) || 1,
        Number(state.pendingBossFloor) || 0,
        Number(state.enemy?.floor) || 0,
      );
      state.lastAutoTick = performance.now();
      state.recentAutoWindowStart = performance.now();
      state.recentAutoDamage = 0;

      const now = performance.now();
      for (const ally of state.alliesOwned) {
        ally.lastAttackAt = now;
      }

      refreshNextItemId();
      return true;
    } catch (error) {
      console.warn("Game load failed", error);
      return false;
    }
  }

  window.GameSave = {
    save: saveGame,
    load: loadGame,
    clear: () => localStorage.removeItem(SAVE_KEY),
  };

  const ACTIVE_LOOP_INTERVAL_MS = 50;
  const HIDDEN_LOOP_INTERVAL_MS = 250;
  let lastLoopFrameAt = 0;

  function equipItem(itemId) {
    const item = state.inventory.find((entry) => entry.id === itemId);
    if (!item) return;

    const itemName = window.GameItems.getItemDisplayName(item);
    if (item.type === "goggles") {
      if (state.player.goggles) state.inventory.unshift(state.player.goggles);
      state.player.goggles = item;
    } else {
      if (state.player.compass) state.inventory.unshift(state.player.compass);
      state.player.compass = item;
    }
    state.inventory = state.inventory.filter((entry) => entry.id !== itemId);
    ui.addLog(`${itemName} を装備した。`);
    ui.render();
    saveGame();
  }

  function unequipItem(type) {
    const item = type === "goggles" ? state.player.goggles : state.player.compass;
    if (!item) return;

    const itemName = window.GameItems.getItemDisplayName(item);
    state.inventory.unshift(item);
    if (type === "goggles") {
      state.player.goggles = null;
    } else {
      state.player.compass = null;
    }
    ui.addLog(`${itemName} を外した。`);
    ui.render();
    saveGame();
  }

  function discardItem(itemId) {
    const item = state.inventory.find((entry) => entry.id === itemId);
    if (!item) return;
    if (window.GameItems.isItemLocked(itemId)) return;

    const itemName = window.GameItems.getItemDisplayName(item);
    state.inventory = state.inventory.filter((entry) => entry.id !== itemId);
    state.itemSettings.lockedItemIds = state.itemSettings.lockedItemIds.filter(
      (id) => id !== itemId,
    );
    ui.addLog(`${itemName} を捨てた。`);
    ui.render();
    saveGame();
  }

  /*
  function synthesizeItem(materialItemId) {
    const baseItemId = ui.getSynthesisBaseItemId();
    if (baseItemId === null) return;
    const success = window.GameItems.synthesizeItem(baseItemId, materialItemId);
    if (!success) return;

    const baseItem = window.GameItems.findItemById(baseItemId);
    const itemName = window.GameItems.getItemDisplayName(baseItem);
    ui.cancelSynthesis();
    ui.addLog(`${itemName} を合成した。`);
    ui.render();
    saveGame();
  }

  function bulkSynthesizeItem(baseItemId) {
    const materialCount = window.GameItems.getSynthesizableMaterialIds(
      baseItemId,
    ).length;
    if (materialCount <= 0) return;

    if (
      !confirm(
        `表示中カテゴリのロック中以外の同種装備 ${materialCount}個を素材にして合成します。よろしいですか？`,
      )
    ) {
      return;
    }

    const synthesizedCount = window.GameItems.bulkSynthesizeItem(baseItemId);
    if (synthesizedCount <= 0) return;

    const baseItem = window.GameItems.findItemById(baseItemId);
    const itemName = window.GameItems.getItemDisplayName(baseItem);
    ui.cancelSynthesis();
    ui.addLog(`一括合成: ${itemName} に${synthesizedCount}個を合成した。`);
    ui.render();
    saveGame();
  }
  */

  function gameLoop(now) {
    const loopInterval = document.hidden
      ? HIDDEN_LOOP_INTERVAL_MS
      : ACTIVE_LOOP_INTERVAL_MS;
    if (now - lastLoopFrameAt < loopInterval) {
      requestAnimationFrame(gameLoop);
      return;
    }
    lastLoopFrameAt = now;

    const delta = (now - state.lastAutoTick) / 1000;
    state.lastAutoTick = now;
    if (state.enemy?.isBoss) {
      state.bossTimeLeft -= delta;
      if (state.bossTimeLeft <= 0 && state.enemy.hp > 0) {
        window.GameEnemies.failBoss();
      }
    }
    window.GameAllies.autoAttack(now);
    ui.renderBattle();
    requestAnimationFrame(gameLoop);
  }

  function bindEvents() {
    document.addEventListener(
      "gesturestart",
      (event) => event.preventDefault(),
      { passive: false },
    );
    document.addEventListener(
      "gesturechange",
      (event) => event.preventDefault(),
      { passive: false },
    );
    document.addEventListener(
      "gestureend",
      (event) => event.preventDefault(),
      { passive: false },
    );
    const enemyArea = ui.enemyArea();
    const battlePanel = document.querySelector(".battle-panel") || enemyArea;
    function shouldHandleBattleTap(event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return true;
      const interactiveTarget = target.closest("button, a, input, select, textarea");
      return !interactiveTarget || interactiveTarget === ui.enemyButton();
    }

    function attackFromBattleTap(event) {
      if (!shouldHandleBattleTap(event)) return;
      event.preventDefault();
      window.GameBattle.onTapEnemy();
    }

    const isTouchDevice =
      "ontouchstart" in window || Number(navigator.maxTouchPoints) > 0;
    if (isTouchDevice) {
      battlePanel.addEventListener(
        "touchstart",
        (event) => {
          if (!shouldHandleBattleTap(event)) return;
          if (event.touches.length > 1) return;
          attackFromBattleTap(event);
        },
        { passive: false },
      );
    } else if (window.PointerEvent) {
      battlePanel.addEventListener(
        "pointerdown",
        attackFromBattleTap,
        { passive: false },
      );
    } else {
      battlePanel.addEventListener("click", (event) => {
        if (!shouldHandleBattleTap(event)) return;
        window.GameBattle.onTapEnemy();
      });
    }
    battlePanel.addEventListener("click", (event) => {
      if (!window.PointerEvent || event.detail !== 0) return;
      if (!shouldHandleBattleTap(event)) return;
      window.GameBattle.onTapEnemy();
    });
    battlePanel.addEventListener(
      "dblclick",
      (event) => event.preventDefault(),
      { passive: false },
    );
    ui.els.challengeBossBtn.addEventListener(
      "click",
      window.GameEnemies.startBossBattle,
    );
    ui.els.escapeBossBtn.addEventListener(
      "click",
      window.GameEnemies.escapeBoss,
    );
    ui.els.buyTapBtn.addEventListener("click", () =>
      window.GameBattle.purchaseUpgrade("tap"),
    );
    ui.els.maxTapBtn.addEventListener("click", () =>
      window.GameBattle.purchaseMaxUpgrade("tap"),
    );
    ui.els.buyCritBtn.addEventListener("click", () =>
      window.GameBattle.purchaseUpgrade("crit"),
    );
    ui.els.maxCritBtn.addEventListener("click", () =>
      window.GameBattle.purchaseMaxUpgrade("crit"),
    );
    ui.els.buyCritDmgBtn.addEventListener("click", () =>
      window.GameBattle.purchaseUpgrade("critDamage"),
    );
    ui.els.maxCritDmgBtn.addEventListener("click", () =>
      window.GameBattle.purchaseMaxUpgrade("critDamage"),
    );

    document
      .querySelectorAll(".tab-btn")
      .forEach((btn) =>
        btn.addEventListener("click", () => ui.switchTab(btn.dataset.tab)),
      );

    document.body.addEventListener("click", (event) => {
      const clicked = event.target;
      if (!(clicked instanceof HTMLElement)) return;

      const actionSelector = [
        "[data-hire]",
        "[data-upgrade-ally]",
        "[data-item-tab]",
        "[data-equip-inventory-tab]",
        "[data-record-tab]",
        "[data-rebirth]",
        "[data-equip]",
        "[data-discard]",
        "[data-unequip]",
        "[data-toggle-lock]",
        "#bulkDiscardBtn",
      ].join(", ");
      const target = clicked.closest(actionSelector);
      if (!(target instanceof HTMLElement)) return;

      if (target.dataset.hire) {
        const template = window.GameAllies.allyTemplates.find(
          (entry) => entry.id === target.dataset.hire,
        );
        if (template) window.GameAllies.hireAlly(template);
        return;
      }

      if (target.dataset.upgradeAlly) {
        window.GameAllies.upgradeAlly(target.dataset.upgradeAlly);
        return;
      }

      if (target.dataset.itemTab) {
        ui.switchItemTab(target.dataset.itemTab);
        return;
      }

      if (target.dataset.equipInventoryTab) {
        ui.switchEquipInventoryTab(target.dataset.equipInventoryTab);
        return;
      }

      if (target.dataset.recordTab) {
        ui.switchRecordTab(target.dataset.recordTab);
        return;
      }

      if (target.dataset.rebirth) {
        if (!window.GameRebirth?.canRebirth?.()) return;
        if (
          confirm(
            "次のダンジョンへ行くと階層、ゴールド、プレイヤー強化、仲間の状態がリセットされます。装備と秘宝は残ります。次のダンジョンへ行きますか？",
          )
        ) {
          window.GameRebirth.rebirth();
        }
        return;
      }

      if (target.dataset.equip) {
        equipItem(Number(target.dataset.equip));
        return;
      }

      if (target.dataset.discard) {
        discardItem(Number(target.dataset.discard));
        return;
      }

      /*
      if (target.dataset.startSynthesis) {
        if (ui.startSynthesis(Number(target.dataset.startSynthesis))) {
          ui.addLog("合成元を選択した。素材にする同種装備を選んでください。");
        }
        return;
      }

      if (target.dataset.bulkSynthesis) {
        bulkSynthesizeItem(Number(target.dataset.bulkSynthesis));
        return;
      }

      if (target.dataset.synthesisMaterial) {
        synthesizeItem(Number(target.dataset.synthesisMaterial));
        return;
      }

      if (target.dataset.cancelSynthesis) {
        ui.cancelSynthesis();
        ui.renderEquip();
        return;
      }
      */

      if (target.dataset.unequip) {
        unequipItem(target.dataset.unequip);
        return;
      }

      if (target.dataset.toggleLock) {
        window.GameItems.toggleItemLock(Number(target.dataset.toggleLock));
        ui.render();
        saveGame();
        return;
      }

      if (target.id === "bulkDiscardBtn") {
        if (
          confirm(
            "装備中とロック中以外の所持装備をまとめて破棄します。よろしいですか？",
          )
        ) {
          const discardedCount = window.GameItems.discardUnlockedItems();
          ui.addLog(`一括破棄: ${discardedCount}個を捨てた。`);
          ui.render();
          saveGame();
        }
      }
    });

    document.addEventListener("change", (event) => {
      const target = event.target;
      if (target instanceof HTMLSelectElement) {
        if (target.id === "autoDiscardRaritySelect") {
          state.itemSettings.autoDiscardRarity = target.value;
          saveGame();
        }
        return;
      }
      if (!(target instanceof HTMLInputElement)) return;
      if (target.id === "autoDiscardAttackInput") {
        state.itemSettings.autoDiscardAttackPercent = Math.max(
          0,
          Number(target.value) || 0,
        );
        saveGame();
        return;
      }
      if (target.id === "autoChallengeBossCheckbox") {
        state.settings.autoChallengeBoss = target.checked;
        if (
          target.checked &&
          state.pendingBossFloor !== null &&
          !state.enemy?.isBoss
        ) {
          window.GameEnemies.startBossBattle();
          return;
        }
        saveGame();
      }
    });
  }

  function init() {
    updateMobileLayoutWidth();
    const hasSave = loadGame();
    ui.addLog(
      hasSave
        ? "セーブデータを読み込みました。"
        : "ゲーム開始。まずは敵を倒して進もう。",
    );
    bindEvents();
    if (!state.enemy) {
      window.GameEnemies.spawnEnemy();
    } else {
      window.GameUI.enemyButton().textContent = "";
    }
    ui.render();
    showIntroPopupIfNeeded();
    requestAnimationFrame(gameLoop);
  }

  window.addEventListener("beforeunload", saveGame);
  window.addEventListener("orientationchange", () => {
    window.setTimeout(updateMobileLayoutWidth, 100);
  });

  init();
})();
