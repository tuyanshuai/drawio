"""
核心模块 - VectorMagic主类
整合所有功能模块
"""

import cv2
import numpy as np
from typing import Optional, Tuple
from pathlib import Path

from .preprocessing import ImagePreprocessor
from .color_segmentation import ColorSegmenter
from .contour_processing import ContourProcessor
from .svg_generator import SVGGenerator


class VectorMagic:
    """VectorMagic主类 - 图片转SVG转换器"""
    
    def __init__(self):
        self.preprocessor = ImagePreprocessor()
        self.color_segmenter = ColorSegmenter()
        self.contour_processor = ContourProcessor()
        self.svg_generator = SVGGenerator()
    
    def convert_image(self, 
                     image_path: str,
                     detail_level: str = 'medium',
                     colors: str = 'unlimited',
                     color_count: int = 16,
                     output_path: Optional[str] = None) -> str:
        """
        转换图像为SVG
        
        Args:
            image_path: 输入图像路径
            detail_level: 细节级别 ('low', 'medium', 'high')
            colors: 颜色模式 ('unlimited', 'limited')
            color_count: 颜色数量（仅在limited模式下有效）
            output_path: 输出SVG文件路径，None表示只返回SVG内容
        
        Returns:
            SVG内容字符串
        """
        # 读取图像
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"无法读取图像: {image_path}")
        
        height, width = image.shape[:2]
        
        # 预处理
        processed = self.preprocessor.preprocess(image, detail_level)
        
        # 根据颜色模式处理
        if colors == 'unlimited':
            # 无限制颜色模式：使用边缘检测和轮廓提取
            svg_content = self._convert_with_edges(image, processed, width, height, detail_level)
        else:
            # 限制颜色模式：使用颜色分割
            svg_content = self._convert_with_color_segmentation(
                image, width, height, color_count
            )
        
        # 保存到文件（如果指定）
        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(svg_content)
        
        return svg_content
    
    def _convert_with_edges(self, 
                           original_image: np.ndarray,
                           processed_image: np.ndarray,
                           width: int,
                           height: int,
                           detail_level: str) -> str:
        """
        使用边缘检测方法转换
        
        Args:
            original_image: 原始彩色图像
            processed_image: 预处理后的灰度图像
            width: 图像宽度
            height: 图像高度
            detail_level: 细节级别
        
        Returns:
            SVG内容字符串
        """
        # 边缘检测
        edges = self.preprocessor.detect_edges(processed_image, detail_level)
        
        # 提取轮廓
        contours = self.contour_processor.extract_all_contours(edges)
        
        # 过滤小轮廓
        filtered_contours = self.contour_processor.filter_contours(contours, min_area=10.0)
        
        # 为每个轮廓分配颜色
        contour_colors = []
        for contour in filtered_contours:
            # 获取轮廓区域的掩码
            mask = np.zeros((height, width), dtype=np.uint8)
            cv2.drawContours(mask, [contour], -1, 255, -1)
            
            # 计算该区域的平均颜色 (OpenCV返回BGR格式)
            mean_color = cv2.mean(original_image, mask=mask)[:3]
            color = tuple(map(int, mean_color))  # BGR格式
            
            contour_colors.append((contour, color))
        
        # 生成SVG
        return self.svg_generator.create_svg_from_contours(
            contour_colors, width, height
        )
    
    def _convert_with_color_segmentation(self,
                                         image: np.ndarray,
                                         width: int,
                                         height: int,
                                         color_count: int) -> str:
        """
        使用颜色分割方法转换
        
        Args:
            image: 输入图像
            width: 图像宽度
            height: 图像高度
            color_count: 颜色数量
        
        Returns:
            SVG内容字符串
        """
        # 颜色分割
        segments = self.color_segmenter.segment_by_color(image, n_colors=color_count)
        
        # 生成SVG
        return self.svg_generator.create_svg_from_segments(
            segments, width, height
        )
    
    def convert_image_file(self,
                          input_path: str,
                          output_path: str,
                          detail_level: str = 'medium',
                          colors: str = 'unlimited',
                          color_count: int = 16) -> None:
        """
        转换图像文件并保存
        
        Args:
            input_path: 输入图像路径
            output_path: 输出SVG路径
            detail_level: 细节级别
            colors: 颜色模式
            color_count: 颜色数量
        """
        svg_content = self.convert_image(
            input_path,
            detail_level=detail_level,
            colors=colors,
            color_count=color_count
        )
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(svg_content)

