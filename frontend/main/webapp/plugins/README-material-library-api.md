# 图标库 API 插件使用说明

## 概述

图标库 API 插件 (`material-library-api.js`) 允许 draw.io 从远程 API 动态加载 SVG 和 XML stencil 格式的图标库。

**注意**：此插件创建的调色板名称为"图标库"，以区分原有的"素材库"。

## 功能特性

- ✅ 从 API 动态加载图标库
- ✅ 支持 SVG 和 XML stencil 格式
- ✅ 按需加载（分类展开时加载）
- ✅ 缓存机制（localStorage）
- ✅ 预加载常用分类
- ✅ 分组展示（多级分类）
- ✅ 搜索功能

## 安装配置

### 1. 引入插件

在 `index.html` 或相关配置文件中添加插件脚本：

```html
<script src="plugins/material-library-api.js"></script>
```

### 2. 配置 API

在加载插件之前，设置 API 配置：

```javascript
// 设置 API 基础 URL
window.MATERIAL_LIBRARY_API_URL = 'https://api.example.com/api';

// 设置认证 Token（Bearer Token 方式）
window.MATERIAL_LIBRARY_API_TOKEN = 'your-token-here';

// 或设置 API Key（API Key 方式）
window.MATERIAL_LIBRARY_API_KEY = 'your-api-key-here';
```

### 3. API 接口要求

插件需要实现以下 API 接口：

1. **GET /api/material-libraries** - 获取素材库列表
2. **GET /api/material-libraries/{categoryId}/items** - 获取分类素材

详细的 API 接口规范请参考 `docs/material-library-api.md`。

## 使用方式

1. 插件加载后，侧边栏会自动添加"图标库"面板
2. 点击分类标题展开分类，插件会自动加载该分类的图标
3. 使用搜索框可以搜索图标
4. 拖拽图标到画布即可使用

## 缓存管理

插件使用 localStorage 缓存已加载的图标数据：

- **缓存键格式**：`material_lib_{categoryId}_{version}`
- **缓存位置**：浏览器 localStorage
- **缓存失效**：版本号变化时自动失效

### 清除缓存

可以通过浏览器控制台清除缓存：

```javascript
// 清除所有图标库缓存
window.iconsLibraryApi.cache.clear();

// 清除特定分类的缓存
window.iconsLibraryApi.cache.clear('categoryId');
```

## 调试

插件在浏览器控制台提供了调试工具：

```javascript
// 访问配置
window.iconsLibraryApi.config

// 访问缓存管理器
window.iconsLibraryApi.cache

// 访问 API 客户端
window.iconsLibraryApi.api

// 重新加载图标库
window.iconsLibraryApi.reload()
```

## 注意事项

1. API 接口需要支持 CORS，或者通过代理访问
2. SVG 素材会转换为 data URI 格式
3. XML stencil 需要符合 draw.io stencil XML 格式规范
4. 缓存数据存储在浏览器 localStorage 中，清除浏览器数据会删除缓存

## 故障排除

### 图标无法加载

1. 检查浏览器控制台是否有错误信息
2. 确认 API 配置是否正确
3. 检查网络请求是否成功（打开浏览器开发者工具的 Network 标签）
4. 确认 API 响应格式是否符合规范

### 缓存问题

1. 清除浏览器缓存和 localStorage
2. 检查版本号是否匹配
3. 使用 `window.iconsLibraryApi.cache.clear()` 清除缓存

### 搜索不工作

搜索功能依赖于 draw.io 的搜索系统，确保：
1. 图标已正确添加到搜索索引
2. tags 字段包含搜索关键词

## 示例 API 响应

### 获取图标库列表

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

### 获取分类图标

```json
{
  "success": true,
  "data": {
    "categoryId": "biology",
    "version": "1.0.0",
    "items": [
      {
        "id": "cell_001",
        "title": "细胞",
        "type": "svg",
        "format": "svg",
        "url": "https://example.com/icons/cell.svg",
        "width": 100,
        "height": 100,
        "tags": ["细胞", "生物学"]
      }
    ]
  }
}
```

## 技术支持

如有问题或建议，请参考 API 文档或联系开发团队。

