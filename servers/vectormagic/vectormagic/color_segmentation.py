"""
颜色分割模块
使用K-means聚类或颜色量化进行区域分割
"""

import cv2
import numpy as np
from typing import List, Tuple, Optional


class ColorSegmenter:
    """颜色分割器"""
    
    def __init__(self):
        pass
    
    def quantize_colors(self, image: np.ndarray, n_colors: int = 16) -> Tuple[np.ndarray, np.ndarray]:
        """
        颜色量化
        
        Args:
            image: 输入图像 (BGR格式)
            n_colors: 颜色数量
        
        Returns:
            (量化后的图像, 颜色调色板)
        """
        # 重塑图像为像素列表
        data = image.reshape((-1, 3))
        data = np.float32(data)
        
        # 使用K-means聚类
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
        _, labels, centers = cv2.kmeans(data, n_colors, None, criteria, 10, cv2.KMEANS_RANDOM_CENTERS)
        
        # 转换回uint8
        centers = np.uint8(centers)
        
        # 映射像素到最近的聚类中心
        quantized = centers[labels.flatten()]
        quantized = quantized.reshape(image.shape)
        
        return quantized, centers
    
    def segment_by_color(self, image: np.ndarray, n_colors: Optional[int] = None) -> List[Tuple[np.ndarray, Tuple[int, int, int]]]:
        """
        按颜色分割图像
        
        Args:
            image: 输入图像
            n_colors: 颜色数量，None表示自动检测
        
        Returns:
            分割后的区域列表，每个元素为(mask, color)
        """
        if n_colors is None:
            # 自动检测颜色数量
            n_colors = self._estimate_color_count(image)
        
        quantized, palette = self.quantize_colors(image, n_colors)
        
        segments = []
        for color in palette:
            # 创建该颜色的掩码
            color_bgr = tuple(map(int, color))
            mask = cv2.inRange(quantized, color_bgr, color_bgr)
            
            # 只保留有足够像素的区域
            if np.sum(mask > 0) > 100:  # 至少100个像素
                segments.append((mask, tuple(color)))
        
        return segments
    
    def _estimate_color_count(self, image: np.ndarray) -> int:
        """
        估计图像中的主要颜色数量
        
        Args:
            image: 输入图像
        
        Returns:
            估计的颜色数量
        """
        # 使用简化方法：分析直方图
        # 这里使用固定的合理值，实际可以更复杂
        h, w = image.shape[:2]
        total_pixels = h * w
        
        # 如果图像较小，使用较少的颜色
        if total_pixels < 10000:
            return 8
        elif total_pixels < 100000:
            return 16
        else:
            return 32
    
    def get_dominant_colors(self, image: np.ndarray, n_colors: int = 5) -> List[Tuple[int, int, int]]:
        """
        获取主要颜色
        
        Args:
            image: 输入图像
            n_colors: 要获取的颜色数量
        
        Returns:
            主要颜色列表 (BGR格式)
        """
        quantized, palette = self.quantize_colors(image, n_colors * 2)
        
        # 统计每种颜色的像素数量
        colors = quantized.reshape((-1, 3))
        unique_colors, counts = np.unique(colors, axis=0, return_counts=True)
        
        # 按出现频率排序
        sorted_indices = np.argsort(counts)[::-1]
        dominant = unique_colors[sorted_indices[:n_colors]]
        
        return [tuple(map(int, color)) for color in dominant]

