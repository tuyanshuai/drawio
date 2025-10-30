/**
 * 伪3D立方体计算工具
 * 用于根据输入角度计算伪3D立方体的点和线位置
 */

// 等距向量定义
var isoHVector = new mxPoint(1, 0);
var isoVVector = new mxPoint(1, 0);

// 初始化等距向量
function initIsoVectors() {
    var alpha1 = mxUtils.toRadians(-30);
    var cos1 = Math.cos(alpha1);
    var sin1 = Math.sin(alpha1);
    isoHVector = mxUtils.getRotatedPoint(isoHVector, cos1, sin1);

    var alpha2 = mxUtils.toRadians(-150);
    var cos2 = Math.cos(alpha2);
    var sin2 = Math.sin(alpha2);
    isoVVector = mxUtils.getRotatedPoint(isoVVector, cos2, sin2);
}

// 初始化等距向量
initIsoVectors();

/**
 * 根据输入角度计算伪3D立方体的顶点坐标
 * @param {number} x - 立方体左上角x坐标
 * @param {number} y - 立方体左上角y坐标
 * @param {number} width - 立方体宽度
 * @param {number} height - 立方体高度
 * @param {number} depth - 立方体深度（默认等于宽度的一半）
 * @param {number} isoAngle - 等距角度（默认15度）
 * @returns {Object} 包含8个顶点坐标的对象
 */
function calculateCubeVertices(x, y, width, height, depth, isoAngle) {
    // 默认参数处理
    depth = depth || width * 0.5;
    isoAngle = isoAngle || 15;
    
    // 确保角度在有效范围内并转换为弧度
    isoAngle = Math.max(0.01, Math.min(94, isoAngle)) * Math.PI / 200;
    
    // 计算等距高度
    var isoH = Math.min(width * Math.tan(isoAngle), height * 0.5);
    
    // 计算8个顶点坐标
    // 前面
    var frontTopLeft = new mxPoint(x + width * 0.5, y);
    var frontTopRight = new mxPoint(x + width, y + isoH);
    var frontBottomRight = new mxPoint(x + width, y + height - isoH);
    var frontBottomLeft = new mxPoint(x + width * 0.5, y + height);
    
    // 后面
    var backTopLeft = new mxPoint(x + width * 0.5 - depth * 0.5, y + depth * 0.5);
    var backTopRight = new mxPoint(x + width - depth * 0.5, y + isoH + depth * 0.5);
    var backBottomRight = new mxPoint(x + width - depth * 0.5, y + height - isoH + depth * 0.5);
    var backBottomLeft = new mxPoint(x + width * 0.5 - depth * 0.5, y + height + depth * 0.5);
    
    return {
        frontTopLeft: frontTopLeft,
        frontTopRight: frontTopRight,
        frontBottomRight: frontBottomRight,
        frontBottomLeft: frontBottomLeft,
        backTopLeft: backTopLeft,
        backTopRight: backTopRight,
        backBottomRight: backBottomRight,
        backBottomLeft: backBottomLeft
    };
}

/**
 * 计算立方体的12条边
 * @param {Object} vertices - 立方体的8个顶点
 * @returns {Array} 包含12条边的数组，每条边由两个点组成
 */
function calculateCubeEdges(vertices) {
    return [
        // 前面
        { start: vertices.frontTopLeft, end: vertices.frontTopRight },
        { start: vertices.frontTopRight, end: vertices.frontBottomRight },
        { start: vertices.frontBottomRight, end: vertices.frontBottomLeft },
        { start: vertices.frontBottomLeft, end: vertices.frontTopLeft },
        
        // 后面
        { start: vertices.backTopLeft, end: vertices.backTopRight },
        { start: vertices.backTopRight, end: vertices.backBottomRight },
        { start: vertices.backBottomRight, end: vertices.backBottomLeft },
        { start: vertices.backBottomLeft, end: vertices.backTopLeft },
        
        // 连接线
        { start: vertices.frontTopLeft, end: vertices.backTopLeft },
        { start: vertices.frontTopRight, end: vertices.backTopRight },
        { start: vertices.frontBottomRight, end: vertices.backBottomRight },
        { start: vertices.frontBottomLeft, end: vertices.backBottomLeft }
    ];
}

