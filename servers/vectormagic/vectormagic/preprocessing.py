"""
图像预处理模块
包括去噪、平滑、边缘检测等功能
"""

import cv2
import numpy as np
from typing import Tuple, Optional


class ImagePreprocessor:
    """图像预处理器"""
    
    def __init__(self):
        self.blur_kernel_size = 5
        self.bilateral_d = 9
        self.bilateral_sigma_color = 75
        self.bilateral_sigma_space = 75
    
    def preprocess(self, image: np.ndarray, detail_level: str = 'medium') -> np.ndarray:
        """
        预处理图像
        
        Args:
            image: 输入图像 (BGR格式)
            detail_level: 细节级别 ('low', 'medium', 'high')
        
        Returns:
            预处理后的图像
        """
        # 转换为灰度图用于边缘检测
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()
        
        # 根据细节级别调整预处理参数
        if detail_level == 'low':
            # 低细节：更多平滑，减少噪声
            gray = cv2.bilateralFilter(gray, self.bilateral_d, 
                                      self.bilateral_sigma_color * 2,
                                      self.bilateral_sigma_space * 2)
            gray = cv2.GaussianBlur(gray, (7, 7), 0)
        elif detail_level == 'high':
            # 高细节：较少平滑，保留更多细节
            gray = cv2.bilateralFilter(gray, self.bilateral_d,
                                      self.bilateral_sigma_color,
                                      self.bilateral_sigma_space)
        else:  # medium
            # 中等细节：平衡平滑和细节
            gray = cv2.bilateralFilter(gray, self.bilateral_d,
                                      self.bilateral_sigma_color,
                                      self.bilateral_sigma_space)
            gray = cv2.GaussianBlur(gray, (3, 3), 0)
        
        return gray
    
    def detect_edges(self, image: np.ndarray, detail_level: str = 'medium') -> np.ndarray:
        """
        边缘检测
        
        Args:
            image: 灰度图像
            detail_level: 细节级别
        
        Returns:
            边缘图像（二值图）
        """
        # 根据细节级别调整Canny参数
        if detail_level == 'low':
            threshold1, threshold2 = 50, 150
        elif detail_level == 'high':
            threshold1, threshold2 = 100, 200
        else:  # medium
            threshold1, threshold2 = 75, 175
        
        edges = cv2.Canny(image, threshold1, threshold2)
        
        # 形态学操作连接断开的边缘
        kernel = np.ones((3, 3), np.uint8)
        edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)
        
        return edges
    
    def enhance_contrast(self, image: np.ndarray) -> np.ndarray:
        """
        增强对比度
        
        Args:
            image: 输入图像
        
        Returns:
            对比度增强后的图像
        """
        # 使用CLAHE (Contrast Limited Adaptive Histogram Equalization)
        if len(image.shape) == 3:
            lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            l = clahe.apply(l)
            enhanced = cv2.merge([l, a, b])
            enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)
        else:
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(image)
        
        return enhanced

