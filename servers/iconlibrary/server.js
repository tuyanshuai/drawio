/**
 * 测试 API 服务器
 * 为素材库插件提供测试数据
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const hostname = '127.0.0.1';
const port = 8082;
const dataDir = path.join(__dirname, 'data');
const itemsFilePath = path.join(__dirname, 'items.json');

// 加载所有素材（统一从 items.json 读取）
let allItems = [];
function loadAllItems() {
  try {
    if (fs.existsSync(itemsFilePath)) {
      const content = fs.readFileSync(itemsFilePath, 'utf8');
      allItems = JSON.parse(content);
    } else {
      allItems = [];
    }
  } catch (error) {
    console.error('Failed to load items.json:', error.message);
    allItems = [];
  }
}

// 启动时加载
loadAllItems();

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml',
  '.ico': 'image/x-icon'
};

// 加载科目库信息
function loadLibrary(categoryId) {
  const libraryPath = path.join(dataDir, categoryId, 'library.json');
  try {
    const content = fs.readFileSync(libraryPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to load library for ${categoryId}:`, error.message);
    return null;
  }
}

// 加载科目素材列表（从统一的 items.json 中筛选）
function loadItems(categoryId) {
  // 每次请求时重新加载 items.json 以确保获取最新数据
  loadAllItems();
  return allItems.filter(item => item.categoryId === categoryId);
}

// 获取所有素材库列表
function getLibraries(req, res) {
  // 重新加载 items.json 以确保获取最新数据
  loadAllItems();
  
  const libraries = [];
  
  try {
    const categories = fs.readdirSync(dataDir, { withFileTypes: true });
    
    for (const category of categories) {
      if (category.isDirectory()) {
        const library = loadLibrary(category.name);
        if (library) {
          // 更新 itemCount（从最新的 items.json 数据中筛选）
          const items = allItems.filter(item => item.categoryId === category.name);
          library.itemCount = items.length;
          libraries.push(library);
        }
      }
    }
    
    // 按 order 排序
    libraries.sort((a, b) => (a.order || 999) - (b.order || 999));
  } catch (error) {
    console.error('Failed to load libraries:', error.message);
  }
  
  const response = {
    success: true,
    data: libraries,
    timestamp: new Date().toISOString()
  };
  
  res.writeHead(200, { 
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key'
  });
  res.end(JSON.stringify(response, null, 2));
}

// 获取分类素材
function getCategoryItems(req, res, categoryId) {
  const items = loadItems(categoryId);
  
  const response = {
    success: true,
    data: {
      categoryId: categoryId,
      version: '1.0.0',
      items: items,
      pagination: {
        page: 1,
        pageSize: 100,
        total: items.length,
        totalPages: 1
      }
    },
    timestamp: new Date().toISOString()
  };
  
  res.writeHead(200, { 
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key'
  });
  res.end(JSON.stringify(response, null, 2));
}

// 处理 CORS 预检请求
function handleOptions(req, res) {
  res.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key'
  });
  res.end();
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  console.log(`Request: ${req.method} ${pathname}`);
  
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    handleOptions(req, res);
    return;
  }
  
  // API 路由
  if (pathname === '/api/material-libraries') {
    if (req.method === 'GET') {
      getLibraries(req, res);
      return;
    }
  } else if (pathname.startsWith('/api/material-libraries/') && pathname.endsWith('/items')) {
    if (req.method === 'GET') {
      const match = pathname.match(/\/api\/material-libraries\/([^\/]+)\/items/);
      if (match) {
        getCategoryItems(req, res, match[1]);
        return;
      }
    }
  }
  
  // 提供测试素材文件
  if (pathname.startsWith('/api/test-materials/')) {
    const fileName = pathname.replace('/api/test-materials/', '');
    const filePath = path.join(__dirname, '..', 'drawio', 'src', 'main', 'webapp', 'api', 'test-materials', fileName);
    
    fs.readFile(filePath, (error, content) => {
      if (error) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File not found');
      } else {
        const extname = String(path.extname(filePath)).toLowerCase();
        const contentType = mimeTypes[extname] || 'application/octet-stream';
        res.writeHead(200, { 
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*'
        });
        res.end(content);
      }
    });
    return;
  }
  
  // 静态文件服务
  let filePath = path.join(__dirname, '..', 'drawio', 'src', 'main', 'webapp', pathname);
  
  // Default to index.html
  if (filePath.endsWith('/') || filePath.endsWith('\\')) {
    filePath += 'index.html';
  }
  
  // If file doesn't exist, try with .html extension
  if (!fs.existsSync(filePath)) {
    if (!filePath.endsWith('.html') && !path.extname(filePath)) {
      filePath += '.html';
    }
  }
  
  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';
  
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // File not found
        fs.readFile(path.join(__dirname, '..', 'drawio', 'src', 'main', 'webapp', 'index.html'), (error, content) => {
          if (error) {
            res.writeHead(500);
            res.end(`Server Error: ${error.code}`);
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content, 'utf-8');
          }
        });
      } else {
        // Server error
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      // Success
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
  console.log(`API endpoint: http://${hostname}:${port}/api/material-libraries`);
  console.log(`Data directory: ${dataDir}`);
  console.log(`Items file: ${itemsFilePath} (${allItems.length} items)`);
});
