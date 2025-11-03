#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Vector Magic - 图片转SVG命令行工具
"""

import click
import sys
from pathlib import Path
from vectormagic import VectorMagic


@click.command()
@click.argument('input_file', type=click.Path(exists=True))
@click.argument('output_file', type=click.Path())
@click.option('--detail', 
              type=click.Choice(['low', 'medium', 'high'], case_sensitive=False),
              default='medium',
              help='细节级别 (low/medium/high)')
@click.option('--colors',
              type=click.Choice(['unlimited', 'limited'], case_sensitive=False),
              default='unlimited',
              help='颜色模式 (unlimited/limited)')
@click.option('--color-count',
              type=int,
              default=16,
              help='颜色数量 (仅在limited模式下有效)')
def main(input_file, output_file, detail, colors, color_count):
    """
    将位图图像转换为SVG矢量图
    
    INPUT_FILE: 输入图像文件路径 (支持 JPG, PNG, BMP, GIF)
    
    OUTPUT_FILE: 输出SVG文件路径
    """
    try:
        click.echo(f"正在处理: {input_file}")
        click.echo(f"细节级别: {detail}")
        click.echo(f"颜色模式: {colors}")
        
        if colors == 'limited':
            click.echo(f"颜色数量: {color_count}")
        
        # 创建转换器
        vm = VectorMagic()
        
        # 执行转换
        vm.convert_image_file(
            input_file,
            output_file,
            detail_level=detail.lower(),
            colors=colors.lower(),
            color_count=color_count
        )
        
        click.echo(f"✓ 转换完成: {output_file}")
        
    except Exception as e:
        click.echo(f"✗ 错误: {str(e)}", err=True)
        sys.exit(1)


if __name__ == '__main__':
    main()

