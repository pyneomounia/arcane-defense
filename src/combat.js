(() => {
  let attempts = 0;

  function installCombat() {
    const game = window.arcaneGame;
    const scene = game?.scene?.getScene?.("TrainingScene") || game?.scene?.scenes?.[0];

    if (!scene || !scene.wizardReady || !scene.wizard) {
      if (++attempts < 240) window.setTimeout(installCombat, 50);
      else console.error("Arcane Survival: cena não ficou pronta para receber o combate.");
      return;
    }
    if (scene.__combatInstalled) return;
    scene.__combatInstalled = true;
    scene.projectiles = [];

    const labels = { fire:"FOGO", ice:"GELO", water:"ÁGUA", earth:"TERRA", lightning:"RAIO" };

    const originalSpawn = scene.spawnEnemy.bind(scene);
    scene.spawnEnemy = function () {
      const before = this.enemies.length;
      originalSpawn();
      if (this.enemies.length === before) return;
      const enemy = this.enemies[this.enemies.length - 1];
      enemy.alive = true;
      enemy.hitRadius = enemy.type === "wolf" ? 23 : 17;
      enemy.baseScaleX = enemy.sprite.scaleX;
      enemy.baseScaleY = enemy.sprite.scaleY;
    };

    scene.enemies.forEach(enemy => {
      enemy.alive = true;
      enemy.hitRadius = enemy.type === "wolf" ? 23 : 17;
      enemy.baseScaleX = enemy.sprite.scaleX;
      enemy.baseScaleY = enemy.sprite.scaleY;
    });

    scene.getNearestEnemy = function (x, y) {
      let found = null, best = Infinity;
      this.enemies.forEach(enemy => {
        if (!enemy.alive || !enemy.sprite.active) return;
        const d = Phaser.Math.Distance.Between(x, y, enemy.sprite.x, enemy.sprite.y);
        if (d < best) { best = d; found = enemy; }
      });
      return found;
    };

    scene.getFacingFromVector = function (dx, dy) {
      if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "left" : "right";
      return dy < 0 ? "back" : "front";
    };

    scene.selectElement = function (element) {
      if (!Object.prototype.hasOwnProperty.call(labels, element) || this.selectedElement) return;
      this.selectedElement = element;
      const label = document.getElementById("selected-element");
      if (label) label.textContent = labels[element];
      document.getElementById("element-select")?.classList.add("is-hidden");
      document.body.classList.remove("element-menu-open");
      this.startElementCasting();
    };

    scene.startElementCasting = function () {
      if (!this.wizardReady || !this.selectedElement || this.spellTimer) return;
      const status = document.getElementById("message");
      if (status) status.textContent = "Afinidade escolhida: " + labels[this.selectedElement] +
        ". Projéteis perseguem o inimigo mais próximo a cada 1,8 segundo.";
      this.startEnemySpawning();
      this.castElementSpell();
      this.spellTimer = this.time.addEvent({
        delay: 1800, loop: true, callback: this.castElementSpell, callbackScope: this
      });
    };

    scene.castElementSpell = function () {
      if (!this.wizard || !this.selectedElement) return;
      const target = this.getNearestEnemy(this.wizard.x, this.wizard.y);
      if (!target) return;

      const dx = target.sprite.x - this.wizard.x;
      const dy = target.sprite.y - this.wizard.y;
      this.wizardFacing = this.getFacingFromVector(dx, dy);
      if (!this.wizard.anims.isPlaying) this.wizard.setTexture("wizard-" + this.wizardFacing, 0);

      const element = this.selectedElement;
      const origin = this.getSpellOrigin(this.wizardFacing);
      const aim = new Phaser.Math.Vector2(dx, dy).normalize();
      this.createCastingAnimation(element, origin.x, origin.y, aim);

      this.time.delayedCall(150, () => {
        if (!this.wizard) return;
        const current = target.alive ? target : this.getNearestEnemy(this.wizard.x, this.wizard.y);
        if (!current) return;
        const direction = new Phaser.Math.Vector2(
          current.sprite.x - origin.x, current.sprite.y - origin.y
        ).normalize();
        const sprite = this.createElementProjectile(element, origin.x, origin.y, direction);
        this.projectiles.push({ sprite, element, target: current, speed: 390, hitRadius: 8 });
      });
    };

    scene.createLightningTexture = function () {
      if (this.textures.exists("projectile-lightning")) return;
      const texture = this.textures.createCanvas("projectile-lightning", 64, 32);
      const ctx = texture.getContext();
      ctx.imageSmoothingEnabled = false;
      const bolt = (color, points) => {
        ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
        points.slice(1).forEach(p => ctx.lineTo(p[0], p[1]));
        ctx.closePath(); ctx.fillStyle = color; ctx.fill();
      };
      bolt("#7540d8", [[3,17],[19,10],[26,15],[39,5],[34,14],[59,15],[39,24],[31,18],[12,27],[18,18]]);
      bolt("#ead9ff", [[5,17],[19,12],[25,16],[38,8],[34,16],[54,16],[38,22],[31,17],[15,24],[19,18]]);
      ctx.fillStyle = "#fff"; ctx.fillRect(20,15,4,2); ctx.fillRect(36,15,4,2);
      texture.refresh();
    };
    scene.createLightningTexture();

    scene.createElementProjectile = function (element, x, y, direction) {
      const sizes = { fire:[42,19], ice:[38,21], water:[34,22], earth:[36,21], lightning:[52,26] };
      const size = sizes[element] || [38,21];
      const key = element === "lightning" ? "projectile-lightning" : "projectile-" + element;
      return this.add.image(x, y, key).setOrigin(.5,.5)
        .setDisplaySize(size[0],size[1])
        .setRotation(Math.atan2(direction.y,direction.x)).setDepth(12);
    };

    scene.deathParticles = function (x, y, colors, count, round = false) {
      for (let i=0; i<count; i++) {
        const a = Phaser.Math.FloatBetween(0,Math.PI*2);
        const d = Phaser.Math.Between(14,42);
        const size = Phaser.Math.Between(2,5);
        const color = colors[i % colors.length];
        const p = round ? this.add.circle(x,y,size/2,color,.95) : this.add.rectangle(x,y,size,size,color,.95);
        p.setDepth(16);
        this.tweens.add({
          targets:p, x:x+Math.cos(a)*d, y:y+Math.sin(a)*d-6,
          alpha:0, scale:.15, angle:Phaser.Math.Between(-180,180),
          duration:Phaser.Math.Between(550,850), onComplete:()=>p.destroy()
        });
      }
    };

    scene.applyEnemyDeath = function (enemy, element, hitX, hitY) {
      if (!enemy || !enemy.alive) return;

      // O inimigo para de perseguir e sai da lista de alvos, mas seu sprite
      // permanece na tela até o término da animação gradual.
      enemy.alive = false;
      const enemyIndex = this.enemies.indexOf(enemy);
      if (enemyIndex !== -1) this.enemies.splice(enemyIndex, 1);
      this.tweens.killTweensOf(enemy.sprite);
      enemy.sprite.setScale(enemy.baseScaleX, enemy.baseScaleY);
      this.updateEnemyCounter();

      const sprite = enemy.sprite;
      const shadow = enemy.shadow;
      const centerX = sprite.x;
      // Os sprites usam a origem perto dos pés; centralizamos os efeitos no corpo.
      const centerY = sprite.y - sprite.displayHeight * (sprite.originY - 0.5);
      const depth = (sprite.depth || 10) + 2;
      const bodyWidth = Math.max(34, sprite.displayWidth || 46);
      const bodyHeight = Math.max(30, sprite.displayHeight || 43);

      const makeRing = (color, radius, lineWidth = 3, duration = 650) => {
        const ring = this.add.circle(centerX, centerY, radius, color, 0)
          .setStrokeStyle(lineWidth, color, 0.95)
          .setDepth(depth + 2);
        this.tweens.add({
          targets: ring,
          scale: 2.4,
          alpha: 0,
          duration,
          ease: 'Quad.easeOut',
          onComplete: () => ring.destroy()
        });
        return ring;
      };

      const makeGlow = (color, alpha = 0.28) => {
        const glow = this.add.ellipse(
          centerX, centerY, bodyWidth * 1.55, bodyHeight * 1.7, color, alpha
        ).setDepth(depth);
        this.tweens.add({
          targets: glow,
          scaleX: 1.45,
          scaleY: 1.45,
          alpha: 0,
          duration: 760,
          ease: 'Sine.easeOut',
          onComplete: () => glow.destroy()
        });
        return glow;
      };

      const burst = (colors, count, spread, minSize, maxSize, duration, round = false) => {
        for (let i = 0; i < count; i++) {
          const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
          const distance = Phaser.Math.Between(Math.round(spread * 0.35), spread);
          const size = Phaser.Math.Between(minSize, maxSize);
          const color = colors[i % colors.length];
          const particle = round
            ? this.add.circle(centerX, centerY, size / 2, color, 0.98)
            : this.add.rectangle(centerX, centerY, size, size, color, 0.98);

          particle.setDepth(depth + 4);
          this.tweens.add({
            targets: particle,
            x: centerX + Math.cos(angle) * distance,
            y: centerY + Math.sin(angle) * distance - Phaser.Math.Between(4, 18),
            alpha: 0,
            scale: 0.12,
            angle: Phaser.Math.Between(-220, 220),
            duration: Phaser.Math.Between(Math.round(duration * 0.75), duration),
            ease: 'Cubic.easeOut',
            onComplete: () => particle.destroy()
          });
        }
      };

      // Um clarão curto deixa o contato da magia evidente em qualquer elemento.
      const impactFlash = this.add.circle(centerX, centerY, 18, 0xffffff, 0.78)
        .setDepth(depth + 5);
      this.tweens.add({
        targets: impactFlash,
        scale: 2.15,
        alpha: 0,
        duration: 190,
        ease: 'Quad.easeOut',
        onComplete: () => impactFlash.destroy()
      });

      if (element === 'fire') {
        // FOGO: o corpo arde por um instante, é tomado pelas chamas e vira carvão/cinzas.
        sprite.setTint(0xff8a36);
        makeGlow(0xff4c17, 0.38);
        makeRing(0xff9a34, Math.max(15, bodyWidth * 0.42), 4, 720);
        burst([0xffef91, 0xffaa35, 0xf45a22], 22, 48, 3, 8, 780, true);

        // Línguas de fogo visíveis sobem ao redor do corpo, em vez de partículas minúsculas.
        for (let i = 0; i < 9; i++) {
          const offsetX = (i - 4) * (bodyWidth / 9);
          const flameHeight = Phaser.Math.Between(15, 26);
          const flame = this.add.ellipse(
            centerX + offsetX,
            centerY + Phaser.Math.Between(-4, 8),
            Phaser.Math.Between(7, 12),
            flameHeight,
            i % 2 ? 0xffb12f : 0xf0521d,
            0.94
          ).setDepth(depth + 3).setRotation(Phaser.Math.FloatBetween(-0.35, 0.35));

          this.tweens.add({
            targets: flame,
            y: flame.y - Phaser.Math.Between(22, 38),
            scaleX: 0.45,
            scaleY: 1.45,
            alpha: 0,
            duration: Phaser.Math.Between(560, 880),
            delay: i * 35,
            ease: 'Sine.easeOut',
            onComplete: () => flame.destroy()
          });
        }

        this.tweens.add({
          targets: sprite,
          angle: sprite.angle + 5,
          scaleX: enemy.baseScaleX * 1.13,
          scaleY: enemy.baseScaleY * 1.08,
          duration: 360,
          yoyo: true,
          repeat: 1,
          ease: 'Sine.easeInOut'
        });

        this.time.delayedCall(820, () => {
          sprite.setTint(0x403b35);
          burst([0x292725, 0x51483e, 0x76604a, 0x191a1a], 24, 54, 3, 8, 1050);
          this.tweens.add({
            targets: [sprite, shadow],
            alpha: 0,
            scaleX: 0.08,
            scaleY: 0.08,
            duration: 1050,
            ease: 'Quad.easeIn',
            onComplete: () => { sprite.destroy(); shadow.destroy(); }
          });
        });

      } else if (element === 'lightning') {
        // RAIO: arcos elétricos cruzam o inimigo; o corpo treme e termina carbonizado.
        sprite.setTint(0xe8d8ff);
        makeGlow(0x8a43f5, 0.42);
        makeRing(0xc89aff, Math.max(16, bodyWidth * 0.46), 4, 600);
        burst([0xf4eaff, 0xc18aff, 0x8242e8], 20, 48, 3, 7, 580, true);

        // Três raios em zigue-zague desenhados por cima do corpo.
        for (let boltIndex = 0; boltIndex < 3; boltIndex++) {
          const bolt = this.add.graphics();
          const startX = centerX + (boltIndex - 1) * (bodyWidth * 0.28);
          const startY = centerY - bodyHeight * 0.65;
          const endY = centerY + bodyHeight * 0.58;
          const direction = boltIndex % 2 === 0 ? 1 : -1;
          const points = [
            [startX, startY],
            [startX + direction * 8, startY + 8],
            [startX - direction * 5, centerY - 2],
            [startX + direction * 10, centerY + 5],
            [startX + direction * 2, endY]
          ];

          bolt.lineStyle(5, 0x8d43ed, 0.95);
          bolt.beginPath();
          bolt.moveTo(points[0][0], points[0][1]);
          points.slice(1).forEach(point => bolt.lineTo(point[0], point[1]));
          bolt.strokePath();

          bolt.lineStyle(2, 0xf2e5ff, 1);
          bolt.beginPath();
          bolt.moveTo(points[0][0], points[0][1]);
          points.slice(1).forEach(point => bolt.lineTo(point[0], point[1]));
          bolt.strokePath();
          bolt.setDepth(depth + 5);

          this.tweens.add({
            targets: bolt,
            alpha: 0,
            duration: 420,
            delay: boltIndex * 55,
            onComplete: () => bolt.destroy()
          });
        }

        this.tweens.add({
          targets: sprite,
          alpha: 0.12,
          angle: sprite.angle + 4,
          duration: 90,
          yoyo: true,
          repeat: 7,
          onComplete: () => {
            sprite.setTint(0x69636f);
            burst([0xaaa0b6, 0x68616f, 0x342f39], 24, 52, 3, 8, 920);
            this.tweens.add({
              targets: [sprite, shadow],
              alpha: 0,
              scaleX: 0.08,
              scaleY: 0.08,
              duration: 850,
              ease: 'Quad.easeIn',
              onComplete: () => { sprite.destroy(); shadow.destroy(); }
            });
          }
        });

      } else if (element === 'earth') {
        // TERRA: impacto pesado, rochas sobem, o inimigo tomba e é coberto por poeira.
        makeRing(0xc49a62, Math.max(16, bodyWidth * 0.42), 5, 700);
        makeGlow(0x8b6037, 0.25);
        burst([0xc9a16a, 0x987044, 0x6b4a2d], 16, 45, 4, 10, 760);

        for (let i = 0; i < 8; i++) {
          const angle = (Math.PI * 2 * i) / 8;
          const rock = this.add.rectangle(
            centerX + Math.cos(angle) * 13,
            centerY + Math.sin(angle) * 9,
            Phaser.Math.Between(7, 13),
            Phaser.Math.Between(7, 12),
            i % 2 ? 0x987044 : 0x62452e,
            1
          ).setAngle(Phaser.Math.Between(-35, 35)).setDepth(depth + 4);

          this.tweens.add({
            targets: rock,
            x: rock.x + Math.cos(angle) * 32,
            y: rock.y + Math.sin(angle) * 24 - 8,
            angle: rock.angle + Phaser.Math.Between(-100, 100),
            alpha: 0,
            duration: 720,
            delay: i * 28,
            ease: 'Cubic.easeOut',
            onComplete: () => rock.destroy()
          });
        }

        this.tweens.add({
          targets: sprite,
          y: sprite.y + 8,
          angle: sprite.angle + (enemy.type === 'wolf' ? 82 : 90),
          scaleY: enemy.baseScaleY * 0.62,
          duration: 680,
          ease: 'Back.easeIn'
        });

        // A poeira vem depois da queda para que o jogador consiga ver o tombamento.
        this.time.delayedCall(700, () => {
          burst([0xc2a078, 0x92704e, 0x685139, 0x4a3929], 26, 60, 4, 10, 1050, true);
          const dust = this.add.ellipse(
            centerX, centerY + 13, bodyWidth * 1.5, bodyHeight * 0.65, 0xa8875d, 0.38
          ).setDepth(depth + 3);
          this.tweens.add({
            targets: dust,
            scaleX: 1.75,
            scaleY: 1.35,
            alpha: 0,
            duration: 820,
            onComplete: () => dust.destroy()
          });
          this.tweens.add({
            targets: [sprite, shadow],
            alpha: 0,
            scaleX: 0.08,
            scaleY: 0.08,
            duration: 850,
            delay: 180,
            ease: 'Quad.easeIn',
            onComplete: () => { sprite.destroy(); shadow.destroy(); }
          });
        });

      } else if (element === 'ice') {
        // GELO: o corpo congela por inteiro, rachaduras se formam e os cristais explodem.
        sprite.setTint(0x83ddff);
        makeGlow(0x64d8ff, 0.36);
        makeRing(0xb7f4ff, Math.max(16, bodyWidth * 0.43), 4, 800);

        const iceShell = this.add.ellipse(
          centerX, centerY, bodyWidth * 1.22, bodyHeight * 1.38, 0x75dfff, 0.3
        ).setStrokeStyle(3, 0xc8f7ff, 0.95).setDepth(depth + 3);
        this.tweens.add({
          targets: iceShell,
          alpha: 0.72,
          scaleX: 1.08,
          scaleY: 1.08,
          duration: 560,
          ease: 'Sine.easeInOut'
        });

        const crystals = [];
        for (let i = 0; i < 10; i++) {
          const angle = (Math.PI * 2 * i) / 10;
          const distanceX = bodyWidth * 0.48;
          const distanceY = bodyHeight * 0.43;
          const crystal = this.add.rectangle(
            centerX + Math.cos(angle) * distanceX,
            centerY + Math.sin(angle) * distanceY,
            Phaser.Math.Between(6, 10),
            Phaser.Math.Between(15, 23),
            i % 2 ? 0x61cfff : 0xd7faff,
            0.98
          ).setAngle(Phaser.Math.Between(-28, 28)).setDepth(depth + 4);
          crystal.setScale(0.2);
          crystals.push(crystal);
          this.tweens.add({
            targets: crystal,
            scale: 1,
            duration: 420,
            delay: i * 26,
            ease: 'Back.easeOut'
          });
        }

        // O inimigo permanece congelado por tempo suficiente para a leitura do efeito.
        this.tweens.add({
          targets: sprite,
          scaleX: enemy.baseScaleX * 1.04,
          scaleY: enemy.baseScaleY * 1.04,
          duration: 520,
          yoyo: true,
          ease: 'Sine.easeInOut'
        });

        this.time.delayedCall(850, () => {
          iceShell.destroy();
          // A quebra espalha os pedaços para fora, em vez de simplesmente apagar o sprite.
          crystals.forEach((crystal, i) => {
            const angle = (Math.PI * 2 * i) / crystals.length;
            this.tweens.add({
              targets: crystal,
              x: crystal.x + Math.cos(angle) * 58,
              y: crystal.y + Math.sin(angle) * 46,
              angle: crystal.angle + (i % 2 ? 150 : -150),
              scale: 0.25,
              alpha: 0,
              duration: 760,
              ease: 'Cubic.easeOut',
              onComplete: () => crystal.destroy()
            });
          });
          burst([0xf0fdff, 0xa7edff, 0x64cfff, 0xffffff], 30, 62, 3, 8, 900);
          const crackFlash = this.add.circle(centerX, centerY, 16, 0xffffff, 0.8)
            .setDepth(depth + 6);
          this.tweens.add({
            targets: crackFlash,
            scale: 2.5,
            alpha: 0,
            duration: 240,
            onComplete: () => crackFlash.destroy()
          });
          this.tweens.add({
            targets: [sprite, shadow],
            alpha: 0,
            scaleX: 0.06,
            scaleY: 0.06,
            duration: 540,
            ease: 'Quad.easeIn',
            onComplete: () => { sprite.destroy(); shadow.destroy(); }
          });
        });

      } else {
        // ÁGUA: impacto de bolhas seguido de dissolução mais lenta.
        sprite.setTint(0x65cfff);
        makeGlow(0x4bcfff, 0.28);
        makeRing(0x8deeff, 16, 3, 900);
        burst([0x8deeff, 0x4bcfff, 0xe4fbff], 24, 50, 3, 8, 900, true);
        this.tweens.add({
          targets: sprite,
          y: sprite.y + 8,
          scaleX: enemy.baseScaleX * 0.82,
          scaleY: enemy.baseScaleY * 0.82,
          alpha: 0,
          duration: 1550,
          ease: 'Sine.easeIn',
          onComplete: () => { sprite.destroy(); shadow.destroy(); }
        });
      }

      // Pequena onda no ponto de contato, separada da animação principal.
      this.createElementImpact(element, hitX, hitY);
    };

    scene.updateProjectiles = function (delta) {
      const seconds=Math.min(delta,50)/1000;
      for(let i=this.projectiles.length-1;i>=0;i--){
        const shot=this.projectiles[i];
        if(!shot.sprite.active){this.projectiles.splice(i,1);continue;}
        if(!shot.target||!shot.target.alive)shot.target=this.getNearestEnemy(shot.sprite.x,shot.sprite.y);
        if(!shot.target){shot.sprite.destroy();this.projectiles.splice(i,1);continue;}

        const dx=shot.target.sprite.x-shot.sprite.x;
        const dy=shot.target.sprite.y-shot.sprite.y;
        const distance=Math.hypot(dx,dy);
        const travel=shot.speed*seconds;
        const collisionDistance=shot.target.hitRadius+shot.hitRadius;

        // Colisão contínua: o alcance percorrido no quadro entra na verificação.
        if(distance<=collisionDistance+travel){
          const hitX=shot.target.sprite.x, hitY=shot.target.sprite.y;
          shot.sprite.destroy();this.projectiles.splice(i,1);
          this.applyEnemyDeath(shot.target,shot.element,hitX,hitY);
          continue;
        }

        const vx=dx/distance,vy=dy/distance;
        shot.sprite.x+=vx*travel;shot.sprite.y+=vy*travel;
        shot.sprite.setRotation(Math.atan2(vy,vx));
      }
    };

    // Phaser 3.80 captura scene.update ao terminar a criação da cena.
    // Por isso, um módulo carregado depois precisa assinar POST_UPDATE em vez
    // de substituir scene.update: o evento roda logo após o update original.
    scene.sys.events.on(Phaser.Scenes.Events.POST_UPDATE, function (time, delta) {
      if (this.selectedElement) this.updateProjectiles(delta);
    }, scene);

    // Se a pessoa já escolheu antes do módulo instalar, reinicia o ciclo com mira.
    if(scene.spellTimer){scene.spellTimer.remove(false);scene.spellTimer=null;}
    if(scene.selectedElement)scene.startElementCasting();

    console.info("Arcane Survival: mira automática, colisão e mortes elementais ativadas.");
  }

  installCombat();
})();
