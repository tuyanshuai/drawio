"""
图像生成服务后端
基于 generate_image.py，提供 Web API 接口
使用 oneapi.cyberclaude.com 的 gemini-2.5-flash-image 模型生成图片
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
import uvicorn
import requests
import json
import os
import base64
import re
import logging
from typing import Optional, Tuple
from pydantic import BaseModel
from datetime import datetime
from pathlib import Path

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Image Generator API",
    description="基于 gemini-2.5-flash-image 模型的图像生成服务",
    version="1.0.0"
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# API 配置 - 从环境变量获取，如果没有则使用默认值
API_URL = os.getenv("API_URL", "https://oneapi.cyberclaude.com/v1/chat/completions")
API_KEY = os.getenv("API_KEY", "sk-CVW0UIOOSgHvCqa85XgsHQ0cT6nzRostH7qtr3uNU42r44WO")
MODEL = os.getenv("MODEL", "gemini-2.5-flash-image")

# 图像保存目录
OUTPUT_DIR = Path(__file__).parent
OUTPUT_DIR.mkdir(exist_ok=True)

# ============================================================================
# 测试模式标志 - 启用时直接返回测试图片，跳过真实生成
# 调试完成后请将 USE_TEST_IMAGE 设置为 False 或注释掉相关代码
# ============================================================================
USE_TEST_IMAGE = False  # 设置为 False 或注释掉以使用真实生成
TEST_IMAGE_FILENAME = "generated_image_20251109_215652.png"
# ============================================================================

# 处理图片文件的 OPTIONS 预检请求
@app.options("/images/{filename}")
async def options_image(filename: str):
    """处理图片文件的 CORS 预检请求"""
    return JSONResponse(
        content={},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "3600",
        }
    )

# 自定义图片路由，确保返回正确的 CORS 头
@app.get("/images/{filename}")
async def get_image(filename: str):
    """
    获取生成的图片文件，确保返回正确的 CORS 头
    """
    image_path = OUTPUT_DIR / filename
    
    if not image_path.exists() or not image_path.is_file():
        raise HTTPException(status_code=404, detail="图片文件不存在")
    
    # 检查文件扩展名，确保是图片文件
    if not filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg')):
        raise HTTPException(status_code=400, detail="不支持的文件类型")
    
    # 确定正确的 media type
    ext = filename.split('.')[-1].lower()
    media_type_map = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'svg': 'image/svg+xml'
    }
    media_type = media_type_map.get(ext, 'image/png')
    
    return FileResponse(
        path=str(image_path),
        media_type=media_type,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        }
    )

# 挂载静态文件服务（作为备用，但优先使用上面的路由）
# app.mount("/images", StaticFiles(directory=str(OUTPUT_DIR)), name="images")

class GenerateRequest(BaseModel):
    prompt: str
    aspect_ratio: Optional[str] = "16:9"
    image_url: Optional[str] = None
    max_tokens: Optional[int] = 150
    temperature: Optional[float] = 0.7

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """处理请求验证错误"""
    logger.error(f"请求验证失败: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "detail": "请求格式错误",
            "errors": exc.errors()
        }
    )

def extract_image_data(result: dict) -> Tuple[Optional[str], Optional[str]]:
    """
    从 API 响应中提取图片数据（URL 或 base64）
    返回: (image_url, image_base64)
    """
    image_url_result = None
    image_base64 = None
    
    if not isinstance(result, dict):
        return None, None
    
    # 检查 choices 字段
    if "choices" in result and len(result["choices"]) > 0:
        choice = result["choices"][0]
        if "message" in choice:
            content = choice["message"].get("content", "")
            
            if isinstance(content, str):
                # 检查是否是 Markdown 格式的图片链接
                markdown_image_pattern = r'!\[.*?\]\((.*?)\)'
                markdown_matches = re.findall(markdown_image_pattern, content)
                if markdown_matches:
                    image_url_result = markdown_matches[0]
                    logger.info(f"从 Markdown 中提取到图片 URL")
                
                # 检查是否是 base64 编码的图片
                content_len = len(content)
                if content_len > 1000:
                    # 检查是否是 data URI 格式
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
                            # 如果都失败，但字符串很长（>5000字符），仍然尝试作为 base64
                            if content_len > 5000:
                                logger.info(f"检测到长字符串（{content_len}字符），尝试作为 base64 图片")
                                image_base64 = content
                elif content.startswith("data:image"):
                    # data URI 格式
                    if "base64," in content:
                        image_base64 = content.split("base64,")[1]
            elif isinstance(content, dict):
                if "image_url" in content:
                    image_url_result = content["image_url"]
                elif "image" in content:
                    image_base64 = content["image"]
    
    # 检查其他可能的字段
    if not image_url_result and not image_base64:
        if "images" in result and isinstance(result["images"], list) and len(result["images"]) > 0:
            image_url_result = result["images"][0]
        elif "image_url" in result:
            image_url_result = result["image_url"]
        elif "image" in result:
            image_base64 = result["image"]
        elif "data" in result and isinstance(result["data"], list) and len(result["data"]) > 0:
            image_url_result = result["data"][0].get("url") or result["data"][0].get("image_url")
            if not image_url_result:
                image_base64 = result["data"][0].get("image") or result["data"][0].get("b64_json")
    
    return image_url_result, image_base64

def save_image_from_base64(image_base64: str, output_dir: Path) -> Optional[str]:
    """从 base64 数据保存图片，返回文件路径"""
    try:
        # 确保 base64 字符串长度是 4 的倍数
        padding = 4 - (len(image_base64) % 4)
        if padding != 4:
            image_base64 += "=" * padding
        
        image_data = base64.b64decode(image_base64)
        
        # 生成文件名
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        image_filename = output_dir / f"generated_image_{timestamp}.png"
        
        # 保存图片
        with open(image_filename, 'wb') as f:
            f.write(image_data)
        
        logger.info(f"图片已保存到: {image_filename}")
        return str(image_filename)
    except Exception as e:
        logger.error(f"保存图片时出错: {e}")
        return None

def save_image_from_url(image_url: str, output_dir: Path) -> Optional[str]:
    """从 URL 下载并保存图片，返回文件路径"""
    try:
        img_response = requests.get(image_url, timeout=30)
        img_response.raise_for_status()
        
        # 生成文件名
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        ext = os.path.splitext(image_url.split('?')[0])[1] or '.png'
        image_filename = output_dir / f"generated_image_{timestamp}{ext}"
        
        # 保存图片
        with open(image_filename, 'wb') as f:
            f.write(img_response.content)
        
        logger.info(f"图片已下载并保存到: {image_filename}")
        return str(image_filename)
    except Exception as e:
        logger.error(f"下载图片时出错: {e}")
        return None

@app.options("/api/generate")
async def options_generate():
    """处理 CORS 预检请求"""
    return JSONResponse(content={}, status_code=200)

@app.post("/api/generate")
async def generate_image(request: GenerateRequest):
    """
    生成图像
    
    参数:
    - prompt: 图片描述文本
    - aspect_ratio: 图片宽高比，默认 "16:9"
    - image_url: 可选的参考图片 URL（用于图片到图片生成）
    - max_tokens: 最大 token 数，默认 150
    - temperature: 温度参数，默认 0.7
    """
    try:
        # ====================================================================
        # 测试模式：直接返回测试图片（快速测试用）
        # 调试完成后请注释掉或设置 USE_TEST_IMAGE = False
        # ====================================================================
        if USE_TEST_IMAGE:
            test_image_path = OUTPUT_DIR / TEST_IMAGE_FILENAME
            if test_image_path.exists():
                logger.info(f"[测试模式] 直接返回测试图片: {TEST_IMAGE_FILENAME}")
                image_data_url = f"http://127.0.0.1:8083/images/{TEST_IMAGE_FILENAME}"
                return JSONResponse(content={
                    "success": True,
                    "image_url": image_data_url,
                    "prompt": request.prompt,
                    "aspect_ratio": request.aspect_ratio,
                    "saved_file": str(test_image_path),
                    "test_mode": True  # 标记这是测试模式
                })
            else:
                logger.warning(f"[测试模式] 测试图片不存在: {test_image_path}，切换到正常模式")
        # ====================================================================
        
        logger.info(f"生成图像请求: {request.prompt[:50]}...")
        logger.info(f"请求参数: aspect_ratio={request.aspect_ratio}, max_tokens={request.max_tokens}, temperature={request.temperature}")
        
        # 构建请求头
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}"
        }
        
        # 构建消息内容
        user_content = [
            {
                "type": "text",
                "text": request.prompt
            }
        ]
        
        # 如果提供了参考图片 URL，添加到内容中
        if request.image_url:
            user_content.append({
                "type": "image_url",
                "image_url": {
                    "url": request.image_url
                }
            })
        
        # 构建请求体
        payload = {
            "extra_body": {
                "imageConfig": {
                    "aspectRatio": request.aspect_ratio
                }
            },
            "model": MODEL,
            "messages": [
                {
                    "role": "system",
                    "content": json.dumps({
                        "imageConfig": {
                            "aspectRatio": request.aspect_ratio
                        }
                    })
                },
                {
                    "role": "user",
                    "content": user_content
                }
            ],
            "max_tokens": request.max_tokens,
            "temperature": request.temperature
        }
        
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
        logger.info("API 响应成功")
        logger.info(f"响应类型: {type(result)}")
        if isinstance(result, dict):
            logger.info(f"响应键: {list(result.keys())}")
            # 打印部分响应内容用于调试（不打印完整的base64数据）
            debug_result = {}
            for key, value in result.items():
                if isinstance(value, str) and len(value) > 200:
                    debug_result[key] = f"[字符串，长度: {len(value)}]"
                elif isinstance(value, list) and len(value) > 0:
                    debug_result[key] = f"[列表，长度: {len(value)}]"
                else:
                    debug_result[key] = value
            logger.info(f"响应内容（简化）: {json.dumps(debug_result, ensure_ascii=False)[:500]}")
        
        # 提取图片数据
        image_url_result, image_base64 = extract_image_data(result)
        logger.info(f"提取结果: image_url={image_url_result is not None}, image_base64={image_base64 is not None}")
        
        # 处理图片数据
        saved_file_path = None
        image_data_url = None
        
        if image_base64:
            logger.info(f"处理 base64 图像数据，长度: {len(image_base64)}")
            # 保存 base64 图片
            saved_file_path = save_image_from_base64(image_base64, OUTPUT_DIR)
            if saved_file_path:
                # 验证保存的文件
                file_size = os.path.getsize(saved_file_path)
                logger.info(f"图片已保存，文件大小: {file_size} 字节")
                if file_size > 0:
                    # 使用文件URL而不是data URL（更可靠）
                    filename = os.path.basename(saved_file_path)
                    image_data_url = f"http://127.0.0.1:8083/images/{filename}"
                    logger.info(f"使用文件URL: {image_data_url}")
                else:
                    logger.error("保存的图像文件大小为0")
        elif image_url_result:
            logger.info(f"处理 URL 图像: {image_url_result}")
            # 下载并保存 URL 图片
            saved_file_path = save_image_from_url(image_url_result, OUTPUT_DIR)
            if saved_file_path:
                # 验证保存的文件
                file_size = os.path.getsize(saved_file_path)
                logger.info(f"图片已下载，文件大小: {file_size} 字节")
                if file_size > 0:
                    # 使用文件URL而不是data URL（更可靠）
                    filename = os.path.basename(saved_file_path)
                    image_data_url = f"http://127.0.0.1:8083/images/{filename}"
                    logger.info(f"使用文件URL: {image_data_url}")
                else:
                    logger.error("下载的图像文件大小为0")
            else:
                # 如果下载失败，直接返回 URL
                logger.warning("下载失败，直接返回 URL")
                image_data_url = image_url_result
        
        if not image_data_url:
            raise HTTPException(
                status_code=500,
                detail="无法从 API 响应中提取图片数据"
            )
        
        # 返回结果
        return JSONResponse(content={
            "success": True,
            "image_url": image_data_url,
            "prompt": request.prompt,
            "aspect_ratio": request.aspect_ratio,
            "saved_file": saved_file_path
        })
        
    except requests.exceptions.HTTPError as e:
        error_detail = "API 请求失败"
        try:
            error_response = e.response.json()
            error_detail = json.dumps(error_response, ensure_ascii=False)
        except:
            error_detail = e.response.text or str(e)
        
        logger.error(f"HTTP 错误: {e.response.status_code} - {error_detail}")
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"API 请求失败: {error_detail}"
        )
        
    except requests.exceptions.RequestException as e:
        logger.error(f"请求错误: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"请求错误: {str(e)}"
        )
        
    except Exception as e:
        logger.error(f"处理请求时出错: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"处理请求时出错: {str(e)}"
        )

@app.get("/api/health")
async def health_check():
    """健康检查"""
    return JSONResponse(content={
        "status": "healthy",
        "api_url": API_URL,
        "model": MODEL,
        "has_api_key": bool(API_KEY)
    })

if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="127.0.0.1",
        port=8083,
        reload=True,
        log_level="info"
    )

