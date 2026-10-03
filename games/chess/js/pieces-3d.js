/**
 * 王国征伐 · 3D 实体几何模型构建器 (Procedural 3D Staunton Chess Models)
 * 采用高精度高多边形 Lathe 旋转体与挤出几何体，打造奢华立体的皇家战棋
 */
const Pieces3D = (() => {
  // 材质缓存
  let materials = null;

  function initMaterials() {
    if (materials) return materials;

    // 白方材质：象牙白金大理石
    const whiteBody = new THREE.MeshStandardMaterial({
      color: 0xf6f2ea,
      roughness: 0.2,
      metalness: 0.15,
      shadowSide: THREE.DoubleSide
    });
    const whiteGold = new THREE.MeshStandardMaterial({
      color: 0xe8be54,
      roughness: 0.25,
      metalness: 0.85
    });
    const whiteGem = new THREE.MeshStandardMaterial({
      color: 0x1e88e5,
      roughness: 0.1,
      metalness: 0.3,
      emissive: 0x0d47a1,
      emissiveIntensity: 0.35
    });

    // 黑方材质：锻铁暗曜石与古铜金
    const blackBody = new THREE.MeshStandardMaterial({
      color: 0x221f28,
      roughness: 0.25,
      metalness: 0.4,
      shadowSide: THREE.DoubleSide
    });
    const blackGold = new THREE.MeshStandardMaterial({
      color: 0xb57328,
      roughness: 0.3,
      metalness: 0.8
    });
    const blackGem = new THREE.MeshStandardMaterial({
      color: 0xd32f2f,
      roughness: 0.1,
      metalness: 0.3,
      emissive: 0xb71c1c,
      emissiveIntensity: 0.4
    });

    materials = {
      w: { body: whiteBody, gold: whiteGold, gem: whiteGem },
      b: { body: blackBody, gold: blackGold, gem: blackGem }
    };
    return materials;
  }

  // 辅助：根据2D轮廓点生成高平滑 Lathe 旋转体
  function createLathe(points, segments = 36) {
    const pts = points.map(p => new THREE.Vector2(p[0], p[1]));
    return new THREE.LatheGeometry(pts, segments);
  }

  /**
   * ♟️ 3D 步兵 (Pawn)
   */
  function createPawnGeo() {
    const profile = [
      [0.0, 0.0],
      [0.34, 0.0],
      [0.34, 0.04],
      [0.30, 0.08],
      [0.28, 0.14],
      [0.20, 0.22],
      [0.17, 0.38],
      [0.14, 0.52],
      [0.22, 0.55],
      [0.20, 0.58],
      [0.12, 0.60],
      [0.18, 0.68],
      [0.20, 0.78],
      [0.16, 0.88],
      [0.0, 0.94]
    ];
    return createLathe(profile);
  }

  /**
   * 🏰 3D 城堡/要塞 (Rook)
   */
  function createRookGroup(mats) {
    const group = new THREE.Group();
    // 塔身旋转体
    const profile = [
      [0.0, 0.0],
      [0.36, 0.0],
      [0.36, 0.05],
      [0.31, 0.10],
      [0.28, 0.16],
      [0.22, 0.28],
      [0.20, 0.58],
      [0.28, 0.68],
      [0.31, 0.72],
      [0.31, 0.95],
      [0.24, 0.95],
      [0.24, 0.82],
      [0.0, 0.82]
    ];
    const body = new THREE.Mesh(createLathe(profile), mats.body);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // 顶部黄金饰环
    const ringGeo = new THREE.TorusGeometry(0.30, 0.025, 16, 32);
    ringGeo.rotateX(Math.PI / 2);
    ringGeo.translate(0, 0.70, 0);
    const ring = new THREE.Mesh(ringGeo, mats.gold);
    ring.castShadow = true;
    group.add(ring);

    return group;
  }

  /**
   * 🐴 3D 战马/骑士 (Knight)
   */
  function createKnightGroup(mats) {
    const group = new THREE.Group();

    // 旋转基座
    const baseProfile = [
      [0.0, 0.0],
      [0.36, 0.0],
      [0.36, 0.05],
      [0.31, 0.10],
      [0.28, 0.16],
      [0.24, 0.24],
      [0.22, 0.28],
      [0.0, 0.28]
    ];
    const base = new THREE.Mesh(createLathe(baseProfile), mats.body);
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // 马首挤出造型
    const shape = new THREE.Shape();
    shape.moveTo(-0.16, 0.28);
    shape.lineTo(0.18, 0.28);
    shape.quadraticCurveTo(0.24, 0.45, 0.26, 0.60);
    shape.lineTo(0.32, 0.68); // 吻部鼻端
    shape.lineTo(0.28, 0.76);
    shape.lineTo(0.18, 0.78);
    shape.lineTo(0.16, 0.92); // 马耳尖端
    shape.lineTo(0.08, 0.86);
    shape.quadraticCurveTo(-0.06, 0.78, -0.16, 0.60);
    shape.quadraticCurveTo(-0.22, 0.42, -0.16, 0.28);

    const extrudeSettings = {
      steps: 1,
      depth: 0.18,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.03,
      bevelSegments: 4
    };
    const horseGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    horseGeo.center();
    horseGeo.translate(0, 0.60, 0);

    const horse = new THREE.Mesh(horseGeo, mats.body);
    horse.castShadow = true;
    horse.receiveShadow = true;
    group.add(horse);

    // 金色战马眼眸与缰绳
    const eyeGeo = new THREE.SphereGeometry(0.032, 12, 12);
    const leftEye = new THREE.Mesh(eyeGeo, mats.gem);
    leftEye.position.set(0.10, 0.72, 0.10);
    const rightEye = new THREE.Mesh(eyeGeo, mats.gem);
    rightEye.position.set(0.10, 0.72, -0.10);
    group.add(leftEye, rightEye);

    return group;
  }

  /**
   * 🧙 3D 主教/象 (Bishop)
   */
  function createBishopGroup(mats) {
    const group = new THREE.Group();

    const profile = [
      [0.0, 0.0],
      [0.35, 0.0],
      [0.35, 0.05],
      [0.30, 0.10],
      [0.27, 0.16],
      [0.19, 0.28],
      [0.16, 0.50],
      [0.23, 0.55],
      [0.20, 0.59],
      [0.14, 0.62],
      [0.22, 0.74],
      [0.20, 0.92],
      [0.12, 1.05],
      [0.04, 1.10],
      [0.0, 1.12]
    ];
    const body = new THREE.Mesh(createLathe(profile), mats.body);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // 主教金顶圣珠
    const finialGeo = new THREE.SphereGeometry(0.055, 16, 16);
    finialGeo.translate(0, 1.16, 0);
    const finial = new THREE.Mesh(finialGeo, mats.gold);
    finial.castShadow = true;
    group.add(finial);

    return group;
  }

  /**
   * 👸 3D 王后 (Queen)
   */
  function createQueenGroup(mats) {
    const group = new THREE.Group();

    const profile = [
      [0.0, 0.0],
      [0.38, 0.0],
      [0.38, 0.05],
      [0.32, 0.10],
      [0.29, 0.16],
      [0.20, 0.28],
      [0.17, 0.58],
      [0.25, 0.65],
      [0.22, 0.70],
      [0.15, 0.73],
      [0.24, 0.90],
      [0.28, 1.12],
      [0.22, 1.18],
      [0.0, 1.18]
    ];
    const body = new THREE.Mesh(createLathe(profile), mats.body);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // 王后多颗金顶冠珠
    const crownCount = 8;
    const radius = 0.22;
    for (let i = 0; i < crownCount; i++) {
      const angle = (i / crownCount) * Math.PI * 2;
      const beadGeo = new THREE.SphereGeometry(0.032, 12, 12);
      beadGeo.translate(Math.cos(angle) * radius, 1.20, Math.sin(angle) * radius);
      const bead = new THREE.Mesh(beadGeo, mats.gold);
      bead.castShadow = true;
      group.add(bead);
    }

    // 中央璀璨魔晶宝珠
    const topJewelGeo = new THREE.SphereGeometry(0.065, 16, 16);
    topJewelGeo.translate(0, 1.24, 0);
    const topJewel = new THREE.Mesh(topJewelGeo, mats.gem);
    topJewel.castShadow = true;
    group.add(topJewel);

    return group;
  }

  /**
   * 👑 3D 国王 (King)
   */
  function createKingGroup(mats) {
    const group = new THREE.Group();

    const profile = [
      [0.0, 0.0],
      [0.40, 0.0],
      [0.40, 0.05],
      [0.34, 0.10],
      [0.30, 0.16],
      [0.22, 0.30],
      [0.18, 0.64],
      [0.28, 0.72],
      [0.24, 0.78],
      [0.17, 0.82],
      [0.27, 1.02],
      [0.30, 1.22],
      [0.24, 1.28],
      [0.0, 1.28]
    ];
    const body = new THREE.Mesh(createLathe(profile), mats.body);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // 皇冠金边饰带
    const bandGeo = new THREE.TorusGeometry(0.28, 0.03, 16, 32);
    bandGeo.rotateX(Math.PI / 2);
    bandGeo.translate(0, 1.22, 0);
    const band = new THREE.Mesh(bandGeo, mats.gold);
    band.castShadow = true;
    group.add(band);

    // 顶部立体皇家十字圣印
    const crossGroup = new THREE.Group();
    const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.06), mats.gold);
    vBar.position.y = 1.40;
    const hBar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.06), mats.gold);
    hBar.position.y = 1.43;
    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), mats.gem);
    gem.position.y = 1.43;

    crossGroup.add(vBar, hBar, gem);
    crossGroup.traverse(obj => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    group.add(crossGroup);

    return group;
  }

  return {
    init() {
      initMaterials();
    },

    createPieceMesh(type, color) {
      initMaterials();
      const mats = materials[color];
      let pieceObj = null;

      switch (type.toLowerCase()) {
        case 'p': {
          const geo = createPawnGeo();
          pieceObj = new THREE.Mesh(geo, mats.body);
          pieceObj.castShadow = true;
          pieceObj.receiveShadow = true;
          break;
        }
        case 'r':
          pieceObj = createRookGroup(mats);
          break;
        case 'n':
          pieceObj = createKnightGroup(mats);
          // 白方战马朝前（黑方朝向玩家），黑方战马背向玩家
          if (color === 'w') {
            pieceObj.rotation.y = 0;
          } else {
            pieceObj.rotation.y = Math.PI;
          }
          break;
        case 'b':
          pieceObj = createBishopGroup(mats);
          break;
        case 'q':
          pieceObj = createQueenGroup(mats);
          break;
        case 'k':
          pieceObj = createKingGroup(mats);
          break;
        default:
          return null;
      }

      // 缩放适配棋盘尺寸
      pieceObj.scale.set(1.4, 1.4, 1.4);
      return pieceObj;
    }
  };
})();
