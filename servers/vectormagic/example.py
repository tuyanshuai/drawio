#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
使用示例
"""

from vectormagic import VectorMagic

def example_basic():
    """基本使用示例"""
    vm = VectorMagic()
    
    # 转换图像
    svg_content = vm.convert_image(
        'input.jpg',
        detail_level='medium',
        colors='unlimited'
    )
    
    # 保存结果
    with open('output.svg', 'w', encoding='utf-8') as f:
        f.write(svg_content)
    
    print("转换完成！")

def example_high_detail():
    """高细节示例"""
    vm = VectorMagic()
    
    svg_content = vm.convert_image(
        'input.jpg',
        detail_level='high',
        colors='unlimited'
    )
    
    with open('output_high_detail.svg', 'w', encoding='utf-8') as f:
        f.write(svg_content)
    
    print("高细节转换完成！")

def example_limited_colors():
    """限制颜色数量示例"""
    vm = VectorMagic()
    
    svg_content = vm.convert_image(
        'input.jpg',
        detail_level='medium',
        colors='limited',
        color_count=8
    )
    
    with open('output_limited_colors.svg', 'w', encoding='utf-8') as f:
        f.write(svg_content)
    
    print("限制颜色转换完成！")

if __name__ == '__main__':
    print("Vector Magic 使用示例")
    print("请确保有输入图像文件 'input.jpg'")
    
    # 运行基本示例
    # example_basic()
    
    # 运行高细节示例
    # example_high_detail()
    
    # 运行限制颜色示例
    # example_limited_colors()

