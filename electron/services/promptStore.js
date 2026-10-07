const crypto = require('node:crypto');
const { promptsFile } = require('../paths');
const { readJson, writeJsonAtomic } = require('./jsonStore');

const DEFAULT_PROMPTS = [
  {
    id: 'prompt_explain_code',
    title: '通俗解释核心逻辑',
    category: '代码阅读',
    description: '用简洁易懂的人话梳理核心逻辑、数据走向与关键因果链',
    content: '请用通俗易懂且逻辑清晰的语言解释以下代码：\n1. 这段代码的主要职责与解决的问题是什么；\n2. 核心执行流程与关键数据流向；\n3. 有哪些值得注意的设计细节或边界假设：\n\n',
    custom: false,
    updatedAt: '2026-09-26T19:40:00.000Z'
  },
  {
    id: 'prompt_find_bug',
    title: '排查定位运行报错',
    category: '调试排错',
    description: '结合代码上下文与错误日志，分析报错根因并给出精准修复补丁',
    content: '我遇到了一处运行报错，请帮我分析原因并提供修复方案：\n【报错信息/现象】：\n\n【相关代码】：\n\n请指出具体出错原因、触发条件，并提供修复后的代码片段。',
    custom: false,
    updatedAt: '2026-09-26T19:40:00.000Z'
  },
  {
    id: 'prompt_perf_opt',
    title: '性能瓶颈诊断优化',
    category: '性能调优',
    description: '检查大复杂度运算、不必要渲染或重复 IO，提供优化建议',
    content: '请分析以下代码的性能表现，找出潜在的性能瓶颈（如过度计算、不必要的循环、资源占用或内存泄漏），并提供针对性的优化方案及对比基准：\n\n',
    custom: false,
    updatedAt: '2026-09-26T19:40:00.000Z'
  },
  {
    id: 'prompt_write_doc',
    title: '生成技术文档与注释',
    category: '工程文档',
    description: '依据代码实现生成规范的 Markdown 接口文档或行内高质量注释',
    content: '请为以下代码生成规范、专业的 Markdown 技术文档：\n1. 模块/方法说明与核心参数说明（包含类型、默认值与含义）；\n2. 返回值结构说明；\n3. 典型使用示例（Usage Example）；\n4. 注意事项与异常抛出说明：\n\n',
    custom: false,
    updatedAt: '2026-09-26T19:40:00.000Z'
  },
  {
    id: 'prompt_git_commit',
    title: '生成规范 Commit 提交',
    category: '版本管理',
    description: '按 Conventional Commits 规范将代码变更提炼为清晰优雅的提交信息',
    content: '请根据以下代码变更内容（Diff/说明），生成符合 Conventional Commits 规范的 Git 提交信息（如 feat/fix/refactor/docs 等）。包含简短明了的 Header（首行不超过50字）以及要点清单（Body）：\n\n',
    custom: false,
    updatedAt: '2026-09-26T19:40:00.000Z'
  },
  {
    id: 'prompt_clean_naming',
    title: '重命名与规范化',
    category: '代码整洁',
    description: '针对模糊不清的变量、函数、类名提供符合行业惯例的地道命名建议',
    content: '请为以下代码中的变量、函数或类名提供更清晰、地道且符合领域规范的命名建议，并简述理由：\n\n',
    custom: false,
    updatedAt: '2026-09-26T19:40:00.000Z'
  }
];

class PromptStore {
  constructor() {
    this._cached = null;
  }

  load(forceReload = false) {
    if (!this._cached || forceReload) {
      const saved = readJson(promptsFile(), null);
      if (Array.isArray(saved) && saved.length > 0) {
        const map = new Map();
        DEFAULT_PROMPTS.forEach((item) => map.set(item.id, { ...item }));
        saved.forEach((item) => {
          if (item && item.id) {
            map.set(item.id, { ...item });
          }
        });
        this._cached = Array.from(map.values());
      } else {
        this._cached = DEFAULT_PROMPTS.map((item) => ({ ...item }));
        try { writeJsonAtomic(promptsFile(), this._cached); } catch (_) {}
      }
    }
    return this._cached;
  }

  saveAll(list) {
    this._cached = Array.isArray(list) ? list : [];
    writeJsonAtomic(promptsFile(), this._cached);
    return this._cached;
  }

  list() {
    return this.load();
  }

  get(id) {
    return this.list().find((item) => item.id === id) || null;
  }

  savePrompt(prompt) {
    const list = [...this.list()];
    const now = new Date().toISOString();
    let target = { ...prompt };

    if (!target.id) {
      target.id = `prompt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      target.custom = true;
    }

    target.title = String(target.title || '未命名提示词').trim();
    target.category = String(target.category || '自定义').trim();
    target.description = String(target.description || '').trim();
    target.content = String(target.content || '').trim();
    target.updatedAt = now;

    const index = list.findIndex((item) => item.id === target.id);
    if (index >= 0) {
      list[index] = { ...list[index], ...target };
    } else {
      list.push(target);
    }
    this.saveAll(list);
    return target;
  }

  deletePrompt(id) {
    const list = this.list().filter((item) => item.id !== id);
    this.saveAll(list);
    return true;
  }
}

module.exports = { PromptStore, DEFAULT_PROMPTS };
