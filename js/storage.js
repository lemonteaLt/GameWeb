/**
 * 数据本地持久化与数据库管理模块 (LocalStorage & IndexedDB 封装)
 */
const STORAGE_KEYS = {
  CURRENT_USER: "minigame_current_user",
  USERS_DB: "minigame_users_db",
  SETTINGS: "minigame_settings",
  FAVORITES: "minigame_favorites",
  HISTORY: "minigame_history",
  CUSTOM_GAMES: "minigame_custom_games",
  SCORES: "minigame_scores",
  SUBMISSIONS: "minigame_submissions",
  APPLICATIONS: "minigame_staff_applications",
  MODERATION_TICKETS: "minigame_moderation_tickets",
  EMAIL_CODES: "minigame_email_verification_codes"
};

// 预置默认超级管理员 (站长) 账号
const DEFAULT_SUPER_ADMIN = {
  id: "user_super_admin_001",
  username: "admin",
  email: "admin@aurora.com",
  password: "admin888",
  nickname: "站长大人",
  avatar: "👑",
  role: "super_admin", // 站长角色 (唯一最高权限)
  status: "active",    // active | warned | mute_submission | banned_30d | permanent_banned
  sanctionLevel: 0,    // 0: 正常, 1: 轻度警告, 2: 冻结投稿, 3: 禁言禁评, 4: 封禁30天, 5: 永久封杀
  adminNotes: "平台唯一创始人兼最高管理员",
  badges: ["super_admin", "staff", "creator", "player"],
  createdAt: 1774700000000,
  lastLoginAt: Date.now()
};

