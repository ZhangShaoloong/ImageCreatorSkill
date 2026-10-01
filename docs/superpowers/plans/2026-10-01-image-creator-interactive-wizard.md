# image-creator 交互式参数向导 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 image-creator skill 支持"先口述画面、再逐步选参数"的交互向导,同时保留带 flag 的快速路径。

**Architecture:** 交互逻辑全部写进 `SKILL.md`(Claude 读的行为脚本),用 `AskUserQuestion` 逐问引导;`image-generator.js` 只加一处——`parseArgs` 的 `--model` 解析,让模型可选进 CLI(向导路径直接经 `options.model` 传入,不依赖 CLI flag)。

**Tech Stack:** Claude Code skill(SKILL.md + Node.js)。无新增运行时依赖。

## Global Constraints

- 不改 `image-generator.js` 的真实 API 调用、保存、文件名中文逻辑(已就绪)。
- 双模式判定写死:**指令里含任意 flag = 快速路径(不弹向导);无 flag = 交互向导**。
- 向导问题顺序:风格 → 比例/尺寸 → 手部/手指 → 多角度 → 模型 → 确认。
- 每问含"接受默认"与"直接生成/跳过"出口。
- 场景描述在第 0 步自由打字收集(若已给则直接进第 1 问)。
- 默认值:风格 photorealistic;比例 16:9(1920×1080);手部=显示;多角度=1;模型 agnes-image-2.1-flash。
- 本项目与 skill 目录均**非 git 仓库** → 计划的"commit"步骤改为"验证 + 记录",不跑 git。

## File Structure

| 文件 | 职责 | 改动 |
|---|---|---|
| `C:/Users/x1c/.claude/skills/image-creator/SKILL.md` | Claude 行为脚本 | 新增"交互向导"章节 + 双模式判定 + 参数映射表 |
| `C:/Users/x1c/.claude/skills/image-creator/image-generator.js` | 生成执行 | `parseArgs` 加 `--model` |
| `docs/superpowers/specs/2026-10-01-image-creator-interactive-wizard-design.md` | 规格 | 已定稿,不改 |
| `docs/superpowers/plans/2026-10-01-image-creator-interactive-wizard.md` | 本计划 | 新建 |

---

### Task 1: 给 parseArgs 增加 `--model` 解析

**Files:**
- Modify: `C:/Users/x1c/.claude/skills/image-creator/image-generator.js`(parseArgs,当前在 `--multi-angle` 分支之后、`!arg.startsWith('--')` 之前)

**Interfaces:**
- Consumes: 已有 `DEFAULTS.model`、`callApi` 里的 `options.model || DEFAULTS.model`。
- Produces: `parseArgs()` 返回的 `options` 现在可含 `model` 字段,快速路径 CLI 可传 `--model <id>`。

- [ ] **Step 1: 加解析分支**

在 `parseArgs` 的 `--multi-angle` 分支后、`else if (!arg.startsWith('--'))` 前,插入:

```js
    } else if (arg === '--model' && args[i + 1]) {
      options.model = args[++i];
```

- [ ] **Step 2: 用法帮助里补一行**

在 `main()` 打印的 Options 列表里(`--multi-angle N` 那行之后)加:

```js
    console.log('  --model ID       生成模型 (default: agnes-image-2.1-flash)');
```

- [ ] **Step 3: 验证**

Run:
```bash
node -e "const m=require('C:/Users/x1c/.claude/skills/image-creator/image-generator.js');process.argv=['','--setup'];" 2>&1 | head -1
node "C:/Users/x1c/.claude/skills/image-creator/image-generator.js" 2>&1 | grep -- '--model'
```
Expected: 第二条命令输出包含 `--model ID       生成模型 (default: agnes-image-2.1-flash)`。

- [ ] **Step 4: 记录(非 git)**

无 git。确认上一步 grep 命中即可,作为本任务完成凭证。

---

### Task 2: SKILL.md 双模式判定 + 参数映射表

**Files:**
- Modify: `C:/Users/x1c/.claude/skills/image-creator/SKILL.md`("Usage Patterns" 段落附近)

**Interfaces:**
- Consumes: 现有 "Basic Generation" / "Custom Parameters" / "Interactive Mode" 三段。
- Produces: 明确的模式判定规则 + flag 映射,Task 3 的向导章节引用它。

- [ ] **Step 1: 在 "Usage Patterns" 顶部插入判定规则**

```markdown
### 模式判定(两条路径)

- **快速路径**:指令里含**任意 flag**(`--style`、`--aspect`、`--width`、`--multi-angle`、`--model` 等)→ 不弹向导,未给的值用默认,直接生成。
- **交互向导**:只有场景描述、**无任何 flag**,或**空的 `/image`** → 走下方"交互向导"流程。

判定口诀:**有 flag = 快速;无 flag = 向导。**
```

- [ ] **Step 2: 加参数→flag 映射表**

```markdown
### 参数 → CLI flag 映射

| 向导项 | flag | 默认 |
|--------|------|------|
| 风格 | `--style` | photorealistic |
| 比例 | `--aspect` | 16:9 |
| 自定义尺寸 | `--width N --height N` | 1920×1080 |
| 手部 | `--no-hands` / `--fingers` | 显示 |
| 多角度 | `--multi-angle N` | 1 |
| 模型 | `--model <id>` | agnes-image-2.1-flash |
```

