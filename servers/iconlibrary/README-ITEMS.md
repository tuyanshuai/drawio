# Items.json 更新说明

## 当前结构

- **统一的 items.json**: 位于项目根目录，包含所有科目的素材
- **data 目录**: 每个科目目录只包含 `library.json` 和 `icons/` 目录
- **update-items.js**: 更新脚本，用于根据 data 目录内容更新 items.json

## 使用方式

### 方式 1: 如果 data 目录下有 items.json
如果某个科目目录下存在 `items.json`，运行脚本会自动读取并合并到统一的 `items.json`：

```bash
node update-items.js
```

### 方式 2: 直接编辑统一的 items.json
可以直接编辑根目录下的 `items.json` 文件，添加、修改或删除素材。每个素材必须包含 `categoryId` 字段来标识所属科目。

### 方式 3: 从统一 items.json 反向生成各科目 items.json
如果需要，可以临时创建各科目目录下的 `items.json`，脚本会自动读取并更新。

## 注意事项

- 统一 `items.json` 中的每个素材必须包含 `categoryId` 字段
- 运行 `update-items.js` 时，如果某个科目目录下没有 `items.json`，会保留统一 `items.json` 中该科目的现有数据
- 服务器会从统一的 `items.json` 读取所有素材数据

