/**
 * 王国征伐 · 中世纪史诗战场音效引擎 (Web Audio API Synthesizer)
 */
const SoundFx = (() => {
  let ctx = null;
  let enabled = true;

  function getContext() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        ctx = new AudioCtx();
      }
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
    return ctx;
  }

  return {
    toggle() {
      enabled = !enabled;
      return enabled;
    },
    isEnabled() {
      return enabled;
    },

    // 棋子落子声 (厚重坚固的实木/雕石沙盘撞击声)
    playMove() {
      if (!enabled) return;
      const ac = getContext();
      if (!ac) return;

      const osc = ac.createOscillator();
      const gain = ac.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(55, ac.currentTime + 0.1);

      gain.gain.setValueAtTime(0.4, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(ac.destination);

      osc.start();
      osc.stop(ac.currentTime + 0.1);
    },

    // 斩杀/吃子声 (金属利剑劈砍与重盾撞击碰撞)
    playCapture() {
      if (!enabled) return;
      const ac = getContext();
      if (!ac) return;

      // 利刃交锋高频
      const bladeOsc = ac.createOscillator();
      const bladeGain = ac.createGain();
      bladeOsc.type = 'sawtooth';
      bladeOsc.frequency.setValueAtTime(450, ac.currentTime);
      bladeOsc.frequency.exponentialRampToValueAtTime(90, ac.currentTime + 0.22);
      bladeGain.gain.setValueAtTime(0.45, ac.currentTime);
      bladeGain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.22);
      bladeOsc.connect(bladeGain);
      bladeGain.connect(ac.destination);
      bladeOsc.start();
      bladeOsc.stop(ac.currentTime + 0.22);

      // 护甲钝器碰撞低频
      const armorOsc = ac.createOscillator();
      const armorGain = ac.createGain();
      armorOsc.type = 'square';
      armorOsc.frequency.setValueAtTime(110, ac.currentTime);
      armorOsc.frequency.exponentialRampToValueAtTime(35, ac.currentTime + 0.18);
      armorGain.gain.setValueAtTime(0.35, ac.currentTime);
      armorGain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.18);
      armorOsc.connect(armorGain);
      armorGain.connect(ac.destination);
      armorOsc.start();
      armorOsc.stop(ac.currentTime + 0.18);
    },

    // 将军号角警报 (中世纪皇家进军号角 War Horn)
    playCheck() {
      if (!enabled) return;
      const ac = getContext();
      if (!ac) return;

      const hornFreqs = [220, 277.18, 329.63]; // A大调和弦号角
      hornFreqs.forEach((freq, idx) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, ac.currentTime + idx * 0.06);
        gain.gain.setValueAtTime(0.25, ac.currentTime + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + idx * 0.06 + 0.5);

        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(ac.currentTime + idx * 0.06);
        osc.stop(ac.currentTime + idx * 0.06 + 0.5);
      });
    },

    // 兵升变 (王室加冕受封圣音)
    playPromotion() {
      if (!enabled) return;
      const ac = getContext();
      if (!ac) return;

      const notes = [261.63, 329.63, 392.00, 523.25, 659.25];
      notes.forEach((freq, idx) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ac.currentTime + idx * 0.07);
        gain.gain.setValueAtTime(0.3, ac.currentTime + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + idx * 0.07 + 0.4);

        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(ac.currentTime + idx * 0.07);
        osc.stop(ac.currentTime + idx * 0.07 + 0.4);
      });
    },

    // 胜利凯旋凯歌 (Royal Fanfare)
    playVictory() {
      if (!enabled) return;
      const ac = getContext();
      if (!ac) return;

      const fanfare = [
        { f: 261.63, t: 0, d: 0.2 },
        { f: 329.63, t: 0.18, d: 0.2 },
        { f: 392.00, t: 0.36, d: 0.2 },
        { f: 523.25, t: 0.54, d: 0.6 }
      ];

      fanfare.forEach(item => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(item.f, ac.currentTime + item.t);
        gain.gain.setValueAtTime(0.28, ac.currentTime + item.t);
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + item.t + item.d);

        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(ac.currentTime + item.t);
        osc.stop(ac.currentTime + item.t + item.d);
      });
    },

    setEnabled(val) {
      enabled = !!val;
      return enabled;
    },

    // 战术UI点击
    playClick() {
      if (!enabled) return;
      const ac = getContext();
      if (!ac) return;

      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(160, ac.currentTime + 0.04);
      gain.gain.setValueAtTime(0.18, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + 0.04);
    }
  };
})();

// 监听主站平台的全局静音广播
window.addEventListener("message", (e) => {
  if (e.data && e.data.type === "MUTE_CHANGE" && typeof SoundFx !== "undefined") {
    SoundFx.setEnabled(!e.data.isMuted);
  }
});
