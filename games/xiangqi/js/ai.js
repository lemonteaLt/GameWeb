/**
 * 中国象棋 AI 引擎 (Web Worker 后台多线程计算 + Minimax + Alpha-Beta 剪枝 + 估值表)
 * 主线程零阻塞，保证玩家走棋滑行动画 100% 丝滑流畅
 */

// Worker 内部运行的完整 AI 代码字符串 (支持 file:/// 本地零配置直接加载)
const WORKER_CODE = `
// 基础子力价值 (Centipawns)
const PIECE_VALUES = {
  k: 10000,
  r: 950,
  c: 480,
  n: 430,
  b: 220,
  a: 220,
  p: 100
};

// 棋子位置价值修正表
const PST_ROOK = [
  [14, 14, 12, 18, 16, 18, 12, 14, 14],
  [16, 20, 18, 24, 26, 24, 18, 20, 16],
  [12, 12, 12, 18, 18, 18, 12, 12, 12],
  [12, 18, 16, 22, 22, 22, 16, 18, 12],
  [12, 14, 12, 18, 18, 18, 12, 14, 12],
  [12, 16, 14, 18, 20, 18, 14, 16, 12],
  [6, 10, 8, 14, 14, 14, 8, 10, 6],
  [4, 8, 6, 14, 12, 14, 6, 8, 4],
  [8, 4, 8, 16, 8, 16, 8, 4, 8],
  [-2, 10, 6, 14, 12, 14, 6, 10, -2]
];

const PST_KNIGHT = [
  [4, 8, 16, 12, 4, 12, 16, 8, 4],
  [4, 10, 28, 16, 8, 16, 28, 10, 4],
  [12, 14, 18, 20, 16, 20, 18, 14, 12],
  [8, 24, 18, 24, 20, 24, 18, 24, 8],
  [6, 16, 14, 18, 16, 18, 14, 16, 6],
  [4, 12, 16, 14, 12, 14, 16, 12, 4],
  [2, 6, 8, 6, 10, 6, 8, 6, 2],
  [4, 2, 8, 8, 4, 8, 8, 2, 4],
  [0, 2, 4, 4, -2, 4, 4, 2, 0],
  [0, -4, 0, 0, 0, 0, 0, -4, 0]
];

const PST_CANNON = [
  [6, 4, 0, -10, -12, -10, 0, 4, 6],
  [2, 2, 0, -4, -14, -4, 0, 2, 2],
  [2, 2, 0, -10, -8, -10, 0, 2, 2],
  [0, 0, -2, 4, 10, 4, -2, 0, 0],
  [0, 0, 0, 2, 8, 2, 0, 0, 0],
  [-2, 0, 4, 2, 6, 2, 4, 0, -2],
  [0, 0, 0, 2, 4, 2, 0, 0, 0],
  [4, 0, 4, 0, 6, 0, 4, 0, 4],
  [0, 0, 0, 2, 4, 2, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0]
];

const PST_PAWN = [
  [0, 3, 6, 9, 12, 9, 6, 3, 0],
  [18, 36, 56, 80, 100, 80, 56, 36, 18],
  [14, 26, 42, 60, 80, 60, 42, 26, 14],
  [10, 20, 30, 34, 40, 34, 30, 20, 10],
  [6, 12, 18, 18, 20, 18, 18, 12, 6],
  [2, 0, 8, 0, 8, 0, 8, 0, 2],
  [0, 0, -2, 0, 4, 0, -2, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0]
];

// 规则辅助函数
function inBounds(r, c) {
  return r >= 0 && r <= 9 && c >= 0 && c <= 8;
}

function inPalace(r, c, side) {
  if (c < 3 || c > 5) return false;
  return side === 'r' ? (r >= 7 && r <= 9) : (r >= 0 && r <= 2);
}

function cloneBoard(board) {
  return board.map(row => row.map(cell => (cell ? { ...cell } : null)));
}

function getPseudoMoves(board, r, c) {
  const piece = board[r][c];
  if (!piece) return [];
  const { side, type } = piece;
  const moves = [];

  const addMove = (tr, tc) => {
    if (!inBounds(tr, tc)) return;
    const target = board[tr][tc];
    if (!target) {
      moves.push({ from: { r, c }, to: { r: tr, c: tc }, captured: null });
    } else if (target.side !== side) {
      moves.push({ from: { r, c }, to: { r: tr, c: tc }, captured: target });
    }
  };

  switch (type) {
    case 'k': {
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (inPalace(nr, nc, side)) addMove(nr, nc);
      }
      break;
    }
    case 'a': {
      const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (inPalace(nr, nc, side)) addMove(nr, nc);
      }
      break;
    }
    case 'b': {
      const steps = [
        { dr: -2, dc: -2, eyeR: -1, eyeC: -1 },
        { dr: -2, dc: 2, eyeR: -1, eyeC: 1 },
        { dr: 2, dc: -2, eyeR: 1, eyeC: -1 },
        { dr: 2, dc: 2, eyeR: 1, eyeC: 1 }
      ];
      for (const s of steps) {
        const nr = r + s.dr, nc = c + s.dc;
        if (side === 'r' && nr < 5) continue;
        if (side === 'b' && nr > 4) continue;
        if (!inBounds(nr, nc)) continue;
        if (!board[r + s.eyeR][c + s.eyeC]) addMove(nr, nc);
      }
      break;
    }
    case 'n': {
      const horseMoves = [
        { dr: -2, dc: -1, legR: -1, legC: 0 },
        { dr: -2, dc: 1, legR: -1, legC: 0 },
        { dr: 2, dc: -1, legR: 1, legC: 0 },
        { dr: 2, dc: 1, legR: 1, legC: 0 },
        { dr: -1, dc: -2, legR: 0, legC: -1 },
        { dr: 1, dc: -2, legR: 0, legC: -1 },
        { dr: -1, dc: 2, legR: 0, legC: 1 },
        { dr: 1, dc: 2, legR: 0, legC: 1 }
      ];
      for (const hm of horseMoves) {
        const nr = r + hm.dr, nc = c + hm.dc;
        if (!inBounds(nr, nc)) continue;
        if (!board[r + hm.legR][c + hm.legC]) addMove(nr, nc);
      }
      break;
    }
    case 'r': {
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of dirs) {
        let step = 1;
        while (true) {
          const nr = r + dr * step, nc = c + dc * step;
          if (!inBounds(nr, nc)) break;
          const target = board[nr][nc];
          if (!target) {
            addMove(nr, nc);
          } else {
            if (target.side !== side) addMove(nr, nc);
            break;
          }
          step++;
        }
      }
      break;
    }
    case 'c': {
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of dirs) {
        let step = 1;
        let jumped = false;
        while (true) {
          const nr = r + dr * step, nc = c + dc * step;
          if (!inBounds(nr, nc)) break;
          const target = board[nr][nc];
          if (!jumped) {
            if (!target) addMove(nr, nc);
            else jumped = true;
          } else {
            if (target) {
              if (target.side !== side) addMove(nr, nc);
              break;
            }
          }
          step++;
        }
      }
      break;
    }
    case 'p': {
      const forwardDir = side === 'r' ? -1 : 1;
      const crossedRiver = side === 'r' ? r <= 4 : r >= 5;
      const fr = r + forwardDir;
      if (inBounds(fr, c)) addMove(fr, c);
      if (crossedRiver) {
        if (inBounds(r, c - 1)) addMove(r, c - 1);
        if (inBounds(r, c + 1)) addMove(r, c + 1);
      }
      break;
    }
  }
  return moves;
}

function findKing(board, side) {
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (p && p.side === side && p.type === 'k') return { r, c };
    }
  }
  return null;
}

function areKingsFacing(board) {
  const rk = findKing(board, 'r');
  const bk = findKing(board, 'b');
  if (!rk || !bk || rk.c !== bk.c) return false;
  const col = rk.c;
  const minR = Math.min(rk.r, bk.r);
  const maxR = Math.max(rk.r, bk.r);
  for (let r = minR + 1; r < maxR; r++) {
    if (board[r][col] !== null) return false;
  }
  return true;
}

function isKingInCheck(board, side) {
  const kingPos = findKing(board, side);
  if (!kingPos) return true;
  const enemySide = side === 'r' ? 'b' : 'r';
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (p && p.side === enemySide) {
        const pMoves = getPseudoMoves(board, r, c);
        if (pMoves.some(m => m.to.r === kingPos.r && m.to.c === kingPos.c)) {
          return true;
        }
      }
    }
  }
  return false;
}

function makeMove(board, move) {
  const next = cloneBoard(board);
  next[move.to.r][move.to.c] = next[move.from.r][move.from.c];
  next[move.from.r][move.from.c] = null;
  return next;
}

function isLegal(board, move, side) {
  const next = makeMove(board, move);
  if (areKingsFacing(next)) return false;
  if (isKingInCheck(next, side)) return false;
  return true;
}

function getAllLegal(board, side) {
  const moves = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (p && p.side === side) {
        const pm = getPseudoMoves(board, r, c);
        for (const m of pm) {
          if (isLegal(board, m, side)) moves.push(m);
        }
      }
    }
  }
  return moves;
}

function evaluate(board, side) {
  let redScore = 0;
  let blackScore = 0;

  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (!p) continue;

      const val = PIECE_VALUES[p.type] || 0;
      let bonus = 0;

      if (p.side === 'r') {
        if (p.type === 'r') bonus = PST_ROOK[r][c];
        else if (p.type === 'n') bonus = PST_KNIGHT[r][c];
        else if (p.type === 'c') bonus = PST_CANNON[r][c];
        else if (p.type === 'p') bonus = PST_PAWN[r][c];
        redScore += val + bonus;
      } else {
        const flipR = 9 - r;
        if (p.type === 'r') bonus = PST_ROOK[flipR][c];
        else if (p.type === 'n') bonus = PST_KNIGHT[flipR][c];
        else if (p.type === 'c') bonus = PST_CANNON[flipR][c];
        else if (p.type === 'p') bonus = PST_PAWN[flipR][c];
        blackScore += val + bonus;
      }
    }
  }

  const total = redScore - blackScore;
  return side === 'r' ? total : -total;
}

function sortMoves(board, moves) {
  return moves.sort((a, b) => {
    let scoreA = 0, scoreB = 0;
    if (a.captured) {
      scoreA = (PIECE_VALUES[a.captured.type] || 0) * 10 - (PIECE_VALUES[board[a.from.r][a.from.c]?.type] || 0);
    }
    if (b.captured) {
      scoreB = (PIECE_VALUES[b.captured.type] || 0) * 10 - (PIECE_VALUES[board[b.from.r][b.from.c]?.type] || 0);
    }
    return scoreB - scoreA;
  });
}

// 置换表与记忆哈希缓存 (Transposition Table)
const TT_EXACT = 0;
const TT_LOWER = 1;
const TT_UPPER = 2;
let ttMap = new Map();

function getBoardHash(board, side) {
  let hash = side === 'r' ? 'R:' : 'B:';
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (p) hash += `${r}${c}${p.side}${p.type}|`;
    }
  }
  return hash;
}

function quiescence(board, alpha, beta, side, depth = 2) {
  const standPat = evaluate(board, side);
  if (standPat >= beta) return beta;
  if (alpha < standPat) alpha = standPat;
  if (depth <= 0) return standPat;

  const moves = getAllLegal(board, side).filter(m => m.captured !== null);
  sortMoves(board, moves);

  const enemy = side === 'r' ? 'b' : 'r';
  for (let i = 0; i < moves.length; i++) {
    const next = makeMove(board, moves[i]);
    const score = -quiescence(next, -beta, -alpha, enemy, depth - 1);
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function minimax(board, depth, alpha, beta, side, maxDepth) {
  const alphaOrig = alpha;
  const hashKey = getBoardHash(board, side);
  const ttEntry = ttMap.get(hashKey);

  if (ttEntry && ttEntry.depth >= depth) {
    if (ttEntry.flag === TT_EXACT) return ttEntry.score;
    else if (ttEntry.flag === TT_LOWER) alpha = Math.max(alpha, ttEntry.score);
    else if (ttEntry.flag === TT_UPPER) beta = Math.min(beta, ttEntry.score);
    if (alpha >= beta) return ttEntry.score;
  }

  if (depth === 0) {
    const evalScore = quiescence(board, alpha, beta, side, 2);
    return evalScore;
  }

  const enemy = side === 'r' ? 'b' : 'r';
  const moves = getAllLegal(board, side);

  if (moves.length === 0) {
    return isKingInCheck(board, side) ? (-99999 + (maxDepth - depth)) : -50000;
  }

  sortMoves(board, moves);

  let bestScore = -Infinity;
  for (let i = 0; i < moves.length; i++) {
    const next = makeMove(board, moves[i]);
    const score = -minimax(next, depth - 1, -beta, -alpha, enemy, maxDepth);
    if (score > bestScore) bestScore = score;
    if (score > alpha) alpha = score;
    if (score >= beta) break; // Alpha-Beta 剪枝
  }

  // 记录置换表
  let flag = TT_EXACT;
  if (bestScore <= alphaOrig) flag = TT_UPPER;
  else if (bestScore >= beta) flag = TT_LOWER;

  if (ttMap.size < 50000) {
    ttMap.set(hashKey, { depth, score: bestScore, flag });
  }

  return bestScore;
}

function searchBestMove(board, side, difficulty) {
  ttMap.clear(); // 每一回合清空局部置换表
  const moves = getAllLegal(board, side);
  if (moves.length === 0) return null;

  let searchDepth = 3;
  let randomFactor = 0;

  if (difficulty === 'easy') {
    searchDepth = 1;
    randomFactor = 40;
  } else if (difficulty === 'medium') {
    searchDepth = 3;
    randomFactor = 6;
  } else if (difficulty === 'hard') {
    searchDepth = 4;
    randomFactor = 0;
  }

  sortMoves(board, moves);

  let bestMove = moves[0];
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;
  const enemy = side === 'r' ? 'b' : 'r';

  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    const next = makeMove(board, m);
    let score = -minimax(next, searchDepth - 1, -beta, -alpha, enemy, searchDepth);
    if (randomFactor > 0) {
      score += (Math.random() * 2 - 1) * randomFactor;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMove = m;
    }
    if (score > alpha) {
      alpha = score;
    }
  }

  return bestMove;
}

// 接收主线程消息
self.onmessage = function(e) {
  const { id, board, side, difficulty } = e.data;
  const move = searchBestMove(board, side, difficulty);
  self.postMessage({ id, move });
};
`;

