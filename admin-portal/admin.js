/**
 * 站长最高独立控制台核心逻辑 (Super Admin Supreme Command Controller)
 */
document.addEventListener("DOMContentLoaded", () => {
  const adminAuthGate = document.getElementById("adminAuthGate");
  const gateAuthForm = document.getElementById("gateAuthForm");
  const gateEmail = document.getElementById("gateEmail");
  const gateUsername = document.getElementById("gateUsername");
  const gatePassword = document.getElementById("gatePassword");
  const gateErrorBanner = document.getElementById("gateErrorBanner");
  const gateErrorText = document.getElementById("gateErrorText");
  const lockTerminalBtn = document.getElementById("lockTerminalBtn");

  const adminApp = document.getElementById("adminApp");

  // DOM 节点
  const navTabs = document.querySelectorAll(".admin-tab-btn");
  const tabPanes = document.querySelectorAll(".tab-pane");

  // 统计节点
  const statTotalUsers = document.getElementById("statTotalUsers");
  const statTotalGames = document.getElementById("statTotalGames");
  const statPendingApps = document.getElementById("statPendingApps");
  const statOpenTickets = document.getElementById("statOpenTickets");

  // 会员表格节点
  const memberTableBody = document.getElementById("memberTableBody");
  const memberSearchInput = document.getElementById("memberSearchInput");
  const memberRoleFilter = document.getElementById("memberRoleFilter");
  const memberSanctionFilter = document.getElementById("memberSanctionFilter");

  // 审批与日志表格节点
  const staffAppTableBody = document.getElementById("staffAppTableBody");
  const gameMonitorTableBody = document.getElementById("gameMonitorTableBody");
  const auditTableBody = document.getElementById("auditTableBody");

  // 会员全维修改模态弹窗节点
  const userEditModal = document.getElementById("userEditModal");
  const closeUserEditBtn = document.getElementById("closeUserEditBtn");
  const cancelUserEditBtn = document.getElementById("cancelUserEditBtn");
  const userEditForm = document.getElementById("userEditForm");

  const editModalUid = document.getElementById("editModalUid");
  const editModalCreatedAt = document.getElementById("editModalCreatedAt");
  const editModalLastLogin = document.getElementById("editModalLastLogin");
  const editModalSubCount = document.getElementById("editModalSubCount");

  const editUserId = document.getElementById("editUserId");
  const editUsername = document.getElementById("editUsername");
  const editEmail = document.getElementById("editEmail");
  const editNickname = document.getElementById("editNickname");
  const editPassword = document.getElementById("editPassword");
  const editAvatar = document.getElementById("editAvatar");
  const editRole = document.getElementById("editRole");
  const editSanctionLevel = document.getElementById("editSanctionLevel");
  const editAdminNotes = document.getElementById("editAdminNotes");

  let adminFailedAttempts = 0;
  let adminLockUntil = 0;

  /* ==========================================
     1. 三重凭证核验门禁逻辑 (Triple-Factor Gate)
     ========================================== */
  function setupGateAuth() {
    // 检查会话是否已在此窗口通过核验
    const isSessionUnlocked = sessionStorage.getItem("admin_terminal_unlocked");
    const currentUser = StorageManager.getCurrentUser();
    if (isSessionUnlocked === "true" && currentUser && currentUser.role === "super_admin") {
      unlockTerminal();
    } else {
      lockTerminal();
    }

    gateAuthForm.addEventListener("submit", (e) => {
      e.preventDefault();

      if (Date.now() < adminLockUntil) {
        const remaining = Math.ceil((adminLockUntil - Date.now()) / 1000);
        showGateError(`⛔ 连续失败过多，终端安全锁定中，请在 ${remaining} 秒后再试！`);
        return;
      }

      const email = gateEmail.value.trim().toLowerCase();
      const username = gateUsername.value.trim();
      const password = gatePassword.value.trim();

      const allUsers = StorageManager.getAllUsers();
      // 严格同时匹配：邮箱 + 用户名 + 密码
      const matchedUser = allUsers.find(u => 
        u.email.toLowerCase() === email &&
        u.username.toLowerCase() === username.toLowerCase() &&
        u.password === password
      );

      if (!matchedUser) {
        adminFailedAttempts++;
        if (adminFailedAttempts >= 5) {
          adminLockUntil = Date.now() + 30000;
          showGateError("⛔ 凭证错误达 5 次，系统已触发安全保护锁定 30 秒！");
        } else {
          showGateError(`❌ 身份核验失败：邮箱、用户名或密码不匹配！(剩余尝试: ${5 - adminFailedAttempts}次)`);
        }
        return;
      }

      if (matchedUser.role !== "super_admin") {
        showGateError(`❌ 权限不足：账号【${StorageManager.escapeHtml(matchedUser.nickname)}】非超级管理员 (站长)，无法进入最高控制台！`);
        return;
      }

      // 核验完全通过！
      adminFailedAttempts = 0;
      gateErrorBanner.classList.remove("show");
      StorageManager.setCurrentUser(matchedUser);
      sessionStorage.setItem("admin_terminal_unlocked", "true");
      unlockTerminal();
    });

    lockTerminalBtn.addEventListener("click", () => {
      sessionStorage.removeItem("admin_terminal_unlocked");
      lockTerminal();
    });
  }

  function showGateError(msg) {
    gateErrorText.textContent = msg;
    gateErrorBanner.classList.add("show");
  }

  function unlockTerminal() {
    adminAuthGate.classList.add("hidden");
    adminApp.style.display = "flex";
    refreshAllData();
  }

  function lockTerminal() {
    adminAuthGate.classList.remove("hidden");
    adminApp.style.display = "none";
    if (gateAuthForm) {
      gateAuthForm.reset();
      gateEmail.value = "";
      gateUsername.value = "";
      gatePassword.value = "";
    }
  }

  /* ==========================================
     2. 初始化系统与标签切换
     ========================================== */
  function init() {
    setupGateAuth();
    setupTabSwitching();
    setupUserEditModal();
  }

  function setupTabSwitching() {
    navTabs.forEach(btn => {
      btn.addEventListener("click", () => {
        navTabs.forEach(b => b.classList.remove("active"));
        tabPanes.forEach(p => p.classList.remove("active"));
        btn.classList.add("active");
        const targetPane = document.getElementById(`tab-${btn.dataset.tab}`);
        if (targetPane) targetPane.classList.add("active");
      });
    });
  }

  function refreshAllData() {
    renderOverviewStats();
    renderMembers();
    renderStaffApplications();
    renderGamesMonitor();
    renderAuditLogs();
  }

  /* ==========================================
     3. 运营总览数据看板
     ========================================== */
  function renderOverviewStats() {
    const users = StorageManager.getAllUsers();
    const games = StorageManager.getAllGames();
    const apps = StorageManager.getApplications().filter(a => a.status === "pending");
    const tickets = StorageManager.getModerationTickets().filter(t => t.status === "open");

    statTotalUsers.textContent = users.length;
    statTotalGames.textContent = games.length;
    statPendingApps.textContent = apps.length;
    statOpenTickets.textContent = tickets.length;
  }

  /* ==========================================
     4. 会员全景管理
     ========================================== */
  function renderMembers() {
    const users = StorageManager.getAllUsers();
    const keyword = (memberSearchInput.value || "").trim().toLowerCase();
    const roleFilter = memberRoleFilter.value;
    const sanctionFilter = memberSanctionFilter.value;

    const filtered = users.filter(u => {
      const matchKey = !keyword ||
        u.username.toLowerCase().includes(keyword) ||
        u.nickname.toLowerCase().includes(keyword) ||
        u.email.toLowerCase().includes(keyword);
      const matchRole = roleFilter === "all" || u.role === roleFilter;
      const sancLevel = u.sanctionLevel !== undefined ? u.sanctionLevel : (u.status === "banned" ? 5 : 0);
      const matchSanction = sanctionFilter === "all" || String(sancLevel) === sanctionFilter;
      return matchKey && matchRole && matchSanction;
    });

    memberTableBody.innerHTML = "";
    if (filtered.length === 0) {
      memberTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-dim); padding: 30px;">未找到匹配的会员记录</td></tr>`;
      return;
    }

    filtered.forEach(u => {
      const roleInfo = ROLE_DEFINITIONS[u.role] || ROLE_DEFINITIONS.player;
      const sancLevel = u.sanctionLevel !== undefined ? u.sanctionLevel : (u.status === "banned" ? 5 : 0);
      const sancConfig = SANCTION_LEVELS[sancLevel] || SANCTION_LEVELS[0];

      const row = document.createElement("tr");
      row.innerHTML = `
        <td style="font-family: monospace; font-size: 12px; color: var(--text-dim);">${StorageManager.escapeHtml(u.id.slice(0, 10))}...</td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">${StorageManager.escapeHtml(u.avatar || '🎮')}</span>
            <strong>${StorageManager.escapeHtml(u.nickname)}</strong>
          </div>
        </td>
        <td>
          <div>${StorageManager.escapeHtml(u.username)}</div>
          <div style="font-size: 12px; color: var(--text-dim);">${StorageManager.escapeHtml(u.email)}</div>
        </td>
        <td>
          <span style="color: ${roleInfo.color}; font-weight: 700;">${roleInfo.icon} ${roleInfo.name}</span>
        </td>
        <td>
          <span class="pill-tag ${sancConfig.style}" style="color: ${sancConfig.color}; border-color: ${sancConfig.color}; font-weight: 700;">
            ${sancConfig.shortName}
          </span>
        </td>
        <td style="font-size: 12px; color: var(--text-dim);">${new Date(u.createdAt).toLocaleDateString()}</td>
        <td>
          <button class="admin-btn btn-gold open-edit-btn" data-id="${u.id}">
            🛠️ 查看与全项修改
          </button>
        </td>
      `;

      row.querySelector(".open-edit-btn").addEventListener("click", () => {
        openUserEditModal(u);
      });

      memberTableBody.appendChild(row);
    });
  }

  memberSearchInput.addEventListener("input", renderMembers);
  memberRoleFilter.addEventListener("change", renderMembers);
  memberSanctionFilter.addEventListener("change", renderMembers);

  /* ==========================================
     5. 会员全维度修改模态弹窗逻辑
     ========================================== */
  function setupUserEditModal() {
    closeUserEditBtn.addEventListener("click", () => userEditModal.classList.remove("active"));
    cancelUserEditBtn.addEventListener("click", () => userEditModal.classList.remove("active"));

    userEditForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const uid = editUserId.value;
      const user = StorageManager.getUserById(uid);
      if (!user) return;

      const newEmail = editEmail.value.trim();
      const newNickname = editNickname.value.trim();
      const newPassword = editPassword.value.trim();
      const newAvatar = editAvatar.value.trim() || "🎮";
      const newRole = editRole.value;
      const newSanction = parseInt(editSanctionLevel.value, 10);
      const newNotes = editAdminNotes.value.trim();

      if (!newEmail || !newEmail.includes("@")) {
        alert("请输入有效的电子邮箱地址！");
        return;
      }

      if (!newPassword || newPassword.length < 6) {
        alert("密码长度至少需要 6 个字符！");
        return;
      }

      // 核心站长防误封/防降权自锁保护机制
      if (user.username === "admin" && (newRole !== "super_admin" || newSanction > 0)) {
        alert("⚠️ 安全保护机制触发：站长账号为平台核心管理员，不可将自身角色降级或设置封控状态！");
        return;
      }

      user.email = newEmail;
      user.nickname = newNickname;
      user.password = newPassword;
      user.avatar = newAvatar;
      user.role = newRole;
      user.sanctionLevel = newSanction;
      user.adminNotes = newNotes;

      // 联动 status 状态
      if (newSanction >= 4) {
        user.status = "banned";
      } else if (newSanction === 2) {
        user.status = "mute_submission";
      } else {
        user.status = "active";
      }

      StorageManager.saveUser(user);
      AuthSystem.refreshUserBadges(user.id);

      alert(`🎉 成功更新用户【${user.nickname}】的全项信息与封控等级！`);
      userEditModal.classList.remove("active");
      refreshAllData();
    });
  }

  function openUserEditModal(user) {
    const subs = StorageManager.getUserSubmissions(user.id);

    editModalUid.textContent = user.id;
    editModalCreatedAt.textContent = new Date(user.createdAt).toLocaleDateString();
    editModalLastLogin.textContent = user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : '未记录';
    editModalSubCount.textContent = subs.length;

    editUserId.value = user.id;
    editUsername.value = user.username;
    editEmail.value = user.email;
    editNickname.value = user.nickname;
    editPassword.value = user.password;
    editAvatar.value = user.avatar || "🎮";
    editRole.value = user.role;
    editSanctionLevel.value = user.sanctionLevel !== undefined ? user.sanctionLevel : (user.status === "banned" ? 5 : 0);
    editAdminNotes.value = user.adminNotes || "";

    userEditModal.classList.add("active");
  }

  /* ==========================================
     6. 团队职位任命审批
     ========================================== */
  function renderStaffApplications() {
    const apps = StorageManager.getApplications();
    staffAppTableBody.innerHTML = "";

    if (apps.length === 0) {
      staffAppTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-dim); padding: 30px;">暂无新的管理团队申请</td></tr>`;
      return;
    }

    apps.forEach(app => {
      const targetRole = ROLE_DEFINITIONS[app.targetRole] || { name: app.targetRole, icon: "🛡️" };
      let statusHtml = `<span class="pill-tag pill-muted">待站长审批</span>`;
      if (app.status === "approved") statusHtml = `<span class="pill-tag pill-active">已批准任命</span>`;
      else if (app.status === "rejected") statusHtml = `<span class="pill-tag pill-banned">已拒绝</span>`;

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>
          <div style="font-weight: 700;">${StorageManager.escapeHtml(app.applicantNickname)}</div>
          <div style="font-size: 12px; color: var(--text-dim);">${StorageManager.escapeHtml(app.applicantUsername)}</div>
        </td>
        <td>
          <span style="color: var(--gold-primary); font-weight: 700;">${targetRole.icon} ${targetRole.name}</span>
        </td>
        <td style="max-width: 320px; font-size: 13px; color: var(--text-muted); line-height: 1.5;">${StorageManager.escapeHtml(app.statement)}</td>
        <td style="font-size: 12px; color: var(--text-dim);">${new Date(app.createdAt).toLocaleDateString()}</td>
        <td>${statusHtml}</td>
        <td>
          ${app.status === "pending" ? `
            <div style="display: flex; gap: 6px;">
              <button class="admin-btn btn-gold approve-app-btn" data-id="${app.id}">✅ 批准任命</button>
              <button class="admin-btn btn-danger reject-app-btn" data-id="${app.id}">❌ 拒绝</button>
            </div>
          ` : `<span style="font-size: 12px; color: var(--text-dim);">已处理归档</span>`}
        </td>
      `;

      if (app.status === "pending") {
        row.querySelector(".approve-app-btn").addEventListener("click", () => {
          StorageManager.updateApplication(app.id, { status: "approved" });
          const user = StorageManager.getUserById(app.applicantId);
          if (user) {
            user.role = app.targetRole;
            AuthSystem.refreshUserBadges(user.id);
          }
          alert(`🎉 已正式批准并任命【${user ? user.nickname : app.applicantNickname}】为 ${targetRole.name}！`);
          refreshAllData();
        });

        row.querySelector(".reject-app-btn").addEventListener("click", () => {
          StorageManager.updateApplication(app.id, { status: "rejected" });
          alert(`已拒绝该职位的申请。`);
          refreshAllData();
        });
      }

      staffAppTableBody.appendChild(row);
    });
  }

  /* ==========================================
     7. 全量游戏监控与终极下架
     ========================================== */
  function renderGamesMonitor() {
    const games = StorageManager.getAllGames();
    gameMonitorTableBody.innerHTML = "";

    games.forEach(g => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td style="font-size: 24px;">${StorageManager.escapeHtml(g.icon || '🎮')}</td>
        <td style="font-weight: 700;">${StorageManager.escapeHtml(g.title)}</td>
        <td><span class="pill-tag pill-muted">${StorageManager.escapeHtml(g.categoryName)}</span></td>
        <td style="font-size: 13px; color: var(--text-muted);">${g.isBuiltin ? '📦 内置官方' : '🛠️ 创作者投稿'}</td>
        <td style="max-width: 320px; font-size: 13px; color: var(--text-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${StorageManager.escapeHtml(g.description)}</td>
        <td>
          <button class="admin-btn btn-danger delete-game-btn" data-id="${g.id}">
            🗑️ 终极强制下架
          </button>
        </td>
      `;

      row.querySelector(".delete-game-btn").addEventListener("click", () => {
        if (confirm(`【站长终极操作】确定要从全站永久下架并删除游戏《${g.title}》吗？`)) {
          StorageManager.deleteCustomGame(g.id);
          alert(`游戏《${g.title}》已被强制全网下架！`);
          refreshAllData();
        }
      });

      gameMonitorTableBody.appendChild(row);
    });
  }

  /* ==========================================
     8. 违规封控执行日志
     ========================================== */
  function renderAuditLogs() {
    const tickets = StorageManager.getModerationTickets();
    auditTableBody.innerHTML = "";

    if (tickets.length === 0) {
      auditTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-dim); padding: 30px;">暂无巡查与封控记录</td></tr>`;
      return;
    }

    tickets.forEach(t => {
      let statusHtml = `<span class="pill-tag pill-muted">待封控员裁决</span>`;
      if (t.status === "resolved") statusHtml = `<span class="pill-tag pill-active">已执行处罚</span>`;

      const row = document.createElement("tr");
      row.innerHTML = `
        <td style="font-family: monospace; font-size: 12px;">${StorageManager.escapeHtml(t.id)}</td>
        <td><strong>${StorageManager.escapeHtml(t.targetUsername || '匿名对象')}</strong></td>
        <td><span class="pill-tag pill-banned">${StorageManager.escapeHtml(t.violationType)}</span></td>
        <td style="font-size: 13px; color: var(--text-muted); max-width: 260px;">${StorageManager.escapeHtml(t.evidenceDesc)}</td>
        <td style="font-size: 13px; color: #fbbf24;">${StorageManager.escapeHtml(t.actionTaken || '尚未裁决')}</td>
        <td>${statusHtml}</td>
      `;
      auditTableBody.appendChild(row);
    });
  }

  // 启动初始化
  init();
});
