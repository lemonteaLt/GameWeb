/**
 * 主应用程序入口与交互调度 (App Core Controller)
 */
document.addEventListener("DOMContentLoaded", () => {
  // 基础 DOM
  const navTabs = document.querySelectorAll(".nav-tab-btn");
  const viewSections = {
    all: document.getElementById("viewAll"),
    categories: document.getElementById("viewCategories"),
    categoryDetail: document.getElementById("viewCategoryDetail"),
    profile: document.getElementById("viewProfile")
  };

  const allGamesGrid = document.getElementById("allGamesGrid");
  const categoryMatrixGrid = document.getElementById("categoryMatrixGrid");
  const categoryDetailGrid = document.getElementById("categoryDetailGrid");
  const categoryDetailTitle = document.getElementById("categoryDetailTitle");
  const backToMatrixBtn = document.getElementById("backToMatrixBtn");

  const searchInput = document.getElementById("searchInput");
  const muteBtn = document.getElementById("muteBtn");

  // 用户认证与顶栏
  const navLoginBtn = document.getElementById("navLoginBtn");
  const userBadge = document.getElementById("userBadge");
  const userBadgeAvatar = document.getElementById("userBadgeAvatar");
  const userBadgeName = document.getElementById("userBadgeName");
  const userRoleBadge = document.getElementById("userRoleBadge");
  const userDropdownMenu = document.getElementById("userDropdownMenu");
  const menuMyProfile = document.getElementById("menuMyProfile");
  const menuAdminPortal = document.getElementById("menuAdminPortal");
  const menuWorkbench = document.getElementById("menuWorkbench");
  const menuLogout = document.getElementById("menuLogout");

  // 认证弹窗
  const authModal = document.getElementById("authModal");
  const closeAuthBtn = document.getElementById("closeAuthBtn");
  const tabAuthLogin = document.getElementById("tabAuthLogin");
  const tabAuthRegister = document.getElementById("tabAuthRegister");
  const tabAuthForgot = document.getElementById("tabAuthForgot");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const forgotForm = document.getElementById("forgotForm");
  const btnSendResetCode = document.getElementById("btnSendResetCode");

  // “我的”页面
  const profileAvatarLarge = document.getElementById("profileAvatarLarge");
  const profileNicknameInput = document.getElementById("profileNicknameInput");
  const profileRoleBadge = document.getElementById("profileRoleBadge");
  const userBadgesWall = document.getElementById("userBadgesWall");
  const statFavoritesCount = document.getElementById("statFavoritesCount");
  const statHistoryCount = document.getElementById("statHistoryCount");
  const profileTabBtns = document.querySelectorAll(".profile-tab-btn");

  const profileFavoritesContainer = document.getElementById("profileFavoritesContainer");
  const profileHistoryContainer = document.getElementById("profileHistoryContainer");
  const profileSubmissionsContainer = document.getElementById("profileSubmissionsContainer");
  const profileApplyStaffContainer = document.getElementById("profileApplyStaffContainer");
  const profileSecurityContainer = document.getElementById("profileSecurityContainer");

  const mySubmissionsList = document.getElementById("mySubmissionsList");
  const applyStaffForm = document.getElementById("applyStaffForm");
  const changePasswordForm = document.getElementById("changePasswordForm");
  const historyList = document.getElementById("historyList");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");

  // 游戏舞台与弹窗
  const gameStageOverlay = document.getElementById("gameStageOverlay");
  const gameIframe = document.getElementById("gameIframe");
  const gameStageTitle = document.getElementById("gameStageTitle");
  const gameStageIcon = document.getElementById("gameStageIcon");
  const gameStageDesc = document.getElementById("gameStageDesc");
  const gameStageControlsLegend = document.getElementById("gameStageControlsLegend");
  const stageCloseBtn = document.getElementById("stageCloseBtn");
  const stageZoomBtn = document.getElementById("stageZoomBtn");

  const rankingModal = document.getElementById("rankingModal");
  const rankingGameTitle = document.getElementById("rankingGameTitle");
  const rankingList = document.getElementById("rankingList");
  const closeRankingBtn = document.getElementById("closeRankingBtn");

  const avatarModal = document.getElementById("avatarModal");
  const avatarGrid = document.getElementById("avatarGrid");
  const closeAvatarBtn = document.getElementById("closeAvatarBtn");

  let currentView = "all";
  let activeGame = null;

  /* ==========================================
     1. 系统初始化
     ========================================== */
  function init() {
    renderUserAuthState();
    renderMuteState();
    renderAllGames();
    renderCategoryMatrix();
    setupEventListeners();
    setupAuthListeners();
  }

  // 渲染用户登录状态与顶栏徽章
  function renderUserAuthState() {
    const currentUser = StorageManager.getCurrentUser();
    if (currentUser) {
      // 实时风控封禁强制踢出
      if (currentUser.sanctionLevel >= 4 || currentUser.status === "banned") {
        AuthSystem.logout();
        alert(`⛔ 账号安全风控通知：您的账号【${currentUser.nickname}】已被管理员实施【${currentUser.sanctionLevel === 5 ? '终极永久封杀' : '重度封禁30天'}】处罚，已强制下线！如有异议请向站长申诉。`);
        renderUserAuthState();
        if (currentView === "profile") switchView("all");
        return;
      }

      AuthSystem.refreshUserBadges(currentUser.id);
      const roleInfo = ROLE_DEFINITIONS[currentUser.role] || ROLE_DEFINITIONS.player;

      navLoginBtn.style.display = "none";
      userBadge.style.display = "flex";
      userBadgeAvatar.textContent = currentUser.avatar || "🎮";
      userBadgeName.textContent = currentUser.nickname;
      
      const sancLevel = currentUser.sanctionLevel || 0;
      if (sancLevel > 0) {
        const sancConfig = SANCTION_LEVELS[sancLevel] || SANCTION_LEVELS[1];
        userRoleBadge.textContent = `${roleInfo.icon} ${roleInfo.name} · ${sancConfig.shortName}`;
        userRoleBadge.style.color = sancConfig.color;
      } else {
        userRoleBadge.textContent = `${roleInfo.icon} ${roleInfo.name}`;
        userRoleBadge.style.color = roleInfo.color;
      }

      if (profileAvatarLarge) profileAvatarLarge.firstChild.textContent = currentUser.avatar || "🎮";
      if (profileNicknameInput) profileNicknameInput.value = currentUser.nickname;
      if (profileRoleBadge) {
        if (sancLevel > 0) {
          const sancConfig = SANCTION_LEVELS[sancLevel] || SANCTION_LEVELS[1];
          profileRoleBadge.textContent = `${roleInfo.icon} ${roleInfo.name} (${sancConfig.shortName})`;
          profileRoleBadge.style.color = sancConfig.color;
        } else {
          profileRoleBadge.textContent = `${roleInfo.icon} ${roleInfo.name}`;
          profileRoleBadge.style.color = roleInfo.color;
        }
      }

      // 控制台入口显示逻辑
      if (menuAdminPortal) {
        menuAdminPortal.style.display = currentUser.role === "super_admin" ? "flex" : "none";
      }
      if (menuWorkbench) {
        const isStaff = ["super_admin", "game_reviewer", "release_controller", "inspector", "enforcer"].includes(currentUser.role);
        menuWorkbench.style.display = isStaff ? "flex" : "none";
      }
    } else {
      navLoginBtn.style.display = "flex";
      userBadge.style.display = "none";
      if (profileNicknameInput) profileNicknameInput.value = "游客玩家";
      if (profileRoleBadge) profileRoleBadge.textContent = "👤 游客";
    }

    renderBadgesWall();
  }

  // 渲染个人自动荣誉勋章墙
  function renderBadgesWall() {
    if (!userBadgesWall) return;
    const currentUser = StorageManager.getCurrentUser();
    userBadgesWall.innerHTML = "";

    const allBadgeKeys = Object.keys(BADGE_DEFINITIONS);
    const myBadges = currentUser ? (currentUser.badges || []) : [];

    allBadgeKeys.forEach(k => {
      const b = BADGE_DEFINITIONS[k];
      const isUnlocked = myBadges.includes(k);
      const tag = document.createElement("div");
      tag.className = "pill-tag";
      tag.style.cssText = `padding: 6px 14px; font-size: 12px; transition: all 0.2s; ${isUnlocked ? 'background: rgba(245, 158, 11, 0.15); border: 1px solid var(--gold-primary); color: #fbbf24;' : 'opacity: 0.35; background: rgba(255,255,255,0.05); color: #94a3b8;'}`;
      tag.innerHTML = `${b.icon} ${b.name} ${isUnlocked ? '✓ 已解锁' : '🔒 待达成'}`;
      userBadgesWall.appendChild(tag);
    });
  }

  function renderMuteState() {
    if (SoundSystem.isMuted) {
      muteBtn.classList.add("muted");
      muteBtn.textContent = "🔇";
    } else {
      muteBtn.classList.remove("muted");
      muteBtn.textContent = "🔊";
    }
  }

  /* ==========================================
     2. 视图切换路由
     ========================================== */
  function switchView(viewName, param = null) {
    SoundSystem.playClick();
    currentView = viewName;

    navTabs.forEach(btn => {
      if (btn.dataset.view === viewName || (viewName === "categoryDetail" && btn.dataset.view === "categories")) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    Object.values(viewSections).forEach(sec => {
      if (sec) sec.classList.remove("active");
    });

    if (viewSections[viewName]) {
      viewSections[viewName].classList.add("active");
    }

    if (viewName === "all") {
      renderAllGames(searchInput.value.trim());
    } else if (viewName === "categories") {
      renderCategoryMatrix();
    } else if (viewName === "categoryDetail" && param) {
      renderCategoryDetail(param);
    } else if (viewName === "profile") {
      renderProfilePage();
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ==========================================
     3. 渲染全部游戏大厅卡片 (含多维模糊匹配与权值相关度排序算法)
     ========================================== */
  function calculateGameRelevance(game, keyword, isFav) {
    if (!keyword) return isFav ? 10 : 0;
    const kw = keyword.toLowerCase();
    const title = (game.title || "").toLowerCase();
    const cat = (game.categoryName || "").toLowerCase();
    const desc = (game.description || "").toLowerCase();

    let score = 0;
    // 1. 标题完全相等
    if (title === kw) score += 1000;
    // 2. 标题以关键词为前缀
    else if (title.startsWith(kw)) score += 500;
    // 3. 标题包含关键词
    else if (title.includes(kw)) score += 300;
    // 4. 标题子序列模糊匹配
    else {
      let tIdx = 0;
      let matched = 0;
      for (let i = 0; i < kw.length; i++) {
        const found = title.indexOf(kw[i], tIdx);
        if (found >= 0) {
          matched++;
          tIdx = found + 1;
        }
      }
      if (matched === kw.length) score += 120;
    }

    // 5. 分类匹配
    if (cat === kw) score += 200;
    else if (cat.includes(kw)) score += 100;

    // 6. 描述文本匹配
    if (desc.includes(kw)) score += 50;

    // 7. 收藏权重加成
    if (isFav && score > 0) score += 30;

    return score;
  }

  function renderAllGames(filterKeyword = "") {
    const games = StorageManager.getAllGames();
    allGamesGrid.innerHTML = "";

    let scoredList = [];
    for (let i = 0; i < games.length; i++) {
      const g = games[i];
      const isFav = StorageManager.isFavorite(g.id);
      const relScore = calculateGameRelevance(g, filterKeyword, isFav);
      if (!filterKeyword || relScore > 0) {
        scoredList.push({ game: g, score: relScore, isFav });
      }
    }

    // 按算法计算的相关度降序排序
    scoredList.sort((a, b) => b.score - a.score);

    if (scoredList.length === 0) {
      allGamesGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">${filterKeyword ? '🔍' : '🎮'}</div>
          <div class="empty-title">${filterKeyword ? '未找到匹配游戏' : '游戏大厅暂无游戏'}</div>
          <div class="empty-desc">${filterKeyword ? '换个关键词试试，或在后台导入新游戏！' : '平台已准备就绪，快去后台上传并发布您的第一款精彩小游戏吧！'}</div>
          ${!filterKeyword ? '<a href="admin.html" class="action-link-btn" style="margin-top: 12px; background: rgba(99, 102, 241, 0.2); border-color: var(--accent-color);">⚙️ 前往发布后台</a>' : ''}
        </div>
      `;
      return;
    }

    scoredList.forEach(item => {
      allGamesGrid.appendChild(createGameCard(item.game));
    });
  }

  function createGameCard(game) {
    const isFav = StorageManager.isFavorite(game.id);
    const card = document.createElement("div");
    card.className = "game-card";
    card.dataset.id = game.id;

    card.innerHTML = `
      <div class="game-card-cover" style="background: ${game.bgGradient || '#1e293b'}">
        <span>${game.icon || '🎮'}</span>
        <div class="game-card-category-badge">${game.categoryName}</div>
      </div>
      <div class="game-card-info">
        <h3 class="game-card-title">${game.title}</h3>
        <p class="game-card-desc">${game.description}</p>
        <div class="game-card-footer">
          <span class="game-card-play-tag">▶ 立即畅玩</span>
          <div class="game-card-actions">
            <button class="card-action-btn star-btn ${isFav ? 'active' : ''}" title="${isFav ? '取消收藏' : '加入收藏'}" data-action="favorite" data-id="${game.id}">
              ★
            </button>
            <button class="card-action-btn podium-btn" title="查看排名与战绩" data-action="ranking" data-id="${game.id}">
              🏆
            </button>
          </div>
        </div>
      </div>
    `;

    card.addEventListener("click", (e) => {
      const actionBtn = e.target.closest(".card-action-btn");
      if (actionBtn) {
        e.stopPropagation();
        const action = actionBtn.dataset.action;
        const gameId = actionBtn.dataset.id;
        if (action === "favorite") {
          handleToggleFavorite(gameId, actionBtn);
        } else if (action === "ranking") {
          handleOpenRanking(game);
        }
        return;
      }
      launchGame(game);
    });

    return card;
  }

  function handleToggleFavorite(gameId, btn) {
    const isNowFav = StorageManager.toggleFavorite(gameId);
    if (isNowFav) {
      btn.classList.add("active");
      btn.title = "取消收藏";
      SoundSystem.playStar();
    } else {
      btn.classList.remove("active");
      btn.title = "加入收藏";
      SoundSystem.playClick();
    }
    if (currentView === "profile") {
      renderProfileFavorites();
    }
  }

  /* ==========================================
     4. 分类矩阵
     ========================================== */
  function renderCategoryMatrix() {
    const games = StorageManager.getAllGames();
    categoryMatrixGrid.innerHTML = "";

    DEFAULT_CATEGORIES.forEach(cat => {
      const count = games.filter(g => g.category === cat.id).length;
      const card = document.createElement("div");
      card.className = "category-matrix-card";
      card.innerHTML = `
        <div class="category-icon">${cat.icon}</div>
        <div class="category-name">${cat.name}</div>
        <div class="category-count">${count} 款游戏</div>
      `;
      card.addEventListener("click", () => {
        switchView("categoryDetail", cat);
      });
      categoryMatrixGrid.appendChild(card);
    });
  }

  function renderCategoryDetail(category) {
    categoryDetailTitle.textContent = `${category.icon} ${category.name}`;
    const games = StorageManager.getAllGames().filter(g => g.category === category.id);
    categoryDetailGrid.innerHTML = "";

    if (games.length === 0) {
      categoryDetailGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">${category.icon}</div>
          <div class="empty-title">该分类下暂无游戏</div>
          <div class="empty-desc">您可以在后台上传新游戏并归类到【${category.name}】！</div>
        </div>
      `;
      return;
    }

    games.forEach(game => {
      categoryDetailGrid.appendChild(createGameCard(game));
    });
  }

  /* ==========================================
     5. “我的” 个人中心
     ========================================== */
  function renderProfilePage() {
    renderUserAuthState();
    const favs = StorageManager.getFavorites();
    const history = StorageManager.getHistory();

    statFavoritesCount.textContent = favs.length;
    statHistoryCount.textContent = history.length;

    renderProfileFavorites();
    renderProfileHistory();
    renderMySubmissions();
  }

  function renderProfileFavorites() {
    const favIds = StorageManager.getFavorites();
    const allGames = StorageManager.getAllGames();
    const favGames = allGames.filter(g => favIds.includes(g.id));

    profileFavoritesContainer.innerHTML = "";
    if (favGames.length === 0) {
      profileFavoritesContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⭐</div>
          <div class="empty-title">还没有收藏任何游戏</div>
          <div class="empty-desc">在大厅卡片右下角点击星星按钮即可快速收藏！</div>
        </div>
      `;
      return;
    }

    const grid = document.createElement("div");
    grid.className = "games-grid";
    favGames.forEach(game => {
      grid.appendChild(createGameCard(game));
    });
    profileFavoritesContainer.appendChild(grid);
  }

  function renderProfileHistory() {
    const history = StorageManager.getHistory();
    historyList.innerHTML = "";

    if (history.length === 0) {
      historyList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🕒</div>
          <div class="empty-title">暂无游玩历史</div>
          <div class="empty-desc">快去大厅探索精彩小游戏吧！</div>
        </div>
      `;
      return;
    }

    history.forEach(item => {
      const gameScore = StorageManager.getGameScore(item.gameId);
      const row = document.createElement("div");
      row.className = "history-item";
      row.innerHTML = `
        <div class="history-item-left">
          <div class="history-icon">${StorageManager.escapeHtml(item.icon || '🎮')}</div>
          <div>
            <div class="history-title">${StorageManager.escapeHtml(item.title)}</div>
            <div class="history-time">最后游玩：${formatRelativeTime(item.playedAt)}</div>
          </div>
        </div>
        <div class="history-item-right">
          ${gameScore !== null ? `<div class="history-score">最高分: ${gameScore}</div>` : ''}
          <button class="stage-control-btn play-again-btn" data-id="${item.gameId}">再次游玩</button>
        </div>
      `;

      row.querySelector(".play-again-btn").addEventListener("click", () => {
        const game = StorageManager.getAllGames().find(g => g.id === item.gameId);
        if (game) launchGame(game);
      });

      historyList.appendChild(row);
    });
  }

  // 创作者中心：我的投稿看板
  function renderMySubmissions() {
    const currentUser = StorageManager.getCurrentUser();
    mySubmissionsList.innerHTML = "";

    if (!currentUser) {
      mySubmissionsList.innerHTML = `<div class="empty-state"><div class="empty-title">请先登录账号查看您的投稿作品</div></div>`;
      return;
    }

    const subs = StorageManager.getUserSubmissions(currentUser.id);
    if (subs.length === 0) {
      mySubmissionsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🛠️</div>
          <div class="empty-title">您尚未投稿过任何小游戏</div>
          <div class="empty-desc">欢迎上传自制 H5/Canvas 游戏，通过审核后将获得【独立创作者】专属勋章！</div>
        </div>
      `;
      return;
    }

    subs.forEach(s => {
      let statusTag = `<span class="pill-tag pill-muted">⏳ 正在初审试玩中...</span>`;
      if (s.status === "reviewed") statusTag = `<span class="pill-tag" style="background: rgba(6, 182, 212, 0.2); color: #38bdf8;">⚙️ 初审已过 · 待终审发布</span>`;
      else if (s.status === "published") statusTag = `<span class="pill-tag pill-active">✅ 已全网上架</span>`;
      else if (s.status === "rejected") statusTag = `<span class="pill-tag pill-banned">❌ 未通过驳回</span>`;

      const card = document.createElement("div");
      card.className = "history-item";
      card.style.flexDirection = "column";
      card.style.alignItems = "stretch";
      card.style.gap = "8px";

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 24px;">${StorageManager.escapeHtml(s.gameData.icon || '🎮')}</span>
            <strong>${StorageManager.escapeHtml(s.gameData.title)}</strong>
          </div>
          <div>${statusTag}</div>
        </div>
        <div style="font-size: 13px; color: var(--text-muted);">${StorageManager.escapeHtml(s.gameData.description)}</div>
        ${s.status === 'rejected' ? `
          <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 10px; font-size: 13px; color: #fca5a5;">
            <strong>驳回原因：</strong>${StorageManager.escapeHtml(s.rejectReason || '不符合上架规范')}
          </div>
        ` : ''}
      `;

      mySubmissionsList.appendChild(card);
    });
  }

  function formatRelativeTime(timestamp) {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "刚刚";
    if (mins < 60) return `${mins} 分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} 小时前`;
    return new Date(timestamp).toLocaleDateString();
  }

  /* ==========================================
     6. 游戏舞台
     ========================================== */
  function launchGame(game) {
    SoundSystem.playClick();
    activeGame = game;
    StorageManager.addHistory(game.id, game.title, game.icon);

    gameStageTitle.textContent = game.title;
    gameStageIcon.textContent = game.icon || "🎮";
    gameStageDesc.textContent = game.description;
    renderControlsLegend(game.controls);

    if (game.customHtml) {
      // 创作者第三方自定义游戏：启用严格隔离沙箱，禁止 allow-same-origin，阻止任何恶意脚本窃取站长 LocalStorage 数据
      gameIframe.setAttribute("sandbox", "allow-scripts allow-forms allow-pointer-lock allow-modals");
      gameIframe.srcdoc = game.customHtml;
    } else {
      // 官方内置游戏
      gameIframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-modals");
      gameIframe.src = game.entryPath;
    }

    gameStageOverlay.classList.add("active");
    document.body.style.overflow = "hidden";

    setTimeout(() => {
      SoundSystem.broadcastMuteState();
    }, 300);
  }

  function closeGameStage() {
    if (!gameStageOverlay.classList.contains("active")) return;
    SoundSystem.playClick();
    gameStageOverlay.classList.remove("active");
    gameStageOverlay.classList.remove("fullscreen");
    gameIframe.src = "about:blank";
    gameIframe.removeAttribute("srcdoc");
    document.body.style.overflow = "";
    activeGame = null;
  }

  function renderControlsLegend(controlsText) {
    gameStageControlsLegend.innerHTML = `<span class="legend-title">⌨️ 操作指引：</span>`;
    if (!controlsText) {
      gameStageControlsLegend.innerHTML += `<span class="legend-action">使用鼠标/键盘操作</span>`;
      return;
    }

    const parts = controlsText.split(/(【[^】]+】)/g);
    parts.forEach(part => {
      if (part.startsWith("【") && part.endsWith("】")) {
        const key = part.slice(1, -1);
        const span = document.createElement("span");
        span.className = "keycap";
        span.textContent = key;
        gameStageControlsLegend.appendChild(span);
      } else if (part.trim()) {
        const span = document.createElement("span");
        span.className = "legend-action";
        span.textContent = part;
        gameStageControlsLegend.appendChild(span);
      }
    });

    const escSpan = document.createElement("span");
    escSpan.innerHTML = `<span class="keycap" style="margin-left: 12px;">ESC</span> <span class="legend-action">退出游戏</span>`;
    gameStageControlsLegend.appendChild(escSpan);
  }

  function handleOpenRanking(game) {
    SoundSystem.playPodium();
    rankingGameTitle.textContent = `${game.title} - 排行榜`;
    rankingList.innerHTML = "";

    const userBest = StorageManager.getGameScore(game.id);
    let list = [...(game.rankings || [])];

    if (userBest !== null) {
      const myProfile = StorageManager.getProfile();
      list.push({ player: `${myProfile.nickname} (我)`, score: userBest, date: "今日", isMe: true });
    }

    list.sort((a, b) => b.score - a.score);

    list.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = `rank-item rank-${index + 1} ${item.isMe ? 'my-rank-item' : ''}`;
      row.innerHTML = `
        <div class="rank-player-info">
          <div class="rank-badge">${index + 1}</div>
          <span style="font-weight: 600; ${item.isMe ? 'color: var(--accent-secondary);' : ''}">${item.player}</span>
        </div>
        <div class="rank-score">${item.score} 分</div>
      `;
      rankingList.appendChild(row);
    });

    rankingModal.classList.add("active");
  }

  function openAvatarModal() {
    const currentUser = StorageManager.getCurrentUser();
    if (currentUser && (currentUser.sanctionLevel >= 3 || currentUser.status === "banned")) {
      alert("⚠️ 账号处于严格封控期，禁止更换头像与修改个人资料！");
      return;
    }

    avatarGrid.innerHTML = "";
    const profile = StorageManager.getProfile();

    PRESET_AVATARS.forEach(avatar => {
      const opt = document.createElement("div");
      opt.className = `avatar-option ${profile.avatar === avatar ? 'selected' : ''}`;
      opt.textContent = avatar;
      opt.addEventListener("click", () => {
        StorageManager.setProfile({ avatar });
        renderUserAuthState();
        avatarModal.classList.remove("active");
        SoundSystem.playClick();
      });
      avatarGrid.appendChild(opt);
    });

    avatarModal.classList.add("active");
  }

  /* ==========================================
     7. 认证与登录/注册/找回密码事件监听
     ========================================== */
  function setupAuthListeners() {
    // 打开弹窗
    navLoginBtn.addEventListener("click", () => {
      authModal.classList.add("active");
      switchAuthTab("login");
    });

    closeAuthBtn.addEventListener("click", () => {
      authModal.classList.remove("active");
    });

    // 弹窗标签切换
    tabAuthLogin.addEventListener("click", () => switchAuthTab("login"));
    tabAuthRegister.addEventListener("click", () => switchAuthTab("register"));
    tabAuthForgot.addEventListener("click", () => switchAuthTab("forgot"));

    function switchAuthTab(type) {
      tabAuthLogin.classList.toggle("active", type === "login");
      tabAuthRegister.classList.toggle("active", type === "register");
      tabAuthForgot.classList.toggle("active", type === "forgot");

      loginForm.style.display = type === "login" ? "flex" : "none";
      registerForm.style.display = type === "register" ? "flex" : "none";
      forgotForm.style.display = type === "forgot" ? "flex" : "none";
    }

    // 1. 登录表单提交
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const identifier = document.getElementById("loginIdentifier").value.trim();
      const password = document.getElementById("loginPassword").value.trim();

      const result = AuthSystem.login(identifier, password);
      if (result.success) {
        alert(result.message);
        authModal.classList.remove("active");
        renderUserAuthState();
        if (currentView === "profile") renderProfilePage();
      } else {
        alert(result.message);
      }
    });

    // 2. 注册表单提交
    registerForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const username = document.getElementById("regUsername").value.trim();
      const email = document.getElementById("regEmail").value.trim();
      const password = document.getElementById("regPassword").value.trim();
      const nickname = document.getElementById("regNickname").value.trim();

      const result = AuthSystem.register({ username, email, password, nickname });
      if (result.success) {
        alert(result.message);
        authModal.classList.remove("active");
        renderUserAuthState();
        if (currentView === "profile") renderProfilePage();
      } else {
        alert(result.message);
      }
    });

    // 3. 发送找回密码验证码
    btnSendResetCode.addEventListener("click", () => {
      const email = document.getElementById("forgotEmail").value.trim();
      const res = AuthSystem.sendResetCode(email);
      alert(res.message);
    });

    // 4. 重置密码提交
    forgotForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("forgotEmail").value.trim();
      const code = document.getElementById("forgotCode").value.trim();
      const newPwd = document.getElementById("forgotNewPwd").value.trim();

      const res = AuthSystem.resetPasswordWithCode(email, code, newPwd);
      if (res.success) {
        alert(res.message);
        authModal.classList.remove("active");
        renderUserAuthState();
      } else {
        alert(res.message);
      }
    });

    // 个人下拉菜单控制
    userBadge.addEventListener("click", (e) => {
      e.stopPropagation();
      userDropdownMenu.style.display = userDropdownMenu.style.display === "flex" ? "none" : "flex";
    });

    document.addEventListener("click", () => {
      userDropdownMenu.style.display = "none";
    });

    menuMyProfile.addEventListener("click", () => {
      switchView("profile");
    });

    menuLogout.addEventListener("click", () => {
      if (confirm("确定要退出登录吗？")) {
        AuthSystem.logout();
        renderUserAuthState();
        if (currentView === "profile") switchView("all");
      }
    });

    // 申请成为管理团队
    applyStaffForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const currentUser = StorageManager.getCurrentUser();
      if (!currentUser) {
        alert("请先登录账号后再提交申请！");
        return;
      }
      if (currentUser.sanctionLevel >= 2 || currentUser.status === "mute_submission" || currentUser.status === "banned") {
        alert("⚠️ 您的账号当前处于风控限制期，无法申请加入管理团队！");
        return;
      }
      const role = document.getElementById("applyTargetRole").value;
      const statement = document.getElementById("applyStatement").value.trim();

      const newApp = {
        id: "app_" + Date.now(),
        applicantId: currentUser.id,
        applicantUsername: currentUser.username,
        applicantNickname: currentUser.nickname,
        targetRole: role,
        statement: statement,
        status: "pending",
        createdAt: Date.now()
      };

      StorageManager.addApplication(newApp);
      alert("🎉 您的申请已送达【站长最高独立控制台】，站长将亲自审批并任命！");
      applyStaffForm.reset();
    });

    // 密码修改
    changePasswordForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const currentUser = StorageManager.getCurrentUser();
      if (!currentUser) return;

      const oldPwd = document.getElementById("oldPwdInput").value.trim();
      const newPwd = document.getElementById("newPwdInput").value.trim();

      const res = AuthSystem.changePassword(currentUser.id, oldPwd, newPwd);
      alert(res.message);
      if (res.success) changePasswordForm.reset();
    });
  }

  /* ==========================================
     8. 全局事件监听
     ========================================== */
  function setupEventListeners() {
    navTabs.forEach(btn => {
      btn.addEventListener("click", () => {
        switchView(btn.dataset.view);
      });
    });

    document.querySelector(".header-left").addEventListener("click", () => {
      switchView("all");
    });

    muteBtn.addEventListener("click", () => {
      SoundSystem.toggleMute();
      renderMuteState();
    });

    let searchDebounceTimer = null;
    searchInput.addEventListener("input", (e) => {
      clearTimeout(searchDebounceTimer);
      const kw = e.target.value.trim();
      searchDebounceTimer = setTimeout(() => {
        if (currentView !== "all") {
          switchView("all");
        }
        renderAllGames(kw);
      }, 120);
    });

    backToMatrixBtn.addEventListener("click", () => {
      switchView("categories");
    });

    profileAvatarLarge.addEventListener("click", openAvatarModal);

    profileNicknameInput.addEventListener("change", (e) => {
      const currentUser = StorageManager.getCurrentUser();
      if (currentUser && (currentUser.sanctionLevel >= 3 || currentUser.status === "banned")) {
        alert("⚠️ 您的账号当前处于严格封控状态，禁止修改昵称与个人资料！");
        profileNicknameInput.value = currentUser.nickname;
        return;
      }
      const name = e.target.value.trim() || "玩家1号";
      StorageManager.setProfile({ nickname: name });
      renderUserAuthState();
    });

    // 跨标签页监听风控与数据库更新
    window.addEventListener("storage", (e) => {
      if (e.key === "minigame_users_db" || e.key === "minigame_current_user") {
        renderUserAuthState();
        if (currentView === "profile") renderProfilePage();
      }
    });

    profileTabBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        SoundSystem.playClick();
        profileTabBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const tab = btn.dataset.tab;

        profileFavoritesContainer.style.display = tab === "favorites" ? "block" : "none";
        profileHistoryContainer.style.display = tab === "history" ? "block" : "none";
        profileSubmissionsContainer.style.display = tab === "submissions" ? "block" : "none";
        profileApplyStaffContainer.style.display = tab === "apply-staff" ? "block" : "none";
        profileSecurityContainer.style.display = tab === "security" ? "block" : "none";

        if (tab === "favorites") renderProfileFavorites();
        if (tab === "history") renderProfileHistory();
        if (tab === "submissions") renderMySubmissions();
      });
    });

    clearHistoryBtn.addEventListener("click", () => {
      if (confirm("确定要清空所有历史游玩记录吗？")) {
        StorageManager.clearHistory();
        renderProfilePage();
      }
    });

    stageCloseBtn.addEventListener("click", closeGameStage);
    stageZoomBtn.addEventListener("click", () => {
      gameStageOverlay.classList.toggle("fullscreen");
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (authModal.classList.contains("active")) {
          authModal.classList.remove("active");
        } else if (rankingModal.classList.contains("active")) {
          rankingModal.classList.remove("active");
        } else if (avatarModal.classList.contains("active")) {
          avatarModal.classList.remove("active");
        } else if (gameStageOverlay.classList.contains("active")) {
          closeGameStage();
        }
      }
    });

    closeRankingBtn.addEventListener("click", () => rankingModal.classList.remove("active"));
    closeAvatarBtn.addEventListener("click", () => avatarModal.classList.remove("active"));

    window.addEventListener("message", (e) => {
      if (e.data && e.data.type === "GAME_SCORE" && activeGame) {
        const rawScore = Number(e.data.score);
        // 防注入与防数值溢出：必须是合法正整数，范围在 0 ~ 999999999 之间
        if (!isNaN(rawScore) && isFinite(rawScore) && rawScore >= 0 && rawScore <= 999999999) {
          StorageManager.recordGameScore(activeGame.id, Math.floor(rawScore));
          const currentUser = StorageManager.getCurrentUser();
          if (currentUser) AuthSystem.refreshUserBadges(currentUser.id);
        }
      }
    });
  }

  // 启动
  init();
});
