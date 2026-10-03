/**
 * 管理团队协同工作台控制器 (Staff Workbench Controller)
 * 配备三重凭证身份核验门禁终端与全站 XSS 净化
 */
document.addEventListener("DOMContentLoaded", () => {
  // 门禁 DOM 节点
  const staffAuthGate = document.getElementById("staffAuthGate");
  const staffGateForm = document.getElementById("staffGateForm");
  const staffGateEmail = document.getElementById("staffGateEmail");
  const staffGateUsername = document.getElementById("staffGateUsername");
  const staffGatePassword = document.getElementById("staffGatePassword");
  const staffGateErrorBanner = document.getElementById("staffGateErrorBanner");
  const staffGateErrorText = document.getElementById("staffGateErrorText");
  const staffWorkbenchApp = document.getElementById("staffWorkbenchApp");
  const lockStaffTerminalBtn = document.getElementById("lockStaffTerminalBtn");

  // 工作台 DOM 节点
  const myRoleTag = document.getElementById("myRoleTag");
  const tabBtns = document.querySelectorAll(".wb-tab-btn");
  const panes = {
    review: document.getElementById("pane-review"),
    release: document.getElementById("pane-release"),
    inspect: document.getElementById("pane-inspect"),
    enforce: document.getElementById("pane-enforce")
  };

  const reviewQueueList = document.getElementById("reviewQueueList");
  const releaseQueueList = document.getElementById("releaseQueueList");
  const inspectForm = document.getElementById("inspectForm");
  const enforceQueueList = document.getElementById("enforceQueueList");

  const sandboxModal = document.getElementById("sandboxModal");
  const sandboxFrame = document.getElementById("sandboxFrame");
  const sandboxTitle = document.getElementById("sandboxTitle");
  const closeSandboxBtn = document.getElementById("closeSandboxBtn");

  let authFailedAttempts = 0;
  let lockUntilTimestamp = 0;

  const STAFF_ROLES = ["super_admin", "game_reviewer", "release_controller", "inspector", "enforcer"];

  /* ==========================================
     1. 管理员专属三重凭证核验门禁逻辑
     ========================================== */
  function setupStaffGateAuth() {
    const isUnlocked = sessionStorage.getItem("staff_workbench_unlocked");
    const currentUser = StorageManager.getCurrentUser();

    if (isUnlocked === "true" && currentUser && STAFF_ROLES.includes(currentUser.role)) {
      unlockWorkbench(currentUser);
    } else {
      lockWorkbench();
    }

    staffGateForm.addEventListener("submit", (e) => {
      e.preventDefault();

      if (Date.now() < lockUntilTimestamp) {
        const remaining = Math.ceil((lockUntilTimestamp - Date.now()) / 1000);
        showGateError(`⛔ 连续失败过多，终端安全锁定中，请在 ${remaining} 秒后再试！`);
        return;
      }

      const email = staffGateEmail.value.trim().toLowerCase();
      const username = staffGateUsername.value.trim();
      const password = staffGatePassword.value.trim();

      const allUsers = StorageManager.getAllUsers();
      const matchedUser = allUsers.find(u => 
        u.email.toLowerCase() === email &&
        u.username.toLowerCase() === username.toLowerCase() &&
        u.password === password
      );

      if (!matchedUser) {
        authFailedAttempts++;
        if (authFailedAttempts >= 5) {
          lockUntilTimestamp = Date.now() + 30000;
          showGateError("⛔ 凭证错误达 5 次，系统已触发安全保护锁定 30 秒！");
        } else {
          showGateError(`❌ 身份核验失败：邮箱、用户名或密码不正确！(剩余尝试: ${5 - authFailedAttempts}次)`);
        }
        return;
      }

      if (matchedUser.sanctionLevel >= 4 || matchedUser.status === "banned") {
        showGateError("⛔ 账号已被封控停职，无法登录管理工作台！");
        return;
      }

      if (!STAFF_ROLES.includes(matchedUser.role)) {
        showGateError(`❌ 权限不足：账号【${StorageManager.escapeHtml(matchedUser.nickname)}】属于普通玩家，无管理团队执勤权限！可在前台个人中心申请加入管理。`);
        return;
      }

      // 核验完全通过！
      authFailedAttempts = 0;
      staffGateErrorBanner.classList.remove("show");
      StorageManager.setCurrentUser(matchedUser);
      sessionStorage.setItem("staff_workbench_unlocked", "true");
      unlockWorkbench(matchedUser);
    });

    if (lockStaffTerminalBtn) {
      lockStaffTerminalBtn.addEventListener("click", () => {
        sessionStorage.removeItem("staff_workbench_unlocked");
        lockWorkbench();
      });
    }
  }

  function showGateError(msg) {
    staffGateErrorText.textContent = msg;
    staffGateErrorBanner.classList.add("show");
  }

  function unlockWorkbench(user) {
    staffAuthGate.classList.add("hidden");
    staffWorkbenchApp.style.display = "flex";

    const roleInfo = ROLE_DEFINITIONS[user.role] || ROLE_DEFINITIONS.player;
    myRoleTag.textContent = `${roleInfo.icon} ${roleInfo.name} (${user.nickname})`;

    // 根据职位自动聚焦默认选项卡
    if (user.role === "game_reviewer") switchTab("review");
    else if (user.role === "release_controller") switchTab("release");
    else if (user.role === "inspector") switchTab("inspect");
    else if (user.role === "enforcer") switchTab("enforce");
    else switchTab("review");

    refreshAllQueues();
  }

  function lockWorkbench() {
    sessionStorage.removeItem("staff_workbench_unlocked");
    staffAuthGate.classList.remove("hidden");
    staffWorkbenchApp.style.display = "none";
    if (staffGateForm) {
      staffGateForm.reset();
      staffGateEmail.value = "";
      staffGateUsername.value = "";
      staffGatePassword.value = "";
    }
  }

  // 跨窗口实时监听站长对管理员的封控、降权与停职操作
  window.addEventListener("storage", (e) => {
    if (e.key === "minigame_users_db" || e.key === "minigame_current_user") {
      const isUnlocked = sessionStorage.getItem("staff_workbench_unlocked");
      if (isUnlocked === "true") {
        const freshUser = StorageManager.getCurrentUser();
        if (!freshUser || !STAFF_ROLES.includes(freshUser.role) || freshUser.sanctionLevel >= 4 || freshUser.status === "banned") {
          lockWorkbench();
          alert("⛔ 权限变更通知：您的管理员执勤权限已被站长撤销或账号已被停职封控，已强制退出工作台！");
        } else {
          const roleInfo = ROLE_DEFINITIONS[freshUser.role] || ROLE_DEFINITIONS.player;
          myRoleTag.textContent = `${roleInfo.icon} ${roleInfo.name} (${freshUser.nickname})`;
          refreshAllQueues();
        }
      }
    }
  });

  /* ==========================================
     2. 选项卡切换与沙箱控制
     ========================================== */
  function setupTabs() {
    tabBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        switchTab(btn.dataset.tab);
      });
    });

    closeSandboxBtn.addEventListener("click", () => {
      sandboxModal.classList.remove("active");
      sandboxFrame.srcdoc = "";
      sandboxFrame.src = "about:blank";
    });
  }

  function switchTab(tabKey) {
    tabBtns.forEach(b => b.classList.toggle("active", b.dataset.tab === tabKey));
    Object.keys(panes).forEach(k => {
      if (panes[k]) panes[k].style.display = k === tabKey ? "block" : "none";
    });
  }

  function refreshAllQueues() {
    renderReviewQueue();
    renderReleaseQueue();
    renderEnforceQueue();
  }

  // ==========================================
  // 3. 初审队列 (游戏审核员)
  // ==========================================
  function renderReviewQueue() {
    const subs = StorageManager.getSubmissions().filter(s => s.status === "pending_review");
    reviewQueueList.innerHTML = "";

    if (subs.length === 0) {
      reviewQueueList.innerHTML = `
        <div style="text-align: center; color: var(--text-dim); padding: 40px;">
          暂无待初审的游戏投稿 ✨
        </div>
      `;
      return;
    }

    subs.forEach(s => {
      const card = document.createElement("div");
      card.className = "submission-item";
      card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="font-size: 32px;">${StorageManager.escapeHtml(s.gameData.icon || '🎮')}</div>
          <div>
            <h3 style="font-size: 16px; font-weight: 700;">${StorageManager.escapeHtml(s.gameData.title)}</h3>
            <div style="font-size: 12px; color: var(--text-dim);">投稿作者：${StorageManager.escapeHtml(s.authorName)} · 分类：${StorageManager.escapeHtml(s.gameData.categoryName)}</div>
            <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">${StorageManager.escapeHtml(s.gameData.description)}</p>
          </div>
        </div>
        <div style="display: flex; gap: 8px; flex-shrink: 0;">
          <button class="stage-control-btn playtest-btn" style="background: rgba(6, 182, 212, 0.2); border-color: #06b6d4;">
            ▶ 沙箱隔离试玩
          </button>
          <button class="stage-control-btn pass-review-btn" style="background: rgba(16, 185, 129, 0.2); border-color: #10b981;">
            📝 提交初审报告
          </button>
        </div>
      `;

      card.querySelector(".playtest-btn").addEventListener("click", () => {
        openSandbox(s.gameData);
      });

      card.querySelector(".pass-review-btn").addEventListener("click", () => {
        const notes = prompt(`请输入初审评估意见 (将推送给后台控制员)：`, "沙箱试玩正常，体验良好，准予进入终审。");
        if (notes !== null) {
          const currentUser = StorageManager.getCurrentUser();
          StorageManager.updateSubmission(s.id, {
            status: "reviewed",
            reviewerName: currentUser ? currentUser.nickname : "审核管理员",
            reviewerNotes: notes.trim()
          });
          alert(`🎉 初审评估已提交！该游戏已流转至【后台控制员】终审发布队列。`);
          refreshAllQueues();
        }
      });

      reviewQueueList.appendChild(card);
    });
  }

  function openSandbox(gameData) {
    sandboxTitle.textContent = `🔒 隔离沙箱安全试玩: 《${gameData.title}》`;
    if (gameData.customHtml) {
      sandboxFrame.srcdoc = gameData.customHtml;
    } else if (gameData.entryPath) {
      sandboxFrame.src = gameData.entryPath;
    }
    sandboxModal.classList.add("active");
  }

  // ==========================================
  // 4. 终审与发布队列 (后台控制员)
  // ==========================================
  function renderReleaseQueue() {
    const subs = StorageManager.getSubmissions().filter(s => s.status === "reviewed");
    releaseQueueList.innerHTML = "";

    if (subs.length === 0) {
      releaseQueueList.innerHTML = `
        <div style="text-align: center; color: var(--text-dim); padding: 40px;">
          暂无已通过初审待终审的队列 ✨
        </div>
      `;
      return;
    }

    subs.forEach(s => {
      const card = document.createElement("div");
      card.className = "submission-item";
      card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="font-size: 32px;">${StorageManager.escapeHtml(s.gameData.icon || '🎮')}</div>
          <div>
            <h3 style="font-size: 16px; font-weight: 700;">${StorageManager.escapeHtml(s.gameData.title)}</h3>
            <div style="font-size: 12px; color: #38bdf8;">审核员 (${StorageManager.escapeHtml(s.reviewerName)}) 报告: "${StorageManager.escapeHtml(s.reviewerNotes)}"</div>
            <div style="font-size: 12px; color: var(--text-dim); margin-top: 4px;">作者：${StorageManager.escapeHtml(s.authorName)} · 分类：${StorageManager.escapeHtml(s.gameData.categoryName)}</div>
          </div>
        </div>
        <div style="display: flex; gap: 8px; flex-shrink: 0;">
          <button class="stage-control-btn publish-btn" style="background: var(--accent-color); border: none; font-weight: 700;">
            🚀 正式全网上架
          </button>
          <button class="stage-control-btn reject-btn" style="background: rgba(239, 68, 68, 0.2); border-color: #ef4444; color: #fca5a5;">
            ❌ 驳回并反馈
          </button>
        </div>
      `;

      card.querySelector(".publish-btn").addEventListener("click", () => {
        StorageManager.updateSubmission(s.id, {
          status: "published",
          publishedAt: Date.now()
        });
        if (s.authorId) {
          AuthSystem.refreshUserBadges(s.authorId);
        }
        alert(`🎉 恭喜！游戏《${s.gameData.title}》已正式全网上架，大厅所有玩家即可畅玩！`);
        refreshAllQueues();
      });

      card.querySelector(".reject-btn").addEventListener("click", () => {
        const reason = prompt(`请输入驳回原因 (将反馈给创作者)：`, "经终审复核，游戏存在兼容性或体验问题，请调整后重提。");
        if (reason) {
          StorageManager.updateSubmission(s.id, {
            status: "rejected",
            rejectReason: reason.trim()
          });
          alert(`已驳回该投稿，原因已同步至创作者中心。`);
          refreshAllQueues();
        }
      });

      releaseQueueList.appendChild(card);
    });
  }

  // ==========================================
  // 5. 巡查取证工单提交 (巡查管理员)
  // ==========================================
  inspectForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const currentUser = StorageManager.getCurrentUser();
    const target = document.getElementById("ticketTarget").value.trim();
    const type = document.getElementById("ticketType").value;
    const evidence = document.getElementById("ticketEvidence").value.trim();

    const newTicket = {
      id: "ticket_" + Date.now(),
      targetUsername: target,
      violationType: type,
      evidenceDesc: evidence,
      inspectorName: currentUser ? currentUser.nickname : "巡查管理员",
      status: "open",
      createdAt: Date.now()
    };

    StorageManager.addModerationTicket(newTicket);
    alert(`✅ 违规工单已生成，已成功推送给【封控管理员】裁决！`);
    inspectForm.reset();
    refreshAllQueues();
  });

  // ==========================================
  // 6. 违规工单裁决与阶梯封控 (封控管理员)
  // ==========================================
  function renderEnforceQueue() {
    const tickets = StorageManager.getModerationTickets().filter(t => t.status === "open");
    enforceQueueList.innerHTML = "";

    if (tickets.length === 0) {
      enforceQueueList.innerHTML = `
        <div style="text-align: center; color: var(--text-dim); padding: 40px;">
          当前全站秩序良好，暂无待裁决的违规工单 🛡️
        </div>
      `;
      return;
    }

    tickets.forEach(t => {
      const card = document.createElement("div");
      card.className = "submission-item";
      card.innerHTML = `
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="game-card-category-badge" style="position: static; background: #ef4444;">${StorageManager.escapeHtml(t.violationType)}</span>
            <strong style="font-size: 15px;">违规对象: ${StorageManager.escapeHtml(t.targetUsername)}</strong>
          </div>
          <p style="font-size: 13px; color: var(--text-muted); margin-top: 6px;">取证依据: ${StorageManager.escapeHtml(t.evidenceDesc)}</p>
          <div style="font-size: 12px; color: var(--text-dim); margin-top: 4px;">由巡查员【${StorageManager.escapeHtml(t.inspectorName)}】提交 · ${new Date(t.createdAt).toLocaleTimeString()}</div>
        </div>
        <div style="display: flex; gap: 6px; flex-shrink: 0; flex-direction: column;">
          <button class="stage-control-btn sanction-btn" data-level="1" style="font-size: 12px;">🟡 等级1：轻度警告与清分</button>
          <button class="stage-control-btn sanction-btn" data-level="2" style="font-size: 12px; color: #fbbf24;">🟠 等级2：冻结投稿权限</button>
          <button class="stage-control-btn sanction-btn" data-level="4" style="font-size: 12px; color: #f87171;">⛔ 等级4：封停账号 30天</button>
        </div>
      `;

      card.querySelectorAll(".sanction-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const currentUser = StorageManager.getCurrentUser();
          const level = parseInt(btn.dataset.level, 10);
          const targetUser = StorageManager.getUserByUsername(t.targetUsername);

          let actionTaken = `封控执行：等级 ${level}`;
          if (targetUser) {
            targetUser.sanctionLevel = level;
            if (level >= 4) targetUser.status = "banned";
            else if (level === 2) targetUser.status = "mute_submission";
            else targetUser.status = "active";
            StorageManager.saveUser(targetUser);
            AuthSystem.refreshUserBadges(targetUser.id);
            actionTaken = `已对【${targetUser.nickname}】实施 ${level} 级封控制裁`;
          }

          StorageManager.updateModerationTicket(t.id, {
            status: "resolved",
            enforcerName: currentUser ? currentUser.nickname : "封控管理员",
            actionTaken: actionTaken
          });

          alert(`🎉 裁决完成！${actionTaken}`);
          refreshAllQueues();
        });
      });

      enforceQueueList.appendChild(card);
    });
  }

  // 初始化门禁与功能
  setupStaffGateAuth();
  setupTabs();
});
