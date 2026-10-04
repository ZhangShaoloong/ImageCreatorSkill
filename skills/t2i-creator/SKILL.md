---
name: t2i-creator
description: Use when generating images with agnes-image-2.1-flash model, supporting configurable resolution, aspect ratio, style, hand detection, and multi-angle generation
---

# T2I Creator

## Overview

A Claude Code skill for text-to-image generation using the agnes-image-2.1-flash model. Provides configurable parameters including resolution, aspect ratio, artistic style, hand/finger detection, and multi-angle generation.

## When to Use

- User requests image generation from text description
- Need to create visual assets with specific parameters
- Generating illustrations, concept art, or reference images
- Required: API key configured (run `/t2i-setup` first time)

**NOT for:** Photo editing, image manipulation, or non-agnes models

## Quick Setup

First-time users must configure API key:

```
/t2i-setup
```

This will:
1. Prompt for AGNES_API_KEY
2. Save to `.claude/settings.local.json`
3. Verify connectivity

## Usage Patterns

### 模式判定(两条路径)

- **快速路径**:指令里含**任意 flag**(`--style`、`--aspect`、`--width`、`--multi-angle`、`--model` 等)→ 不弹向导,未给的值用默认,直接生成。
- **交互向导**:只有场景描述、**无任何 flag**,或**空的 `/t2i`** → 走下方"交互向导"流程。

判定口诀:**有 flag = 快速;无 flag = 向导。**

### 参数 → CLI flag 映射

| 向导项 | flag | 默认 |
|--------|------|------|
| 风格 | `--style` | photorealistic |
| 比例 | `--aspect` | 16:9 |
| 自定义尺寸 | `--width N --height N` | 1920×1080 |
| 手部 | `--no-hands` / `--fingers` | 显示 |
| 多角度 | `--multi-angle N` | 单角度（默认） |
| 模型 | `--model <id>` | agnes-image-2.1-flash |
| 输出目录 | `--output <dir>` | ./output |

### Basic Generation (All Defaults)

```
/t2i [scene description]
```

Example:
```
/t2i 一只橘猫在阳光下的草地上打盹
```

Uses: 1920×1080, 16:9, photorealistic, hands shown, no multi-angle

### Custom Parameters

```
/t2i [prompt] --width 1024 --height 1024 --style cartoon-2d --no-hands --multi-angle 4
```

### 交互向导(无 flag 时执行)

收场景描述 → **头脑风暴补充细节（不可跳过）** → 用 `AskUserQuestion` 逐问参数(每问含"接受默认";任一问允许"跳过,全用默认直接生成")。

**第 0 步 场景描述**(自由输入,非按钮)
- 用户已给描述 → 进第 0.5 步。
- 空 `/t2i` → 先问:"请描述你想生成的画面(例:一个现代风格的别墅,绿树环绕)"。

**第 0.5 步 头脑风暴(不可跳过)**
收到描述后,Claude 主动引导用户丰富画面细节,多轮对话,直到用户说"够了""完成"或"不用了"为止。

引导方向示例(不局限于此):
- 光线(自然光、暖光、逆光、黄昏、月光……)
- 时间/季节(清晨、深夜、春天、冬天……)
- 氛围/情绪(宁静、紧张、梦幻、压抑……)
- 构图/视角(近景、远景、仰视、俯视……)
- 背景元素(人物、动物、建筑、自然景物……)
- 颜色倾向(暖色调、冷色调、高饱和、低饱和……)

每轮 Claude 提出 1-3 个具体问题或建议供用户选择,用户可自由补充也可说"跳过这题"。全程保持自然对话语气,不一次性抛出所有问题。

**第 1 问 风格** — 选项:photorealistic(默认) / cartoon-2d / cartoon-3d

**第 2 问 比例/尺寸** — 选项:16:9(默认) / 4:3 / 1:1 / 9:16 / 自定义 w×h
- 选"自定义"时追问 width、height(合法 256–8192)。

**第 3 问 手部/手指** — 选项:显示(默认) / 不显示 / 增强手指细节

**第 4 问 多角度** — 选项:单角度(默认) / 多角度 N 个
- 选"多角度"时追问 N(≥1)。

