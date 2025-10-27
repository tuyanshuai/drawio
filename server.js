const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8081;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  console.log(`Request received: ${req.url}`);
  
  let filePath = '.' + req.url;
  if (filePath === './') {
    filePath = './src/main/webapp/index.html';
  } else if (filePath.startsWith('./test-3d-rectangle.html')) {
    filePath = './src/main/webapp/test-3d-rectangle.html';
  } else if (filePath.startsWith('./mxgraph/')) {
    filePath = './src/main/webapp/' + filePath.substring(2);
  } else if (filePath.startsWith('./js/')) {
    filePath = './src/main/webapp/' + filePath.substring(2);
  } else if (filePath.startsWith('./images/')) {
    filePath = './src/main/webapp/' + filePath.substring(2);
  }
  
  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';
  
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        console.log(`File not found: ${filePath}`);
        res.writeHead(404);
        res.end('404 Not Found');
      } else {
        console.log(`Server error: ${error.code}`);
        res.writeHead(500);
        res.end('500 Internal Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`Test 3D Rectangle at http://localhost:${PORT}/test-3d-rectangle.html`);
});