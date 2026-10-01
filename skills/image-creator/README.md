# Image Creator Skill 使用指南

## 快速开始

### 1. 首次配置（只需一次）

运行配置命令设置 API key：

```bash
node "E:\AI\Make Skill\skills\image-creator\image-generator.js" --setup
```

输入你的 AGNES_API_KEY，系统将自动保存到 `.claude/settings.local.json`

### 2. 生成图片

#### 基础用法（使用默认参数）
```
/image 一只橘猫在阳光下的草地上打盹
```

#### 自定义参数
```
/image 一个未来城市景观 --width 1920 --height 1080 --style cartoon-3d
```

#### 多角度生成
```
/image 一个机器人站在街道上 --multi-angle 4 --style cartoon-3d
```

#### 不显示手部
```
/image 一只手拿着苹果 --no-hands
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

## 工作流程

### 交互式模式
直接运行 `/image`，系统会引导你完成所有参数设置

### 非交互式模式
在提示中直接提供所有参数:
```
/image [场景描述] --参数1 --参数2 ...
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
A: 运行 `--setup` 命令配置你的 AGNES_API_KEY

### Q: 生成的图片风格不对？
A: 检查是否使用了正确的 `--style` 参数

### Q: 手部细节不理想？
A: 尝试添加 `--fingers` 参数增强手指细节

### Q: 如何生成不同角度的同一场景？
A: 使用 `--multi-angle 3` 或更多角度数

## 技术细节

### API 端点
当前实现为模拟调用，实际使用时需要替换为真实的 agnes-image API 端点

### 依赖
- Node.js 18+
- 有效的 AGNES_API_KEY
- 网络连接

### 扩展开发
如需添加真实 API 调用，编辑 `image-generator.js` 中的 `callApi()` 函数

## 更新日志

### v1.0.0 (2026-10-01)
- 初始版本
- 支持基本参数配置
- 一键 API key 配置
- 本地文件保存
