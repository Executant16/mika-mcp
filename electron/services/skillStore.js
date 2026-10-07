const crypto = require('node:crypto');
const path = require('node:path');
const { skillsFile } = require('../paths');
const { readJson, writeJsonAtomic } = require('./jsonStore');

const DEFAULT_SKILLS = [
  {
    id: 'skill_code_review',
    name: '代码审查专家',
    description: '逐行深度审查代码潜在 BUG、并发竞态、边界安全漏洞与可维护性',
    category: '研发工具',
    icon: 'code',
    enabled: true,
    prompt: '请作为资深架构师和代码审查专家，仔细审查以下代码变更。重点关注：\n1. 边界异常与空指针/空状态处理；\n2. 异步竞态、资源泄露与并发安全；\n3. 运行性能瓶颈与大复杂度计算；\n4. 架构规范与可维护性。\n请逐条列出发现的具体问题，并给出规范的修改建议和参考代码：\n\n',
    custom: false,
    updatedAt: '2026-09-26T19:40:00.000Z'
  },
  {
    id: 'skill_unit_test',
    name: '单元测试生成器',
    description: '针对当前模块与函数，自动推导全分支、全边界的完整自动化测试用例',
    category: '测试工程',
    icon: 'test',
    enabled: true,
    prompt: '请为以下代码编写高质量、生产级的自动化单元测试用例。要求：\n1. 覆盖正常流程与所有边界异常情况（包括非法入参、超时与报错）；\n2. 测试用例独立，避免状态耦合；\n3. 包含断言与详细说明：\n\n',
    custom: false,
    updatedAt: '2026-09-26T19:40:00.000Z'
  },
  {
    id: 'skill_refactor',
    name: '代码重构优化器',
    description: '消除坏味道代码，精炼函数圈复杂度，提升接口整洁度与阅读体验',
    category: '架构重构',
    icon: 'clean',
    enabled: true,
    prompt: '请在严格保证现有业务逻辑与对外接口契约 100% 不变的前提下，对以下代码进行深度重构优化：\n1. 简化嵌套过深的逻辑分支，提升自解释性；\n2. 提炼通用逻辑，消除冗余重复；\n3. 改进变量与函数命名；\n4. 提供重构前后的对比和设计考量说明：\n\n',
    custom: false,
    updatedAt: '2026-09-26T19:40:00.000Z'
  },
  {
    id: 'skill_arch_designer',
    name: '系统因果架构师',
    description: '依据业务需求推导不可变因果链条，设计模块拓扑、数据流与契约规范',
    category: '系统架构',
    icon: 'arch',
    enabled: true,
    prompt: '请基于严谨的因果律与系统科学原则，为以下技术需求设计高内聚、低耦合的技术方案。包含：\n1. 核心因果链条与状态机推导；\n2. 模块边界与接口协议定义；\n3. 异常降级与故障恢复机制：\n\n',
    custom: false,
    updatedAt: '2026-09-26T19:40:00.000Z'
  }
];

class SkillStore {
  constructor() {
    this._cached = null;
  }

  load(forceReload = false) {
    if (!this._cached || forceReload) {
      const saved = readJson(skillsFile(), null);
      if (Array.isArray(saved) && saved.length > 0) {
        // 合并内置技能与用户自定义技能
        const map = new Map();
        DEFAULT_SKILLS.forEach((item) => map.set(item.id, { ...item }));
        saved.forEach((item) => {
          if (item && item.id) {
            map.set(item.id, { ...item });
          }
        });
        this._cached = Array.from(map.values());
      } else {
        this._cached = DEFAULT_SKILLS.map((item) => ({ ...item }));
        try { writeJsonAtomic(skillsFile(), this._cached); } catch (_) {}
      }
    }
    return this._cached;
  }

  saveAll(list) {
    this._cached = Array.isArray(list) ? list : [];
    writeJsonAtomic(skillsFile(), this._cached);
    return this._cached;
  }

  list() {
    return this.load();
  }

  get(id) {
    return this.list().find((item) => item.id === id) || null;
  }

  saveSkill(skill) {
    const list = [...this.list()];
    const now = new Date().toISOString();
    let target = { ...skill };

    if (!target.id) {
      target.id = `skill_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      target.custom = true;
    }

    target.name = String(target.name || '未命名技能').trim();
    target.description = String(target.description || '').trim();
    target.category = String(target.category || '自定义技能').trim();
    target.prompt = String(target.prompt || '').trim();
    target.enabled = target.enabled !== false;
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

  deleteSkill(id) {
    const list = this.list().filter((item) => item.id !== id);
    this.saveAll(list);
    return true;
  }

  toggleSkill(id, enabled) {
    const list = this.list();
    const item = list.find((it) => it.id === id);
    if (!item) return false;
    item.enabled = Boolean(enabled);
    item.updatedAt = new Date().toISOString();
    this.saveAll(list);
    return item;
  }

  importFromFile(content, filename = '') {
    const text = String(content || '').trim();
    if (!text) throw new Error('上传的技能文件内容为空。');

    // 尝试以 JSON 解析
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => this.saveSkill(item));
        return { count: parsed.length, message: `成功导入 ${parsed.length} 个技能` };
      } else if (typeof parsed === 'object' && parsed.name && parsed.prompt) {
        const saved = this.saveSkill(parsed);
        return { count: 1, skill: saved, message: `成功导入技能「${saved.name}」` };
      }
    } catch (_) {}

    // 尝试以 Markdown / SKILL.md 解析
    const nameMatch = text.match(/^#+\s*(.+)$/m) || text.match(/name:\s*(.+)$/m);
    const descMatch = text.match(/description:\s*(.+)$/m) || text.match(/>\s*(.+)$/m);
    const name = nameMatch ? nameMatch[1].replace(/[`*]/g, '').trim() : path.basename(filename, path.extname(filename)) || '导入技能';
    const description = descMatch ? descMatch[1].replace(/[`*]/g, '').trim() : '用户上传自定义技能';

    const skill = this.saveSkill({
      name,
      description,
      category: '上传技能',
      prompt: text,
      custom: true
    });
    return { count: 1, skill, message: `成功导入技能「${skill.name}」` };
  }
}

module.exports = { SkillStore, DEFAULT_SKILLS };