const StorageManager = {
  // ==========================================
  // 0. 安全辅助与 XSS 转义防御 (Security Sanitizer)
  // ==========================================
  escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  // ==========================================
  // 1. 用户体系与花名册数据库 (含 O(1) 哈希索引内存缓存加速与多标签实时同频)
  // ==========================================
  _usersCache: null,
  _idMap: null,
  _usernameMap: null,
  _emailMap: null,

  invalidateCache() {
    this._usersCache = null;
    this._idMap = null;
    this._usernameMap = null;
    this._emailMap = null;
  },

  _rebuildUserIndices() {
    this._idMap = new Map();
    this._usernameMap = new Map();
    this._emailMap = new Map();
    for (let i = 0; i < this._usersCache.length; i++) {
      const u = this._usersCache[i];
      if (u.id) this._idMap.set(u.id, u);
      if (u.username) this._usernameMap.set(u.username.toLowerCase(), u);
      if (u.email) this._emailMap.set(u.email.toLowerCase(), u);
    }
  },

  getAllUsers() {
    if (!this._usersCache) {
      const saved = localStorage.getItem(STORAGE_KEYS.USERS_DB);
      this._usersCache = saved ? JSON.parse(saved) : [];
      if (!this._usersCache.some(u => u.username === "admin" || u.role === "super_admin")) {
        this._usersCache.unshift(DEFAULT_SUPER_ADMIN);
        localStorage.setItem(STORAGE_KEYS.USERS_DB, JSON.stringify(this._usersCache));
      }
      this._rebuildUserIndices();
    }
    return this._usersCache;
  },

  saveAllUsers(users) {
    this._usersCache = users;
    this._rebuildUserIndices();
    localStorage.setItem(STORAGE_KEYS.USERS_DB, JSON.stringify(users));
  },

  getUserById(id) {
    if (!id) return null;
    this.getAllUsers();
    return this._idMap ? this._idMap.get(id) || null : null;
  },

  getUserByUsername(username) {
    if (!username) return null;
    this.getAllUsers();
    return this._usernameMap ? this._usernameMap.get(username.toLowerCase()) || null : null;
  },

  getUserByEmail(email) {
    if (!email) return null;
    this.getAllUsers();
    return this._emailMap ? this._emailMap.get(email.toLowerCase()) || null : null;
  },

  saveUser(user) {
    const users = this.getAllUsers();
    const idx = users.findIndex(u => u.id === user.id);
    if (idx > -1) {
      users[idx] = user;
    } else {
      users.push(user);
    }
    this.saveAllUsers(users);

    // 如果更新的是当前登录用户，同步更新会话
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (saved) {
      try {
        const cur = JSON.parse(saved);
        if (cur.id === user.id) {
          this.setCurrentUser(user);
        }
      } catch (e) {}
    }
  },

  // 当前登录会话（每次读取数据库最新实时记录，保证风控改动即时生效）
  getCurrentUser() {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (!saved) {
      return null;
    }
    try {
      const user = JSON.parse(saved);
      // 实时失效缓存重新拉取，确保跨标签/后台风控修改 100% 毫秒级生效
      this.invalidateCache();
      const freshUser = this.getUserById(user.id);
      if (!freshUser) {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        return null;
      }
      return freshUser;
    } catch (e) {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      return null;
    }
  },

  setCurrentUser(user) {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  },

  // 快捷获取当前用户资料
  getProfile() {
    const current = this.getCurrentUser();
    if (current) {
      return {
        nickname: current.nickname,
        avatar: current.avatar,
        role: current.role,
        sanctionLevel: current.sanctionLevel || 0,
        badges: current.badges || []
      };
    }
    return { nickname: "游客玩家", avatar: "🎮", role: "guest", sanctionLevel: 0, badges: [] };
  },

  setProfile(profileUpdate) {
    const current = this.getCurrentUser();
    if (current) {
      Object.assign(current, profileUpdate);
      this.saveUser(current);
    }
  },

  // ==========================================
  // 2. 全局偏好与静音设置
  // ==========================================
  getSettings() {
    const defaultSettings = { isMuted: false, volume: 0.8 };
    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  },

  setSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  // ==========================================
  // 3. 收藏夹
  // ==========================================
  getFavoritesKey() {
    const current = this.getCurrentUser();
    return current ? `${STORAGE_KEYS.FAVORITES}_${current.id}` : `${STORAGE_KEYS.FAVORITES}_guest`;
  },

  getFavorites() {
    const saved = localStorage.getItem(this.getFavoritesKey());
    return saved ? JSON.parse(saved) : [];
  },

  isFavorite(gameId) {
    return this.getFavorites().includes(gameId);
  },

  toggleFavorite(gameId) {
    let favs = this.getFavorites();
    const index = favs.indexOf(gameId);
    let isNowFav = false;
    if (index > -1) {
      favs.splice(index, 1);
      isNowFav = false;
    } else {
      favs.push(gameId);
      isNowFav = true;
    }
    localStorage.setItem(this.getFavoritesKey(), JSON.stringify(favs));
    return isNowFav;
  },

  // ==========================================
  // 4. 游玩历史
  // ==========================================
  getHistoryKey() {
    const current = this.getCurrentUser();
    return current ? `${STORAGE_KEYS.HISTORY}_${current.id}` : `${STORAGE_KEYS.HISTORY}_guest`;
  },

  getHistory() {
    const saved = localStorage.getItem(this.getHistoryKey());
    return saved ? JSON.parse(saved) : [];
  },

  addHistory(gameId, title, icon) {
    let history = this.getHistory();
    history = history.filter(item => item.gameId !== gameId);
    history.unshift({
      gameId,
      title,
      icon,
      playedAt: Date.now()
    });
    if (history.length > 30) history = history.slice(0, 30);
    localStorage.setItem(this.getHistoryKey(), JSON.stringify(history));
  },

  clearHistory() {
    localStorage.removeItem(this.getHistoryKey());
  },

  // ==========================================
  // 5. 游戏库汇总
  // ==========================================
  getAllGames() {
    const builtin = typeof DEFAULT_GAMES !== "undefined" ? DEFAULT_GAMES : [];
    const approvedSubmissions = this.getSubmissions()
      .filter(s => s.status === "published")
      .map(s => s.gameData);

    const legacyCustom = this.getCustomGames();
    return [...builtin, ...approvedSubmissions, ...legacyCustom];
  },

  getCustomGames() {
    const saved = localStorage.getItem(STORAGE_KEYS.CUSTOM_GAMES);
    return saved ? JSON.parse(saved) : [];
  },

  saveCustomGame(gameData) {
    const custom = this.getCustomGames();
    const existingIndex = custom.findIndex(g => g.id === gameData.id);
    if (existingIndex > -1) {
      custom[existingIndex] = gameData;
    } else {
      custom.push(gameData);
    }
    localStorage.setItem(STORAGE_KEYS.CUSTOM_GAMES, JSON.stringify(custom));
  },

  deleteCustomGame(gameId) {
    let custom = this.getCustomGames().filter(g => g.id !== gameId);
    localStorage.setItem(STORAGE_KEYS.CUSTOM_GAMES, JSON.stringify(custom));
    
    let subs = this.getSubmissions();
    subs = subs.filter(s => s.gameData && s.gameData.id !== gameId);
    this.saveSubmissions(subs);
  },

  // ==========================================
  // 6. 游戏战绩记录与最高分
  // ==========================================
  getGameScore(gameId) {
    const scores = JSON.parse(localStorage.getItem(STORAGE_KEYS.SCORES) || "{}");
    return scores[gameId] || null;
  },

  recordGameScore(gameId, score) {
    const scores = JSON.parse(localStorage.getItem(STORAGE_KEYS.SCORES) || "{}");
    if (!scores[gameId] || score > scores[gameId]) {
      scores[gameId] = score;
      localStorage.setItem(STORAGE_KEYS.SCORES, JSON.stringify(scores));
    }
  },

  // ==========================================
  // 7. 创作者投稿与品控审核流水线表
  // ==========================================
  getSubmissions() {
    const saved = localStorage.getItem(STORAGE_KEYS.SUBMISSIONS);
    return saved ? JSON.parse(saved) : [];
  },

  saveSubmissions(subs) {
    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(subs));
  },

  addSubmission(submission) {
    const subs = this.getSubmissions();
    subs.unshift(submission);
    this.saveSubmissions(subs);
  },

  updateSubmission(id, updates) {
    const subs = this.getSubmissions();
    const idx = subs.findIndex(s => s.id === id);
    if (idx > -1) {
      subs[idx] = { ...subs[idx], ...updates, updatedAt: Date.now() };
      this.saveSubmissions(subs);
      return subs[idx];
    }
    return null;
  },

  getUserSubmissions(userId) {
    return this.getSubmissions().filter(s => s.authorId === userId);
  },

  // ==========================================
  // 8. 管理团队职位申请表
  // ==========================================
  getApplications() {
    const saved = localStorage.getItem(STORAGE_KEYS.APPLICATIONS);
    return saved ? JSON.parse(saved) : [];
  },

  saveApplications(apps) {
    localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(apps));
  },

  addApplication(app) {
    const apps = this.getApplications();
    apps.unshift(app);
    this.saveApplications(apps);
  },

  updateApplication(id, updates) {
    const apps = this.getApplications();
    const idx = apps.findIndex(a => a.id === id);
    if (idx > -1) {
      apps[idx] = { ...apps[idx], ...updates, reviewedAt: Date.now() };
      this.saveApplications(apps);
      return apps[idx];
    }
    return null;
  },

  // ==========================================
  // 9. 巡查与风控封控工单表
  // ==========================================
  getModerationTickets() {
    const saved = localStorage.getItem(STORAGE_KEYS.MODERATION_TICKETS);
    return saved ? JSON.parse(saved) : [];
  },

  saveModerationTickets(tickets) {
    localStorage.setItem(STORAGE_KEYS.MODERATION_TICKETS, JSON.stringify(tickets));
  },

  addModerationTicket(ticket) {
    const tickets = this.getModerationTickets();
    tickets.unshift(ticket);
    this.saveModerationTickets(tickets);
  },

  updateModerationTicket(id, updates) {
    const tickets = this.getModerationTickets();
    const idx = tickets.findIndex(t => t.id === id);
    if (idx > -1) {
      tickets[idx] = { ...tickets[idx], ...updates, resolvedAt: Date.now() };
      this.saveModerationTickets(tickets);
      return tickets[idx];
    }
    return null;
  },

  // ==========================================
  // 10. 邮箱验证码暂存与防刷冷却
  // ==========================================
  saveEmailCode(email, code) {
    const codes = JSON.parse(localStorage.getItem(STORAGE_KEYS.EMAIL_CODES) || "{}");
    const existing = codes[email.toLowerCase()];
    if (existing && existing.sentAt && Date.now() - existing.sentAt < 60000) {
      const remainingSec = Math.ceil((60000 - (Date.now() - existing.sentAt)) / 1000);
      return { success: false, message: `请求过于频繁，请等待 ${remainingSec} 秒后再试！` };
    }
    codes[email.toLowerCase()] = {
      code,
      sentAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000
    };
    localStorage.setItem(STORAGE_KEYS.EMAIL_CODES, JSON.stringify(codes));
    return { success: true };
  },

  verifyEmailCode(email, code) {
    const codes = JSON.parse(localStorage.getItem(STORAGE_KEYS.EMAIL_CODES) || "{}");
    const item = codes[email.toLowerCase()];
    if (!item) return { success: false, message: "请先点击发送验证码！" };
    if (Date.now() > item.expiresAt) return { success: false, message: "验证码已过期，请重新获取！" };
    if (item.code !== code) return { success: false, message: "验证码输入错误！" };
    
    delete codes[email.toLowerCase()];
    localStorage.setItem(STORAGE_KEYS.EMAIL_CODES, JSON.stringify(codes));
    return { success: true };
  }
};

// 监听跨标签页数据库变更，实时同频风控状态
window.addEventListener("storage", (e) => {
  if (e.key === STORAGE_KEYS.USERS_DB || e.key === STORAGE_KEYS.CURRENT_USER) {
    StorageManager.invalidateCache();
  }
});
