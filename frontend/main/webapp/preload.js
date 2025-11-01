(function() {
	try {
		// Allow loading custom plugins from same origin
		window.ALLOW_CUSTOM_PLUGINS = true;

		var search = window.location.search || "";
		var params = new URLSearchParams(search);
		var changed = false;
		if (!/[?&]dev=1(?!\d)/.test(search) && !params.has("dev")) { params.set("dev", "1"); changed = true; }
		if (params.get("plugins") !== "1") { params.set("plugins", "1"); changed = true; }
		
		// Configure Material Library API URL from URL parameter or default
		var apiUrl = params.get("materialApiUrl") || params.get("apiUrl");
		if (apiUrl) {
			window.MATERIAL_LIBRARY_API_URL = decodeURIComponent(apiUrl);
		} else if (!window.MATERIAL_LIBRARY_API_URL) {
			// Default to iconlibrary service on port 8082
			window.MATERIAL_LIBRARY_API_URL = 'http://localhost:8082/api';
		}
		
		// Configure Material Library API Token/Key from URL parameter
		var apiToken = params.get("materialApiToken") || params.get("apiToken");
		if (apiToken) {
			window.MATERIAL_LIBRARY_API_TOKEN = decodeURIComponent(apiToken);
		}
		
		var apiKey = params.get("materialApiKey") || params.get("apiKey");
		if (apiKey) {
			window.MATERIAL_LIBRARY_API_KEY = decodeURIComponent(apiKey);
		}
		
		var p = params.get("p") || "";
		
		// All available plugins - default to load all plugins
		// 注意：polygon-draw.js 必须在 ai-convert.js 之前加载，因为 ai-convert 依赖 manualPolygon 形状
		var allPlugins = [
			"plugins/polygon-draw.js",
			"plugins/natural-spline-draw.js",
			"plugins/ai-convert.js",
			"plugins/highlight-effect.js",
			"plugins/isocube.js",
			"plugins/isoextrude.js",
			"plugins/material-library-api.js",
			"plugins/svg-smart-color.js"
		];
		
		// Check if 'minimal=1' parameter is set to load only core plugins
		var loadMinimal = params.get("minimal") === "1";
		var loadAll = params.get("all") === "1";
		
		// Core plugins (only loaded if minimal=1)
		// 注意：polygon-draw.js 必须在 ai-convert.js 之前加载
		var corePlugins = [
			"plugins/polygon-draw.js",
			"plugins/natural-spline-draw.js",
			"plugins/isocube.js", 
			"plugins/ai-convert.js", 
			"plugins/highlight-effect.js"
		];
		
		// Determine which plugins to load
		var pluginsToLoad = [];
		if (loadMinimal) {
			pluginsToLoad = corePlugins;
		} else if (loadAll || p === "") {
			// If all=1 or no p parameter, load all plugins
			pluginsToLoad = allPlugins;
		} else {
			// If p parameter exists, use existing plugins (don't modify)
			pluginsToLoad = [];
		}
		
		// Only add plugins to URL if we need to change something
		if (pluginsToLoad.length > 0) {
			// Check if any plugin is missing and add them
			var needsUpdate = false;
			for (var i = 0; i < pluginsToLoad.length; i++) {
				if (p.indexOf(pluginsToLoad[i]) === -1) {
					needsUpdate = true;
					break;
				}
			}
			
			if (needsUpdate) {
				// If no p parameter exists and we want all plugins, use a short 'all=1' parameter
				if (p === "" && !loadMinimal && !loadAll) {
					params.set("all", "1");
				} else {
					// Otherwise, add all plugins to p parameter
					var newP = "";
					for (var i = 0; i < pluginsToLoad.length; i++) {
						if (newP) newP += ";";
						newP += pluginsToLoad[i];
					}
					params.set("p", newP);
				}
				changed = true;
			}
		}
		
		if (changed) {
			var query = "?" + params.toString();
			var newUrl = window.location.origin + window.location.pathname + query + window.location.hash;
			window.location.replace(newUrl);
			return;
		}
	} catch (e) {}
})();


