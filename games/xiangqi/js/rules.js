/**
 * 中国象棋核心规则引擎 (Chinese Chess Rules Engine)
 * 包含棋盘坐标系、全棋子走法判定、将军/飞将判定、合法走法生成、标准中文记谱法
 */

// 棋子类型与中文名称映射
const PIECE_NAMES = {
  r: { k: '帥', a: '仕', b: '相', n: '馬', r: '車', c: '炮', p: '兵' },
  b: { k: '將', a: '士', b: '象', n: '馬', r: '車', c: '砲', p: '卒' }
};

// 中文数字（红方用汉字一至九，黑方用阿拉伯/全角数字１至９）
const RED_NUMS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const BLACK_NUMS = ['１', '２', '３', '４', '５', '６', '７', '８', '９'];

class ChessRules {
  /**
   * 创建初始棋盘状态 (10行 x 9列, null表示空位)
   * 坐标系：row 0-9 (0为黑方底线, 9为红方底线), col 0-8 (左至右)
   */
  static getInitialBoard() {
    const board = Array.from({ length: 10 }, () => Array(9).fill(null));

    // 黑方 (Row 0 - 3)
    board[0][0] = { side: 'b', type: 'r' };
    board[0][1] = { side: 'b', type: 'n' };
    board[0][2] = { side: 'b', type: 'b' };
    board[0][3] = { side: 'b', type: 'a' };
    board[0][4] = { side: 'b', type: 'k' };
    board[0][5] = { side: 'b', type: 'a' };
    board[0][6] = { side: 'b', type: 'b' };
    board[0][7] = { side: 'b', type: 'n' };
    board[0][8] = { side: 'b', type: 'r' };
    board[2][1] = { side: 'b', type: 'c' };
    board[2][7] = { side: 'b', type: 'c' };
    board[3][0] = { side: 'b', type: 'p' };
    board[3][2] = { side: 'b', type: 'p' };
    board[3][4] = { side: 'b', type: 'p' };
    board[3][6] = { side: 'b', type: 'p' };
    board[3][8] = { side: 'b', type: 'p' };

    // 红方 (Row 6 - 9)
    board[9][0] = { side: 'r', type: 'r' };
    board[9][1] = { side: 'r', type: 'n' };
    board[9][2] = { side: 'r', type: 'b' };
    board[9][3] = { side: 'r', type: 'a' };
    board[9][4] = { side: 'r', type: 'k' };
    board[9][5] = { side: 'r', type: 'a' };
    board[9][6] = { side: 'r', type: 'b' };
    board[9][7] = { side: 'r', type: 'n' };
    board[9][8] = { side: 'r', type: 'r' };
    board[7][1] = { side: 'r', type: 'c' };
    board[7][7] = { side: 'r', type: 'c' };
    board[6][0] = { side: 'r', type: 'p' };
    board[6][2] = { side: 'r', type: 'p' };
    board[6][4] = { side: 'r', type: 'p' };
    board[6][6] = { side: 'r', type: 'p' };
    board[6][8] = { side: 'r', type: 'p' };

    return board;
  }

  /**
   * 复制棋盘状态
   */
  static cloneBoard(board) {
    return board.map(row => row.map(cell => (cell ? { ...cell } : null)));
  }

  /**
   * 检查坐标是否在棋盘内
   */
  static inBounds(r, c) {
    return r >= 0 && r <= 9 && c >= 0 && c <= 8;
  }

  /**
   * 检查是否在九宫内
   */
  static inPalace(r, c, side) {
    if (c < 3 || c > 5) return false;
    if (side === 'r') {
      return r >= 7 && r <= 9;
    } else {
      return r >= 0 && r <= 2;
    }
  }

