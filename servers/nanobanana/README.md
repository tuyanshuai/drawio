# NanoBanana 图像生成代理服务

套壳 nanobanana API，用于生成科研 BioRender 风格的插图。

## 功能

- 代理 nanobanana 图像生成 API
- 自动增强提示词，添加 BioRender 风格描述
- 支持自定义图像尺寸
- CORS 支持，可在前端直接调用

## 安装

```bash
cd servers/nanobanana
pip install -r requirements.txt
```

## 配置

### 环境变量

- `NANOBANANA_API_URL`: nanobanana API 地址（默认：`https://api.nanobnana.com/v1/images/generations`）
- `NANOBANANA_API_KEY`: nanobanana API 密钥（可选）
- `IMAGE_WIDTH`: 默认图像宽度（默认：1024）
- `IMAGE_HEIGHT`: 默认图像高度（默认：1024）

### Windows

```powershell
$env:NANOBANANA_API_URL="https://api.nanobnana.com/v1/images/generations"
$env:NANOBANANA_API_KEY="your-api-key-here"
python app.py
```

### Linux/Mac

```bash
export NANOBANANA_API_URL="https://api.nanobnana.com/v1/images/generations"
export NANOBANANA_API_KEY="your-api-key-here"
python app.py
```

## 运行

```bash
python app.py
```

服务将在 `http://127.0.0.1:8083` 启动。

## API 端点

### POST /api/generate

生成图像

**请求体：**
```json
{
  "prompt": "细胞分裂过程",
  "width": 1024,
  "height": 1024,
  "n": 1,
  "size": "1024x1024",
  "response_format": "url"
}
```

**响应：**
```json
{
  "success": true,
  "image_url": "https://...",
  "prompt": "细胞分裂过程",
  "enhanced_prompt": "Scientific illustration, BioRender style, 细胞分裂过程...",
  "size": "1024x1024"
}
```

### GET /api/health

健康检查

**响应：**
```json
{
  "status": "healthy",
  "api_url": "https://api.nanobnana.com/v1/images/generations",
  "has_api_key": true
}
```

## 在前端使用

在前端插件中，可以通过以下方式调用：

```javascript
var apiUrl = 'http://localhost:8083/api/generate';

fetch(apiUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    prompt: '细胞分裂过程',
    width: 1024,
    height: 1024
  })
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    // 使用 data.image_url
  }
});
```

## 注意事项

1. 确保 nanobanana API 密钥有效
2. 如果遇到 CORS 问题，检查 API 服务是否正常运行
3. 图像生成可能需要较长时间，请设置合适的超时时间

