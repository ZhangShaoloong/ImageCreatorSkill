# Image-to-Image Creator Skill 使用指南

## 快速开始

### 1. 首次配置（只需一次）

运行配置命令设置 API key：

```bash
node "E:\AI\Make Skill\ImageCreatorSkill\skills\i2i-creator\i2i-generator.js" --setup
```

输入你的 API key（也可用 `--key` 直接传入），系统将自动保存到 `.claude/settings.local.json`

### 2. 图生图

图生图 = 提供一张参考图片（本地文件或 URL）+ 一句"想怎么改"，模型据此生成改造后的图片。

#### 基础用法（使用默认参数）
```
/i2i C:\Users\x1c\Pictures\ref.jpg 把它变成水彩画风格
```

#### 带 URL 输入
```
/i2i https://example.com/product.png 改成霓虹赛博朋克夜景 --strength 0.8
```

#### 自定义参数
```
/i2i ref.jpg 重绘成 3D 卡通 --style cartoon-3d --aspect 16:9 --variations 4
```

## 参数说明

### 输入图片 (--input / 第一个位置参数)
- 必填：本地文件路径或 URL
- 支持格式: `.png`、`.jpg`、`.jpeg`、`.webp`

### 编辑强度 (--strength)
- 范围: 0–1，默认 0.7
- 0 ≈ 几乎原图；1 ≈ 大幅改造

### 分辨率 (--width, --height)
- 默认: 1024×1024
- 范围: 256–8192 像素

### 比例 (--aspect)
可选值:
- `1:1` (默认，方形，改造最安全)
- `16:9` (宽屏)
- `4:3` (标准)
- `9:16` (竖屏)

### 风格 (--style)
可选值:
- `photorealistic` (默认，写实风格)
- `cartoon-2d` (2D卡通风格)
- `cartoon-3d` (3D卡通风格)

### 多变体生成
- `--variations N`: 对同一张输入图生成 N 个不同编辑结果（N ≥ 1，默认单张）

### 输出目录 (--output)
- 默认: `./output`（项目根目录下）
- 示例: `--output ./images`

## 工作流程

### 交互式模式
直接运行 `/i2i`，系统会引导你提供输入图片、编辑描述及所有参数

### 非交互式模式
在提示中直接提供输入图片和所有参数:
```
/i2i <图片> <编辑描述> --参数1 --参数2 ...
```

## 厂商无关配置

本 skill 不再硬绑定某一厂商：模型、API 基址、密钥都在运行时按下面的优先级解析，
**不改任何代码即可切换到其它 OpenAI 兼容后端**；不配置时默认仍走 agnes。

### 优先级（高 → 低）
```
CLI flag  >  环境变量  >  ~/.claude/settings.local.json  >  内置 agnes 默认
```

### 相关 flag / 环境变量

| 项 | CLI flag | 环境变量（通用） | 兜底 | 内置默认 |
|----|----------|------------------|------|----------|
| 模型 | `--model <id>` | `IMAGE_MODEL` | — | `agnes-image-2.1-flash` |
| API 基址 | `--base <url>` | `IMAGE_API_BASE` | `AGNES_API_BASE` | `https://api.agnes-ai.cn/v1` |
| 密钥 | `--key <val>` | `IMAGE_API_KEY` | `AGNES_API_KEY` | `settings.local.json` |
| .env 文件 | `--env <file>` | — | — | 无 |

### 换到别的厂商（示例）
不改代码，任选其一：
```bash
# 方式 A：环境变量
IMAGE_API_BASE=https://your.backend/v1 IMAGE_MODEL=your-model IMAGE_API_KEY=sk_xxx \
  node i2i-generator.js --input ref.jpg "改成水彩画风格"

# 方式 B：CLI
node i2i-generator.js --input ref.jpg "改成水彩画风格" \
  --base https://your.backend/v1 --model your-model --key sk_xxx
```

### 使用 .env 文件
复制仓库根的 `.env.example` 为 `.env` 填好值，再用 `--env .env` 显式加载
（`--env` 不会覆盖已存在的环境变量）：
```bash
node i2i-generator.js --input ref.jpg "改成水彩画风格" --env .env
```

