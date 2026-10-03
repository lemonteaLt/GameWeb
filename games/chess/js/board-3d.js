/**
 * 王国征伐 · 3D 棋盘渲染与交互引擎 (Three.js 3D Chess Board & Scene Manager)
 * 具备：高精度 3D 棋盘格纹理、四周立体金铸坐标刻度 (a-h, 1-8)、实时阴影与平滑跳跃动画
 */
class Board3D {
  constructor(containerId, onSquareClicked) {
    this.container = document.getElementById(containerId);
    this.onSquareClicked = onSquareClicked;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // 棋盘几何参数
    this.squareSize = 1.6;
    this.boardOffset = 3.5 * this.squareSize; // 中心化
    this.squareMeshes = []; // 8x8
    this.pieceMeshes = Array(8).fill(null).map(() => Array(8).fill(null));

    // 坐标刻度标牌组
    this.coordsGroup = new THREE.Group();
    this.highlightGroup = new THREE.Group();
    this.animatingPieces = [];

    // 相机视角预设
    this.isFlipped = false;
    this.cameraMode = '3d'; // '3d', 'top', 'cinema'

    this.init();
  }

  init() {
    Pieces3D.init();

    // 1. 场景
    this.scene = new THREE.Scene();
    this.scene.background = null;

    // 2. 容器尺寸
    const width = this.container.clientWidth || 640;
    const height = this.container.clientHeight || 580;

    // 3. 相机
    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    this.updateCameraPosition();

    // 4. 渲染器
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    // 5. 轨道控制器
    if (typeof THREE.OrbitControls !== 'undefined') {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // 禁止穿入地底
      this.controls.minDistance = 8;
      this.controls.maxDistance = 32;
      this.controls.target.set(0, 0, 0);
    }

    // 6. 光照系统
    this.setupLighting();

    // 7. 构建3D实体棋盘与格子格线
    this.buildBoard();

    // 8. 挂载刻度与高亮组
    this.scene.add(this.coordsGroup);
    this.scene.add(this.highlightGroup);
    this.updateCoordinatesDisplay();

    // 9. 事件绑定
    this.pointerDownPos = { x: 0, y: 0 };
    window.addEventListener('resize', () => this.onResize());
    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
    });
    this.renderer.domElement.addEventListener('pointerup', (e) => {
      if (e.button !== 0) return; // 仅左键点击响应走棋
      const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
      if (dist < 6) { // 阈值判定为单击而非镜头拖拽
        this.handleClickAt(e.clientX, e.clientY);
      }
    });

    // 10. 启动渲染循环
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  setupLighting() {
    // 环境柔光
    const ambientLight = new THREE.AmbientLight(0xdde5f0, 0.7);
    this.scene.add(ambientLight);

    // 主平行阳光 (投射软阴影)
    const mainSun = new THREE.DirectionalLight(0xfff4e0, 1.45);
    mainSun.position.set(12, 22, 14);
    mainSun.castShadow = true;
    mainSun.shadow.mapSize.width = 2048;
    mainSun.shadow.mapSize.height = 2048;
    mainSun.shadow.camera.near = 0.5;
    mainSun.shadow.camera.far = 50;
    const d = 10;
    mainSun.shadow.camera.left = -d;
    mainSun.shadow.camera.right = d;
    mainSun.shadow.camera.top = d;
    mainSun.shadow.camera.bottom = -d;
    mainSun.shadow.bias = -0.0005;
    this.scene.add(mainSun);

    // 侧翼冷色轮廓光
    const rimLight = new THREE.DirectionalLight(0x42a5f5, 0.6);
    rimLight.position.set(-14, 10, -12);
    this.scene.add(rimLight);

    // 棋盘中心暖调点光源
    const centerWarmth = new THREE.PointLight(0xffb74d, 0.45, 25);
    centerWarmth.position.set(0, 6, 0);
    this.scene.add(centerWarmth);
  }

  // 生成高精度文字 Canvas 材质 (用于棋盘四周边框上的 1-8 和 a-h)
  createLabelTexture(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);

    ctx.font = 'bold 74px "Cinzel", "Noto Serif SC", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 金色浮雕质感
    ctx.fillStyle = '#e8be54';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillText(text, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    return texture;
  }

  buildBoard() {
    const boardGroup = new THREE.Group();

    // 浅色格材质 (古雅象牙白金大理石，带微倒角凹槽)
    const lightMat = new THREE.MeshStandardMaterial({
      color: 0xf0e6d6,
      roughness: 0.25,
      metalness: 0.08
    });
    // 深色格材质 (皇家深核桃木)
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x423122,
      roughness: 0.35,
      metalness: 0.12
    });
    // 格子间隙金边/黑胡桃嵌缝材质
    const gapMat = new THREE.MeshStandardMaterial({
      color: 0x18130e,
      roughness: 0.5,
      metalness: 0.3
    });

    // 64个单独的实体棋盘方格
    const cellWidth = this.squareSize - 0.02;
    const squareGeo = new THREE.BoxGeometry(cellWidth, 0.35, cellWidth);

    this.squareMeshes = [];
    for (let r = 0; r < 8; r++) {
      this.squareMeshes[r] = [];
      for (let c = 0; c < 8; c++) {
        const isLight = (r + c) % 2 === 0;
        const mesh = new THREE.Mesh(squareGeo, isLight ? lightMat : darkMat);
        const x = c * this.squareSize - this.boardOffset;
        const z = r * this.squareSize - this.boardOffset;
        mesh.position.set(x, 0, z);
        mesh.receiveShadow = true;
        mesh.userData = { r, c, type: 'square' };

        // 方格边缘黑色描边嵌线
        const edges = new THREE.EdgesGeometry(squareGeo);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x1a120b, linewidth: 1.5 }));
        mesh.add(line);

        boardGroup.add(mesh);
        this.squareMeshes[r][c] = mesh;
      }
    }

    // 棋盘方格底板与嵌缝底层
    const gridBedSize = 8 * this.squareSize;
    const gridBedMesh = new THREE.Mesh(new THREE.BoxGeometry(gridBedSize, 0.33, gridBedSize), gapMat);
    gridBedMesh.position.set(0, -0.01, 0);
    gridBedMesh.receiveShadow = true;
    boardGroup.add(gridBedMesh);

    // ==========================================
    // 3D 实体黑色网格分割线系统 (9条横线 + 9条纵线)
    // ==========================================
    const gridLineMat = new THREE.MeshStandardMaterial({
      color: 0x141217,
      roughness: 0.45,
      metalness: 0.15
    });

    const studMat = new THREE.MeshStandardMaterial({
      color: 0x25202a,
      roughness: 0.4,
      metalness: 0.2
    });

    const gridThickness = 0.045;
    const gridHeight = 0.025;
    const totalSpan = 8 * this.squareSize;

    // 9条沿 X 轴的横向黑色网格分割线
    const hLineGeo = new THREE.BoxGeometry(totalSpan + 0.06, gridHeight, gridThickness);
    for (let i = 0; i <= 8; i++) {
      const zPos = i * this.squareSize - this.boardOffset - this.squareSize / 2;
      const lineMesh = new THREE.Mesh(hLineGeo, gridLineMat);
      lineMesh.position.set(0, 0.18, zPos);
      lineMesh.receiveShadow = true;
      boardGroup.add(lineMesh);
    }

    // 9条沿 Z 轴的纵向黑色网格分割线
    const vLineGeo = new THREE.BoxGeometry(gridThickness, gridHeight, totalSpan + 0.06);
    for (let j = 0; j <= 8; j++) {
      const xPos = j * this.squareSize - this.boardOffset - this.squareSize / 2;
      const lineMesh = new THREE.Mesh(vLineGeo, gridLineMat);
      lineMesh.position.set(xPos, 0.18, 0);
      lineMesh.receiveShadow = true;
      boardGroup.add(lineMesh);
    }

    // 81个网格交叉点的深色铆钉饰扣 (Grid Intersection Rivets)
    const studGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.035, 12);
    for (let i = 0; i <= 8; i++) {
      const zPos = i * this.squareSize - this.boardOffset - this.squareSize / 2;
      for (let j = 0; j <= 8; j++) {
        const xPos = j * this.squareSize - this.boardOffset - this.squareSize / 2;
        const stud = new THREE.Mesh(studGeo, studMat);
        stud.position.set(xPos, 0.185, zPos);
        boardGroup.add(stud);
      }
    }

    // 棋盘外框厚重大理石与黑胡桃木边框
    const frameSize = 8 * this.squareSize + 2.0;
    const frameHeight = 0.65;
    const frameGeo = new THREE.BoxGeometry(frameSize, frameHeight, frameSize);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x1f1915,
      roughness: 0.38,
      metalness: 0.22
    });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    frameMesh.position.set(0, -0.16, 0);
    frameMesh.receiveShadow = true;
    boardGroup.add(frameMesh);

    // 边框内外双层黄金饰条
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.22,
      metalness: 0.85
    });

    const innerTrimGeo = new THREE.BoxGeometry(gridBedSize + 0.16, 0.06, gridBedSize + 0.16);
    const innerTrimMesh = new THREE.Mesh(innerTrimGeo, trimMat);
    innerTrimMesh.position.set(0, 0.17, 0);
    boardGroup.add(innerTrimMesh);

    const outerTrimGeo = new THREE.BoxGeometry(frameSize - 0.05, 0.08, frameSize - 0.05);
    const outerTrimMesh = new THREE.Mesh(outerTrimGeo, trimMat);
    outerTrimMesh.position.set(0, 0.16, 0);
    boardGroup.add(outerTrimMesh);

    // 4个边角的黄铜加固雕花包角 (Brass Corner Brackets)
    const cornerSize = 0.85;
    const cornerGeo = new THREE.BoxGeometry(cornerSize, 0.10, cornerSize);
    const cornerOffset = frameSize / 2 - cornerSize / 2;
    [
      [-cornerOffset, -cornerOffset],
      [-cornerOffset, cornerOffset],
      [cornerOffset, -cornerOffset],
      [cornerOffset, cornerOffset]
    ].forEach(([cx, cz]) => {
      const cornerMesh = new THREE.Mesh(cornerGeo, trimMat);
      cornerMesh.position.set(cx, 0.18, cz);
      boardGroup.add(cornerMesh);
    });

    this.scene.add(boardGroup);
  }

  // 刷新棋盘四周边框上的 3D 坐标刻度 (a-h 和 1-8)
  updateCoordinatesDisplay() {
    while (this.coordsGroup.children.length > 0) {
      const obj = this.coordsGroup.children[0];
      this.coordsGroup.remove(obj);
    }

    const files = this.isFlipped 
      ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a']
      : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

    const ranks = this.isFlipped
      ? ['1', '2', '3', '4', '5', '6', '7', '8']
      : ['8', '7', '6', '5', '4', '3', '2', '1'];

    const labelSize = 0.65;
    const labelGeo = new THREE.PlaneGeometry(labelSize, labelSize);
    labelGeo.rotateX(-Math.PI / 2);

    const borderDist = this.boardOffset + 0.62;

    // 1. 南北两侧横向字母 (a-h)
    for (let c = 0; c < 8; c++) {
      const x = c * this.squareSize - this.boardOffset;
      const fileChar = files[c];

      // 南边 (面向玩家)
      const southMat = new THREE.MeshBasicMaterial({
        map: this.createLabelTexture(fileChar),
        transparent: true,
        depthWrite: false
      });
      const southMesh = new THREE.Mesh(labelGeo, southMat);
      southMesh.position.set(x, 0.19, borderDist);
      this.coordsGroup.add(southMesh);

      // 北边 (面向对面)
      const northMat = new THREE.MeshBasicMaterial({
        map: this.createLabelTexture(fileChar),
        transparent: true,
        depthWrite: false
      });
      const northMesh = new THREE.Mesh(labelGeo, northMat);
      northMesh.position.set(x, 0.19, -borderDist);
      northMesh.rotation.y = Math.PI; // 倒向对面方便阅读
      this.coordsGroup.add(northMesh);
    }

    // 2. 东西两侧纵向数字 (1-8)
    for (let r = 0; r < 8; r++) {
      const z = r * this.squareSize - this.boardOffset;
      const rankChar = ranks[r];

      // 西边 (左侧)
      const westMat = new THREE.MeshBasicMaterial({
        map: this.createLabelTexture(rankChar),
        transparent: true,
        depthWrite: false
      });
      const westMesh = new THREE.Mesh(labelGeo, westMat);
      westMesh.position.set(-borderDist, 0.19, z);
      this.coordsGroup.add(westMesh);

      // 东边 (右侧)
      const eastMat = new THREE.MeshBasicMaterial({
        map: this.createLabelTexture(rankChar),
        transparent: true,
        depthWrite: false
      });
      const eastMesh = new THREE.Mesh(labelGeo, eastMat);
      eastMesh.position.set(borderDist, 0.19, z);
      this.coordsGroup.add(eastMesh);
    }
  }

  // 计算格子 3D 世界坐标
  getSquareWorldPos(r, c) {
    const x = c * this.squareSize - this.boardOffset;
    const z = r * this.squareSize - this.boardOffset;
    return new THREE.Vector3(x, 0.18, z);
  }

  // 同步 3D 棋子实体模型
  syncBoard(engine) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.pieceMeshes[r][c]) {
          this.scene.remove(this.pieceMeshes[r][c]);
          this.pieceMeshes[r][c] = null;
        }
      }
    }

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = engine.getPiece(r, c);
        if (piece) {
          const mesh = Pieces3D.createPieceMesh(piece.type, piece.color);
          if (mesh) {
            const pos = this.getSquareWorldPos(r, c);
            mesh.position.copy(pos);
            mesh.userData = { r, c, type: 'piece', color: piece.color, pType: piece.type };
            this.scene.add(mesh);
            this.pieceMeshes[r][c] = mesh;
          }
        }
      }
    }
  }

  // 平滑动画移动棋子（抛物线跳跃）
  animatePieceMove(from, to, onComplete) {
    const pieceMesh = this.pieceMeshes[from.r][from.c];
    if (!pieceMesh) {
      if (onComplete) onComplete();
      return;
    }

    if (this.pieceMeshes[to.r][to.c]) {
      this.scene.remove(this.pieceMeshes[to.r][to.c]);
      this.pieceMeshes[to.r][to.c] = null;
    }

    const startPos = this.getSquareWorldPos(from.r, from.c);
    const endPos = this.getSquareWorldPos(to.r, to.c);

    this.pieceMeshes[from.r][from.c] = null;
    this.pieceMeshes[to.r][to.c] = pieceMesh;
    pieceMesh.userData.r = to.r;
    pieceMesh.userData.c = to.c;

    const anim = {
      mesh: pieceMesh,
      start: startPos,
      end: endPos,
      progress: 0,
      duration: 260,
      startTime: performance.now(),
      onComplete
    };
    this.animatingPieces.push(anim);
  }

  // 渲染高亮标记
  updateHighlights(selectedSquare, legalMoves, kingInCheckPos, lastMove) {
    while (this.highlightGroup.children.length > 0) {
      const obj = this.highlightGroup.children[0];
      this.highlightGroup.remove(obj);
    }

    // 1. 上一步走法高亮 (金色发光方盘)
    if (lastMove) {
      [lastMove.from, lastMove.to].forEach(pos => {
        const p = this.getSquareWorldPos(pos.r, pos.c);
        const geo = new THREE.PlaneGeometry(this.squareSize * 0.94, this.squareSize * 0.94);
        geo.rotateX(-Math.PI / 2);
        const mat = new THREE.MeshBasicMaterial({
          color: 0xffd54f,
          transparent: true,
          opacity: 0.38,
          depthWrite: false
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(p.x, 0.19, p.z);
        this.highlightGroup.add(mesh);
      });
    }

    // 2. 选中棋子高亮 (蔚蓝发光法阵底盘)
    if (selectedSquare) {
      const p = this.getSquareWorldPos(selectedSquare.r, selectedSquare.c);
      const ringGeo = new THREE.RingGeometry(0.2, this.squareSize * 0.44, 32);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x1e88e5,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.set(p.x, 0.20, p.z);
      this.highlightGroup.add(ringMesh);

      const selectedPieceMesh = this.pieceMeshes[selectedSquare.r][selectedSquare.c];
      if (selectedPieceMesh) {
        selectedPieceMesh.position.y = 0.55;
      }
    }

    // 重置未选中棋子高度
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (!selectedSquare || selectedSquare.r !== r || selectedSquare.c !== c) {
          if (this.pieceMeshes[r][c]) {
            this.pieceMeshes[r][c].position.y = 0.18;
          }
        }
      }
    }

    // 3. 可行走法指示 (蔚蓝圆点 / 赤红吃子双环)
    if (legalMoves && legalMoves.length > 0) {
      legalMoves.forEach(m => {
        const p = this.getSquareWorldPos(m.to.r, m.to.c);
        if (m.isCapture) {
          const ringGeo = new THREE.RingGeometry(this.squareSize * 0.35, this.squareSize * 0.46, 32);
          ringGeo.rotateX(-Math.PI / 2);
          const ringMat = new THREE.MeshBasicMaterial({
            color: 0xd32f2f,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide,
            depthWrite: false
          });
          const ringMesh = new THREE.Mesh(ringGeo, ringMat);
          ringMesh.position.set(p.x, 0.21, p.z);
          this.highlightGroup.add(ringMesh);
        } else {
          const dotGeo = new THREE.CircleGeometry(0.24, 24);
          dotGeo.rotateX(-Math.PI / 2);
          const dotMat = new THREE.MeshBasicMaterial({
            color: 0x64b5f6,
            transparent: true,
            opacity: 0.85,
            depthWrite: false
          });
          const dotMesh = new THREE.Mesh(dotGeo, dotMat);
          dotMesh.position.set(p.x, 0.21, p.z);
          this.highlightGroup.add(dotMesh);
        }
      });
    }

    // 4. 国王受威胁 (将军血色光环)
    if (kingInCheckPos) {
      const p = this.getSquareWorldPos(kingInCheckPos.r, kingInCheckPos.c);
      const checkGeo = new THREE.CircleGeometry(this.squareSize * 0.46, 32);
      checkGeo.rotateX(-Math.PI / 2);
      const checkMat = new THREE.MeshBasicMaterial({
        color: 0xe53935,
        transparent: true,
        opacity: 0.65,
        depthWrite: false
      });
      const checkMesh = new THREE.Mesh(checkGeo, checkMat);
      checkMesh.position.set(p.x, 0.20, p.z);
      this.highlightGroup.add(checkMesh);
    }
  }

  // 3D 棋盘与棋子点击判定 (支持直接物体射线命中 + 棋盘平面坐标几何反求双重保险)
  handleClickAt(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // 1. 优先检测是否直接点中了具体 3D 棋子
    const pieceObjs = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.pieceMeshes[r][c]) pieceObjs.push(this.pieceMeshes[r][c]);
      }
    }
    const pieceHits = this.raycaster.intersectObjects(pieceObjs, true);
    if (pieceHits.length > 0) {
      for (const hit of pieceHits) {
        let cur = hit.object;
        while (cur && (!cur.userData || !cur.userData.type) && cur.parent) {
          cur = cur.parent;
        }
        if (cur && cur.userData && cur.userData.type === 'piece') {
          this.onSquareClicked(cur.userData.r, cur.userData.c);
          return;
        }
      }
    }

    // 2. 无论点击空地、指示光标、网格线或微隙，通过 y=0.18 水平棋盘进行几何反求
    const boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.18);
    const hitPoint = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(boardPlane, hitPoint)) {
      const c = Math.round((hitPoint.x + this.boardOffset) / this.squareSize);
      const r = Math.round((hitPoint.z + this.boardOffset) / this.squareSize);
      if (r >= 0 && r < 8 && c >= 0 && c < 8) {
        this.onSquareClicked(r, c);
        return;
      }
    }
  }

  setCameraMode(mode) {
    this.cameraMode = mode;
    this.updateCameraPosition();
  }

  setFlipped(flipped) {
    this.isFlipped = flipped;
    this.updateCameraPosition();
    this.updateCoordinatesDisplay();
  }

  updateCameraPosition() {
    const flipFactor = this.isFlipped ? -1 : 1;

    if (this.cameraMode === 'top') {
      this.camera.position.set(0, 21, 0.01 * flipFactor);
    } else if (this.cameraMode === 'cinema') {
      this.camera.position.set(0, 8.5, 12 * flipFactor);
    } else {
      this.camera.position.set(0, 14, 15.5 * flipFactor);
    }

    this.camera.lookAt(0, 0, 0);
    if (this.controls) {
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    }
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate(now) {
    requestAnimationFrame(this.animate);

    if (this.animatingPieces.length > 0) {
      for (let i = this.animatingPieces.length - 1; i >= 0; i--) {
        const anim = this.animatingPieces[i];
        const elapsed = now - anim.startTime;
        const progress = Math.min(elapsed / anim.duration, 1);

        const curX = THREE.MathUtils.lerp(anim.start.x, anim.end.x, progress);
        const curZ = THREE.MathUtils.lerp(anim.start.z, anim.end.z, progress);
        const jumpHeight = Math.sin(progress * Math.PI) * 1.6;
        const curY = THREE.MathUtils.lerp(anim.start.y, anim.end.y, progress) + jumpHeight;

        anim.mesh.position.set(curX, curY, curZ);

        if (progress >= 1) {
          anim.mesh.position.copy(anim.end);
          if (anim.onComplete) anim.onComplete();
          this.animatingPieces.splice(i, 1);
        }
      }
    }

    if (this.controls) {
      this.controls.update();
    }

    this.renderer.render(this.scene, this.camera);
  }
}
