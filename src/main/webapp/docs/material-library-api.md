# 素材库 API 接口文档

## 概述

本文档定义了素材库 API 的接口规范，用于从服务器动态加载 SVG 和 XML stencil 格式的素材。

## 基础配置

### API 基础 URL

API 的基础 URL 需要在插件配置中指定，例如：
- 开发环境：`http://localhost:8080/api`
- 生产环境：`https://api.example.com/api`

### 认证

支持通过请求头传递认证信息：

```
Authorization: Bearer {token}
```

或者通过配置 API Key：

```
X-API-Key: {api_key}
```

## API 接口

### 1. 获取素材库列表

获取所有可用的素材库分类。

**请求**

```
GET /api/material-libraries
```

**请求头**

```
Content-Type: application/json
Authorization: Bearer {token}  // 可选
X-API-Key: {api_key}           // 可选
```

**响应**

```json
{
  "success": true,
  "data": [
    {
      "id": "biology",
      "title": "生物学",
      "description": "生物学相关素材",
      "icon": "https://example.com/icons/biology.png",
      "order": 1,
      "preload": true,
      "version": "1.0.0",
      "itemCount": 50
    },
    {
      "id": "chemistry",
      "title": "化学",
      "description": "化学相关素材",
      "icon": "https://example.com/icons/chemistry.png",
      "order": 2,
      "preload": false,
      "version": "1.0.0",
      "itemCount": 30
    }
  ],
  "timestamp": "2024-01-01T00:00:00Z"
}
```

**响应字段说明**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| success | boolean | 是 | 请求是否成功 |
| data | array | 是 | 素材库分类列表 |
| data[].id | string | 是 | 分类唯一标识符 |
| data[].title | string | 是 | 分类显示名称 |
| data[].description | string | 否 | 分类描述 |
| data[].icon | string | 否 | 分类图标 URL |
| data[].order | number | 否 | 排序顺序，数字越小越靠前 |
| data[].preload | boolean | 否 | 是否预加载，默认 false |
| data[].version | string | 否 | 版本号，用于缓存失效 |
| data[].itemCount | number | 否 | 该分类下的素材数量 |
| timestamp | string | 是 | 响应时间戳 |

