/**
 * 深渊之弈 · 国际象棋核心规则引擎 (Standard Chess Rules Engine)
 * 完整支持：标准走法、王车易位(Castling)、吃过路兵(En Passant)、兵升变(Promotion)、将军、将死、逼和、悔棋
 */
class ChessEngine {
  constructor() {
    this.reset();
  }

  reset() {
    // 8x8 棋盘表示：r0 为第8行(黑方底线), r7 为第1行(白方底线)
    // 格式：{ type: 'p'|'r'|'n'|'b'|'q'|'k', color: 'w'|'b' } 或 null
    this.board = Array(8).fill(null).map(() => Array(8).fill(null));
    this.turn = 'w'; // 'w' 白方先手, 'b' 黑方
    this.castling = {
      w: { k: true, q: true },
      b: { k: true, q: true }
    };
    this.enPassantTarget = null; // { r, c } 可吃过路兵的目标格
    this.halfMoves = 0;
    this.fullMoves = 1;
    this.history = []; // 历史记录用于悔棋
    this.capturedPieces = { w: [], b: [] }; // 存放被吃的棋子

    this.setupInitialPosition();
  }

  setupInitialPosition() {
    const setupRow = (row, color, pieces) => {
      for (let c = 0; c < 8; c++) {
        this.board[row][c] = { type: pieces[c], color };
      }
    };

    const backRank = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
    setupRow(0, 'b', backRank);
    for (let c = 0; c < 8; c++) this.board[1][c] = { type: 'p', color: 'b' };

    for (let c = 0; c < 8; c++) this.board[6][c] = { type: 'p', color: 'w' };
    setupRow(7, 'w', backRank);
  }

  // 深度克隆当前状态（用于走棋验证与AI）
  clone() {
    const engine = new ChessEngine();
    engine.board = this.board.map(row => row.map(cell => cell ? { ...cell } : null));
    engine.turn = this.turn;
    engine.castling = {
      w: { ...this.castling.w },
      b: { ...this.castling.b }
    };
    engine.enPassantTarget = this.enPassantTarget ? { ...this.enPassantTarget } : null;
    engine.halfMoves = this.halfMoves;
    engine.fullMoves = this.fullMoves;
    engine.capturedPieces = {
      w: [...this.capturedPieces.w],
      b: [...this.capturedPieces.b]
    };
    return engine;
  }

  getPiece(r, c) {
    if (r < 0 || r > 7 || c < 0 || c > 7) return null;
    return this.board[r][c];
  }

