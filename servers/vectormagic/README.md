# Vector Magic - 图片转SVG工具

基于传统机器视觉方法的图片转SVG转换工具，参考Vector Magic的实现思路。

## 功能特性

- 支持JPG、PNG、BMP、GIF等常见位图格式
- 自动边缘检测和轮廓提取
- 智能颜色分割和量化
- 轮廓简化和矢量化
- 生成高质量SVG矢量图

## 安装

```bash
pip install -r requirements.txt
```

## 使用方法

### 命令行使用

```bash
python vectormagic.py input.jpg output.svg
```

### 高级选项

```bash
# 设置细节级别（low, medium, high）
python vectormagic.py input.jpg output.svg --detail high

# 设置颜色模式（unlimited, limited）
python vectormagic.py input.jpg output.svg --colors unlimited

# 设置颜色数量（仅在limited模式下）
python vectormagic.py input.jpg output.svg --colors limited --color-count 16
```

### Python API使用

```python
from vectormagic import VectorMagic

vm = VectorMagic()
svg_content = vm.convert_image('input.jpg', detail='high', colors='unlimited')
with open('output.svg', 'w', encoding='utf-8') as f:
    f.write(svg_content)
```

## 实现原理

1. **图像预处理**：使用高斯模糊、双边滤波等去噪技术
2. **边缘检测**：使用Canny算法检测边缘
3. **颜色分割**：使用K-means聚类或颜色量化进行区域分割
4. **轮廓提取**：使用OpenCV的findContours提取轮廓
5. **轮廓简化**：使用Douglas-Peucker算法简化轮廓
6. **矢量化**：将轮廓转换为SVG路径
7. **SVG生成**：生成完整的SVG文件

## 技术栈

- OpenCV: 图像处理、轮廓提取和颜色量化
- NumPy: 数值计算
- Pillow: 图像读取
- Click: 命令行接口

## 参考

基于 [Vector Magic](https://vectormagic.com/) 的实现思路

