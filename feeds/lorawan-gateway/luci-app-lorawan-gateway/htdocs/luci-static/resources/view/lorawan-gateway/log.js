'use strict';
'require view';
'require form';
'require uci';
'require fs';

function ensureSection(type) {
	var section = uci.sections("lorawan-gateway", type)[0];
	return section ? section[".name"] : uci.add("lorawan-gateway", type);
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('lorawan-gateway'),
			L.resolveDefault(fs.read('/tmp/lora-gateway/log'), '')
		]);
	},

	render: function(data) {
		var logPayload = (data[1] || '').trim();

		var m = new form.Map('lorawan-gateway', _('Log Viewer'), _('View LoRaWAN Gateway logs.'));

		var logSection = m.section(form.NamedSection, 'ui', 'log', _('Log Messages'));
		logSection.anonymous = true;
		logSection.addremove = false;

		var o = logSection.option(form.Flag, 'auto_refresh', _('Auto refresh logs when entering page'));
		o.default = '1';

		o = logSection.option(form.Value, 'buffer_limit', _('Maximum buffer lines'));
		o.datatype = 'uinteger';
		o.placeholder = '2000';

		o = logSection.option(form.DynamicList, 'watch_keywords', _('Keyword highlighting'));
		o.placeholder = 'join-accept';

		var logView = logSection.option(form.TextValue, '_log', _('Recent Logs'));
		logView.readonly = true;
		logView.rows = 18;
		logView.wrap = 'off';
		logView.cfgvalue = function() {
			return logPayload || _('No logs available to display');
		};
		logView.write = function() {};

		// Navigation buttons
		var navSection = m.section(form.NamedSection, 'ui', 'navigation', _('Navigation'));
		navSection.anonymous = true;
		navSection.addremove = false;

		o = navSection.option(form.Button, '_lora', _('Go to LoRa Configuration'));
		o.inputstyle = 'action';
		o.inputtitle = _('LoRa');
		o.onclick = function() {
			location.href = L.url('admin/lorawan-gateway/lora');
		};

		o = navSection.option(form.Button, '_mqtt', _('Go to MQTT Configuration'));
		o.inputstyle = 'action';
		o.inputtitle = _('MQTT');
		o.onclick = function() {
			location.href = L.url('admin/lorawan-gateway/mqtt');
		};

		return m.render();
	}
});
