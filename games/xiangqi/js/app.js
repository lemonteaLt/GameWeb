/**
 * 中国象棋主游戏控制器 (Game Application Controller)
 */

class ChineseChessApp {
  constructor() {
    this.board = null;
    this.currentTurn = 'r'; // 红方先行
    this.mode = 'ai';       // 'ai' | 'pvp' | 'demo'
    this.aiDifficulty = 'medium';
    this.playerSide = 'r';  // 人机模式下玩家执红还是执黑
    this.isAiThinking = false;
    this.isGameOver = false;

    // 历史步数与吃子记录
    this.history = [];
    this.capturedRed = [];
    this.capturedBlack = [];

    // 计时器与步数统计
    this.redTime = 0;
    this.blackTime = 0;
    this.redSteps = 0;
    this.blackSteps = 0;
    this.timerInterval = null;

    // 偏好设置
    this.settings = {
      sound: true,
      hints: true,
      animation: true
    };

    this.ui = null;
  }

  init() {
    const boardContainer = document.getElementById('chess-board');
    const indicatorsLayer = document.getElementById('board-indicators');
    const piecesLayer = document.getElementById('board-pieces');

    this.ui = new ChessUI(boardContainer, indicatorsLayer, piecesLayer);

    // 注册 UI 回调
    this.ui.onPieceClick = (r, c) => this.handlePieceClick(r, c);
    this.ui.onSquareClick = (r, c) => this.handleSquareClick(r, c);

    // 绑定 DOM 按钮及设置
    this.bindEvents();

    // 启动初始对局
    this.startNewGame();
  }

