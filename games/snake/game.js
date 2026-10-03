/**
 * 像素贪吃蛇核心逻辑
 */

// 难度配置 (毫秒/步 及 计分倍率)
const DIFFICULTIES = {
    easy: { name: '简单', speedMs: 160, scorePerApple: 10, cssClass: 'diff-easy' },
    medium: { name: '普通', speedMs: 110, scorePerApple: 20, cssClass: 'diff-medium' },
    hard: { name: '困难', speedMs: 75, scorePerApple: 35, cssClass: 'diff-hard' },
    hell: { name: '地狱', speedMs: 45, scorePerApple: 50, cssClass: 'diff-hell' }
};

// 方向常量
const DIRECTION = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 }
};

class SnakeGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;

        // 栅格设置 (20x20 经典网格，每个格子 20 像素)
        this.gridSize = 20;
        this.tileCount = this.canvas.width / this.gridSize; // 20

        // 游戏状态
        this.gameState = 'START'; // 'START' | 'PLAYING' | 'PAUSED' | 'GAMEOVER'
        this.currentDifficulty = 'medium';
        this.score = 0;
        this.applesEaten = 0;
        this.highScore = this.loadHighScore();

        // 蛇与食物
        this.snake = [];
        this.direction = DIRECTION.RIGHT;
        this.inputQueue = []; // 输入缓冲，防止高速连按自杀
        this.food = { x: 15, y: 10 };

        // 动画与粒子
        this.particles = [];
        this.screenShake = 0;
        this.lastRenderTime = 0;
        this.timeSinceLastMove = 0;
        this.foodAnimationTimer = 0;

        // UI 元素缓存
        this.dom = {
            currentScore: document.getElementById('current-score'),
            highScore: document.getElementById('high-score'),
            diffTag: document.getElementById('current-difficulty-tag'),
            startOverlay: document.getElementById('start-overlay'),
            gameoverOverlay: document.getElementById('gameover-overlay'),
            pauseOverlay: document.getElementById('pause-overlay'),
            finalScore: document.getElementById('final-score'),
            finalApples: document.getElementById('final-apples'),
            gameoverReason: document.getElementById('gameover-reason'),
            newRecordTag: document.getElementById('new-record-tag'),
            btnStart: document.getElementById('btn-start-game'),
            btnRestart: document.getElementById('btn-restart'),
            btnChangeDiff: document.getElementById('btn-change-diff'),
            btnSoundToggle: document.getElementById('btn-sound-toggle'),
            soundIcon: document.getElementById('sound-icon'),
            btnCrtToggle: document.getElementById('btn-crt-toggle'),
            crtOverlay: document.querySelector('.crt-overlay'),
            diffButtons: document.querySelectorAll('.diff-btn'),
            touchPauseBtn: document.getElementById('touch-pause-btn')
        };

        this.initEventListeners();
        this.updateHUD();
        this.resetGameData();

        // 启动主渲染循环
        requestAnimationFrame(this.gameLoop.bind(this));
    }

    // 初始化最高分
    loadHighScore() {
        const stored = localStorage.getItem('pixel_snake_highscore_' + this.currentDifficulty);
        return stored ? parseInt(stored, 10) : 0;
    }

    saveHighScore() {
        localStorage.setItem('pixel_snake_highscore_' + this.currentDifficulty, this.highScore);
    }

    // 重置游戏数据
    resetGameData() {
        // 蛇初始 3 节方块，居中偏左
        this.snake = [
            { x: 8, y: 10 },
            { x: 7, y: 10 },
            { x: 6, y: 10 }
        ];
        this.direction = DIRECTION.RIGHT;
        this.inputQueue = [];
        this.score = 0;
        this.applesEaten = 0;
        this.particles = [];
        this.screenShake = 0;
        this.highScore = this.loadHighScore();
        this.spawnFood();
        this.updateHUD();
    }

    // 生成苹果方块 (避开蛇身)
    spawnFood() {
        let validPosition = false;
        let newX, newY;

        while (!validPosition) {
            newX = Math.floor(Math.random() * this.tileCount);
            newY = Math.floor(Math.random() * this.tileCount);

            validPosition = !this.snake.some(segment => segment.x === newX && segment.y === newY);
        }

        this.food = { x: newX, y: newY };
    }

    // 开始游戏
    startGame() {
        this.resetGameData();
        this.gameState = 'PLAYING';
        this.dom.startOverlay.classList.remove('active');
        this.dom.gameoverOverlay.classList.remove('active');
        this.dom.pauseOverlay.classList.remove('active');
        this.timeSinceLastMove = 0;
        window.pixelAudio.playStart();
    }

    // 暂停/继续切换
    togglePause() {
        if (this.gameState === 'PLAYING') {
            this.gameState = 'PAUSED';
            this.dom.pauseOverlay.classList.add('active');
            window.pixelAudio.playClick();
        } else if (this.gameState === 'PAUSED') {
            this.gameState = 'PLAYING';
            this.dom.pauseOverlay.classList.remove('active');
            window.pixelAudio.playClick();
        }
    }

    // 游戏结束
    gameOver(reason) {
        this.gameState = 'GAMEOVER';
        this.screenShake = 15;
        window.pixelAudio.playDie();

        // 死亡像素爆炸效果
        this.createDeathExplosion(this.snake[0].x * this.gridSize, this.snake[0].y * this.gridSize);

        // 纪录检查
        let isNewRecord = false;
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.saveHighScore();
            isNewRecord = true;
            setTimeout(() => window.pixelAudio.playHighScore(), 400);
        }

        // 显示结算弹窗
        setTimeout(() => {
            this.dom.finalScore.textContent = this.formatScore(this.score);
            this.dom.finalApples.textContent = this.applesEaten;
            this.dom.gameoverReason.textContent = reason;
            
            if (isNewRecord && this.score > 0) {
                this.dom.newRecordTag.classList.remove('hidden');
            } else {
                this.dom.newRecordTag.classList.add('hidden');
            }

            // 向主网站平台同步最高战绩
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({ type: "GAME_SCORE", score: this.score }, "*");
            }

            this.dom.gameoverOverlay.classList.add('active');
            this.updateHUD();
        }, 300);
    }

    // 转向输入处理 (加入队列防瞬切自杀)
    handleDirectionInput(newDir) {
        if (this.gameState !== 'PLAYING') return;

        // 获取队列中最后一个方向或当前方向进行反向判断
        const lastPlannedDir = this.inputQueue.length > 0 
            ? this.inputQueue[this.inputQueue.length - 1] 
            : this.direction;

        // 不能反向掉头
        if (newDir.x !== -lastPlannedDir.x || newDir.y !== -lastPlannedDir.y) {
            if (this.inputQueue.length < 3) {
                this.inputQueue.push(newDir);
            }
        }
    }

    // 蛇逻辑步进移动
    step() {
        if (this.inputQueue.length > 0) {
            this.direction = this.inputQueue.shift();
        }

        const head = this.snake[0];
        const newHead = {
            x: head.x + this.direction.x,
            y: head.y + this.direction.y
        };

        // 1. 碰到边界检测 (碰壁即死)
        if (newHead.x < 0 || newHead.x >= this.tileCount || newHead.y < 0 || newHead.y >= this.tileCount) {
            this.gameOver('💥 撞击墙壁，小蛇粉身碎骨！');
            return;
        }

        // 2. 咬到自身检测
        for (let i = 0; i < this.snake.length; i++) {
            if (newHead.x === this.snake[i].x && newHead.y === this.snake[i].y) {
                this.gameOver('😵 咬到了自己身体，小蛇阵亡！');
                return;
            }
        }

        // 移动蛇头
        this.snake.unshift(newHead);

        // 3. 吃到苹果检测
        if (newHead.x === this.food.x && newHead.y === this.food.y) {
            this.applesEaten++;
            const diffConfig = DIFFICULTIES[this.currentDifficulty];
            this.score += diffConfig.scorePerApple;
            
            window.pixelAudio.playEat();
            this.createEatParticles(this.food.x * this.gridSize, this.food.y * this.gridSize);
            this.spawnFood();
            this.updateHUD();
        } else {
            // 未吃到食物，移除蛇尾保持长度
            this.snake.pop();
        }
    }

    // 粒子生成：吃苹果飞溅小像素块
    createEatParticles(x, y) {
        const colors = ['#ff4757', '#ff6b81', '#fcd036', '#ffffff'];
        for (let i = 0; i < 10; i++) {
            this.particles.push({
                x: x + this.gridSize / 2,
                y: y + this.gridSize / 2,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                size: Math.random() > 0.5 ? 4 : 2,
                color: colors[Math.floor(Math.random() * colors.length)],
                life: 1.0,
                decay: 0.04 + Math.random() * 0.04
            });
        }
    }

    // 粒子生成：撞死像素爆炸
    createDeathExplosion(x, y) {
        const colors = ['#52f69e', '#2ecc71', '#ff4757', '#ffffff', '#fcd036'];
        for (let i = 0; i < 28; i++) {
            this.particles.push({
                x: x + this.gridSize / 2,
                y: y + this.gridSize / 2,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                size: Math.floor(Math.random() * 4) + 2,
                color: colors[Math.floor(Math.random() * colors.length)],
                life: 1.0,
                decay: 0.02 + Math.random() * 0.03
            });
        }
    }

    // 格式化计分板数字 00120
    formatScore(num) {
        return num.toString().padStart(5, '0');
    }

    updateHUD() {
        this.dom.currentScore.textContent = this.formatScore(this.score);
        this.dom.highScore.textContent = this.formatScore(Math.max(this.score, this.highScore));
        
        const diff = DIFFICULTIES[this.currentDifficulty];
        this.dom.diffTag.textContent = diff.name;
        this.dom.diffTag.className = 'stat-value ' + diff.cssClass;
    }

    // 主循环
    gameLoop(currentTime) {
        if (!this.lastRenderTime) this.lastRenderTime = currentTime;
        const deltaTime = currentTime - this.lastRenderTime;
        this.lastRenderTime = currentTime;

        // 游戏运行时依据难度速度更新
        if (this.gameState === 'PLAYING') {
            this.timeSinceLastMove += deltaTime;
            const stepInterval = DIFFICULTIES[this.currentDifficulty].speedMs;

            if (this.timeSinceLastMove >= stepInterval) {
                this.step();
                this.timeSinceLastMove = 0;
            }
        }

        // 更新苹果动画与粒子
        this.foodAnimationTimer += deltaTime * 0.005;
        this.updateParticles();

        // 渲染画面
        this.render();

        requestAnimationFrame(this.gameLoop.bind(this));
    }

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    // 绘制主渲染逻辑
    render() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        ctx.save();

        // 屏幕震动
        if (this.screenShake > 0) {
            const shakeX = (Math.random() - 0.5) * this.screenShake;
            const shakeY = (Math.random() - 0.5) * this.screenShake;
            ctx.translate(shakeX, shakeY);
            this.screenShake *= 0.85;
            if (this.screenShake < 0.5) this.screenShake = 0;
        }

        // 1. 清空并绘制像素暗黑网格背景
        ctx.fillStyle = '#0d1612';
        ctx.fillRect(0, 0, width, height);

        // 绘制微弱像素网格线
        ctx.strokeStyle = '#13211b';
        ctx.lineWidth = 1;
        for (let x = 0; x <= width; x += this.gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y <= height; y += this.gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // 2. 绘制像素外边框 (强调碰壁危险感)
        ctx.strokeStyle = '#2d4a3e';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, width - 2, height - 2);

        // 3. 绘制苹果小方块 (Pixel Apple)
        this.drawPixelApple(this.food.x, this.food.y);

        // 4. 绘制蛇 (每一节为独立方块)
        this.drawPixelSnake();

        // 5. 绘制粒子
        this.drawParticles();

        ctx.restore();
    }

    // 绘制像素方块苹果
    drawPixelApple(gx, gy) {
        const ctx = this.ctx;
        const size = this.gridSize;
        const x = gx * size;
        const y = gy * size;

        // 苹果核心方块 (留 2px 像素间隙)
        const pad = 3;
        const appleSize = size - pad * 2;

        // 苹果红色主体方块
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(x + pad, y + pad, appleSize, appleSize);

        // 苹果上方高光像素
        ctx.fillStyle = '#ff7675';
        ctx.fillRect(x + pad, y + pad, 4, 4);

        // 苹果底部阴影像素
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(x + pad, y + pad + appleSize - 3, appleSize, 3);
        ctx.fillRect(x + pad + appleSize - 3, y + pad, 3, appleSize);

        // 苹果顶部的绿色小像素叶子
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(x + size / 2 - 2, y + 1, 3, 3);

        // 像素呼吸外边框发光
        const pulse = Math.sin(this.foodAnimationTimer * 4) * 0.5 + 0.5;
        ctx.strokeStyle = `rgba(255, 107, 129, ${0.3 + pulse * 0.4})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + pad - 1, y + pad - 1, appleSize + 2, appleSize + 2);
    }

    // 绘制像素蛇 (每节都是独立方块，具有 8-bit 立体像素感)
    drawPixelSnake() {
        const ctx = this.ctx;
        const size = this.gridSize;

        this.snake.forEach((seg, index) => {
            const x = seg.x * size;
            const y = seg.y * size;
            const isHead = index === 0;

            const pad = 1; // 保持 1px 缝隙，使每节方块清晰可辨
            const blockSize = size - pad * 2;

            if (isHead) {
                // 蛇头方块：亮翠绿
                ctx.fillStyle = '#52f69e';
                ctx.fillRect(x + pad, y + pad, blockSize, blockSize);

                // 蛇头高光顶部和左侧
                ctx.fillStyle = '#a3fcd0';
                ctx.fillRect(x + pad, y + pad, blockSize, 2);
                ctx.fillRect(x + pad, y + pad, 2, blockSize);

                // 蛇头阴影底部和右侧
                ctx.fillStyle = '#27ae60';
                ctx.fillRect(x + pad, y + pad + blockSize - 2, blockSize, 2);
                ctx.fillRect(x + pad + blockSize - 2, y + pad, 2, blockSize);

                // 蛇头像素眼睛 (根据移动方向画方向眼)
                this.drawSnakeEyes(x, y, this.direction);
            } else {
                // 蛇身方块：经典像素翡翠绿，交替微变色增添质感
                const isEven = index % 2 === 0;
                ctx.fillStyle = isEven ? '#2ecc71' : '#27ae60';
                ctx.fillRect(x + pad, y + pad, blockSize, blockSize);

                // 蛇身像素内嵌暗格与高光，强化方块感
                ctx.fillStyle = '#58d68d';
                ctx.fillRect(x + pad + 1, y + pad + 1, blockSize - 2, 2);
                ctx.fillRect(x + pad + 1, y + pad + 1, 2, blockSize - 2);

                ctx.fillStyle = '#1e8449';
                ctx.fillRect(x + pad + 1, y + pad + blockSize - 3, blockSize - 2, 2);
                ctx.fillRect(x + pad + blockSize - 3, y + pad + 1, 2, blockSize - 2);

                // 蛇身中心小方块核心图案
                ctx.fillStyle = '#196f3d';
                ctx.fillRect(x + size / 2 - 2, y + size / 2 - 2, 4, 4);
            }
        });
    }

    // 绘制蛇头方向眼 (像素方块眼)
    drawSnakeEyes(x, y, dir) {
        const ctx = this.ctx;
        ctx.fillStyle = '#0a1a12'; // 黑色眼珠

        let eye1 = { x: 0, y: 0 };
        let eye2 = { x: 0, y: 0 };

        if (dir === DIRECTION.RIGHT) {
            eye1 = { x: x + 13, y: y + 4 };
            eye2 = { x: x + 13, y: y + 12 };
        } else if (dir === DIRECTION.LEFT) {
            eye1 = { x: x + 3, y: y + 4 };
            eye2 = { x: x + 3, y: y + 12 };
        } else if (dir === DIRECTION.UP) {
            eye1 = { x: x + 4, y: y + 3 };
            eye2 = { x: x + 12, y: y + 3 };
        } else if (dir === DIRECTION.DOWN) {
            eye1 = { x: x + 4, y: y + 13 };
            eye2 = { x: x + 12, y: y + 13 };
        }

        // 画 3x3 黑色像素方块眼
        ctx.fillRect(eye1.x, eye1.y, 3, 3);
        ctx.fillRect(eye2.x, eye2.y, 3, 3);

        // 画 1px 白色小眼神高光
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(eye1.x + 1, eye1.y + 1, 1, 1);
        ctx.fillRect(eye2.x + 1, eye2.y + 1, 1, 1);
    }

    drawParticles() {
        const ctx = this.ctx;
        this.particles.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillRect(p.x, p.y, p.size, p.size);
        });
        ctx.globalAlpha = 1.0;
    }

    // 事件监听绑定
    initEventListeners() {
        // 键盘操作
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();

            // 方向控制
            if (['arrowup', 'w', 'k'].includes(key)) {
                this.handleDirectionInput(DIRECTION.UP);
                if (['arrowup'].includes(key)) e.preventDefault();
            } else if (['arrowdown', 's', 'j'].includes(key)) {
                this.handleDirectionInput(DIRECTION.DOWN);
                if (['arrowdown'].includes(key)) e.preventDefault();
            } else if (['arrowleft', 'a', 'h'].includes(key)) {
                this.handleDirectionInput(DIRECTION.LEFT);
                if (['arrowleft'].includes(key)) e.preventDefault();
            } else if (['arrowright', 'd', 'l'].includes(key)) {
                this.handleDirectionInput(DIRECTION.RIGHT);
                if (['arrowright'].includes(key)) e.preventDefault();
            }

            // 空格键：在不同状态下触发开始、重启或暂停
            if (key === ' ' || key === 'space') {
                e.preventDefault();
                if (this.gameState === 'START') {
                    this.startGame();
                } else if (this.gameState === 'GAMEOVER') {
                    this.startGame();
                } else if (this.gameState === 'PLAYING' || this.gameState === 'PAUSED') {
                    this.togglePause();
                }
            }

            // P 键暂停
            if (key === 'p') {
                this.togglePause();
            }

            // R 键快速重启
            if (key === 'r') {
                if (this.gameState === 'PLAYING' || this.gameState === 'PAUSED' || this.gameState === 'GAMEOVER') {
                    this.startGame();
                }
            }
        });

        // 难度按钮选择
        this.dom.diffButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                window.pixelAudio.playClick();
                this.dom.diffButtons.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.currentDifficulty = btn.dataset.diff;
                this.highScore = this.loadHighScore();
                this.updateHUD();
            });
        });

        // 开始游戏按钮
        this.dom.btnStart.addEventListener('click', () => {
            this.startGame();
        });

        // 重新开始按钮
        this.dom.btnRestart.addEventListener('click', () => {
            window.pixelAudio.playClick();
            this.startGame();
        });

        // 切换难度按钮
        this.dom.btnChangeDiff.addEventListener('click', () => {
            window.pixelAudio.playClick();
            this.gameState = 'START';
            this.dom.gameoverOverlay.classList.remove('active');
            this.dom.startOverlay.classList.add('active');
        });

        // 音效开关
        this.dom.btnSoundToggle.addEventListener('click', () => {
            const enabled = window.pixelAudio.toggle();
            this.dom.soundIcon.textContent = enabled ? '🔊' : '🔇';
            this.dom.btnSoundToggle.innerHTML = `${this.dom.soundIcon.outerHTML} 音效: ${enabled ? '开' : '关'}`;
            this.dom.soundIcon = this.dom.btnSoundToggle.querySelector('span');
        });

        // CRT滤镜开关
        this.dom.btnCrtToggle.addEventListener('click', () => {
            const isOff = this.dom.crtOverlay.classList.toggle('disabled');
            this.dom.btnCrtToggle.innerHTML = `<span>📺</span> 显像管: ${isOff ? '关' : '开'}`;
            window.pixelAudio.playClick();
        });

        // 虚拟触控按键
        document.querySelectorAll('.dpad-btn[data-dir]').forEach(btn => {
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const dirName = btn.dataset.dir;
                if (DIRECTION[dirName]) {
                    this.handleDirectionInput(DIRECTION[dirName]);
                }
            });
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const dirName = btn.dataset.dir;
                if (DIRECTION[dirName]) {
                    this.handleDirectionInput(DIRECTION[dirName]);
                }
            });
        });

        this.dom.touchPauseBtn.addEventListener('click', () => {
            if (this.gameState === 'START' || this.gameState === 'GAMEOVER') {
                this.startGame();
            } else {
                this.togglePause();
            }
        });

        // 手机端全屏滑动手势支持 (Touch Swipe Gestures)
        let touchStartX = 0;
        let touchStartY = 0;
        const cabinet = document.querySelector('.arcade-cabinet') || document.body;

        cabinet.addEventListener('touchstart', (e) => {
            if (e.target.closest('.pixel-btn') || e.target.closest('.dpad-btn')) return;
            const touch = e.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
        }, { passive: true });

        cabinet.addEventListener('touchmove', (e) => {
            if (this.gameState === 'PLAYING') {
                e.preventDefault(); // 阻止手机浏览器下拉刷新
            }
        }, { passive: false });

        cabinet.addEventListener('touchend', (e) => {
            if (e.target.closest('.pixel-btn') || e.target.closest('.dpad-btn')) return;
            if (!e.changedTouches || e.changedTouches.length === 0) return;
            const touch = e.changedTouches[0];
            const dx = touch.clientX - touchStartX;
            const dy = touch.clientY - touchStartY;
            const minSwipe = 20;

            if (Math.abs(dx) > Math.abs(dy)) {
                if (Math.abs(dx) > minSwipe) {
                    if (dx > 0) this.handleDirectionInput(DIRECTION.RIGHT);
                    else this.handleDirectionInput(DIRECTION.LEFT);
                }
            } else {
                if (Math.abs(dy) > minSwipe) {
                    if (dy > 0) this.handleDirectionInput(DIRECTION.DOWN);
                    else this.handleDirectionInput(DIRECTION.UP);
                }
            }
        }, { passive: true });
    }
}

// 页面加载完成后实例化游戏
window.addEventListener('DOMContentLoaded', () => {
    window.snakeGame = new SnakeGame();
});
