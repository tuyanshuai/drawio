const http = require('http');
const fs = require('fs');
const path = require('path');

const hostname = '127.0.0.1';
const port = 8089;  // 修改端口为8089

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
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  console.log(`Request: ${req.url}`);
  
  let filePath = path.join(__dirname, 'src', 'main', 'webapp', req.url);
  
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
});