  // 查找某方国王的位置
  findKing(color, board = this.board) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.type === 'k' && p.color === color) {
          return { r, c };
        }
      }
    }
    return null;
  }

  // 判断指定颜色是否处于“被将军”状态
  isInCheck(color, board = this.board) {
    const kingPos = this.findKing(color, board);
    if (!kingPos) return false;
    const opponentColor = color === 'w' ? 'b' : 'w';
    return this.isSquareAttacked(kingPos.r, kingPos.c, opponentColor, board);
  }

  // 判断指定格子是否受到某方攻击
  isSquareAttacked(r, c, attackerColor, board = this.board) {
    // 1. 兵攻击
    const pawnDir = attackerColor === 'w' ? -1 : 1;
    const pawnRow = r - pawnDir;
    if (pawnRow >= 0 && pawnRow < 8) {
      if (c > 0) {
        const p = board[pawnRow][c - 1];
        if (p && p.color === attackerColor && p.type === 'p') return true;
      }
      if (c < 7) {
        const p = board[pawnRow][c + 1];
        if (p && p.color === attackerColor && p.type === 'p') return true;
      }
    }

    // 2. 马攻击
    const knightMoves = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    for (const [dr, dc] of knightMoves) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        const p = board[nr][nc];
        if (p && p.color === attackerColor && p.type === 'n') return true;
      }
    }

    // 3. 王攻击 (相邻一格)
    const kingMoves = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1]
    ];
    for (const [dr, dc] of kingMoves) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        const p = board[nr][nc];
        if (p && p.color === attackerColor && p.type === 'k') return true;
      }
    }

    // 4. 直线滑膛攻击 (车 / 后)
    const straightDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of straightDirs) {
      let step = 1;
      while (true) {
        const nr = r + dr * step, nc = c + dc * step;
        if (nr < 0 || nr > 7 || nc < 0 || nc > 7) break;
        const p = board[nr][nc];
        if (p) {
          if (p.color === attackerColor && (p.type === 'r' || p.type === 'q')) return true;
          break;
        }
        step++;
      }
    }

    // 5. 斜线滑膛攻击 (象 / 后)
    const diagDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [dr, dc] of diagDirs) {
      let step = 1;
      while (true) {
        const nr = r + dr * step, nc = c + dc * step;
        if (nr < 0 || nr > 7 || nc < 0 || nc > 7) break;
        const p = board[nr][nc];
        if (p) {
          if (p.color === attackerColor && (p.type === 'b' || p.type === 'q')) return true;
          break;
        }
        step++;
      }
    }

    return false;
  }

  // 获取某格棋子的伪合法走法 (Pseudo-legal moves)
  getPseudoMoves(r, c) {
    const p = this.board[r][c];
    if (!p) return [];
    const moves = [];
    const color = p.color;
    const opponent = color === 'w' ? 'b' : 'w';

    switch (p.type) {
      case 'p': {
        const dir = color === 'w' ? -1 : 1;
        const startRow = color === 'w' ? 6 : 1;
        const promoRow = color === 'w' ? 0 : 7;

        // 前进一步
        const nextR = r + dir;
        if (nextR >= 0 && nextR < 8 && !this.board[nextR][c]) {
          if (nextR === promoRow) {
            ['q', 'r', 'b', 'n'].forEach(promo => {
              moves.push({ from: { r, c }, to: { r: nextR, c }, promo });
            });
          } else {
            moves.push({ from: { r, c }, to: { r: nextR, c } });
          }

          // 初始两步
          const doubleR = r + dir * 2;
          if (r === startRow && !this.board[doubleR][c]) {
            moves.push({ from: { r, c }, to: { r: doubleR, c }, isDoublePawn: true });
          }
        }

        // 斜角吃子 & 吃过路兵
        for (const dc of [-1, 1]) {
          const targetC = c + dc;
          if (targetC >= 0 && targetC < 8) {
            const targetP = this.board[nextR][targetC];
            if (targetP && targetP.color === opponent) {
              if (nextR === promoRow) {
                ['q', 'r', 'b', 'n'].forEach(promo => {
                  moves.push({ from: { r, c }, to: { r: nextR, c: targetC }, promo, isCapture: true });
                });
              } else {
                moves.push({ from: { r, c }, to: { r: nextR, c: targetC }, isCapture: true });
              }
            } else if (this.enPassantTarget && this.enPassantTarget.r === nextR && this.enPassantTarget.c === targetC) {
              moves.push({ from: { r, c }, to: { r: nextR, c: targetC }, isEnPassant: true, isCapture: true });
            }
          }
        }
        break;
      }

      case 'n': {
        const jumps = [
          [-2, -1], [-2, 1], [-1, -2], [-1, 2],
          [1, -2], [1, 2], [2, -1], [2, 1]
        ];
        for (const [dr, dc] of jumps) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            const targetP = this.board[nr][nc];
            if (!targetP) {
              moves.push({ from: { r, c }, to: { r: nr, c: nc } });
            } else if (targetP.color === opponent) {
              moves.push({ from: { r, c }, to: { r: nr, c: nc }, isCapture: true });
            }
          }
        }
        break;
      }

      case 'b':
      case 'r':
      case 'q': {
        const dirs = [];
        if (p.type === 'b' || p.type === 'q') {
          dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
        }
        if (p.type === 'r' || p.type === 'q') {
          dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
        }

        for (const [dr, dc] of dirs) {
          let step = 1;
          while (true) {
            const nr = r + dr * step, nc = c + dc * step;
            if (nr < 0 || nr > 7 || nc < 0 || nc > 7) break;
            const targetP = this.board[nr][nc];
            if (!targetP) {
              moves.push({ from: { r, c }, to: { r: nr, c: nc } });
            } else {
              if (targetP.color === opponent) {
                moves.push({ from: { r, c }, to: { r: nr, c: nc }, isCapture: true });
              }
              break;
            }
            step++;
          }
        }
        break;
      }

      case 'k': {
        const dirs = [
          [-1, -1], [-1, 0], [-1, 1],
          [0, -1],           [0, 1],
          [1, -1],  [1, 0],  [1, 1]
        ];
        for (const [dr, dc] of dirs) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            const targetP = this.board[nr][nc];
            if (!targetP) {
              moves.push({ from: { r, c }, to: { r: nr, c: nc } });
            } else if (targetP.color === opponent) {
              moves.push({ from: { r, c }, to: { r: nr, c: nc }, isCapture: true });
            }
          }
        }

        // 王车易位 (Castling)
        if (!this.isInCheck(color)) {
          const rank = color === 'w' ? 7 : 0;
          if (r === rank && c === 4) {
            // 王翼易位 (Kingside O-O)
            if (this.castling[color].k) {
              if (!this.board[rank][5] && !this.board[rank][6]) {
                if (!this.isSquareAttacked(rank, 5, opponent) && !this.isSquareAttacked(rank, 6, opponent)) {
                  const rook = this.board[rank][7];
                  if (rook && rook.type === 'r' && rook.color === color) {
                    moves.push({ from: { r, c }, to: { r: rank, c: 6 }, isCastling: 'k' });
                  }
                }
              }
            }
            // 后翼易位 (Queenside O-O-O)
            if (this.castling[color].q) {
              if (!this.board[rank][3] && !this.board[rank][2] && !this.board[rank][1]) {
                if (!this.isSquareAttacked(rank, 3, opponent) && !this.isSquareAttacked(rank, 2, opponent)) {
                  const rook = this.board[rank][0];
                  if (rook && rook.type === 'r' && rook.color === color) {
                    moves.push({ from: { r, c }, to: { r: rank, c: 2 }, isCastling: 'q' });
                  }
                }
              }
            }
          }
        }
        break;
      }
    }

    return moves;
  }

  // 获取某格棋子的真正合法走法（排除走后自身被将军的情况）
  getLegalMoves(r, c) {
    const p = this.board[r][c];
    if (!p || p.color !== this.turn) return [];

    const pseudoMoves = this.getPseudoMoves(r, c);
    return pseudoMoves.filter(move => this.isMoveLegal(move));
  }

  // 检验走法是否合法
  isMoveLegal(move) {
    const cloneEngine = this.clone();
    cloneEngine.executeMoveInternal(move);
    return !cloneEngine.isInCheck(this.turn, cloneEngine.board);
  }

  // 获取当前回合的所有合法走法
  getAllLegalMoves(color = this.turn) {
    const allMoves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p && p.color === color) {
          const moves = this.getPseudoMoves(r, c);
          for (const m of moves) {
            if (this.isMoveLegal(m)) {
              allMoves.push(m);
            }
          }
        }
      }
    }
    return allMoves;
  }

  // 内部执行走棋（无状态验证，用于引擎模拟与实际走子）
  executeMoveInternal(move) {
    const { from, to, promo, isCastling, isEnPassant } = move;
    const piece = this.board[from.r][from.c];
    let captured = this.board[to.r][to.c];

    // 处理吃过路兵
    if (isEnPassant) {
      const epRow = from.r;
      captured = this.board[epRow][to.c];
      this.board[epRow][to.c] = null;
    }

    // 记录被吃棋子
    if (captured) {
      this.capturedPieces[this.turn].push(captured);
    }

    // 移动棋子
    this.board[to.r][to.c] = piece;
    this.board[from.r][from.c] = null;

    // 处理升变
    if (promo) {
      this.board[to.r][to.c] = { type: promo, color: piece.color };
    }

    // 处理易位时车的移动
    if (isCastling) {
      const rank = from.r;
      if (isCastling === 'k') {
        const rook = this.board[rank][7];
        this.board[rank][5] = rook;
        this.board[rank][7] = null;
      } else if (isCastling === 'q') {
        const rook = this.board[rank][0];
        this.board[rank][3] = rook;
        this.board[rank][0] = null;
      }
    }

    // 更新易位权限
    if (piece.type === 'k') {
      this.castling[piece.color].k = false;
      this.castling[piece.color].q = false;
    } else if (piece.type === 'r') {
      if (from.r === 7 && from.c === 7) this.castling.w.k = false;
      if (from.r === 7 && from.c === 0) this.castling.w.q = false;
      if (from.r === 0 && from.c === 7) this.castling.b.k = false;
      if (from.r === 0 && from.c === 0) this.castling.b.q = false;
    }
    // 敌方车被吃掉也要取消对方相应易位权
    if (captured && captured.type === 'r') {
      if (to.r === 7 && to.c === 7) this.castling.w.k = false;
      if (to.r === 7 && to.c === 0) this.castling.w.q = false;
      if (to.r === 0 && to.c === 7) this.castling.b.k = false;
      if (to.r === 0 && to.c === 0) this.castling.b.q = false;
    }

    // 更新吃过路兵目标格
    if (piece.type === 'p' && Math.abs(to.r - from.r) === 2) {
      this.enPassantTarget = { r: (from.r + to.r) / 2, c: from.c };
    } else {
      this.enPassantTarget = null;
    }

    // 计数更新
    if (piece.type === 'p' || captured) {
      this.halfMoves = 0;
    } else {
      this.halfMoves++;
    }

    if (this.turn === 'b') {
      this.fullMoves++;
    }

    this.turn = this.turn === 'w' ? 'b' : 'w';
  }

  // 外部标准走棋接口
  makeMove(move) {
    // 保存历史状态快照
    const snapshot = {
      board: this.board.map(row => row.map(cell => cell ? { ...cell } : null)),
      turn: this.turn,
      castling: {
        w: { ...this.castling.w },
        b: { ...this.castling.b }
      },
      enPassantTarget: this.enPassantTarget ? { ...this.enPassantTarget } : null,
      halfMoves: this.halfMoves,
      fullMoves: this.fullMoves,
      capturedPieces: {
        w: [...this.capturedPieces.w],
        b: [...this.capturedPieces.b]
      },
      move: { ...move }
    };
    this.history.push(snapshot);

    this.executeMoveInternal(move);
    return true;
  }

  // 悔棋 (Undo)
  undoMove() {
    if (this.history.length === 0) return null;
    const lastState = this.history.pop();
    this.board = lastState.board;
    this.turn = lastState.turn;
    this.castling = lastState.castling;
    this.enPassantTarget = lastState.enPassantTarget;
    this.halfMoves = lastState.halfMoves;
    this.fullMoves = lastState.fullMoves;
    this.capturedPieces = lastState.capturedPieces;
    return lastState.move;
  }

  // 获取战局状态
  getGameStatus() {
    const legalMoves = this.getAllLegalMoves(this.turn);
    const inCheck = this.isInCheck(this.turn);

    if (legalMoves.length === 0) {
      if (inCheck) {
        return {
          isOver: true,
          result: 'checkmate',
          winner: this.turn === 'w' ? 'b' : 'w',
          message: this.turn === 'w' ? '深渊死灵 (黑方) 达成将死！' : '苍白圣堂 (白方) 达成将死！'
        };
      } else {
        return {
          isOver: true,
          result: 'stalemate',
          winner: null,
          message: '逼和！无子可动，双方以和局收场'
        };
      }
    }

    if (this.halfMoves >= 100) {
      return {
        isOver: true,
        result: 'fifty-move',
        winner: null,
        message: '50回合无吃子或进兵，战局归于沉寂和棋'
      };
    }

    return {
      isOver: false,
      inCheck,
      turn: this.turn
    };
  }

  // 导出标准国际象棋代数记谱 (SAN 简写)
  getMoveSAN(move, piece, isCheck, isMate) {
    if (move.isCastling === 'k') return isMate ? 'O-O#' : isCheck ? 'O-O+' : 'O-O';
    if (move.isCastling === 'q') return isMate ? 'O-O-O#' : isCheck ? 'O-O-O+' : 'O-O-O';

    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const fromSquare = `${files[move.from.c]}${8 - move.from.r}`;
    const toSquare = `${files[move.to.c]}${8 - move.to.r}`;

    let symbol = piece.type.toUpperCase();
    if (symbol === 'P') symbol = '';

    const captureChar = move.isCapture ? (symbol === '' ? files[move.from.c] + 'x' : 'x') : '';
    let san = `${symbol}${captureChar}${toSquare}`;
    if (move.promo) {
      san += `=${move.promo.toUpperCase()}`;
    }
    if (isMate) san += '#';
    else if (isCheck) san += '+';

    return san;
  }
}
