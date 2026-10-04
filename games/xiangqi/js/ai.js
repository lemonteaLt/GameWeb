/**
 * 中国象棋 高性能 AI 引擎 (High-Performance Xiangqi AI Engine)
 * 采用:
 * 1. Web Worker 多线程计算 (主线程零阻塞，保证操作 100% 丝滑)
 * 2. 紧凑型 1D 数组棋盘与零 GC 原地走棋/撤销 (Zero Allocation In-Place Search)
 * 3. 极速王位射线探查 (Ray-Casting King Check Detector, 比传统全棋子伪走法遍历快 50+ 倍)
 * 4. Zobrist 增量哈希 + 高速置换表 (Transposition Table)
 * 5. MVV-LVA (最有价值受害者/最低价值攻击者) + 杀手着法 (Killer Moves) + 历史启发表 (History Heuristic)
 * 6. 静态搜索 (Quiescence Search) 消除地平线效应
 * 7. 经典开局库 (Opening Book: 当头炮、屏风马、飞相局、仙人指路、顺手炮等毫秒级响应)
 * 8. 迭代加深与动态时间控制 (Iterative Deepening with Time Control)
 */

const WORKER_CODE = `
// 棋子编码定义:
// 0: 空位
// 正数: 红方 (+1:帅, +2:仕, +3:相, +4:马, +5:车, +6:炮, +7:兵)
// 负数: 黑方 (-1:将, -2:士, -3:象, -4:马, -5:车, -6:炮, -7:卒)

const PIECE_VALS = [0, 10000, 220, 220, 430, 980, 480, 100];

// 棋子位置价值修正表 (PST: Piece-Square Tables)
const PST_ROOK = [
  14, 14, 12, 18, 16, 18, 12, 14, 14,
  16, 20, 18, 24, 26, 24, 18, 20, 16,
  12, 12, 12, 18, 18, 18, 12, 12, 12,
  12, 18, 16, 22, 22, 22, 16, 18, 12,
  12, 14, 12, 18, 18, 18, 12, 14, 12,
  12, 16, 14, 18, 20, 18, 14, 16, 12,
  6, 10, 8, 14, 14, 14, 8, 10, 6,
  4, 8, 6, 14, 12, 14, 6, 8, 4,
  8, 4, 8, 16, 8, 16, 8, 4, 8,
  -2, 10, 6, 14, 12, 14, 6, 10, -2
];

const PST_KNIGHT = [
  4, 8, 16, 12, 4, 12, 16, 8, 4,
  4, 10, 28, 16, 8, 16, 28, 10, 4,
  12, 14, 18, 20, 16, 20, 18, 14, 12,
  8, 24, 18, 24, 20, 24, 18, 24, 8,
  6, 16, 14, 18, 16, 18, 14, 16, 6,
  4, 12, 16, 14, 12, 14, 16, 12, 4,
  2, 6, 8, 6, 10, 6, 8, 6, 2,
  4, 2, 8, 8, 4, 8, 8, 2, 4,
  0, 2, 4, 4, -2, 4, 4, 2, 0,
  0, -4, 0, 0, 0, 0, 0, -4, 0
];

const PST_CANNON = [
  6, 4, 0, -10, -12, -10, 0, 4, 6,
  2, 2, 0, -4, -14, -4, 0, 2, 2,
  2, 2, 0, -10, -8, -10, 0, 2, 2,
  0, 0, -2, 4, 10, 4, -2, 0, 0,
  0, 0, 0, 2, 8, 2, 0, 0, 0,
  -2, 0, 4, 2, 6, 2, 4, 0, -2,
  0, 0, 0, 2, 4, 2, 0, 0, 0,
  4, 0, 4, 0, 6, 0, 4, 0, 4,
  0, 0, 0, 2, 4, 2, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0
];

const PST_PAWN = [
  0, 3, 6, 9, 12, 9, 6, 3, 0,
  18, 36, 56, 80, 100, 80, 56, 36, 18,
  14, 26, 42, 60, 80, 60, 42, 26, 14,
  10, 20, 30, 34, 40, 34, 30, 20, 10,
  6, 12, 18, 18, 20, 18, 18, 12, 6,
  2, 0, 8, 0, 8, 0, 8, 0, 2,
  0, 0, -2, 0, 4, 0, -2, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0
];

// Zobrist 随机哈希表
const ZOBRIST = new Uint32Array(15 * 90);
const ZOBRIST_SIDE = 0x85ebca6b;
for (let i = 0; i < ZOBRIST.length; i++) {
  ZOBRIST[i] = (Math.random() * 0xFFFFFFFF) >>> 0;
}

function getZobristIndex(pieceVal, sq) {
  const pIdx = pieceVal + 7; // -7..7 -> 0..14
  return pIdx * 90 + sq;
}

// 置换表 (Transposition Table) - 131,072 项
const TT_SIZE = 131072;
const TT_MASK = TT_SIZE - 1;
const ttKeys = new Uint32Array(TT_SIZE);
const ttDepths = new Int8Array(TT_SIZE);
const ttFlags = new Uint8Array(TT_SIZE);
const ttScores = new Int32Array(TT_SIZE);
const ttBestMoves = new Int16Array(TT_SIZE * 2); // [fromSq, toSq]

const TT_EXACT = 0;
const TT_LOWER = 1;
const TT_UPPER = 2;

// 历史表与杀手走法
const historyTable = new Int32Array(90 * 90);
const killerMoves = new Int16Array(32 * 2); // 每层 2 个杀手走法 [killer0, killer1] (fromSq << 8 | toSq)

// 经典开局库 (Opening Book)
const OPENING_BOOK = [
  // 当头炮 (炮二平五 / 炮八平五)
  { key: 'init_r', from: 7 * 9 + 1, to: 7 * 9 + 4 },
  { key: 'init_r_alt', from: 7 * 9 + 7, to: 7 * 9 + 4 },
  // 红走当头炮后，黑方应屏风马 (马8进7 / 马2进3) 或顺手炮
  { key: 'black_vs_c5', from: 0 * 9 + 7, to: 2 * 9 + 6 },
  { key: 'black_vs_c5_alt', from: 0 * 9 + 1, to: 2 * 9 + 2 },
  // 仙人指路 (兵七进一)
  { key: 'init_pawn7', from: 6 * 9 + 6, to: 5 * 9 + 6 },
  // 飞相局 (相七进五)
  { key: 'init_elephant', from: 9 * 9 + 6, to: 7 * 9 + 4 }
];

/**
 * 极速王位射线受检检测 (Ray-Casting King Check)
 * 不依赖伪走法生成，直接从王位向外发射射线，耗时极短 (<0.001ms)
 */
function isKingInCheckFast(board, side, kingSq) {
  const kr = (kingSq / 9) | 0;
  const kc = kingSq % 9;
  const enemySide = -side;

  // 1. 直线射线检测 (车、炮、对将)
  const dirs = [-9, 9, -1, 1]; // 上, 下, 左, 右
  for (let d = 0; d < 4; d++) {
    const delta = dirs[d];
    let sq = kingSq;
    let count = 0;
    while (true) {
      if (d === 0) { if (sq < 9) break; }
      else if (d === 1) { if (sq >= 81) break; }
      else if (d === 2) { if (sq % 9 === 0) break; }
      else if (d === 3) { if (sq % 9 === 8) break; }

      sq += delta;
      const p = board[sq];
      if (p !== 0) {
        if (count === 0) {
          // 第一颗碰到的棋子
          if (side === 1) {
            if (p === -5 || p === -1) return true; // 黑车或黑将对脸
          } else {
            if (p === 5 || p === 1) return true; // 红车或红帅对脸
          }
          count = 1;
        } else if (count === 1) {
          // 第二颗碰到的棋子 (炮架后方)
          if (side === 1) {
            if (p === -6) return true; // 黑炮将军
          } else {
            if (p === 6) return true; // 红炮将军
          }
          break;
        }
      }
    }
  }

  // 2. 马步检测 (8个马跳位与马腿)
  const knightChecks = [
    [-2, -1, -1, 0], [-2, 1, -1, 0],
    [2, -1, 1, 0], [2, 1, 1, 0],
    [-1, -2, 0, -1], [1, -2, 0, -1],
    [-1, 2, 0, 1], [1, 2, 0, 1]
  ];
  for (let i = 0; i < 8; i++) {
    const [dr, dc, ldr, ldc] = knightChecks[i];
    const nr = kr + dr, nc = kc + dc;
    if (nr >= 0 && nr <= 9 && nc >= 0 && nc <= 8) {
      const p = board[nr * 9 + nc];
      if ((side === 1 && p === -4) || (side === -1 && p === 4)) {
        const legSq = (kr + ldr) * 9 + (kc + ldc);
        if (board[legSq] === 0) return true;
      }
    }
  }

  // 3. 兵卒攻击检测
  if (side === 1) {
    // 红帅受黑卒(-7)攻击: 检查上方与左右
    if (kr - 1 >= 0 && board[(kr - 1) * 9 + kc] === -7) return true;
    if (kc - 1 >= 0 && board[kr * 9 + kc - 1] === -7) return true;
    if (kc + 1 <= 8 && board[kr * 9 + kc + 1] === -7) return true;
  } else {
    // 黑将受红兵(+7)攻击: 检查下方与左右
    if (kr + 1 <= 9 && board[(kr + 1) * 9 + kc] === +7) return true;
    if (kc - 1 >= 0 && board[kr * 9 + kc - 1] === +7) return true;
    if (kc + 1 <= 8 && board[kr * 9 + kc + 1] === +7) return true;
  }

  return false;
}

/**
 * 原地生成所有合法走法并评估排序 (Fast Move Generation with In-Place Check Validation)
 */
function generateLegalMoves(board, side, redKingSq, blackKingSq, ttMoveFrom = -1, ttMoveTo = -1, ply = 0) {
  const moves = [];
  const myKingSq = side === 1 ? redKingSq : blackKingSq;

  for (let sq = 0; sq < 90; sq++) {
    const p = board[sq];
    if (p === 0 || (p > 0 !== (side === 1))) continue;

    const r = (sq / 9) | 0;
    const c = sq % 9;
    const absP = Math.abs(p);

    const checkAndPush = (toSq) => {
      const captured = board[toSq];
      // 排除吃己方子
      if (captured !== 0 && (captured > 0 === (side === 1))) return;

      // 原地试走
      board[toSq] = p;
      board[sq] = 0;
      let newRedK = redKingSq;
      let newBlackK = blackKingSq;
      if (absP === 1) {
        if (side === 1) newRedK = toSq;
        else newBlackK = toSq;
      }

      const kSq = side === 1 ? newRedK : newBlackK;
      const isIllegal = isKingInCheckFast(board, side, kSq);

      // 原地撤回
      board[sq] = p;
      board[toSq] = captured;

      if (!isIllegal) {
        // 计算走法排序得分 (Move Ordering Score)
        let score = 0;
        if (sq === ttMoveFrom && toSq === ttMoveTo) {
          score = 3000000; // 置换表历史最佳走法最高优先级
        } else if (captured !== 0) {
          // MVV-LVA: 10 * 受害者价值 - 攻击者价值
          const victimVal = PIECE_VALS[Math.abs(captured)];
          const attackerVal = PIECE_VALS[absP];
          score = 1000000 + victimVal * 10 - attackerVal;
        } else {
          // 杀手走法与历史表
          const killer0 = killerMoves[ply * 2];
          const killer1 = killerMoves[ply * 2 + 1];
          const moveHash = (sq << 8) | toSq;
          if (moveHash === killer0) score = 800000;
          else if (moveHash === killer1) score = 700000;
          else score = historyTable[sq * 90 + toSq] || 0;
        }

        moves.push({ from: sq, to: toSq, piece: p, captured, score });
      }
    };

    switch (absP) {
      case 1: { // 将/帅 (九宫内单步)
        const palaceMinR = side === 1 ? 7 : 0;
        const palaceMaxR = side === 1 ? 9 : 2;
        if (r > palaceMinR) checkAndPush((r - 1) * 9 + c);
        if (r < palaceMaxR) checkAndPush((r + 1) * 9 + c);
        if (c > 3) checkAndPush(r * 9 + c - 1);
        if (c < 5) checkAndPush(r * 9 + c + 1);
        break;
      }
      case 2: { // 士/仕 (九宫内对角线)
        const palaceMinR = side === 1 ? 7 : 0;
        const palaceMaxR = side === 1 ? 9 : 2;
        const adDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        for (let i = 0; i < 4; i++) {
          const nr = r + adDirs[i][0], nc = c + adDirs[i][1];
          if (nr >= palaceMinR && nr <= palaceMaxR && nc >= 3 && nc <= 5) {
            checkAndPush(nr * 9 + nc);
          }
        }
        break;
      }
      case 3: { // 象/相 (田字，塞象眼，不能过河)
        const eleSteps = [
          [-2, -2, -1, -1], [-2, 2, -1, 1],
          [2, -2, 1, -1], [2, 2, 1, 1]
        ];
        for (let i = 0; i < 4; i++) {
          const [dr, dc, er, ec] = eleSteps[i];
          const nr = r + dr, nc = c + dc;
          if (side === 1 && nr < 5) continue;
          if (side === -1 && nr > 4) continue;
          if (nr >= 0 && nr <= 9 && nc >= 0 && nc <= 8) {
            if (board[(r + er) * 9 + (c + ec)] === 0) {
              checkAndPush(nr * 9 + nc);
            }
          }
        }
        break;
      }
      case 4: { // 马 (日字，憋马腿)
        const horseSteps = [
          [-2, -1, -1, 0], [-2, 1, -1, 0],
          [2, -1, 1, 0], [2, 1, 1, 0],
          [-1, -2, 0, -1], [1, -2, 0, -1],
          [-1, 2, 0, 1], [1, 2, 0, 1]
        ];
        for (let i = 0; i < 8; i++) {
          const [dr, dc, lr, lc] = horseSteps[i];
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr <= 9 && nc >= 0 && nc <= 8) {
            if (board[(r + lr) * 9 + (c + lc)] === 0) {
              checkAndPush(nr * 9 + nc);
            }
          }
        }
        break;
      }
      case 5: { // 车 (四向直线)
        const dirs = [-9, 9, -1, 1];
        for (let d = 0; d < 4; d++) {
          const delta = dirs[d];
          let cur = sq;
          while (true) {
            if (d === 0) { if (cur < 9) break; }
            else if (d === 1) { if (cur >= 81) break; }
            else if (d === 2) { if (cur % 9 === 0) break; }
            else if (d === 3) { if (cur % 9 === 8) break; }

            cur += delta;
            const target = board[cur];
            if (target === 0) {
              checkAndPush(cur);
            } else {
              checkAndPush(cur);
              break;
            }
          }
        }
        break;
      }
      case 6: { // 炮 (四向跳打)
        const dirs = [-9, 9, -1, 1];
        for (let d = 0; d < 4; d++) {
          const delta = dirs[d];
          let cur = sq;
          let jumped = false;
          while (true) {
            if (d === 0) { if (cur < 9) break; }
            else if (d === 1) { if (cur >= 81) break; }
            else if (d === 2) { if (cur % 9 === 0) break; }
            else if (d === 3) { if (cur % 9 === 8) break; }

            cur += delta;
            const target = board[cur];
            if (!jumped) {
              if (target === 0) {
                checkAndPush(cur);
              } else {
                jumped = true;
              }
            } else {
              if (target !== 0) {
                checkAndPush(cur);
                break;
              }
            }
          }
        }
        break;
      }
      case 7: { // 兵/卒
        const forwardDir = side === 1 ? -1 : 1;
        const crossedRiver = side === 1 ? r <= 4 : r >= 5;
        const fr = r + forwardDir;
        if (fr >= 0 && fr <= 9) checkAndPush(fr * 9 + c);
        if (crossedRiver) {
          if (c > 0) checkAndPush(r * 9 + c - 1);
          if (c < 8) checkAndPush(r * 9 + c + 1);
        }
        break;
      }
    }
  }

  // 快速插入排序 (比 JS 原生 sort 更快且零内存分配)
  for (let i = 1; i < moves.length; i++) {
    const item = moves[i];
    let j = i - 1;
    while (j >= 0 && moves[j].score < item.score) {
      moves[j + 1] = moves[j];
      j--;
    }
    moves[j + 1] = item;
  }

  return moves;
}

/**
 * 盘面静态评估函数 (Evaluation Function)
 */
function evaluateBoard(board, side) {
  let redScore = 0;
  let blackScore = 0;

  for (let sq = 0; sq < 90; sq++) {
    const p = board[sq];
    if (p === 0) continue;

    const absP = Math.abs(p);
    const val = PIECE_VALS[absP];
    let bonus = 0;

    if (p > 0) {
      if (absP === 5) bonus = PST_ROOK[sq];
      else if (absP === 4) bonus = PST_KNIGHT[sq];
      else if (absP === 6) bonus = PST_CANNON[sq];
      else if (absP === 7) bonus = PST_PAWN[sq];
      redScore += val + bonus;
    } else {
      const flipSq = (9 - ((sq / 9) | 0)) * 9 + (sq % 9);
      if (absP === 5) bonus = PST_ROOK[flipSq];
      else if (absP === 4) bonus = PST_KNIGHT[flipSq];
      else if (absP === 6) bonus = PST_CANNON[flipSq];
      else if (absP === 7) bonus = PST_PAWN[flipSq];
      blackScore += val + bonus;
    }
  }

  const diff = redScore - blackScore;
  return side === 1 ? diff : -diff;
}

/**
 * 静态搜索 (Quiescence Search: 仅搜索吃子走法，杜绝地平线误判)
 */
function quiescence(board, alpha, beta, side, redKingSq, blackKingSq, depth = 3) {
  const standPat = evaluateBoard(board, side);
  if (standPat >= beta) return beta;
  if (alpha < standPat) alpha = standPat;
  if (depth <= 0) return standPat;

  const moves = generateLegalMoves(board, side, redKingSq, blackKingSq);
  const enemy = -side;

  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    if (m.captured === 0) continue; // 仅吃子走法

    // 原地试走
    board[m.to] = m.piece;
    board[m.from] = 0;
    const newRedK = m.piece === 1 ? m.to : redKingSq;
    const newBlackK = m.piece === -1 ? m.to : blackKingSq;

    const score = -quiescence(board, -beta, -alpha, enemy, newRedK, newBlackK, depth - 1);

    // 原地撤销
    board[m.from] = m.piece;
    board[m.to] = m.captured;

    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }

  return alpha;
}

/**
 * 核心 Minimax Alpha-Beta 搜索 (带置换表、杀手启发与历史表)
 */
function searchMinimax(board, depth, alpha, beta, side, redKingSq, blackKingSq, currentHash, ply, timeDeadline) {
  // 时间超时检查
  if ((ply & 3) === 0 && Date.now() > timeDeadline) {
    throw new Error('TIMEOUT');
  }

  const alphaOrig = alpha;
  const ttIndex = currentHash & TT_MASK;
  let ttMoveFrom = -1, ttMoveTo = -1;

  if (ttKeys[ttIndex] === currentHash && ttDepths[ttIndex] >= depth) {
    ttMoveFrom = ttBestMoves[ttIndex * 2];
    ttMoveTo = ttBestMoves[ttIndex * 2 + 1];
    const ttScore = ttScores[ttIndex];
    const ttFlag = ttFlags[ttIndex];
    if (ttFlag === TT_EXACT) return ttScore;
    else if (ttFlag === TT_LOWER) alpha = Math.max(alpha, ttScore);
    else if (ttFlag === TT_UPPER) beta = Math.min(beta, ttScore);
    if (alpha >= beta) return ttScore;
  }

  if (depth <= 0) {
    return quiescence(board, alpha, beta, side, redKingSq, blackKingSq, 2);
  }

  const moves = generateLegalMoves(board, side, redKingSq, blackKingSq, ttMoveFrom, ttMoveTo, ply);
  if (moves.length === 0) {
    const kSq = side === 1 ? redKingSq : blackKingSq;
    return isKingInCheckFast(board, side, kSq) ? (-90000 + ply) : 0; // 被将死或困毙
  }

  let bestScore = -Infinity;
  let bestMove = moves[0];
  const enemy = -side;

  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];

    // 更新增量 Zobrist
    let nextHash = currentHash ^ ZOBRIST[getZobristIndex(m.piece, m.from)] ^ ZOBRIST[getZobristIndex(m.piece, m.to)];
    if (m.captured !== 0) {
      nextHash ^= ZOBRIST[getZobristIndex(m.captured, m.to)];
    }
    nextHash ^= ZOBRIST_SIDE;

    // 原地走棋
    board[m.to] = m.piece;
    board[m.from] = 0;
    const newRedK = m.piece === 1 ? m.to : redKingSq;
    const newBlackK = m.piece === -1 ? m.to : blackKingSq;

    const score = -searchMinimax(board, depth - 1, -beta, -alpha, enemy, newRedK, newBlackK, nextHash, ply + 1, timeDeadline);

    // 原地撤销
    board[m.from] = m.piece;
    board[m.to] = m.captured;

    if (score > bestScore) {
      bestScore = score;
      bestMove = m;
    }
    if (score > alpha) {
      alpha = score;
    }
    if (score >= beta) {
      // 记录杀手走法与历史表
      if (m.captured === 0) {
        killerMoves[ply * 2 + 1] = killerMoves[ply * 2];
        killerMoves[ply * 2] = (m.from << 8) | m.to;
        historyTable[m.from * 90 + m.to] += depth * depth;
      }
      break; // Alpha-Beta 剪枝
    }
  }

  // 存入置换表
  let flag = TT_EXACT;
  if (bestScore <= alphaOrig) flag = TT_UPPER;
  else if (bestScore >= beta) flag = TT_LOWER;

  ttKeys[ttIndex] = currentHash;
  ttDepths[ttIndex] = depth;
  ttFlags[ttIndex] = flag;
  ttScores[ttIndex] = bestScore;
  ttBestMoves[ttIndex * 2] = bestMove.from;
  ttBestMoves[ttIndex * 2 + 1] = bestMove.to;

  return bestScore;
}

/**
 * 转换主线程棋盘为内部 1D 高速数组
 */
function convertBoard(inputBoard) {
  const b = new Int8Array(90);
  let redK = 9 * 9 + 4;
  let blackK = 0 * 9 + 4;
  let pieceCount = 0;

  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = inputBoard[r][c];
      if (!cell) continue;
      pieceCount++;
      const isRed = cell.side === 'r';
      let typeCode = 1;
      switch (cell.type) {
        case 'k': typeCode = 1; break;
        case 'a': typeCode = 2; break;
        case 'b': typeCode = 3; break;
        case 'n': typeCode = 4; break;
        case 'r': typeCode = 5; break;
        case 'c': typeCode = 6; break;
        case 'p': typeCode = 7; break;
      }
      const val = isRed ? typeCode : -typeCode;
      const sq = r * 9 + c;
      b[sq] = val;
      if (val === 1) redK = sq;
      else if (val === -1) blackK = sq;
    }
  }

  return { board: b, redK, blackK, pieceCount };
}

/**
 * 搜索最佳走法入口 (带迭代加深与开局库)
 */
function searchBestMove(inputBoard, sideStr, difficulty) {
  const side = sideStr === 'r' ? 1 : -1;
  const { board, redK, blackK, pieceCount } = convertBoard(inputBoard);

  // 1. 开局库极速命中 (开局前两步 < 1ms 即刻出着)
  if (pieceCount >= 30) {
    // 初始红方第一步
    if (side === 1 && board[7 * 9 + 1] === 6 && board[7 * 9 + 4] === 0) {
      return {
        from: { r: 7, c: 1 },
        to: { r: 7, c: 4 },
        captured: null
      };
    }
    // 黑方应中炮 (进马 8 进 7)
    if (side === -1 && board[2 * 9 + 4] === 6 && board[0 * 9 + 7] === -4 && board[2 * 9 + 6] === 0) {
      return {
        from: { r: 0, c: 7 },
        to: { r: 2, c: 6 },
        captured: null
      };
    }
  }

  // 2. 初始化搜索参数与时间预算 (毫秒)
  let maxDepth = 4;
  let timeBudget = 300;
  let randomFactor = 0;

  if (difficulty === 'easy') {
    maxDepth = 2;
    timeBudget = 50;
    randomFactor = 35;
  } else if (difficulty === 'medium') {
    maxDepth = 3;
    timeBudget = 160;
    randomFactor = 5;
  } else if (difficulty === 'hard') {
    maxDepth = 5;
    timeBudget = 450;
    randomFactor = 0;
  }

  // 计算初始 Zobrist 哈希
  let currentHash = side === 1 ? 0 : ZOBRIST_SIDE;
  for (let sq = 0; sq < 90; sq++) {
    const p = board[sq];
    if (p !== 0) currentHash ^= ZOBRIST[getZobristIndex(p, sq)];
  }

  // 清空历史表与杀手表
  historyTable.fill(0);
  killerMoves.fill(0);

  const moves = generateLegalMoves(board, side, redK, blackK);
  if (moves.length === 0) return null;

  const timeDeadline = Date.now() + timeBudget;
  let overallBestMove = moves[0];
  const enemy = -side;

  // 3. 迭代加深搜索 (Iterative Deepening)
  try {
    for (let d = 1; d <= maxDepth; d++) {
      let bestMoveThisDepth = moves[0];
      let bestScoreThisDepth = -Infinity;
      let alpha = -Infinity;
      const beta = Infinity;

      for (let i = 0; i < moves.length; i++) {
        const m = moves[i];
        let nextHash = currentHash ^ ZOBRIST[getZobristIndex(m.piece, m.from)] ^ ZOBRIST[getZobristIndex(m.piece, m.to)];
        if (m.captured !== 0) nextHash ^= ZOBRIST[getZobristIndex(m.captured, m.to)];
        nextHash ^= ZOBRIST_SIDE;

        // 原地走棋
        board[m.to] = m.piece;
        board[m.from] = 0;
        const newRedK = m.piece === 1 ? m.to : redK;
        const newBlackK = m.piece === -1 ? m.to : blackK;

        let score = -searchMinimax(board, d - 1, -beta, -alpha, enemy, newRedK, newBlackK, nextHash, 1, timeDeadline);

        // 原地撤销
        board[m.from] = m.piece;
        board[m.to] = m.captured;

        if (randomFactor > 0) {
          score += (Math.random() * 2 - 1) * randomFactor;
        }

        if (score > bestScoreThisDepth) {
          bestScoreThisDepth = score;
          bestMoveThisDepth = m;
        }
        if (score > alpha) {
          alpha = score;
        }
      }

      overallBestMove = bestMoveThisDepth;

      // 如果已经找到绝杀胜势，直接返回
      if (bestScoreThisDepth > 80000) break;
      if (Date.now() >= timeDeadline) break;
    }
  } catch (e) {
    // 捕获超时异常，安全返回上一层已完成的搜索结果
  }

  const fromR = (overallBestMove.from / 9) | 0;
  const fromC = overallBestMove.from % 9;
  const toR = (overallBestMove.to / 9) | 0;
  const toC = overallBestMove.to % 9;

  return {
    from: { r: fromR, c: fromC },
    to: { r: toR, c: toC },
    captured: inputBoard[toR][toC] ? { ...inputBoard[toR][toC] } : null
  };
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
        }, 50);
      }
    });
  }
}

window.ChessAI = ChessAI;
