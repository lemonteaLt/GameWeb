/**
 * 用户认证与权限管理系统 (Authentication & Role-Based Access Control)
 */

const ROLE_DEFINITIONS = {
  super_admin: { name: "站长", icon: "👑", desc: "拥有全站最高权限", color: "#f59e0b" },
  game_reviewer: { name: "游戏审核员", icon: "🎮", desc: "负责沙箱试玩与初审评估", color: "#06b6d4" },
  release_controller: { name: "后台控制员", icon: "⚙️", desc: "负责最终把关与发布上架", color: "#8b5cf6" },
  inspector: { name: "巡查管理员", icon: "👁️", desc: "负责日常巡视与违规取证", color: "#ec4899" },
  enforcer: { name: "封控管理员", icon: "🛡️", desc: "负责违规工单裁决与阶梯封控", color: "#ef4444" },
  creator: { name: "独立创作者", icon: "🛠️", desc: "上架过自制游戏的认证创作者", color: "#10b981" },
  player: { name: "正式玩家", icon: "🕹️", desc: "已完成注册的正式会员", color: "#3b82f6" },
  guest: { name: "游客", icon: "👤", desc: "未登录状态", color: "#64748b" }
};

const SANCTION_LEVELS = {
  0: { name: "等级 0: 正常活跃 (无限制)", shortName: "正常", style: "pill-active", color: "#10b981" },
  1: { name: "等级 1: 轻度警告 (清空异常战绩)", shortName: "轻度警告", style: "pill-muted", color: "#fbbf24" },
  2: { name: "等级 2: 中度封控 (冻结投稿权限)", shortName: "冻结投稿", style: "pill-muted", color: "#f97316" },
  3: { name: "等级 3: 严格封控 (全站禁言禁评)", shortName: "全站禁言", style: "pill-muted", color: "#a855f7" },
  4: { name: "等级 4: 重度封禁 (封停账号 30 天)", shortName: "封号 30天", style: "pill-banned", color: "#ef4444" },
  5: { name: "等级 5: 终极封杀 (永久封停黑名单)", shortName: "永久封停", style: "pill-banned", color: "#991b1b" }
};

const BADGE_DEFINITIONS = {
  super_admin: { name: "至高站长", icon: "👑", style: "badge-gold" },
  staff: { name: "管理团队", icon: "🛡️", style: "badge-purple" },
  creator: { name: "独立创作者", icon: "🛠️", style: "badge-emerald" },
  top_rank: { name: "榜首高玩", icon: "🏆", style: "badge-amber" },
  player: { name: "正式玩家", icon: "🕹️", style: "badge-blue" }
};

