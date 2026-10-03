/**
 * 深渊之弈 · 智能 AI 对弈引擎 (Minimax with Alpha-Beta Pruning & PST Evaluation)
 */
class ChessAI {
  constructor(difficulty = 2) {
    this.difficulty = parseInt(difficulty, 10) || 2;
  }

  setDifficulty(level) {
    this.difficulty = parseInt(level, 10);
  }

  // 基础子力价值
  static PIECE_VALUES = {
    p: 100,
    n: 320,
    b: 330,
    r: 500,
    q: 900,
    k: 20000
  };

  // 棋子位置评估表 (Piece-Square Tables, 面向白方，黑方翻转)
  static PST = {
    p: [
      [ 0,  0,  0,  0,  0,  0,  0,  0],
      [50, 50, 50, 50, 50, 50, 50, 50],
      [10, 10, 20, 30, 30, 20, 10, 10],
      [ 5,  5, 10, 25, 25, 10,  5,  5],
      [ 0,  0,  0, 20, 20,  0,  0,  0],
      [ 5, -5,-10,  0,  0,-10, -5,  5],
      [ 5, 10, 10,-20,-20, 10, 10,  5],
      [ 0,  0,  0,  0,  0,  0,  0,  0]
    ],
    n: [
      [-50,-40,-30,-30,-30,-30,-40,-50],
      [-40,-20,  0,  0,  0,  0,-20,-40],
      [-30,  0, 10, 15, 15, 10,  0,-30],
      [-30,  5, 15, 20, 20, 15,  5,-30],
      [-30,  0, 15, 20, 20, 15,  0,-30],
      [-30,  5, 10, 15, 15, 10,  5,-30],
      [-40,-20,  0,  5,  5,  0,-20,-40],
      [-50,-40,-30,-30,-30,-30,-40,-50]
    ],
    b: [
      [-20,-10,-10,-10,-10,-10,-10,-20],
      [-10,  0,  0,  0,  0,  0,  0,-10],
      [-10,  0,  5, 10, 10,  5,  0,-10],
      [-10,  5,  5, 10, 10,  5,  5,-10],
      [-10,  0, 10, 10, 10, 10,  0,-10],
      [-10, 10, 10, 10, 10, 10, 10,-10],
      [-10,  5,  0,  0,  0,  0,  5,-10],
      [-20,-10,-10,-10,-10,-10,-10,-20]
    ],
    r: [
      [ 0,  0,  0,  0,  0,  0,  0,  0],
      [ 5, 10, 10, 10, 10, 10, 10,  5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [ 0,  0,  0,  5,  5,  0,  0,  0]
    ],
    q: [
      [-20,-10,-10, -5, -5,-10,-10,-20],
      [-10,  0,  0,  0,  0,  0,  0,-10],
      [-10,  0,  5,  5,  5,  5,  0,-10],
      [ -5,  0,  5,  5,  5,  5,  0, -5],
      [  0,  0,  5,  5,  5,  5,  0, -5],
      [-10,  5,  5,  5,  5,  5,  0,-10],
      [-10,  0,  5,  0,  0,  0,  0,-10],
      [-20,-10,-10, -5, -5,-10,-10,-20]
    ],
    k: [
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-20,-30,-30,-40,-40,-30,-30,-20],
      [-10,-20,-20,-20,-20,-20,-20,-10],
      [ 20, 20,  0,  0,  0,  0, 20, 20],
      [ 20, 30, 10,  0,  0, 10, 30, 20]
    ]
  };

