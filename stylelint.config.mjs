/**
 * stylelint.config.mjs —— 渲染层样式护栏
 * ---------------------------------------------------------------------------
 * 设计原则：**只做护栏，不做风格整改。**
 *
 * 刻意不 extends "stylelint-config-standard"：实测它会引入 alpha-value-notation、
 * color-function-notation、at-rule-empty-line-before 等数千条纯风格提示，
 * 让"违规数"变成一个永远到不了 0 的数字，护栏也就失去了作为 CI 门禁的意义。
 *
 * 本配置只保留 5 类"会真实导致样式失控"的规则，
 * 目标是整改完成后违规数可归零，从而能作为合并门禁长期生效。
 *
 * 安装：
 *   npm i -D stylelint
 *
 * 运行：
 *   npx stylelint "renderer/**\/*.css"
 *
 * 自动修复（仅格式类，本配置无）：
 *   npx stylelint "renderer/**\/*.css" --fix
 */

export default {
  rules: {
    /* ---- 1. 禁止硬编码颜色：所有颜色必须来自 design-tokens.css ---------- */
    'color-no-hex': true,
    'color-named': 'never',
    'function-disallowed-list': ['rgb', 'rgba', 'hsl', 'hsla'],

    /* ---- 2. 禁止 !important ---------------------------------------------
     * 现状：160 个（settings-compact.css 143 行里占 133 个）。
     * 目标：0。需要覆盖时请改令牌或调整选择器权重，不要靠 !important 硬压。 */
    'declaration-no-important': true,

    /* ---- 3. 收敛尺度：字号 / 圆角 / 字重只能取令牌定义过的值 ------------- */
    'declaration-property-value-allowed-list': {
      /* 字号白名单与 design-tokens.css 的令牌层**必须逐项对应**。
       * 第 40 轮把 styles.css 的 222 处 `font-size:<n>px` 字面量收敛回令牌时，
       * 有 9 个原值在主尺度（xs/sm/base/md/lg/xl）里没有相等档位，只能在
       * 令牌层按原值新增（约束是"渲染结果一个都不能变"，不许就近取整）。
       * 令牌加了而白名单不加，收敛后的合规写法会当场变成新违规 ——
       * 那就又制造了一组"令牌层与白名单两处真相"，与本次要修的病同源。
       * 故同一轮里两侧一起改，下面的枚举与 design-tokens.css 的 --fs-* 一一对应。
       *
       * 例外说明：`--fs-pre`(10px) 有意**不**在此列表内。它是预格式化输出
       * 专用档，只允许经 `font:` 简写消费（见本文件 3b 节与 DESIGN.md 第三章）；
       * 不接受 `font-size:var(--fs-pre)` 是有意的边界，不是遗漏。 */
      'font-size': [
        '/^var\\(--fs-(xs|sm|base|md|lg|xl|11|11-5|12-5|13-5|14-5|15|15-5|16-5|17|17-5|18|19|21|22|23)\\)$/',
        'inherit', '0',
      ],
      'border-radius': [
        /* 接受单值**或复合值**。合法原子：令牌引用 / 0 / 50%（正圆）/ inherit。
         * 复合值（如 var(--radius-md) 0 0 var(--radius-md)）用于"输入框 + 按钮
         * 拼接成胶囊"这类场景，是正当用法 —— 早先只接受单值，属配置过窄，
         * 使 3 处合规写法被误计为违规。
         * 50% 表达"形状"（正圆）而非"大小"，没有也不能有对应令牌。
         * `xl` 已于第 40 轮从令牌层移除（var(--radius-xl) 全仓库 0 消费）；
         * 第 41 轮随"圆角字面量全部令牌化"恢复 —— 那 5 处 12px 需要一个名字，
         * 它因此重新有了唯一且明确的消费者。数值档 5/7/9/10/13/14/15/22 同批加入。
         * 白名单必须与令牌层同步，否则迁移后的合规写法会被护栏判违规，
         * 而护栏是配置层，它报的错会被当成代码问题去改，正好把令牌化改回去。 */
        '/^(var\\(--radius-(sm|md|lg|xl|pill|2|5|7|9|10|11|13|14|15|16|22|24)\\)|0|50%|inherit)(\\s+(var\\(--radius-(sm|md|lg|xl|pill|2|5|7|9|10|11|13|14|15|16|22|24)\\)|0|50%|inherit)){0,3}$/',
      ],
      /* 中文在 600+ 字重下会显得又粗又笨，且掩盖由字号建立的层级。
       * 历史：曾有 31 处 650–900 的超重字重，而 500 只有 2 处。 */
      'font-weight': ['400', '500', 'normal', 'inherit'],
    },

    /* ---- 3b. 补上 font 简写的字号盲区 -----------------------------------
     * 第 27 轮新增。上面 declaration-property-value-allowed-list 里的
     * 'font-size' 只检查 **font-size 属性本身**，而 `font: 10px/1.6 ...` 是
     * **简写**，字号藏在复合值中间 —— 它完全绕过那条白名单。
     *
     * 这不是推测，是实测的：往临时文件里写
     *     .a{font:8px/1.5 sans-serif}      ← 不报
     *     .b{font-size:8px}                ← 报错
     *     .c{font:700 8px/1.5 sans-serif}  ← 不报
     * 结果只有 .b 被拦下。也就是说本项目曾长期存在 5 处 10px 与 1 处 9px
     * 在护栏之外裸奔（styles.css 的 .log-output / .build-console /
     * .task-command / .instruction-details pre / .task-worktree-diff pre）。
     *
     * 修法：用 disallowed-list 的正则**拦字面量 px、放行令牌引用**。
     *   · "拦"的是 `font:` 值里以 px 结尾的字号原子，含 `700 8px/...` 这类
     *     前面带字重的形态 —— 故正则允许 `(?:[a-z]+\s+)*` 前缀（可含
     *     italic / bold / 700 等）。注意 `700` 是数字，不属于 `[a-z]+`，
     *     所以正则整体写成"跳过若干字母词与数字词之后遇到 px"更稳，
     *     这里用 `(?:[a-z0-9]+\s+)*`。
     *   · "放行" var(--fs-pre)/1.6 —— 它以 `var(` 开头，正则要求 px 结尾，
     *     天然不匹配。
     *
     * 为什么不干脆把 'font' 也塞进 allowed-list？
     *   allowed-list 是**全值精确匹配**，而 font 简写的合法组合无穷
     *   （字号 / 行高 / 字族顺序与可选字重斜体），枚举不出白名单，
     *   写了只会把大量正当写法误判为违规。disallowed-list 只否定
     *   "一种明确有害的写法"，这才是简写该用的武器。
     *
     * 例外归属：目前 5 处均常量使用 var(--fs-pre)（10px，预格式化输出专用），
     * 令牌本身在 design-tokens.css 声明并附论证，因此本文件**不需要**
     * 任何 disable 注释 —— 例外被"抬"到令牌层集中管理，而不是散落在 5 个
     * 使用点。 */
    'declaration-property-value-disallowed-list': {
      'font': ['/^\\s*(?:[a-z0-9]+\\s+)*\\d+(?:\\.\\d+)?px/'],
    },

    /* ---- 4. 控制选择器复杂度，阻止"靠堆权重解决问题" -------------------- */
    'selector-max-specificity': '0,3,0',
    'selector-max-compound-selectors': 4,

    /* ---- 5. 卫生规则 ------------------------------------------------------ */
    'no-duplicate-selectors': true,
    'shorthand-property-no-redundant-values': true,
    'declaration-block-no-redundant-longhand-properties': true,
    'length-zero-no-unit': true,

    /* ---- 命名规范 ---------------------------------------------------------
     * 例外：in_progress 直接来自 Python 后端的 status 枚举值，
     * 改名需要前后端协同，故显式放行，避免护栏产生无法处理的噪音。 */
    'selector-class-pattern': [
      '^([a-z][a-z0-9]*(-[a-z0-9]+)*|in_progress)$',
      { message: '类名请使用 kebab-case（如 task-result）；in_progress 为后端枚举值，已放行' },
    ],
    'custom-property-pattern': '^[a-z][a-z0-9]*(-[a-z0-9]+)*$',
  },

  overrides: [
    {
      /* 令牌文件是唯一允许出现字面量的地方 */
      files: ['renderer/design-tokens.css'],
      rules: {
        'color-no-hex': null,
        'color-named': null,
        'function-disallowed-list': null,
        'declaration-property-value-allowed-list': null,
        'custom-property-pattern': null,
      },
    },
  ],
};
