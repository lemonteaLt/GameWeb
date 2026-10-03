/**
 * 2048 经典版 - 核心控制引擎与方块全景图鉴系统
 * 包含：
 * 1. 经典 2048 算法：全盘滑动、合并升级、新块生成、胜负判定
 * 2. 鼠标拖拽感知与全向指示器
 * 3. 随数值增长的动态体量与专属视觉色彩
 * 4. 阶段方块图鉴交互面板
 */

class GameManager {
  constructor(size = 4) {
    this.size = size;
    this.board = [];
    this.score = 0;
    this.bestScore = parseInt(localStorage.getItem('2048_classic_best_score') || '0', 10);
    this.tileIdCounter = 0;
    this.tiles = []; // 存储活跃方块
    this.won = false;
    this.over = false;
    this.keepPlaying = false;
    this.isMoving = false;

    // DOM 元素引用
    this.tileContainer = document.getElementById('tile-container');
    this.scoreDisplay = document.getElementById('score');
    this.bestScoreDisplay = document.getElementById('best-score');
    this.scoreAddition = document.getElementById('score-addition');
    this.gameBoard = document.getElementById('game-board');
    this.gameMessage = document.getElementById('game-message');
    this.gameMessageText = document.getElementById('game-message-text');
    this.gameMessageSub = document.getElementById('game-message-sub');
    this.restartBtn = document.getElementById('restart-btn');
    this.retryBtn = document.getElementById('retry-btn');
    this.keepGoingBtn = document.getElementById('keep-going-btn');
    this.dragIndicator = document.getElementById('drag-indicator');

    // 图鉴 DOM
    this.handbookBtn = document.getElementById('handbook-btn');
    this.handbookModal = document.getElementById('handbook-modal');
    this.closeHandbookBtn = document.getElementById('close-handbook-btn');
    this.closeHandbookFooterBtn = document.getElementById('close-handbook-footer-btn');
    this.handbookList = document.getElementById('handbook-list');

    this.init();
  }

  init() {
    this.bestScoreDisplay.textContent = this.bestScore;
    this.setupEventListeners();
    this.buildHandbook();
    this.startNewGame();

    window.addEventListener('resize', () => {
      this.updateTilePositions();
    });
  }

  startNewGame() {
    this.board = Array.from({ length: this.size }, () => Array(this.size).fill(null));
    this.tiles = [];
    this.score = 0;
    this.won = false;
    this.over = false;
    this.keepPlaying = false;
    this.tileIdCounter = 0;
    this.updateScore(0);
    this.clearMessage();
    this.clearTileContainer();

    // 初始生成两个方块 (最小数字为 2)
    this.addRandomTile();
    this.addRandomTile();
    this.render();
  }

  clearTileContainer() {
    this.tileContainer.innerHTML = '';
  }

