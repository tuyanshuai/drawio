"""
轮廓提取和处理模块
包括轮廓提取、简化、矢量化等功能
"""

import cv2
import numpy as np
from typing import List, Tuple, Optional


class ContourProcessor:
    """轮廓处理器"""
    
    def __init__(self):
        self.epsilon_factor = 0.02  # Douglas-Peucker算法的epsilon因子
    
    def extract_contours(self, binary_image: np.ndarray, 
                         mode: int = cv2.RETR_EXTERNAL,
                         method: int = cv2.CHAIN_APPROX_SIMPLE) -> List[np.ndarray]:
        """
        提取轮廓
        
        Args:
            binary_image: 二值图像
            mode: 轮廓检索模式
            method: 轮廓近似方法
        
        Returns:
            轮廓列表
        """
        contours, _ = cv2.findContours(binary_image, mode, method)
        return contours
    
    def extract_all_contours(self, binary_image: np.ndarray) -> List[np.ndarray]:
        """
        提取所有轮廓（包括内部轮廓）
        
        Args:
            binary_image: 二值图像
        
        Returns:
            轮廓列表
        """
        return self.extract_contours(binary_image, 
                                     mode=cv2.RETR_TREE,
                                     method=cv2.CHAIN_APPROX_SIMPLE)
    
    def simplify_contour(self, contour: np.ndarray, epsilon: Optional[float] = None) -> np.ndarray:
        """
        简化轮廓（Douglas-Peucker算法）
        
        Args:
            contour: 输入轮廓
            epsilon: 简化精度，None表示自动计算
        
        Returns:
            简化后的轮廓
        """
        if epsilon is None:
            # 自动计算epsilon
            arc_length = cv2.arcLength(contour, True)
            epsilon = arc_length * self.epsilon_factor
        
        simplified = cv2.approxPolyDP(contour, epsilon, True)
        return simplified
    
    def filter_contours(self, contours: List[np.ndarray], 
                       min_area: float = 10.0) -> List[np.ndarray]:
        """
        过滤轮廓（移除太小的轮廓）
        
        Args:
            contours: 轮廓列表
            min_area: 最小面积阈值
        
        Returns:
            过滤后的轮廓列表
        """
        filtered = []
        for contour in contours:
            area = cv2.contourArea(contour)
            if area >= min_area:
                filtered.append(contour)
        return filtered
    
    def contour_to_path(self, contour: np.ndarray, close_path: bool = True) -> str:
        """
        将轮廓转换为SVG路径字符串
        
        Args:
            contour: 轮廓点
            close_path: 是否闭合路径
        
        Returns:
            SVG路径字符串
        """
        if len(contour) < 2:
            return ""
        
        # 如果轮廓已经简化，点较少，使用直线连接
        if len(contour) < 10:
            points = contour.reshape(-1, 2)
            path = f"M {points[0][0]},{points[0][1]} "
            
            # 后续点使用L命令
            for i in range(1, len(points)):
                path += f"L {points[i][0]},{points[i][1]} "
            
            if close_path:
                path += "Z"
            return path
        
        # 对于复杂轮廓，使用直线连接
        # 注意：轮廓应该已经在外部简化过了
        points = contour.reshape(-1, 2)
        
        path = f"M {points[0][0]},{points[0][1]} "
        
        # 使用直线连接所有点
        for i in range(1, len(points)):
            path += f"L {points[i][0]},{points[i][1]} "
        
        if close_path:
            path += "Z"
        
        return path
    
    def smooth_contour(self, contour: np.ndarray, kernel_size: int = 5) -> np.ndarray:
        """
        平滑轮廓
        
        Args:
            contour: 输入轮廓
            kernel_size: 平滑核大小
        
        Returns:
            平滑后的轮廓
        """
        if len(contour) < kernel_size:
            return contour
        
        # 提取点坐标
        points = contour.reshape(-1, 2).astype(np.float32)
        
        # 应用移动平均
        smoothed = np.zeros_like(points)
        for i in range(len(points)):
            start = max(0, i - kernel_size // 2)
            end = min(len(points), i + kernel_size // 2 + 1)
            smoothed[i] = np.mean(points[start:end], axis=0)
        
        return smoothed.astype(np.int32).reshape(-1, 1, 2)