  /**
   * 生成指定位置棋子的所有可能走法 (不考虑自杀将军过滤)
   */
  static getPseudoMoves(board, r, c) {
    const piece = board[r][c];
    if (!piece) return [];
    const { side, type } = piece;
    const moves = [];

    const addMove = (tr, tc) => {
      if (!this.inBounds(tr, tc)) return;
      const target = board[tr][tc];
      if (!target) {
        moves.push({ from: { r, c }, to: { r: tr, c: tc }, captured: null });
      } else if (target.side !== side) {
        moves.push({ from: { r, c }, to: { r: tr, c: tc }, captured: target });
      }
    };

    switch (type) {
      // 帅 / 将
      case 'k': {
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of dirs) {
          const nr = r + dr;
          const nc = c + dc;
          if (this.inPalace(nr, nc, side)) {
            addMove(nr, nc);
          }
        }
        break;
      }

      // 仕 / 士 (斜走一步，不出九宫)
      case 'a': {
        const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        for (const [dr, dc] of dirs) {
          const nr = r + dr;
          const nc = c + dc;
          if (this.inPalace(nr, nc, side)) {
            addMove(nr, nc);
          }
        }
        break;
      }

      // 相 / 象 (田字格，塞象眼不可走，不过河)
      case 'b': {
        const steps = [
          { dr: -2, dc: -2, eyeR: -1, eyeC: -1 },
          { dr: -2, dc: 2, eyeR: -1, eyeC: 1 },
          { dr: 2, dc: -2, eyeR: 1, eyeC: -1 },
          { dr: 2, dc: 2, eyeR: 1, eyeC: 1 }
        ];

        for (const s of steps) {
          const nr = r + s.dr;
          const nc = c + s.dc;
          // 不能过河
          if (side === 'r' && nr < 5) continue;
          if (side === 'b' && nr > 4) continue;
          if (!this.inBounds(nr, nc)) continue;

          // 塞象眼检查
          const eyeR = r + s.eyeR;
          const eyeC = c + s.eyeC;
          if (!board[eyeR][eyeC]) {
            addMove(nr, nc);
          }
        }
        break;
      }

      // 马 (日字格，蹩马腿)
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
          const nr = r + hm.dr;
          const nc = c + hm.dc;
          if (!this.inBounds(nr, nc)) continue;
          const legR = r + hm.legR;
          const legC = c + hm.legC;
          if (!board[legR][legC]) {
            addMove(nr, nc);
          }
        }
        break;
      }

      // 车 (直线任意距离)
      case 'r': {
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of dirs) {
          let step = 1;
          while (true) {
            const nr = r + dr * step;
            const nc = c + dc * step;
            if (!this.inBounds(nr, nc)) break;
            const target = board[nr][nc];
            if (!target) {
              addMove(nr, nc);
            } else {
              if (target.side !== side) {
                addMove(nr, nc);
              }
              break; // 遇到棋子阻挡
            }
            step++;
          }
        }
        break;
      }

      // 炮 (翻山吃子)
      case 'c': {
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of dirs) {
          let step = 1;
          let jumped = false;
          while (true) {
            const nr = r + dr * step;
            const nc = c + dc * step;
            if (!this.inBounds(nr, nc)) break;
            const target = board[nr][nc];

            if (!jumped) {
              if (!target) {
                // 未翻山，可以移动到空位
                addMove(nr, nc);
              } else {
                // 遇到第一个棋子（炮架）
                jumped = true;
              }
            } else {
              // 已翻山，只能吃敌方棋子
              if (target) {
                if (target.side !== side) {
                  addMove(nr, nc);
                }
                break; // 遇到目标后停止
              }
            }
            step++;
          }
        }
        break;
      }

      // 兵 / 卒 (过河前只能前进，过河后可左右前进，不可后退)
      case 'p': {
        const forwardDir = side === 'r' ? -1 : 1;
        const crossedRiver = side === 'r' ? r <= 4 : r >= 5;

        // 向前走
        const fr = r + forwardDir;
        if (this.inBounds(fr, c)) {
          addMove(fr, c);
        }

        // 过河后左右走
        if (crossedRiver) {
          const sides = [c - 1, c + 1];
          for (const sc of sides) {
            if (this.inBounds(r, sc)) {
              addMove(r, sc);
            }
          }
        }
        break;
      }
    }

    return moves;
  }

  /**
   * 查找指定方将/帅的位置
   */
  static findKing(board, side) {
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        if (p && p.side === side && p.type === 'k') {
          return { r, c };
        }
      }
    }
    return null;
  }

  /**
   * 检查双方将帅是否照面 (对将/飞将违规)
   */
  static areKingsFacing(board) {
    const redKing = this.findKing(board, 'r');
    const blackKing = this.findKing(board, 'b');
    if (!redKing || !blackKing) return false;

    // 必须在同一列
    if (redKing.c !== blackKing.c) return false;

    // 中间不能有任何棋子阻隔
    const col = redKing.c;
    const minR = Math.min(redKing.r, blackKing.r);
    const maxR = Math.max(redKing.r, blackKing.r);

    for (let r = minR + 1; r < maxR; r++) {
      if (board[r][col] !== null) return false;
    }
    return true;
  }

  /**
   * 检查指定阵营是否正被将军 (被敌方任何棋子攻击)
   */
  static isKingInCheck(board, side) {
    const kingPos = this.findKing(board, side);
    if (!kingPos) return true; // 将帅不存在视为被将死

    const enemySide = side === 'r' ? 'b' : 'r';

    // 检查是否有敌方棋子可以直接攻击到该将帅
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        if (p && p.side === enemySide) {
          const pseudoMoves = this.getPseudoMoves(board, r, c);
          if (pseudoMoves.some(m => m.to.r === kingPos.r && m.to.c === kingPos.c)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * 执行虚拟走法并返回走法后的新棋盘
   */
  static makeSimulatedMove(board, move) {
    const newBoard = this.cloneBoard(board);
    const { from, to } = move;
    newBoard[to.r][to.c] = newBoard[from.r][from.c];
    newBoard[from.r][from.c] = null;
    return newBoard;
  }

  /**
   * 验证走法是否完全合规 (走后己方不能处于被将军状态，且将帅不能照面)
   */
  static isLegalMove(board, move, side) {
    const nextBoard = this.makeSimulatedMove(board, move);
    if (this.areKingsFacing(nextBoard)) return false;
    if (this.isKingInCheck(nextBoard, side)) return false;
    return true;
  }

  /**
   * 获取指定方当前所有完全合法的走法
   */
  static getAllLegalMoves(board, side) {
    const legalMoves = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const piece = board[r][c];
        if (piece && piece.side === side) {
          const pseudoMoves = this.getPseudoMoves(board, r, c);
          for (const move of pseudoMoves) {
            if (this.isLegalMove(board, move, side)) {
              legalMoves.push(move);
            }
          }
        }
      }
    }
    return legalMoves;
  }

  /**
   * 检查游戏胜负状态
   * 返回: { over: boolean, winner: 'r'|'b'|'draw'|null, reason: string }
   */
  static getGameStatus(board, currentTurn) {
    const legalMoves = this.getAllLegalMoves(board, currentTurn);
    const inCheck = this.isKingInCheck(board, currentTurn);

    if (legalMoves.length === 0) {
      const winner = currentTurn === 'r' ? 'b' : 'r';
      if (inCheck) {
        return {
          over: true,
          winner,
          reason: `${currentTurn === 'r' ? '红方' : '黑方'}被绝杀！`
        };
      } else {
        // 困毙（无子可动亦判负）
        return {
          over: true,
          winner,
          reason: `${currentTurn === 'r' ? '红方' : '黑方'}困毙，无合法走法！`
        };
      }
    }

    return {
      over: false,
      winner: null,
      inCheck,
      reason: inCheck ? `${currentTurn === 'r' ? '红方' : '黑方'}受将军！` : ''
    };
  }

  /**
   * 生成标准中国象棋记谱文本 (例如："炮二平五", "马８进７", "车一平二", "前炮退一")
   */
  static getMoveNotation(boardBefore, move) {
    const { from, to } = move;
    const piece = boardBefore[from.r][from.c];
    if (!piece) return '';

    const { side, type } = piece;
    const isRed = side === 'r';

    // 棋子名称
    const pieceName = PIECE_NAMES[side][type];

    // 列转换 (红方从右至左 1-9，黑方从右至左 1-9)
    // 对于红方：列 index 0 对应九路，index 8 对应一路 (9 - col)
    // 对于黑方：列 index 0 对应一路，index 8 对应九路 (col + 1)
    const fromColNum = isRed ? 9 - from.c : from.c + 1;
    const toColNum = isRed ? 9 - to.c : to.c + 1;

    // 检查同一列是否有多个相同类型的棋子（如前后炮/前后车）
    let sameColPieces = [];
    for (let r = 0; r < 10; r++) {
      const p = boardBefore[r][from.c];
      if (p && p.side === side && p.type === type) {
        sameColPieces.push(r);
      }
    }

    let prefix = '';
    if (sameColPieces.length === 2) {
      // 排序：红方靠近底线(r=9)是后，靠近河界(r=0)是前
      // 黑方靠近底线(r=0)是后，靠近河界(r=9)是前
      sameColPieces.sort((a, b) => a - b);
      if (isRed) {
        prefix = from.r === sameColPieces[0] ? '前' : '后';
      } else {
        prefix = from.r === sameColPieces[0] ? '后' : '前';
      }
    }

    // 进、退、平方向判定
    let action = '';
    let targetDesc = '';

    if (from.r === to.r) {
      action = '平';
      targetDesc = isRed ? RED_NUMS[toColNum - 1] : BLACK_NUMS[toColNum - 1];
    } else {
      const isAdvance = isRed ? to.r < from.r : to.r > from.r;
      action = isAdvance ? '进' : '退';

      if (['r', 'c', 'p', 'k'].includes(type)) {
        // 直行棋子：进退步数
        const steps = Math.abs(to.r - from.r);
        targetDesc = isRed ? RED_NUMS[steps - 1] : BLACK_NUMS[steps - 1];
      } else {
        // 斜行棋子 (马、相、士)：进退目标列
        targetDesc = isRed ? RED_NUMS[toColNum - 1] : BLACK_NUMS[toColNum - 1];
      }
    }

    const colStr = isRed ? RED_NUMS[fromColNum - 1] : BLACK_NUMS[fromColNum - 1];

    if (prefix) {
      return `${prefix}${pieceName}${action}${targetDesc}`;
    } else {
      return `${pieceName}${colStr}${action}${targetDesc}`;
    }
  }
}

window.ChessRules = ChessRules;
window.PIECE_NAMES = PIECE_NAMES;
