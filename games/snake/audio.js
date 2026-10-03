/**
 * 8-Bit Web Audio API Sound Synthesizer
 */
class PixelAudio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }

    // 吃苹果音效 (高音清脆两段音)
    playEat() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(880, now + 0.06);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.15);
    }

    // 碰撞死亡音效 (杂音+低频下落音)
    playDie() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;

        // 基础下落波
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.4);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.4);

        // 白噪音爆炸质感
        this.playNoise(now, 0.25, 0.15);
    }

    playNoise(startTime, duration, volume) {
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, startTime);
        filter.frequency.linearRampToValueAtTime(100, startTime + duration);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(volume, startTime);
        gain.gain.linearRampToValueAtTime(0.001, startTime + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        noise.start(startTime);
        noise.stop(startTime + duration);
    }

    // 按键选择音效
    playClick() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.setValueAtTime(740, now + 0.03);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.07);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.07);
    }

    // 游戏开始开场音
    playStart() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const notes = [330, 392, 523, 659];
        notes.forEach((freq, idx) => {
            const now = this.ctx.currentTime + idx * 0.07;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now);

            gain.gain.setValueAtTime(0.12, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.06);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.06);
        });
    }

    // 刷新最高分音效
    playHighScore() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const notes = [440, 554, 659, 880];
        notes.forEach((freq, idx) => {
            const now = this.ctx.currentTime + idx * 0.09;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, now);

            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.15);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.15);
        });
    }
}

window.pixelAudio = new PixelAudio();

// 监听主站平台的静音广播
window.addEventListener("message", (e) => {
    if (e.data && e.data.type === "MUTE_CHANGE" && window.pixelAudio) {
        window.pixelAudio.enabled = !e.data.isMuted;
    }
});
