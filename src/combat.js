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

    scene.applyEnemyDeath = function (enemy, element, x, y) {
      if (!enemy || !enemy.alive) return;
      enemy.alive = false;
      const index = this.enemies.indexOf(enemy);
      if (index >= 0) this.enemies.splice(index,1);
      this.tweens.killTweensOf(enemy.sprite);
      enemy.sprite.setScale(enemy.baseScaleX,enemy.baseScaleY);
      this.updateEnemyCounter();

      const sprite=enemy.sprite, shadow=enemy.shadow;
      const flash=this.add.circle(x,y-5,22,0xffffff,.14).setDepth(15);
      this.tweens.add({targets:flash,scale:1.8,alpha:0,duration:420,onComplete:()=>flash.destroy()});

      if (element === "fire") {
        sprite.setTint(0xff782e);
        this.deathParticles(x,y,[0xffd166,0xff8a32,0xe34b22],16,true);
        this.time.delayedCall(480,()=>{
          this.deathParticles(x,y,[0x302c29,0x615346,0x17191a],16);
          this.tweens.add({targets:[sprite,shadow],alpha:0,scale:.1,duration:900,onComplete:()=>{sprite.destroy();shadow.destroy();}});
        });
      } else if (element === "lightning") {
        sprite.setTint(0xe9d8ff);
        this.deathParticles(x,y,[0xd8b5ff,0x914dff,0xf2eaff],18,true);
        this.tweens.add({targets:sprite,alpha:.2,duration:100,yoyo:true,repeat:4,onComplete:()=>{
          sprite.setTint(0x77717f);
          this.deathParticles(x,y,[0x8c7d9b,0x4a4650,0xbba5d6],18);
          this.tweens.add({targets:[sprite,shadow],alpha:0,scale:.1,duration:740,onComplete:()=>{sprite.destroy();shadow.destroy();}});
        }});
      } else if (element === "earth") {
        this.deathParticles(x,y+4,[0xb58a58,0x765332,0xd0a66c],18);
        this.tweens.add({targets:sprite,y:sprite.y+11,angle:enemy.type==="wolf"?82:90,scaleY:enemy.baseScaleY*.55,duration:480,ease:"Back.easeIn"});
        this.time.delayedCall(520,()=>{
          this.deathParticles(x,y+12,[0x6f5538,0x9b7448,0x433729],20);
          this.tweens.add({targets:[sprite,shadow],alpha:0,scale:.1,duration:760,onComplete:()=>{sprite.destroy();shadow.destroy();}});
        });
      } else if (element === "ice") {
        sprite.setTint(0x83ddff);
        const crystals=[];
        for(let i=0;i<8;i++){
          const a=Math.PI*2*i/8;
          crystals.push(this.add.rectangle(x+Math.cos(a)*17,y+Math.sin(a)*12,7,13,i%2?0x56bfff:0xa8efff,.95).setAngle(45).setDepth(16));
        }
        this.tweens.add({targets:sprite,scale:1.12,duration:520,yoyo:true});
        this.time.delayedCall(650,()=>{
          crystals.forEach((c,i)=>{
            const a=Math.PI*2*i/crystals.length;
            this.tweens.add({targets:c,x:c.x+Math.cos(a)*34,y:c.y+Math.sin(a)*30,alpha:0,angle:c.angle+90,scale:.3,duration:620,onComplete:()=>c.destroy()});
          });
          this.deathParticles(x,y,[0xc4f6ff,0x71d9ff,0xffffff],18);
          this.tweens.add({targets:[sprite,shadow],alpha:0,scale:.12,duration:720,onComplete:()=>{sprite.destroy();shadow.destroy();}});
        });
      } else {
        sprite.setTint(0x65cfff);
        this.deathParticles(x,y,[0x8deeff,0x4bcfff,0xe4fbff],16,true);
        this.tweens.add({targets:[sprite,shadow],y:"+=8",alpha:0,scale:.15,duration:1500,onComplete:()=>{sprite.destroy();shadow.destroy();}});
      }

      const colors={fire:0xff8a3d,ice:0x8deeff,water:0x4bcfff,earth:0xb58a58,lightning:0xc49aff};
      const color=colors[element]||0xffffff;
      const ring=this.add.circle(x,y,8,color,.08).setStrokeStyle(2,color,.9).setDepth(17);
      this.tweens.add({targets:ring,scale:2.2,alpha:0,duration:320,onComplete:()=>ring.destroy()});
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
