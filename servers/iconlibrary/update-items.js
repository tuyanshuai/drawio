/**
 * 根据 data 目录内的内容更新 items.json
 * 如果科目目录下没有 items.json，会根据 library.json 和图标自动生成默认数据
 */

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
const outputPath = path.join(__dirname, 'items.json');

function svgToDataUri(svgPath) {
  try {
    const svgContent = fs.readFileSync(svgPath, 'utf8');
    const base64 = Buffer.from(svgContent).toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
  } catch (error) {
    return null;
  }
}

function getRandomIcon(categoryDir) {
  const iconsDir = path.join(categoryDir, 'icons');
  if (!fs.existsSync(iconsDir)) {
    return null;
  }
  
  const files = fs.readdirSync(iconsDir).filter(f => f.endsWith('.svg'));
  if (files.length === 0) {
    return null;
  }
  
  // 返回第一个图标（不是随机的，保持一致性）
  const firstFile = files.sort()[0];
  const svgPath = path.join(iconsDir, firstFile);
  return svgToDataUri(svgPath);
}

function generateDefaultItems(categoryId, categoryName, categoryPath) {
  const icon = getRandomIcon(categoryPath);
  const items = [];
  
  // 根据科目生成默认素材
  switch(categoryId) {
    case 'biology':
      items.push(
        {
          id: 'cell_001',
          title: '细胞',
          description: '基本细胞结构',
          type: 'svg',
          format: 'svg',
          data: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0MCIgZmlsbD0iI2ZmZmZmZiIgc3Ryb2tlPSIjMDAwMDAwIiBzdHJva2Utd2lkdGg9IjIiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSIyMCIgZmlsbD0iI2UwZTBlMCIgc3Ryb2tlPSIjMDAwMDAwIiBzdHJva2Utd2lkdGg9IjEiLz48L3N2Zz4=',
          url: null,
          width: 100,
          height: 100,
          tags: ['细胞', '生物学', '基础'],
          thumbnail: null,
          icon: icon,
          categoryId: categoryId
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
          thumbnail: null,
          icon: icon,
          categoryId: categoryId
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
          thumbnail: null,
          icon: icon,
          categoryId: categoryId
        }
      );
      break;
      
    case 'chemistry':
      items.push(
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
          thumbnail: null,
          icon: icon,
          categoryId: categoryId
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
          thumbnail: null,
          icon: icon,
          categoryId: categoryId
        }
      );
      break;
      
    case 'geometry':
      items.push(
        {
          id: 'square',
          title: '正方形',
          description: '基础正方形',
          type: 'svg',
          format: 'svg',
          data: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB4PSIxMCIgeT0iMTAiIHdpZHRoPSI4MCIgaGVpZ2h0PSI4MCIgZmlsbD0iIzRBOTBFMiIgc3Ryb2tlPSIjMDAwMDAwIiBzdHJva2Utd2lkdGg9IjIiLz48L3N2Zz4=',
          url: null,
          width: 100,
          height: 100,
          tags: ['正方形', '几何', '基础'],
          thumbnail: null,
          icon: icon,
          categoryId: categoryId
        },
        {
          id: 'circle',
          title: '圆形',
          description: '基础圆形',
          type: 'svg',
          format: 'svg',
          data: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0MCIgZmlsbD0iI0U5NEIzQyIgc3Ryb2tlPSIjMDAwMDAwIiBzdHJva2Utd2lkdGg9IjIiLz48L3N2Zz4=',
          url: null,
          width: 100,
          height: 100,
          tags: ['圆形', '几何', '基础'],
          thumbnail: null,
          icon: icon,
          categoryId: categoryId
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
          thumbnail: null,
          icon: icon,
          categoryId: categoryId
        }
      );
      break;
      
    case 'mathematics':
      items.push(
        {
          id: 'pi_symbol',
          title: 'π 符号',
          description: '圆周率符号',
          type: 'svg',
          format: 'svg',
          data: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48dGV4dCB4PSI1MCIgeT0iNjAiIGZvbnQtc2l6ZT0iNjAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZmlsbD0iIzlDMjdCMCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+7o08L3RleHQ+PC9zdmc+',
          url: null,
          width: 100,
          height: 100,
          tags: ['π', '数学', '符号', '常数'],
          thumbnail: null,
          icon: icon,
          categoryId: categoryId
        },
        {
          id: 'infinity_symbol',
          title: '∞ 符号',
          description: '无穷大符号',
          type: 'svg',
          format: 'svg',
          data: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cGF0aCBkPSJNNDAgNTBDMzAgNDAgMzAgNjAgNDAgNTBMMTYgNTBjLTYgMC02IDIwIDAgMjBsMjQgMGMyMCAwIDIwLTIwIDAtMjBaIiBmaWxsPSJub25lIiBzdHJva2U9IiM5QzI3QjAiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PC9zdmc+',
          url: null,
          width: 100,
          height: 100,
          tags: ['∞', '无穷', '数学', '符号'],
          thumbnail: null,
          icon: icon,
          categoryId: categoryId
        },
        {
          id: 'sigma_symbol',
          title: 'Σ 符号',
          description: '求和符号',
          type: 'svg',
          format: 'svg',
          data: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48dGV4dCB4PSI1MCIgeT0iNjAiIGZvbnQtc2l6ZT0iNjAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZmlsbD0iIzlDMjdCMCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+7oE8L3RleHQ+PC9zdmc+',
          url: null,
          width: 100,
          height: 100,
          tags: ['Σ', '求和', '数学', '符号'],
          thumbnail: null,
          icon: icon,
          categoryId: categoryId
        }
      );
      break;
      
    case 'physics':
      items.push(
        {
          id: 'atom_model',
          title: '原子模型',
          description: '原子结构模型',
          type: 'svg',
          format: 'svg',
          data: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMDBCQ0Q0IiBzdHJva2Utd2lkdGg9IjIiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSIyMCIgZmlsbD0iIzAwQkNENCIgb3BhY2l0eT0iMC41Ii8+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNSIgZmlsbD0iIzAwQkNENCIvPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjQiIGZpbGw9IiMwMEJDRDQiLz48Y2lyY2xlIGN4PSI4MCIgY3k9IjgwIiByPSI0IiBmaWxsPSIjMDBCQ0Q0Ii8+PC9zdmc+',
          url: null,
          width: 100,
          height: 100,
          tags: ['原子', '物理', '模型', '结构'],
          thumbnail: null,
          icon: icon,
          categoryId: categoryId
        },
        {
          id: 'wave_form',
          title: '波形',
          description: '正弦波形',
          type: 'svg',
          format: 'svg',
          data: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cGF0aCBkPSJNMTAgNTBMMjAgMzAgMzAgNTAgNDAgMzAgNTAgNTAgNjAgMzAgNzAgNTAgODAgMzAgOTAgNTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzAwQkNENCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48L3N2Zz4=',
          url: null,
          width: 100,
          height: 100,
          tags: ['波形', '正弦波', '物理', '振动'],
          thumbnail: null,
          icon: icon,
          categoryId: categoryId
        }
      );
      break;
      
    case 'technology':
      items.push(
        {
          id: 'computer_icon',
          title: '电脑图标',
          description: '计算机图标',
          type: 'svg',
          format: 'svg',
          data: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB4PSIyMCIgeT0iMTUiIHdpZHRoPSI2MCIgaGVpZ2h0PSI0MCIgZmlsbD0iIzYwN0Q4QiIgc3Ryb2tlPSIjNDU1QTZUIiBzdHJva2Utd2lkdGg9IjIiIHJ4PSIyIi8+PHJlY3QgeD0iMjUiIHk9IjIwIiB3aWR0aD0iNTAiIGhlaWdodD0iMzAiIGZpbGw9IiNFRUYxRjEiLz48cmVjdCB4PSIzMCIgeT0iNjAiIHdpZHRoPSI0MCIgaGVpZ2h0PSI1IiBmaWxsPSIjNjA3RDhCIiByeD0iMiIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iNzAiIHI9IjIiIGZpbGw9IiM2MDdEOEIiLz48L3N2Zz4=',
          url: null,
          width: 100,
          height: 100,
          tags: ['电脑', '计算机', '科技', '设备'],
          thumbnail: null,
          icon: icon,
          categoryId: categoryId
        },
        {
          id: 'circuit_board',
          title: '电路板',
          description: '电子电路板',
          type: 'svg',
          format: 'svg',
          data: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB4PSIxMCIgeT0iMTAiIHdpZHRoPSI4MCIgaGVpZ2h0PSI4MCIgZmlsbD0iIzQ1NUE2NCIgc3Ryb2tlPSIjNjA3RDhCIiBzdHJva2Utd2lkdGg9IjIiLz48cmVjdCB4PSIyMCIgeT0iMjAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzYwN0Q4QiIvPjxjaXJjbGUgY3g9IjMwIiBjeT0iMzAiIHI9IjMiIGZpbGw9IiM2MDdEOEIiLz48bGluZSB4MT0iNDAiIHkxPSI0MCIgeDI9IjYwIiB5Mj0iNjAiIHN0cm9rZT0iIzYwN0Q4QiIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9zdmc+',
          url: null,
          width: 100,
          height: 100,
          tags: ['电路板', '电子', '科技', '硬件'],
          thumbnail: null,
          icon: icon,
          categoryId: categoryId
        }
      );
      break;
      
    case 'engineering':
      items.push(
        {
          id: 'gear_icon',
          title: '齿轮',
          description: '机械齿轮',
          type: 'svg',
          format: 'svg',
          data: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSIzMCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNzk1NTQ4IiBzdHJva2Utd2lkdGg9IjMiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSIxNSIgZmlsbD0iI0ExODg3RCIvPjxwYXRoIGQ9Ik00NSA0MEg1NVY0NUg0NVoiIGZpbGw9IiM3OTU1NDgiLz48cGF0aCBkPSJNNDUgNjBINTVWNjVINDFaIiBmaWxsPSIjNzk1NTQ4Ii8+PHBhdGggZD0iTTYwIDQ1VjU1SDY1VjQ1WiIgZmlsbD0iIzc5NTU0OCIvPjxwYXRoIGQ9Ik00MCA1NVY0NUgzNVY1NVoiIGZpbGw9IiM3OTU1NDgiLz48L3N2Zz4=',
          url: null,
          width: 100,
          height: 100,
          tags: ['齿轮', '机械', '工程', '机械零件'],
          thumbnail: null,
          icon: icon,
          categoryId: categoryId
        },
        {
          id: 'bridge_structure',
          title: '桥梁结构',
          description: '桥梁工程结构',
          type: 'svg',
          format: 'svg',
          data: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB4PSIxMCIgeT0iNjAiIHdpZHRoPSI4MCIgaGVpZ2h0PSI1IiBmaWxsPSIjNzk1NTQ4Ii8+PHJlY3QgeD0iMTUiIHk9IjQwIiB3aWR0aD0iMTAiIGhlaWdodD0iMjAiIGZpbGw9IiNBNTg4N0YiLz48cmVjdCB4PSIzNSIgeT0iNDAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIyMCIgZmlsbD0iI0E1ODg3RiIvPjxyZWN0IHg9IjU1IiB5PSI0MCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjIwIiBmaWxsPSIjQTU4ODdGIi8+PHJlY3QgeD0iNzUiIHk9IjQwIiB3aWR0aD0iMTAiIGhlaWdodD0iMjAiIGZpbGw9IiNBNTg4N0YiLz48L3N2Zz4=',
          url: null,
          width: 100,
          height: 100,
          tags: ['桥梁', '结构', '工程', '建筑'],
          thumbnail: null,
          icon: icon,
          categoryId: categoryId
        }
      );
      break;
      
    case 'astronomy':
      items.push(
        {
          id: 'star_icon',
          title: '星星',
          description: '星星图标',
          type: 'svg',
          format: 'svg',
          data: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cGF0aCBkPSJNNTAgMTBMNTQgMjBIMjBsNC0xMEwyMCAyMEg0Nkw1MCAzMEw1NCAyMEg4MEw1MCAxMFoiIGZpbGw9IiNGRkMxMDciLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI4IiBmaWxsPSIjRkZCQzAwIi8+PC9zdmc+',
          url: null,
          width: 100,
          height: 100,
          tags: ['星星', '天体', '天文学', '星座'],
          thumbnail: null,
          icon: icon,
          categoryId: categoryId
        },
        {
          id: 'planet_icon',
          title: '行星',
          description: '行星图标',
          type: 'svg',
          format: 'svg',
          data: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSIzMCIgZmlsbD0iI0ZGQzEwNyIgb3BhY2l0eT0iMC44Ii8+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iMjUiIGZpbGw9IiNGRkMxMDciLz48Y2lyY2xlIGN4PSI0MCIgY3k9IjQwIiByPSI1IiBmaWxsPSIjRkZCMDAwIiBvcGFjaXR5PSIwLjYiLz48L3N2Zz4=',
          url: null,
          width: 100,
          height: 100,
          tags: ['行星', '天体', '天文学', '太阳系'],
          thumbnail: null,
          icon: icon,
          categoryId: categoryId
        }
      );
      break;
  }
  
  return items;
}

