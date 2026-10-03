/**
 * 全局音频与静音总线控制器 (Global Audio & Master Mute Bus)
 */
class AudioManager {
  constructor() {
    const settings = StorageManager.getSettings();
    this.isMuted = settings.isMuted;
    this.audioCtx = null;
  }

  initAudioContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    const settings = StorageManager.getSettings();
    settings.isMuted = this.isMuted;
    StorageManager.setSettings(settings);

    // 向当前打开的游戏 iframe 广播静音状态
    this.broadcastMuteState();
    return this.isMuted;
  }

  broadcastMuteState() {
    const iframe = document.getElementById("gameIframe");
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: "MUTE_CHANGE", isMuted: this.isMuted }, "*");
    }
  }

  // 播放轻量合成 UI 交互音效 (使用 Web Audio API，零外部素材依赖)
  playTone(freq = 440, type = "sine", duration = 0.08) {
    if (this.isMuted) return;
    try {
      this.initAudioContext();
      if (!this.audioCtx) return;
      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {
      // Audio context might be restricted before first click
    }
  }

  // 预设音效
  playClick() { this.playTone(600, "sine", 0.05); }
  playStar() {
    this.playTone(880, "triangle", 0.1);
    setTimeout(() => this.playTone(1320, "triangle", 0.15), 60);
  }
  playPodium() {
    this.playTone(523.25, "sine", 0.08);
    setTimeout(() => this.playTone(659.25, "sine", 0.08), 80);
    setTimeout(() => this.playTone(783.99, "sine", 0.15), 160);
  }
}

const SoundSystem = new AudioManager();
