"""
AI Converter 后端服务
使用 SAM (Segment Anything Model) 进行图像分割，返回多边形数据
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.exceptions import RequestValidationError
import uvicorn
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import io
import json
import base64
from typing import List, Dict, Any
import logging
import os

from sam_processor import SAMProcessor

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Converter API",
    description="使用 SAM 进行图像分割，返回多边形数据",
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

# 自定义验证错误处理
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """处理请求验证错误，返回更详细的错误信息"""
    logger.error(f"请求验证失败: {exc.errors()}")
    logger.error(f"请求路径: {request.url.path}")
    logger.error(f"请求方法: {request.method}")
    logger.error(f"请求头: {dict(request.headers)}")
    
    return JSONResponse(
        status_code=422,
        content={
            "detail": "请求格式错误",
            "errors": exc.errors(),
            "body": exc.body if hasattr(exc, 'body') else None
        }
    )

# 初始化 SAM 处理器
sam_processor = None

@app.on_event("startup")
async def startup_event():
    """启动时初始化 SAM 模型"""
    global sam_processor
    try:
        logger.info("正在初始化 SAM 模型...")
        sam_processor = SAMProcessor()
        logger.info("SAM 模型初始化完成")
    except ImportError as e:
        logger.error(f"SAM 依赖未安装: {e}")
        logger.error("请运行以下命令安装 SAM:")
        logger.error("pip install git+https://github.com/facebookresearch/segment-anything.git")
        logger.error("或者如果有网络问题，请手动下载 segment-anything 仓库并安装")
        sam_processor = None
    except FileNotFoundError as e:
        logger.error(f"SAM 模型文件未找到: {e}")
        logger.error("请下载 SAM 模型文件:")
        logger.error("- ViT-H: https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth")
        logger.error("- ViT-L: https://dl.fbaipublicfiles.com/segment_anything/sam_vit_l_0b3195.pth")
        logger.error("- ViT-B: https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth")
        logger.error(f"并保存到: {os.path.join(os.path.dirname(__file__), 'checkpoints')}")
        sam_processor = None
    except Exception as e:
        logger.error(f"SAM 模型初始化失败: {e}")
        logger.error("请检查 SAM 相关依赖和模型文件")
        sam_processor = None

@app.get("/")
async def root():
    """根路径，返回 API 信息"""
    return {
        "service": "AI Converter",
        "version": "1.0.0",
        "description": "使用 SAM 进行图像分割，返回多边形数据",
        "endpoints": {
            "/": "API 信息",
            "/health": "健康检查",
            "/api/segment": "图像分割接口 (POST)"
        },
        "port": 8081
    }

@app.get("/health")
async def health_check():
    """健康检查接口"""
    return {
        "status": "healthy",
        "sam_loaded": sam_processor is not None
    }

@app.get("/api/image/original")
async def get_original_image():
    """获取正在处理的原始图片"""
    image_path = os.path.join(os.path.dirname(__file__), "temp_original.png")
    if os.path.exists(image_path):
        return Response(content=open(image_path, "rb").read(), media_type="image/png")
    else:
        raise HTTPException(status_code=404, detail="原始图片不存在")

@app.get("/api/image/visualization")
async def get_visualization_image():
    """获取可视化结果图片"""
    image_path = os.path.join(os.path.dirname(__file__), "temp_visualization.png")
    if os.path.exists(image_path):
        return Response(content=open(image_path, "rb").read(), media_type="image/png")
    else:
        raise HTTPException(status_code=404, detail="可视化图片不存在")

def visualize_segments(image: Image.Image, polygons: List[Dict]) -> Image.Image:
    """在原图上可视化分割结果"""
    # 创建原图的副本
    vis_image = image.copy()
    draw = ImageDraw.Draw(vis_image)
    
    # 定义颜色列表（用于不同区域）
    colors = [
        (255, 0, 0),    # 红色
        (0, 255, 0),    # 绿色
        (0, 0, 255),    # 蓝色
        (255, 255, 0),  # 黄色
        (255, 0, 255),  # 品红
        (0, 255, 255),  # 青色
        (255, 128, 0),  # 橙色
        (128, 0, 255),  # 紫色
    ]
    
    # 绘制每个分割区域
    for i, polygon in enumerate(polygons):
        color = colors[i % len(colors)]
        points = polygon['points']
        
        # 绘制填充区域（半透明）
        if len(points) >= 3:
            # 转换为元组列表
            points_tuple = [tuple(p) for p in points]
            # 绘制半透明填充
            overlay = Image.new('RGBA', vis_image.size, (0, 0, 0, 0))
            overlay_draw = ImageDraw.Draw(overlay)
            overlay_draw.polygon(points_tuple, fill=(*color, 100))
            vis_image = Image.alpha_composite(vis_image.convert('RGBA'), overlay).convert('RGB')
        
        # 重新创建 draw 对象（因为图像已更改）
        draw = ImageDraw.Draw(vis_image)
        
        # 绘制轮廓
        if len(points) >= 2:
            for j in range(len(points)):
                start = tuple(points[j])
                end = tuple(points[(j + 1) % len(points)])
                draw.line([start, end], fill=color, width=2)
        
        # 绘制区域ID（在边界框中心）
        bbox = polygon.get('bbox', [])
        if len(bbox) >= 4:
            center_x = (bbox[0] + bbox[2]) // 2
            center_y = (bbox[1] + bbox[3]) // 2
            try:
                # 尝试使用默认字体
                font = ImageFont.load_default()
            except:
                font = None
            draw.text((center_x, center_y), str(polygon['id']), fill=(255, 255, 255), font=font)
    
    return vis_image

@app.post("/api/segment")
async def segment_image(
    file: UploadFile = File(...),
    threshold: float = Query(0.5, ge=0.0, le=1.0),
    min_area: int = Query(100, ge=0),
    return_image: bool = Query(False, description="是否返回可视化图片")
):
    """
    图像分割接口
    
    参数:
    - file: 上传的图片文件 (multipart/form-data)
    - threshold: 分割阈值 (0-1，默认 0.5)
    - min_area: 最小区域面积，小于此面积的区域会被过滤 (默认 100)
    - return_image: 是否返回可视化图片 (默认 False)
    
    返回:
    - JSON 格式的多边形数据，包含多个分割区域
    - 如果 return_image=true，还会包含 visualization 字段（base64 编码的图片）
    """
    if sam_processor is None:
        raise HTTPException(
            status_code=503,
            detail="SAM 模型未初始化，请检查模型文件是否正确配置"
        )
    
    # 验证文件类型
    if not file.content_type or not file.content_type.startswith('image/'):
        logger.warning(f"不支持的文件类型: {file.content_type}")
        # 尝试读取文件内容来判断类型
        try:
            image_data = await file.read()
            await file.seek(0)  # 重置文件指针
            image = Image.open(io.BytesIO(image_data))
            image_format = image.format
            if image_format not in ['JPEG', 'PNG', 'GIF', 'BMP', 'WEBP']:
                raise HTTPException(
                    status_code=400,
                    detail=f"不支持的图片格式: {image_format or '未知'}"
                )
        except Exception as e:
            logger.error(f"无法读取图片文件: {e}")
            raise HTTPException(
                status_code=400,
                detail=f"请上传有效的图片文件: {str(e)}"
            )
    
    try:
        # 读取图片
        image_data = await file.read()
        image = Image.open(io.BytesIO(image_data)).convert("RGB")
        # 确保数组是连续的且类型正确
        image_array = np.ascontiguousarray(np.array(image, dtype=np.uint8))
        
        logger.info(f"接收到图片: {file.filename}, 尺寸: {image_array.shape}, dtype: {image_array.dtype}, 类型: {file.content_type}")
        logger.info(f"参数: threshold={threshold}, min_area={min_area}, return_image={return_image}")
        
        # 保存原始图片（用于显示）
        original_path = os.path.join(os.path.dirname(__file__), "temp_original.png")
        image.save(original_path)
        logger.info(f"原始图片已保存到: {original_path}")
        
        # 执行 SAM 分割
        logger.info("开始执行 SAM 分割...")
        polygons = sam_processor.segment_image(
            image_array,
            threshold=threshold,
            min_area=min_area
        )
        
        logger.info(f"分割完成，找到 {len(polygons)} 个区域")
        
        # 构建响应数据
        response_data = {
            "success": True,
            "image_size": {
                "width": image.width,
                "height": image.height
            },
            "segments": polygons,
            "segment_count": len(polygons),
            "parameters": {
                "threshold": threshold,
                "min_area": min_area
            }
        }
        
        # 生成可视化图片（始终生成，用于保存）
        try:
            vis_image = visualize_segments(image, polygons)
            # 保存可视化图片
            vis_path = os.path.join(os.path.dirname(__file__), "temp_visualization.png")
            vis_image.save(vis_path)
            logger.info(f"可视化图片已保存到: {vis_path}")
            
            # 如果需要返回可视化图片，添加到响应中
            if return_image:
                # 将图片转换为 base64
                img_buffer = io.BytesIO()
                vis_image.save(img_buffer, format='PNG')
                img_base64 = base64.b64encode(img_buffer.getvalue()).decode('utf-8')
                response_data["visualization"] = f"data:image/png;base64,{img_base64}"
                logger.info("可视化图片已添加到响应中")
        except Exception as e:
            logger.warning(f"生成可视化图片失败: {e}")
        
        return JSONResponse(content=response_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"处理图片时出错: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"处理图片时出错: {str(e)}"
        )

if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="127.0.0.1",
        port=8081,
        reload=True,
        log_level="info"
    )

