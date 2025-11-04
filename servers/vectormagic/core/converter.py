#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PNG 转 SVG 转换器
使用轮廓检测和矢量化算法
支持彩色图像和透明通道
"""

import cv2
import numpy as np
from PIL import Image
import os


class PNGToSVGConverter:
    """PNG 到 SVG 转换器类"""
    
    def __init__(self):
        self.simplify_threshold = 0.5  # 轮廓简化阈值
        self.color_mode = "color"  # "color", "grayscale", "binary"
    
    def convert(self, png_path, svg_path):
        """
        将 PNG 图片转换为 SVG
        
        Args:
            png_path: PNG 文件路径
            svg_path: 输出 SVG 文件路径
        
        Returns:
            bool: 转换是否成功
        """
        try:
            # 使用 PIL 读取图片以保持透明度
            pil_img = Image.open(png_path)
            if pil_img.mode == 'RGBA':
                # 转换为带透明度的 numpy 数组
                img_array = np.array(pil_img)
                height, width = img_array.shape[:2]
                
                # 分离通道
                rgb = img_array[:, :, :3]
                alpha = img_array[:, :, 3]
                
                # 创建白色背景用于预览
                white_bg = np.ones_like(rgb) * 255
                alpha_normalized = alpha[:, :, np.newaxis] / 255.0
                img_rgb = (rgb * alpha_normalized + white_bg * (1 - alpha_normalized)).astype(np.uint8)
                img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
                
                # 使用 alpha 通道创建掩码
                mask = alpha
                
            else:
                # 转换为 RGB
                if pil_img.mode != 'RGB':
                    pil_img = pil_img.convert('RGB')
                img_rgb = np.array(pil_img)
                height, width = img_rgb.shape[:2]
                img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
                mask = None
            
            # 根据模式处理
            if self.color_mode == "binary":
                # 二值化模式
                gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
                if mask is not None:
                    # 使用 alpha 通道作为掩码
                    _, binary = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)
                else:
                    _, binary = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY)
                
                contours, _ = cv2.findContours(
                    binary,
                    cv2.RETR_EXTERNAL,
                    cv2.CHAIN_APPROX_SIMPLE
                )
                
                if len(contours) == 0:
                    self._create_empty_svg(svg_path, width, height)
                    return True
                
                self._create_svg_binary(svg_path, width, height, contours, binary, img_bgr)
                
            elif self.color_mode == "grayscale":
                # 灰度模式
                gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
                
                # 使用多个阈值提取不同灰度区域
                thresholds = [64, 128, 192]
                all_paths = []
                
                for threshold in thresholds:
                    _, binary = cv2.threshold(gray, threshold, 255, cv2.THRESH_BINARY)
                    if mask is not None:
                        binary = cv2.bitwise_and(binary, mask)
                    
                    contours, _ = cv2.findContours(
                        binary,
                        cv2.RETR_EXTERNAL,
                        cv2.CHAIN_APPROX_SIMPLE
                    )
                    
                    for contour in contours:
                        epsilon = self.simplify_threshold * cv2.arcLength(contour, True)
                        approx = cv2.approxPolyDP(contour, epsilon, True)
                        if len(approx) >= 3:
                            gray_value = int(255 - threshold)
                            gray_color = f"rgb({gray_value},{gray_value},{gray_value})"
                            path_str = self._contour_to_path_simple(approx)
                            if path_str:
                                all_paths.append(f'<path d="{path_str}" fill="{gray_color}" stroke="none"/>')
                
                self._create_svg_from_paths(svg_path, width, height, all_paths)
                
            else:
                # 彩色模式 - 使用颜色量化
                quantized = self._quantize_colors(img_bgr, mask, num_colors=32)
                self._create_svg_color(svg_path, width, height, quantized, mask)
            
            return True
            
        except Exception as e:
            print(f"转换错误: {str(e)}")
            import traceback
            traceback.print_exc()
            return False
    
    def _quantize_colors(self, img_bgr, mask, num_colors=32):
        """颜色量化"""
        # 如果有掩码，只处理非透明区域
        if mask is not None:
            # 创建掩码区域
            masked_img = img_bgr.copy()
            masked_img[mask < 128] = [255, 255, 255]  # 透明区域设为白色
        else:
            masked_img = img_bgr
        
        # 重塑为像素列表
        pixels = masked_img.reshape(-1, 3)
        
        # K-means 颜色量化
        pixels_float = np.float32(pixels)
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
        _, labels, centers = cv2.kmeans(
            pixels_float,
            num_colors,
            None,
            criteria,
            10,
            cv2.KMEANS_RANDOM_CENTERS
        )
        
        # 转换回 uint8
        centers = np.uint8(centers)
        
        # 重建量化图像
        quantized = centers[labels.flatten()]
        quantized = quantized.reshape(img_bgr.shape)
        
        return quantized
    
    def _create_svg_color(self, svg_path, width, height, quantized_img, mask):
        """创建彩色 SVG"""
        paths = []
        
        # 获取唯一颜色
        unique_colors = np.unique(quantized_img.reshape(-1, 3), axis=0)
        
        for color in unique_colors:
            # 创建颜色掩码
            color_mask = np.all(quantized_img == color, axis=2).astype(np.uint8) * 255
            
            # 如果有 alpha 掩码，合并
            if mask is not None:
                color_mask = cv2.bitwise_and(color_mask, mask)
            
            # 查找轮廓
            contours, _ = cv2.findContours(
                color_mask,
                cv2.RETR_EXTERNAL,
                cv2.CHAIN_APPROX_SIMPLE
            )
            
            # 转换为十六进制颜色
            b, g, r = color
            color_hex = f"#{r:02x}{g:02x}{b:02x}"
            
            for contour in contours:
                epsilon = self.simplify_threshold * cv2.arcLength(contour, True)
                approx = cv2.approxPolyDP(contour, epsilon, True)
                
                if len(approx) >= 3:
                    path_str = self._contour_to_path_simple(approx)
                    if path_str:
                        paths.append(f'<path d="{path_str}" fill="{color_hex}" stroke="none"/>')
        
        self._create_svg_from_paths(svg_path, width, height, paths)
    
    def _create_svg_binary(self, svg_path, width, height, contours, binary_img, color_img):
        """创建二值化 SVG"""
        svg_paths = []
        
        for contour in contours:
            # 简化轮廓
            epsilon = self.simplify_threshold * cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, epsilon, True)
            
            if len(approx) < 3:
                continue
            
            # 获取颜色
            point = approx[0][0]
            x, y = int(point[0]), int(point[1])
            h, w = binary_img.shape
            x = max(0, min(x, w - 1))
            y = max(0, min(y, h - 1))
            
            color_value = binary_img[y, x]
            if color_value < 128:
                fill_color = "#000000"
            else:
                # 使用原始颜色
                if len(color_img.shape) == 3:
                    b, g, r = color_img[y, x]
                    fill_color = f"#{r:02x}{g:02x}{b:02x}"
                else:
                    fill_color = "#FFFFFF"
            
            # 转换为路径
            path_str = self._contour_to_path_simple(approx)
            if path_str:
                svg_paths.append(f'<path d="{path_str}" fill="{fill_color}" stroke="none"/>')
        
        self._create_svg_from_paths(svg_path, width, height, svg_paths)
    
    def _create_svg_from_paths(self, svg_path, width, height, paths):
        """从路径列表创建 SVG"""
        if not paths:
            self._create_empty_svg(svg_path, width, height)
            return
        
        paths_content = '\n    '.join(paths)
        
        svg_content = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg">
    {paths_content}
</svg>'''
        
        with open(svg_path, 'w', encoding='utf-8') as f:
            f.write(svg_content)
    
    def _create_empty_svg(self, svg_path, width, height):
        """创建空白 SVG"""
        svg_content = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg">
</svg>'''
        
        with open(svg_path, 'w', encoding='utf-8') as f:
            f.write(svg_content)
    
    def _contour_to_path_simple(self, contour):
        """将轮廓转换为简单的 SVG 路径"""
        if len(contour) < 2:
            return None
        
        path_parts = []
        
        # 移动到第一个点
        first_point = contour[0][0]
        path_parts.append(f"M {first_point[0]:.1f} {first_point[1]:.1f}")
        
        # 添加直线段
        for i in range(1, len(contour)):
            point = contour[i][0]
            path_parts.append(f"L {point[0]:.1f} {point[1]:.1f}")
        
        # 闭合路径
        path_parts.append("Z")
        
        return " ".join(path_parts)
    
    def set_simplify_threshold(self, threshold):
        """设置轮廓简化阈值"""
        self.simplify_threshold = threshold
    
    def set_color_mode(self, mode):
        """设置颜色模式: 'color', 'grayscale', 'binary'"""
        self.color_mode = mode