const AuthSystem = {
  // ==========================================
  // 1. 注册新账号
  // ==========================================
  register({ username, email, password, nickname, avatar }) {
    username = username.trim();
    email = email.trim().toLowerCase();
    password = password.trim();
    nickname = (nickname || username).trim();
    avatar = avatar || "🎮";

    if (!username || username.length < 3) {
      return { success: false, message: "用户名至少需要 3 个字符！" };
    }
    if (!email || !email.includes("@")) {
      return { success: false, message: "请输入有效的电子邮箱地址！" };
    }
    if (!password || password.length < 6) {
      return { success: false, message: "密码长度至少需要 6 个字符！" };
    }

    if (StorageManager.getUserByUsername(username)) {
      return { success: false, message: "该用户名已被注册，请更换一个！" };
    }
    if (StorageManager.getUserByEmail(email)) {
      return { success: false, message: "该邮箱已被其他账号绑定！" };
    }

    const newUser = {
      id: "user_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      username,
      email,
      password,
      nickname,
      avatar,
      role: "player",
      status: "active",
      sanctionLevel: 0,
      adminNotes: "",
      badges: ["player"],
      createdAt: Date.now(),
      lastLoginAt: Date.now()
    };

    StorageManager.saveUser(newUser);
    StorageManager.setCurrentUser(newUser);
    this.refreshUserBadges(newUser.id);

    return { success: true, user: newUser, message: "注册成功！已自动为您登录。" };
  },

  // ==========================================
  // 2. 登录验证
  // ==========================================
  login(identifier, password) {
    identifier = identifier.trim().toLowerCase();
    password = password.trim();

    if (!identifier || !password) {
      return { success: false, message: "请输入账号/邮箱和密码！" };
    }

    const user = StorageManager.getUserByUsername(identifier) || StorageManager.getUserByEmail(identifier);
    if (!user) {
      return { success: false, message: "账号或邮箱不存在！" };
    }

    if (user.password !== password) {
      return { success: false, message: "密码错误，请核对后重试！" };
    }

    if (user.status === "banned" || user.sanctionLevel >= 4) {
      return { success: false, message: "该账号处于封控封停状态，无法登录平台！如有异议请联系站长申诉。" };
    }

    user.lastLoginAt = Date.now();
    StorageManager.saveUser(user);
    StorageManager.setCurrentUser(user);
    this.refreshUserBadges(user.id);

    return { success: true, user, message: `欢迎回来，${user.nickname}！` };
  },

  // ==========================================
  // 3. 退出登录 (如果退出则自动恢复为站长会话或游客)
  // ==========================================
  logout() {
    StorageManager.setCurrentUser(null);
  },

  // ==========================================
  // 4. 找回密码
  // ==========================================
  sendResetCode(email) {
    email = email.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return { success: false, message: "请输入有效的注册邮箱！" };
    }

    const user = StorageManager.getUserByEmail(email);
    if (!user) {
      return { success: false, message: "未找到绑定此邮箱的账号！" };
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const saveRes = StorageManager.saveEmailCode(email, code);
    if (!saveRes.success) {
      return saveRes;
    }

    return {
      success: true,
      code,
      message: `验证码已发送至 ${email}，5分钟内有效！(模拟演练验证码: ${code})`
    };
  },

  resetPasswordWithCode(email, code, newPassword) {
    email = email.trim().toLowerCase();
    code = code.trim();
    newPassword = newPassword.trim();

    if (!newPassword || newPassword.length < 6) {
      return { success: false, message: "新密码长度至少需要 6 个字符！" };
    }

    const verifyResult = StorageManager.verifyEmailCode(email, code);
    if (!verifyResult.success) {
      return verifyResult;
    }

    const user = StorageManager.getUserByEmail(email);
    if (!user) {
      return { success: false, message: "账号不存在！" };
    }

    user.password = newPassword;
    StorageManager.saveUser(user);
    StorageManager.setCurrentUser(user);

    return { success: true, message: "密码已成功重置！已自动登录。" };
  },

  // ==========================================
  // 5. 修改密码
  // ==========================================
  changePassword(userId, oldPassword, newPassword) {
    const user = StorageManager.getUserById(userId);
    if (!user) return { success: false, message: "用户不存在" };
    if (user.password !== oldPassword) {
      return { success: false, message: "旧密码输入不正确！" };
    }
    if (!newPassword || newPassword.length < 6) {
      return { success: false, message: "新密码长度至少需要 6 个字符！" };
    }

    user.password = newPassword;
    StorageManager.saveUser(user);
    return { success: true, message: "密码修改成功！" };
  },

  // ==========================================
  // 6. 全自动勋章刷新结算器
  // ==========================================
  refreshUserBadges(userId) {
    const user = StorageManager.getUserById(userId);
    if (!user) return;

    const badges = new Set();
    badges.add("player");

    if (user.role === "super_admin") {
      badges.add("super_admin");
      badges.add("staff");
    }

    if (["game_reviewer", "release_controller", "inspector", "enforcer"].includes(user.role)) {
      badges.add("staff");
    }

    const myPublishedGames = StorageManager.getSubmissions()
      .filter(s => s.authorId === user.id && s.status === "published");
    if (myPublishedGames.length > 0) {
      badges.add("creator");
      if (user.role === "player") {
        user.role = "creator";
      }
    }

    const allGames = StorageManager.getAllGames();
    let hasTopScore = false;
    allGames.forEach(g => {
      const myScore = StorageManager.getGameScore(g.id);
      if (myScore && myScore >= 500) {
        hasTopScore = true;
      }
    });
    if (hasTopScore) {
      badges.add("top_rank");
    }

    user.badges = Array.from(badges);
    StorageManager.saveUser(user);
  }
};
