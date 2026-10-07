const api = window.dropdownApi;

let workspaceItems = [];
let itemElements = [];
let highlightedIndex = 0;

function extractWorkspaceName(wsPath) {
  const normalized = String(wsPath || '').trim().replace(/[\\/]+$/, '');
  if (!normalized) return '未命名项目';
  const parts = normalized.split(/[\\/]/);
  return parts.at(-1) || normalized;
}

function updateHighlight(newIndex) {
  if (!itemElements.length) return;
  itemElements.forEach((el, idx) => {
    el.classList.toggle('is-keyboard-focused', idx === newIndex);
  });
  highlightedIndex = newIndex;
  itemElements[newIndex]?.scrollIntoView({ block: 'nearest' });
}

function selectWorkspaceItem(item) {
  if (!item || item.isActive) return;

  const targetPath = item.path;
  const targetPathKey = String(targetPath || '').trim().toLowerCase();

  // 1. 同步更新数据模型中的激活标志
  workspaceItems.forEach((it) => {
    it.isActive = String(it.path || '').trim().toLowerCase() === targetPathKey;
  });

  // 2. 原地更新顶部「当前项目」卡片的名称和路径
  const targetName = extractWorkspaceName(targetPath);
  const projectNameEl = document.getElementById('projectName');
  const projectPathEl = document.getElementById('projectPath');
  const projectPathRow = document.getElementById('projectPathRow');
  const heroBadge = document.getElementById('heroStatusBadge');
  const heroRemoveBtn = document.getElementById('heroRemoveBtn');
  if (projectNameEl) projectNameEl.textContent = targetName;
  if (projectPathEl) projectPathEl.textContent = targetPath || '尚未选择目录';
  if (projectPathRow) projectPathRow.title = targetPath || '';
  if (heroBadge) heroBadge.style.display = targetPath ? '' : 'none';
  if (heroRemoveBtn) heroRemoveBtn.style.display = targetPath ? 'inline-flex' : 'none';

  // 3. 原地切换列表条目的 DOM 视觉状态，保持弹窗开启且不发生元素跳动
  itemElements.forEach((btn, idx) => {
    const it = workspaceItems[idx];
    if (!it) return;
    if (it.isActive) {
      btn.classList.add('is-active');
      btn.setAttribute('aria-selected', 'true');
      highlightedIndex = idx;

      const rightArea = btn.querySelector('.item-right-area') || btn;
      if (!btn.querySelector('.active-tag')) {
        const tag = document.createElement('span');
        tag.className = 'active-tag';
        tag.textContent = '当前';
        rightArea.appendChild(tag);
      }
    } else {
      btn.classList.remove('is-active');
      btn.setAttribute('aria-selected', 'false');

      const tag = btn.querySelector('.active-tag');
      if (tag) tag.remove();
    }
  });

  // 4. 通知主进程在后台静默切换工作区，主界面顶栏随之联动更新，绝不自动关闭弹窗
  api?.switchWorkspace(targetPath);
}

let currentPayload = null;

