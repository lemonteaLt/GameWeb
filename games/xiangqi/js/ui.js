/**
 * 中国象棋 UI 与交互渲染引擎 (新中式极简视觉系统)
 */

class ChessUI {
  constructor(boardContainer, indicatorsLayer, piecesLayer) {
    this.container = boardContainer;
    this.indicatorsLayer = indicatorsLayer;
    this.piecesLayer = piecesLayer;
    this.isFlipped = false; // 是否翻转视角 (执黑视角)
    this.pieceElements = new Map(); // id -> DOM Element 缓存以实现平滑位移动画
    this.pieceCounter = 0;
    this.selectedPos = null;
    this.legalMoves = [];
    this.lastMove = null;
    this.hintMove = null;

    this.onSquareClick = null;
    this.onPieceClick = null;

    this.initSvgBoard();
    this.initBoardClick();
  }

  /**
   * 初始化 SVG 棋盘网格线、斜线、九宫格、楚河汉界与十字星位
   */
  initSvgBoard() {
    const linesGroup = document.getElementById('svg-grid-lines');
    const palaceGroup = document.getElementById('svg-palace-lines');
    const crossGroup = document.getElementById('svg-cross-markers');

    if (!linesGroup) return;

    // 清空现有元素
    linesGroup.innerHTML = '';
    palaceGroup.innerHTML = '';
    crossGroup.innerHTML = '';

    // 1. 横线 (10条, y: 40 到 760, 间距 80)
    for (let r = 0; r < 10; r++) {
      const y = 40 + r * 80;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', '40');
      line.setAttribute('y1', y);
      line.setAttribute('x2', '680');
      line.setAttribute('y2', y);
      linesGroup.appendChild(line);
    }

    // 2. 竖线 (9条, 边线全通, 中间7条不过楚河汉界)
    for (let c = 0; c < 9; c++) {
      const x = 40 + c * 80;
      if (c === 0 || c === 8) {
        // 左右边线直通贯穿
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x);
        line.setAttribute('y1', '40');
        line.setAttribute('x2', x);
        line.setAttribute('y2', '760');
        linesGroup.appendChild(line);
      } else {
        // 上半部 (Row 0 - 4)
        const lineTop = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        lineTop.setAttribute('x1', x);
        lineTop.setAttribute('y1', '40');
        lineTop.setAttribute('x2', x);
        lineTop.setAttribute('y2', '360');
        linesGroup.appendChild(lineTop);

        // 下半部 (Row 5 - 9)
        const lineBottom = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        lineBottom.setAttribute('x1', x);
        lineBottom.setAttribute('y1', '440');
        lineBottom.setAttribute('x2', x);
        lineBottom.setAttribute('y2', '760');
        linesGroup.appendChild(lineBottom);
      }
    }

    // 3. 九宫斜线 (上方与下方)
    const diagonals = [
      // 黑方九宫 (x: 280-440, y: 40-200)
      { x1: 280, y1: 40, x2: 440, y2: 200 },
      { x1: 440, y1: 40, x2: 280, y2: 200 },
      // 红方九宫 (x: 280-440, y: 600-760)
      { x1: 280, y1: 600, x2: 440, y2: 760 },
      { x1: 440, y1: 600, x2: 280, y2: 760 }
    ];

