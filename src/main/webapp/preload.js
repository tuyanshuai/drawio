(function() {
	try {
		// Allow loading custom plugins from same origin
		window.ALLOW_CUSTOM_PLUGINS = true;

		var search = window.location.search || "";
		var params = new URLSearchParams(search);
		var changed = false;
		if (!/[?&]dev=1(?!\d)/.test(search) && !params.has("dev")) { params.set("dev", "1"); changed = true; }
		if (params.get("plugins") !== "1") { params.set("plugins", "1"); changed = true; }
		var p = params.get("p") || "";
		
		// Default plugins to load
		var defaultPlugins = ["plugins/isocube.js", "plugins/ai-convert.js", "plugins/material-library.js"];
		
		// Check if any default plugin is missing and add them
		for (var i = 0; i < defaultPlugins.length; i++) {
			if (p.indexOf(defaultPlugins[i]) === -1) {
				params.set("p", (p ? (p + ";") : "") + defaultPlugins[i]);
				p = params.get("p");
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


