'use strict';

/* 长期记忆请求的参数构造。
 *
 * 单独一个模块，因为这是最容易出错、又最难在界面上发现的一段：
 *   - 渲染层用驼峰命名，运行时用下划线；
 *   - 更新时只允许发用户真正改过的字段（发一个空标题会把标题清掉）；
 *   - 两个开关必须能分别打开/关闭，"false" 和"没给"是两件不同的事，
 *     不能用 `||` 或默认值吞掉。
 *
 * 纯函数、没有 Electron 依赖，所以可以直接单测。
 */

const MEMORY_SCOPES = ['global', 'project', 'task'];
const MEMORY_TYPES = [
  'core_preference', 'working_style', 'project_summary', 'architecture',
  'decision', 'open_loop', 'pitfall', 'task_summary', 'note'
];
const AUTO_MEMORY_MODES = ['off', 'suggest', 'auto'];

const text = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const pick = (payload, ...names) => {
  for (const name of names) {
    if (payload?.[name] !== undefined && payload?.[name] !== null) return payload[name];
  }
  return undefined;
};

const oneOf = (value, allowed, fallback) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
};

function memoryListArgs(options = {}) {
  return {
    action: 'list',
    scope: oneOf(options.scope, [...MEMORY_SCOPES, ''], ''),
    limit: Number(options.limit || 50),
    archived: options.archived === true,
    /* 桌面要看完整记录；模型那侧由运行时的 compact 投影限制。 */
    detail: 'full'
  };
}

function memorySearchArgs(options = {}) {
  return {
    action: 'search',
    query: text(options.query),
    limit: Number(options.limit || 50),
    detail: 'full'
  };
}

function memoryCreateArgs(payload = {}) {
  return {
    action: 'create',
    scope: oneOf(payload.scope, MEMORY_SCOPES, 'project'),
    memory_type: oneOf(pick(payload, 'memoryType', 'memory_type'), MEMORY_TYPES, 'note'),
    title: text(payload.title),
    content: String(payload.content ?? ''),
    pinned: payload.pinned === true
  };
}

function memoryUpdateArgs(payload = {}) {
  const args = {
    action: 'update',
    memory_id: text(pick(payload, 'memoryId', 'memory_id'))
  };
  const title = pick(payload, 'title');
  if (title !== undefined) args.title = String(title);
  const content = pick(payload, 'content');
  if (content !== undefined) args.content = String(content);
  const memoryType = pick(payload, 'memoryType', 'memory_type');
  if (memoryType !== undefined) args.memory_type = oneOf(memoryType, MEMORY_TYPES, 'note');
  if (payload.pinned !== undefined) args.pinned = payload.pinned === true;
  return args;
}

function memorySetConfigArgs(payload = {}) {
  const args = { action: 'set_config' };
  if (payload.enabled !== undefined) args.enabled = payload.enabled === true;
  const mode = pick(payload, 'autoMemory', 'auto_memory');
  if (mode !== undefined) args.auto_memory = oneOf(mode, AUTO_MEMORY_MODES, 'suggest');
  const personal = pick(payload, 'allowSensitivePersonal', 'allow_sensitive_personal');
  if (personal !== undefined) args.allow_sensitive_personal = personal === true;
  return args;
}

function memoryConfirmArgs(payload = {}) {
  return {
    action: 'confirm',
    candidate_id: text(pick(payload, 'candidateId', 'candidate_id')),
    reason: text(payload.reason)
  };
}

function memoryRejectArgs(candidateId) {
  return { action: 'reject', candidate_id: text(candidateId) };
}

function memoryIdArgs(action, memoryId) {
  return { action, memory_id: text(memoryId) };
}

function memoryRestoreRevisionArgs(payload = {}) {
  return {
    action: 'restore_revision',
    memory_id: text(pick(payload, 'memoryId', 'memory_id')),
    revision: Math.max(1, Number(payload.revision || 1))
  };
}

function memoryExportArgs(target) {
  return { action: 'export', path: text(target) };
}

function memoryImportArgs(source) {
  return { action: 'import', path: text(source) };
}

module.exports = {
  MEMORY_SCOPES,
  MEMORY_TYPES,
  AUTO_MEMORY_MODES,
  memoryListArgs,
  memorySearchArgs,
  memoryCreateArgs,
  memoryUpdateArgs,
  memorySetConfigArgs,
  memoryConfirmArgs,
  memoryRejectArgs,
  memoryIdArgs,
  memoryRestoreRevisionArgs,
  memoryExportArgs,
  memoryImportArgs
};