# SAM 模型下载脚本

import os
import urllib.request
from pathlib import Path

def download_model(model_type="vit_b"):
    """下载 SAM 模型文件"""
    models = {
        "vit_h": {
            "url": "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth",
            "filename": "sam_vit_h_4b8939.pth",
            "size": "2.4GB"
        },
        "vit_l": {
            "url": "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_l_0b3195.pth",
            "filename": "sam_vit_l_0b3195.pth",
            "size": "1.2GB"
        },
        "vit_b": {
            "url": "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth",
            "filename": "sam_vit_b_01ec64.pth",
            "size": "375MB"
        }
    }
    
    if model_type not in models:
        print(f"不支持的模型类型: {model_type}")
        return False
    
    model_info = models[model_type]
    checkpoint_dir = Path(__file__).parent / "checkpoints"
    checkpoint_dir.mkdir(exist_ok=True)
    filepath = checkpoint_dir / model_info["filename"]
    
    if filepath.exists():
        print(f"模型文件已存在: {filepath}")
        return True
    
    print(f"开始下载 {model_type} 模型 ({model_info['size']})...")
    print(f"URL: {model_info['url']}")
    print(f"保存到: {filepath}")
    print("这可能需要一些时间，请耐心等待...")
    
    try:
        def progress_hook(count, block_size, total_size):
            percent = int(count * block_size * 100 / total_size)
            print(f"\r下载进度: {percent}%", end='', flush=True)
        
        urllib.request.urlretrieve(model_info["url"], filepath, reporthook=progress_hook)
        print(f"\n下载完成: {filepath}")
        return True
    except Exception as e:
        print(f"\n下载失败: {e}")
        print(f"请手动下载: {model_info['url']}")
        print(f"并保存到: {filepath}")
        return False

if __name__ == "__main__":
    import sys
    model_type = sys.argv[1] if len(sys.argv) > 1 else "vit_b"
    download_model(model_type)

