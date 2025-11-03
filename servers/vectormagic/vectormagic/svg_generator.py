"""
SVG生成器模块
将处理后的轮廓和颜色信息转换为SVG格式
"""

import numpy as np
from typing import List, Tuple, Optional, Dict
from .contour_processing import ContourProcessor


class SVGGenerator:
    """SVG生成器"""
    
    def __init__(self):
        self.contour_processor = ContourProcessor()
    
    def rgb_to_hex(self, color: Tuple[int, int, int]) -> str:
        """
        将BGR颜色转换为十六进制字符串
        
        Args:
            color: BGR颜色元组
        
        Returns:
            十六进制颜色字符串
        """
        # OpenCV使用BGR，SVG使用RGB
        b, g, r = color
        return f"#{r:02x}{g:02x}{b:02x}"
    
    def generate_path_element(self, contour: np.ndarray, 
                             color: Tuple[int, int, int],
                             fill: bool = True,
                             stroke: Optional[Tuple[int, int, int]] = None) -> str:
        """
        生成SVG路径元素
        
        Args:
            contour: 轮廓点
            color: 填充颜色 (BGR格式)
            fill: 是否填充
            stroke: 描边颜色 (BGR格式)，None表示无描边
        
        Returns:
            SVG路径元素字符串
        """
        path_data = self.contour_processor.contour_to_path(contour, close_path=True)
        
        if not path_data:
            return ""
        
        # 构建样式
        style_parts = []
        if fill:
            style_parts.append(f"fill:{self.rgb_to_hex(color)}")
        else:
            style_parts.append("fill:none")
        
        if stroke:
            style_parts.append(f"stroke:{self.rgb_to_hex(stroke)}")
            style_parts.append("stroke-width:1")
        else:
            style_parts.append("stroke:none")
        
        style = ";".join(style_parts)
        
        return f'<path d="{path_data}" style="{style}"/>'
    
    def generate_svg(self, width: int, height: int, 
                    paths: List[str],
                    background_color: Optional[Tuple[int, int, int]] = None) -> str:
        """
        生成完整的SVG文档
        
        Args:
            width: 图像宽度
            height: 图像高度
            paths: SVG路径元素列表
            background_color: 背景颜色 (BGR格式)
        
        Returns:
            完整的SVG文档字符串
        """
        svg_parts = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">'
        ]
        
        # 添加背景（如果有）
        if background_color:
            bg_color = self.rgb_to_hex(background_color)
            svg_parts.append(f'<rect width="100%" height="100%" fill="{bg_color}"/>')
        
        # 添加所有路径
        svg_parts.extend(paths)
        
        svg_parts.append('</svg>')
        
        return '\n'.join(svg_parts)
    
    def create_svg_from_contours(self, 
                                 contours: List[Tuple[np.ndarray, Tuple[int, int, int]]],
                                 width: int,
                                 height: int,
                                 background_color: Optional[Tuple[int, int, int]] = None) -> str:
        """
        从轮廓和颜色信息创建SVG
        
        Args:
            contours: (轮廓, 颜色) 元组列表
            width: 图像宽度
            height: 图像高度
            background_color: 背景颜色
        
        Returns:
            SVG文档字符串
        """
        paths = []
        
        for contour, color in contours:
            # 简化轮廓
            simplified = self.contour_processor.simplify_contour(contour)
            path_element = self.generate_path_element(simplified, color)
            if path_element:
                paths.append(path_element)
        
        return self.generate_svg(width, height, paths, background_color)
    
    def create_svg_from_segments(self,
                                 segments: List[Tuple[np.ndarray, Tuple[int, int, int]]],
                                 width: int,
                                 height: int,
                                 background_color: Optional[Tuple[int, int, int]] = None) -> str:
        """
        从颜色分割区域创建SVG
        
        Args:
            segments: (掩码, 颜色) 元组列表
            width: 图像宽度
            height: 图像高度
            background_color: 背景颜色
        
        Returns:
            SVG文档字符串
        """
        all_contours = []
        
        for mask, color in segments:
            # 从掩码提取轮廓
            contours = self.contour_processor.extract_contours(mask)
            
            # 过滤小轮廓
            filtered = self.contour_processor.filter_contours(contours, min_area=5.0)
            
            # 添加到列表
            for contour in filtered:
                all_contours.append((contour, color))
        
        return self.create_svg_from_contours(all_contours, width, height, background_color)