  // 评估当前棋盘分数（正数对白方有利，负数对黑方有利）
  evaluateBoard(engine) {
    let score = 0;
    const board = engine.board;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece) {
          const val = ChessAI.PIECE_VALUES[piece.type];
          // 白方直接查表，黑方查翻转坐标表
          const tableRow = piece.color === 'w' ? r : 7 - r;
          const pstVal = ChessAI.PST[piece.type][tableRow][c];

          const totalVal = val + pstVal;
          if (piece.color === 'w') {
            score += totalVal;
          } else {
            score -= totalVal;
          }
        }
      }
    }
    return score;
  }

  // 走法排序：优先评估吃子与升变，大幅提高剪枝效率
  orderMoves(moves, engine) {
    return moves.sort((a, b) => {
      let scoreA = 0, scoreB = 0;
      if (a.isCapture) {
        const targetA = engine.board[a.to.r][a.to.c];
        const pieceA = engine.board[a.from.r][a.from.c];
        scoreA += 10 * (targetA ? ChessAI.PIECE_VALUES[targetA.type] : 100) - (pieceA ? ChessAI.PIECE_VALUES[pieceA.type] : 0);
      }
      if (a.promo) scoreA += 800;

      if (b.isCapture) {
        const targetB = engine.board[b.to.r][b.to.c];
        const pieceB = engine.board[b.from.r][b.from.c];
        scoreB += 10 * (targetB ? ChessAI.PIECE_VALUES[targetB.type] : 100) - (pieceB ? ChessAI.PIECE_VALUES[pieceB.type] : 0);
      }
      if (b.promo) scoreB += 800;

      return scoreB - scoreA;
    });
  }

  // Minimax + Alpha-Beta 剪枝搜索
  minimax(engine, depth, alpha, beta, isMaximizing) {
    const status = engine.getGameStatus();
    if (status.isOver) {
      if (status.result === 'checkmate') {
        return isMaximizing ? -50000 - depth : 50000 + depth;
      }
      return 0; // 和棋
    }

    if (depth === 0) {
      return this.evaluateBoard(engine);
    }

    let legalMoves = engine.getAllLegalMoves(engine.turn);
    legalMoves = this.orderMoves(legalMoves, engine);

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const move of legalMoves) {
        const nextEngine = engine.clone();
        nextEngine.executeMoveInternal(move);
        const evalScore = this.minimax(nextEngine, depth - 1, alpha, beta, false);
        maxEval = Math.max(maxEval, evalScore);
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) break; // 剪枝
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of legalMoves) {
        const nextEngine = engine.clone();
        nextEngine.executeMoveInternal(move);
        const evalScore = this.minimax(nextEngine, depth - 1, alpha, beta, true);
        minEval = Math.min(minEval, evalScore);
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break; // 剪枝
      }
      return minEval;
    }
  }

  // 计算最佳走步
  getBestMove(engine) {
    const color = engine.turn;
    const isMaximizing = color === 'w';
    let legalMoves = engine.getAllLegalMoves(color);
    if (legalMoves.length === 0) return null;

    // 根据难度设定搜索深度
    let searchDepth = 2;
    if (this.difficulty === 1) searchDepth = 1;
    else if (this.difficulty === 2) searchDepth = 2;
    else if (this.difficulty === 3) searchDepth = 3;

    // 简单难度随机注入一定模糊度
    if (this.difficulty === 1 && Math.random() < 0.35) {
      const captures = legalMoves.filter(m => m.isCapture);
      if (captures.length > 0 && Math.random() < 0.6) {
        return captures[Math.floor(Math.random() * captures.length)];
      }
      return legalMoves[Math.floor(Math.random() * legalMoves.length)];
    }

    legalMoves = this.orderMoves(legalMoves, engine);

    let bestMove = legalMoves[0];
    let bestValue = isMaximizing ? -Infinity : Infinity;

    for (const move of legalMoves) {
      const nextEngine = engine.clone();
      nextEngine.executeMoveInternal(move);
      const evalScore = this.minimax(nextEngine, searchDepth - 1, -Infinity, Infinity, !isMaximizing);

      if (isMaximizing) {
        if (evalScore > bestValue) {
          bestValue = evalScore;
          bestMove = move;
        }
      } else {
        if (evalScore < bestValue) {
          bestValue = evalScore;
          bestMove = move;
        }
      }
    }

    return bestMove;
  }
}
