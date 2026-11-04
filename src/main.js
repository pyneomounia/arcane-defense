(() => {
  const W = 960, H = 540;
  const ui = {
    wave: document.getElementById('wave'),
    mana: document.getElementById('mana'),
    core: document.getElementById('core'),
    message: document.getElementById('message')
  };

  class Arena extends Phaser.Scene {
    constructor() {
      super('Arena');
      this.enemies = [];
      this.wave = 1;
      this.mana = 100;
      this.core = 100;
      this.gesture = [];
      this.drawing = false;
      this.spawned = 0;
      this.kills = 0;
    }

    create() {
      this.cameras.main.setBackgroundColor('#101827');
      this.drawArena();
      this.createCrystal();
      this.input.on('pointerdown', p => { this.drawing = true; this.gesture = [{x:p.x,y:p.y}]; });
      this.input.on('pointermove', p => {
        if (!this.drawing || !p.isDown) return;
        this.gesture.push({x:p.x,y:p.y});
        this.drawGesture();
      });
      this.input.on('pointerup', () => {
        if (!this.drawing) return;
        this.drawing = false;
        this.castGesture();
      });
      this.spawnEvent = this.time.addEvent({ delay: 1500, callback: this.spawnEnemy, callbackScope: this, loop: true });
      this.time.addEvent({ delay: 1000, callback: () => {
        this.mana = Math.min(100, this.mana + 3);
        this.updateUI();
      }, loop: true });
      this.updateUI();
      this.show('Defenda o cristal! Desenhe uma linha, zigue-zague ou círculo.');
    }

    drawArena() {
      const g = this.add.graphics();
      g.fillGradientStyle(0x17243a,0x17243a,0x101827,0x101827,1);
      g.fillRect(0,0,W,H);
      g.lineStyle(1,0x34435c,0.35);
      for(let x=0;x<W;x+=48) g.lineBetween(x,0,x,H);
      for(let y=0;y<H;y+=48) g.lineBetween(0,y,W,y);
      g.lineStyle(2,0x53627d,0.22);
      g.strokeCircle(W/2,H/2,155);
      g.strokeCircle(W/2,H/2,215);
      this.add.text(18,16,'CAMPO DE DEFESA',{fontSize:'11px',color:'#8292b2',letterSpacing:3});
    }

    createCrystal() {
      this.add.circle(W/2,H/2,31,0x8c67ff,0.12);
      this.add.polygon(W/2,H/2,[0,-28,20,-4,12,25,-12,25,-20,-4],0x9b7aff)
        .setStrokeStyle(2,0xe3d8ff);
      this.add.circle(W/2,H/2,5,0xffffff,0.9);
      this.add.text(W/2,H/2+43,'CRISTAL',{fontSize:'10px',color:'#c8baff',letterSpacing:2}).setOrigin(.5);
    }

    spawnEnemy() {
      if (this.core <= 0 || this.spawned >= 5 + this.wave * 3) return;
      const side = Phaser.Math.Between(0,3);
      const x = side===0 ? -20 : side===1 ? W+20 : Phaser.Math.Between(30,W-30);
      const y = side===2 ? -20 : side===3 ? H+20 : Phaser.Math.Between(55,H-55);
      const size = Phaser.Math.Between(12,17);
      const body = this.add.circle(x,y,size,0xc75b70).setStrokeStyle(2,0xffa0a9);
      const eye = this.add.circle(x-4,y-3,2,0xffffff);
      this.enemies.push({ body, eye, hp: 2 + Math.floor(this.wave/3), speed: 22 + this.wave*2, size });
      this.spawned++;
      this.updateUI();
      if (this.spawned >= 5 + this.wave * 3) this.spawnEvent.paused = true;
    }

    drawGesture() {
      if (this.gesture.length < 2) return;
      if (this.gestureGraphics) this.gestureGraphics.destroy();
      this.gestureGraphics = this.add.graphics();
      this.gestureGraphics.lineStyle(5,0xcbbaff,0.85);
      this.gestureGraphics.beginPath();
      this.gestureGraphics.moveTo(this.gesture[0].x,this.gesture[0].y);
      for(const p of this.gesture.slice(1)) this.gestureGraphics.lineTo(p.x,p.y);
      this.gestureGraphics.strokePath();
    }

    castGesture() {
      if (this.gestureGraphics) { this.gestureGraphics.destroy(); this.gestureGraphics = null; }
      const pts = this.gesture;
      if (pts.length < 5) { this.show('Gesto muito curto. Tente desenhar uma forma maior.'); return; }
      const first = pts[0], last = pts[pts.length-1];
      const dx = last.x-first.x, dy = last.y-first.y;
      const distance = Math.hypot(dx,dy);
      const pathLength = pts.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-pts[i].x,p.y-pts[i].y),0);
      const straightness = distance / Math.max(pathLength,1);
      const closed = Phaser.Math.Distance.Between(first.x,first.y,last.x,last.y) < 65 && pathLength > 120;
      const turns = pts.slice(2).filter((p,i)=> {
        const a=pts[i], b=pts[i+1];
        return ((p.x-b.x)*(b.y-a.y)-(p.y-b.y)*(b.x-a.x)) > 0;
      }).length;

      if (closed) this.castHeal();
      else if (straightness > 0.72 && Math.abs(dx) > Math.abs(dy)*1.3) this.castFireball();
      else if (pathLength > 100 && turns > 3) this.castLightning();
      else this.show('Não reconheci esse símbolo. Tente linha horizontal, zigue-zague ou círculo.');
      this.gesture = [];
    }

    spend(amount) {
      if (this.mana < amount) { this.show('Mana insuficiente! Aguarde a regeneração.'); return false; }
      this.mana -= amount; this.updateUI(); return true;
    }

    nearestEnemy() {
      return this.enemies.filter(e=>e.body.active).sort((a,b)=>
        Phaser.Math.Distance.Between(a.body.x,a.body.y,W/2,H/2)-Phaser.Math.Distance.Between(b.body.x,b.body.y,W/2,H/2)
      )[0];
    }

    castFireball() {
      if (!this.spend(18)) return;
      const target = this.nearestEnemy();
      if (!target) { this.show('Bola de fogo conjurada, mas não há inimigos no campo.'); return; }
      const bolt = this.add.circle(W/2,H/2,9,0xff914d).setStrokeStyle(2,0xffd19a);
      this.tweens.add({targets:bolt,x:target.body.x,y:target.body.y,duration:260,onComplete:()=>{
        bolt.destroy();
        this.damageArea(target.body.x,target.body.y,75,2,0xff914d);
      }});
      this.show('BOLA DE FOGO! Dano em área.');
    }

    castLightning() {
      if (!this.spend(25)) return;
      const targets = this.enemies.filter(e=>e.body.active).slice(0,3);
      if (!targets.length) { this.show('Relâmpago conjurado, mas não há inimigos.'); return; }
      targets.forEach(e=>{
        const bolt=this.add.graphics();
        bolt.lineStyle(4,0x68dcff,1);
        let x=W/2,y=H/2; bolt.beginPath(); bolt.moveTo(x,y);
        const steps=7;
        for(let s=1;s<steps;s++){ x=Phaser.Math.Linear(W/2,e.body.x,s/steps)+Phaser.Math.Between(-18,18); y=Phaser.Math.Linear(H/2,e.body.y,s/steps)+Phaser.Math.Between(-18,18); bolt.lineTo(x,y); }
        bolt.lineTo(e.body.x,e.body.y); bolt.strokePath();
        this.time.delayedCall(180,()=>bolt.destroy());
        this.damageArea(e.body.x,e.body.y,28,2,0x68dcff);
      });
      this.show('RELÂMPAGO! A energia atinge até três inimigos.');
    }

    castHeal() {
      if (!this.spend(30)) return;
      this.core=Math.min(100,this.core+22);
      const ring=this.add.circle(W/2,H/2,38,0x76e5a3,0.18).setStrokeStyle(4,0x76e5a3);
      this.tweens.add({targets:ring,scale:2,alpha:0,duration:500,onComplete:()=>ring.destroy()});
      this.updateUI(); this.show('CÍRCULO DE CURA! Cristal recuperou até 22%.');
    }

    damageArea(x,y,radius,damage,color) {
      const fx=this.add.circle(x,y,radius,color,0.18).setStrokeStyle(2,color);
      this.tweens.add({targets:fx,alpha:0,scale:1.5,duration:240,onComplete:()=>fx.destroy()});
      this.enemies.slice().forEach(e=>{
        if(e.body.active && Phaser.Math.Distance.Between(x,y,e.body.x,e.body.y)<radius+e.size){
          e.hp-=damage;
          if(e.hp<=0) this.killEnemy(e);
          else e.body.setFillStyle(0xe99aa7);
        }
      });
    }

    killEnemy(e) {
      e.body.destroy(); e.eye.destroy(); this.kills++;
      this.mana=Math.min(100,this.mana+5); this.updateUI();
      this.checkNextWave();
    }

    checkNextWave() {
      if(this.spawned>=5+this.wave*3 && this.enemies.every(e=>!e.body.active)) this.nextWave();
    }

    nextWave() {
      if(this.core<=0) return;
      this.wave++; this.spawned=0; this.spawnEvent.paused=false;
      this.show('Onda '+this.wave+'! Os inimigos estão ficando mais fortes.');
      this.updateUI();
    }

    show(msg) { ui.message.textContent=msg; }

    updateUI() {
      ui.wave.textContent=this.wave;
      ui.mana.textContent=Math.floor(this.mana);
      ui.core.textContent=Math.floor(this.core);
    }

    update(_, delta) {
      if(this.core<=0) return;
      const dt=delta/1000;
      this.enemies.forEach(e=>{
        if(!e.body.active) return;
        const angle=Phaser.Math.Angle.Between(e.body.x,e.body.y,W/2,H/2);
        e.body.x+=Math.cos(angle)*e.speed*dt;
        e.body.y+=Math.sin(angle)*e.speed*dt;
        e.eye.setPosition(e.body.x-4,e.body.y-3);
        if(Phaser.Math.Distance.Between(e.body.x,e.body.y,W/2,H/2)<42){
          e.body.destroy(); e.eye.destroy(); this.core=Math.max(0,this.core-8); this.updateUI();
          if(this.core<=0) this.show('O CRISTAL FOI DESTRUÍDO. Atualize a página para tentar novamente.');
        }
      });
      this.checkNextWave();
    }
  }

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-container',
    width: W, height: H,
    backgroundColor: '#101827',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [Arena],
    input: { activePointers: 3 }
  });
})();