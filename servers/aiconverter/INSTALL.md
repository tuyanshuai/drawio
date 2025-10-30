# SAM 安装指南

由于网络问题可能导致 SAM 无法通过 pip 直接安装，以下是手动安装方法：

## 方法 1: 使用国内镜像（推荐）

```bash
# 使用清华镜像
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple git+https://github.com/facebookresearch/segment-anything.git
```

或者

```bash
# 使用阿里云镜像
pip install -i https://mirrors.aliyun.com/pypi/simple/ git+https://github.com/facebookresearch/segment-anything.git
```

## 方法 2: 手动下载安装

1. 克隆 segment-anything 仓库：
```bash
git clone https://github.com/facebookresearch/segment-anything.git
cd segment-anything
pip install -e .
```

2. 安装依赖：
```bash
pip install opencv-python pycocotools matplotlib onnxruntime onnx
```

## 方法 3: 如果无法访问 GitHub

1. 从 Gitee 或其他镜像站点下载 segment-anything 源码
2. 解压到本地目录
3. 进入目录执行：`pip install -e .`

## 下载模型文件

安装 SAM 后，还需要下载模型文件：

- **ViT-H (推荐，效果最好)**: https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth (2.4GB)
- **ViT-L**: https://dl.fbaipublicfiles.com/segment_anything/sam_vit_l_0b3195.pth (1.2GB)
- **ViT-B (最小)**: https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth (375MB)

下载后保存到 `aiconverter/checkpoints/` 目录。

## 验证安装

运行以下命令验证：

```python
python -c "from segment_anything import sam_model_registry; print('SAM 安装成功!')"
```

