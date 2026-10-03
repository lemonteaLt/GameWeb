/**
 * 新中式极简 · 象棋音效引擎 (Web Audio API 合成音效)
 * 无需任何外部音频文件下载，纯净零延迟，保真度高
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.initialized = false;
  }

  // 延迟初始化 AudioContext，避免部分浏览器自动播放限制
  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.initialized = true;
      }
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  }

  ensureContext() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggle(enabled) {
    this.enabled = enabled !== undefined ? enabled : !this.enabled;
    return this.enabled;
  }

  /**
   * 落子音效 (清脆玉石/陶瓷轻击 "笃")
   */
  playMove() {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    
    // 主冲击振荡器
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.08);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    // 陶瓷高频共鸣
    const oscHigh = this.ctx.createOscillator();
    const gainHigh = this.ctx.createGain();
    oscHigh.type = 'sine';
    oscHigh.frequency.setValueAtTime(1450, now);
    oscHigh.frequency.exponentialRampToValueAtTime(400, now + 0.05);

    gainHigh.gain.setValueAtTime(0.12, now);
    gainHigh.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    oscHigh.connect(gainHigh);
    gainHigh.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
    oscHigh.start(now);
    oscHigh.stop(now + 0.06);
  }

  /**
   * 吃子音效 (清脆厚重的木石碰撞 "啪")
   */
  playCapture() {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // 低频重击
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(280, now);
    osc1.frequency.exponentialRampToValueAtTime(60, now + 0.14);
    gain1.gain.setValueAtTime(0.5, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    // 中高频碰撞爆裂感 (噪声模拟)
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880, now);
    osc2.frequency.exponentialRampToValueAtTime(180, now + 0.1);
    gain2.gain.setValueAtTime(0.25, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.16);
    osc2.start(now);
    osc2.stop(now + 0.12);
  }

  /**
   * 将军音效 (威严清亮双音警示)
   */
  playCheck() {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    [587.33, 880].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = now + idx * 0.08;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.9, startTime + 0.25);

      gain.gain.setValueAtTime(0.28, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.36);
    });
  }

  /**
   * 绝杀胜利音效 (三音和弦)
   */
  playWin() {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

    chord.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = now + idx * 0.09;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.25, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.65);
    });
  }

  /**
   * 按钮与交互轻触音
   */
  playClick() {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.03);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * 非法移动/不可行操作提示音
   */
  playIllegal() {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.setValueAtTime(110, now + 0.06);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.14);
  }
}

// 挂载全局单例
window.soundEngine = new SoundEngine();

// 监听主站平台的全局静音广播
window.addEventListener("message", (e) => {
  if (e.data && e.data.type === "MUTE_CHANGE" && window.soundEngine) {
    window.soundEngine.enabled = !e.data.isMuted;
  }
});