  getAvailableCells() {
    const cells = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (!this.board[r][c]) {
          cells.push({ row: r, col: c });
        }
      }
    }
    return cells;
  }

  // 随机添加新方块（90%概率为2，10%概率为4）
  addRandomTile() {
    const availableCells = this.getAvailableCells();
    if (availableCells.length === 0) return;

    const randomCell = availableCells[Math.floor(Math.random() * availableCells.length)];
    const value = Math.random() < 0.9 ? 2 : 4;

    const tile = {
      id: ++this.tileIdCounter,
      row: randomCell.row,
      col: randomCell.col,
      value: value,
      isNew: true,
      mergedInto: null
    };

    this.board[randomCell.row][randomCell.col] = tile;
    this.tiles.push(tile);
  }

  // 移动方块核心算法 (0: 上, 1: 右, 2: 下, 3: 左)
  move(direction) {
    if (this.over || this.isMoving) return false;

    const vectors = {
      0: { r: -1, c: 0 }, // Up
      1: { r: 0, c: 1 },  // Right
      2: { r: 1, c: 0 },  // Down
      3: { r: 0, c: -1 }  // Left
    };

    const vector = vectors[direction];
    if (!vector) return false;

    const rows = Array.from({ length: this.size }, (_, i) => i);
    const cols = Array.from({ length: this.size }, (_, i) => i);

    if (vector.r === 1) rows.reverse();
    if (vector.c === 1) cols.reverse();

    let moved = false;
    let scoreGain = 0;

    this.tiles.forEach(t => {
      t.isNew = false;
      t.isMerged = false;
    });

    const nextBoard = Array.from({ length: this.size }, () => Array(this.size).fill(null));

    for (let r of rows) {
      for (let c of cols) {
        const tile = this.board[r][c];
        if (!tile) continue;

        let currR = r;
        let currC = c;

        // 推进到最远空位
        while (
          currR + vector.r >= 0 &&
          currR + vector.r < this.size &&
          currC + vector.c >= 0 &&
          currC + vector.c < this.size &&
          !nextBoard[currR + vector.r][currC + vector.c]
        ) {
          currR += vector.r;
          currC += vector.c;
        }

        const nextR = currR + vector.r;
        const nextC = currC + vector.c;

        // 判断合并
        if (
          nextR >= 0 && nextR < this.size &&
          nextC >= 0 && nextC < this.size &&
          nextBoard[nextR][nextC] &&
          nextBoard[nextR][nextC].value === tile.value &&
          !nextBoard[nextR][nextC].isMerged
        ) {
          const targetTile = nextBoard[nextR][nextC];
          const newValue = tile.value * 2;
          scoreGain += newValue;

          tile.row = nextR;
          tile.col = nextC;
          tile.mergedInto = targetTile;

          targetTile.value = newValue;
          targetTile.isMerged = true;

          if (newValue === 2048 && !this.won && !this.keepPlaying) {
            this.won = true;
          }

          moved = true;
        } else {
          if (currR !== r || currC !== c) {
            moved = true;
          }
          tile.row = currR;
          tile.col = currC;
          nextBoard[currR][currC] = tile;
        }
      }
    }

    if (moved) {
      this.isMoving = true;
      this.board = nextBoard;
      this.render();

      if (scoreGain > 0) {
        this.updateScore(this.score + scoreGain, scoreGain);
      }

      setTimeout(() => {
        this.tiles = this.tiles.filter(t => !t.mergedInto);
        this.addRandomTile();
        this.render();
        this.isMoving = false;

        if (this.won && !this.keepPlaying) {
          this.showMessage(true, '达成 2048！🎉', '太棒了！已解锁 2048 荣耀金冠，你可以继续挑战更高峰！');
        } else if (this.isGameOver()) {
          this.over = true;
          this.showMessage(false, '游戏结束', '棋盘已满且没有可合并的方块！');
        }
      }, 130);

      return true;
    }

    return false;
  }

  isGameOver() {
    if (this.getAvailableCells().length > 0) return false;

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const val = this.board[r][c].value;
        if (r + 1 < this.size && this.board[r + 1][c].value === val) return false;
        if (c + 1 < this.size && this.board[r][c + 1].value === val) return false;
      }
    }
    return true;
  }

  updateScore(newScore, scoreGain = 0) {
    this.score = newScore;
    this.scoreDisplay.textContent = this.score;

    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      this.bestScoreDisplay.textContent = this.bestScore;
      localStorage.setItem('2048_classic_best_score', this.bestScore.toString());
    }

    if (scoreGain > 0) {
      this.scoreAddition.textContent = `+${scoreGain}`;
      this.scoreAddition.classList.remove('active');
      void this.scoreAddition.offsetWidth;
      this.scoreAddition.classList.add('active');

      // 向主站平台同步最新战绩与最高分
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "GAME_SCORE", score: this.score }, "*");
      }
    }
  }

  // 渲染 DOM 方块
  render() {
    const existingDomElements = new Map();
    this.tileContainer.querySelectorAll('.tile').forEach(el => {
      existingDomElements.set(parseInt(el.dataset.id, 10), el);
    });

    const activeIds = new Set();

    this.tiles.forEach(tile => {
      activeIds.add(tile.id);
      let tileEl = existingDomElements.get(tile.id);

      if (!tileEl) {
        tileEl = document.createElement('div');
        tileEl.dataset.id = tile.id;
        tileEl.className = 'tile';

        const inner = document.createElement('div');
        inner.className = 'tile-inner';
        tileEl.appendChild(inner);

        this.tileContainer.appendChild(tileEl);
      }

      const valClass = tile.value <= 32768 ? `tile-${tile.value}` : 'tile-super';
      tileEl.className = `tile ${valClass}`;

      if (tile.isNew) {
        tileEl.classList.add('tile-new');
      }
      if (tile.isMerged) {
        tileEl.classList.add('tile-merged');
      }

      const inner = tileEl.querySelector('.tile-inner');
      inner.textContent = tile.value;

      this.positionTile(tileEl, tile.row, tile.col);
    });

    existingDomElements.forEach((el, id) => {
      if (!activeIds.has(id)) {
        el.remove();
      }
    });
  }

  positionTile(tileEl, row, col) {
    const containerWidth = this.tileContainer.offsetWidth;
    const gap = 14;
    const cellSize = (containerWidth - gap * (this.size - 1)) / this.size;

    const x = col * (cellSize + gap);
    const y = row * (cellSize + gap);

    tileEl.style.width = `${cellSize}px`;
    tileEl.style.height = `${cellSize}px`;
    tileEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  updateTilePositions() {
    this.tiles.forEach(tile => {
      const tileEl = this.tileContainer.querySelector(`[data-id="${tile.id}"]`);
      if (tileEl) {
        this.positionTile(tileEl, tile.row, tile.col);
      }
    });
  }

  showMessage(isWin, title, sub) {
    this.gameMessageText.textContent = title;
    this.gameMessageSub.textContent = sub;
    if (isWin) {
      this.gameMessage.classList.add('game-won');
      this.keepGoingBtn.classList.remove('hide');
    } else {
      this.gameMessage.classList.remove('game-won');
      this.keepGoingBtn.classList.add('hide');
    }
    this.gameMessage.classList.add('active');
  }

  clearMessage() {
    this.gameMessage.classList.remove('active', 'game-won');
  }

  // =========================================================
  // 📖 构建方块全阶段图鉴数据
  // =========================================================
  buildHandbook() {
    const stages = [
      { val: 2, name: '初生微尘', scale: '82% 体积', desc: '起点初生，圆角 8px，轻巧玲珑' },
      { val: 4, name: '渐入佳境', scale: '85% 体积', desc: '温润米黄，圆角 9px' },
      { val: 8, name: '暖阳初照', scale: '88% 体积', desc: '珊瑚橙光，圆角 10px' },
      { val: 16, name: '破晓生辉', scale: '91% 体积', desc: '活力鲜橙，圆角 11px' },
      { val: 32, name: '活力珊瑚', scale: '94% 体积', desc: '明亮珊瑚红，圆角 12px' },
      { val: 64, name: '烈焰进阶', scale: '97% 体积', desc: '深邃赤红，圆角 13px' },
      { val: 128, name: '金芒初现', scale: '100% 标准满格', desc: '金光显现，圆角 14px，外散微光' },
      { val: 256, name: '灿金溢彩', scale: '102% 微溢饱满', desc: '耀眼明黄，圆角 15px，金黄光晕' },
      { val: 512, name: '炽金跃动', scale: '104% 气势充沛', desc: '炽烈金橙，圆角 16px，高能发光' },
      { val: 1024, name: '尊荣纯金', scale: '106% 雄浑尊贵', desc: '纯金光华，圆角 17px，金芒环绕' },
      { val: 2048, name: '荣耀金冠', scale: '108% 终极盛芒', desc: '鎏金渐变，圆角 18px，动态呼吸微光' },
      { val: 4096, name: '幻紫晶核', scale: '110% 超凡幻域', desc: '星云魅紫，圆角 18px，脉动紫晕' },
      { val: 8192, name: '星际深渊', scale: '111% 宇宙深蓝', desc: '深空湛蓝，圆角 18px，星河光环' },
      { val: 16384, name: '青翠极光', scale: '112% 赛博电芒', desc: '荧光青翠，圆角 18px，高能激光流' },
      { val: 32768, name: '超新星炽', scale: '113% 等离子辉', desc: '赤红烈焰，圆角 18px，等离子光爆' },
      { val: 65536, name: '彩虹钻石', scale: '114% 全光谱流动', desc: '全息彩虹流光，至尊神级钻石' }
    ];

    this.handbookList.innerHTML = '';

    stages.forEach((st, idx) => {
      const card = document.createElement('div');
      card.className = 'handbook-card';

      const tileClass = st.val <= 32768 ? `tile-${st.val}` : 'tile-65536';

      card.innerHTML = `
        <div class="handbook-tile-cell">
          <div class="tile ${tileClass}">
            <div class="tile-inner">${st.val}</div>
          </div>
        </div>
        <div class="handbook-info">
          <div class="handbook-stage-tag">Stage ${idx + 1} · ${st.scale}</div>
          <div class="handbook-name">${st.val} - ${st.name}</div>
          <div class="handbook-desc">${st.desc}</div>
        </div>
      `;

      this.handbookList.appendChild(card);
    });
  }

  openHandbook() {
    this.handbookModal.classList.add('active');
  }

  closeHandbook() {
    this.handbookModal.classList.remove('active');
  }

  // 绑定鼠标拖动、触摸手势与按键交互
  setupEventListeners() {
    this.restartBtn.addEventListener('click', () => this.startNewGame());
    this.retryBtn.addEventListener('click', () => this.startNewGame());
    this.keepGoingBtn.addEventListener('click', () => {
      this.keepPlaying = true;
      this.clearMessage();
    });

    // 图鉴浮层打开与关闭
    this.handbookBtn.addEventListener('click', () => this.openHandbook());
    this.closeHandbookBtn.addEventListener('click', () => this.closeHandbook());
    this.closeHandbookFooterBtn.addEventListener('click', () => this.closeHandbook());
    this.handbookModal.addEventListener('click', (e) => {
      if (e.target === this.handbookModal) {
        this.closeHandbook();
      }
    });

    // 键盘支持
    window.addEventListener('keydown', (e) => {
      if (this.handbookModal.classList.contains('active')) {
        if (e.key === 'Escape') this.closeHandbook();
        return;
      }

      const map = {
        ArrowUp: 0, KeyW: 0,
        ArrowRight: 1, KeyD: 1,
        ArrowDown: 2, KeyS: 2,
        ArrowLeft: 3, KeyA: 3
      };

      if (map[e.code] !== undefined) {
        e.preventDefault();
        this.move(map[e.code]);
      }
    });

    // 鼠标与触屏拖动引擎
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let currentDirection = null;
    const dragThreshold = 28;

    const getDirection = (dx, dy) => {
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (Math.max(absX, absY) < 14) return null;

      if (absX > absY) {
        return dx > 0 ? 1 : 3;
      } else {
        return dy > 0 ? 2 : 0;
      }
    };

    const updateDragUI = (direction) => {
      if (direction === null) {
        this.dragIndicator.className = 'drag-indicator';
        return;
      }
      const dirNames = { 0: 'dir-up', 1: 'dir-right', 2: 'dir-down', 3: 'dir-left' };
      this.dragIndicator.className = `drag-indicator active ${dirNames[direction]}`;
    };

    const handleDragStart = (x, y) => {
      if (this.over || this.isMoving || this.handbookModal.classList.contains('active')) return;
      isDragging = true;
      startX = x;
      startY = y;
      currentDirection = null;
      this.gameBoard.classList.add('dragging');
    };

    const handleDragMove = (x, y) => {
      if (!isDragging) return;
      const dx = x - startX;
      const dy = y - startY;
      const dir = getDirection(dx, dy);

      if (dir !== currentDirection) {
        currentDirection = dir;
        updateDragUI(dir);
      }
    };

    const handleDragEnd = (x, y) => {
      if (!isDragging) return;
      isDragging = false;
      this.gameBoard.classList.remove('dragging');
      this.dragIndicator.className = 'drag-indicator';

      const dx = x - startX;
      const dy = y - startY;
      const distance = Math.hypot(dx, dy);

      if (distance >= dragThreshold) {
        const finalDirection = getDirection(dx, dy);
        if (finalDirection !== null) {
          this.move(finalDirection);
        }
      }
    };

    this.gameBoard.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      handleDragStart(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', (e) => {
      if (isDragging) {
        e.preventDefault();
        handleDragMove(e.clientX, e.clientY);
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (isDragging) {
        handleDragEnd(e.clientX, e.clientY);
      }
    });

    this.gameBoard.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    this.gameBoard.addEventListener('touchmove', (e) => {
      if (isDragging && e.touches.length > 0) {
        handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    this.gameBoard.addEventListener('touchend', (e) => {
      if (isDragging && e.changedTouches.length > 0) {
        handleDragEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new GameManager(4);
});
