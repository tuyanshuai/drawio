/**
 * 测试 API 服务器
 * 为素材库插件提供测试数据
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const hostname = '127.0.0.1';
const port = 8089;

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

// 测试数据
const testLibraries = [
  {
    id: 'biology',
    title: '生物学',
    description: '生物学相关素材',
    icon: null,
    order: 1,
    preload: true,
    version: '1.0.0',
    itemCount: 3
  },
  {
    id: 'chemistry',
    title: '化学',
    description: '化学相关素材',
    icon: null,
    order: 2,
    preload: false,
    version: '1.0.0',
    itemCount: 2
  },
  {
    id: 'geometry',
    title: '几何图形',
    description: '基础几何图形素材',
    icon: null,
    order: 3,
    preload: false,
    version: '1.0.0',
    itemCount: 2
  }
];

// 获取素材库列表
function getLibraries(req, res) {
  const response = {
    success: true,
    data: testLibraries,
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
  let items = [];
  
  if (categoryId === 'biology') {
    items = [
      {
        id: 'cell_001',
        title: '细胞',
        description: '基本细胞结构',
        type: 'svg',
        format: 'svg',
        data: 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" fill="#ffffff" stroke="#000000" stroke-width="2"/><circle cx="50" cy="50" r="20" fill="#e0e0e0" stroke="#000000" stroke-width="1"/></svg>').toString('base64'),
        url: null,
        width: 100,
        height: 100,
        tags: ['细胞', '生物学', '基础'],
        thumbnail: null
      },
      {
        id: 'nucleus_001',
        title: '细胞核',
        description: '细胞核结构',
        type: 'svg',
        format: 'svg',
        data: null,
        url: '/api/test-materials/nucleus.svg',
        width: 80,
        height: 80,
        tags: ['细胞核', '细胞', '生物学'],
        thumbnail: null
      },
      {
        id: 'dna_molecule',
        title: 'DNA 分子',
        description: 'DNA 双螺旋结构',
        type: 'svg',
        format: 'svg',
        data: null,
        url: '/api/test-materials/dna.svg',
        width: 150,
        height: 200,
        tags: ['DNA', '遗传', '分子', '双螺旋'],
        thumbnail: null
      }
    ];
  } else if (categoryId === 'chemistry') {
    items = [
      {
        id: 'molecule_001',
        title: '水分子',
        description: 'H2O 水分子结构',
        type: 'svg',
        format: 'svg',
        data: null,
        url: '/api/test-materials/water.svg',
        width: 120,
        height: 100,
        tags: ['水', '分子', '化学', 'H2O'],
        thumbnail: null
      },
      {
        id: 'beaker',
        title: '烧杯',
        description: '实验室烧杯',
        type: 'xml',
        format: 'stencil',
        data: null,
        url: '/api/test-materials/beaker.xml',
        width: 100,
        height: 150,
        tags: ['烧杯', '实验设备', '化学'],
        thumbnail: null
      }
    ];
  } else if (categoryId === 'geometry') {
    items = [
      {
        id: 'square',
        title: '正方形',
        description: '基础正方形',
        type: 'svg',
        format: 'svg',
        data: 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect x="10" y="10" width="80" height="80" fill="#4A90E2" stroke="#000000" stroke-width="2"/></svg>').toString('base64'),
        url: null,
        width: 100,
        height: 100,
        tags: ['正方形', '几何', '基础'],
        thumbnail: null
      },
      {
        id: 'circle',
        title: '圆形',
        description: '基础圆形',
        type: 'svg',
        format: 'svg',
        data: 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" fill="#E94B3C" stroke="#000000" stroke-width="2"/></svg>').toString('base64'),
        url: null,
        width: 100,
        height: 100,
        tags: ['圆形', '几何', '基础'],
        thumbnail: null
      },
      {
        id: 'shapes_stencil',
        title: '几何图形集',
        description: '包含多种几何图形的 stencil',
        type: 'xml',
        format: 'stencil',
        data: null,
        url: '/api/test-materials/shapes.xml',
        width: 200,
        height: 200,
        tags: ['几何', '图形', 'stencil'],
        thumbnail: null
      }
    ];
  } else {
    items = [];
  }
  
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
    const filePath = path.join(__dirname, 'src', 'main', 'webapp', 'api', 'test-materials', fileName);
    
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
  let filePath = path.join(__dirname, 'src', 'main', 'webapp', pathname);
  
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
        fs.readFile(path.join(__dirname, 'src', 'main', 'webapp', 'index.html'), (error, content) => {
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
});
