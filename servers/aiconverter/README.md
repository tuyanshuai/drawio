# AI Converter 后端服务

使用 SAM (Segment Anything Model) 进行图像分割，返回多边形数据的 Python 后端服务。

## 功能特性

- 接收图片上传
- 使用 SAM 进行自动图像分割
- 返回包含多个多边形（带填充颜色）的 JSON 数据
- 支持自定义分割阈值和最小区域面积过滤

## 快速修复环境（推荐）

如果遇到 `Could not infer dtype of numpy.uint8` 或其他兼容性错误，可以使用自动修复脚本：

### Windows 用户

**方法 1：使用批处理脚本（推荐）**
```cmd
fix_environment.bat
```

**方法 2：使用 PowerShell**
```powershell
.\fix_environment.ps1
```

### 所有平台

使用 Python 脚本（交互式）：
```bash
python fix_environment.py
```

修复脚本会自动：
- 检查当前环境
- 卸载可能冲突的旧版本包
- 安装兼容的 NumPy (1.26.4) 和 PyTorch (2.1.2) 版本
- 安装所有必需的依赖
- 测试关键功能是否正常

## 安装依赖

### 1. 安装 Python 依赖

```bash
pip install -r requirements.txt
```

### 2. 安装 SAM

SAM 需要从 GitHub 安装：

```bash
pip install git+https://github.com/facebookresearch/segment-anything.git
```

### 3. 下载 SAM 模型文件

选择一个模型文件下载（推荐使用 ViT-H 以获得最佳效果）：

- **ViT-H (推荐)**: https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth
- **ViT-L**: https://dl.fbaipublicfiles.com/segment_anything/sam_vit_l_0b3195.pth
- **ViT-B (最小)**: https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth

下载后将模型文件保存到 `checkpoints` 目录中：

```
aiconverter/
  ├── checkpoints/
  │   └── sam_vit_h_4b8939.pth  (或其他模型文件)
  ├── app.py
  └── ...
```

### 4. GPU 支持（可选）

如果需要使用 GPU 加速，请安装 CUDA 版本的 PyTorch：

访问 https://pytorch.org/get-started/locally/ 获取适合您系统的安装命令。

## 运行服务

```bash
python app.py
```

服务将在 `http://127.0.0.1:8081` 启动。

## API 接口

### 1. 健康检查

```
GET /health
```

返回服务状态和 SAM 模型加载状态。

### 2. 图像分割

```
POST /api/segment
```

**请求参数：**
- `file`: 图片文件（multipart/form-data）
- `threshold`: 分割阈值 (0-1，默认 0.5)
- `min_area`: 最小区域面积，小于此面积的区域会被过滤（默认 100）

**响应示例：**

```json
{
  "success": true,
  "image_size": {
    "width": 800,
    "height": 600
  },
  "segments": [
    {
      "id": 0,
      "points": [[100, 50], [200, 50], [200, 150], [100, 150]],
      "fill": {
        "color": "rgb(128, 128, 128)",
        "rgb": [128, 128, 128]
      },
      "area": 10000,
      "confidence": 0.95,
      "bbox": [100, 50, 200, 150]
    }
  ],
  "segment_count": 1,
  "parameters": {
    "threshold": 0.5,
    "min_area": 100
  }
}
```

## 使用示例

### 使用 curl

```bash
curl -X POST "http://127.0.0.1:8081/api/segment?threshold=0.5&min_area=100" \
  -F "file=@your_image.jpg"
```

### 使用 Python

```python
import requests

url = "http://127.0.0.1:8081/api/segment"
files = {"file": open("your_image.jpg", "rb")}
params = {"threshold": 0.5, "min_area": 100}

response = requests.post(url, files=files, params=params)
result = response.json()

print(f"找到 {result['segment_count']} 个分割区域")
for segment in result['segments']:
    print(f"区域 {segment['id']}: {len(segment['points'])} 个点")
```

### 使用 JavaScript (fetch)

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('http://127.0.0.1:8081/api/segment?threshold=0.5&min_area=100', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(`找到 ${result.segment_count} 个分割区域`);
```

## 配置说明

### 修改模型类型

在 `sam_processor.py` 中修改 `SAMProcessor` 的初始化参数：

```python
sam_processor = SAMProcessor(model_type="vit_h")  # vit_h, vit_l, 或 vit_b
```

### 修改服务端口

在 `app.py` 中修改：

```python
uvicorn.run(
    "app:app",
    host="127.0.0.1",
    port=8081,  # 修改这里
    ...
)
```

## 注意事项

1. 首次运行需要下载 SAM 模型文件，文件较大（几百MB到几GB）
2. 如果使用 CPU，处理速度可能较慢，建议使用 GPU 加速
3. 模型加载需要一些时间，请耐心等待启动完成
4. 大图片的处理时间会较长，建议对图片进行适当压缩

## 故障排除

### "Could not infer dtype of numpy.uint8" 错误

这是 NumPy 和 PyTorch 版本兼容性问题。解决方法：

1. **使用自动修复脚本（推荐）**
   ```bash
   # Windows
   fix_environment.bat
   
   # 或运行 Python 脚本
   python fix_environment.py
   ```

2. **手动修复**
   ```bash
   pip uninstall numpy torch torchvision
   pip install numpy==1.26.4
   pip install torch==2.1.2 torchvision==0.16.2
   ```

3. **如果上述版本不兼容，尝试其他版本组合**：
   ```bash
   pip install numpy==1.26.4
   pip install torch==2.3.0 torchvision==0.18.0
   ```

### SAM 模型加载失败

- 检查模型文件是否已下载并放置在正确位置
- 检查文件路径和文件名是否正确

### 依赖安装失败

- 确保 Python 版本 >= 3.8
- 对于 Windows 用户，可能需要安装 Visual C++ 构建工具
- 如果 pip 安装失败，尝试使用 `pip install --upgrade pip` 升级 pip

### GPU 不可用

- 检查是否正确安装了 CUDA 版本的 PyTorch
- 运行 `python -c "import torch; print(torch.cuda.is_available())"` 检查 CUDA 是否可用
- CPU 版本也可以运行，只是速度较慢