// 先加载现有的 items.json（如果存在）
let allItems = [];
if (fs.existsSync(outputPath)) {
  try {
    const existingContent = fs.readFileSync(outputPath, 'utf8');
    allItems = JSON.parse(existingContent);
    console.log(`✓ 读取现有 items.json: ${allItems.length} 个素材`);
  } catch (error) {
    console.warn(`⚠ 读取现有 items.json 失败，将重新创建:`, error.message);
    allItems = [];
  }
}

// 按 categoryId 分组现有 items
const itemsByCategory = {};
allItems.forEach(item => {
  if (item.categoryId) {
    if (!itemsByCategory[item.categoryId]) {
      itemsByCategory[item.categoryId] = [];
    }
    itemsByCategory[item.categoryId].push(item);
  }
});

// 遍历所有科目目录，更新或添加数据
const categories = fs.readdirSync(dataDir, { withFileTypes: true });
const updatedCategories = new Set();

for (const category of categories) {
  if (category.isDirectory()) {
    const categoryPath = path.join(dataDir, category.name);
    const itemsPath = path.join(categoryPath, 'items.json');
    
    if (fs.existsSync(itemsPath)) {
      try {
        const items = JSON.parse(fs.readFileSync(itemsPath, 'utf8'));
        // 移除该科目旧的 items
        allItems = allItems.filter(item => item.categoryId !== category.name);
        
        // 添加新的 items
        items.forEach(item => {
          const updatedItem = {
            ...item,
            categoryId: category.name
          };
          
          // 如果没有 icon，尝试从科目图标库获取
          if (!updatedItem.icon) {
            updatedItem.icon = getRandomIcon(categoryPath);
          }
          
          allItems.push(updatedItem);
        });
        updatedCategories.add(category.name);
        console.log(`✓ 更新 ${category.name}: ${items.length} 个素材（从 items.json）`);
      } catch (error) {
        console.error(`✗ 处理 ${category.name} 失败:`, error.message);
      }
    } else {
      // 如果没有 items.json，检查是否有现有数据
      const existingCount = itemsByCategory[category.name]?.length || 0;
      if (existingCount > 0) {
        console.log(`→ 保留 ${category.name}: ${existingCount} 个素材（未找到 items.json）`);
      } else {
        // 如果没有现有数据，生成默认数据
        try {
          const libraryPath = path.join(categoryPath, 'library.json');
          if (fs.existsSync(libraryPath)) {
            const library = JSON.parse(fs.readFileSync(libraryPath, 'utf8'));
            const defaultItems = generateDefaultItems(category.name, library.title, categoryPath);
            defaultItems.forEach(item => allItems.push(item));
            console.log(`✓ 生成默认 ${category.name}: ${defaultItems.length} 个素材`);
          }
        } catch (error) {
          console.error(`✗ 生成默认 ${category.name} 失败:`, error.message);
        }
      }
    }
  }
}

// 保存到统一的 items.json
fs.writeFileSync(outputPath, JSON.stringify(allItems, null, 2), 'utf8');
console.log(`\n✓ 更新完成！共 ${allItems.length} 个素材`);
console.log(`✓ 已保存到: ${outputPath}`);

// 统计各科目数量
const categoryCounts = {};
allItems.forEach(item => {
  categoryCounts[item.categoryId] = (categoryCounts[item.categoryId] || 0) + 1;
});

console.log('\n各科目素材数量:');
Object.keys(categoryCounts).sort().forEach(cat => {
  console.log(`  ${cat}: ${categoryCounts[cat]} 个`);
});