- [ ] **Step 3: 验证**

Run:
```bash
grep -c "判定口诀" "C:/Users/x1c/.claude/skills/image-creator/SKILL.md"
```
Expected: 输出 `1`(判定规则已插入,且唯一)。

---

### Task 3: SKILL.md 交互向导章节(第 0–6 问)

**Files:**
- Modify: `C:/Users/x1c/.claude/skills/image-creator/SKILL.md`(原 "Interactive Mode" 段落改写为完整向导)

**Interfaces:**
- Consumes: Task 2 的判定规则与 flag 映射;`image-generator.js` 的 `generateImage(prompt, options)`。
- Produces: 可执行的向导指令脚本,Claude 触发后据此逐问。

- [ ] **Step 1: 把 "Interactive Mode" 段落替换为完整向导**

原段落(只有 6 行 prompt 列表)替换为:

```markdown
### 交互向导(无 flag 时执行)

先收场景描述,再用 `AskUserQuestion` 逐问下列参数(每问含"接受默认";任一问允许"跳过,全用默认直接生成")。

**第 0 步 场景描述**(自由输入,非按钮)
- 用户已给描述 → 直接进第 1 问。
- 空 `/image` → 先问:"请描述你想生成的画面(例:一个现代风格的别墅,绿树环绕)"。

**第 1 问 风格** — 选项:photorealistic(默认) / cartoon-2d / cartoon-3d

**第 2 问 比例/尺寸** — 选项:16:9(默认) / 4:3 / 1:1 / 9:16 / 自定义 w×h
- 选"自定义"时追问 width、height(合法 256–8192)。

**第 3 问 手部/手指** — 选项:显示(默认) / 不显示 / 增强手指细节

**第 4 问 多角度** — 选项:单角度(默认) / 多角度 N 个
- 选"多角度"时追问 N(≥1)。

**第 5 问 模型** — 选项:agnes-image-2.1-flash(默认) / agnes-image-2.5-flash / 其他(手填模型 ID)

**第 6 问 确认** — 汇总全部参数,选项:直接生成 / 改一项 / 取消

收集完 → 按映射表拼 flags → 调 `generateImage(prompt, options)` → 返回保存路径。
```

- [ ] **Step 2: 验证章节完整**

Run:
```bash
grep -n "第 0 步\|第 6 问\|交互向导" "C:/Users/x1c/.claude/skills/image-creator/SKILL.md"
```
Expected: 同时命中 "交互向导"、"第 0 步"、"第 6 问"。

- [ ] **Step 3: 验证与 Task 1 的 model 一致性**

Run:
```bash
grep -n "model" "C:/Users/x1c/.claude/skills/image-creator/SKILL.md"
```
Expected: 映射表与向导第 5 问都提到 `--model` / 模型 ID,措辞一致。

---

### Task 4: 端到端验证(快速路径 + 向导路径)

**Files:**
- Verify only: 读 `SKILL.md`、`image-generator.js`,实跑一次快速路径。

**Interfaces:**
- Consumes: Task 1–3 的产物。

- [ ] **Step 1: 快速路径实跑(带 flag,不弹向导)**

Run:
```bash
node -e "const g=require('C:/Users/x1c/.claude/skills/image-creator/image-generator.js');g.generateImage('a modern villa, green trees, courtyard',{model:'agnes-image-2.1-flash'}).then(r=>console.log('SAVED:'+r.path));"
```
Expected: 打印 `SAVED:` + 一个 `.jpg` 路径;`ls output/` 新增该文件。

- [ ] **Step 2: 验收清单逐条对照规格**

对照规格"验收标准":
- [ ] 空 `/image` 走向导(逻辑在 SKILL.md,人工确认第 0 步触发描述输入)
- [ ] 无 flag 描述 → 向导(确认判定规则:无 flag=向导)
- [ ] 有 flag → 快速路径(Step 1 已证)
- [ ] 多角度 N → 生成 N 张(向导第 4 问,逻辑确认)
- [ ] 选模型 2.5 → 请求体 model=所选(Task 1 的 `--model` 已通)
- [ ] 确认页汇总一致(向导第 6 问,逻辑确认)
- [ ] 老 flag 用法仍工作(Step 1 已证)

- [ ] **Step 3: 记录**

无 git。确认 Step 1 生成文件存在、Step 2 全勾,作为整体验收凭证。

## Self-Review

- **Spec 覆盖**:双模式(Task 2)、向导 6 问(Task 3)、JS `--model`(Task 1)、端到端(Task 4)——全部对应规格章节。✓
- **占位符扫描**:所有代码/文案均为完整内容,无 TBD/TODO。✓
- **类型/命名一致性**:`options.model`、`--model`、`generateImage(prompt, options)`、`--multi-angle N` 在各任务间措辞统一。✓
- **一处主动调整**(已在 Global Constraints 声明):向导路径不经 CLI flag,直接经 `options.model` 传入,故 `--model` 主要服务快速路径与文档一致性,属最小必要改动,避免过度实现。
