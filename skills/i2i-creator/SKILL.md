---
name: i2i-creator
description: Use when transforming or editing an existing image (image-to-image) with agnes-image-2.1-flash model, from a local file or URL reference, with configurable edit strength, resolution, aspect ratio, style, and multiple variations
---

# Image-to-Image Creator

## Overview

A Claude Code skill for image-to-image generation using the agnes-image-2.1-flash model. Takes a reference image (local file or URL) plus an edit prompt, and produces a transformed image with configurable edit strength, resolution/aspect, artistic style, and multiple variations.

## When to Use

- User wants to **edit or transform an existing image** (restyle, re-render, change lighting, add/remove elements, "make this look like…")
- User provides a **reference image** (local path or URL) to build from
- Need visual asset variation from a fixed source
- Required: API key configured (run `/i2i-setup` first time)

**NOT for:** Text-only image generation (use `image-creator`), or non-agnes models.

## Quick Setup

First-time users must configure API key:

```
/i2i-setup
```

This will:
1. Prompt for AGNES_API_KEY
2. Save to `.claude/settings.local.json`
3. Verify connectivity

## Usage Patterns

### 模式判定(两条路径)

- **快速路径**:指令里含**任意 flag**(`--strength`、`--style`、`--aspect`、`--variations`、`--model` 等)或已提供输入图片 → 不弹向导,未给的值用默认,直接生成。
- **交互向导**:只有编辑意图、**无输入图片、无 flag** → 走下方"交互向导"流程。

判定口诀:**有图片/有 flag = 快速;无 = 向导。**

### 参数 → CLI flag 映射

| 向导项 | flag | 默认 |
|--------|------|------|
| 输入图片 | `--input <file\|url>` | (必填) |
| 编辑强度 | `--strength N` | 0.7 |
| 风格 | `--style` | photorealistic |
| 比例 | `--aspect` | 1:1 |
| 自定义尺寸 | `--width N --height N` | 1024×1024 |
| 多变体 | `--variations N` | 1 |
| 模型 | `--model <id>` | agnes-image-2.1-flash |
| 输出目录 | `--output <dir>` | ./output |

### Basic Edit (All Defaults)

```
/i2i <输入图片路径或URL> 把这张照片改成水彩画风格
```

Example:
```
/i2i C:\Users\x1c\Pictures\ref.jpg 把它变成霓虹赛博朋克夜景 --strength 0.8
```

Uses: 1024×1024, 1:1, photorealistic, strength 0.7, 1 variation.

### Custom Parameters

```
/i2i <url-or-path> restyle as 3D cartoon --style cartoon-3d --aspect 16:9 --variations 4
```

### 交互向导(无输入图片/无 flag 时执行)

**第 0 步 输入图片(不可跳过)**
- 用户已给图片路径/URL → 直接采用。
- 否则先问:"请提供要编辑的图片(本地路径或 URL)"。

**第 0.5 步 编辑描述(不可跳过)**
- 引导用户明确"想要什么改动":换风格、改光照、加/减元素、改比例、重渲染等。
- 一句自由文本,可多轮补充,直到用户说"够了"。

**第 1 问 编辑强度** — 选项:低(0.3,贴近原图) / 中(0.7,默认) / 高(0.9,大幅改造) / 自定义(0–1)

**第 2 问 风格** — 选项:photorealistic(默认) / cartoon-2d / cartoon-3d

**第 3 问 比例/尺寸** — 选项:1:1(默认) / 16:9 / 4:3 / 9:16 / 自定义 w×h
- 选"自定义"时追问 width、height(合法 256–8192)。

**第 4 问 多变体** — 选项:单张(默认) / 多张 N 个
- 选"多张"时追问 N(≥1)。

**第 5 问 模型** — 选项:agnes-image-2.1-flash(默认) / 其他(手填模型 ID)

**第 6 问 确认** — 汇总全部参数,选项:直接生成 / 改一项 / 取消

收集完 → 按映射表拼 flags → 调 `generateImage(input, prompt, options)` → 返回保存路径。

## Parameters Reference

| Parameter | Flag | Default | Description |
|-----------|------|---------|-------------|
| Input Image | `--input` | (required) | Reference image: local file path or URL |
| Edit Prompt | (positional / `--prompt`) | (required) | Describe the transformation to apply |
| Strength | `--strength` | 0.7 | 0 = keep reference, 1 = full transform |
| Width | `--width` | 1024 | Output width in pixels |
| Height | `--height` | 1024 | Output height in pixels |
| Aspect Ratio | `--aspect` | 1:1 | Output proportions |
| Style | `--style` | photorealistic | Art style: photorealistic, cartoon-2d, cartoon-3d |
| Variations | `--variations N` | 1 | Number of edits of the same input |
| Model | `--model` | agnes-image-2.1-flash | Model ID |
| Output Dir | `--output` | ./output | Directory where images are saved |

