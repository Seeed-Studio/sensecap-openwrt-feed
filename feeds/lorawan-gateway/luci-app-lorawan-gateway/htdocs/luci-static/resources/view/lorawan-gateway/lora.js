'use strict';
'require view';
'require form';
'require uci';
'require rpc';
'require ui';

var callInitAction = rpc.declare({
	object: 'luci',
	method: 'setInitAction',
	params: ['name', 'action'],
	expect: { result: false }
});

function ensureSection(type) {
	var section = uci.sections("lorawan-gateway", type)[0];
	return section ? section[".name"] : uci.add("lorawan-gateway", type);
}

return view.extend({
	load: function() {
		return uci.load('lorawan-gateway');
	},

	handleSaveApply: function(ev, mode) {
		var self = this;
		return this.super('handleSaveApply', [ev, mode]).then(function() {
			// Reload UCI configuration to get the latest saved values
			return uci.load('lorawan-gateway').then(function() {
				var loraSid = uci.sections("lorawan-gateway", "radio")[0];
				if (!loraSid) return;
				
				var enabled = uci.get('lorawan-gateway', loraSid['.name'], 'enabled');
				var platform = uci.get('lorawan-gateway', loraSid['.name'], 'platform');
				
				console.log('LoRa enabled:', enabled, 'platform:', platform);
				
				var actions = [];
				
				// If LoRa functionality is disabled, stop and disable all services
				if (enabled != '1') {
					actions = [
						callInitAction('basicstation', 'stop'),
						callInitAction('basicstation', 'disable'),
						callInitAction('chirpstack-concentratord', 'stop'),
						callInitAction('chirpstack-concentratord', 'disable')
					];
				} else if (platform == "basicstation") {
					// Enable basicstation, disable chirpstack-concentratord
					actions = [
						callInitAction('chirpstack-concentratord', 'stop'),
						callInitAction('chirpstack-concentratord', 'disable'),
						callInitAction('basicstation', 'enable'),
						callInitAction('basicstation', 'restart')
					];
				} else if (platform == "chirpstack") {
					// Enable chirpstack-concentratord, disable basicstation
					actions = [
						callInitAction('basicstation', 'stop'),
						callInitAction('basicstation', 'disable'),
						callInitAction('chirpstack-concentratord', 'enable'),
						callInitAction('chirpstack-concentratord', 'restart')
					];
				}
				
				if (actions.length > 0) {
					return Promise.all(actions).then(function(results) {
						console.log('Init actions completed:', results);
					}).catch(function(e) {
						console.log('Init actions error:', e);
					});
				}
			});
		});
	},

	render: function() {
		var m = new form.Map('lorawan-gateway', _('LoRa Configuration'), _('Configure LoRa radio parameters.'));

		var loraSid = ensureSection("radio");
		var loraSection = m.section(form.NamedSection, loraSid, "radio", _("LoRa Settings"));
		loraSection.addremove = false;

		var o = loraSection.option(form.Flag, "enabled", _("Enable LoRa functionality"));
		o.rmempty = false;
		o.default = "1";

		o = loraSection.option(form.ListValue, "platform", _("Platform Type"));
		o.value("basicstation", "Basic Station");
		o.value("chirpstack", "ChirpStack");
		o.default = "basicstation";

		// add button to configure network settings based on platform
		o = loraSection.option(form.Button, '_configure_network', _('Configure Network'));
		o.inputstyle = 'action';
		o.inputtitle = _('Configure Network');
		o.onclick = function(ev, section_id) {
			// Prioritize getting the currently selected value from DOM (unsaved changes)
			var selectEl = document.getElementById('widget.cbid.lorawan-gateway.' + section_id + '.platform');
			var platform = selectEl ? selectEl.value : uci.get('lorawan-gateway', section_id, 'platform');
			if (platform == "basicstation") {
				location.href = L.url('admin/network/lorawan-basicstation/general');
			} else if (platform == "chirpstack") {
				location.href = L.url('admin/chirpstack/concentratord');
			}
		};

		// Navigation buttons
		var navSection = m.section(form.NamedSection, 'ui', 'navigation', _('Navigation'));
		navSection.anonymous = true;
		navSection.addremove = false;

		o = navSection.option(form.Button, '_mqtt', _('Go to MQTT Configuration'));
		o.inputstyle = 'action';
		o.inputtitle = _('MQTT');
		o.onclick = function() {
			location.href = L.url('admin/lorawan-gateway/mqtt');
		};

		o = navSection.option(form.Button, '_log', _('Go to Log Viewer'));
		o.inputstyle = 'action';
		o.inputtitle = _('Logs');
		o.onclick = function() {
			location.href = L.url('admin/lorawan-gateway/log');
		};

		return m.render();
	}
});
