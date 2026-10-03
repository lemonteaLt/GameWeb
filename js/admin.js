/**
 * 游戏工坊与投稿发布逻辑 (Creator Workshop & Upload Logic)
 */
document.addEventListener("DOMContentLoaded", () => {
  const addGameForm = document.getElementById("addGameForm");
  const gameTitle = document.getElementById("gameTitle");
  const gameCategory = document.getElementById("gameCategory");
  const gameIcon = document.getElementById("gameIcon");
  const gameControls = document.getElementById("gameControls");
  const gameDescription = document.getElementById("gameDescription");
  const dropzone = document.getElementById("dropzone");
  const gameFileInput = document.getElementById("gameFileInput");
  const fileNameDisplay = document.getElementById("fileNameDisplay");
  const gameRawHtml = document.getElementById("gameRawHtml");
  const customGamesList = document.getElementById("customGamesList");

  const currentUser = StorageManager.getCurrentUser();
  let uploadedFileContent = "";

  // 渲染已发布列表
  function renderCustomList() {
    const customGames = StorageManager.getCustomGames();
    if (customGames.length === 0) {
      customGamesList.innerHTML = `
        <div style="text-align: center; padding: 24px; color: var(--text-dim);">
          暂无自制上传游戏，可通过上方表单提交第一款！
        </div>
      `;
      return;
    }

    let html = `
      <table class="manage-table">
        <thead>
          <tr>
            <th>图标</th>
            <th>名称</th>
            <th>分类</th>
            <th>简介</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
    `;

    customGames.forEach(game => {
      html += `
        <tr>
          <td style="font-size: 20px;">${StorageManager.escapeHtml(game.icon || '🎮')}</td>
          <td style="font-weight: 600;">${StorageManager.escapeHtml(game.title)}</td>
          <td><span class="game-card-category-badge" style="position: static;">${StorageManager.escapeHtml(game.categoryName)}</span></td>
          <td style="color: var(--text-muted); font-size: 13px; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${StorageManager.escapeHtml(game.description)}</td>
          <td>
            <button class="danger-btn delete-btn" data-id="${game.id}">下架删除</button>
          </td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    customGamesList.innerHTML = html;

    document.querySelectorAll(".delete-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const freshUser = StorageManager.getCurrentUser();
        if (!freshUser) {
          alert("⚠️ 请先登录账号！");
          return;
        }
        const customGames = StorageManager.getCustomGames();
        const targetGame = customGames.find(g => g.id === id);
        if (targetGame && freshUser.role !== "super_admin" && targetGame.authorId && targetGame.authorId !== freshUser.id) {
          alert("❌ 权限不足：仅有游戏原作者或超级管理员（站长）有权下架此游戏！");
          return;
        }
        if (confirm("确定要从网站下架并删除该游戏吗？")) {
          StorageManager.deleteCustomGame(id);
          renderCustomList();
        }
      });
    });
  }

  // 文件选择与拖拽
  dropzone.addEventListener("click", () => gameFileInput.click());

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("dragover");
  });

  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  gameFileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });

  function handleFile(file) {
    if (!file.name.endsWith(".html") && !file.name.endsWith(".htm")) {
      alert("请上传 .html 或 .htm 格式的游戏网页文件！");
      return;
    }
    fileNameDisplay.textContent = `已选择文件: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    const reader = new FileReader();
    reader.onload = (e) => {
      uploadedFileContent = e.target.result;
    };
    reader.readAsText(file);
  }

  // 表单提交发布 / 提交初审
  addGameForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const freshUser = StorageManager.getCurrentUser();
    if (!freshUser) {
      alert("⚠️ 请先在玩家大厅登录账号后再提交小游戏投稿！");
      return;
    }

    if (freshUser.sanctionLevel >= 2 || freshUser.status === "mute_submission" || freshUser.status === "banned") {
      alert("⚠️ 您的账号已被管理员冻结游戏投稿权限，无法提交新游戏！如有异议请向站长申诉。");
      return;
    }

    const finalHtml = uploadedFileContent || gameRawHtml.value.trim();
    if (!finalHtml) {
      alert("请上传游戏 HTML 文件，或者在下方文本框直接粘贴游戏源码！");
      return;
    }

    const categoryId = gameCategory.value;
    const catObj = DEFAULT_CATEGORIES.find(c => c.id === categoryId) || { name: "玩家工坊" };

    const gameId = "custom_" + Date.now();
    const gameData = {
      id: gameId,
      title: gameTitle.value.trim(),
      category: categoryId,
      categoryName: catObj.name,
      icon: gameIcon.value.trim() || "🚀",
      bgGradient: "linear-gradient(135deg, #6366f1, #06b6d4)",
      description: gameDescription.value.trim() || "创作者上传的精彩小游戏",
      controls: gameControls.value.trim() || "使用鼠标和键盘控制",
      customHtml: finalHtml,
      isBuiltin: false,
      rankings: [
        { player: "首发体验者", score: 100, date: "今日" }
      ]
    };

    // 如果是站长本人上传，直接全网上架
    if (currentUser && currentUser.role === "super_admin") {
      StorageManager.saveCustomGame(gameData);
      alert(`👑 站长特权：游戏《${gameData.title}》已直接免审全网上架！`);
    } else {
      // 普通玩家/创作者上传 -> 进入品控流水线（待初审）
      const newSubmission = {
        id: "sub_" + Date.now(),
        authorId: currentUser ? currentUser.id : "guest_user",
        authorUsername: currentUser ? currentUser.username : "guest",
        authorName: currentUser ? currentUser.nickname : "游客创作者",
        gameData: gameData,
        status: "pending_review", // 待审核管理员初审试玩
        createdAt: Date.now()
      };
      StorageManager.addSubmission(newSubmission);
      alert(`🎉 投稿成功！游戏《${gameData.title}》已送达【审核管理员】沙箱试玩队列，初审与终审通过后将正式上架全网！可在“我的 -> 我的投稿”查看进度。`);
    }

    addGameForm.reset();
    fileNameDisplay.textContent = "";
    uploadedFileContent = "";
    renderCustomList();
  });

  renderCustomList();
});