## 保存位置

生成的图片保存在项目根目录的 `./output/` 文件夹中，文件名为：
```
{时间戳}_{编辑描述关键词}[_var_N].jpg
```

例如:
```
output/2026-10-04T09-00-00_改成水彩画风格.jpg
output/2026-10-04T09-05-00_改成水彩画风格_var_1.jpg
```

## 常见问题

### Q: 提示找不到 API key？
A: 运行 `--setup` 交互输入，或设 `IMAGE_API_KEY`（或 `AGNES_API_KEY`）环境变量，或用 `--key`/`--env` 提供

### Q: 想换成其它厂商/后端？
A: 无需改代码。设 `IMAGE_API_BASE` + `IMAGE_MODEL`（或 `--base`/`--model`）指向你的 OpenAI 兼容后端；密钥用 `IMAGE_API_KEY`。详见上方「厂商无关配置」

### Q: 想要"保留原图、只微调"？
A: 降低 `--strength`（≤0.4）

### Q: 输入图片格式不支持？
A: 目前支持 `.png / .jpg / .jpeg / .webp`，请转换后重试

### Q: 和 image-creator 有什么区别？
A: `image-creator` 是纯文生图；`i2i-creator` 需要一张参考图，做图生图/图像编辑

## 技术细节

### API 端点（已实测 2026-10-04）
- 本 skill 采用 OpenAI 兼容的图生图契约：`POST /v1/images/edits`（`https://api.agnes-ai.cn/v1/images/edits`），
  输入图片以 **multipart 文件上传**（字段 `image`）传入，同时 `model`、`prompt`、`size`、`strength`、`n`、`response_format` 作为表单字段。
  这是 OpenAI `images/edits` 的标准契约，`i2i-generator.js` 的 `callApi()` 已按此实现。

- ⚠️ **当前 agnes 部署现状**：`api.agnes-ai.cn` 目前**没有可用的图生图路由**。实测：
  - `POST /v1/images/edits`（multipart 文件上传）→ **404**（该路由不存在）
  - `POST /v1/images/edits`（JSON，image 传字符串）→ 报错要求 image 必须是 multipart 文件
  - `POST /v1/images/variations` → 404 / "未指定模型名称"
  - `POST /v1/images/generations` 带 `image_url` → 报错 "image_url 不是文生图队列支持的字段"
  - `POST /v1/images/generations`（纯文生图，JSON）→ ✅ 正常（见姊妹 skill `image-creator`）

  结论：本 skill 的请求契约是正确的、面向"支持图生图的后端"；但在当前 `api.agnes-ai.cn` 部署上无法真正产出改造后的图片。
  一旦该后端上线 `images/edits`（multipart）路由，本 skill 无需改动即可工作。

- 纯文生图需求请使用 `image-creator`（`/images/generations` 已验证可用，模型 `agnes-image-2.1-flash` 有效）。

### 依赖
- Node.js 18+
- 有效的 API key（`IMAGE_API_KEY` / `AGNES_API_KEY`，或 `settings.local.json`）
- 可访问的目标 API（默认 agnes；注意 agnes 当前无图生图路由，见上方实测说明）

### 扩展开发
如需调整真实请求体，编辑 `i2i-generator.js` 中的 `callApi()` 函数；
输入图片获取逻辑见 `loadInputImage()` 与 `classifyInput()`。

## 更新日志

### v1.1.0 (2026-10-04)
- 厂商无关化：`--base`/`--model`/`--key`/`--env` 新增 flag，支持环境变量
  （`IMAGE_API_BASE`/`IMAGE_MODEL`/`IMAGE_API_KEY`，兜底 `AGNES_API_*`），
  优先级 CLI > env > settings > 内置 agnes 默认
- `--setup` 改为交互式读取真实 key（不再写 mock key），支持 `--key` 跳过交互
- 新增 `resolveConfig()` 运行时配置解析；默认行为不变（不配置仍走 agnes）

### v1.0.0 (2026-10-04)
- 初始版本
- 支持本地文件 / URL 参考图输入
- 编辑强度、分辨率/比例、风格、多变体参数
- 一键 API key 配置
- 本地文件保存