class ChessAI {
  static worker = null;
  static pendingRequests = new Map();
  static requestId = 0;

  /**
   * 初始化 Web Worker
   */
  static getWorker() {
    if (!this.worker) {
      try {
        const blob = new Blob([WORKER_CODE], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        this.worker = new Worker(workerUrl);

        this.worker.onmessage = (e) => {
          const { id, move } = e.data;
          const resolve = this.pendingRequests.get(id);
          if (resolve) {
            this.pendingRequests.delete(id);
            resolve(move);
          }
        };

        this.worker.onerror = (err) => {
          console.warn('AI Worker error, fallback to sync mode', err);
        };
      } catch (err) {
        console.warn('Worker initialization failed, fallback active', err);
      }
    }
    return this.worker;
  }

  /**
   * 异步思考并返回最佳走法 (主线程 100% 零卡顿)
   */
  static getBestMove(board, side, difficulty = 'medium') {
    return new Promise(resolve => {
      const worker = this.getWorker();

      if (worker) {
        const reqId = ++this.requestId;
        this.pendingRequests.set(reqId, resolve);
        worker.postMessage({
          id: reqId,
          board,
          side,
          difficulty
        });
      } else {
        // Fallback for environments without Web Worker
        setTimeout(() => {
          const moves = ChessRules.getAllLegalMoves(board, side);
          if (moves.length === 0) {
            resolve(null);
            return;
          }
          const chosen = moves[Math.floor(Math.random() * moves.length)];
          resolve(chosen);
        }, 100);
      }
    });
  }
}

window.ChessAI = ChessAI;