    diagonals.forEach(d => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', d.x1);
      line.setAttribute('y1', d.y1);
      line.setAttribute('x2', d.x2);
      line.setAttribute('y2', d.y2);
      palaceGroup.appendChild(line);
    });

    // 4. 十字标记 (炮位与兵卒位)
    const markerPositions = [
      // 炮位
      { r: 2, c: 1 }, { r: 2, c: 7 },
      { r: 7, c: 1 }, { r: 7, c: 7 },
      // 兵卒位
      { r: 3, c: 0 }, { r: 3, c: 2 }, { r: 3, c: 4 }, { r: 3, c: 6 }, { r: 3, c: 8 },
      { r: 6, c: 0 }, { r: 6, c: 2 }, { r: 6, c: 4 }, { r: 6, c: 6 }, { r: 6, c: 8 }
    ];

    markerPositions.forEach(pos => {
      const cx = 40 + pos.c * 80;
      const cy = 40 + pos.r * 80;
      this.drawCrossMarker(crossGroup, cx, cy, pos.c === 0, pos.c === 8);
    });
  }

  /**
   * 绘制传统象棋十字折角标记
   */
  drawCrossMarker(group, cx, cy, isLeftEdge, isRightEdge) {
    const gap = 5;
    const len = 9;
    const drawCorner = (dx, dy) => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const startX = cx + dx * (gap + len);
      const startY = cy + dy * gap;
      const cornerX = cx + dx * gap;
      const cornerY = cy + dy * gap;
      const endX = cx + dx * gap;
      const endY = cy + dy * (gap + len);

      path.setAttribute('d', `M ${startX} ${startY} L ${cornerX} ${cornerY} L ${endX} ${endY}`);
      path.setAttribute('fill', 'none');
      group.appendChild(path);
    };

    if (!isLeftEdge) {
      drawCorner(-1, -1); // 左上
      drawCorner(-1, 1);  // 左下
    }
    if (!isRightEdge) {
      drawCorner(1, -1);  // 右上
      drawCorner(1, 1);   // 右下
    }
  }

  /**
   * 监听全局棋盘点击，支持点击任意网格交叉点
   */
  initBoardClick() {
    if (!this.container) return;

    this.container.addEventListener('click', (e) => {
      const rect = this.container.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // 转换为 720 x 800 棋盘坐标空间
      const svgX = (clickX / rect.width) * 720;
      const svgY = (clickY / rect.height) * 800;

      // 计算最近的网格行列
      let col = Math.round((svgX - 40) / 80);
      let row = Math.round((svgY - 40) / 80);

      if (row < 0 || row > 9 || col < 0 || col > 8) return;

      // 视角度适配
      const actualRow = this.isFlipped ? 9 - row : row;
      const actualCol = this.isFlipped ? 8 - col : col;

      if (this.onSquareClick) {
        this.onSquareClick(actualRow, actualCol);
      }
    });
  }

  /**
   * 计算棋盘坐标百分比
   */
  getCoordPercent(r, c) {
    const displayR = this.isFlipped ? 9 - r : r;
    const displayC = this.isFlipped ? 8 - c : c;
    const xPct = ((40 + displayC * 80) / 720) * 100;
    const yPct = ((40 + displayR * 80) / 800) * 100;
    return { x: xPct, y: yPct };
  }

  /**
   * 渲染/全量刷新棋盘所有棋子
   */
  renderBoard(board) {
    const currentPieceKeys = new Set();

    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const piece = board[r][c];
        if (!piece) continue;

        // 生成或获取棋子唯一ID
        if (!piece.id) {
          piece.id = `piece_${piece.side}_${piece.type}_${++this.pieceCounter}`;
        }
        currentPieceKeys.add(piece.id);

        let elem = this.pieceElements.get(piece.id);
        const { x, y } = this.getCoordPercent(r, c);

        if (!elem) {
          // 创建新的棋子 DOM 节点
          elem = document.createElement('div');
          elem.className = `chess-piece ${piece.side === 'r' ? 'red' : 'black'}`;
          elem.id = piece.id;

          const inner = document.createElement('div');
          inner.className = 'piece-inner';

          const charSpan = document.createElement('span');
          charSpan.className = 'piece-char';
          charSpan.textContent = PIECE_NAMES[piece.side][piece.type];

          inner.appendChild(charSpan);
          elem.appendChild(inner);

          // 绑定点击事件 (阻止冒泡，交由 onPieceClick 专有处理)
          elem.addEventListener('click', (e) => {
            e.stopPropagation();
            const currentR = parseInt(elem.dataset.row, 10);
            const currentC = parseInt(elem.dataset.col, 10);
            if (this.onPieceClick) {
              this.onPieceClick(currentR, currentC);
            }
          });

          this.piecesLayer.appendChild(elem);
          this.pieceElements.set(piece.id, elem);
        }

        // 更新位置属性与样式
        elem.dataset.row = r;
        elem.dataset.col = c;
        elem.style.left = `${x}%`;
        elem.style.top = `${y}%`;
        elem.style.transform = `translate(-50%, -50%)`;

        // 是否选中状态
        if (this.selectedPos && this.selectedPos.r === r && this.selectedPos.c === c) {
          elem.classList.add('selected');
        } else {
          elem.classList.remove('selected');
        }
      }
    }

    // 移除已不在棋盘上的棋子 DOM（被吃掉）
    for (const [id, elem] of this.pieceElements.entries()) {
      if (!currentPieceKeys.has(id)) {
        elem.classList.add('capturing');
        setTimeout(() => {
          if (elem.parentElement) {
            elem.parentElement.removeChild(elem);
          }
          this.pieceElements.delete(id);
        }, 220);
      }
    }

    this.renderIndicators();
  }

  /**
   * 渲染落子点高亮、选中框、最后走法标记、提示标记
   */
  renderIndicators() {
    this.indicatorsLayer.innerHTML = '';

    // 1. 选中框
    if (this.selectedPos) {
      const { x, y } = this.getCoordPercent(this.selectedPos.r, this.selectedPos.c);
      const selMarker = document.createElement('div');
      selMarker.className = 'selected-marker';
      selMarker.style.left = `${x}%`;
      selMarker.style.top = `${y}%`;
      this.indicatorsLayer.appendChild(selMarker);
    }

    // 2. 最后走法标记 (起点与终点框)
    if (this.lastMove) {
      [this.lastMove.from, this.lastMove.to].forEach(pos => {
        const { x, y } = this.getCoordPercent(pos.r, pos.c);
        const marker = document.createElement('div');
        marker.className = 'last-move-marker';
        marker.style.left = `${x}%`;
        marker.style.top = `${y}%`;
        this.indicatorsLayer.appendChild(marker);
      });
    }

    // 3. AI 提示标记
    if (this.hintMove) {
      [this.hintMove.from, this.hintMove.to].forEach(pos => {
        const { x, y } = this.getCoordPercent(pos.r, pos.c);
        const marker = document.createElement('div');
        marker.className = 'hint-marker';
        marker.style.left = `${x}%`;
        marker.style.top = `${y}%`;
        this.indicatorsLayer.appendChild(marker);
      });
    }

    // 4. 合法移动点 (普通绿点 or 吃子红圈)
    for (const move of this.legalMoves) {
      const { to, captured } = move;
      const { x, y } = this.getCoordPercent(to.r, to.c);

      const marker = document.createElement('div');
      marker.className = `move-marker ${captured ? 'capture' : 'dot'}`;
      marker.style.left = `${x}%`;
      marker.style.top = `${y}%`;

      marker.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onSquareClick) {
          this.onSquareClick(to.r, to.c);
        }
      });

      this.indicatorsLayer.appendChild(marker);
    }
  }

  /**
   * 设置选中棋子及计算出的可行落子点
   */
  setSelected(pos, legalMoves = []) {
    this.selectedPos = pos;
    this.legalMoves = legalMoves;
    this.hintMove = null; // 清除提示

    // 更新棋子选中高亮
    for (const [id, elem] of this.pieceElements.entries()) {
      const r = parseInt(elem.dataset.row, 10);
      const c = parseInt(elem.dataset.col, 10);
      if (pos && pos.r === r && pos.c === c) {
        elem.classList.add('selected');
      } else {
        elem.classList.remove('selected');
      }
    }

    this.renderIndicators();
  }

  /**
   * 设置最后一步走法标记
   */
  setLastMove(move) {
    this.lastMove = move;
    this.renderIndicators();
  }

  /**
   * 设置提示走法
   */
  setHint(move) {
    this.hintMove = move;
    this.renderIndicators();
  }

  /**
   * 翻转棋盘视角
   */
  toggleFlip() {
    this.isFlipped = !this.isFlipped;
    // 重新计算并更新所有棋子位置
    for (const [id, elem] of this.pieceElements.entries()) {
      const r = parseInt(elem.dataset.row, 10);
      const c = parseInt(elem.dataset.col, 10);
      const { x, y } = this.getCoordPercent(r, c);
      elem.style.left = `${x}%`;
      elem.style.top = `${y}%`;
    }
    this.renderIndicators();
  }

  /**
   * 弹出全屏将军警示
   */
  showCheckBanner(side) {
    const banner = document.getElementById('check-banner');
    const title = document.getElementById('check-title');
    if (!banner || !title) return;

    title.textContent = '将 军 !';
    banner.classList.add('show');
    setTimeout(() => {
      banner.classList.remove('show');
    }, 1200);
  }

  /**
   * 渲染吃子收集托盘
   */
  renderCapturedTrays(capturedRed, capturedBlack) {
    const blackTray = document.getElementById('black-captured-tray'); // 黑方吃掉的红子
    const redTray = document.getElementById('red-captured-tray');     // 红方吃掉的黑子

    if (blackTray) {
      blackTray.innerHTML = '';
      capturedRed.forEach(p => {
        const span = document.createElement('span');
        span.className = 'captured-mini-piece red';
        span.textContent = PIECE_NAMES.r[p.type];
        blackTray.appendChild(span);
      });
    }

    if (redTray) {
      redTray.innerHTML = '';
      capturedBlack.forEach(p => {
        const span = document.createElement('span');
        span.className = 'captured-mini-piece black';
        span.textContent = PIECE_NAMES.b[p.type];
        redTray.appendChild(span);
      });
    }
  }

  /**
   * 渲染棋谱表格
   */
  renderMoveHistory(history) {
    const tbody = document.getElementById('history-table-body');
    const emptyTip = document.getElementById('empty-history-tip');
    const scrollBox = document.getElementById('history-scroll-box');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (history.length === 0) {
      if (emptyTip) emptyTip.style.display = 'flex';
      return;
    }
    if (emptyTip) emptyTip.style.display = 'none';

    // 2步为一个回合
    const rounds = [];
    for (let i = 0; i < history.length; i += 2) {
      rounds.push({
        roundNum: Math.floor(i / 2) + 1,
        redMove: history[i] ? history[i].notation : '',
        blackMove: history[i + 1] ? history[i + 1].notation : ''
      });
    }

    rounds.forEach((r, idx) => {
      const tr = document.createElement('tr');
      if (idx === rounds.length - 1) {
        tr.className = 'latest-turn';
      }
      tr.innerHTML = `
        <td>${r.roundNum}</td>
        <td>${r.redMove || '-'}</td>
        <td>${r.blackMove || '-'}</td>
      `;
      tbody.appendChild(tr);
    });

    // 自动滚动到底部
    if (scrollBox) {
      scrollBox.scrollTop = scrollBox.scrollHeight;
    }
  }

  /**
   * 弹出 Toast 提示
   */
  showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }
    }, 2400);
  }
}

window.ChessUI = ChessUI;
