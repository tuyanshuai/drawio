# 前端动态加载配置说明

## 概述

素材库 API 插件已配置为自动加载。插件会在页面加载时自动检测并加载，同时支持通过 URL 参数进行配置。

## 自动加载

插件已添加到插件列表中，会在以下情况自动加载：

1. **默认情况**：当 URL 包含 `all=1` 参数或没有指定插件参数时
2. **通过 preload.js**：页面加载前会自动配置插件

## URL 参数配置

### 配置 API URL

通过 URL 参数设置 API 基础地址：

```
http://localhost:8089/?materialApiUrl=http://127.0.0.1:8089/api
```

或使用简写：

```
http://localhost:8089/?apiUrl=http://127.0.0.1:8089/api
```

### 配置认证 Token

```
http://localhost:8089/?materialApiToken=your-token-here
```

或使用简写：

```
http://localhost:8089/?apiToken=your-token-here
```

### 配置 API Key

```
http://localhost:8089/?materialApiKey=your-api-key-here
```

或使用简写：

```
http://localhost:8089/?apiKey=your-api-key-here
```

### 组合使用

```
http://localhost:8089/?all=1&materialApiUrl=http://127.0.0.1:8089/api&materialApiToken=your-token
```

## 浏览器控制台配置

也可以在浏览器控制台（F12）中动态设置：

```javascript
// 设置 API URL
window.MATERIAL_LIBRARY_API_URL = 'http://127.0.0.1:8089/api';

// 设置 Token
window.MATERIAL_LIBRARY_API_TOKEN = 'your-token';

// 设置 API Key
window.MATERIAL_LIBRARY_API_KEY = 'your-api-key';

// 然后刷新页面或重新加载插件
window.location.reload();
```

## 默认配置

如果不设置任何参数，插件会使用以下默认值：

- **API URL**: `window.location.origin + "/api"`
  - 例如：`http://localhost:8089/api`

## 测试示例

### 使用本地测试服务器

```
http://localhost:8089/?all=1&materialApiUrl=http://127.0.0.1:8089/api
```

### 使用生产环境

```
http://localhost:8089/?all=1&materialApiUrl=https://api.example.com/api&materialApiToken=production-token
```

## 注意事项

1. URL 参数中的值会被自动 URL 解码
2. 如果同时设置了 `materialApiToken` 和 `materialApiKey`，Token 优先级更高
3. 配置在页面加载前生效，确保插件能正确初始化
4. 修改配置后需要刷新页面才能生效

## 调试

打开浏览器控制台（F12），查看插件加载情况：

```javascript
// 查看当前配置
console.log('API URL:', window.MATERIAL_LIBRARY_API_URL);
console.log('API Token:', window.MATERIAL_LIBRARY_API_TOKEN);
console.log('API Key:', window.MATERIAL_LIBRARY_API_KEY);

// 查看插件对象（如果已加载）
console.log('Plugin:', window.materialLibraryApi);
```

