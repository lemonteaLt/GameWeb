/**
 * 内置小游戏元数据清单 (初始清空状态)
 */
const DEFAULT_CATEGORIES = [
  { id: "puzzle", name: "益智解谜", icon: "🧩", desc: "开动脑筋，挑战智力极限" },
  { id: "action", name: "敏捷反应", icon: "⚡", desc: "手速与专注力的终极对决" },
  { id: "arcade", name: "复古街机", icon: "🎮", desc: "重温经典童年街机厅快感" },
  { id: "board", name: "策略棋牌", icon: "♟️", desc: "运筹帷幄，方寸之间决胜负" },
  { id: "casual", name: "休闲解压", icon: "🛋️", desc: "轻松惬意，随时随地来一局" },
  { id: "custom", name: "玩家工坊", icon: "🛠️", desc: "本地后台导入的自制游戏" }
];

const DEFAULT_GAMES = [
  {
    id: "game_pixel_snake",
    title: "像素贪吃蛇",
    category: "action",
    categoryName: "敏捷反应",
    icon: "🐍",
    bgGradient: "linear-gradient(135deg, #10b981, #059669)",
    description: "复古街机像素风贪吃蛇！支持简单/普通/困难/地狱4档难度，吃苹果长身体，更有华丽粒子与撞击音效！",
    controls: "【方向键】或【WASD】控制移动，【空格】开始或再来一局，【ESC】退出",
    entryPath: "games/snake/index.html",
    isBuiltin: true,
    rankings: [
      { player: "街机蛇王", score: 860, date: "2026-09-28" },
      { player: "像素大师", score: 520, date: "2026-09-29" },
      { player: "贪吃新手", score: 180, date: "2026-09-29" }
    ]
  },
  {
    id: "game_2048_evolve",
    title: "2048 荣耀进化版",
    category: "puzzle",
    categoryName: "益智解谜",
    icon: "🔢",
    bgGradient: "linear-gradient(135deg, #f59e0b, #d97706)",
    description: "经典 2048 视觉大进化！包含 16 阶方块进化图鉴（从初生微尘到彩虹钻石）、体积微溢膨胀与动态呼吸光效，滑动合并数字向 2048 及更高神级数字发起冲击！",
    controls: "【方向键】或【WASD】或【屏幕滑动】移动合并方块，【ESC】退出",
    entryPath: "games/2048/index.html",
    isBuiltin: true,
    rankings: [
      { player: "合成宗师", score: 18560, date: "2026-10-01" },
      { player: "金冠王者", score: 8192, date: "2026-10-01" },
      { player: "数字达人", score: 2048, date: "2026-10-01" }
    ]
  },
  {
    id: "game_xiangqi",
    title: "中国象棋 (新中式极简)",
    category: "board",
    categoryName: "策略棋牌",
    icon: "♟️",
    bgGradient: "linear-gradient(135deg, #78350f, #451a03)",
    description: "新中式典雅水墨风中国象棋！搭载智能多级 AI（初学/进阶/精通）、顺畅走棋吃子音效与将军动画，支持人机对弈与悔棋复盘！",
    controls: "【鼠标左键点击】选中棋子并落子，【ESC】退出",
    entryPath: "games/xiangqi/index.html",
    isBuiltin: true,
    rankings: [
      { player: "九段国手", score: 680, date: "2026-10-01" },
      { player: "弈林高隐", score: 380, date: "2026-10-01" },
      { player: "对弈新手", score: 150, date: "2026-10-01" }
    ]
  },
  {
    id: "game_chess_3d",
    title: "王国征伐 · 3D史诗国际象棋",
    category: "board",
    categoryName: "策略棋牌",
    icon: "👑",
    bgGradient: "linear-gradient(135deg, #1e1b4b, #312e81)",
    description: "3D 中世纪史诗沙盘国际象棋！支持 3D 自由旋转/俯视视角、真实光影与金属击打音效，圣狮白金骑士团 VS 铁龙帝国，智能 AI 推演对弈！",
    controls: "【鼠标左键】点选走棋，【鼠标右键拖动】旋转视角，【滚轮】缩放视角，【ESC】退出",
    entryPath: "games/chess/index.html",
    isBuiltin: true,
    rankings: [
      { player: "特级大师 (GM)", score: 920, date: "2026-10-02" },
      { player: "圣狮大领主", score: 650, date: "2026-10-02" },
      { player: "王国骑士", score: 320, date: "2026-10-02" }
    ]
  }
];

const PRESET_AVATARS = ["🧙‍♂️", "👾", "🐱", "🤖", "🚀", "🦊", "🎮", "⚡"];
