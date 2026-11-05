(() => {
  const RUN_DURATION_MS = 5 * 60 * 1000;
  const BASE_SPAWN_INTERVAL_MS = 2800;
  const SPAWN_GROWTH_PER_STEP = 1.05;
  const SPAWN_STEP_MS = 15000;
  const MAX_ACTIVE_ENEMIES = 10;

  const UPGRADE_DEFINITIONS = [
    {
      id: "castSpeed",
      title: "Conjuração acelerada",
      description: "Reduz em 10% o intervalo entre disparos.",
      icon: "✦",
      max: 5
    },
    {
      id: "multiShot",
      title: "Rajada adicional",
      description: "Dispara mais 1 projétil por conjuração.",
      icon: "✧",
      max: 3
    },
    {
      id: "projectileSpeed",
      title: "Projéteis velozes",
      description: "Aumenta em 15% a velocidade das magias.",
      icon: "➤",
      max: 5
    },
    {
      id: "moveSpeed",
      title: "Passos arcanos",
      description: "Aumenta em 8% a velocidade de movimento.",
      icon: "»",
      max: 5
    },
    {
      id: "xpMagnet",
      title: "Atração de experiência",
      description: "Aumenta em 30% a distância para coletar orbes de XP.",
      icon: "◉",
      max: 5
    },
    {
      id: "xpBonus",
      title: "Conhecimento arcano",
      description: "Cada orbe passa a conceder mais 5 pontos de experiência.",
      icon: "✧",
      max: 5
    }
  ];

  let attempts = 0;

  function installProgression() {
    const game = window.arcaneGame;
    const scene = game && game.scene && game.scene.scenes && game.scene.scenes[0];

    if (!scene || !scene.wizardReady || !scene.wizard || !scene.__combatInstalled) {
      if (++attempts < 300) window.setTimeout(installProgression, 50);
      else console.error("Arcane Survival: o sistema de progressão não conseguiu conectar à cena.");
      return;
    }

    if (scene.__progressionInstalled) return;
    scene.__progressionInstalled = true;

    scene.initializeSurvivalRun = function () {
      if (this.runStarted) return;

      this.runStarted = true;
      this.runOver = false;
      this.runElapsedMs = 0;
      this.runHudAccumulator = 0;
      this.spawnRateStage = 0;
      this.nextEnemySpawnAtMs = BASE_SPAWN_INTERVAL_MS;

      this.level = 1;
      this.totalExperience = 0;
      this.pendingLevelUps = 0;
      this.isChoosingUpgrade = false;
      this.upgradeRanks = Object.fromEntries(
        UPGRADE_DEFINITIONS.map(definition => [definition.id, 0])
      );

      this.castIntervalMs = 1800;
      this.projectilesPerCast = 1;
      this.projectileSpeedMultiplier = 1;
      this.playerSpeed = this.playerSpeed || 260;
      this.xpPickupRadius = 30;
      this.xpOrbValue = 10;
      this.xpOrbs = [];
      this.totalKills = 0;

      this.updateSurvivalHud();
    };

    // A frequência cresce 5% de forma composta a cada 15 segundos.
    scene.getCurrentSpawnInterval = function () {
      const multiplier = Math.pow(SPAWN_GROWTH_PER_STEP, this.spawnRateStage || 0);
      return Math.max(450, Math.round(BASE_SPAWN_INTERVAL_MS / multiplier));
    };

    scene.startEnemySpawning = function () {
      if (this.survivalSpawnerStarted) return;
      this.survivalSpawnerStarted = true;

      // Cancela o temporizador fixo antigo para não haver dois spawners em paralelo.
      if (this.enemySpawnTimer) {
        this.enemySpawnTimer.remove(false);
        this.enemySpawnTimer = null;
      }

      // Mantém os dois inimigos iniciais, sem duplicá-los se a partida já tiver começado.
      while (this.enemies.length < 2) this.spawnEnemy();
      this.nextEnemySpawnAtMs = this.runElapsedMs + BASE_SPAWN_INTERVAL_MS;
    };

    scene.getNearestEnemies = function (x, y, amount) {
      return this.enemies
        .filter(enemy => enemy.alive !== false && enemy.sprite && enemy.sprite.active)
        .map(enemy => ({
          enemy,
          distance: Phaser.Math.Distance.Between(x, y, enemy.sprite.x, enemy.sprite.y)
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, amount)
        .map(entry => entry.enemy);
    };

    // Multidisparo: os projéteis escolhem alvos diferentes sempre que possível.
    scene.castElementSpell = function () {
      if (!this.wizard || !this.selectedElement || this.runOver) return;

      const amount = Math.max(1, this.projectilesPerCast || 1);
      const targets = this.getNearestEnemies(this.wizard.x, this.wizard.y, amount);
      if (targets.length === 0) return;

      const primaryTarget = targets[0];
      const dx = primaryTarget.sprite.x - this.wizard.x;
      const dy = primaryTarget.sprite.y - this.wizard.y;
      this.wizardFacing = this.getFacingFromVector(dx, dy);

      if (!this.wizard.anims.isPlaying) {
        this.wizard.setTexture("wizard-" + this.wizardFacing, 0);
      }

      const element = this.selectedElement;
      const origin = this.getSpellOrigin(this.wizardFacing);
      const direction = new Phaser.Math.Vector2(dx, dy).normalize();
      this.createCastingAnimation(element, origin.x, origin.y, direction);

      this.time.delayedCall(150, () => {
        if (!this.wizard || this.runOver) return;

        let currentTargets = targets.filter(target => target.alive && target.sprite.active);
        if (currentTargets.length === 0) {
          currentTargets = this.getNearestEnemies(this.wizard.x, this.wizard.y, amount);
        }
        if (currentTargets.length === 0) return;

        const shotCount = Math.max(1, this.projectilesPerCast || 1);
        for (let i = 0; i < shotCount; i++) {
          const target = currentTargets[i] || currentTargets[0];
          const aim = new Phaser.Math.Vector2(
            target.sprite.x - origin.x,
            target.sprite.y - origin.y
          ).normalize();

          // Pequeno espaçamento de saída mantém as rajadas visualmente separadas.
          const perpendicularX = -aim.y;
          const perpendicularY = aim.x;
          const offset = (i - (shotCount - 1) / 2) * 5;
          const startX = origin.x + perpendicularX * offset;
          const startY = origin.y + perpendicularY * offset;

          const sprite = this.createElementProjectile(element, startX, startY, aim);
          this.projectiles.push({
            sprite,
            element,
            target,
            speed: 390 * (this.projectileSpeedMultiplier || 1),
            hitRadius: 8
          });
        }
      });
    };

    scene.resetSpellTimer = function () {
      if (!this.selectedElement || !this.wizardReady || this.runOver) return;
      if (this.spellTimer) this.spellTimer.remove(false);

      this.spellTimer = this.time.addEvent({
        delay: this.castIntervalMs,
        loop: true,
        callback: this.castElementSpell,
        callbackScope: this
      });
    };

    const originalStartCasting = scene.startElementCasting.bind(scene);
    scene.startElementCasting = function () {
      this.initializeSurvivalRun();
      return originalStartCasting();
    };

    // A seleção pode ter ocorrido antes deste módulo terminar de instalar.
    if (scene.selectedElement) {
      scene.initializeSurvivalRun();
      scene.startEnemySpawning();
      if (scene.spellTimer) scene.spellTimer.remove(false);
      scene.spellTimer = scene.time.addEvent({
        delay: scene.castIntervalMs,
        loop: true,
        callback: scene.castElementSpell,
        callbackScope: scene
      });
      scene.castElementSpell();
    }

    scene.createExperienceOrb = function (x, y) {
      if (!this.xpOrbs) this.xpOrbs = [];

      const shadow = this.add.ellipse(x, y + 5, 15, 7, 0x05070c, 0.45)
        .setDepth(17);
      const glow = this.add.circle(x, y - 3, 10, 0xffffff, 0.14)
        .setDepth(18);
      const orb = this.add.circle(x, y - 3, 5, 0xf8ffff, 1)
        .setStrokeStyle(1.5, 0xb8eaff, 1)
        .setDepth(19);

      const core = this.add.circle(x - 1.5, y - 5, 1.8, 0xffffff, 1)
        .setDepth(20);

      this.tweens.add({
        targets: [orb, core],
        y: "-=5",
        duration: 320,
        yoyo: true,
        ease: "Sine.easeInOut",
        repeat: -1
      });
      this.tweens.add({
        targets: glow,
        scale: 1.45,
        alpha: 0.34,
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });

      this.xpOrbs.push({
        orb,
        glow,
        core,
        shadow,
        value: this.xpOrbValue || 10
      });
    };

    scene.getNextLevelThreshold = function (level) {
      return 100 + (level - 1) * 200;
    };

    scene.getPreviousLevelThreshold = function (level) {
      return level <= 1 ? 0 : 100 + (level - 2) * 200;
    };

    scene.updateSurvivalHud = function () {
      const remainingMs = Math.max(0, RUN_DURATION_MS - (this.runElapsedMs || 0));
      const totalSeconds = Math.ceil(remainingMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      const timer = document.getElementById("run-timer");
      const level = document.getElementById("run-level");
      const xp = document.getElementById("run-xp");
      const kills = document.getElementById("run-kills");
      const pressure = document.getElementById("spawn-pressure");
      const xpLabel = document.getElementById("xp-label");
      const xpFill = document.getElementById("xp-fill");

      if (timer) timer.textContent = String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
      if (level) level.textContent = String(this.level || 1);
      if (xp) xp.textContent = (this.totalExperience || 0) + " / " + this.getNextLevelThreshold(this.level || 1);
      if (kills) kills.textContent = String(this.totalKills || 0);

      const multiplier = Math.pow(SPAWN_GROWTH_PER_STEP, this.spawnRateStage || 0);
      const pressurePercent = Math.round((multiplier - 1) * 100);
      if (pressure) pressure.textContent = "+" + pressurePercent + "%";

      const currentLevelStart = this.getPreviousLevelThreshold(this.level || 1);
      const nextLevelAt = this.getNextLevelThreshold(this.level || 1);
      const progress = Math.max(0, Math.min(1,
        ((this.totalExperience || 0) - currentLevelStart) / (nextLevelAt - currentLevelStart)
      ));

      if (xpLabel) xpLabel.textContent = (this.totalExperience || 0) + " / " + nextLevelAt + " XP";
      if (xpFill) xpFill.style.width = Math.round(progress * 100) + "%";
    };

    scene.collectExperienceOrb = function (orbIndex) {
      const orbData = this.xpOrbs[orbIndex];
      if (!orbData) return;

      this.xpOrbs.splice(orbIndex, 1);
      [orbData.orb, orbData.glow, orbData.core, orbData.shadow].forEach(object => {
        if (object && object.active) object.destroy();
      });

      // Pequeno brilho de coleta.
      for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 * i) / 5;
        const particle = this.add.circle(
          this.wizard.x + Math.cos(angle) * 7,
          this.wizard.y - 20 + Math.sin(angle) * 7,
          2,
          0xe9fbff,
          0.95
        ).setDepth(21);
        this.tweens.add({
          targets: particle,
          x: particle.x + Math.cos(angle) * 20,
          y: particle.y + Math.sin(angle) * 20,
          alpha: 0,
          scale: 0.2,
          duration: 320,
          onComplete: () => particle.destroy()
        });
      }

      this.totalExperience += orbData.value;
      let levelsGained = 0;
      while (this.totalExperience >= this.getNextLevelThreshold(this.level)) {
        this.level += 1;
        levelsGained += 1;
      }

      this.updateSurvivalHud();
      if (levelsGained > 0) {
        this.pendingLevelUps += levelsGained;
        this.showUpgradeChoices();
      }
    };

    scene.updateExperienceOrbs = function () {
      if (!this.wizard || !this.xpOrbs || this.xpOrbs.length === 0) return;

      for (let i = this.xpOrbs.length - 1; i >= 0; i--) {
        const data = this.xpOrbs[i];
        const distance = Phaser.Math.Distance.Between(
          this.wizard.x,
          this.wizard.y - 20,
          data.orb.x,
          data.orb.y
        );

        if (distance <= this.xpPickupRadius) {
          this.collectExperienceOrb(i);
          if (this.isChoosingUpgrade) return;
        }
      }
    };

    scene.getAvailableUpgradeChoices = function () {
      const available = UPGRADE_DEFINITIONS.filter(definition =>
        (this.upgradeRanks[definition.id] || 0) < definition.max
      );
      // Embaralhamento Fisher-Yates para três opções sem repetição na mesma escolha.
      for (let i = available.length - 1; i > 0; i--) {
        const j = Phaser.Math.Between(0, i);
        [available[i], available[j]] = [available[j], available[i]];
      }
      return available.slice(0, 3);
    };

    scene.showUpgradeChoices = function () {
      if (this.isChoosingUpgrade || this.pendingLevelUps <= 0 || this.runOver) return;

      const overlay = document.getElementById("levelup-overlay");
      const title = document.getElementById("levelup-title");
      const options = document.getElementById("upgrade-options");
      if (!overlay || !title || !options) return;

      this.isChoosingUpgrade = true;
      this.scene.pause();

      title.textContent = "NÍVEL " + this.level + " ALCANÇADO";
      options.replaceChildren();

      const choices = this.getAvailableUpgradeChoices();
      choices.forEach(definition => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "upgrade-card";

        const icon = document.createElement("span");
        icon.className = "upgrade-icon";
        icon.textContent = definition.icon;

        const name = document.createElement("strong");
        name.textContent = definition.title;

        const description = document.createElement("span");
        description.textContent = definition.description;

        const rank = document.createElement("small");
        rank.textContent = "NÍVEL " + ((this.upgradeRanks[definition.id] || 0) + 1) +
          " / " + definition.max;

        button.append(icon, name, description, rank);
        button.addEventListener("click", () => this.chooseUpgrade(definition.id));
        options.appendChild(button);
      });

      overlay.classList.remove("is-hidden");
      overlay.setAttribute("aria-hidden", "false");
    };

    scene.chooseUpgrade = function (upgradeId) {
      if (!this.isChoosingUpgrade || this.runOver) return;

      const definition = UPGRADE_DEFINITIONS.find(item => item.id === upgradeId);
      if (!definition) return;

      const currentRank = this.upgradeRanks[upgradeId] || 0;
      if (currentRank >= definition.max) return;

      this.upgradeRanks[upgradeId] = currentRank + 1;

      switch (upgradeId) {
        case "castSpeed":
          this.castIntervalMs = Math.max(650, Math.round((this.castIntervalMs || 1800) * 0.9));
          this.resetSpellTimer();
          break;
        case "multiShot":
          this.projectilesPerCast = Math.min(4, (this.projectilesPerCast || 1) + 1);
          break;
        case "projectileSpeed":
          this.projectileSpeedMultiplier = (this.projectileSpeedMultiplier || 1) * 1.15;
          break;
        case "moveSpeed":
          this.playerSpeed = (this.playerSpeed || 260) * 1.08;
          break;
        case "xpMagnet":
          this.xpPickupRadius = (this.xpPickupRadius || 30) * 1.3;
          break;
        case "xpBonus":
          this.xpOrbValue = (this.xpOrbValue || 10) + 5;
          break;
      }

      this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1);
      this.updateSurvivalHud();

      const status = document.getElementById("message");
      if (status) {
        status.textContent = definition.title + " adquirido. Próximo disparo em " +
          (this.castIntervalMs / 1000).toFixed(2).replace(".", ",") + "s.";
      }

      if (this.pendingLevelUps > 0) {
        this.isChoosingUpgrade = false;
        this.showUpgradeChoices();
        return;
      }

      this.isChoosingUpgrade = false;
      const overlay = document.getElementById("levelup-overlay");
      if (overlay) {
        overlay.classList.add("is-hidden");
        overlay.setAttribute("aria-hidden", "true");
      }
      this.scene.resume();
    };

    scene.endSurvivalRun = function () {
      if (this.runOver) return;
      this.runOver = true;

      if (this.spellTimer) {
        this.spellTimer.remove(false);
        this.spellTimer = null;
      }
      if (this.enemySpawnTimer) {
        this.enemySpawnTimer.remove(false);
        this.enemySpawnTimer = null;
      }

      const overlay = document.getElementById("run-ended-overlay");
      const summary = document.getElementById("run-ended-summary");
      if (summary) {
        summary.textContent = "Nível " + this.level + " · " +
          this.totalExperience + " XP · " + this.totalKills + " inimigos derrotados";
      }
      if (overlay) {
        overlay.classList.remove("is-hidden");
        overlay.setAttribute("aria-hidden", "false");
      }
      this.scene.pause();
    };

    const originalDeath = scene.applyEnemyDeath.bind(scene);
    scene.applyEnemyDeath = function (enemy, element, x, y) {
      const shouldDrop = !!(enemy && enemy.alive);
      const result = originalDeath(enemy, element, x, y);
      if (shouldDrop) {
        this.totalKills += 1;
        this.createExperienceOrb(x, y);
        this.updateSurvivalHud();
      }
      return result;
    };

    scene.updateSurvival = function (delta) {
      if (!this.runStarted || this.runOver) return;

      this.runElapsedMs += Math.max(0, delta || 0);
      const elapsed = this.runElapsedMs;

      const nextStage = Math.floor(elapsed / SPAWN_STEP_MS);
      if (nextStage !== this.spawnRateStage) {
        this.spawnRateStage = nextStage;
        this.nextEnemySpawnAtMs = elapsed + this.getCurrentSpawnInterval();
      }

      if (elapsed >= this.nextEnemySpawnAtMs) {
        if (this.enemies.length < MAX_ACTIVE_ENEMIES) this.spawnEnemy();
        this.nextEnemySpawnAtMs = elapsed + this.getCurrentSpawnInterval();
      }

      this.updateExperienceOrbs();

      this.runHudAccumulator += delta || 0;
      if (this.runHudAccumulator >= 200) {
        this.runHudAccumulator = 0;
        this.updateSurvivalHud();
      }

      if (elapsed >= RUN_DURATION_MS) {
        this.updateSurvivalHud();
        this.endSurvivalRun();
      }
    };

    // O POST_UPDATE roda depois do movimento do mago, dos inimigos e dos projéteis.
    scene.sys.events.on(Phaser.Scenes.Events.POST_UPDATE, function (_time, delta) {
      this.updateSurvival(delta);
    }, scene);

    const restartButton = document.getElementById("run-restart");
    if (restartButton && !restartButton.dataset.bound) {
      restartButton.dataset.bound = "true";
      restartButton.addEventListener("click", () => window.location.reload());
    }

    // Caso o jogador escolha o elemento quase ao mesmo tempo em que o módulo instala.
    if (scene.selectedElement && !scene.runStarted) {
      scene.startElementCasting();
    }

    console.info("Arcane Survival: temporizador, XP, níveis e melhorias ativados.");
  }

  installProgression();
})();
