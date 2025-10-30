"""
SAM (Segment Anything Model) 处理器
负责加载模型和执行图像分割
"""

import numpy as np
from PIL import Image
import cv2
import logging
from typing import List, Dict, Any, Tuple
import os

logger = logging.getLogger(__name__)

class SAMProcessor:
    """SAM 模型处理器"""
    
    def __init__(self, model_type: str = "vit_b", checkpoint_path: str = None):
        """
        初始化 SAM 处理器
        
        参数:
        - model_type: 模型类型 ("vit_h", "vit_l", "vit_b")
        - checkpoint_path: 模型检查点路径，如果为 None 则自动下载
        """
        self.model_type = model_type
        self.checkpoint_path = checkpoint_path or self._get_default_checkpoint_path()
        self.predictor = None
        self._load_model()
    
    def _get_default_checkpoint_path(self) -> str:
        """获取默认的模型检查点路径"""
        # 默认检查点目录
        checkpoint_dir = os.path.join(os.path.dirname(__file__), "checkpoints")
        os.makedirs(checkpoint_dir, exist_ok=True)
        
        # 根据模型类型返回对应的检查点文件名
        checkpoint_files = {
            "vit_h": "sam_vit_h_4b8939.pth",
            "vit_l": "sam_vit_l_0b3195.pth",
            "vit_b": "sam_vit_b_01ec64.pth"
        }
        
        filename = checkpoint_files.get(self.model_type, checkpoint_files["vit_h"])
        return os.path.join(checkpoint_dir, filename)
    
    def _load_model(self):
        """加载 SAM 模型"""
        try:
            # 尝试导入 segment_anything
            try:
                from segment_anything import sam_model_registry, SamAutomaticMaskGenerator
            except ImportError:
                raise ImportError(
                    "segment_anything 未安装。请运行: pip install git+https://github.com/facebookresearch/segment-anything.git"
                )
            
            # 检查检查点文件是否存在
            if not os.path.exists(self.checkpoint_path):
                logger.warning(
                    f"检查点文件不存在: {self.checkpoint_path}\n"
                    f"请从以下链接下载对应的模型文件:\n"
                    f"- ViT-H: https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth\n"
                    f"- ViT-L: https://dl.fbaipublicfiles.com/segment_anything/sam_vit_l_0b3195.pth\n"
                    f"- ViT-B: https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth\n"
                    f"并保存到: {self.checkpoint_path}"
                )
                raise FileNotFoundError(f"模型检查点文件不存在: {self.checkpoint_path}")
            
            logger.info(f"正在加载 SAM 模型: {self.model_type}")
            logger.info(f"检查点路径: {self.checkpoint_path}")
            
            # 加载模型
            device = "cuda" if self._has_cuda() else "cpu"
            logger.info(f"使用设备: {device}")
            
            sam = sam_model_registry[self.model_type](checkpoint=self.checkpoint_path)
            sam.to(device=device)
            
            # 创建自动掩码生成器
            self.predictor = SamAutomaticMaskGenerator(
                sam,
                points_per_side=32,
                pred_iou_thresh=0.86,
                stability_score_thresh=0.92,
                crop_n_layers=1,
                crop_n_points_downscale_factor=2,
                min_mask_region_area=100
            )
            
            logger.info("SAM 模型加载成功")
            
        except Exception as e:
            logger.error(f"加载 SAM 模型失败: {e}", exc_info=True)
            raise
    
    def _has_cuda(self) -> bool:
        """检查是否有 CUDA 支持"""
        try:
            import torch
            return torch.cuda.is_available()
        except:
            return False
    
    def segment_image(
        self,
        image: np.ndarray,
        threshold: float = 0.5,
        min_area: int = 100
    ) -> List[Dict[str, Any]]:
        """
        对图像进行分割
        
        参数:
        - image: 输入图像 (numpy array, RGB 格式)
        - threshold: 置信度阈值
        - min_area: 最小区域面积
        
        返回:
        - 多边形列表，每个多边形包含坐标、填充颜色等信息
        """
        if self.predictor is None:
            raise RuntimeError("SAM 模型未加载")
        
        logger.info(f"开始分割图像，尺寸: {image.shape}")
        
        # 执行 SAM 分割
        masks = self.predictor.generate(image)
        
        logger.info(f"SAM 生成了 {len(masks)} 个掩码")
        
        # 转换为多边形
        polygons = []
        for i, mask_data in enumerate(masks):
            # 过滤小区域
            area = mask_data['area']
            if area < min_area:
                continue
            
            # 过滤低置信度区域
            if mask_data.get('stability_score', 1.0) < threshold:
                continue
            
            # 提取掩码边界
            mask = mask_data['segmentation']
            contours = self._mask_to_contours(mask)
            
            # 为每个轮廓创建多边形
            for contour in contours:
                if len(contour) < 3:  # 至少需要3个点才能形成多边形
                    continue
                
                # 计算平均颜色（用于填充）
                mask_region = mask_data['segmentation']
                avg_color = self._get_region_color(image, mask_region)
                
                # 构建多边形数据
                r, g, b = int(avg_color[0]), int(avg_color[1]), int(avg_color[2])
                hex_color = f"#{r:02x}{g:02x}{b:02x}".upper()
                
                polygon = {
                    "id": len(polygons),
                    "points": contour.tolist(),
                    "fill": {
                        "color": f"rgb({r},{g},{b})",
                        "rgb": [r, g, b],
                        "hex": hex_color,
                        "rgba": [r, g, b, 255]
                    },
                    "area": int(area),
                    "confidence": float(mask_data.get('stability_score', 1.0)),
                    "bbox": [
                        int(mask_data['bbox'][0]),
                        int(mask_data['bbox'][1]),
                        int(mask_data['bbox'][0] + mask_data['bbox'][2]),
                        int(mask_data['bbox'][1] + mask_data['bbox'][3])
                    ]
                }
                polygons.append(polygon)
        
        # 按面积从大到小排序
        polygons.sort(key=lambda x: x['area'], reverse=True)
        
        # 重新分配 ID（按照排序后的顺序）
        for i, polygon in enumerate(polygons):
            polygon['id'] = i
        
        logger.info(f"转换完成，共 {len(polygons)} 个多边形（已按面积排序）")
        return polygons
    
    def _mask_to_contours(self, mask: np.ndarray) -> List[np.ndarray]:
        """
        将掩码转换为轮廓（多边形）
        
        参数:
        - mask: 二值掩码
        
        返回:
        - 轮廓列表
        """
        # 确保掩码是 uint8 类型
        mask_uint8 = (mask * 255).astype(np.uint8)
        
        # 查找轮廓
        contours, _ = cv2.findContours(
            mask_uint8,
            cv2.RETR_EXTERNAL,
            cv2.CHAIN_APPROX_SIMPLE
        )
        
        # 简化轮廓（减少点数）
        simplified_contours = []
        for contour in contours:
            # 使用 Douglas-Peucker 算法简化轮廓
            epsilon = 0.002 * cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, epsilon, True)
            
            # 转换为 (x, y) 坐标列表
            if len(approx) >= 3:
                points = approx.reshape(-1, 2)
                simplified_contours.append(points)
        
        return simplified_contours
    
    def _get_region_color(self, image: np.ndarray, mask: np.ndarray) -> Tuple[int, int, int]:
        """
        获取区域的平均颜色
        
        参数:
        - image: 原始图像
        - mask: 区域掩码
        
        返回:
        - RGB 颜色元组
        """
        # 获取掩码区域内的像素
        masked_pixels = image[mask]
        
        # 计算平均颜色
        if len(masked_pixels) > 0:
            avg_color = np.mean(masked_pixels, axis=0)
            return tuple(avg_color.astype(int))
        else:
            return (128, 128, 128)  # 默认灰色

