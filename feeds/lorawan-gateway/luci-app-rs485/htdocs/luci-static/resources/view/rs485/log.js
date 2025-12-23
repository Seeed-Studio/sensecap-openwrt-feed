'use strict';
'require view';
'require form';
'require uci';
'require fs';
'require poll';
'require ui';

function ensureSection(type) {
	var section = uci.sections("rs485-module", type)[0];
	return section ? section[".name"] : uci.add("rs485-module", type);
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('rs485-module'),
			L.resolveDefault(fs.read('/tmp/rs485/log'), '')
		]).then(function(data) {
			ensureSection('ui');
			return data;
		});
	},

	render: function(data) {
		var logPayload = (data[1] || '').trim();

		var m = new form.Map('rs485-module', _('Log Viewer'), _('View MQTT logs.'));

		var logSection = m.section(form.NamedSection, 'ui', 'log', _('Log Messages'));
		logSection.anonymous = true;
		logSection.addremove = false;

		var o = logSection.option(form.Flag, 'auto_refresh', _('Auto refresh logs when entering page'));
		o.default = '1';

		o = logSection.option(form.Value, 'buffer_limit', _('Maximum buffer lines'));
		o.datatype = 'uinteger';
		o.placeholder = '2000';
		o.default = '2000';

		o = logSection.option(form.DynamicList, 'watch_keywords', _('Keyword highlighting'));
		o.placeholder = 'join-accept';

		var logView = logSection.option(form.DummyValue, '_log');
		logView.renderWidget = function(section_id, option_id, cfgvalue) {
			return E('div', {
				'id': 'log_view',
				'style': 'width:100%; height:600px; overflow:auto; border:1px solid #ccc; padding:5px; font-family:monospace; white-space:pre; background:#fff; color:#333; resize:vertical;'
			}, _('Loading logs...'));
		};

		var updateLog = function(content) {
			var view = document.getElementById('log_view');
			if (!view) return;

			var buffer_limit = parseInt(uci.get('rs485-module', 'ui', 'buffer_limit')) || 2000;
			var keywords = uci.get('rs485-module', 'ui', 'watch_keywords') || [];
			if (typeof keywords === 'string') keywords = keywords.split(/\s+/);

			var lines = (content || '').trim().split('\n');

			if (lines.length > buffer_limit) {
				lines = lines.slice(lines.length - buffer_limit);
			}

			var htmlContent = lines.map(function(line) {
				var highlighted = line.replace(/[&<>"']/g, function(m) {
					return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
				});
				
				if (Array.isArray(keywords)) {
					keywords.forEach(function(kw) {
						if (kw) {
							var re = new RegExp('(' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
							highlighted = highlighted.replace(re, '<span style="background-color:#ffeb3b; color:black; font-weight:bold">$1</span>');
						}
					});
				}
				return highlighted;
			}).join('\n');

			var wasScrolledBottom = view.scrollHeight - view.scrollTop <= view.clientHeight + 50;
			view.innerHTML = htmlContent || _('No logs available to display');

			if (wasScrolledBottom) {
				view.scrollTop = view.scrollHeight;
			}
		};

		poll.add(function() {
			var auto_refresh = uci.get('rs485-module', 'ui', 'auto_refresh');
			if (auto_refresh === '0') return;

			return fs.read('/tmp/rs485/log').then(function(res) {
				updateLog(res);
			}).catch(function() { });
		}, 5);

		return m.render().then(function(node) {
			setTimeout(function() {
				updateLog(logPayload);
			}, 0);
			return node;
		});
	}
});