  /**
   * 绑定所有按钮及事件监听
   */
  bindEvents() {
    // 基础操作按钮
    document.getElementById('btn-undo')?.addEventListener('click', () => this.handleUndo());
    document.getElementById('btn-hint')?.addEventListener('click', () => this.handleHint());
    document.getElementById('btn-flip')?.addEventListener('click', () => {
      window.soundEngine.playClick();
      this.ui.toggleFlip();
    });
    document.getElementById('btn-restart')?.addEventListener('click', () => {
      window.soundEngine.playClick();
      this.startNewGame();
    });

    // 模式切换 Tab
    document.querySelectorAll('.mode-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const newMode = e.target.dataset.mode;
        if (this.mode === newMode) return;
        window.soundEngine.playClick();

        document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');

        this.mode = newMode;
        const diffWrap = document.getElementById('ai-difficulty-wrap');
        const tag = document.getElementById('current-mode-tag');

        if (newMode === 'ai') {
          if (diffWrap) diffWrap.style.display = 'flex';
          if (tag) tag.textContent = `人机对战 · ${this.getDifficultyName()}`;
        } else if (newMode === 'pvp') {
          if (diffWrap) diffWrap.style.display = 'none';
          if (tag) tag.textContent = '双人同屏对战';
        } else if (newMode === 'demo') {
          if (diffWrap) diffWrap.style.display = 'none';
          if (tag) tag.textContent = 'AI 观战推演';
        }

        this.startNewGame();
      });
    });

    // AI 难度选择
    document.getElementById('ai-difficulty-select')?.addEventListener('change', (e) => {
      this.aiDifficulty = e.target.value;
      const tag = document.getElementById('current-mode-tag');
      if (tag && this.mode === 'ai') {
        tag.textContent = `人机对战 · ${this.getDifficultyName()}`;
      }
      this.ui.showToast(`AI 难度已切换为：${this.getDifficultyName()}`);
    });

    // 音效开关
    document.getElementById('btn-sound-toggle')?.addEventListener('click', () => {
      const enabled = window.soundEngine.toggle();
      const path = document.getElementById('sound-icon-path');
      if (enabled) {
        window.soundEngine.playClick();
        if (path) path.setAttribute('d', 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z');
        this.ui.showToast('音效已开启');
      } else {
        if (path) path.setAttribute('d', 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z');
        this.ui.showToast('音效已静音');
      }
    });

    // 棋谱复制导出
    document.getElementById('btn-export-pgn')?.addEventListener('click', () => {
      this.exportNotation();
    });

    // 设置弹窗
    const settingsModal = document.getElementById('settings-modal');
    document.getElementById('btn-settings-toggle')?.addEventListener('click', () => {
      window.soundEngine.playClick();
      settingsModal?.classList.add('show');
    });
    document.getElementById('btn-close-settings')?.addEventListener('click', () => {
      settingsModal?.classList.remove('show');
    });
    document.getElementById('btn-save-settings')?.addEventListener('click', () => {
      window.soundEngine.playClick();
      settingsModal?.classList.remove('show');
      this.ui.showToast('设置已保存');
    });

    // 设置项中的阵营切换
    document.querySelectorAll('.side-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.side-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.playerSide = e.target.dataset.side;
        if (this.playerSide === 'b' && !this.ui.isFlipped) {
          this.ui.toggleFlip();
        } else if (this.playerSide === 'r' && this.ui.isFlipped) {
          this.ui.toggleFlip();
        }
        this.startNewGame();
      });
    });

    // 结算弹窗按钮
    document.getElementById('btn-modal-restart')?.addEventListener('click', () => {
      document.getElementById('game-over-modal')?.classList.remove('show');
      this.startNewGame();
    });
    document.getElementById('btn-modal-close')?.addEventListener('click', () => {
      document.getElementById('game-over-modal')?.classList.remove('show');
    });
  }

  getDifficultyName() {
    switch (this.aiDifficulty) {
      case 'easy': return '初窥门径';
      case 'medium': return '登堂入室';
      case 'hard': return '炉火纯青';
      default: return '中级';
    }
  }

  /**
   * 开启新对局
   */
  startNewGame() {
    this.board = ChessRules.getInitialBoard();
    this.currentTurn = 'r';
    this.isAiThinking = false;
    this.isGameOver = false;

    this.history = [];
    this.capturedRed = [];
    this.capturedBlack = [];

    this.redTime = 0;
    this.blackTime = 0;
    this.redSteps = 0;
    this.blackSteps = 0;

    // 清除选中与高亮
    this.ui.setSelected(null, []);
    this.ui.setLastMove(null);
    this.ui.setHint(null);

    // 渲染全量棋盘
    this.ui.renderBoard(this.board);
    this.ui.renderCapturedTrays(this.capturedRed, this.capturedBlack);
    this.ui.renderMoveHistory(this.history);

    this.updatePlayerCards();
    this.updateStatusBanner('对局开始 · 红方先行');
    this.startTimer();

    // 如果是人机模式且玩家执黑，或者观战模式，触发 AI 先行
    if ((this.mode === 'ai' && this.playerSide === 'b') || this.mode === 'demo') {
      setTimeout(() => this.triggerAiMove(), 500);
    }
  }

  /**
   * 启动对局计时器
   */
  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.isGameOver) return;
      if (this.currentTurn === 'r') {
        this.redTime++;
      } else {
        this.blackTime++;
      }
      this.updateTimerDisplays();
    }, 1000);
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  updateTimerDisplays() {
    const redTimer = document.getElementById('red-timer');
    const blackTimer = document.getElementById('black-timer');
    if (redTimer) redTimer.textContent = this.formatTime(this.redTime);
    if (blackTimer) blackTimer.textContent = this.formatTime(this.blackTime);
  }

  /**
   * 更新双方状态卡片
   */
  updatePlayerCards() {
    const redCard = document.getElementById('red-player-card');
    const blackCard = document.getElementById('black-player-card');
    const redName = document.getElementById('red-player-name');
    const blackName = document.getElementById('black-player-name');
    const redPill = document.getElementById('red-turn-pill');
    const blackPill = document.getElementById('black-turn-pill');
    const redSteps = document.getElementById('red-step-count');
    const blackSteps = document.getElementById('black-step-count');

    // 步数更新
    if (redSteps) redSteps.textContent = `步数: ${this.redSteps}`;
    if (blackSteps) blackSteps.textContent = `步数: ${this.blackSteps}`;

    // 玩家名称显示
    if (this.mode === 'ai') {
      if (this.playerSide === 'r') {
        if (redName) redName.textContent = '执红 · 玩家 (先手)';
        if (blackName) blackName.textContent = `执黑 · 电脑 (${this.getDifficultyName()})`;
      } else {
        if (redName) redName.textContent = `执红 · 电脑 (${this.getDifficultyName()})`;
        if (blackName) blackName.textContent = '执黑 · 玩家 (后手)';
      }
    } else if (this.mode === 'pvp') {
      if (redName) redName.textContent = '执红 · 玩家一 (先手)';
      if (blackName) blackName.textContent = '执黑 · 玩家二';
    } else if (this.mode === 'demo') {
      if (redName) redName.textContent = '执红 · 电脑 (AI-1)';
      if (blackName) blackName.textContent = '执黑 · 电脑 (AI-2)';
    }

    // 回合指示高亮
    if (this.currentTurn === 'r') {
      redCard?.classList.add('active-turn');
      blackCard?.classList.remove('active-turn');
      if (redPill) {
        if (this.isAiThinking && this.isCurrentTurnAi()) {
          redPill.textContent = '思考中...';
          redPill.classList.add('thinking');
        } else {
          redPill.textContent = '轮到走棋';
          redPill.classList.remove('thinking');
        }
      }
      if (blackPill) {
        blackPill.textContent = '等待对弈';
        blackPill.classList.remove('thinking');
      }
    } else {
      blackCard?.classList.add('active-turn');
      redCard?.classList.remove('active-turn');
      if (blackPill) {
        if (this.isAiThinking && this.isCurrentTurnAi()) {
          blackPill.textContent = '思考中...';
          blackPill.classList.add('thinking');
        } else {
          blackPill.textContent = '轮到走棋';
          blackPill.classList.remove('thinking');
        }
      }
      if (redPill) {
        redPill.textContent = '等待对弈';
        redPill.classList.remove('thinking');
      }
    }
  }

  updateStatusBanner(text) {
    const banner = document.getElementById('status-text');
    if (banner) banner.textContent = text;
  }

  isCurrentTurnAi() {
    if (this.mode === 'demo') return true;
    if (this.mode === 'ai') {
      return this.currentTurn !== this.playerSide;
    }
    return false;
  }

  /**
   * 点击棋盘上的棋子
   */
  handlePieceClick(r, c) {
    if (this.isGameOver || this.isAiThinking || this.isMoving) return;
    if (this.isCurrentTurnAi()) return; // 轮到 AI 时玩家不能操作

    const piece = this.board[r][c];
    if (!piece) return;

    // 1. 如果点击己方棋子
    if (piece.side === this.currentTurn) {
      // 如果再次点击已选中的棋子 -> 取消选中
      if (this.ui.selectedPos && this.ui.selectedPos.r === r && this.ui.selectedPos.c === c) {
        this.ui.setSelected(null, []);
        return;
      }

      window.soundEngine.playClick();
      const pseudoMoves = ChessRules.getPseudoMoves(this.board, r, c);
      const legalMoves = pseudoMoves.filter(m => ChessRules.isLegalMove(this.board, m, this.currentTurn));

      this.ui.setSelected({ r, c }, legalMoves);
    } 
    // 2. 如果已选中己方棋子且点击敌方棋子 -> 尝试吃子
    else if (this.ui.selectedPos) {
      const targetMove = this.ui.legalMoves.find(m => m.to.r === r && m.to.c === c);
      if (targetMove) {
        this.executeMove(targetMove);
      } else {
        window.soundEngine.playIllegal();
      }
    }
  }

  /**
   * 点击棋盘空位或落子点
   */
  handleSquareClick(r, c) {
    if (this.isGameOver || this.isAiThinking || this.isMoving) return;
    if (this.isCurrentTurnAi()) return;

    const piece = this.board[r][c];

    // 如果该位置有棋子，直接交由 handlePieceClick 处理
    if (piece) {
      this.handlePieceClick(r, c);
      return;
    }

    // 如果点击空位且当前已选中棋子
    if (this.ui.selectedPos) {
      const targetMove = this.ui.legalMoves.find(m => m.to.r === r && m.to.c === c);
      if (targetMove) {
        this.executeMove(targetMove);
      } else {
        // 点击非法空位时取消选中
        this.ui.setSelected(null, []);
      }
    }
  }

  /**
   * 核心走法执行函数 (确保动画先流畅播放完成，再让 AI 思考)
   */
  async executeMove(move) {
    if (this.isMoving) return;
    this.isMoving = true;

    const boardBefore = ChessRules.cloneBoard(this.board);
    const notation = ChessRules.getMoveNotation(boardBefore, move);
    const captured = this.board[move.to.r][move.to.c];

    // 更新棋盘数据
    this.board[move.to.r][move.to.c] = this.board[move.from.r][move.from.c];
    this.board[move.from.r][move.from.c] = null;

    // 记录吃子
    if (captured) {
      if (captured.side === 'r') {
        this.capturedRed.push(captured);
      } else {
        this.capturedBlack.push(captured);
      }
      window.soundEngine.playCapture();
    } else {
      window.soundEngine.playMove();
    }

    // 记录历史
    this.history.push({
      boardBefore,
      move,
      notation,
      captured
    });

    if (this.currentTurn === 'r') {
      this.redSteps++;
    } else {
      this.blackSteps++;
    }

    // 1. 触发棋子平滑滑动过渡动画
    this.ui.setSelected(null, []);
    this.ui.setLastMove(move);
    this.ui.renderBoard(this.board);
    this.ui.renderCapturedTrays(this.capturedRed, this.capturedBlack);
    this.ui.renderMoveHistory(this.history);

    // 2. 切换回合
    const nextTurn = this.currentTurn === 'r' ? 'b' : 'r';
    this.currentTurn = nextTurn;
    this.updatePlayerCards();

    // 3. 等待棋子平滑滑行彻底到位 (300ms)
    await new Promise(resolve => setTimeout(resolve, 300));
    this.isMoving = false;

    // 4. 检查胜负与将军状态
    const status = ChessRules.getGameStatus(this.board, this.currentTurn);

    if (status.over) {
      this.handleGameOver(status);
      return;
    }

    if (status.inCheck) {
      window.soundEngine.playCheck();
      this.ui.showCheckBanner(this.currentTurn);
      this.updateStatusBanner(`${this.currentTurn === 'r' ? '红方' : '黑方'}受将军！请应将`);
    } else {
      this.updateStatusBanner(`轮到${this.currentTurn === 'r' ? '红方' : '黑方'}走棋 · ${notation}`);
    }

    // 5. 棋子已完全就位，触发 AI 后台线程思考
    if (this.isCurrentTurnAi() && !this.isGameOver) {
      this.triggerAiMove();
    }
  }

  /**
   * 触发 AI 思考与走法 (后台 Worker 计算，主线程零卡顿)
   */
  async triggerAiMove() {
    this.isAiThinking = true;
    this.updatePlayerCards();
    this.updateStatusBanner(`电脑 (${this.getDifficultyName()}) 正在思考妙着...`);

    const startTime = Date.now();
    const bestMove = await ChessAI.getBestMove(this.board, this.currentTurn, this.aiDifficulty);
    const elapsed = Date.now() - startTime;

    // 确保至少有 260ms 的思考节奏感，避免快棋瞬间秒下令人眼花
    if (elapsed < 260) {
      await new Promise(resolve => setTimeout(resolve, 260 - elapsed));
    }

    this.isAiThinking = false;
    this.updatePlayerCards();

    if (!bestMove || this.isGameOver) return;

    this.executeMove(bestMove);
  }

  /**
   * 游戏结束结算
   */
  handleGameOver(status) {
    this.isGameOver = true;
    if (this.timerInterval) clearInterval(this.timerInterval);

    window.soundEngine.playWin();

    const modal = document.getElementById('game-over-modal');
    const seal = document.getElementById('modal-seal');
    const title = document.getElementById('modal-result-title');
    const desc = document.getElementById('modal-result-desc');
    const totalTurns = document.getElementById('stat-total-turns');
    const totalTime = document.getElementById('stat-total-time');

    const winnerText = status.winner === 'r' ? '红 方 胜 出' : '黑 方 胜 出';
    if (title) title.textContent = winnerText;
    if (seal) {
      seal.textContent = '胜';
      seal.style.background = status.winner === 'r' ? 'var(--red-piece-main)' : 'var(--black-piece-main)';
    }
    if (desc) desc.textContent = status.reason;
    if (totalTurns) totalTurns.textContent = `${Math.ceil(this.history.length / 2)} 回合`;
    if (totalTime) totalTime.textContent = this.formatTime(this.redTime + this.blackTime);

    modal?.classList.add('show');
    this.updateStatusBanner(`对局结束 · ${winnerText}`);

    // 向主网站平台同步战绩
    if (window.parent && window.parent !== window) {
      let winScore = 100;
      if (status.winner === this.playerSide) {
        const diffBonus = this.aiDifficulty === 'hard' ? 600 : (this.aiDifficulty === 'medium' ? 300 : 150);
        const roundEfficiency = Math.max(10, 100 - this.history.length);
        winScore = diffBonus + roundEfficiency;
      } else {
        winScore = Math.min(50, this.history.length * 2);
      }
      window.parent.postMessage({ type: "GAME_SCORE", score: winScore }, "*");
    }
  }

  /**
   * 悔棋逻辑 (PvP撤销1步，PvE撤销2步)
   */
  handleUndo() {
    if (this.isGameOver || this.isAiThinking) return;
    if (this.history.length === 0) {
      this.ui.showToast('当前无棋可悔');
      return;
    }

    window.soundEngine.playClick();

    // 计算需要回退的步数
    let stepsToUndo = 1;
    if (this.mode === 'ai') {
      // 如果人机对战且此时轮到玩家走棋，说明需要撤销电脑的上一步+玩家的上一步
      stepsToUndo = this.history.length >= 2 ? 2 : 1;
    }

    for (let i = 0; i < stepsToUndo; i++) {
      if (this.history.length === 0) break;
      const last = this.history.pop();
      this.board = last.boardBefore;

      if (last.captured) {
        if (last.captured.side === 'r') {
          this.capturedRed.pop();
        } else {
          this.capturedBlack.pop();
        }
      }

      this.currentTurn = this.currentTurn === 'r' ? 'b' : 'r';
      if (this.currentTurn === 'r') {
        this.redSteps = Math.max(0, this.redSteps - 1);
      } else {
        this.blackSteps = Math.max(0, this.blackSteps - 1);
      }
    }

    const previousMove = this.history.length > 0 ? this.history[this.history.length - 1].move : null;
    this.ui.setLastMove(previousMove);
    this.ui.setSelected(null, []);
    this.ui.renderBoard(this.board);
    this.ui.renderCapturedTrays(this.capturedRed, this.capturedBlack);
    this.ui.renderMoveHistory(this.history);

    this.updatePlayerCards();
    this.updateStatusBanner(`已悔棋，轮到${this.currentTurn === 'r' ? '红方' : '黑方'}走棋`);
    this.ui.showToast('悔棋成功');
  }

  /**
   * AI 提示走法
   */
  async handleHint() {
    if (this.isGameOver || this.isAiThinking) return;

    window.soundEngine.playClick();
    this.ui.showToast('AI 正在为您寻思妙着...');

    const bestMove = await ChessAI.getBestMove(this.board, this.currentTurn, 'hard');
    if (bestMove) {
      const notation = ChessRules.getMoveNotation(this.board, bestMove);
      this.ui.setHint(bestMove);
      this.ui.showToast(`棋计推荐：【${notation}】`);
    }
  }

  /**
   * 导出棋谱文本到剪贴板
   */
  exportNotation() {
    if (this.history.length === 0) {
      this.ui.showToast('棋谱尚为空白');
      return;
    }

    window.soundEngine.playClick();
    let text = `【中国象棋对局谱】\n模式: ${this.mode === 'ai' ? '人机对弈' : '双人对决'}\n时间: ${new Date().toLocaleDateString()}\n\n`;

    for (let i = 0; i < this.history.length; i += 2) {
      const round = Math.floor(i / 2) + 1;
      const red = this.history[i] ? this.history[i].notation : '';
      const black = this.history[i + 1] ? this.history[i + 1].notation : '';
      text += `第${round}回合: ${red.padEnd(8, ' ')} ${black}\n`;
    }

    navigator.clipboard?.writeText(text).then(() => {
      this.ui.showToast('棋谱已成功复制到剪贴板！');
    }).catch(() => {
      this.ui.showToast('复制失败，请手动记录');
    });
  }
}

// 页面加载完成后实例化应用
document.addEventListener('DOMContentLoaded', () => {
  const app = new ChineseChessApp();
  app.init();
  window.chessApp = app;
});
