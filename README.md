# Draw.io 增强版 - 完整项目文档

## 📋 目录

- [项目概述](#项目概述)
- [系统架构](#系统架构)
- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [服务配置](#服务配置)
- [功能详解](#功能详解)
  - [AI 图片转换](#ai-图片转换)
  - [图标库](#图标库)
  - [3D 形状](#3d-形状)
- [API 文档](#api-文档)
- [使用指南](#使用指南)
- [故障排除](#故障排除)
- [开发指南](#开发指南)
- [常见问题](#常见问题)

---

## 📖 项目概述

本项目是基于 Draw.io 的增强版本，集成了以下核心功能：

1. **AI 图片转换**：使用 SAM (Segment Anything Model) 进行智能图像分割，将图片转换为矢量图形
2. **图标库**：提供丰富的学科图标库（数学、物理、化学、生物等），支持动态加载和搜索
3. **3D 形状**：支持等轴测投影的 3D 图形绘制

### 技术栈

- **前端**：Draw.io (基于 mxGraph)
- **后端服务**：
  - AI Converter: Python + FastAPI + SAM
  - Icon Library: Node.js + HTTP Server
- **端口配置**：
  - 前端服务：8080
  - AI Converter：8081
  - Icon Library：8082

---

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    用户浏览器                            │
│              http://localhost:8080                      │
└───────────────────┬─────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
┌───────────────┐       ┌───────────────┐
│  前端服务     │       │  AI Converter │
│  (8080)       │       │  (8081)       │
│               │       │               │
│ - Draw.io UI  │       │ - SAM 模型    │
│ - 插件系统    │       │ - 图像分割    │
│ - 3D 形状    │       │ - API 服务    │
└───────┬───────┘       └───────────────┘
        │
        ▼
┌───────────────┐
│ Icon Library  │
│ (8082)        │
│               │
│ - 图标数据    │
│ - API 服务    │
└───────────────┘
```

---

## 💻 环境要求

### 基础环境

- **操作系统**：Windows 10/11, macOS, Linux
- **Python**：3.8 或更高版本
- **Node.js**：14.x 或更高版本
- **浏览器**：Chrome, Firefox, Edge (最新版本)

### Python 依赖 (AI Converter)

```
fastapi>=0.100.0
uvicorn>=0.23.0
pillow>=9.0.0
numpy>=1.21.0
torch>=1.13.0
torchvision>=0.14.0
```

### Node.js 依赖 (Icon Library)

仅使用 Node.js 标准库，无需额外依赖。

---

## 🚀 快速开始

### 方式一：使用启动脚本（推荐）

#### Windows

双击运行 `start-services.bat`，或在 PowerShell 中执行：

```powershell
.\start-services.bat
```

#### Linux/macOS

```bash
chmod +x start-services.ps1
# 如果系统支持 PowerShell
pwsh start-services.ps1
```

### 方式二：手动启动

#### 1. 启动前端服务（端口 8080）

```bash
cd frontend/main/webapp
python -m http.server 8080
```

#### 2. 启动 AI Converter（端口 8081）

```bash
cd servers/aiconverter
python app.py
```

#### 3. 启动 Icon Library（端口 8082）

```bash
cd servers/iconlibrary
node server.js
```

### 验证服务运行

打开浏览器访问：`http://localhost:8080`

检查侧边栏是否显示：
- ✅ 3D 形状（默认展开）
- ✅ AI 图片转化（默认展开）
- ✅ 图标库（默认展开）

---

## ⚙️ 服务配置

### 端口配置

所有端口配置已统一管理：

| 服务 | 端口 | 配置文件 | 说明 |
|------|------|----------|------|
| 前端服务 | 8080 | `start-services.bat/ps1` | 静态文件服务器 |
| AI Converter | 8081 | `servers/aiconverter/app.py` | SAM 图像分割服务 |
| Icon Library | 8082 | `servers/iconlibrary/server.js` | 图标库 API 服务 |

### 修改端口

如需修改端口，请同步更新以下文件：

1. **AI Converter**：
   - `servers/aiconverter/app.py` (第 307 行)
   - `frontend/main/webapp/plugins/ai-convert.js` (第 23 行)
   - `frontend/main/webapp/js/bootstrap.js` (CSP 策略)
   - `frontend/main/webapp/js/diagramly/Devel.js` (CSP 策略)

2. **Icon Library**：
   - `servers/iconlibrary/server.js` (第 12 行)
   - `frontend/main/webapp/plugins/material-library-api.js` (第 24 行)
   - `frontend/main/webapp/preload.js` (第 18 行)
   - `frontend/main/webapp/js/diagramly/App.js` (第 808 行)

3. **启动脚本**：
   - `start-services.bat`
   - `start-services.ps1`

---

## 🎨 功能详解

### AI 图片转换

#### 功能概述

AI 图片转换功能使用 Facebook 的 SAM (Segment Anything Model) 对上传的图片进行智能分割，自动识别图片中的不同区域，并将其转换为可编辑的矢量图形。

#### 核心特性

- ✅ **智能分割**：自动识别图片中的不同物体和区域
- ✅ **颜色提取**：自动提取每个分割区域的主色调
- ✅ **预览功能**：处理前可预览图片并重新选择
- ✅ **参数可调**：支持调整分割阈值和最小区域面积
- ✅ **批量处理**：可处理多张图片

#### 使用步骤

1. **选择图片**
   - 点击侧边栏 "AI 图片转化" 面板中的 "选择图片" 按钮
   - 支持格式：JPG、PNG

2. **预览确认**
   - 图片加载后会自动弹出预览对话框
   - 查看图片尺寸和预览效果
   - 可选择：
     - **重新选择**：更换图片
     - **取消**：取消操作
     - **开始处理**：确认并开始分割

3. **处理图片**
   - 点击 "开始处理" 后，系统会：
     - 上传图片到 AI Converter 服务
     - 使用 SAM 模型进行分割
     - 提取每个区域的多边形轮廓
     - 提取区域的主色调
     - 在画布上绘制矢量图形

4. **编辑图形**
   - 分割完成后，可在画布上直接编辑生成的图形
   - 每个区域都是独立的可编辑对象

#### 技术实现

**前端插件**：`frontend/main/webapp/plugins/ai-convert.js`

**关键函数**：
- `showImagePreviewDialog()`: 显示预览对话框
- `processImage()`: 处理图片主流程
- `segmentImage()`: 调用 API 进行分割
- `extractContours()`: 提取轮廓数据
- `drawContoursOnCanvas()`: 在画布上绘制图形

**API 端点**：`http://localhost:8081/api/segment`

**请求格式**：
```javascript
POST /api/segment
Content-Type: multipart/form-data

file: <图片文件>
threshold: 0.5 (可选，分割阈值 0-1)
min_area: 100 (可选，最小区域面积)
```

**响应格式**：
```json
{
  "success": true,
  "image_size": {
    "width": 800,
    "height": 600
  },
  "segments": [
    {
      "id": 0,
      "points": [[100, 50], [200, 50], [200, 150], [100, 150]],
      "fill": {
        "color": "rgb(128, 128, 128)",
        "rgb": [128, 128, 128],
        "hex": "#808080",
        "rgba": [128, 128, 128, 255]
      },
      "area": 10000,
      "confidence": 0.95,
      "bbox": [100, 50, 200, 150]
    }
  ],
  "segment_count": 1
}
```

#### 配置参数

可通过 URL 参数配置：

- `segmentApiUrl`: API 地址（默认：`http://localhost:8081/api/segment`）
- `segmentThreshold`: 分割阈值（默认：0.5）
- `segmentMinArea`: 最小区域面积（默认：100）

示例：
```
http://localhost:8080/?segmentApiUrl=http://your-server:8081/api/segment&segmentThreshold=0.3&segmentMinArea=50
```

---

### 图标库

#### 功能概述

图标库提供丰富的学科图标资源，包括数学、物理、化学、生物、几何、工程、天文学、技术等多个分类。支持动态加载、搜索和分类浏览。

#### 核心特性

- ✅ **多学科分类**：8 个主要学科分类
- ✅ **动态加载**：按需加载图标，提升性能
- ✅ **搜索功能**：支持关键词搜索
- ✅ **SVG 格式**：矢量图标，可无损缩放
- ✅ **API 集成**：通过 RESTful API 获取图标

#### 学科分类

| 分类 ID | 分类名称 | 图标数量 | 说明 |
|---------|----------|----------|------|
| `mathematics` | 数学 | 3+ | 数学符号和图形 |
| `physics` | 物理 | 2+ | 物理实验器材 |
| `chemistry` | 化学 | 3+ | 化学实验设备 |
| `biology` | 生物学 | 3+ | 生物细胞结构 |
| `geometry` | 几何 | 3+ | 几何图形 |
| `engineering` | 工程 | 2+ | 工程工具 |
| `astronomy` | 天文学 | 2+ | 天体图形 |
| `technology` | 技术 | 2+ | 技术图标 |

#### 使用步骤

1. **打开图标库**
   - 侧边栏自动显示 "图标库" 面板（默认展开）
   - 面板顶部显示搜索框

2. **浏览分类**
   - 点击分类名称展开/折叠
   - 查看该分类下的所有图标

3. **搜索图标**
   - 在搜索框中输入关键词
   - 自动过滤匹配的图标
   - 支持中文和英文搜索

4. **使用图标**
   - 点击图标即可添加到画布
   - 图标以 SVG 格式插入，可自由编辑

#### 技术实现

**前端插件**：`frontend/main/webapp/plugins/material-library-api.js`

**关键组件**：
- `ApiClient`: API 请求客户端
- `MaterialLoader`: 素材加载器
- `CacheManager`: 缓存管理器（可选）

**API 端点**：

1. **获取所有分类**：
   ```
   GET http://localhost:8082/api/material-libraries
   ```

2. **获取分类图标**：
   ```
   GET http://localhost:8082/api/material-libraries/{categoryId}/items
   ```

**数据结构**：

分类信息 (`library.json`)：
```json
{
  "id": "mathematics",
  "title": "数学",
  "version": "1.0.0",
  "preload": true,
  "order": 1
}
```

图标信息 (`items.json`)：
```json
[
  {
    "id": "math_001",
    "categoryId": "mathematics",
    "title": "圆形",
    "svg": "data:image/svg+xml;base64,...",
    "tags": ["圆形", "circle", "几何"]
  }
]
```

#### 配置选项

**API 地址配置**：

1. **URL 参数**：
   ```
   http://localhost:8080/?materialApiUrl=http://localhost:8082/api
   ```

2. **浏览器控制台**：
   ```javascript
   window.MATERIAL_LIBRARY_API_URL = 'http://localhost:8082/api';
   window.location.reload();
   ```

3. **preload.js 自动配置**：
   - 默认使用 `http://localhost:8082/api`
   - 可通过 URL 参数覆盖

**认证配置**（可选）：

```javascript
// Token 认证
window.MATERIAL_LIBRARY_API_TOKEN = 'your-token';

// API Key 认证
window.MATERIAL_LIBRARY_API_KEY = 'your-api-key';
```

---

### 3D 形状

#### 功能概述

3D 形状功能提供等轴测投影的 3D 图形绘制能力，支持立方体、圆柱体、圆锥体等多种基本 3D 形状。

#### 核心特性

- ✅ **等轴测投影**：标准的 3D 投影方式
- ✅ **多种形状**：立方体、圆柱体、圆锥体等
- ✅ **可编辑参数**：支持调整尺寸、角度、颜色等
- ✅ **实时预览**：绘制过程中实时显示效果

#### 可用形状

1. **立方体 (Cube)**
   - 可调整长度、宽度、高度
   - 支持旋转角度设置

2. **圆柱体 (Cylinder)**
   - 可调整半径和高度
   - 支持顶部和底部圆角

3. **圆锥体 (Cone)**
   - 可调整底部半径和高度
   - 支持顶部圆角

#### 使用步骤

1. **打开 3D 形状面板**
   - 侧边栏显示 "3D 形状" 面板（默认展开）

2. **选择形状**
   - 点击所需的 3D 形状图标

3. **绘制图形**
   - 在画布上拖动鼠标绘制形状
   - 调整大小和位置

4. **编辑属性**
   - 选中图形后，可在右侧属性面板调整：
     - 尺寸（长、宽、高）
     - 旋转角度
     - 填充颜色
     - 边框颜色和宽度

#### 技术实现

**前端插件**：`frontend/main/webapp/plugins/isocube.js`

**自定义形状**：
- `isoCube`: 立方体形状
- `isoCylinder`: 圆柱体形状
- `isoCone`: 圆锥体形状（如已实现）

**样式属性**：
- `isoZ`: Z 轴高度
- `isoRx`: X 轴旋转
- `isoRy`: Y 轴旋转
- `isoRz`: Z 轴旋转

---

## 📚 API 文档

### AI Converter API

#### 基础信息

- **服务地址**：`http://localhost:8081`
- **API 版本**：1.0.0
- **协议**：HTTP/HTTPS
- **数据格式**：JSON, multipart/form-data

#### 端点列表

##### 1. 健康检查

```
GET /health
```

**响应示例**：
```json
{
  "status": "healthy",
  "sam_loaded": true,
  "model_type": "vit_h"
}
```

##### 2. 图像分割

```
POST /api/segment
```

**请求参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file` | File | 是 | 图片文件（multipart/form-data） |
| `threshold` | Float | 否 | 分割阈值 (0-1)，默认 0.5 |
| `min_area` | Integer | 否 | 最小区域面积，默认 100 |
| `return_image` | Boolean | 否 | 是否返回可视化图片，默认 false |

**请求示例**：

```bash
curl -X POST "http://localhost:8081/api/segment?threshold=0.5&min_area=100" \
  -F "file=@your_image.jpg"
```

**响应示例**：

```json
{
  "success": true,
  "image_size": {
    "width": 800,
    "height": 600
  },
  "segments": [
    {
      "id": 0,
      "points": [[100, 50], [200, 50], [200, 150], [100, 150]],
      "fill": {
        "color": "rgb(128, 128, 128)",
        "rgb": [128, 128, 128],
        "hex": "#808080",
        "rgba": [128, 128, 128, 255]
      },
      "area": 10000,
      "confidence": 0.95,
      "bbox": [100, 50, 200, 150]
    }
  ],
  "segment_count": 1,
  "parameters": {
    "threshold": 0.5,
    "min_area": 100
  }
}
```

**错误响应**：

```json
{
  "success": false,
  "error": "错误信息"
}
```

#### Python 示例

```python
import requests

url = "http://localhost:8081/api/segment"
files = {"file": open("your_image.jpg", "rb")}
params = {"threshold": 0.5, "min_area": 100}

response = requests.post(url, files=files, params=params)
result = response.json()

print(f"找到 {result['segment_count']} 个分割区域")
for segment in result['segments']:
    print(f"区域 {segment['id']}: {len(segment['points'])} 个点")
```

#### JavaScript 示例

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('http://localhost:8081/api/segment?threshold=0.5&min_area=100', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(`找到 ${result.segment_count} 个分割区域`);
```

---

### Icon Library API

#### 基础信息

- **服务地址**：`http://localhost:8082`
- **API 版本**：1.0.0
- **协议**：HTTP
- **数据格式**：JSON

#### 端点列表

##### 1. 获取所有分类

```
GET /api/material-libraries
```

**响应示例**：

```json
{
  "success": true,
  "data": [
    {
      "id": "mathematics",
      "title": "数学",
      "version": "1.0.0",
      "preload": true,
      "order": 1
    },
    {
      "id": "physics",
      "title": "物理",
      "version": "1.0.0",
      "preload": false,
      "order": 2
    }
  ]
}
```

##### 2. 获取分类图标

```
GET /api/material-libraries/{categoryId}/items
```

**路径参数**：
- `categoryId`: 分类 ID（如：mathematics, physics 等）

**查询参数**：
- `search`: 搜索关键词（可选）
- `limit`: 返回数量限制（可选）
- `offset`: 偏移量（可选）

**响应示例**：

```json
{
  "success": true,
  "data": {
    "categoryId": "mathematics",
    "version": "1.0.0",
    "items": [
      {
        "id": "math_001",
        "categoryId": "mathematics",
        "title": "圆形",
        "svg": "data:image/svg+xml;base64,PHN2Zy4uLg==",
        "tags": ["圆形", "circle", "几何"]
      }
    ],
    "total": 1
  }
}
```

#### JavaScript 示例

```javascript
// 获取所有分类
const librariesResponse = await fetch('http://localhost:8082/api/material-libraries');
const libraries = await librariesResponse.json();

// 获取数学分类的图标
const itemsResponse = await fetch('http://localhost:8082/api/material-libraries/mathematics/items');
const items = await itemsResponse.json();
```

---

## 📖 使用指南

### 基本工作流程

1. **启动所有服务**
   ```bash
   # Windows
   start-services.bat
   
   # 或手动启动
   python -m http.server 8080  # 前端
   python servers/aiconverter/app.py  # AI 服务
   node servers/iconlibrary/server.js  # 图标库
   ```

2. **打开 Draw.io**
   - 浏览器访问：`http://localhost:8080`
   - 等待页面加载完成

3. **使用功能**
   - **AI 转换**：选择图片 → 预览 → 处理 → 编辑
   - **图标库**：浏览分类 → 搜索 → 点击插入
   - **3D 形状**：选择形状 → 绘制 → 编辑属性

### 高级技巧

#### AI 转换优化

1. **调整分割参数**
   - 图片较复杂时，降低 `threshold`（如 0.3）
   - 需要更精细分割时，降低 `min_area`（如 50）

2. **批量处理**
   - 处理完一张图片后，可继续选择新图片
   - 建议处理前先预览确认

3. **颜色调整**
   - 分割后的图形颜色可手动调整
   - 使用右侧属性面板修改填充和边框颜色

#### 图标库管理

1. **添加新图标**
   - 编辑 `servers/iconlibrary/items.json`
   - 运行 `node servers/iconlibrary/update-items.js` 更新

2. **添加新分类**
   - 在 `servers/iconlibrary/data/` 下创建新目录
   - 添加 `library.json` 和 `icons/` 目录
   - 更新 `items.json`

3. **搜索优化**
   - 使用英文关键词通常搜索效果更好
   - 标签匹配优先级高于标题匹配

---

## 🔧 故障排除

### 常见问题

#### 1. 服务无法启动

**问题**：端口被占用

**解决方案**：
```bash
# Windows
netstat -ano | findstr :8080
taskkill /PID <PID> /F

# Linux/macOS
lsof -i :8080
kill -9 <PID>
```

#### 2. AI Converter 服务错误

**问题**：SAM 模型未加载

**解决方案**：
1. 检查模型文件是否存在：
   ```bash
   ls servers/aiconverter/checkpoints/
   ```

2. 下载模型文件：
   ```bash
   # ViT-B (最小，推荐测试)
   wget https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth
   mv sam_vit_b_01ec64.pth servers/aiconverter/checkpoints/
   ```

3. 检查 Python 依赖：
   ```bash
   pip install -r servers/aiconverter/requirements.txt
   pip install git+https://github.com/facebookresearch/segment-anything.git
   ```

#### 3. 图标库无法加载

**问题**：API 请求失败

**解决方案**：
1. 检查服务是否运行：
   ```bash
   curl http://localhost:8082/api/material-libraries
   ```

2. 检查浏览器控制台错误
3. 确认 CORS 配置正确

#### 4. 前端无法连接后端

**问题**：CORS 错误或连接被拒绝

**解决方案**：
1. 检查所有服务是否启动
2. 检查端口配置是否正确
3. 检查浏览器控制台的网络请求
4. 确认防火墙设置

#### 5. 图片处理失败

**问题**：API 返回错误

**解决方案**：
1. 检查图片格式（仅支持 JPG、PNG）
2. 检查图片大小（建议 < 10MB）
3. 查看 AI Converter 服务日志
4. 尝试降低图片分辨率

### 日志查看

#### AI Converter 日志

服务启动时会显示日志，包括：
- 模型加载状态
- API 请求信息
- 错误详情

#### 浏览器控制台

按 F12 打开开发者工具，查看：
- Console：JavaScript 错误和日志
- Network：API 请求状态
- Application：本地存储和缓存

---

## 👨‍💻 开发指南

### 项目结构

```
drawio/
├── frontend/
│   └── main/
│       └── webapp/
│           ├── plugins/          # 插件目录
│           │   ├── ai-convert.js      # AI 转换插件
│           │   ├── material-library-api.js  # 图标库插件
│           │   └── isocube.js         # 3D 形状插件
│           ├── js/               # JavaScript 核心文件
│           └── index.html         # 主页面
├── servers/
│   ├── aiconverter/              # AI 转换服务
│   │   ├── app.py                # FastAPI 应用
│   │   ├── sam_processor.py      # SAM 处理逻辑
│   │   └── requirements.txt      # Python 依赖
│   └── iconlibrary/              # 图标库服务
│       ├── server.js             # Node.js 服务器
│       ├── items.json            # 图标数据
│       └── data/                 # 分类数据目录
├── start-services.bat            # Windows 启动脚本
└── start-services.ps1            # PowerShell 启动脚本
```

### 添加新功能

#### 1. 添加新插件

1. 在 `frontend/main/webapp/plugins/` 创建新文件
2. 使用 Draw.io 插件格式：
   ```javascript
   Draw.loadPlugin(function(editorUi) {
     // 插件代码
   });
   ```
3. 在 `preload.js` 中添加插件引用

#### 2. 扩展 AI Converter

1. 修改 `servers/aiconverter/app.py` 添加新端点
2. 在 `sam_processor.py` 中添加处理逻辑
3. 更新前端插件调用新 API

#### 3. 添加新图标分类

1. 创建目录：`servers/iconlibrary/data/新分类/`
2. 添加 `library.json`：
   ```json
   {
     "id": "new_category",
     "title": "新分类",
     "version": "1.0.0",
     "preload": false,
     "order": 9
   }
   ```
3. 添加图标到 `icons/` 目录
4. 运行 `update-items.js` 更新数据

### 代码规范

- **JavaScript**：遵循 Draw.io 现有代码风格
- **Python**：遵循 PEP 8 规范
- **注释**：关键函数需要中文注释
- **命名**：使用有意义的变量和函数名

### 测试

#### AI Converter 测试

```bash
cd servers/aiconverter
python test_api.py
```

#### 图标库测试

```bash
curl http://localhost:8082/api/material-libraries
curl http://localhost:8082/api/material-libraries/mathematics/items
```

---

## ❓ 常见问题

### Q1: 为什么 AI 转换很慢？

**A**: SAM 模型处理需要一定时间，特别是使用 CPU 时。建议：
- 使用 GPU 加速（需要 CUDA）
- 降低图片分辨率
- 使用较小的模型（ViT-B）

### Q2: 可以添加自己的图标吗？

**A**: 可以。编辑 `servers/iconlibrary/items.json` 或使用 `update-items.js` 脚本。

### Q3: 如何修改默认端口？

**A**: 参见 [服务配置](#服务配置) 章节，需要同步更新多个文件。

### Q4: 支持哪些图片格式？

**A**: AI 转换目前支持 JPG 和 PNG 格式。

### Q5: 图标库支持哪些格式？

**A**: 图标库使用 SVG 格式，支持矢量图形。

### Q6: 如何处理大图片？

**A**: 建议：
- 先压缩图片
- 降低分辨率
- 分批处理

### Q7: 可以离线使用吗？

**A**: 可以。所有服务都在本地运行，不需要互联网连接（首次下载 SAM 模型除外）。

---

## 📝 更新日志

### v1.0.0 (当前版本)

- ✅ AI 图片转换功能
- ✅ 图标库功能（8 个学科分类）
- ✅ 3D 形状功能
- ✅ 统一的启动脚本
- ✅ 完整的 API 文档

---

## 📄 许可证

本项目基于 Draw.io 开源项目，遵循相应的开源许可证。

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📧 联系方式

如有问题或建议，请通过以下方式联系：
- 提交 GitHub Issue
- 发送邮件

---

**最后更新**：2024年

**文档版本**：1.0.0

