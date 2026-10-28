(() => {
  'use strict';

  const api = window.storageBootstrap;
  const phaseLabels = {
    inventory: '扫描文件清单',
    copy: '复制数据',
    verify: '校验数据',
    commit: '切换数据位置',
    done: '已完成'
  };
  const state = {
    snapshot: null,
    selectedProfile: null,
    selectedMemory: null,
    allowEmptyMemory: false,
    confirming: false,
    recoveryCommitted: false,
    busy: false,
    restartFailed: false,
    restartError: '',
    restartPending: false,
    quitBusy: false,
    revision: 0
  };

  const byId = (id) => document.getElementById(id);
  const setText = (id, value) => {
    const element = byId(id);
    if (element) element.textContent = value == null || value === '' ? '未能读取' : String(value);
  };
  const setHidden = (id, hidden) => {
    const element = byId(id);
    if (element) element.hidden = Boolean(hidden);
  };
  const setDisabled = (id, disabled) => {
    const element = byId(id);
    if (element) element.disabled = Boolean(disabled);
  };
  const isCount = (value) => Number.isFinite(value) && value >= 0;

  function isBootstrapState(value) {
    return Boolean(value && typeof value === 'object' &&
      (value.mode === 'progress' || value.mode === 'recovery'));
  }

  function formatBytes(value) {
    if (!isCount(value)) return '';
    if (value < 1024) return `${Math.floor(value)} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let amount = value / 1024;
    let unitIndex = 0;
    while (amount >= 1024 && unitIndex < units.length - 1) {
      amount /= 1024;
      unitIndex += 1;
    }
    return `${amount.toFixed(2)} ${units[unitIndex]}`;
  }

  function renderProgress(snapshot) {
    const progress = snapshot.progress && typeof snapshot.progress === 'object' ? snapshot.progress : {};
    const phase = typeof progress.phase === 'string' ? progress.phase : '';
    const isComplete = phase === 'done';
    const failed = isComplete && Boolean(snapshot.error);
    const canContinue = isComplete && !state.busy && !state.quitBusy;
    const files = isCount(progress.files) ? progress.files : null;
    const totalFiles = isCount(progress.totalFiles) ? progress.totalFiles : null;
    const bytes = isCount(progress.bytes) ? progress.bytes : null;
    const totalBytes = isCount(progress.totalBytes) ? progress.totalBytes : null;

    setText('progressTitle', failed ? '迁移未完成' : (isComplete ? '数据处理完成' : '正在处理数据'));
    setText('progressPhase', failed ? '切换失败，保留原目录' : (phaseLabels[phase] || '正在准备'));
    setText('progressFiles', files === null ? '' : `已处理 ${Math.floor(files)}${totalFiles === null ? '' : ` / ${Math.floor(totalFiles)}`} 个文件`);
    setText('progressBytes', bytes === null ? '' : `已处理 ${formatBytes(bytes)}${totalBytes === null ? '' : ` / ${formatBytes(totalBytes)}`}`);
    setHidden('progressFilesRow', files === null);
    setHidden('progressBytesRow', bytes === null);

    const meter = byId('progressMeter');
    let denominator = null;
    let numerator = null;
    if (totalFiles !== null && totalFiles > 0 && files !== null) {
      denominator = totalFiles;
      numerator = files;
    } else if (totalBytes !== null && totalBytes > 0 && bytes !== null) {
      denominator = totalBytes;
      numerator = bytes;
    }
    if (meter) {
      const showMeter = denominator !== null && !failed;
      meter.hidden = !showMeter;
      if (showMeter) {
        meter.max = denominator;
        meter.value = Math.min(numerator, denominator);
      }
    }

    setText('progressError', state.restartFailed ? state.restartError : snapshot.error);
    setHidden('progressError', !snapshot.error && !state.restartFailed);
    setText('progressDoneMessage', snapshot.error
      ? '迁移未完成，原数据目录仍可用。可以进入 Mika 后检查存储设置。'
      : '数据处理完成，可以进入 Mika。');
    byId('progressDoneMessage').className = failed ? 'panel-description' : 'success-message';
    setHidden('progressDoneMessage', !isComplete || state.restartFailed);
    setHidden('continueButton', !isComplete);
    setText('continueButton', state.restartFailed ? '重试进入 Mika' : (snapshot.error ? '使用原目录进入 Mika' : '进入 Mika'));
    setDisabled('continueButton', !canContinue || state.restartPending);
    setText('progressDescription', state.restartPending
      ? '正在重新启动 Mika…'
      : (failed ? '未切换到目标位置，仍使用原数据目录。请保留现场以排查原因。'
        : isComplete ? '数据已校验完成，可以继续进入 Mika。' : '请保持 Mika 打开，处理完成后即可继续。'));
  }

  function renderRecovery(snapshot) {
    setText('recoveryError', snapshot.error);
    setHidden('recoveryError', !snapshot.error);
    setText('currentRoot', snapshot.currentRoot);
    setText('locatorFile', snapshot.locatorFile);
    setText('profilePath', state.selectedProfile || '尚未选择');
    setText('memoryPath', state.selectedMemory || (state.allowEmptyMemory ? '将新建空记忆子目录' : '尚未选择'));

    const allowEmpty = byId('allowEmptyMemory');
    if (allowEmpty) allowEmpty.checked = state.allowEmptyMemory;
    const inputsDisabled = state.busy || state.recoveryCommitted || state.quitBusy;
    setDisabled('chooseProfileButton', inputsDisabled);
    setDisabled('chooseMemoryButton', inputsDisabled || state.allowEmptyMemory);
    setDisabled('allowEmptyMemory', inputsDisabled);
    setDisabled('reviewRecoveryButton', inputsDisabled || !state.selectedProfile || (!state.selectedMemory && !state.allowEmptyMemory));

    setHidden('recoveryConfirmation', !state.confirming || state.recoveryCommitted);
    setText('confirmProfilePath', state.selectedProfile);
    setText('confirmMemoryPath', state.selectedMemory || '将按确认创建空记忆子目录');
    setText('confirmLocatorFile', snapshot.locatorFile);
    setDisabled('cancelConfirmationButton', state.busy || state.recoveryCommitted);
    setDisabled('confirmRecoveryButton', state.busy || state.recoveryCommitted || !state.selectedProfile || (!state.selectedMemory && !state.allowEmptyMemory));

    setHidden('recoveryRestartMessage', !state.recoveryCommitted);
    setText('recoveryRestartMessage', '数据位置已恢复，Mika 正在自动重新启动。如果没有自动进入，可手动重新进入。');
    setHidden('retryRestartButton', !state.recoveryCommitted);
    setDisabled('retryRestartButton', state.busy || state.quitBusy || state.restartPending);
    setHidden('reviewRecoveryButton', state.recoveryCommitted || state.confirming);
    const readyToReview = Boolean(state.selectedProfile && (state.selectedMemory || state.allowEmptyMemory));
    setText('recoveryRequirement', !state.selectedProfile
      ? '请先选择已有配置目录。'
      : '选择已有记忆目录，或勾选上方选项以允许新建空记忆子目录。');
    setHidden('recoveryRequirement', readyToReview);
    setText('recoveryOperationError', state.restartFailed ? state.restartError : state.operationError);
    setHidden('recoveryOperationError', !state.restartFailed && !state.operationError);
  }

  function render() {
    const snapshot = state.snapshot;
    const hasProgress = snapshot?.mode === 'progress';
    const hasRecovery = snapshot?.mode === 'recovery';
    setHidden('progressPanel', !hasProgress);
    setHidden('recoveryPanel', !hasRecovery);
    setHidden('bootstrapFatalError', hasProgress || hasRecovery);
    document.querySelectorAll('.quit-button').forEach((button) => { button.disabled = state.quitBusy; });
    if (!snapshot) return;
    if (hasProgress) renderProgress(snapshot);
    if (hasRecovery) renderRecovery(snapshot);
  }

  function acceptState(snapshot) {
    if (!isBootstrapState(snapshot)) return;
    state.revision += 1;
    state.snapshot = snapshot;
    state.operationError = '';
    state.restartFailed = false;
    state.restartError = '';
    render();
  }

  function showOperationError(error) {
    const message = error instanceof Error ? error.message : String(error || '操作失败');
    if (state.snapshot?.mode === 'progress') {
      state.restartFailed = true;
      state.restartError = message;
    } else {
      state.operationError = message;
    }
    render();
  }

  async function chooseDirectory(kind) {
    if (state.busy || state.recoveryCommitted) return;
    state.busy = true;
    state.confirming = false;
    state.operationError = '';
    render();
    try {
      const selected = await api.choose(kind);
      if (selected !== null && (typeof selected !== 'string' || !selected.trim())) {
        throw new Error('目录选择结果无效');
      }
      if (selected !== null) {
        if (kind === 'profile') state.selectedProfile = selected;
        else {
          state.selectedMemory = selected;
          state.allowEmptyMemory = false;
        }
      }
    } catch (error) {
      state.operationError = error instanceof Error ? error.message : String(error || '选择目录失败');
    } finally {
      state.busy = false;
      render();
    }
  }

  async function restartIntoMika() {
    if (state.busy || state.quitBusy || state.restartPending) return;
    state.busy = true;
    state.restartFailed = false;
    state.restartError = '';
    state.restartPending = true;
    render();
    try {
      await api.restart();
    } catch (error) {
      state.restartPending = false;
      state.restartFailed = true;
      state.restartError = error instanceof Error ? error.message : String(error || '重新启动失败');
    } finally {
      state.busy = false;
      render();
    }
  }

  async function confirmRecovery() {
    if (state.busy || state.recoveryCommitted || !state.selectedProfile || (!state.selectedMemory && !state.allowEmptyMemory)) return;
    state.busy = true;
    state.operationError = '';
    render();
    try {
      const result = await api.recover({
        profile: state.selectedProfile,
        memory: state.selectedMemory,
        allowEmptyMemory: state.allowEmptyMemory
      });
      if (!result || result.restarting !== true) throw new Error('恢复请求未进入重启流程');
      state.recoveryCommitted = true;
      render();
    } catch (error) {
      state.operationError = error instanceof Error ? error.message : String(error || '恢复失败');
    } finally {
      state.busy = false;
      render();
    }
  }

  async function quitApplication() {
    if (state.quitBusy) return;
    state.quitBusy = true;
    render();
    try {
      await api.quit();
    } catch (error) {
      state.quitBusy = false;
      showOperationError(error);
    }
  }

  function bindEvents() {
    byId('chooseProfileButton')?.addEventListener('click', () => chooseDirectory('profile'));
    byId('chooseMemoryButton')?.addEventListener('click', () => chooseDirectory('memory'));
    byId('reviewRecoveryButton')?.addEventListener('click', () => {
      if (!state.selectedProfile || (!state.selectedMemory && !state.allowEmptyMemory)) return;
      state.confirming = true;
      state.operationError = '';
      render();
    });
    byId('cancelConfirmationButton')?.addEventListener('click', () => {
      state.confirming = false;
      render();
    });
    byId('confirmRecoveryButton')?.addEventListener('click', confirmRecovery);
    byId('continueButton')?.addEventListener('click', restartIntoMika);
    byId('retryRestartButton')?.addEventListener('click', restartIntoMika);
    byId('allowEmptyMemory')?.addEventListener('change', (event) => {
      if (state.busy || state.recoveryCommitted) return;
      state.allowEmptyMemory = Boolean(event.target.checked);
      if (state.allowEmptyMemory) state.selectedMemory = null;
      state.confirming = false;
      state.operationError = '';
      render();
    });
    document.querySelectorAll('.quit-button').forEach((button) => {
      button.addEventListener('click', quitApplication);
    });
  }

  async function initialize() {
    bindEvents();
    if (!api || typeof api.status !== 'function') {
      setText('bootstrapFatalMessage', '启动恢复接口不可用。');
      setHidden('bootstrapFatalError', false);
      return;
    }
    try {
      if (typeof api.onState === 'function') {
        const unsubscribe = api.onState(acceptState);
        if (typeof unsubscribe === 'function') window.addEventListener?.('beforeunload', unsubscribe, { once: true });
      }
      const revisionAtRequest = state.revision;
      const snapshot = await api.status();
      if (state.revision === revisionAtRequest && isBootstrapState(snapshot)) {
        state.snapshot = snapshot;
        render();
      } else if (state.revision === revisionAtRequest) {
        state.snapshot = { mode: 'recovery', error: '启动状态返回格式无效', currentRoot: '', locatorFile: '' };
        render();
      }
    } catch (error) {
      state.snapshot = {
        mode: 'recovery',
        error: error instanceof Error ? error.message : String(error || '无法读取启动状态'),
        currentRoot: '',
        locatorFile: ''
      };
      render();
    }
  }

  initialize();
})();
