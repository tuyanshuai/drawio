"""
NanoBanana 图像生成代理服务
套壳 nanobanana API，用于生成科研 BioRender 风格的插图
"""

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import uvicorn
import httpx
import os
import logging
from typing import Optional
from pydantic import BaseModel

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="NanoBanana Image Generation API",
    description="套壳 nanobanana API，用于生成科研 BioRender 风格的插图",
    version="1.0.0"
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 从环境变量或默认值获取配置
NANOBANANA_API_URL = os.getenv("NANOBANANA_API_URL", "https://api.nanobnana.com/v1/images/generations")
NANOBANANA_API_KEY = os.getenv("NANOBANANA_API_KEY", "")
DEFAULT_WIDTH = int(os.getenv("IMAGE_WIDTH", "1024"))
DEFAULT_HEIGHT = int(os.getenv("IMAGE_HEIGHT", "1024"))

class GenerateRequest(BaseModel):
    prompt: str
    width: Optional[int] = DEFAULT_WIDTH
    height: Optional[int] = DEFAULT_HEIGHT
    n: Optional[int] = 1
    size: Optional[str] = None
    response_format: Optional[str] = "url"

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """处理请求验证错误"""
    logger.error(f"请求验证失败: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={
            "detail": "请求格式错误",
            "errors": exc.errors()
        }
    )

def enhance_prompt_for_biorender(prompt: str) -> str:
    """增强提示词，添加 BioRender 风格描述"""
    enhanced = (
        "Scientific illustration, BioRender style, " + prompt + 
        ". Clean, professional scientific diagram with soft colors, " +
        "minimalist design, clear labeling, scientific accuracy, " +
        "vector art style, research publication quality, " +
        "smooth gradients, modern biology illustration."
    )
    return enhanced

@app.post("/api/generate")
async def generate_image(request: GenerateRequest):
    """
    生成图像
    
    参数:
    - prompt: 图像描述文本
    - width: 图像宽度（默认 1024）
    - height: 图像高度（默认 1024）
    - n: 生成图像数量（默认 1）
    - size: 图像尺寸（格式：WIDTHxHEIGHT，优先级高于 width/height）
    - response_format: 响应格式（url 或 b64_json，默认 url）
    """
    try:
        # 增强提示词
        enhanced_prompt = enhance_prompt_for_biorender(request.prompt)
        
        logger.info(f"生成图像请求: {request.prompt[:50]}...")
        
        # 确定图像尺寸
        if request.size:
            image_size = request.size
        else:
            image_size = f"{request.width}x{request.height}"
        
        # 准备请求数据
        payload = {
            "prompt": enhanced_prompt,
            "n": request.n or 1,
            "size": image_size,
            "response_format": request.response_format or "url"
        }
        
        # 准备请求头
        headers = {
            "Content-Type": "application/json"
        }
        
        if NANOBANANA_API_KEY:
            headers["Authorization"] = f"Bearer {NANOBANANA_API_KEY}"
        
        # 调用 NanoBanana API
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(
                    NANOBANANA_API_URL,
                    json=payload,
                    headers=headers
                )
                response.raise_for_status()
                
                result = response.json()
                logger.info(f"API 响应成功: {type(result)}")
                
                # 标准化响应格式
                # 尝试提取图像 URL
                image_url = None
                
                if isinstance(result, dict):
                    if "data" in result and isinstance(result["data"], list) and len(result["data"]) > 0:
                        # 格式: {data: [{url: "..."}]}
                        image_url = result["data"][0].get("url") or result["data"][0].get("image_url")
                    elif "image_url" in result:
                        # 格式: {image_url: "..."}
                        image_url = result["image_url"]
                    elif "url" in result:
                        # 格式: {url: "..."}
                        image_url = result["url"]
                    elif "images" in result and isinstance(result["images"], list) and len(result["images"]) > 0:
                        # 格式: {images: ["..."]}
                        image_url = result["images"][0]
                
                if image_url:
                    return JSONResponse(content={
                        "success": True,
                        "image_url": image_url,
                        "prompt": request.prompt,
                        "enhanced_prompt": enhanced_prompt,
                        "size": image_size
                    })
                else:
                    # 如果无法提取 URL，返回原始响应
                    logger.warning(f"无法从响应中提取图像 URL，返回原始响应: {result}")
                    return JSONResponse(content={
                        "success": True,
                        "raw_response": result,
                        "prompt": request.prompt,
                        "enhanced_prompt": enhanced_prompt
                    })
                    
            except httpx.HTTPStatusError as e:
                error_detail = "API 请求失败"
                try:
                    error_response = e.response.json()
                    error_detail = error_response.get("error", {}).get("message", str(e))
                except:
                    error_detail = e.response.text or str(e)
                
                logger.error(f"API HTTP 错误: {e.response.status_code} - {error_detail}")
                raise HTTPException(
                    status_code=e.response.status_code,
                    detail=f"API 请求失败: {error_detail}"
                )
            except httpx.TimeoutException:
                logger.error("API 请求超时")
                raise HTTPException(
                    status_code=504,
                    detail="API 请求超时，请稍后重试"
                )
            except httpx.RequestError as e:
                logger.error(f"API 请求错误: {e}")
                raise HTTPException(
                    status_code=502,
                    detail=f"API 请求失败: {str(e)}"
                )
                
    except HTTPException:
        raise
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
        "api_url": NANOBANANA_API_URL,
        "has_api_key": bool(NANOBANANA_API_KEY)
    })

if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="127.0.0.1",
        port=8083,
        reload=True,
        log_level="info"
    )

