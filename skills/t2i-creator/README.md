# T2I Creator Skill 使用指南

## 快速开始

### 1. 首次配置（只需一次）

运行配置命令设置 API key：

```bash
node "E:\AI\Make Skill\skills\t2i-creator\image-generator.js" --setup
```

输入你的 API key（也可用 `--key` 直接传入），系统将自动保存到 `.claude/settings.local.json`

### 2. 生成图片

#### 基础用法（使用默认参数）
```
/t2i 一只橘猫在阳光下的草地上打盹
```

#### 自定义参数
```
/t2i 一个未来城市景观 --width 1920 --height 1080 --style cartoon-3d
```

#### 多角度生成
```
/t2i 一个机器人站在街道上 --multi-angle 4 --style cartoon-3d
```

#### 不显示手部
```
/t2i 一只手拿着苹果 --no-hands
```

## 参数说明

### 分辨率 (--width, --height)
- 默认: 1920×1080
- 范围: 256-8192 像素
- 示例: `--width 1024 --height 1024`

### 比例 (--aspect)
可选值:
- `16:9` (默认，宽屏)
- `4:3` (标准)
- `1:1` (方形)
- `9:16` (竖屏)

### 风格 (--style)
可选值:
- `photorealistic` (默认，写实风格)
- `cartoon-2d` (2D卡通风格)
- `cartoon-3d` (3D卡通风格)

### 手部检测
- `--no-hands`: 不显示手部
- `--fingers`: 增强手指细节（默认显示手部但细节一般）

### 多角度生成
- `--multi-angle N`: 生成 N 个不同角度的图片（N ≥ 1，默认单角度）

### 输出目录 (--output)
- 默认: `./output`（项目根目录下）
- 示例: `--output ./t2is` 或 `--output C:\Users\x1c\Pictures`

## 工作流程

### 交互式模式
直接运行 `/t2i`，系统会引导你完成所有参数设置

### 非交互式模式
在提示中直接提供所有参数:
```
/t2i [场景描述] --参数1 --参数2 ...
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
  node image-generator.js "a cat"

# 方式 B：CLI
node image-generator.js "a cat" --base https://your.backend/v1 --model your-model --key sk_xxx
```

### 使用 .env 文件
复制仓库根的 `.env.example` 为 `.env` 填好值，再用 `--env .env` 显式加载
（`--env` 不会覆盖已存在的环境变量）：
```bash
node image-generator.js "a cat" --env .env
```

## 保存位置

生成的图片保存在项目根目录的 `./output/` 文件夹中，文件名为：
```
{时间戳}_{场景描述关键词}.jpg
```

例如:
```
output/2026-10-01T19-30-00_一只橘猫在草地.jpg
```

## 常见问题

### Q: 提示找不到 API key？
A: 运行 `--setup` 交互输入，或设 `IMAGE_API_KEY`（或 `AGNES_API_KEY`）环境变量，或用 `--key`/`--env` 提供

### Q: 想换成其它厂商/后端？
A: 无需改代码。设 `IMAGE_API_BASE` + `IMAGE_MODEL`（或 `--base`/`--model`）指向你的 OpenAI 兼容后端；密钥用 `IMAGE_API_KEY`。详见上方「厂商无关配置」

### Q: 生成的图片风格不对？
A: 检查是否使用了正确的 `--style` 参数

### Q: 手部细节不理想？
A: 尝试添加 `--fingers` 参数增强手指细节

### Q: 如何生成不同角度的同一场景？
A: 使用 `--multi-angle 3` 或更多角度数

## 技术细节

### API 端点
真实调用 OpenAI 兼容端点：`POST {IMAGE_API_BASE}/images/generations`
（默认 base 为 `https://api.agnes-ai.cn/v1`，可用 `--base` 或环境变量覆盖）

### 依赖
- Node.js 18+
- 有效的 API key（`IMAGE_API_KEY` / `AGNES_API_KEY`，或 `settings.local.json`）
- 可访问的目标 API（默认 agnes）

### 扩展开发
如需添加真实 API 调用，编辑 `image-generator.js` 中的 `callApi()` 函数

## 更新日志

### v1.2.0 (2026-10-04)
- 厂商无关化：`--base`/`--model`/`--key`/`--env` 新增 flag，支持环境变量
  （`IMAGE_API_BASE`/`IMAGE_MODEL`/`IMAGE_API_KEY`，兜底 `AGNES_API_*`），
  优先级 CLI > env > settings > 内置 agnes 默认
- `--setup` 改为交互式读取真实 key（不再写 mock key），支持 `--key` 跳过交互
- 新增 `resolveConfig()` 运行时配置解析；默认行为不变（不配置仍走 agnes）

### v1.1.0 (2026-10-04)
- 重命名 skill：`image-creator` → `t2i-creator`（斜杠命令 `/image` → `/t2i`）
- 新增 `--output <dir>` 输出目录参数

### v1.0.0 (2026-10-01)
- 初始版本
- 支持基本参数配置
- 一键 API key 配置
- 本地文件保存
