"""
使用示例
"""

from generate_image import generate_image

# 示例 1: 基本图片生成
print("=" * 50)
print("示例 1: 基本图片生成")
print("=" * 50)
result = generate_image(
    prompt="Generate an image draw a nano banana",
    aspect_ratio="16:9"
)

# 示例 2: 使用不同的宽高比
print("\n" + "=" * 50)
print("示例 2: 使用 1:1 宽高比")
print("=" * 50)
result = generate_image(
    prompt="Generate an image draw a nano banana",
    aspect_ratio="1:1"
)

# 示例 3: 保存响应到文件
print("\n" + "=" * 50)
print("示例 3: 保存响应到文件")
print("=" * 50)
result = generate_image(
    prompt="Generate an image draw a nano banana",
    aspect_ratio="16:9",
    output_file="result.json"
)

