---
name: image-creator
description: Use when generating images with agnes-image-2.1-flash model, supporting configurable resolution, aspect ratio, style, hand detection, and multi-angle generation
---

# Image Creator

## Overview

A Claude Code skill for generating images using the agnes-image-2.1-flash model. Provides configurable parameters including resolution, aspect ratio, artistic style, hand/finger detection, and multi-angle generation.

## When to Use

- User requests image generation from text description
- Need to create visual assets with specific parameters
- Generating illustrations, concept art, or reference images
- Required: API key configured (run `/image-setup` first time)

**NOT for:** Photo editing, image manipulation, or non-agnes models

## Quick Setup

First-time users must configure API key:

```
/image-setup
```

This will:
1. Prompt for AGNES_API_KEY
2. Save to `.claude/settings.local.json`
3. Verify connectivity

## Usage Patterns

### 模式判定(两条路径)

- **快速路径**:指令里含**任意 flag**(`--style`、`--aspect`、`--width`、`--multi-angle`、`--model` 等)→ 不弹向导,未给的值用默认,直接生成。
- **交互向导**:只有场景描述、**无任何 flag**,或**空的 `/image`** → 走下方"交互向导"流程。

判定口诀:**有 flag = 快速;无 flag = 向导。**

### 参数 → CLI flag 映射

| 向导项 | flag | 默认 |
|--------|------|------|
| 风格 | `--style` | photorealistic |
| 比例 | `--aspect` | 16:9 |
| 自定义尺寸 | `--width N --height N` | 1920×1080 |
| 手部 | `--no-hands` / `--fingers` | 显示 |
| 多角度 | `--multi-angle N` | 1 |
| 模型 | `--model <id>` | agnes-image-2.1-flash |

### Basic Generation (All Defaults)

```
/image [scene description]
```

Example:
```
/image 一只橘猫在阳光下的草地上打盹
```

Uses: 1920×1080, 16:9, photorealistic, hands shown, no multi-angle

### Custom Parameters

```
/image [prompt] --width 1024 --height 1024 --style cartoon-2d --no-hands --multi-angle 4
```

### Interactive Mode

```
/image
```

Skill will prompt for:
- Scene description
- Resolution (or accept default)
- Aspect ratio (or accept default)
- Style (or accept default)
- Hand detection preference
- Multi-angle generation

## Parameters Reference

| Parameter | Flag | Default | Description |
|-----------|------|---------|-------------|
| Width | `--width` | 1920 | Image width in pixels |
| Height | `--height` | 1080 | Image height in pixels |
| Aspect Ratio | `--aspect` | 16:9 | Image proportions |
| Style | `--style` | photorealistic | Art style: photorealistic, cartoon-2d, cartoon-3d |
| Show Hands | `--no-hands` | true | Omit to disable hand rendering |
| Enhanced Fingers | `--fingers` | false | Omit for standard hand detail |
| Multi-Angle | `--multi-angle N` | false | Generate N different views |
| Angle Count | `--angles N` | 3 | Number of angles (requires --multi-angle) |

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
Error: AGNES_API_KEY not configured. Run: /image-setup
```

### API Timeout
- Retry up to 3 times with exponential backoff
- Final error: "Image generation failed after 3 attempts. Check API key and network."

### Invalid Parameters
- Validate all flags before API call
- Error: "Invalid parameter: --style must be photorealistic, cartoon-2d, or cartoon-3d"

### File Save Failure
- Try alternative path: `./output/`, `./images/`, `C:\Users\<user>\Pictures\`
- Notify user with full path and fallback location

## Implementation

See `image-generator.js` for complete implementation.

Key functions:
- `generateImage(prompt, options)` - Main generation function
- `setupApiKey()` - One-time configuration
- `validateParameters(options)` - Parameter validation
- `buildPrompt(prompt, modifiers)` - Construct API prompt with style modifiers

## Common Mistakes

1. **Skipping setup**: Always run `/image-setup` before first use
2. **Invalid aspect ratio**: Use predefined ratios or set both width and height
3. **Missing multi-angle flag**: Use `--multi-angle` before `--angles`
4. **Assuming online gallery**: Images saved locally only, no cloud gallery

## Examples

### Example 1: Basic Portrait
```
/image 一位女科学家在实验室工作 --aspect 9:16 --style photorealistic
```
Result: 1080×1920 portrait, photorealistic style, hands shown

### Example 2: Multi-Angle Character
```
/image 一个机器人站在未来城市 --multi-angle --angles 5 --style cartoon-3d
```
Result: 5 different angles of robot, 3D cartoon style, default 16:9

### Example 3: No Hands
```
/image 一个抽象的艺术装置 --no-hands --style cartoon-2d
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
