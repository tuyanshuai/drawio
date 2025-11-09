# 图像生成服务

基于 `generate_image.py` 的 Web API 服务，使用 oneapi.cyberclaude.com 的 gemini-2.5-flash-image 模型生成图片。

## 功能特性

- 基于 FastAPI 的 Web API 服务
- 支持文本到图像生成
- 支持自定义宽高比（aspect ratio）
- 自动保存生成的图像
- 返回 base64 编码的图像数据，方便前端直接使用

## 安装

1. 确保已安装 Python 3.8+

2. 安装依赖：
```bash
pip install -r requirements.txt
```

## 配置

可以通过环境变量配置以下参数：

- `API_URL`: API 地址（默认: https://oneapi.cyberclaude.com/v1/chat/completions）
- `API_KEY`: API 密钥（默认: 使用代码中的默认值）
- `MODEL`: 模型名称（默认: gemini-2.5-flash-image）

## 启动服务

### Windows
```bash
start.bat
```

### 手动启动
```bash
python app.py
```

服务将在 `http://localhost:8083` 启动

## API 接口

### POST /api/generate

生成图像

**请求体：**
```json
{
  "prompt": "一只可爱的小猫",
  "aspect_ratio": "16:9",
  "max_tokens": 150,
  "temperature": 0.7
}
```

**响应：**
```json
{
  "success": true,
  "image_url": "data:image/png;base64,...",
  "prompt": "一只可爱的小猫",
  "aspect_ratio": "16:9",
  "saved_file": "generated_image_20251109_200115.png"
}
```

### GET /api/health

健康检查

**响应：**
```json
{
  "status": "healthy",
  "api_url": "...",
  "model": "gemini-2.5-flash-image",
  "has_api_key": true
}
```

## 前端集成

前端代码位于 `frontend/main/webapp/plugins/text-to-image.js`，已配置为调用此服务。

可以通过 URL 参数配置 API 地址：
```
http://localhost:8080/?imageGeneratorApiUrl=http://localhost:8083/api/generate
```

## 注意事项

- 生成的图像会保存在 `servers/image-generator/` 目录下
- 服务默认运行在端口 8083
- 确保 API_KEY 有效，否则图像生成会失败
