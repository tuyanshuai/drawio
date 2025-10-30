# 测试 API 使用说明

## 启动测试服务器

```bash
node server.js
```

服务器将在 `http://127.0.0.1:8082` 启动。

## API 端点

### 1. 获取素材库列表

```
GET http://127.0.0.1:8082/api/material-libraries
```

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": "biology",
      "title": "生物学",
      "version": "1.0.0",
      "preload": true,
      "order": 1
    }
  ]
}
```

### 2. 获取分类素材

```
GET http://127.0.0.1:8082/api/material-libraries/{categoryId}/items
```

**可用分类：**
- `biology` - 生物学素材
- `chemistry` - 化学素材
- `geometry` - 几何图形素材

**响应示例：**
```json
{
  "success": true,
  "data": {
    "categoryId": "biology",
    "version": "1.0.0",
    "items": [...]
  }
}
```

## 测试素材文件

测试素材文件位于 `src/main/webapp/api/test-materials/` 目录：

- `nucleus.svg` - 细胞核 SVG
- `dna.svg` - DNA 双螺旋 SVG
- `water.svg` - 水分子 SVG
- `beaker.xml` - 烧杯 XML stencil
- `shapes.xml` - 几何图形集 XML stencil

## 配置插件使用测试 API

在浏览器控制台或页面加载前设置：

```javascript
window.MATERIAL_LIBRARY_API_URL = 'http://127.0.0.1:8082/api';
```

## 测试步骤

1. 启动服务器：`node server.js`（在 `servers/iconlibrary` 目录）
2. 打开浏览器访问前端：`http://localhost:8080`
3. 在浏览器控制台设置 API URL（如果需要）：
   ```javascript
   window.MATERIAL_LIBRARY_API_URL = 'http://127.0.0.1:8082/api';
   ```
4. 刷新页面，侧边栏应该会显示"素材库"面板
5. 点击分类展开，查看素材是否正确加载

## 注意事项

- 确保服务器运行在端口 8082
- 如果遇到 CORS 问题，服务器已配置 CORS 头
- 测试数据包含 SVG（内嵌 base64）和外部 URL 两种形式
- XML stencil 文件需要符合 draw.io stencil XML 格式

