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
		
		// 确保图片不缩放，使用原始尺寸
		img.style.width = 'auto';
		img.style.height = 'auto';
		
		// 对于所有非 data URI 的图片，必须设置 crossOrigin 才能避免画布被污染
		// 这样在调用 toDataURL 时才不会报错
		if (imageUrl.substring(0, 5) !== 'data:')
		{
			img.crossOrigin = 'anonymous';
		}
		else if (editorUi.crossOriginImages)
		{
			img.crossOrigin = 'anonymous';
		}
		
		img.onload = function()
		{
			try
			{
				// 获取图片的原始尺寸（不缩放）
				var naturalWidth = img.naturalWidth || img.width;
				var naturalHeight = img.naturalHeight || img.height;
				
				if (window.console)
				{
					console.log('[Image to SVG] getImageDataUri - 图片原始尺寸:', naturalWidth + 'x' + naturalHeight);
					console.log('  - img.width (显示尺寸):', img.width);
					console.log('  - img.height (显示尺寸):', img.height);
					console.log('  - img.naturalWidth (原始尺寸):', img.naturalWidth);
					console.log('  - img.naturalHeight (原始尺寸):', img.naturalHeight);
				}
				
				var canvas = document.createElement('canvas');
				var ctx = canvas.getContext('2d');
				
				// 使用原始尺寸，不缩放
				canvas.width = naturalWidth;
				canvas.height = naturalHeight;
				
				// 绘制图片时使用原始尺寸，不指定目标宽高（避免缩放）
				ctx.drawImage(img, 0, 0, naturalWidth, naturalHeight);
				
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
	 * 使用vtracer将图片转换为SVG（兼容旧接口，默认启用OCR）
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
		
		// 使用默认选项（启用OCR）
		var options = {
			enableOCR: true
		};
		
		convertImageToSvgWithOptions(imageDataUri, options, callback);
	}
	
	/**
	 * 内部函数：执行转换（兼容旧代码）
	 */
	function performConversion(imageDataUri, callback)
	{
		// 使用默认选项（启用OCR）
		var options = {
			enableOCR: true
		};
		performConversionWithOptions(imageDataUri, options, callback);
	}
	
	/**
	 * OCR相关变量
	 */
	var tesseractWorker = null;
	var tesseractLoading = false;
	var tesseractLoadCallbacks = [];
	
	/**
	 * 加载Tesseract.js OCR库
	 * 使用CDN加载，支持中文识别
	 */
	function loadTesseract(callback)
	{
		if (tesseractWorker)
		{
			// 已经加载
			if (callback) callback();
			return;
		}
		
		if (callback)
		{
			tesseractLoadCallbacks.push(callback);
		}
		
		if (tesseractLoading)
		{
			// 正在加载，等待完成
			return;
		}
		
		tesseractLoading = true;
		
		if (window.console)
		{
			console.log('[Image to SVG] 开始加载Tesseract.js OCR库...');
		}
		
		// 动态加载Tesseract.js
		// 使用CDN，支持中文（chi_sim）和英文（eng）
		if (typeof Tesseract === 'undefined')
		{
			// 加载Tesseract.js核心库
			var script = document.createElement('script');
			script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.4/dist/tesseract.min.js';
			script.onload = function()
			{
				if (window.console)
				{
					console.log('[Image to SVG] Tesseract.js加载成功，初始化Worker...');
				}
				
				// 初始化Tesseract Worker
				Tesseract.createWorker({
					langPath: 'https://tessdata.projectnaptha.com/4.0.0',
					logger: function(m) {
						if (window.console && m.status === 'recognizing text')
						{
							console.log('[OCR] 进度:', Math.round(m.progress * 100) + '%');
						}
					}
				}).then(function(worker)
				{
					tesseractWorker = worker;
					tesseractLoading = false;
					
					if (window.console)
					{
						console.log('[Image to SVG] Tesseract Worker初始化成功');
					}
					
					// 加载中文和英文语言包
					return worker.loadLanguage('chi_sim+eng');
				}).then(function()
				{
					return tesseractWorker.initialize('chi_sim+eng');
				}).then(function()
				{
					if (window.console)
					{
						console.log('[Image to SVG] Tesseract OCR准备就绪');
					}
					
					// 执行所有等待的回调
					tesseractLoadCallbacks.forEach(function(cb) { cb(); });
					tesseractLoadCallbacks = [];
				}).catch(function(error)
				{
					if (window.console)
					{
						console.error('[Image to SVG] Tesseract初始化失败:', error);
					}
					tesseractLoading = false;
					tesseractWorker = null;
					
					// 即使OCR失败，也继续执行回调（使用vtracer转换）
					tesseractLoadCallbacks.forEach(function(cb) { cb(); });
					tesseractLoadCallbacks = [];
				});
			};
			
			script.onerror = function()
			{
				if (window.console)
				{
					console.error('[Image to SVG] Tesseract.js加载失败');
				}
				tesseractLoading = false;
				tesseractWorker = null;
				
				// 即使加载失败，也继续执行回调（使用vtracer转换）
				tesseractLoadCallbacks.forEach(function(cb) { cb(); });
				tesseractLoadCallbacks = [];
			};
			
			document.head.appendChild(script);
		}
		else
		{
			// Tesseract已加载，直接初始化Worker
			Tesseract.createWorker({
				langPath: 'https://tessdata.projectnaptha.com/4.0.0',
				logger: function(m) {
					if (window.console && m.status === 'recognizing text')
					{
						console.log('[OCR] 进度:', Math.round(m.progress * 100) + '%');
					}
				}
			}).then(function(worker)
			{
				tesseractWorker = worker;
				tesseractLoading = false;
				return worker.loadLanguage('chi_sim+eng');
			}).then(function()
			{
				return tesseractWorker.initialize('chi_sim+eng');
			}).then(function()
			{
				if (window.console)
				{
					console.log('[Image to SVG] Tesseract OCR准备就绪');
				}
				tesseractLoadCallbacks.forEach(function(cb) { cb(); });
				tesseractLoadCallbacks = [];
			}).catch(function(error)
			{
				if (window.console)
				{
					console.error('[Image to SVG] Tesseract初始化失败:', error);
				}
				tesseractLoading = false;
				tesseractWorker = null;
				tesseractLoadCallbacks.forEach(function(cb) { cb(); });
				tesseractLoadCallbacks = [];
			});
		}
	}
	
	/**
	 * 使用OCR识别图片中的文字
	 * 返回文字区域和文字内容
	 */
	function recognizeTextWithOCR(imageDataUri, callback)
	{
		if (!tesseractWorker)
		{
			if (window.console)
			{
				console.warn('[Image to SVG] OCR未初始化，跳过文字识别');
			}
			callback([]);
			return;
		}
		
		if (window.console)
		{
			console.log('[Image to SVG] 开始OCR文字识别...');
		}
		
		// 使用Tesseract识别文字
		tesseractWorker.recognize(imageDataUri, 'chi_sim+eng', {
			tessedit_pageseg_mode: '6', // 统一文本块
		}).then(function(result)
		{
			if (window.console)
			{
				console.log('[Image to SVG] OCR识别完成，找到', result.data.words.length, '个文字区域');
			}
			
			// 提取文字信息
			var textRegions = [];
			var words = result.data.words || [];
			
			for (var i = 0; i < words.length; i++)
			{
				var word = words[i];
				if (word.text && word.text.trim().length > 0 && word.bbox)
				{
					textRegions.push({
						text: word.text.trim(),
						x: word.bbox.x0,
						y: word.bbox.y0,
						width: word.bbox.x1 - word.bbox.x0,
						height: word.bbox.y1 - word.bbox.y0,
						confidence: word.confidence || 0
					});
				}
			}
			
			// 合并相近的文字区域（同一行的文字）
			var mergedRegions = mergeTextRegions(textRegions);
			
			if (window.console)
			{
				console.log('[Image to SVG] 合并后文字区域数量:', mergedRegions.length);
			}
			
			callback(mergedRegions);
		}).catch(function(error)
		{
			if (window.console)
			{
				console.error('[Image to SVG] OCR识别失败:', error);
			}
			callback([]);
		});
	}
	
	/**
	 * 合并相近的文字区域
	 * 将同一行或相近的文字合并为一个区域
	 */
	function mergeTextRegions(regions)
	{
		if (regions.length === 0) return [];
		
		// 按Y坐标排序
		regions.sort(function(a, b) {
			var yDiff = a.y - b.y;
			if (Math.abs(yDiff) < a.height * 0.5) // 同一行
			{
				return a.x - b.x; // 同一行按X排序
			}
			return yDiff;
		});
		
		var merged = [];
		var currentLine = null;
		
		for (var i = 0; i < regions.length; i++)
		{
			var region = regions[i];
			
			if (!currentLine)
			{
				currentLine = {
					text: region.text,
					x: region.x,
					y: region.y,
					width: region.width,
					height: region.height,
					confidence: region.confidence
				};
			}
			else
			{
				// 检查是否在同一行（Y坐标相近）
				var yDiff = Math.abs(region.y - currentLine.y);
				var avgHeight = (currentLine.height + region.height) / 2;
				
				if (yDiff < avgHeight * 0.6) // 同一行
				{
					// 合并文字
					currentLine.text += ' ' + region.text;
					currentLine.width = Math.max(currentLine.x + currentLine.width, region.x + region.width) - currentLine.x;
					currentLine.height = Math.max(currentLine.height, region.height);
					currentLine.confidence = Math.min(currentLine.confidence, region.confidence);
				}
				else
				{
					// 新的一行
					merged.push(currentLine);
					currentLine = {
						text: region.text,
						x: region.x,
						y: region.y,
						width: region.width,
						height: region.height,
						confidence: region.confidence
					};
				}
			}
		}
		
		if (currentLine)
		{
			merged.push(currentLine);
		}
		
		return merged;
	}
	
	/**
	 * 检测文字区域周围的背景色
	 * 返回RGB颜色对象 {r, g, b}
	 */
	function detectBackgroundColor(canvas, ctx, region, padding)
	{
		var x = Math.max(0, region.x - padding);
		var y = Math.max(0, region.y - padding);
		var width = Math.min(canvas.width - x, region.width + padding * 2);
		var height = Math.min(canvas.height - y, region.height + padding * 2);
		
		// 采样文字区域周围的像素（边缘区域）
		var sampleSize = 3; // 采样边缘的宽度
		var samples = [];
		
		// 采样上边缘
		for (var i = 0; i < width; i += 2)
		{
			for (var j = 0; j < sampleSize && j < height; j++)
			{
				var pixelData = ctx.getImageData(x + i, y + j, 1, 1).data;
				samples.push({r: pixelData[0], g: pixelData[1], b: pixelData[2]});
			}
		}
		
		// 采样下边缘
		for (var i = 0; i < width; i += 2)
		{
			for (var j = Math.max(0, height - sampleSize); j < height; j++)
			{
				var pixelData = ctx.getImageData(x + i, y + j, 1, 1).data;
				samples.push({r: pixelData[0], g: pixelData[1], b: pixelData[2]});
			}
		}
		
		// 采样左边缘
		for (var j = 0; j < height; j += 2)
		{
			for (var i = 0; i < sampleSize && i < width; i++)
			{
				var pixelData = ctx.getImageData(x + i, y + j, 1, 1).data;
				samples.push({r: pixelData[0], g: pixelData[1], b: pixelData[2]});
			}
		}
		
		// 采样右边缘
		for (var j = 0; j < height; j += 2)
		{
			for (var i = Math.max(0, width - sampleSize); i < width; i++)
			{
				var pixelData = ctx.getImageData(x + i, y + j, 1, 1).data;
				samples.push({r: pixelData[0], g: pixelData[1], b: pixelData[2]});
			}
		}
		
		if (samples.length === 0)
		{
			// 如果无法采样，返回白色作为默认值
			return {r: 255, g: 255, b: 255};
		}
		
		// 计算平均颜色
		var sumR = 0, sumG = 0, sumB = 0;
		for (var k = 0; k < samples.length; k++)
		{
			sumR += samples[k].r;
			sumG += samples[k].g;
			sumB += samples[k].b;
		}
		
		return {
			r: Math.round(sumR / samples.length),
			g: Math.round(sumG / samples.length),
			b: Math.round(sumB / samples.length)
		};
	}
	
	/**
	 * 从图片中移除文字区域（用检测到的背景色填充）
	 * 返回处理后的图片data URI
	 */
	function removeTextRegionsFromImage(imageDataUri, textRegions, callback)
	{
		var img = new Image();
		img.onload = function()
		{
			var canvas = document.createElement('canvas');
			var ctx = canvas.getContext('2d');
			canvas.width = img.width;
			canvas.height = img.height;
			
			// 绘制原图
			ctx.drawImage(img, 0, 0);
			
			// 获取图片数据用于检测背景色
			var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
			
			// 用检测到的背景色填充每个文字区域
			for (var i = 0; i < textRegions.length; i++)
			{
				var region = textRegions[i];
				var padding = 2; // 扩大填充区域，确保完全覆盖
				
				// 检测文字区域周围的背景色
				var bgColor = detectBackgroundColor(canvas, ctx, region, padding + 5);
				
				// 使用检测到的背景色填充
				ctx.fillStyle = 'rgb(' + bgColor.r + ',' + bgColor.g + ',' + bgColor.b + ')';
				ctx.fillRect(
					Math.max(0, region.x - padding),
					Math.max(0, region.y - padding),
					region.width + padding * 2,
					region.height + padding * 2
				);
				
				if (window.console && i < 3)
				{
					console.log('[Image to SVG] 文字区域', i, '检测到的背景色:', bgColor);
				}
			}
			
			// 转换为data URI
			var processedDataUri = canvas.toDataURL('image/png');
			callback(processedDataUri);
		};
		
		img.onerror = function()
		{
			if (window.console)
			{
				console.error('[Image to SVG] 加载图片失败');
			}
			callback(imageDataUri); // 失败时返回原图
		};
		
		img.src = imageDataUri;
	}
	
	/**
	 * 将文字区域添加到SVG中
	 */
	function addTextRegionsToSvg(svgString, textRegions, imageWidth, imageHeight)
	{
		if (!svgString || textRegions.length === 0)
		{
			return svgString;
		}
		
		try
		{
			var parser = new DOMParser();
			var svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
			var svgRoot = svgDoc.documentElement;
			
			if (!svgRoot || svgRoot.nodeName !== 'svg')
			{
				return svgString;
			}
			
			// 获取SVG的viewBox或尺寸
			var viewBox = svgRoot.getAttribute('viewBox');
			var svgWidth = parseFloat(svgRoot.getAttribute('width') || imageWidth || 100);
			var svgHeight = parseFloat(svgRoot.getAttribute('height') || imageHeight || 100);
			
			if (viewBox)
			{
				var vbParts = viewBox.split(/\s+/);
				if (vbParts.length >= 4)
				{
					svgWidth = parseFloat(vbParts[2]);
					svgHeight = parseFloat(vbParts[3]);
				}
			}
			
			// 计算缩放比例
			var scaleX = svgWidth / imageWidth;
			var scaleY = svgHeight / imageHeight;
			
			// 添加文字元素
			for (var i = 0; i < textRegions.length; i++)
			{
				var region = textRegions[i];
				var textEl = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'text');
				
				// 设置文字位置和内容
				textEl.setAttribute('x', (region.x * scaleX).toFixed(2));
				textEl.setAttribute('y', ((region.y + region.height * 0.8) * scaleY).toFixed(2)); // 调整基线
				textEl.setAttribute('font-size', (region.height * scaleY * 0.9).toFixed(2));
				textEl.setAttribute('fill', '#000000');
				textEl.setAttribute('font-family', 'Arial, sans-serif');
				textEl.textContent = region.text;
				
				svgRoot.appendChild(textEl);
			}
			
			// 转换回字符串
			var serializer = new XMLSerializer();
			return serializer.serializeToString(svgRoot);
		}
		catch (e)
		{
			if (window.console)
			{
				console.error('[Image to SVG] 添加文字到SVG失败:', e);
			}
			return svgString;
		}
	}
	
	/**
	 * 加载vtracer库 (wasm版本)
	 * 参考: https://github.com/visioncortex/vtracer/tree/master/webapp
	 */
	var vtracerModule = null;
	var vtracerLoading = false;
	var vtracerLoadCallbacks = [];
	
	function loadVtracer(callback)
	{
		if (vtracerModule)
		{
			// 已经加载
			if (callback) callback();
			return;
		}
		
		if (callback)
		{
			vtracerLoadCallbacks.push(callback);
		}
		
		if (vtracerLoading)
		{
			// 正在加载，等待完成
			return;
		}
		
		vtracerLoading = true;
		
		if (window.console)
		{
			console.log('[Image to SVG] 开始加载vtracer wasm库...');
		}
		
		// 动态加载vtracer的bootstrap.js
		// bootstrap.js已修改为只加载wasm模块，不加载index.js（避免DOM依赖）
		var script = document.createElement('script');
		script.src = 'vtracer/bootstrap.js';
		
		// 监听vtracer wasm模块加载完成事件
		var wasmLoadedHandler = function()
		{
			if (window.console)
			{
				console.log('[Image to SVG] 步骤0: 收到vtracer-wasm-loaded事件，开始查找转换器类...');
			}
			
			// 查找vtracer模块
			findVtracerModule();
		};
		window.addEventListener('vtracer-wasm-loaded', wasmLoadedHandler);
		
		if (window.console)
		{
			console.log('[Image to SVG] 步骤0.1: 已注册vtracer-wasm-loaded事件监听器');
		}
		
		script.onload = function()
		{
			if (window.console)
			{
				console.log('[Image to SVG] 步骤0.2: vtracer bootstrap.js脚本加载成功');
				console.log('[Image to SVG] 步骤0.3: 检查webpack状态...');
				console.log('[Image to SVG] 步骤0.4: __webpack_require__ 存在?', !!window.__webpack_require__);
				console.log('[Image to SVG] 步骤0.5: webpackJsonp 存在?', !!window.webpackJsonp);
			}
			
			// 如果事件已经触发（在脚本加载之前），立即查找
			setTimeout(function()
			{
				if (!vtracerModule)
				{
					if (window.console)
					{
						console.log('[Image to SVG] 步骤0.6: 延迟500ms后开始查找模块（事件可能还未触发）');
					}
					findVtracerModule();
				}
			}, 500);
		};
		
		// 查找vtracer模块的函数
		var findVtracerAttempts = 0;
		var maxFindAttempts = 100; // 最多尝试100次（10秒）
		
		function findVtracerModule()
		{
			findVtracerAttempts++;
			
			if (window.console)
			{
				console.log('[Image to SVG] 步骤1: 查找vtracer模块 (尝试 ' + findVtracerAttempts + '/' + maxFindAttempts + ')');
			}
			
			// 步骤1: 检查webpack是否存在
			if (!window.__webpack_require__)
			{
				if (window.console)
				{
					console.log('[Image to SVG] 步骤1.1: __webpack_require__ 不存在，继续等待...');
				}
				if (findVtracerAttempts < maxFindAttempts)
				{
					setTimeout(findVtracerModule, 100);
				}
				return;
			}
			
			if (window.console)
			{
				console.log('[Image to SVG] 步骤1.2: __webpack_require__ 存在');
			}
			
			// 步骤2: 检查模块缓存
			if (!window.__webpack_require__.c)
			{
				if (window.console)
				{
					console.log('[Image to SVG] 步骤1.3: __webpack_require__.c 不存在，继续等待...');
				}
				if (findVtracerAttempts < maxFindAttempts)
				{
					setTimeout(findVtracerModule, 100);
				}
				return;
			}
			
			if (window.console)
			{
				console.log('[Image to SVG] 步骤1.4: __webpack_require__.c 存在，开始遍历模块缓存');
			}
			
			try
			{
				// 步骤3: 直接尝试加载vtracer模块（已知模块ID）
				var vtracerModuleId = "../pkg/vtracer_webapp.js";
				
				// 方法1: 尝试直接require模块
				try
				{
					var vtracerModule = window.__webpack_require__(vtracerModuleId);
					if (vtracerModule && (vtracerModule.BinaryImageConverter || vtracerModule.ColorImageConverter))
					{
						if (window.console)
						{
							console.log('[Image to SVG] 步骤2: 通过require找到vtracer模块!');
							console.log('[Image to SVG] 步骤2.1: BinaryImageConverter:', !!vtracerModule.BinaryImageConverter);
							console.log('[Image to SVG] 步骤2.2: ColorImageConverter:', !!vtracerModule.ColorImageConverter);
						}
						
						// 找到vtracer模块，将其暴露到全局
						window.BinaryImageConverter = vtracerModule.BinaryImageConverter;
						window.ColorImageConverter = vtracerModule.ColorImageConverter;
						
						// 移除事件监听器
						window.removeEventListener('vtracer-wasm-loaded', wasmLoadedHandler);
						
						initVtracerWrapper();
						return;
					}
				}
				catch (e)
				{
					if (window.console && findVtracerAttempts === 1)
					{
						console.log('[Image to SVG] 步骤1.5: 直接require失败，尝试遍历缓存:', e.message);
					}
				}
				
				// 方法2: 遍历模块缓存
				var cache = window.__webpack_require__.c;
				var moduleCount = 0;
				var moduleIds = [];
				
				for (var moduleId in cache)
				{
					moduleCount++;
					moduleIds.push(moduleId);
					
					var module = cache[moduleId];
					if (!module)
					{
						continue;
					}
					
					if (window.console && findVtracerAttempts === 1)
					{
						console.log('[Image to SVG] 步骤1.6: 检查模块 ' + moduleId);
					}
					
					// 检查模块的exports
					if (module.exports)
					{
						var exports = module.exports;
						
						// 检查是否有BinaryImageConverter或ColorImageConverter
						if (exports.BinaryImageConverter || exports.ColorImageConverter)
						{
							if (window.console)
							{
								console.log('[Image to SVG] 步骤2: 在缓存中找到vtracer模块! 模块ID:', moduleId);
								console.log('[Image to SVG] 步骤2.1: BinaryImageConverter:', !!exports.BinaryImageConverter);
								console.log('[Image to SVG] 步骤2.2: ColorImageConverter:', !!exports.ColorImageConverter);
							}
							
							// 找到vtracer模块，将其暴露到全局
							window.BinaryImageConverter = exports.BinaryImageConverter;
							window.ColorImageConverter = exports.ColorImageConverter;
							
							// 移除事件监听器
							window.removeEventListener('vtracer-wasm-loaded', wasmLoadedHandler);
							
							initVtracerWrapper();
							return;
						}
						
						// 调试：列出模块的所有导出
						if (window.console && findVtracerAttempts === 1 && typeof exports === 'object')
						{
							var exportKeys = Object.keys(exports);
							if (exportKeys.length > 0 && exportKeys.length < 20)
							{
								console.log('[Image to SVG] 步骤1.7: 模块 ' + moduleId + ' 的导出:', exportKeys);
							}
						}
					}
				}
				
				if (window.console && findVtracerAttempts === 1)
				{
					console.log('[Image to SVG] 步骤1.8: 总共检查了 ' + moduleCount + ' 个模块');
					console.log('[Image to SVG] 步骤1.9: 模块ID列表:', moduleIds.slice(0, 10));
				}
				
				// 如果没找到，继续等待
				if (!vtracerModule && findVtracerAttempts < maxFindAttempts)
				{
					if (window.console && findVtracerAttempts % 10 === 0)
					{
						console.log('[Image to SVG] 步骤1.9: 未找到vtracer模块，继续等待... (尝试 ' + findVtracerAttempts + ')');
					}
					setTimeout(findVtracerModule, 100);
				}
				else if (!vtracerModule)
				{
					if (window.console)
					{
						console.error('[Image to SVG] 步骤1.10: 查找超时，未找到vtracer模块');
						console.error('[Image to SVG] 调试信息:', {
							hasWebpack: !!window.__webpack_require__,
							hasCache: !!(window.__webpack_require__ && window.__webpack_require__.c),
							moduleCount: moduleCount,
							moduleIds: moduleIds
						});
					}
				}
			}
			catch (e)
			{
				if (window.console)
				{
					console.error('[Image to SVG] 步骤1.11: 查找vtracer模块时出错:', e);
					console.error('[Image to SVG] 错误堆栈:', e.stack);
				}
			}
		}
		
		script.onerror = function()
		{
			if (window.console)
			{
				console.error('[Image to SVG] vtracer bootstrap.js加载失败:', script.src);
			}
			window.removeEventListener('vtracer-wasm-loaded', wasmLoadedHandler);
			vtracerLoading = false;
			// 调用所有等待的回调
			vtracerLoadCallbacks.forEach(function(cb) { cb(); });
			vtracerLoadCallbacks = [];
		};
		
		// 超时处理（10秒）
		setTimeout(function()
		{
			if (!vtracerModule)
			{
				if (window.console)
				{
					console.error('[Image to SVG] vtracer模块加载超时');
				}
				window.removeEventListener('vtracer-wasm-loaded', wasmLoadedHandler);
				vtracerLoading = false;
				// 调用所有等待的回调
				vtracerLoadCallbacks.forEach(function(cb) { cb(); });
				vtracerLoadCallbacks = [];
			}
		}, 10000);
		
		document.head.appendChild(script);
	}
	
	/**
	 * 初始化vtracer包装器
	 * 从webpack模块中提取vtracer的API
	 */
	function initVtracerWrapper()
	{
		if (vtracerModule)
		{
			// 已经初始化
			vtracerLoading = false;
			vtracerLoadCallbacks.forEach(function(cb) { cb(); });
			vtracerLoadCallbacks = [];
			return;
		}
		
		// 由于vtracer使用webpack打包，模块不会直接暴露在全局作用域
		// 我们需要通过webpack的模块系统访问，或者使用其他方法
		// 最简单的方法是：创建一个包装器，在运行时动态访问webpack模块
		
		window.VTracer = {
			convert: function(imageDataUri, options, callback)
			{
				convertWithVtracerWasm(imageDataUri, options, callback);
			},
			// 存储webpack模块引用（如果可用）
			_module: null
		};
		
		vtracerModule = window.VTracer;
		vtracerLoading = false;
		
		if (window.console)
		{
			console.log('[Image to SVG] vtracer包装器初始化完成');
		}
		
		// 调用所有等待的回调
		vtracerLoadCallbacks.forEach(function(cb) { cb(); });
		vtracerLoadCallbacks = [];
	}
	
	/**
	 * 使用vtracer wasm进行转换
	 * 创建隐藏的canvas和svg元素，使用vtracer的API进行转换
	 */
	function convertWithVtracerWasm(imageDataUri, options, callback)
	{
		if (window.console)
		{
			console.log('[Image to SVG] 使用vtracer wasm进行转换...');
		}
		
		// 创建隐藏的canvas和svg元素
		var canvas = document.createElement('canvas');
		canvas.style.display = 'none';
		canvas.id = 'vtracer-canvas-' + Date.now();
		document.body.appendChild(canvas);
		
		var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.style.display = 'none';
		svg.id = 'vtracer-svg-' + Date.now();
		document.body.appendChild(svg);
		
		// 加载图片到canvas
		var img = new Image();
		
		// 确保图片不缩放，使用原始尺寸
		img.style.width = 'auto';
		img.style.height = 'auto';
		
		img.onload = function()
		{
			// 获取图片的原始尺寸（不缩放）
			const width = img.naturalWidth || img.width;
			const height = img.naturalHeight || img.height;
			
			// 调试：输出图片尺寸信息
			if (window.console)
			{
				console.log('[Image to SVG] convertWithVtracerWasm - 图片尺寸检查:');
				console.log('  - img.width (显示尺寸):', img.width);
				console.log('  - img.height (显示尺寸):', img.height);
				console.log('  - img.naturalWidth (原始尺寸):', img.naturalWidth);
				console.log('  - img.naturalHeight (原始尺寸):', img.naturalHeight);
				console.log('  - 使用的尺寸:', width + 'x' + height);
				console.log('  - 期望分辨率: 3000x2250');
				if (width !== 3000 || height !== 2250)
				{
					console.warn('[Image to SVG] ⚠️ 图片分辨率不匹配！期望 3000x2250，实际 ' + width + 'x' + height);
				}
			}
			
			// 设置canvas尺寸（使用原始尺寸，不缩放）
			canvas.width = width;
			canvas.height = height;
			
			// 清空canvas（与官网一致）
			var ctx = canvas.getContext('2d');
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			
			// 绘制图片时明确指定原始尺寸，避免任何缩放
			ctx.drawImage(img, 0, 0, width, height);
			
			// 重要：调用getImageData确保图片数据被正确加载到内存（与官网一致）
			ctx.getImageData(0, 0, canvas.width, canvas.height);
			
			// 清空svg（与官网一致）
			while (svg.firstChild)
			{
				svg.removeChild(svg.firstChild);
			}
			
			// 设置svg的viewBox（与官网一致）
			svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
			svg.setAttribute('version', '1.1');
			svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
			
			// 尝试使用vtracer的API
			// 由于vtracer使用webpack打包，我们需要通过webpack的模块系统访问
			// 等待webpack模块加载完成后，尝试访问vtracer模块
			try
			{
				// 检查是否有全局的vtracer API（某些情况下可能会暴露）
				if (window.BinaryImageConverter && window.ColorImageConverter)
				{
					// 直接使用全局API
					runVtracerConversion(canvas, svg, options, callback);
					return;
				}
				
				// 尝试从webpack模块中获取
				// 等待webpack模块加载
				var checkCount = 0;
				var maxChecks = 200; // 20秒
				var checkInterval = setInterval(function()
				{
					checkCount++;
					
					// 方法1: 尝试通过webpack的require系统访问
					if (window.__webpack_require__)
					{
						try
						{
							// 尝试require vtracer模块（路径可能需要调整）
							var modulePaths = ['./index.js', '../index.js', 'vtracer/index.js'];
							for (var i = 0; i < modulePaths.length; i++)
							{
								try
								{
									var vtracer = window.__webpack_require__(modulePaths[i]);
									if (vtracer && (vtracer.BinaryImageConverter || vtracer.ColorImageConverter))
									{
										clearInterval(checkInterval);
										runVtracerConversionWithModule(canvas, svg, options, callback, vtracer);
										return;
									}
								}
								catch (e)
								{
									// 继续尝试下一个路径
								}
							}
						}
						catch (e)
						{
							// 继续尝试其他方法
						}
					}
					
					// 方法2: 尝试通过webpack的模块缓存访问
					if (window.__webpack_require__ && window.__webpack_require__.c)
					{
						try
						{
							var cache = window.__webpack_require__.c;
							for (var moduleId in cache)
							{
								var module = cache[moduleId];
								if (module && module.exports)
								{
									var exports = module.exports;
									if (exports && (exports.BinaryImageConverter || exports.ColorImageConverter))
									{
										clearInterval(checkInterval);
										runVtracerConversionWithModule(canvas, svg, options, callback, exports);
										return;
									}
								}
							}
						}
						catch (e)
						{
							// 继续尝试
						}
					}
					
					// 如果超时，使用fallback
					if (checkCount >= maxChecks)
					{
						clearInterval(checkInterval);
						if (window.console)
						{
							console.warn('[Image to SVG] 无法访问vtracer模块，使用fallback方法');
						}
						// 使用ImageTracer作为fallback
						convertWithImageTracer(imageDataUri, options, callback);
						// 清理
						document.body.removeChild(canvas);
						document.body.removeChild(svg);
					}
				}, 100);
			}
			catch (e)
			{
				if (window.console)
				{
					console.error('[Image to SVG] vtracer转换出错:', e);
				}
				// 使用fallback
				convertWithImageTracer(imageDataUri, options, callback);
				// 清理
				document.body.removeChild(canvas);
				document.body.removeChild(svg);
			}
		};
		
		img.onerror = function()
		{
			if (window.console)
			{
				console.error('[Image to SVG] 图片加载失败');
			}
			document.body.removeChild(canvas);
			document.body.removeChild(svg);
			callback(null);
		};
		
		img.src = imageDataUri;
	}
	
	/**
	 * 使用vtracer模块进行转换
	 */
	function runVtracerConversionWithModule(canvas, svg, options, callback, vtracerModule)
	{
		var BinaryImageConverter = vtracerModule.BinaryImageConverter;
		var ColorImageConverter = vtracerModule.ColorImageConverter;
		
		if (!BinaryImageConverter && !ColorImageConverter)
		{
			if (window.console)
			{
				console.error('[Image to SVG] vtracer模块中找不到转换器类');
			}
			document.body.removeChild(canvas);
			document.body.removeChild(svg);
			callback(null);
			return;
		}
		
		runVtracerConversion(canvas, svg, options, callback, BinaryImageConverter, ColorImageConverter);
	}
	
	/**
	 * 执行vtracer转换
	 */
	function runVtracerConversion(canvas, svg, options, callback, BinaryImageConverter, ColorImageConverter)
	{
		// 默认使用ColorImageConverter
		// 注意：官网默认是 'stacked'，不是 'cutout'
		var useColor = true;
		var clusteringMode = 'color';
		var hierarchical = 'stacked'; // 与官网默认值一致
		
		if (options && options.clustering_mode)
		{
			clusteringMode = options.clustering_mode;
			useColor = (clusteringMode === 'color');
		}
		
		if (options && options.hierarchical)
		{
			hierarchical = options.hierarchical;
		}
		
		// 创建转换器参数
		// 注意：vtracer的Rust代码要求JSON中包含所有字段，即使某些模式下不使用
		// 参考：vtracer官网 index.js 中的参数构建方式
		var currentMode = options && options.mode ? options.mode : 'polygon';
		
		// 角度转弧度函数（与官网一致）
		function deg2rad(deg) {
			return deg / 180 * 3.141592654;
		}
		
		// 获取参数值（与官网逻辑一致）
		var filterSpeckleValue = options && options.filter_speckle !== undefined ? options.filter_speckle : 4;
		var colorPrecisionValue = options && options.color_precision !== undefined ? options.color_precision : 6;
		var gradientStepValue = options && options.gradient_step !== undefined ? options.gradient_step : (options && options.layer_difference !== undefined ? options.layer_difference : 16);
		var cornerThresholdDeg = options && options.corner_threshold !== undefined ? (options.corner_threshold * 180 / Math.PI) : 60;
		var spliceThresholdDeg = options && options.splice_threshold !== undefined ? (options.splice_threshold * 180 / Math.PI) : 45;
		var lengthThresholdValue = options && options.length_threshold !== undefined ? options.length_threshold : 4;
		var pathPrecisionValue = options && options.path_precision !== undefined ? options.path_precision : 8;
		
		// 构建参数（完全按照官网方式）
		var converterParams = {
			canvas_id: canvas.id,
			svg_id: svg.id,
			mode: currentMode,
			clustering_mode: clusteringMode,
			hierarchical: hierarchical,
			corner_threshold: deg2rad(cornerThresholdDeg),
			length_threshold: lengthThresholdValue,
			max_iterations: 10,
			splice_threshold: deg2rad(spliceThresholdDeg),
			filter_speckle: filterSpeckleValue * filterSpeckleValue, // 平方值，与官网一致
			color_precision: 8 - colorPrecisionValue, // 反转，与官网一致
			layer_difference: gradientStepValue,
			path_precision: pathPrecisionValue
		};
		
		// 详细的调试信息
		if (window.console)
		{
			console.log('========== [Image to SVG] 参数对比调试 ==========');
			console.log('[1] 用户选择的参数:', JSON.stringify(options, null, 2));
			console.log('[2] 处理后的参数值:');
			console.log('  - filter_speckle (原始值):', filterSpeckleValue, '-> (平方值):', filterSpeckleValue * filterSpeckleValue);
			console.log('  - color_precision (原始值):', colorPrecisionValue, '-> (反转值):', 8 - colorPrecisionValue);
			console.log('  - gradient_step/layer_difference:', gradientStepValue);
			console.log('  - corner_threshold (度):', cornerThresholdDeg, '-> (弧度):', deg2rad(cornerThresholdDeg));
			console.log('  - splice_threshold (度):', spliceThresholdDeg, '-> (弧度):', deg2rad(spliceThresholdDeg));
			console.log('  - length_threshold:', lengthThresholdValue);
			console.log('  - path_precision:', pathPrecisionValue);
			console.log('  - mode:', currentMode);
			console.log('  - clustering_mode:', clusteringMode);
			console.log('  - hierarchical:', hierarchical);
			console.log('[3] 最终传递给vtracer的参数JSON:');
			console.log(JSON.stringify(converterParams, null, 2));
			
			// 生成官网格式的参数（用于对比）
			var officialFormat = {
				'canvas_id': converterParams.canvas_id,
				'svg_id': converterParams.svg_id,
				'mode': converterParams.mode,
				'clustering_mode': converterParams.clustering_mode,
				'hierarchical': converterParams.hierarchical,
				'corner_threshold': converterParams.corner_threshold,
				'length_threshold': converterParams.length_threshold,
				'max_iterations': converterParams.max_iterations,
				'splice_threshold': converterParams.splice_threshold,
				'filter_speckle': converterParams.filter_speckle,
				'color_precision': converterParams.color_precision,
				'layer_difference': converterParams.layer_difference,
				'path_precision': converterParams.path_precision
			};
			console.log('[4] 官网格式的参数（用于对比）:');
			console.log(JSON.stringify(officialFormat, null, 2));
			console.log('[5] 参数对比表:');
			console.table({
				'参数': ['filter_speckle', 'color_precision', 'layer_difference', 'corner_threshold', 'splice_threshold', 'length_threshold', 'path_precision', 'mode', 'clustering_mode', 'hierarchical'],
				'我们的值': [
					converterParams.filter_speckle,
					converterParams.color_precision,
					converterParams.layer_difference,
					converterParams.corner_threshold.toFixed(6),
					converterParams.splice_threshold.toFixed(6),
					converterParams.length_threshold,
					converterParams.path_precision,
					converterParams.mode,
					converterParams.clustering_mode,
					converterParams.hierarchical
				]
			});
			console.log('================================================');
			
			// 保存到全局变量，方便在控制台查看
			window._lastVtracerParams = {
				userOptions: options,
				converterParams: converterParams,
				officialFormat: officialFormat
			};
		}
		
		var converterParamsStr = JSON.stringify(converterParams);
		
		// 获取转换器类（从全局或参数传入）
		var ConverterClass = useColor ? 
			(ColorImageConverter || window.ColorImageConverter) : 
			(BinaryImageConverter || window.BinaryImageConverter);
		
		if (!ConverterClass)
		{
			if (window.console)
			{
				console.error('[Image to SVG] 找不到vtracer转换器类');
			}
			document.body.removeChild(canvas);
			document.body.removeChild(svg);
			callback(null);
			return;
		}
		
		// 创建转换器
		if (window.console)
		{
			console.log('[Image to SVG] 创建转换器，参数JSON:', converterParamsStr);
			console.log('[Image to SVG] Canvas信息:');
			console.log('  - canvas.id:', canvas.id);
			console.log('  - canvas.width:', canvas.width);
			console.log('  - canvas.height:', canvas.height);
			console.log('[Image to SVG] SVG信息:');
			console.log('  - svg.id:', svg.id);
			console.log('  - svg.viewBox:', svg.getAttribute('viewBox'));
		}
		
		var converter = ConverterClass.new_with_string(converterParamsStr);
		converter.init();
		
		if (window.console)
		{
			console.log('[Image to SVG] 转换器创建成功，开始转换...');
			console.log('[Image to SVG] 转换器类型:', useColor ? 'ColorImageConverter' : 'BinaryImageConverter');
		}
		
		// 跟踪转换器是否已被释放
		var converterFreed = false;
		var tickInterval = null;
		var timeoutId = null;
		
		// 安全的清理函数
		function cleanup()
		{
			if (converterFreed)
			{
				return; // 已经清理过了
			}
			
			converterFreed = true;
			
			// 清除定时器
			if (tickInterval)
			{
				clearInterval(tickInterval);
				tickInterval = null;
			}
			
			if (timeoutId)
			{
				clearTimeout(timeoutId);
				timeoutId = null;
			}
			
			// 安全释放转换器
			try
			{
				if (converter && typeof converter.free === 'function')
				{
					converter.free();
				}
			}
			catch (e)
			{
				if (window.console)
				{
					console.warn('[Image to SVG] 释放转换器时出错（可能已经释放）:', e);
				}
			}
			
			// 清理DOM元素
			try
			{
				if (canvas && canvas.parentNode)
				{
					document.body.removeChild(canvas);
				}
			}
			catch (e)
			{
				if (window.console)
				{
					console.warn('[Image to SVG] 移除canvas时出错:', e);
				}
			}
			
			try
			{
				if (svg && svg.parentNode)
				{
					document.body.removeChild(svg);
				}
			}
			catch (e)
			{
				if (window.console)
				{
					console.warn('[Image to SVG] 移除svg时出错:', e);
				}
			}
		}
		
		// 执行转换（使用tick方法）
		// 参考官网：在25ms内尽可能多地执行tick，提高性能
		var progress = 0;
		var maxProgress = 100;
		var tickCount = 0;
		var clusteringTickCount = 0;
		var reclusteringTickCount = 0;
		var vectorizeTickCount = 0;
		
		// 使用setTimeout而不是setInterval，与官网一致
		function tick()
		{
			if (converterFreed)
			{
				return; // 已经清理，停止执行
			}
			
			try
			{
				var done = false;
				var startTick = performance.now();
				
				// 在25ms内尽可能多地执行tick（与官网一致）
				while (!(done = converter.tick()) && performance.now() - startTick < 25)
				{
					tickCount++;
					// 注意：这里无法直接区分tick类型，但可以通过progress变化来推断
				}
				
				progress = converter.progress();
				
				// 调试：记录tick次数和progress
				if (window.console && tickCount % 50 === 0)
				{
					console.log('[Image to SVG] Tick进度:', {
						tickCount: tickCount,
						progress: progress,
						done: done
					});
				}
				
				if (done || progress >= maxProgress)
				{
					if (window.console)
					{
						console.log('[Image to SVG] 转换完成统计:');
						console.log('  - 总tick次数:', tickCount);
						console.log('  - 最终progress:', progress);
					}
					
					// 获取SVG字符串
					var svgString = new XMLSerializer().serializeToString(svg);
					
					// 清理
					cleanup();
					
					if (svgString && svgString.trim().length > 0)
					{
						if (window.console)
						{
							console.log('[Image to SVG] vtracer转换成功');
							console.log('  - SVG长度:', svgString.length, '字符');
							console.log('  - SVG路径数量:', (svgString.match(/<path[^>]*>/gi) || []).length);
						}
						callback(svgString);
					}
					else
					{
						if (window.console)
						{
							console.error('[Image to SVG] vtracer转换返回空结果');
						}
						callback(null);
					}
				}
				else
				{
					// 继续下一次tick（与官网一致：使用setTimeout，延迟1ms）
					setTimeout(tick, 1);
				}
			}
			catch (e)
			{
				if (window.console)
				{
					console.error('[Image to SVG] 转换过程中出错:', e);
				}
				cleanup();
				callback(null);
			}
		}
		
		// 开始第一次tick（延迟1ms，与官网一致）
		setTimeout(tick, 1);
		
		// 超时保护（30秒）
		timeoutId = setTimeout(function()
		{
			if (!converterFreed)
			{
				if (window.console)
				{
					console.error('[Image to SVG] vtracer转换超时');
				}
				cleanup();
				callback(null);
			}
		}, 30000);
	}
	
	/**
	 * 使用ImageTracer.js进行转换（fallback方法）
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
	 * 显示参数配置对话框
	 */
	function showVtracerConfigDialog(cell, imageUrl, imageDataUri)
	{
		// 创建对话框容器
		var dialogContainer = document.createElement('div');
		dialogContainer.style.display = 'flex';
		dialogContainer.style.flexDirection = 'row';
		dialogContainer.style.width = '900px';
		dialogContainer.style.height = '600px';
		dialogContainer.style.padding = '0';
		dialogContainer.style.overflow = 'hidden';
		
		// 左侧：图片预览
		var leftPanel = document.createElement('div');
		leftPanel.style.width = '400px';
		leftPanel.style.padding = '20px';
		leftPanel.style.backgroundColor = '#f5f5f5';
		leftPanel.style.display = 'flex';
		leftPanel.style.flexDirection = 'column';
		leftPanel.style.alignItems = 'center';
		leftPanel.style.justifyContent = 'center';
		leftPanel.style.overflow = 'auto';
		
		var imagePreview = document.createElement('img');
		imagePreview.src = imageDataUri;
		// 预览时保持原始比例，不缩放（仅用于显示）
		imagePreview.style.maxWidth = '100%';
		imagePreview.style.maxHeight = '100%';
		imagePreview.style.objectFit = 'contain';
		// 确保预览图片也使用原始尺寸加载（用于调试）
		imagePreview.onload = function()
		{
			if (window.console)
			{
				console.log('[Image to SVG] 预览图片尺寸:');
				console.log('  - 显示尺寸:', this.width + 'x' + this.height);
				console.log('  - 原始尺寸:', this.naturalWidth + 'x' + this.naturalHeight);
			}
		};
		leftPanel.appendChild(imagePreview);
		
		// 右侧：参数配置
		var rightPanel = document.createElement('div');
		rightPanel.style.flex = '1';
		rightPanel.style.padding = '20px';
		rightPanel.style.overflow = 'auto';
		rightPanel.style.backgroundColor = '#fff';
		
		// 参数配置表单
		var form = document.createElement('div');
		form.style.display = 'flex';
		form.style.flexDirection = 'column';
		
		// 标题
		var title = document.createElement('h3');
		title.textContent = 'SVG转换参数';
		title.style.margin = '0 0 20px 0';
		title.style.fontSize = '18px';
		form.appendChild(title);
		
		// Clustering 模式
		var clusteringGroup = document.createElement('div');
		clusteringGroup.style.marginBottom = '10px';
		
		var clusteringLabel = document.createElement('label');
		clusteringLabel.textContent = 'Clustering（聚类模式）';
		clusteringLabel.style.display = 'block';
		clusteringLabel.style.marginBottom = '5px';
		clusteringLabel.style.fontWeight = 'bold';
		clusteringGroup.appendChild(clusteringLabel);
		
		var clusteringMode = document.createElement('select');
		clusteringMode.style.width = '100%';
		clusteringMode.style.padding = '5px';
		var option1 = document.createElement('option');
		option1.value = 'color';
		option1.textContent = 'Color（彩色）';
		option1.selected = true;
		clusteringMode.appendChild(option1);
		var option2 = document.createElement('option');
		option2.value = 'bw';
		option2.textContent = 'B/W（黑白）';
		clusteringMode.appendChild(option2);
		clusteringGroup.appendChild(clusteringMode);
		
		var hierarchicalMode = document.createElement('select');
		hierarchicalMode.style.width = '100%';
		hierarchicalMode.style.padding = '5px';
		hierarchicalMode.style.marginTop = '5px';
		var opt1 = document.createElement('option');
		opt1.value = 'cutout';
		opt1.textContent = 'Cutout（剪切）';
		hierarchicalMode.appendChild(opt1);
		var opt2 = document.createElement('option');
		opt2.value = 'stacked';
		opt2.textContent = 'Stacked（堆叠）';
		opt2.selected = true; // 默认选择stacked，与官网一致
		hierarchicalMode.appendChild(opt2);
		clusteringGroup.appendChild(hierarchicalMode);
		
		form.appendChild(clusteringGroup);
		
		// OCR文字识别选项
		var ocrGroup = document.createElement('div');
		ocrGroup.style.marginBottom = '15px';
		ocrGroup.style.padding = '10px';
		ocrGroup.style.backgroundColor = '#f0f8ff';
		ocrGroup.style.borderRadius = '5px';
		ocrGroup.style.border = '1px solid #d0e8ff';
		
		var ocrLabel = document.createElement('label');
		ocrLabel.style.display = 'flex';
		ocrLabel.style.alignItems = 'center';
		ocrLabel.style.cursor = 'pointer';
		
		var ocrCheckbox = document.createElement('input');
		ocrCheckbox.type = 'checkbox';
		ocrCheckbox.checked = true; // 默认启用
		ocrCheckbox.id = 'ocr-enable';
		ocrCheckbox.style.marginRight = '8px';
		ocrCheckbox.style.cursor = 'pointer';
		
		var ocrText = document.createElement('span');
		ocrText.textContent = '启用OCR文字识别（保留可编辑文字）';
		ocrText.style.fontWeight = 'bold';
		ocrText.style.cursor = 'pointer';
		
		ocrLabel.appendChild(ocrCheckbox);
		ocrLabel.appendChild(ocrText);
		ocrGroup.appendChild(ocrLabel);
		
		var ocrDesc = document.createElement('div');
		ocrDesc.textContent = '识别图片中的中英文文字，保留为可编辑的文本元素。其他区域使用矢量化处理。';
		ocrDesc.style.marginTop = '5px';
		ocrDesc.style.fontSize = '12px';
		ocrDesc.style.color = '#666';
		ocrGroup.appendChild(ocrDesc);
		
		form.appendChild(ocrGroup);
		
		// Filter Speckle (范围0-128，默认4，实际传递时是平方值)
		var speckleGroup = createSliderGroup('Filter Speckle（过滤斑点）', 'filter_speckle', 4, 0, 128, 4);
		form.appendChild(speckleGroup);
		
		// Color Precision
		var colorPrecisionGroup = createSliderGroup('Color Precision（颜色精度）', 'color_precision', 6, 1, 8, 6);
		form.appendChild(colorPrecisionGroup);
		
		// Gradient Step
		var gradientStepGroup = createSliderGroup('Gradient Step（渐变步长）', 'gradient_step', 16, 1, 32, 16);
		form.appendChild(gradientStepGroup);
		
		// Curve Fitting
		var curveFittingGroup = document.createElement('div');
		curveFittingGroup.style.marginBottom = '10px';
		
		var curveLabel = document.createElement('label');
		curveLabel.textContent = 'Curve Fitting（曲线拟合）';
		curveLabel.style.display = 'block';
		curveLabel.style.marginBottom = '5px';
		curveLabel.style.fontWeight = 'bold';
		curveFittingGroup.appendChild(curveLabel);
		
		var curveMode = document.createElement('select');
		curveMode.style.width = '100%';
		curveMode.style.padding = '5px';
		var pixelOpt = document.createElement('option');
		pixelOpt.value = 'pixel';
		pixelOpt.textContent = 'PIXEL（像素）';
		curveMode.appendChild(pixelOpt);
		var polygonOpt = document.createElement('option');
		polygonOpt.value = 'polygon';
		polygonOpt.textContent = 'Polygon（多边形）';
		polygonOpt.selected = true;
		curveMode.appendChild(polygonOpt);
		var splineOpt = document.createElement('option');
		splineOpt.value = 'spline';
		splineOpt.textContent = 'Spline（样条曲线）';
		curveMode.appendChild(splineOpt);
		curveFittingGroup.appendChild(curveMode);
		
		form.appendChild(curveFittingGroup);
		
		// Corner Threshold (只在spline模式下显示)
		var cornerThresholdGroup = createSliderGroup('Corner Threshold（角阈值）', 'corner_threshold', 60, 0, 180, 60);
		cornerThresholdGroup.style.display = 'none'; // 默认隐藏（polygon模式）
		cornerThresholdGroup.setAttribute('data-mode', 'spline');
		form.appendChild(cornerThresholdGroup);
		
		// Segment Length (只在spline模式下显示)
		var segmentLengthGroup = createSliderGroup('Segment Length（段长度）', 'length_threshold', 4, 1, 20, 4);
		segmentLengthGroup.style.display = 'none'; // 默认隐藏（polygon模式）
		segmentLengthGroup.setAttribute('data-mode', 'spline');
		form.appendChild(segmentLengthGroup);
		
		// Splice Threshold (只在spline模式下显示)
		var spliceThresholdGroup = createSliderGroup('Splice Threshold（拼接阈值）', 'splice_threshold', 45, 0, 180, 45);
		spliceThresholdGroup.style.display = 'none'; // 默认隐藏（polygon模式）
		spliceThresholdGroup.setAttribute('data-mode', 'spline');
		form.appendChild(spliceThresholdGroup);
		
		// 根据曲线拟合模式显示/隐藏相关参数
		function updateCurveFittingOptions()
		{
			var mode = curveMode.value;
			var isSpline = (mode === 'spline');
			
			cornerThresholdGroup.style.display = isSpline ? 'block' : 'none';
			segmentLengthGroup.style.display = isSpline ? 'block' : 'none';
			spliceThresholdGroup.style.display = isSpline ? 'block' : 'none';
		}
		
		// 监听曲线拟合模式变化
		curveMode.addEventListener('change', updateCurveFittingOptions);
		
		// Path Precision
		var pathPrecisionGroup = createSliderGroup('Path Precision（路径精度）', 'path_precision', 8, 1, 16, 8);
		form.appendChild(pathPrecisionGroup);
		
		rightPanel.appendChild(form);
		
		dialogContainer.appendChild(leftPanel);
		dialogContainer.appendChild(rightPanel);
		
		// 创建对话框
		var applyFn = function()
		{
			// 收集参数
			var currentMode = curveMode.value;
			var options = {
				enableOCR: ocrCheckbox.checked, // OCR选项
				clustering_mode: clusteringMode.value,
				hierarchical: hierarchicalMode.value,
				filter_speckle: parseFloat(speckleGroup.querySelector('input[type="range"]').value),
				color_precision: parseFloat(colorPrecisionGroup.querySelector('input[type="range"]').value),
				gradient_step: parseFloat(gradientStepGroup.querySelector('input[type="range"]').value),
				mode: currentMode,
				path_precision: parseFloat(pathPrecisionGroup.querySelector('input[type="range"]').value)
			};
			
			// 这些参数在所有模式下都需要（vtracer要求），但只在spline模式下从UI获取
			// 在polygon/pixel模式下使用默认值
			if (currentMode === 'spline')
			{
				options.corner_threshold = parseFloat(cornerThresholdGroup.querySelector('input[type="range"]').value) * Math.PI / 180;
				options.length_threshold = parseFloat(segmentLengthGroup.querySelector('input[type="range"]').value);
				options.splice_threshold = parseFloat(spliceThresholdGroup.querySelector('input[type="range"]').value) * Math.PI / 180;
			}
			else
			{
				// polygon/pixel模式下使用默认值
				options.corner_threshold = 60 * Math.PI / 180;
				options.length_threshold = 4;
				options.splice_threshold = 45 * Math.PI / 180;
			}
			
			if (window.console)
			{
				console.log('[Image to SVG] 转换参数:', JSON.stringify(options, null, 2));
			}
			
			editorUi.hideDialog();
			
			// 显示加载提示
			var loadingDiv = document.createElement('div');
			loadingDiv.style.padding = '20px';
			loadingDiv.style.textAlign = 'center';
			loadingDiv.innerHTML = '<div style="margin-bottom: 10px;">正在转换图片为SVG，请稍候...</div>' +
				'<div style="color: #666; font-size: 12px;">这可能需要几秒钟时间</div>';
			
			editorUi.showDialog(loadingDiv, 300, 120, true, false, null, false, false, null, true);
			
			// 转换为SVG
			convertImageToSvgWithOptions(imageDataUri, options, function(svgString)
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
		};
		
		editorUi.showDialog(new CustomDialog(editorUi, dialogContainer, applyFn, function()
		{
			editorUi.hideDialog();
		}, '转换', null, null, false, '取消', false).container, 920, 650, true, true);
	}
	
	/**
	 * 创建滑块组
	 */
	function createSliderGroup(labelText, name, defaultValue, min, max, displayValue)
	{
		var group = document.createElement('div');
		group.style.marginBottom = '10px';
		
		var label = document.createElement('label');
		label.textContent = labelText;
		label.style.display = 'block';
		label.style.marginBottom = '5px';
		label.style.fontWeight = 'bold';
		group.appendChild(label);
		
		var sliderContainer = document.createElement('div');
		sliderContainer.style.display = 'flex';
		sliderContainer.style.alignItems = 'center';
		
		var slider = document.createElement('input');
		slider.type = 'range';
		slider.min = min;
		slider.max = max;
		slider.value = defaultValue;
		slider.style.flex = '1';
		slider.setAttribute('data-name', name);
		sliderContainer.appendChild(slider);
		
		var valueDisplay = document.createElement('span');
		valueDisplay.textContent = displayValue || defaultValue;
		valueDisplay.style.minWidth = '40px';
		valueDisplay.style.textAlign = 'right';
		valueDisplay.style.marginLeft = '10px';
		valueDisplay.setAttribute('data-name', name + '_display');
		sliderContainer.appendChild(valueDisplay);
		
		// 更新显示值
		slider.addEventListener('input', function()
		{
			valueDisplay.textContent = this.value;
		});
		
		group.appendChild(sliderContainer);
		return group;
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
		
		// 获取图片数据
		getImageDataUri(imageUrl, function(dataUri)
		{
			if (!dataUri)
			{
				editorUi.handleError({message: '无法加载图片'});
				return;
			}
			
			// 显示参数配置对话框
			showVtracerConfigDialog(cell, imageUrl, dataUri);
		});
	}
	
	/**
	 * 使用指定选项转换图片为SVG
	 */
	function convertImageToSvgWithOptions(imageDataUri, options, callback)
	{
		if (!imageDataUri)
		{
			callback(null);
			return;
		}
		
		if (window.console)
		{
			console.log('[Image to SVG] 开始转换图片为SVG...', options);
		}
		
		// 检查是否加载了vtracer
		if (typeof window.VTracer === 'undefined')
		{
			// 尝试动态加载vtracer
			loadVtracer(function()
			{
				performConversionWithOptions(imageDataUri, options, callback);
			});
		}
		else
		{
			performConversionWithOptions(imageDataUri, options, callback);
		}
	}
	
	/**
	 * 使用指定选项执行实际的转换（混合处理：OCR + vtracer）
	 */
	function performConversionWithOptions(imageDataUri, options, callback)
	{
		// 检查是否启用OCR（默认启用）
		var enableOCR = options && options.enableOCR !== false;
		
		if (!enableOCR)
		{
			// 不启用OCR，直接使用vtracer转换
			performVtracerConversion(imageDataUri, options, callback);
			return;
		}
		
		// 启用OCR混合处理
		// 步骤1: 加载OCR库
		loadTesseract(function()
		{
			// 步骤2: 获取图片尺寸
			var img = new Image();
			img.onload = function()
			{
				var imageWidth = img.width;
				var imageHeight = img.height;
				
				// 步骤3: OCR识别文字
				recognizeTextWithOCR(imageDataUri, function(textRegions)
				{
					if (textRegions.length === 0)
					{
						// 没有识别到文字，直接使用vtracer转换
						if (window.console)
						{
							console.log('[Image to SVG] 未识别到文字，直接使用vtracer转换');
						}
						performVtracerConversion(imageDataUri, options, callback);
						return;
					}
					
					if (window.console)
					{
						console.log('[Image to SVG] 识别到', textRegions.length, '个文字区域，开始混合处理');
					}
					
					// 步骤4: 从图片中移除文字区域
					removeTextRegionsFromImage(imageDataUri, textRegions, function(processedImageDataUri)
					{
						// 步骤5: 对处理后的图片使用vtracer转换
						performVtracerConversion(processedImageDataUri, options, function(svgString)
						{
							if (!svgString)
							{
								callback(null);
								return;
							}
							
							// 步骤6: 将识别的文字添加到SVG中
							var finalSvg = addTextRegionsToSvg(svgString, textRegions, imageWidth, imageHeight);
							
							if (window.console)
							{
								console.log('[Image to SVG] 混合处理完成，已添加', textRegions.length, '个文字元素');
							}
							
							callback(finalSvg);
						});
					});
				});
			};
			
			img.onerror = function()
			{
				if (window.console)
				{
					console.error('[Image to SVG] 加载图片失败，跳过OCR处理');
				}
				// 失败时直接使用vtracer转换
				performVtracerConversion(imageDataUri, options, callback);
			};
			
			img.src = imageDataUri;
		});
	}
	
	/**
	 * 执行vtracer转换（内部函数）
	 */
	function performVtracerConversion(imageDataUri, options, callback)
	{
		// 检查是否有全局的vtracer转换器类
		if (window.BinaryImageConverter || window.ColorImageConverter)
		{
			// 使用vtracer wasm进行转换
			convertWithVtracerWasm(imageDataUri, options, callback);
		}
		else if (window.VTracer && window.VTracer.convert)
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