### Strength Guidance

- **0.0–0.3**: near-copy, only minor touches (color/tone nudges)
- **0.3–0.6**: moderate edits, keeps most of the original composition
- **0.6–0.85**: significant transformation (default 0.7)
- **0.85–1.0**: heavy re-render, only loosely resembles the reference

### Style Options

- **photorealistic**: Realistic photography style
- **cartoon-2d**: Flat 2D cartoon illustration
- **cartoon-3d**: 3D rendered cartoon style

### Aspect Ratios

- 1:1 (default, square — safest for edits)
- 16:9 (widescreen)
- 4:3 (standard)
- 9:16 (portrait)
- Custom via `--width` and `--height`

## Error Handling

### Missing API Key
```
Error: AGNES_API_KEY not configured. Run: /i2i-setup
```

### Missing / Bad Input Image
- No `--input` → error before any API call
- URL fetch fails → "Could not fetch input image URL (<status>)"
- Local file missing → "Input file not found: <path>"
- Unsupported extension → "Unsupported input image format. Use .png, .jpg, .jpeg, .webp"

### API Timeout
- Retry up to 3 times with exponential backoff
- Final error: "Image-to-image generation failed after 3 attempts. Check API key and network."

### Backend image-to-image route unavailable (404)
- Symptom: `API error 404 ... NotFoundError` on `POST /v1/images/edits`
- Cause: the deployed backend has no image-to-image route (only text-to-image at `/v1/images/generations`)
- Action: verify the endpoint supports img2img; otherwise fall back to `image-creator` (text-to-image) or wait for the backend to expose `/images/edits`

### Invalid Parameters
- Validate all flags before API call
- Error: "Invalid parameter: --style must be photorealistic, cartoon-2d, or cartoon-3d"

## Implementation

See `i2i-generator.js` for complete implementation.

Key functions:
- `generateImage(input, prompt, options)` - Main image-to-image function
- `loadInputImage(input, options)` - Acquires local file or URL image as base64
- `classifyInput(input)` - Distinguishes URL vs local path
- `setupApiKey()` - One-time configuration
- `validateParameters(options)` - Parameter validation
- `buildPrompt(prompt, options)` - Construct API prompt with style + strength modifiers

## Common Mistakes

1. **Skipping setup**: Always run `/i2i-setup` before first use
2. **Missing input image**: Image-to-image requires `--input`; text-only → use `image-creator`
3. **Strength too high for "keep it similar" requests**: If the user wants to preserve the original, lower `--strength` (≤0.4)
4. **Assuming online gallery**: Images saved locally only, no cloud gallery

## Examples

### Example 1: Style Transfer
```
/i2i C:\Users\x1c\Pictures\portrait.jpg convert to oil painting --style photorealistic --strength 0.6
```
Result: 1024×1024 oil-painting rendition, moderately close to the reference.

### Example 2: Heavy Re-render
```
/i2i https://example.com/product.png turn into a photorealistic product shot on a white studio backdrop --strength 0.95 --variations 3
```
Result: 3 heavy-transformed photos, near-photoreal.

### Example 3: Multi-Variation
```
/i2i C:\Users\x1c\Pictures\scene.jpg same scene at night --variations 4 --aspect 16:9
```
Result: 4 wide 16:9 night versions of the input scene.

## Workflow

1. **Check configuration**: Verify API key exists
2. **Acquire input image**: Local file read or URL fetch → base64
3. **Parse parameters**: Extract flags from user input
4. **Validate inputs**: Check parameter combinations
5. **Generate prompt**: Combine edit prompt with style + strength modifiers
6. **Call API**: POST input + prompt to agnes-image-2.1-flash `/images/edits`
7. **Save result**: Store edited image locally with timestamp
8. **Return path**: Provide full file path to user

## Dependencies

- Node.js 18+ (for fetch API)
- AGNES_API_KEY environment variable
- Network access to agnes-image API

## Testing

Run baseline tests before deployment:
```bash
node i2i-generator.js --test
```

Success criteria:
- [ ] Setup flow configures API key correctly
- [ ] Input classified correctly (URL vs local path)
- [ ] Strength / aspect / style validation catches invalid values
- [ ] Default parameters work without prompting
- [ ] Images save to local directory, paths returned valid

> **Backend note (tested 2026-10-04):** the current `api.agnes-ai.cn` deployment has no working
> image-to-image route — `POST /v1/images/edits` returns 404. This skill's request contract
> (multipart `images/edits`) is correct for a backend that supports img2img; end-to-end image
> transformation will only produce output once that route is available. Text-to-image
> (`/v1/images/generations`) is confirmed working with model `agnes-image-2.1-flash` via the
> sibling `image-creator` skill.