/**
 * 使用等距风格计算两点之间的连接线
 * @param {mxPoint} start - 起始点
 * @param {mxPoint} end - 结束点
 * @param {boolean} horizontalFirst - 是否先水平后垂直
 * @returns {Array} 包含中间点的数组，用于绘制等距连接线
 */
function calculateIsometricLine(start, end, horizontalFirst) {
    var result = [];
    var last = start;
    
    var a1 = isoHVector.x;
    var a2 = isoHVector.y;
    var b1 = isoVVector.x;
    var b2 = isoVVector.y;
    
    var c1 = end.x - last.x;
    var c2 = end.y - last.y;

    // 求解等距基向量的系数
    var h = (b2 * c1 - b1 * c2) / (a1 * b2 - a2 * b1);
    var v = (a2 * c1 - a1 * c2) / (a2 * b1 - a1 * b2);
    
    if (horizontalFirst) {
        // 先水平后垂直
        last = new mxPoint(last.x + a1 * h, last.y + a2 * h);
        result.push(last);
        last = new mxPoint(last.x + b1 * v, last.y + b2 * v);
        result.push(last);
    } else {
        // 先垂直后水平
        last = new mxPoint(last.x + b1 * v, last.y + b2 * v);
        result.push(last);
        last = new mxPoint(last.x + a1 * h, last.y + a2 * h);
        result.push(last);
    }
    
    return result;
}

/**
 * 根据给定角度和尺寸绘制伪3D立方体
 * @param {mxAbstractCanvas2D} canvas - 绘图上下文
 * @param {number} x - x坐标
 * @param {number} y - y坐标
 * @param {number} width - 宽度
 * @param {number} height - 高度
 * @param {number} depth - 深度
 * @param {number} isoAngle - 等距角度
 * @param {string} fillColor - 填充颜色
 * @param {string} strokeColor - 边框颜色
 */
function drawPseudo3DCube(canvas, x, y, width, height, depth, isoAngle, fillColor, strokeColor) {
    // 计算顶点
    var vertices = calculateCubeVertices(x, y, width, height, depth, isoAngle);
    
    // 设置样式
    canvas.setFillColor(fillColor || '#ffffff');
    canvas.setStrokeColor(strokeColor || '#000000');
    
    // 绘制背面（可选）
    // 通常背面不绘制或使用较浅的颜色
    
    // 绘制前面
    canvas.begin();
    canvas.moveTo(vertices.frontTopLeft.x, vertices.frontTopLeft.y);
    canvas.lineTo(vertices.frontTopRight.x, vertices.frontTopRight.y);
    canvas.lineTo(vertices.frontBottomRight.x, vertices.frontBottomRight.y);
    canvas.lineTo(vertices.frontBottomLeft.x, vertices.frontBottomLeft.y);
    canvas.close();
    canvas.fillAndStroke();
    
    // 绘制连接线
    canvas.begin();
    // 顶部连接线
    canvas.moveTo(vertices.frontTopLeft.x, vertices.frontTopLeft.y);
    canvas.lineTo(vertices.backTopLeft.x, vertices.backTopLeft.y);
    canvas.moveTo(vertices.frontTopRight.x, vertices.frontTopRight.y);
    canvas.lineTo(vertices.backTopRight.x, vertices.backTopRight.y);
    // 底部连接线
    canvas.moveTo(vertices.frontBottomLeft.x, vertices.frontBottomLeft.y);
    canvas.lineTo(vertices.backBottomLeft.x, vertices.backBottomLeft.y);
    canvas.moveTo(vertices.frontBottomRight.x, vertices.frontBottomRight.y);
    canvas.lineTo(vertices.backBottomRight.x, vertices.backBottomRight.y);
    // 后面边框（可选）
    canvas.moveTo(vertices.backTopLeft.x, vertices.backTopLeft.y);
    canvas.lineTo(vertices.backTopRight.x, vertices.backTopRight.y);
    canvas.lineTo(vertices.backBottomRight.x, vertices.backBottomRight.y);
    canvas.lineTo(vertices.backBottomLeft.x, vertices.backBottomLeft.y);
    canvas.close();
    canvas.stroke();
}

// 导出函数，使其在mxGraph环境中可用
if (typeof window !== 'undefined') {
    window.Pseudo3DCube = {
        calculateCubeVertices: calculateCubeVertices,
        calculateCubeEdges: calculateCubeEdges,
        calculateIsometricLine: calculateIsometricLine,
        drawPseudo3DCube: drawPseudo3DCube
    };
}