function renderDropdown(payload) {
  if (!payload) return;
  const { activeWorkspace, recentWorkspaces, theme } = payload;
  document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';

  // 如果数据与当前内存完全一致，DOM 早已在后台静默预热就绪，直接跳过全量清空与重建
  if (
    currentPayload &&
    currentPayload.activeWorkspace === activeWorkspace &&
    currentPayload.theme === theme &&
    Array.isArray(currentPayload.recentWorkspaces) &&
    Array.isArray(recentWorkspaces) &&
    currentPayload.recentWorkspaces.length === recentWorkspaces.length &&
    currentPayload.recentWorkspaces.every((item, i) => item === recentWorkspaces[i])
  ) {
    return;
  }
  currentPayload = payload;

  const active = String(activeWorkspace || '').trim();
  const projectName = active ? extractWorkspaceName(active) : '未选择项目';

  const nameEl = document.getElementById('projectName');
  if (nameEl) nameEl.textContent = projectName;
  const pathEl = document.getElementById('projectPath');
  if (pathEl) pathEl.textContent = active || '尚未选择目录';
  const pathRow = document.getElementById('projectPathRow');
  if (pathRow) pathRow.title = active || '';
  const heroBadge = document.getElementById('heroStatusBadge');
  if (heroBadge) heroBadge.style.display = active ? '' : 'none';
  const heroRemoveBtn = document.getElementById('heroRemoveBtn');
  if (heroRemoveBtn) heroRemoveBtn.style.display = active ? 'inline-flex' : 'none';

  const rawRecent = Array.isArray(recentWorkspaces) ? recentWorkspaces : [];
  const seen = new Set();
  const list = [];
  if (active) {
    seen.add(active.toLowerCase());
    list.push({ path: active, isActive: true });
  }
  for (const item of rawRecent) {
    const p = String(item || '').trim();
    if (!p) continue;
    const k = p.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    list.push({ path: p, isActive: false });
  }

  workspaceItems = list;
  const countEl = document.getElementById('workspaceCount');
  if (countEl) countEl.textContent = list.length ? `${list.length} 个` : '';

  const listContainer = document.getElementById('workspaceList');
  listContainer.replaceChildren();
  itemElements = [];
  highlightedIndex = 0;

  if (!list.length) {
    const tip = document.createElement('div');
    tip.className = 'empty-tip';
    tip.textContent = '暂无可用工作区，请在设置中添加';
    listContainer.appendChild(tip);
  } else {
    list.forEach((item, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `workspace-item ${item.isActive ? 'is-active' : ''}`;
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-selected', String(item.isActive));
      btn.tabIndex = -1; // 统一由键盘上下键聚焦

      if (item.isActive) {
        highlightedIndex = index;
      }

      const dotWrapper = document.createElement('span');
      dotWrapper.className = 'item-status-wrapper';
      dotWrapper.setAttribute('aria-hidden', 'true');

      const dot = document.createElement('span');
      dot.className = 'item-dot';
      dotWrapper.appendChild(dot);
      btn.appendChild(dotWrapper);

      const meta = document.createElement('div');
      meta.className = 'item-meta';

      const name = document.createElement('span');
      name.className = 'item-name';
      name.textContent = extractWorkspaceName(item.path);
      meta.appendChild(name);

      const pathText = document.createElement('span');
      pathText.className = 'item-path';
      pathText.textContent = item.path || '';
      meta.appendChild(pathText);

      btn.appendChild(meta);

      const rightArea = document.createElement('div');
      rightArea.className = 'item-right-area';
      if (item.isActive) {
        const tag = document.createElement('span');
        tag.className = 'active-tag';
        tag.textContent = '当前';
        rightArea.appendChild(tag);
      }
      btn.appendChild(rightArea);

      btn.onmouseenter = () => {
        // 鼠标移入时更新当前索引并清除键盘焦点样式，依靠纯 CSS :hover 提供反馈
        itemElements.forEach((el) => el.classList.remove('is-keyboard-focused'));
        highlightedIndex = index;
      };

      btn.onclick = () => {
        if (!item.isActive) {
          selectWorkspaceItem(item);
        }
      };

      listContainer.appendChild(btn);
      itemElements.push(btn);
    });

    // 默认确保当前激活项在滚动视口内可见，不预打键盘高亮
    itemElements[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }

  // 避免打开下拉窗口时 Chromium 自动将焦点丢到唯一的普通 button (manageBtn) 上导致错误出现 focus-visible
  const card = document.getElementById('dropdownCard');
  if (card) {
    card.focus({ preventScroll: true });
  }

  // 同步测量撑开高度并通知，杜绝高度计算不足导致的底部被截断卡住
  const reportHeight = () => {
    const wrapper = document.querySelector('.dropdown-wrapper');
    if (wrapper) {
      const height = Math.ceil(Math.max(wrapper.getBoundingClientRect().height, wrapper.scrollHeight || 0));
      if (height > 50 && Math.abs(height - (window.__lastReportedDropdownHeight || 0)) >= 2) {
        window.__lastReportedDropdownHeight = height;
        if (api?.notifyReady) api.notifyReady(height);
        else if (api?.updateHeight) api.updateHeight(height);
      }
    }
  };
  requestAnimationFrame(reportHeight);
}

const manageBtn = document.getElementById('manageBtn');
if (manageBtn) {
  manageBtn.addEventListener('click', (event) => {
    event.currentTarget.blur();
    api?.openSettings();
  });
  manageBtn.addEventListener('pointerup', (event) => {
    event.currentTarget.blur();
  });
}

const heroRemoveBtn = document.getElementById('heroRemoveBtn');
if (heroRemoveBtn) {
  heroRemoveBtn.addEventListener('click', async (event) => {
    event.stopPropagation();
    const currentWs = currentPayload?.activeWorkspace;
    if (!currentWs) return;
    try {
      await api?.removeWorkspace?.(currentWs);
    } catch (err) {
      console.error('移除工作区失败:', err);
    }
  });
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    api?.close();
    return;
  }

  if (!itemElements.length) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const next = (highlightedIndex + 1) % itemElements.length;
    updateHighlight(next);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    const prev = (highlightedIndex - 1 + itemElements.length) % itemElements.length;
    updateHighlight(prev);
  } else if (e.key === 'Enter') {
    // 如果当前焦点不在管理按钮上，触发选中项
    if (document.activeElement !== document.getElementById('manageBtn')) {
      e.preventDefault();
      itemElements[highlightedIndex]?.click();
    }
  }
});

let hasRenderedFromPush = false;
api?.onData((data) => {
  hasRenderedFromPush = true;
  renderDropdown(data);
});

api?.getData?.().then((data) => {
  if (data && !hasRenderedFromPush) renderDropdown(data);
});
