"""
图片生成脚本
使用 oneapi.cyberclaude.com 的 gemini-2.5-flash-image 模型生成图片
"""

import requests
import json
import sys
import os
import base64
import re
from typing import Optional
import argparse
from pathlib import Path
from datetime import datetime

# API 配置
API_URL = "https://oneapi.cyberclaude.com/v1/chat/completions"
API_KEY = "sk-CVW0UIOOSgHvCqa85XgsHQ0cT6nzRostH7qtr3uNU42r44WO"
MODEL = "gemini-2.5-flash-image"

def generate_image(
    prompt: str,
    aspect_ratio: str = "16:9",
    image_url: Optional[str] = None,
    max_tokens: int = 150,
    temperature: float = 0.7,
    output_file: Optional[str] = None
):
    """
    生成图片
    
    参数:
    - prompt: 图片描述文本
    - aspect_ratio: 图片宽高比，默认 "16:9"
    - image_url: 可选的参考图片 URL（用于图片到图片生成）
    - max_tokens: 最大 token 数，默认 150
    - temperature: 温度参数，默认 0.7
    - output_file: 输出文件路径（保存响应 JSON）
    """
    # 构建请求头
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    }
    
    # 构建消息内容
    user_content = [
        {
            "type": "text",
            "text": prompt
        }
    ]
    
    # 如果提供了参考图片 URL，添加到内容中
    if image_url:
        user_content.append({
            "type": "image_url",
            "image_url": {
                "url": image_url
            }
        })
    
    # 构建请求体
    payload = {
        "extra_body": {
            "imageConfig": {
                "aspectRatio": aspect_ratio
            }
        },
        "model": MODEL,
        "messages": [
            {
                "role": "system",
                "content": json.dumps({
                    "imageConfig": {
                        "aspectRatio": aspect_ratio
                    }
                })
            },
            {
                "role": "user",
                "content": user_content
            }
        ],
        "max_tokens": max_tokens,
        "temperature": temperature
    }
    
    print(f"正在生成图片...")
    print(f"提示词: {prompt}")
    print(f"宽高比: {aspect_ratio}")
    if image_url:
        print(f"参考图片: {image_url}")
    print()
    
    try:
        # 发送请求
        response = requests.post(
            API_URL,
            headers=headers,
            json=payload,
            timeout=60
        )
        
        # 检查响应状态
        response.raise_for_status()
        
        # 解析响应
        result = response.json()
        
        # 打印响应（简化输出）
        print("生成成功！")
        # 只打印关键信息，不打印完整的 base64 数据
        if isinstance(result, dict):
            simplified_result = json.loads(json.dumps(result))  # 深拷贝
            if "choices" in simplified_result and len(simplified_result["choices"]) > 0:
                choice = simplified_result["choices"][0]
                if "message" in choice:
                    msg = choice["message"]
                    if "content" in msg and isinstance(msg["content"], str):
                        content_len = len(msg["content"])
                        if content_len > 100:
                            msg["content"] = f"[Base64数据，长度: {content_len}字符]"
                            print(f"  检测到 content 字段，长度: {content_len} 字符")
            print(json.dumps(simplified_result, indent=2, ensure_ascii=False))
        else:
            print(json.dumps(result, indent=2, ensure_ascii=False))
        
        # 尝试提取图片数据（URL 或 base64）
        image_url_result = None
        image_base64 = None
        
        if isinstance(result, dict):
            # 检查各种可能的响应格式
            if "choices" in result and len(result["choices"]) > 0:
                choice = result["choices"][0]
                if "message" in choice:
                    content = choice["message"].get("content", "")
                    # 尝试从 content 中提取图片数据
                    if isinstance(content, str):
                        # 检查是否是 Markdown 格式的图片链接
                        markdown_image_pattern = r'!\[.*?\]\((.*?)\)'
                        markdown_matches = re.findall(markdown_image_pattern, content)
                        if markdown_matches:
                            image_url_result = markdown_matches[0]
                            print(f"  从 Markdown 中提取到图片 URL: {image_url_result}")
                        
                        # 检查是否是 base64 编码的图片
                        # base64 图片通常很长（>1000字符）
                        content_len = len(content)
                        if content_len > 1000:
                            # 检查是否是 data URI 格式
                            if "base64," in content:
                                image_base64 = content.split("base64,")[1]
                            else:
                                # 直接是 base64 字符串，尝试验证
                                try:
                                    # 补齐 base64 字符串长度（必须是4的倍数）
                                    test_str = content[:200]  # 取前200个字符测试
                                    padding = 4 - (len(test_str) % 4)
                                    if padding != 4:
                                        test_str += "=" * padding
                                    base64.b64decode(test_str)  # 验证是否是有效的 base64
                                    # 如果验证通过，认为是 base64 图片数据
                                    image_base64 = content
                                except:
                                    # 不是 base64，可能是 JSON 字符串
                                    try:
                                        content_json = json.loads(content)
                                        if "image_url" in content_json:
                                            image_url_result = content_json["image_url"]
                                        elif "image" in content_json:
                                            image_base64 = content_json["image"]
                                    except:
                                        # 如果都失败，但字符串很长（>5000字符），仍然尝试作为 base64
                                        if content_len > 5000:
                                            print(f"  检测到长字符串（{content_len}字符），尝试作为 base64 图片保存")
                                            image_base64 = content
                        elif content.startswith("data:image"):
                            # data URI 格式
                            if "base64," in content:
                                image_base64 = content.split("base64,")[1]
                        elif content.startswith("/9j/") or content.startswith("iVBORw0KGgo"):
                            # 直接是 base64 数据（JPEG 或 PNG）
                            image_base64 = content
                        else:
                            # 可能是 JSON 字符串
                            try:
                                content_json = json.loads(content)
                                if "image_url" in content_json:
                                    image_url_result = content_json["image_url"]
                                elif "image" in content_json:
                                    image_base64 = content_json["image"]
                            except:
                                pass
                    elif isinstance(content, dict):
                        if "image_url" in content:
                            image_url_result = content["image_url"]
                        elif "image" in content:
                            image_base64 = content["image"]
            
            # 检查其他可能的字段
            if not image_url_result and not image_base64:
                # 检查 images 字段
                if "images" in result and isinstance(result["images"], list) and len(result["images"]) > 0:
                    image_url_result = result["images"][0]
                    print(f"  从 images 字段提取到图片 URL: {image_url_result}")
                elif "image_url" in result:
                    image_url_result = result["image_url"]
                elif "image" in result:
                    image_base64 = result["image"]
                elif "data" in result and isinstance(result["data"], list) and len(result["data"]) > 0:
                    image_url_result = result["data"][0].get("url") or result["data"][0].get("image_url")
                    if not image_url_result:
                        image_base64 = result["data"][0].get("image") or result["data"][0].get("b64_json")
        
        # 保存 base64 图片
        if image_base64:
            try:
                # 生成文件名
                if output_file:
                    image_filename = output_file.replace('.json', '.png')
                else:
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    image_filename = f"generated_image_{timestamp}.png"
                
                # 解码并保存图片
                # 确保 base64 字符串长度是 4 的倍数
                padding = 4 - (len(image_base64) % 4)
                if padding != 4:
                    image_base64 += "=" * padding
                
                image_data = base64.b64decode(image_base64)
                with open(image_filename, 'wb') as f:
                    f.write(image_data)
                print(f"\n✓ 图片已保存到: {image_filename}")
                print(f"  文件大小: {len(image_data)} 字节")
            except Exception as e:
                print(f"\n✗ 保存图片时出错: {e}")
                print(f"  Base64 长度: {len(image_base64) if image_base64 else 0}")
        elif not image_url_result:
            print("\n⚠ 未找到图片数据（URL 或 base64）")
        
        if image_url_result:
            print(f"\n✓ 图片 URL: {image_url_result}")
            # 尝试下载图片
            try:
                img_response = requests.get(image_url_result, timeout=30)
                img_response.raise_for_status()
                
                # 生成文件名
                if output_file:
                    image_filename = output_file.replace('.json', '.png')
                else:
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    # 从 URL 中提取扩展名
                    ext = os.path.splitext(image_url_result.split('?')[0])[1] or '.png'
                    image_filename = f"generated_image_{timestamp}{ext}"
                
                # 保存图片
                with open(image_filename, 'wb') as f:
                    f.write(img_response.content)
                print(f"✓ 图片已下载并保存到: {image_filename}")
                print(f"  文件大小: {len(img_response.content)} 字节")
            except Exception as e:
                print(f"⚠ 下载图片时出错: {e}")
                print(f"  您可以手动访问 URL 下载图片")
        
        # 保存响应到文件
        if output_file:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            print(f"\n响应已保存到: {output_file}")
        
        return result
        
    except requests.exceptions.HTTPError as e:
        print(f"HTTP 错误: {e.response.status_code}")
        try:
            error_detail = e.response.json()
            print(f"错误详情: {json.dumps(error_detail, indent=2, ensure_ascii=False)}")
        except:
            print(f"错误详情: {e.response.text}")
        sys.exit(1)
        
    except requests.exceptions.RequestException as e:
        print(f"请求错误: {e}")
        sys.exit(1)
        
    except Exception as e:
        print(f"发生错误: {e}")
        sys.exit(1)


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description="使用 gemini-2.5-flash-image 模型生成图片"
    )
    parser.add_argument(
        "prompt",
        help="图片描述文本"
    )
    parser.add_argument(
        "--aspect-ratio",
        "-a",
        default="16:9",
        help="图片宽高比（默认: 16:9）"
    )
    parser.add_argument(
        "--image-url",
        "-i",
        help="参考图片 URL（用于图片到图片生成）"
    )
    parser.add_argument(
        "--max-tokens",
        "-t",
        type=int,
        default=150,
        help="最大 token 数（默认: 150）"
    )
    parser.add_argument(
        "--temperature",
        "-T",
        type=float,
        default=0.7,
        help="温度参数（默认: 0.7）"
    )
    parser.add_argument(
        "--output",
        "-o",
        help="输出文件路径（保存响应 JSON）"
    )
    
    args = parser.parse_args()
    
    generate_image(
        prompt=args.prompt,
        aspect_ratio=args.aspect_ratio,
        image_url=args.image_url,
        max_tokens=args.max_tokens,
        temperature=args.temperature,
        output_file=args.output
    )


if __name__ == "__main__":
    main()

