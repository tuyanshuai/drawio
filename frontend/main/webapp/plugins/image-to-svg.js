/**
 * 图片转SVG插件 - 将PNG/BMP/JPG图片转换为SVG格式
 * 参考: https://github.com/visioncortex/vtracer/tree/master/webapp
 */
Draw.loadPlugin(function(editorUi)
{
	if (editorUi.editor.isChromelessView())
	{
		return;
	}
	
	var graph = editorUi.editor.graph;
	
	/**
	 * 检查cell是否为PNG/BMP/JPG图片
	 */
	function isRasterImage(cell)
	{
		if (!cell || !graph.getModel().isVertex(cell))
		{
			return false;
		}
		
		var state = graph.view.getState(cell);
		var style = (state != null) ? state.style : graph.getCellStyle(cell);
		var image = (style != null) ? mxUtils.getValue(style, mxConstants.STYLE_IMAGE, null) : null;
		
		if (!image)
		{
			return false;
		}
		
		var lowerImage = String(image).toLowerCase();
		
		// 排除SVG图片
		if (lowerImage.indexOf('data:image/svg') === 0 || /\.svg(\?.*)?$/i.test(lowerImage))
		{
			return false;
		}
		
		// 检查是否为PNG/BMP/JPG
		var isPng = lowerImage.indexOf('data:image/png') === 0 || /\.png(\?.*)?$/i.test(lowerImage);
		var isJpg = lowerImage.indexOf('data:image/jpeg') === 0 || lowerImage.indexOf('data:image/jpg') === 0 || 
			/\.jpe?g(\?.*)?$/i.test(lowerImage);
		var isBmp = lowerImage.indexOf('data:image/bmp') === 0 || /\.bmp(\?.*)?$/i.test(lowerImage);
		
		return isPng || isJpg || isBmp;
	}
	
	/**
	 * 获取图片的base64 data URI
	 */
	function getImageDataUri(imageUrl, callback)
	{
		if (imageUrl.substring(0, 5) === 'data:')
		{
			// 已经是data URI
			callback(imageUrl);
			return;
		}
		
		// 如果是URL，需要加载并转换为data URI
		var img = new Image();
		
		if (editorUi.crossOriginImages)
		{
			img.crossOrigin = 'anonymous';
		}
		
		img.onload = function()
		{
			try
			{
				var canvas = document.createElement('canvas');
				var ctx = canvas.getContext('2d');
				canvas.width = img.width;
				canvas.height = img.height;
				ctx.drawImage(img, 0, 0);
				
				// 根据原始图片格式确定MIME类型
				var mimeType = 'image/png';
				var lowerUrl = imageUrl.toLowerCase();
				if (/\.jpe?g(\?.*)?$/i.test(lowerUrl) || imageUrl.indexOf('data:image/jpeg') === 0 || imageUrl.indexOf('data:image/jpg') === 0)
				{
					mimeType = 'image/jpeg';
				}
				else if (/\.bmp(\?.*)?$/i.test(lowerUrl) || imageUrl.indexOf('data:image/bmp') === 0)
				{
					mimeType = 'image/bmp';
				}
				
				var dataUri = canvas.toDataURL(mimeType);
				callback(dataUri);
			}
			catch (e)
			{
				if (window.console)
				{
					console.error('[Image to SVG] 转换图片为data URI失败:', e);
				}
				editorUi.handleError({message: '无法获取图片数据: ' + (e.message || '未知错误')});
				callback(null);
			}
		};
		
		img.onerror = function()
		{
			if (window.console)
			{
				console.error('[Image to SVG] 图片加载失败:', imageUrl);
			}
			editorUi.handleError({message: '无法加载图片'});
			callback(null);
		};
		
		img.src = imageUrl;
	}
	
	/**
	 * 使用vtracer将图片转换为SVG
	 * 参考: https://github.com/visioncortex/vtracer/tree/master/webapp
	 */
	function convertImageToSvg(imageDataUri, callback)
	{
		if (!imageDataUri)
		{
			callback(null);
			return;
		}
		
		if (window.console)
		{
			console.log('[Image to SVG] 开始转换图片为SVG...');
		}
		
		// 检查是否加载了vtracer
		if (typeof window.VTracer === 'undefined')
		{
			// 尝试动态加载vtracer
			loadVtracer(function()
			{
				performConversion(imageDataUri, callback);
			});
		}
		else
		{
			performConversion(imageDataUri, callback);
		}
	}
	
	/**
	 * 加载vtracer库
	 * 参考: https://github.com/visioncortex/vtracer/tree/master/webapp
	 */
	function loadVtracer(callback)
	{
		if (window.console)
		{
			console.log('[Image to SVG] 加载vtracer库...');
		}
		
		// 首先尝试加载ImageTracer.js作为vtracer的替代实现
		// ImageTracer.js是一个纯JavaScript实现的图片矢量化工具，会将位图转换为矢量路径
		// 使用本地文件以避免CSP限制
		if (typeof ImageTracer === 'undefined')
		{
			if (window.console)
			{
				console.log('[Image to SVG] 开始加载ImageTracer.js库（本地）...');
			}
			
			var script = document.createElement('script');
			// 使用本地文件路径，避免CSP限制
			script.src = 'js/imagetracer/imagetracer_v1.2.6.js';
			
			script.onload = function()
			{
				if (window.console)
				{
					console.log('[Image to SVG] ImageTracer.js加载成功');
					// 检查可用的API
					if (typeof ImageTracer !== 'undefined')
					{
						console.log('[Image to SVG] ImageTracer可用方法:', Object.keys(ImageTracer));
					}
				}
				initVtracerWrapper(callback);
			};
			
			script.onerror = function()
			{
				if (window.console)
				{
					console.error('[Image to SVG] ImageTracer.js加载失败:', script.src);
					console.error('[Image to SVG] 将使用基础实现（非矢量化）');
				}
				initVtracerWrapper(callback);
			};
			
			document.head.appendChild(script);
		}
		else
		{
			if (window.console)
			{
				console.log('[Image to SVG] ImageTracer.js已存在');
			}
			initVtracerWrapper(callback);
		}
	}
	
	/**
	 * 初始化vtracer包装器
	 */
	function initVtracerWrapper(callback)
	{
		if (!window.VTracer)
		{
			window.VTracer = {
				convert: function(imageDataUri, options, callback)
				{
					convertWithImageTracer(imageDataUri, options, callback);
				}
			};
		}
		
		if (callback) callback();
	}
	
	/**
	 * 使用ImageTracer.js进行转换
	 * ImageTracer.js是一个类似vtracer的JavaScript实现，会将位图转换为矢量路径（线条和填充）
	 */
	function convertWithImageTracer(imageDataUri, options, callback)
	{
		if (typeof ImageTracer !== 'undefined')
		{
			if (window.console)
			{
				console.log('[Image to SVG] 使用ImageTracer.js进行矢量化转换...');
			}
			
			// 使用ImageTracer.js进行矢量化
			// 配置选项参考vtracer的参数，优化为生成线条和填充
			var tracerOptions = {
				ltres: 1, // 线简化阈值（较小的值保留更多细节）
				qtres: 1, // 二次曲线简化阈值
				pathomit: 8, // 忽略小路径（像素数小于此值的路径会被忽略）
				colorsampling: 2, // 颜色采样：0=所有像素，1=随机，2=边缘检测
				numberofcolors: 32, // 颜色数量（增加以获得更多颜色）
				mincolorratio: 0.005, // 最小颜色比例（降低以保留更多颜色区域）
				colorquantcycles: 3, // 颜色量化周期
				scale: 1, // 缩放
				roundcoords: 1, // 坐标舍入
				viewbox: true, // 使用viewBox
				desc: false, // 不添加描述
				blurradius: 0, // 模糊半径（用于平滑）
				blurdelta: 20, // 模糊增量
				layers: false, // 不使用图层
				strokewidth: 0, // 描边宽度（0表示只使用填充）
				linefilter: false, // 线条过滤
				rightangleenhance: false // 直角增强（关闭以获得更自然的曲线）
			};
			
			// ImageTracer的API调用
			try
			{
				// 方法1：使用imageToSVG（如果可用）
				if (typeof ImageTracer.imageToSVG === 'function')
				{
					ImageTracer.imageToSVG(imageDataUri, function(svgString)
					{
						processTracerResult(svgString, callback);
					}, tracerOptions);
				}
				// 方法2：使用traceImageString（备用方法）
				else if (typeof ImageTracer.traceImageString === 'function')
				{
					var traced = ImageTracer.traceImageString(imageDataUri, tracerOptions);
					if (traced && traced.svg)
					{
						processTracerResult(traced.svg, callback);
					}
					else
					{
						processTracerResult(null, callback);
					}
				}
				// 方法3：使用trace（直接方法）
				else if (typeof ImageTracer.trace === 'function')
				{
					var traced = ImageTracer.trace(imageDataUri, tracerOptions);
					if (traced && traced.svg)
					{
						processTracerResult(traced.svg, callback);
					}
					else
					{
						processTracerResult(null, callback);
					}
				}
				else
				{
					if (window.console)
					{
						console.error('[Image to SVG] ImageTracer API不可用');
						console.log('[Image to SVG] ImageTracer可用方法:', Object.keys(ImageTracer));
					}
					processTracerResult(null, callback);
				}
			}
			catch (e)
			{
				if (window.console)
				{
					console.error('[Image to SVG] ImageTracer转换出错:', e);
				}
				processTracerResult(null, callback);
			}
		}
		else
		{
			// 如果ImageTracer不可用，使用canvas创建基础SVG包装
			// 这不是真正的矢量化，只是将图片嵌入SVG
			if (window.console)
			{
				console.warn('[Image to SVG] ImageTracer不可用，使用基础实现（非矢量化）');
			}
			
			var img = new Image();
			img.onload = function()
			{
				var svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ' +
					'width="' + img.width + '" height="' + img.height + '" viewBox="0 0 ' + img.width + ' ' + img.height + '">' +
					'<image xlink:href="' + imageDataUri + '" width="' + img.width + '" height="' + img.height + '"/>' +
					'</svg>';
				callback(svg);
			};
			img.onerror = function()
			{
				callback(null);
			};
			img.src = imageDataUri;
		}
	}
	
	/**
	 * 处理ImageTracer的转换结果
	 */
	function processTracerResult(svgString, callback)
	{
		if (svgString && svgString.trim().length > 0)
		{
			// 检查SVG是否包含路径（真正的矢量化）
			var hasPaths = /<path[^>]*>/i.test(svgString) || /<polygon[^>]*>/i.test(svgString) || 
				/<polyline[^>]*>/i.test(svgString) || /<circle[^>]*>/i.test(svgString) ||
				/<rect[^>]*>/i.test(svgString) || /<ellipse[^>]*>/i.test(svgString);
			
			if (window.console)
			{
				if (hasPaths)
				{
					console.log('[Image to SVG] 矢量化成功，包含矢量路径');
					// 统计路径数量
					var pathCount = (svgString.match(/<path[^>]*>/gi) || []).length;
					var polygonCount = (svgString.match(/<polygon[^>]*>/gi) || []).length;
					console.log('[Image to SVG] 路径数量:', pathCount + polygonCount);
				}
				else
				{
					console.warn('[Image to SVG] 转换结果可能不包含矢量路径');
				}
			}
			
			callback(svgString);
		}
		else
		{
			if (window.console)
			{
				console.error('[Image to SVG] ImageTracer转换失败，返回空结果');
			}
			callback(null);
		}
	}
	
	/**
	 * 执行实际的转换
	 */
	function performConversion(imageDataUri, callback)
	{
		var options = {
			// vtracer的配置选项
			// 根据vtracer的实际API调整
		};
		
		if (window.VTracer && window.VTracer.convert)
		{
			window.VTracer.convert(imageDataUri, options, function(svgString)
			{
				if (svgString)
				{
					callback(svgString);
				}
				else
				{
					editorUi.handleError({message: '图片转换失败'});
					callback(null);
				}
			});
		}
		else
		{
			// 使用简化实现
			convertWithImageTracer(imageDataUri, options, callback);
		}
	}
	
	/**
	 * 将SVG字符串转换为data URI
	 * 使用base64编码以保持与系统一致
	 */
	function svgToDataUri(svgString)
	{
		if (!svgString)
		{
			return null;
		}
		
		// 使用base64编码，与Editor.createSvgDataUri保持一致
		try
		{
			// 清理SVG字符串，确保格式正确
			svgString = svgString.trim();
			
			// 使用base64编码
			return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
		}
		catch (e)
		{
			if (window.console)
			{
				console.error('[Image to SVG] SVG编码失败:', e);
			}
			// 降级到URL编码
			var encoded = encodeURIComponent(svgString);
			return 'data:image/svg+xml;charset=utf-8,' + encoded;
		}
	}
	
	/**
	 * 替换cell的图片为SVG
	 */
	function replaceImageWithSvg(cell, svgDataUri)
	{
		if (!cell || !svgDataUri)
		{
			if (window.console)
			{
				console.error('[Image to SVG] 替换失败: cell或svgDataUri为空');
			}
			return;
		}
		
		// 提取SVG文本
		var svgText = null;
		try
		{
			var commaIndex = svgDataUri.indexOf(',');
			if (commaIndex >= 0)
			{
				var dataPart = svgDataUri.substring(commaIndex + 1);
				
				// 检查是否是base64编码
				if (svgDataUri.indexOf(';base64,') > 0)
				{
					// Base64编码
					svgText = decodeURIComponent(escape(window.atob(dataPart)));
				}
				else
				{
					// URL编码
					svgText = decodeURIComponent(dataPart);
				}
			}
		}
		catch (e)
		{
			if (window.console)
			{
				console.error('[Image to SVG] 提取SVG文本失败:', e);
			}
		}
		
		if (!svgText)
		{
			editorUi.handleError({message: '无法提取SVG内容'});
			return;
		}
		
		graph.getModel().beginUpdate();
		try
		{
			var value = graph.getModel().getValue(cell);
			var hasSvgImageNode = mxUtils.isNode(value) && value.nodeName && value.nodeName.toLowerCase() === 'svgimage';
			
			// 更新image样式
			// 注意：需要去掉base64前缀，因为mxGraph内部会处理
			var imageUri = svgDataUri;
			var semiIndex = imageUri.indexOf(';');
			if (semiIndex > 0)
			{
				// 去掉编码信息（如;base64或;charset=utf-8）
				var commaIndex = imageUri.indexOf(',');
				if (commaIndex > semiIndex)
				{
					imageUri = imageUri.substring(0, semiIndex) + imageUri.substring(commaIndex);
				}
			}
			
			graph.setCellStyles(mxConstants.STYLE_IMAGE, imageUri, [cell]);
			
			// 创建或更新SvgImage节点
			if (hasSvgImageNode)
			{
				// 更新现有节点
				var svgImageNode = value.cloneNode(true);
				svgImageNode.setAttribute('svgDataUri', svgDataUri);
				svgImageNode.setAttribute('svgText', encodeURIComponent(svgText));
				graph.getModel().setValue(cell, svgImageNode);
			}
			else
			{
				// 创建新的SvgImage节点
				var doc = mxUtils.createXmlDocument();
				var svgImageNode = doc.createElement('SvgImage');
				svgImageNode.setAttribute('svgDataUri', svgDataUri);
				svgImageNode.setAttribute('svgText', encodeURIComponent(svgText));
				graph.getModel().setValue(cell, svgImageNode);
			}
			
			// 添加SVG相关的样式
			graph.setCellStyles('editableCssRules', '.*', [cell]);
			
			// 刷新视图
			graph.refresh(cell);
			
			if (window.console)
			{
				console.log('[Image to SVG] 图片替换成功');
			}
		}
		catch (e)
		{
			if (window.console)
			{
				console.error('[Image to SVG] 替换图片时出错:', e);
			}
			editorUi.handleError({message: '替换图片失败: ' + (e.message || '未知错误')});
		}
		finally
		{
			graph.getModel().endUpdate();
		}
	}
	
	/**
	 * 转换图片为SVG的主函数
	 */
	function convertImageToSvgAction(cell)
	{
		if (!isRasterImage(cell))
		{
			editorUi.handleError({message: '选中的不是PNG/BMP/JPG图片'});
			return;
		}
		
		var state = graph.view.getState(cell);
		var style = (state != null) ? state.style : graph.getCellStyle(cell);
		var imageUrl = mxUtils.getValue(style, mxConstants.STYLE_IMAGE, null);
		
		if (!imageUrl)
		{
			editorUi.handleError({message: '无法获取图片URL'});
			return;
		}
		
		// 显示加载提示
		var loadingDiv = document.createElement('div');
		loadingDiv.style.padding = '20px';
		loadingDiv.style.textAlign = 'center';
		loadingDiv.innerHTML = '<div style="margin-bottom: 10px;">正在转换图片为SVG，请稍候...</div>' +
			'<div style="color: #666; font-size: 12px;">这可能需要几秒钟时间</div>';
		
		editorUi.showDialog(loadingDiv, 300, 120, true, false, null, false, false, null, true);
		
		// 获取图片数据
		getImageDataUri(imageUrl, function(dataUri)
		{
			if (!dataUri)
			{
				editorUi.hideDialog();
				return;
			}
			
			// 转换为SVG
			convertImageToSvg(dataUri, function(svgString)
			{
				editorUi.hideDialog();
				
				if (!svgString)
				{
					editorUi.handleError({message: '图片转换失败'});
					return;
				}
				
				// 转换为data URI
				var svgDataUri = svgToDataUri(svgString);
				
				if (!svgDataUri)
				{
					editorUi.handleError({message: 'SVG格式转换失败'});
					return;
				}
				
				// 替换原图片
				replaceImageWithSvg(cell, svgDataUri);
				
				if (window.console)
				{
					console.log('[Image to SVG] 图片转换成功');
				}
			});
		});
	}
	
	/**
	 * 检查cell是否为SVG图片
	 */
	function isSvgImage(cell)
	{
		if (!cell || !graph.getModel().isVertex(cell))
		{
			return false;
		}
		
		var state = graph.view.getState(cell);
		var style = (state != null) ? state.style : graph.getCellStyle(cell);
		var image = (style != null) ? mxUtils.getValue(style, mxConstants.STYLE_IMAGE, null) : null;
		var value = graph.getModel().getValue(cell);
		
		// 检查image样式
		if (image != null)
		{
			var lowerImage = String(image).toLowerCase();
			if (lowerImage.indexOf('data:image/svg') === 0 || /\.svg(\?.*)?$/i.test(lowerImage))
			{
				return true;
			}
		}
		
		// 检查value节点
		if (mxUtils.isNode(value))
		{
			var nodeName = value.nodeName ? value.nodeName.toLowerCase() : '';
			if (nodeName === 'svg')
			{
				return true;
			}
			else if (nodeName === 'svgimage')
			{
				var svgText = value.getAttribute ? value.getAttribute('svgText') : null;
				var dataUri = value.getAttribute ? value.getAttribute('svgDataUri') : null;
				if (svgText || (dataUri && dataUri.toLowerCase().indexOf('data:image/svg') === 0))
				{
					return true;
				}
			}
		}
		
		// 检查字符串value
		if (typeof value === 'string')
		{
			var trimmed = value.trim();
			if (trimmed.length > 4 && trimmed.charAt(0) === '<')
			{
				try
				{
					var doc = mxUtils.parseXml(trimmed);
					if (doc && doc.documentElement && doc.documentElement.nodeName && 
						doc.documentElement.nodeName.toLowerCase() === 'svg')
					{
						return true;
					}
				}
				catch (e)
				{
					// ignore
				}
			}
		}
		
		return false;
	}
	
	/**
	 * 获取SVG内容
	 */
	function getSvgContent(cell)
	{
		if (!cell)
		{
			return null;
		}
		
		var state = graph.view.getState(cell);
		var style = (state != null) ? state.style : graph.getCellStyle(cell);
		var image = (style != null) ? mxUtils.getValue(style, mxConstants.STYLE_IMAGE, null) : null;
		var value = graph.getModel().getValue(cell);
		var svgString = null;
		
		// 尝试从image样式获取
		if (image != null)
		{
			var lowerImage = String(image).toLowerCase();
			if (lowerImage.indexOf('data:image/svg') === 0)
			{
				var commaIndex = image.indexOf(',');
				if (commaIndex >= 0)
				{
					var dataPart = image.substring(commaIndex + 1);
					var isBase64 = lowerImage.indexOf(';base64,') > 0;
					
					if (isBase64)
					{
						try
						{
							svgString = Graph.getSvgFromDataUri(image);
						}
						catch (e)
						{
							try
							{
								if (window.atob)
								{
									var decoded = window.atob(dataPart);
									svgString = decodeURIComponent(escape(decoded));
								}
							}
							catch (e2)
							{
								// ignore
							}
						}
					}
					else
					{
						try
						{
							svgString = decodeURIComponent(dataPart);
						}
						catch (e)
						{
							if (dataPart.trim().charAt(0) === '<')
							{
								svgString = dataPart;
							}
						}
					}
				}
			}
		}
		
		// 尝试从value节点获取
		if (!svgString && mxUtils.isNode(value))
		{
			var nodeName = value.nodeName ? value.nodeName.toLowerCase() : '';
			if (nodeName === 'svg')
			{
				svgString = mxUtils.getXml(value);
			}
			else if (nodeName === 'svgimage')
			{
				var svgText = value.getAttribute ? value.getAttribute('svgText') : null;
				if (svgText)
				{
					try
					{
						svgString = decodeURIComponent(svgText);
					}
					catch (e)
					{
						svgString = svgText;
					}
				}
				else
				{
					var dataUri = value.getAttribute ? value.getAttribute('svgDataUri') : null;
					if (dataUri && dataUri.toLowerCase().indexOf('data:image/svg') === 0)
					{
						try
						{
							svgString = Graph.getSvgFromDataUri(dataUri);
						}
						catch (e)
						{
							// ignore
						}
					}
				}
			}
		}
		
		// 尝试从字符串value获取
		if (!svgString && typeof value === 'string')
		{
			var trimmed = value.trim();
			if (trimmed.length > 4 && trimmed.charAt(0) === '<')
			{
				try
				{
					var doc = mxUtils.parseXml(trimmed);
					if (doc && doc.documentElement && doc.documentElement.nodeName && 
						doc.documentElement.nodeName.toLowerCase() === 'svg')
					{
						svgString = trimmed;
					}
				}
				catch (e)
				{
					// ignore
				}
			}
		}
		
		return svgString;
	}
	
	/**
	 * 编辑SVG代码
	 */
	function editSvgCode(cell)
	{
		var svgString = getSvgContent(cell);
		
		if (!svgString)
		{
			editorUi.handleError({message: '无法获取SVG内容'});
			return;
		}
		
		// 创建编辑对话框
		var div = document.createElement('div');
		div.style.padding = '10px';
		
		var textarea = document.createElement('textarea');
		textarea.style.width = '600px';
		textarea.style.height = '400px';
		textarea.style.fontFamily = 'monospace';
		textarea.style.fontSize = '12px';
		textarea.value = svgString;
		div.appendChild(textarea);
		
		var applyFn = function()
		{
			var newSvg = textarea.value.trim();
			
			if (!newSvg || newSvg.length === 0)
			{
				editorUi.handleError({message: 'SVG内容不能为空'});
				return;
			}
			
			// 验证SVG格式
			try
			{
				var doc = mxUtils.parseXml(newSvg);
				if (!doc || !doc.documentElement || doc.documentElement.nodeName.toLowerCase() !== 'svg')
				{
					editorUi.handleError({message: '无效的SVG格式'});
					return;
				}
			}
			catch (e)
			{
				editorUi.handleError({message: 'SVG格式错误: ' + (e.message || '未知错误')});
				return;
			}
			
			// 更新SVG内容
			var svgDataUri = svgToDataUri(newSvg);
			if (svgDataUri)
			{
				replaceImageWithSvg(cell, svgDataUri);
				editorUi.hideDialog();
			}
			else
			{
				editorUi.handleError({message: 'SVG转换失败'});
			}
		};
		
		editorUi.showDialog(new CustomDialog(editorUi, div, applyFn, function()
		{
			editorUi.hideDialog();
		}, '应用', null, null, false, '取消', false).container, 640, 480, true, true);
		
		// 聚焦到文本框
		setTimeout(function()
		{
			textarea.focus();
			textarea.select();
		}, 100);
	}
	
	/**
	 * 导出SVG文件
	 */
	function exportSvgFile(cell)
	{
		var svgString = getSvgContent(cell);
		
		if (!svgString)
		{
			editorUi.handleError({message: '无法获取SVG内容'});
			return;
		}
		
		// 确保SVG包含XML声明
		if (!svgString.startsWith('<?xml'))
		{
			svgString = Graph.xmlDeclaration + '\n' + svgString;
		}
		
		// 保存文件
		var filename = 'svg-export.svg';
		editorUi.saveData(filename, 'svg', svgString, 'image/svg+xml');
	}
	
	// 添加右键菜单项
	var initMenuHandler = function()
	{
		if (editorUi.menus && editorUi.menus.addPopupMenuCellItems && !window._imageToSvgMenuHandlerAdded)
		{
			var addPopupMenuCellItems = editorUi.menus.addPopupMenuCellItems;
			
			editorUi.menus.addPopupMenuCellItems = function(menu, cell, evt)
			{
				addPopupMenuCellItems.apply(this, arguments);
				
				if (cell != null && graph.getSelectionCount() == 1 && graph.getModel().isVertex(cell))
				{
					// 栅格图片转SVG
					if (isRasterImage(cell))
					{
						menu.addSeparator();
						menu.addItem('转为可编辑SVG', null, function()
						{
							convertImageToSvgAction(cell);
						});
					}
					// SVG图片功能
					else if (isSvgImage(cell))
					{
						menu.addSeparator();
						
						// 转换为形状
						if (editorUi.actions.get('convertSvgToShape'))
						{
							menu.addItem('转换为形状', null, function()
							{
								editorUi.actions.get('convertSvgToShape').funct();
							});
						}
						
						// 编辑SVG代码
						menu.addItem('编辑SVG代码', null, function()
						{
							editSvgCode(cell);
						});
						
						// 导出SVG文件
						menu.addItem('导出SVG', null, function()
						{
							exportSvgFile(cell);
						});
					}
				}
			};
			
			window._imageToSvgMenuHandlerAdded = true;
			
			if (window.console)
			{
				console.log('[Image to SVG] 菜单处理器已注册');
			}
		}
	};
	
	// 尝试立即注册，如果失败则延迟注册
	if (!initMenuHandler())
	{
		// 延迟注册，等待menus对象初始化
		var checkInterval = setInterval(function()
		{
			if (initMenuHandler())
			{
				clearInterval(checkInterval);
			}
		}, 100);
		
		// 最多等待5秒
		setTimeout(function()
		{
			clearInterval(checkInterval);
		}, 5000);
	}
});

