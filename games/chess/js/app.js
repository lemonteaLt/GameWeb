/**
 * 王国征伐 · 3D 主控制器 (Main 3D Medieval Chess App Controller)
 */
document.addEventListener('DOMContentLoaded', () => {
  // 1. 初始化背景粒子
  ParticleSystem.init();

  const engine = new ChessEngine();
  const ai = new ChessAI(2);

  // 游戏状态
  let gameMode = 'pve-white'; // 'pve-white', 'pve-black', 'pvp'
  let isFlipped = false;
  let selectedSquare = null;   // { r, c }
  let legalMovesForSelected = [];
  let pendingPromotionMove = null;
  let isAiThinking = false;
  let lastMove = null;

  // 计时器状态
  let timers = { w: 600, b: 600 };
  let timerInterval = null;

  // DOM 元素
  const turnBannerEl = document.getElementById('turn-banner');
  const turnTextEl = document.getElementById('turn-text');
  const checkFlashEl = document.getElementById('check-flash');
  
  const panelWhiteEl = document.getElementById('panel-white');
  const panelBlackEl = document.getElementById('panel-black');
  const timerWhiteEl = document.getElementById('timer-white');
  const timerBlackEl = document.getElementById('timer-black');
  const graveyardWhiteEl = document.getElementById('graveyard-white');
  const graveyardBlackEl = document.getElementById('graveyard-black');
  const advWhiteEl = document.getElementById('adv-white');
  const advBlackEl = document.getElementById('adv-black');
  const moveHistoryEl = document.getElementById('move-history');
  
  const nameWhiteEl = document.getElementById('name-white');
  const nameBlackEl = document.getElementById('name-black');
  const modeSelectEl = document.getElementById('game-mode-select');
  const diffRowEl = document.getElementById('ai-difficulty-row');
  const diffSelectEl = document.getElementById('ai-difficulty-select');

  const btnRestart = document.getElementById('btn-restart');
  const btnUndo = document.getElementById('btn-undo');
  const btnFlip = document.getElementById('btn-flip');
  const btnSound = document.getElementById('btn-sound');
  
  const btnCam3d = document.getElementById('btn-cam-3d');
  const btnCamTop = document.getElementById('btn-cam-top');
  const btnCamCinema = document.getElementById('btn-cam-cinema');
  const btnCamReset = document.getElementById('btn-cam-reset');

  const promoModalEl = document.getElementById('promotion-modal');
  const promoChoicesEl = document.getElementById('promotion-choices');
  const gameoverModalEl = document.getElementById('gameover-modal');
  const gameoverTitleEl = document.getElementById('gameover-title');
  const gameoverReasonEl = document.getElementById('gameover-reason');
  const gameoverStatsEl = document.getElementById('gameover-stats');
  const btnModalRestart = document.getElementById('btn-modal-restart');

  // 2. 初始化 3D 棋盘
  const board3D = new Board3D('chess-3d-viewport', onSquareClick);

  // 初始化战局
  function initGame() {
    engine.reset();
    selectedSquare = null;
    legalMovesForSelected = [];
    pendingPromotionMove = null;
    isAiThinking = false;
    lastMove = null;
    timers = { w: 600, b: 600 };

    updatePlayerNames();
    board3D.setFlipped(isFlipped);
    board3D.syncBoard(engine);
    updateBoardHighlights();
    updateUI();
    startTimer();

    // 如果玩家执黑，AI先手执白棋
    if (gameMode === 'pve-black' && engine.turn === 'w') {
      setTimeout(triggerAiMove, 600);
    }
  }

  function updatePlayerNames() {
    if (gameMode === 'pvp') {
      nameWhiteEl.textContent = '圣狮军领主';
      nameBlackEl.textContent = '铁龙军大公';
      diffRowEl.style.display = 'none';
    } else if (gameMode === 'pve-white') {
      nameWhiteEl.textContent = '执棋领主 (玩家)';
      nameBlackEl.textContent = '铁血大公 (AI)';
      diffRowEl.style.display = 'flex';
    } else {
      nameWhiteEl.textContent = '圣殿统帅 (AI)';
      nameBlackEl.textContent = '执棋领主 (玩家)';
      diffRowEl.style.display = 'flex';
    }
  }

  function updateBoardHighlights() {
    const kingInCheckPos = engine.isInCheck(engine.turn) ? engine.findKing(engine.turn) : null;
    board3D.updateHighlights(selectedSquare, legalMovesForSelected, kingInCheckPos, lastMove);
  }

  // 3D 棋盘点击响应
  function onSquareClick(r, c) {
    if (isAiThinking) return;
    if (gameoverModalEl.classList.contains('hidden') === false) return;

    const isPlayerTurn = (gameMode === 'pvp') ||
      (gameMode === 'pve-white' && engine.turn === 'w') ||
      (gameMode === 'pve-black' && engine.turn === 'b');

    if (!isPlayerTurn) return;

    const clickedPiece = engine.getPiece(r, c);

    // 1. 已选中棋子并点击合法移动目的地
    if (selectedSquare) {
      const move = legalMovesForSelected.find(m => m.to.r === r && m.to.c === c);
      if (move) {
        if (move.promo) {
          showPromotionModal(move);
          return;
        }
        executePlayerMove(move);
        return;
      }
    }

    // 2. 选中己方棋子
    if (clickedPiece && clickedPiece.color === engine.turn) {
      SoundFx.playClick();
      selectedSquare = { r, c };
      legalMovesForSelected = engine.getLegalMoves(r, c);
      updateBoardHighlights();
    } else {
      // 取消选中
      selectedSquare = null;
      legalMovesForSelected = [];
      updateBoardHighlights();
    }
  }

  // 执行玩家走棋
  function executePlayerMove(move) {
    const piece = engine.getPiece(move.from.r, move.from.c);
    const wasCapture = move.isCapture;

    engine.makeMove(move);
    lastMove = move;
    selectedSquare = null;
    legalMovesForSelected = [];

    // 3D 移动跳跃动画
    board3D.animatePieceMove(move.from, move.to, () => {
      // 升变或易位后重新同步3D模型结构
      if (move.promo || move.isCastling || move.isEnPassant) {
        board3D.syncBoard(engine);
      }
    });

    if (wasCapture) {
      SoundFx.playCapture();
    } else {
      SoundFx.playMove();
    }

    afterMoveProcess(move, piece);
  }

  // 走棋后处理
  function afterMoveProcess(move, piece) {
    const status = engine.getGameStatus();

    if (status.inCheck && !status.isOver) {
      SoundFx.playCheck();
      checkFlashEl.classList.add('active');
      setTimeout(() => checkFlashEl.classList.remove('active'), 1200);
    }

    const san = engine.getMoveSAN(move, piece, status.inCheck, status.result === 'checkmate');
    recordMoveToHistory(san, engine.turn === 'b');

    updateBoardHighlights();
    updateUI();

    if (status.isOver) {
      handleGameOver(status);
      return;
    }

    checkAndTriggerAi();
  }

  function checkAndTriggerAi() {
    const isAiTurn = (gameMode === 'pve-white' && engine.turn === 'b') ||
      (gameMode === 'pve-black' && engine.turn === 'w');

    if (isAiTurn) {
      isAiThinking = true;
      turnBannerEl.classList.add('thinking');
      turnTextEl.textContent = '帝国参谋军团正在推演破阵战术...';

      const thinkDelay = Math.random() * 350 + 400;
      setTimeout(() => {
        triggerAiMove();
      }, thinkDelay);
    }
  }

  function triggerAiMove() {
    const bestMove = ai.getBestMove(engine);
    if (!bestMove) return;

    if (bestMove.promo) {
      bestMove.promo = 'q';
    }

    const piece = engine.getPiece(bestMove.from.r, bestMove.from.c);
    const wasCapture = bestMove.isCapture;

    engine.makeMove(bestMove);
    lastMove = bestMove;
    isAiThinking = false;
    turnBannerEl.classList.remove('thinking');

    board3D.animatePieceMove(bestMove.from, bestMove.to, () => {
      if (bestMove.promo || bestMove.isCastling || bestMove.isEnPassant) {
        board3D.syncBoard(engine);
      }
    });

    if (wasCapture) {
      SoundFx.playCapture();
    } else {
      SoundFx.playMove();
    }

    afterMoveProcess(bestMove, piece);
  }

  function showPromotionModal(baseMove) {
    pendingPromotionMove = baseMove;
    const color = engine.turn;
    const choices = [
      { type: 'q', name: '王室王后 (Queen)' },
      { type: 'r', name: '攻城要塞 (Rook)' },
      { type: 'b', name: '圣殿大主教 (Bishop)' },
      { type: 'n', name: '皇家圣骑士 (Knight)' }
    ];

    promoChoicesEl.innerHTML = choices.map(ch => `
      <button class="choice-btn" data-type="${ch.type}">
        <div class="choice-icon">${PieceSVG.getSVG(ch.type, color)}</div>
        <span class="choice-label">${ch.name.split(' ')[0]}</span>
      </button>
    `).join('');

    promoChoicesEl.querySelectorAll('.choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        pendingPromotionMove.promo = type;
        promoModalEl.classList.add('hidden');
        SoundFx.playPromotion();
        executePlayerMove(pendingPromotionMove);
      });
    });

    promoModalEl.classList.remove('hidden');
  }

  function updateUI() {
    if (engine.turn === 'w') {
      turnBannerEl.className = 'turn-banner turn-white';
      turnTextEl.textContent = '圣狮王国 (白方) 回合，排兵布阵';
      panelWhiteEl.classList.add('active-turn');
      panelBlackEl.classList.remove('active-turn');
    } else {
      turnBannerEl.className = 'turn-banner turn-black';
      turnTextEl.textContent = '铁龙帝国 (黑方) 回合，铁骑突袭';
      panelBlackEl.classList.add('active-turn');
      panelWhiteEl.classList.remove('active-turn');
    }

    renderGraveyard();
  }

  function renderGraveyard() {
    graveyardWhiteEl.innerHTML = engine.capturedPieces.w.map(p => `
      <div class="graveyard-piece">${PieceSVG.getSVG(p.type, p.color)}</div>
    `).join('');

    graveyardBlackEl.innerHTML = engine.capturedPieces.b.map(p => `
      <div class="graveyard-piece">${PieceSVG.getSVG(p.type, p.color)}</div>
    `).join('');

    let whiteScore = 0, blackScore = 0;
    engine.capturedPieces.w.forEach(p => whiteScore += ChessAI.PIECE_VALUES[p.type] / 100);
    engine.capturedPieces.b.forEach(p => blackScore += ChessAI.PIECE_VALUES[p.type] / 100);

    const diff = whiteScore - blackScore;
    if (diff > 0) {
      advWhiteEl.textContent = `+${diff.toFixed(0)} 军力优势`;
      advBlackEl.textContent = '';
    } else if (diff < 0) {
      advBlackEl.textContent = `+${Math.abs(diff).toFixed(0)} 军力优势`;
      advWhiteEl.textContent = '';
    } else {
      advWhiteEl.textContent = '';
      advBlackEl.textContent = '';
    }
  }

  function recordMoveToHistory(san, isWhiteMove) {
    if (isWhiteMove) {
      const moveNum = engine.fullMoves - 1;
      const row = document.createElement('div');
      row.className = 'history-item';
      row.id = `history-row-${moveNum}`;
      row.innerHTML = `
        <span class="history-num">${moveNum}.</span>
        <span class="history-white">${san}</span>
        <span class="history-black"></span>
      `;
      if (moveHistoryEl.querySelector('.history-empty')) {
        moveHistoryEl.innerHTML = '';
      }
      moveHistoryEl.appendChild(row);
    } else {
      const moveNum = engine.fullMoves - 1;
      const row = document.getElementById(`history-row-${moveNum}`);
      if (row) {
        row.querySelector('.history-black').textContent = san;
      }
    }
    moveHistoryEl.scrollTop = moveHistoryEl.scrollHeight;
  }

  function handleGameOver(status) {
    clearInterval(timerInterval);
    SoundFx.playVictory();

    if (status.result === 'checkmate') {
      const isWhiteWinner = status.winner === 'w';
      gameoverTitleEl.textContent = isWhiteWinner ? '圣狮凯旋 · 将死！' : '铁龙横扫 · 将死！';
      gameoverReasonEl.textContent = isWhiteWinner 
        ? '圣狮白金骑士团攻陷了帝国中枢，赢得了辉煌凯旋！' 
        : '铁龙帝国重铠兵团踏平了圣殿王畿，统治了整片大陆！';
    } else {
      gameoverTitleEl.textContent = '双方息兵 · 和局';
      gameoverReasonEl.textContent = status.message;
    }

    gameoverStatsEl.textContent = `共历经 ${engine.fullMoves} 回合的沙盘铁血较量`;
    gameoverModalEl.classList.remove('hidden');

    // 向主网站平台同步战绩
    if (window.parent && window.parent !== window) {
      let winScore = 150;
      const isPlayerWinner = (gameMode === 'pve-white' && status.winner === 'w') || (gameMode === 'pve-black' && status.winner === 'b');
      if (isPlayerWinner) {
        winScore = 500 + Math.max(20, 200 - engine.fullMoves * 4);
      } else if (status.result === 'draw') {
        winScore = 200;
      } else {
        winScore = Math.min(100, engine.fullMoves * 5);
      }
      window.parent.postMessage({ type: "GAME_SCORE", score: winScore }, "*");
    }
  }

  function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (gameoverModalEl.classList.contains('hidden') === false) return;
      if (isAiThinking) return;

      const curTurn = engine.turn;
      if (timers[curTurn] > 0) {
        timers[curTurn]--;
        updateTimerDisplay();
      } else {
        clearInterval(timerInterval);
        handleGameOver({
          isOver: true,
          result: 'timeout',
          winner: curTurn === 'w' ? 'b' : 'w',
          message: `${curTurn === 'w' ? '白方' : '黑方'} 军令耗尽超时判负！`
        });
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    const format = (sec) => {
      const m = Math.floor(sec / 60).toString().padStart(2, '0');
      const s = (sec % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
    };
    timerWhiteEl.textContent = format(timers.w);
    timerBlackEl.textContent = format(timers.b);
  }

  // 视角控制按钮
  function setViewBtnActive(btn) {
    [btnCam3d, btnCamTop, btnCamCinema].forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
  }

  btnCam3d.addEventListener('click', () => {
    SoundFx.playClick();
    board3D.setCameraMode('3d');
    setViewBtnActive(btnCam3d);
  });

  btnCamTop.addEventListener('click', () => {
    SoundFx.playClick();
    board3D.setCameraMode('top');
    setViewBtnActive(btnCamTop);
  });

  btnCamCinema.addEventListener('click', () => {
    SoundFx.playClick();
    board3D.setCameraMode('cinema');
    setViewBtnActive(btnCamCinema);
  });

  btnCamReset.addEventListener('click', () => {
    SoundFx.playClick();
    board3D.updateCameraPosition();
  });

  // 操作控制按钮
  btnRestart.addEventListener('click', () => {
    SoundFx.playClick();
    initGame();
  });

  btnModalRestart.addEventListener('click', () => {
    gameoverModalEl.classList.add('hidden');
    initGame();
  });

  btnUndo.addEventListener('click', () => {
    if (isAiThinking) return;
    SoundFx.playClick();

    if (gameMode.startsWith('pve')) {
      engine.undoMove();
      engine.undoMove();
    } else {
      engine.undoMove();
    }

    lastMove = null;
    selectedSquare = null;
    legalMovesForSelected = [];
    board3D.syncBoard(engine);
    updateBoardHighlights();
    updateUI();
  });

  btnFlip.addEventListener('click', () => {
    SoundFx.playClick();
    isFlipped = !isFlipped;
    board3D.setFlipped(isFlipped);
  });

  btnSound.addEventListener('click', () => {
    const isEnabled = SoundFx.toggle();
    btnSound.innerHTML = `<span>${isEnabled ? '🎺 战号音效: 开' : '🔇 战号音效: 关'}</span>`;
  });

  modeSelectEl.addEventListener('change', (e) => {
    gameMode = e.target.value;
    isFlipped = (gameMode === 'pve-black');
    initGame();
  });

  diffSelectEl.addEventListener('change', (e) => {
    ai.setDifficulty(e.target.value);
  });

  // 启动战局
  initGame();
});
