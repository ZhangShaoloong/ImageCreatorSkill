# ImageCreatorSkill

基于 OpenAI 兼容图像 API(默认 `agnes-image-2.1-flash`)的两个 Claude Code skills,
支持**厂商无关**配置——不改代码即可切换到任何兼容后端。

| Skill | 用途 | 斜杠命令 | 端点 | 状态 |
|-------|------|----------|------|------|
| `t2i-creator` | 文生图(text → image) | `/t2i` | `POST /images/generations` | ✅ 可用 |
| `i2i-creator` | 图生图/图像编辑(reference → image) | `/i2i` | `POST /images/edits` | ⚠️ 当前后端无路由(404) |

## 目录结构

```
ImageCreatorSkill/
├── .claude-plugin/            # 市场 + 顶层 plugin 描述(用于 Claude Code 安装)
│   ├── marketplace.json
│   └── plugin.json
├── skills/
│   ├── t2i-creator/          # 文生图 skill(SKILL.md + image-generator.js)
│   │   ├── SKILL.md
│   │   ├── image-generator.js
│   │   ├── plugin.json
│   │   └── README.md
│   └── i2i-creator/         # 图生图 skill(SKILL.md + i2i-generator.js)
│       ├── SKILL.md
│       ├── i2i-generator.js
│       ├── plugin.json
│       └── README.md
├── .env.example              # 配置模板(复制为 .env 使用)
└── .gitignore
```

每个 skill 目录自包含(`SKILL.md` + 生成器脚本 + 各自的 `plugin.json`),
**无 npm 依赖**,仅用 Node 内置模块(`fs`/`path`/`os`/`readline` + 原生 `fetch`)。

## 前提

- **Node.js 18+**(需要原生 `fetch` / `FormData` / `Blob`)
- 一个有效的图像 API key(默认走 agnes;见下方配置)
- 可访问目标图像 API 的网络

## 配置

两个 skill 的运行时配置遵循同一优先级(高 → 低):

```
CLI flag  >  环境变量  >  ~/.claude/settings.local.json  >  内置 agnes 默认
```

### 方式 A:交互式 setup(一次性,存到 settings.local.json)

```bash
node skills/t2i-creator/image-generator.js --setup
# 或
node skills/i2i-creator/i2i-generator.js --setup
```

### 方式 B:环境变量 / .env 文件(厂商无关,不改代码切后端)

复制 `.env.example` 为 `.env`,填好值后显式加载:

```bash
node skills/t2i-creator/image-generator.js "一只橘猫在草地上" --env .env
```

直接设系统环境变量也可(无需 `--env`):

```bash
IMAGE_API_BASE=https://your.backend/v1 IMAGE_MODEL=your-model IMAGE_API_KEY=sk_xxx \
  node skills/t2i-creator/image-generator.js "a cat"
```

| 项 | CLI flag | 环境变量 | 内置默认 |
|----|----------|----------|----------|
| 模型 | `--model` | `IMAGE_MODEL` | `agnes-image-2.1-flash` |
| API 基址 | `--base` | `IMAGE_API_BASE`(兜底 `AGNES_API_BASE`) | `https://api.agnes-ai.cn/v1` |
| 密钥 | `--key` | `IMAGE_API_KEY`(兜底 `AGNES_API_KEY`) | `settings.local.json` |
| .env 文件 | `--env` | — | 无 |

> 密钥、真实 `.env`、`.claude/settings.local.json` 均已通过 `.gitignore` 排除,不会进版本库。

## 使用

### 文生图(t2i-creator)

```bash
# 基础(默认 1920×1080 / 16:9 / 写实)
node skills/t2i-creator/image-generator.js "一位女科学家在实验室"

# 自定义参数
node skills/t2i-creator/image-generator.js "一个未来城市" \
  --width 1024 --height 1024 --style cartoon-3d --no-hands --multi-angle 4

# 输出到指定目录
node skills/t2i-creator/image-generator.js "抽象艺术装置" --output ./t2is
```

主要参数:`--width/--height`、`--aspect`(16:9 / 4:3 / 1:1 / 9:16)、
`--style`(photorealistic / cartoon-2d / cartoon-3d)、`--no-hands`、`--fingers`、
`--multi-angle N`、`--output DIR`。详见 `skills/t2i-creator/README.md`。

### 图生图(i2i-creator)

```bash
# 参考图(本地文件或 URL)+ 编辑描述
node skills/i2i-creator/i2i-generator.js --input "C:\Users\x1c\Pictures\ref.jpg" \
  "把它变成水彩画风格" --strength 0.8
```

主要参数:`--input <file|url>`(必填)、`--strength 0–1`(默认 0.7)、
`--style`、`--aspect`(默认 1:1)、`--variations N`、`--output DIR`。
详见 `skills/i2i-creator/README.md`。

> 在 Claude Code 内,也可用斜杠命令 `/t2i`、`/i2i`(注册为 skills 后),
> 交互向导会自动引导参数设置。

## 生成器自检

每个生成器内置 `--test`,可离线验证参数解析、配置优先级与默认值:

```bash
node skills/t2i-creator/image-generator.js --test
node skills/i2i-creator/i2i-generator.js --test
```

## 关于 i2i 的后端现状(重要)

`i2i-creator` 的请求契约(multipart `POST /images/edits`)是标准、正确的,
面向"支持图生图的后端"。但**当前 `api.agnes-ai.cn` 未提供可用的图生图路由**(实测 404),
因此在切到支持 `/images/edits` 的后端之前,i2i 无法真正产出改造后的图片。
纯文生图需求请使用 `t2i-creator`(`/images/generations` 已验证可用)。

## 本地保留说明

本仓库定位为**本地开发/使用**,不推送到 GitHub。因此:

- `.claude/settings.local.json`、`.env`、`output/` 等敏感/产物文件已 gitignore,本地保留。
- 若日后需要发布到 GitHub,建议额外排除 `.claude/` 会话级配置,并补一份对外 README。