**第 5 问 模型** — 选项:agnes-image-2.1-flash(默认) / agnes-image-2.5-flash / 其他(手填模型 ID)

**第 6 问 确认** — 汇总全部参数,选项:直接生成 / 改一项 / 取消

收集完 → 按映射表拼 flags → 调 `generateImage(prompt, options)` → 返回保存路径。

## Parameters Reference

| Parameter | Flag | Default | Description |
|-----------|------|---------|-------------|
| Width | `--width` | 1920 | Image width in pixels |
| Height | `--height` | 1080 | Image height in pixels |
| Aspect Ratio | `--aspect` | 16:9 | Image proportions |
| Style | `--style` | photorealistic | Art style: photorealistic, cartoon-2d, cartoon-3d |
| Show Hands | `--no-hands` | true | Omit to disable hand rendering |
| Enhanced Fingers | `--fingers` | false | Omit for standard hand detail |
| Multi-Angle | `--multi-angle N` | 单角度（默认） | Generate N different views (off by default; set N ≥ 1 to enable) |
| Output Dir | `--output` | ./output | Directory where images are saved |

### Style Options

- **photorealistic**: Realistic photography style
- **cartoon-2d**: Flat 2D cartoon illustration
- **cartoon-3d**: 3D rendered cartoon style

### Aspect Ratios

- 16:9 (default, widescreen)
- 4:3 (standard)
- 1:1 (square)
- 9:16 (portrait)
- Custom via `--width` and `--height`

## Error Handling

### Missing API Key
```
Error: AGNES_API_KEY not configured. Run: /t2i-setup
```

### API Timeout
- Retry up to 3 times with exponential backoff
- Final error: "Image generation failed after 3 attempts. Check API key and network."

### Invalid Parameters
- Validate all flags before API call
- Error: "Invalid parameter: --style must be photorealistic, cartoon-2d, or cartoon-3d"

### File Save Failure
- Try alternative path: `./output/`, `./t2is/`, `C:\Users\<user>\Pictures\`
- Notify user with full path and fallback location

## Implementation

See `image-generator.js` for complete implementation.

Key functions:
- `generateImage(prompt, options)` - Main generation function
- `setupApiKey()` - One-time configuration
- `validateParameters(options)` - Parameter validation
- `buildPrompt(prompt, modifiers)` - Construct API prompt with style modifiers

## Common Mistakes

1. **Skipping setup**: Always run `/t2i-setup` before first use
2. **Invalid aspect ratio**: Use predefined ratios or set both width and height
3. **Missing multi-angle flag**: Use `--multi-angle N` where N is the number of views desired
4. **Assuming online gallery**: Images saved locally only, no cloud gallery

## Examples

### Example 1: Basic Portrait
```
/t2i 一位女科学家在实验室工作 --aspect 9:16 --style photorealistic
```
Result: 1080×1920 portrait, photorealistic style, hands shown

### Example 2: Multi-Angle Character
```
/t2i 一个机器人站在未来城市 --multi-angle 5 --style cartoon-3d
```
Result: 5 different angles of robot, 3D cartoon style, default 16:9

### Example 3: No Hands
```
/t2i 一个抽象的艺术装置 --no-hands --style cartoon-2d
```
Result: 1920×1080, 2D cartoon, no hands rendered

## Workflow

1. **Check configuration**: Verify API key exists
2. **Parse parameters**: Extract flags from user input
3. **Validate inputs**: Check parameter combinations
4. **Generate prompt**: Combine description with style modifiers
5. **Call API**: POST to agnes-image-2.1-flash endpoint
6. **Save result**: Store image locally with timestamp
7. **Return path**: Provide full file path to user

## Dependencies

- Node.js 18+ (for fetch API)
- AGNES_API_KEY environment variable
- Network access to agnes-image API

## Testing

Run baseline tests before deployment:
```bash
node image-generator.js --test-setup
node image-generator.js --test-generate "test prompt"
```

Success criteria:
- [ ] Setup flow configures API key correctly
- [ ] Default parameters work without prompting
- [ ] All flags parse correctly
- [ ] Images save to local directory
- [ ] Paths returned are valid and accessible
