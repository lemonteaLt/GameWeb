/**
 * 王国征伐 · 战场余烬与金辉粒子特效 (Medieval Battlefield Ambient Sparks)
 */
const ParticleSystem = (() => {
  let canvas, ctx;
  let particles = [];
  let width, height;
  const PARTICLE_COUNT = 40;

  class SparkParticle {
    constructor() {
      this.reset(true);
    }

    reset(initial = false) {
      this.x = Math.random() * width;
      this.y = initial ? Math.random() * height : height + 10;
      this.size = Math.random() * 2.2 + 0.8;
      this.speedY = -(Math.random() * 0.45 + 0.15);
      this.speedX = (Math.random() - 0.5) * 0.35;
      this.opacity = Math.random() * 0.65 + 0.25;
      this.fadeSpeed = Math.random() * 0.003 + 0.001;
      // 战火余烬色系：0 = 灿金, 1 = 琥珀橙, 2 = 圣蓝微芒, 3 = 铁血微红
      const types = ['255, 215, 0', '255, 140, 0', '100, 181, 246', '239, 83, 80'];
      this.color = types[Math.floor(Math.random() * types.length)];
    }

    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      this.opacity -= this.fadeSpeed;

      if (this.y < -10 || this.opacity <= 0) {
        this.reset();
      }
    }

    draw() {
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.color}, ${Math.max(0, this.opacity)})`;
      ctx.shadowBlur = 6;
      ctx.shadowColor = `rgba(${this.color}, 0.8)`;
      ctx.fill();
      ctx.restore();
    }
  }

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  function init() {
    canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);

    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(new SparkParticle());
    }

    loop();
  }

  function loop() {
    ctx.clearRect(0, 0, width, height);
    for (let p of particles) {
      p.update();
      p.draw();
    }
    requestAnimationFrame(loop);
  }

  return { init };
})();