**错误响应**

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述"
  }
}
```

### 2. 获取分类素材

获取指定分类下的所有素材项。

**请求**

```
GET /api/material-libraries/{categoryId}/items
```

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| categoryId | string | 是 | 分类 ID |

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| version | string | 否 | 版本号，用于缓存验证 |
| page | number | 否 | 页码，从 1 开始，默认 1 |
| pageSize | number | 否 | 每页数量，默认 100 |

**请求头**

```
Content-Type: application/json
Authorization: Bearer {token}  // 可选
X-API-Key: {api_key}           // 可选
```

**响应**

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
        "description": "基本细胞结构",
        "type": "svg",
        "format": "svg",
        "data": "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0MCIgZmlsbD0iI2ZmZmZmZiIgc3Ryb2tlPSIjMDAwIiBzdHJva2Utd2lkdGg9IjIiLz4KPC9zdmc+",
        "url": "https://example.com/materials/cell_001.svg",
        "width": 100,
        "height": 100,
        "tags": ["细胞", "生物学", "基础"],
        "thumbnail": "https://example.com/thumbnails/cell_001.png"
      },
      {
        "id": "nucleus_001",
        "title": "细胞核",
        "description": "细胞核结构",
        "type": "svg",
        "format": "svg",
        "data": null,
        "url": "https://example.com/materials/nucleus_001.svg",
        "width": 80,
        "height": 80,
        "tags": ["细胞核", "细胞", "生物学"],
        "thumbnail": "https://example.com/thumbnails/nucleus_001.png"
      },
      {
        "id": "dna_stencil",
        "title": "DNA 双螺旋",
        "description": "DNA 分子结构 stencil",
        "type": "xml",
        "format": "stencil",
        "data": null,
        "url": "https://example.com/materials/dna_stencil.xml",
        "width": 200,
        "height": 300,
        "tags": ["DNA", "遗传", "分子"],
        "thumbnail": null
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 100,
      "total": 50,
      "totalPages": 1
    }
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

**响应字段说明**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| success | boolean | 是 | 请求是否成功 |
| data | object | 是 | 素材数据 |
| data.categoryId | string | 是 | 分类 ID |
| data.version | string | 是 | 版本号 |
| data.items | array | 是 | 素材项列表 |
| data.items[].id | string | 是 | 素材唯一标识符 |
| data.items[].title | string | 是 | 素材显示名称 |
| data.items[].description | string | 否 | 素材描述 |
| data.items[].type | string | 是 | 素材类型：`svg` 或 `xml` |
| data.items[].format | string | 是 | 素材格式：`svg` 或 `stencil` |
| data.items[].data | string\|null | 否 | 素材数据（base64 编码的 SVG 或 XML），如果提供则直接使用，否则使用 url |
| data.items[].url | string | 是 | 素材 URL（如果 data 为空则必须提供） |
| data.items[].width | number | 是 | 素材宽度（像素） |
| data.items[].height | number | 是 | 素材高度（像素） |
| data.items[].tags | array | 否 | 标签数组，用于搜索 |
| data.items[].thumbnail | string\|null | 否 | 缩略图 URL |
| data.pagination | object | 否 | 分页信息 |
| data.pagination.page | number | 是 | 当前页码 |
| data.pagination.pageSize | number | 是 | 每页数量 |
| data.pagination.total | number | 是 | 总数量 |
| data.pagination.totalPages | number | 是 | 总页数 |
| timestamp | string | 是 | 响应时间戳 |

**素材类型说明**

1. **SVG 格式** (`type: "svg"`, `format: "svg"`)
   - `data` 字段包含 base64 编码的 SVG 数据 URI（格式：`data:image/svg+xml;base64,{base64_data}`）
   - 或者提供 `url` 字段，指向 SVG 文件 URL
   - 直接插入到画布中作为图片

2. **XML Stencil 格式** (`type: "xml"`, `format: "stencil"`)
   - `data` 字段包含 base64 编码的 XML stencil 数据
   - 或者提供 `url` 字段，指向 XML stencil 文件 URL
   - 需要符合 draw.io stencil XML 格式规范
   - 使用 `mxStencilRegistry.loadStencilSet` 加载

**错误响应**

```json
{
  "success": false,
  "error": {
    "code": "CATEGORY_NOT_FOUND",
    "message": "分类不存在"
  }
}
```

## 缓存机制

客户端使用以下缓存策略：

1. **缓存键格式**：`material_lib_{categoryId}_{version}`
2. **缓存位置**：浏览器 localStorage
3. **缓存失效**：
   - 版本号变化时自动失效
   - 手动清除缓存
   - 缓存过期（可选，通过配置设置）

## 错误码

| 错误码 | HTTP 状态码 | 说明 |
|--------|------------|------|
| INVALID_REQUEST | 400 | 请求参数错误 |
| UNAUTHORIZED | 401 | 未授权 |
| CATEGORY_NOT_FOUND | 404 | 分类不存在 |
| MATERIAL_NOT_FOUND | 404 | 素材不存在 |
| INTERNAL_ERROR | 500 | 服务器内部错误 |

## 示例

### 获取素材库列表

```bash
curl -X GET "https://api.example.com/api/material-libraries" \
  -H "Authorization: Bearer {token}"
```

### 获取分类素材

```bash
curl -X GET "https://api.example.com/api/material-libraries/biology/items" \
  -H "Authorization: Bearer {token}"
```

### 带分页的请求

```bash
curl -X GET "https://api.example.com/api/material-libraries/biology/items?page=1&pageSize=20" \
  -H "Authorization: Bearer {token}"
```

## 注意事项

1. SVG 数据 URI 格式必须正确，支持 base64 编码
2. XML stencil 必须符合 draw.io stencil XML 格式规范
3. 建议提供缩略图以提升用户体验
4. 如果素材较大，建议使用 URL 而不是直接嵌入 data 字段
5. tags 字段用于搜索功能，建议提供多个相关标签
6. width 和 height 用于侧边栏预览，建议提供准确尺寸

