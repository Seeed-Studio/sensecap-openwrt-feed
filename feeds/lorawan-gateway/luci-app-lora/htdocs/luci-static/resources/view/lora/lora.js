'use strict';
'require view';
'require form';
'require uci';
'require rpc';
'require ui';
'require dom';
'require fs';
'require view.lora.lora-platform.basicstation as basicStation';
'require view.lora.lora-platform.chirpstack as chirpstack';
'require view.lora.lora-platform.packetforwarder as packetForwarder';
'require lora.regions as regions';

var eui = '';
var callInitAction = rpc.declare({
	object: 'luci',
	method: 'setInitAction',
	params: ['name', 'action'],
	expect: { result: false }
});

function ensureSection(type) {
	var section = uci.sections("lora", type)[0];
	return section ? section[".name"] : uci.add("lora", type);
}

function handleSwitchPlatform(platform) {
	var maps = lorawanGatewayRender(platform)
	if (!Array.isArray(maps)) maps = [maps];

	return Promise.all(maps.map(m => m.render())).then(LuCI.prototype.bind(nodes => {
		var vp = document.getElementById('lora-wrapper');
		if (vp) {
			DOM.content(vp, nodes);
		}
	}, this))
}

function lorawanGatewayRender(platform_cur) {
	var platform_map;

	var concentratordSections = uci.sections("chirpstack-concentratord", "sx1302");
	var stationSections = uci.sections("basicstation", "station");

	var m = new form.Map('lora', _('LoRa Configuration'), _('Configure LoRa radio parameters.'));
	var maps = [m];

	var loraSid = ensureSection("radio");
	var loraSection = m.section(form.NamedSection, loraSid, "radio", _("LoRa Settings"));
	loraSection.addremove = false;

	// enabled
	var o = loraSection.option(form.Flag, "enabled", _("Enable LoRa functionality"));
	o.rmempty = false;
	o.default = "1";

	// eui
	o = loraSection.option(form.Value, 'eui', _('Gateway EUI'), ('Path to file containing the Gateway EUI in hex format (e.g. 00:11:22:33:44:55:66:77)'));
	o.optional = false;
	o.rmempty = false;
	o.placeholder = eui;
	o.default = eui;

	o.write = function (section_id, value) {
		// Save EUI to lora config
		uci.set('lora', section_id, 'eui', value);
		var eui_value = value.replace(/:/g, '');
		uci.set("chirpstack-concentratord", concentratordSections[0]['.name'], "gateway_id", eui_value);
		uci.set("basicstation", stationSections[0]['.name'], "routerid", value);
	}

	// channels
	o = loraSection.option(form.ListValue, 'channel_plan', _('Channel-plan'), _('Select the channel-plan to use. This must be supported by the selected shield.'));
	o.forcewrite = true;

	regions.channelPlanRender(o);

	o.write = function (section_id, value) {
		// Save channel_plan to lora config
		uci.set('lora', section_id, 'channel_plan', value);
		regions.setLoRaRegion(value);
	}
	// platform
	var platform = loraSection.option(form.ListValue, "platform", _("Platform Type"));
	platform.value("basic_station", "Basic Station");
	platform.value("packet_forwarder", "Packet Forwarder");
	platform.value("chirpstack", "ChirpStack");
	platform.default = "basic_station";

	platform.onchange = function (ev, section_id, values) {
		uci.set("lora", section_id, "platform", values);
		handleSwitchPlatform(values)
	};
	switch (platform_cur) {
		case "basic_station": {
			platform_map = basicStation.view();
			break;
		}
		case "packet_forwarder": {
			platform_map = packetForwarder.view();
			break;
		}
		case "chirpstack": {
			platform_map = chirpstack.view();
			break;
		}
		default: {
			platform_map = basicStation.view();
		}
	}
	if (platform_map) {
		if (maps.length > 1) maps.pop();
		maps.push(platform_map);
	}

	return maps;
}

return view.extend({
	load: function () {
		return Promise.all([
			uci.load('lora'),
			fs.read('/etc/device_eui').catch(function () { return ''; }),
			uci.load('basicstation'),
			uci.load('chirpstack'),
			uci.load('chirpstack-concentratord'),
			uci.load('chirpstack-udp-forwarder'),
			uci.load('chirpstack-mqtt-forwarder')
		]);
	},

	handleSaveApply: function (ev, mode) {
		var self = this;
		return this.super('handleSaveApply', [ev, mode]).then(function () {
			// Reload UCI configuration to get the latest saved values
			return uci.load('lora').then(function () {

				var enabled = uci.get('lora', ensureSection("radio"), 'enabled');
				var platform = uci.get('lora', ensureSection("radio"), 'platform');

				console.log('LoRa enabled:', enabled, 'platform:', platform);

				var actions = [];

				// If LoRa functionality is disabled, stop and disable all services
				if (enabled != '1') {
					actions = [
						callInitAction('basicstation', 'stop'),
						callInitAction('basicstation', 'disable'),
						callInitAction('chirpstack-concentratord', 'stop'),
						callInitAction('chirpstack-concentratord', 'disable'),
						callInitAction('chirpstack-udp-forwarder', 'stop'),
						callInitAction('chirpstack-udp-forwarder', 'disable')
					];
				} else if (platform === "basic_station") {
					// Enable basicstation, disable chirpstack-concentratord
					actions = [
						callInitAction('chirpstack-concentratord', 'stop'),
						callInitAction('chirpstack-concentratord', 'disable'),
						callInitAction('chirpstack-udp-forwarder', 'stop'),
						callInitAction('chirpstack-udp-forwarder', 'disable'),
						callInitAction('basicstation', 'enable'),
						callInitAction('basicstation', 'restart')
					];
				} else if (platform === "chirpstack" || platform === "packet_forwarder") {
					// Enable chirpstack-concentratord, disable basicstation
					actions = [
						callInitAction('basicstation', 'stop'),
						callInitAction('basicstation', 'disable'),
						callInitAction('chirpstack-concentratord', 'enable'),
						callInitAction('chirpstack-concentratord', 'restart'),
						callInitAction('chirpstack-udp-forwarder', 'enable'),
						callInitAction('chirpstack-udp-forwarder', 'restart')
					];
				}

				if (actions.length > 0) {
					return Promise.all(actions).then(function (results) {
						console.log('Init actions completed:', results);
					}).catch(function (e) {
						console.log('Init actions error:', e);
					});
				}
			});
		});
	},

	render: function (results) {
		eui = results[1];
		var platform = uci.get('lora', ensureSection("radio"), 'platform');
		var maps = lorawanGatewayRender(platform, eui);
		if (!Array.isArray(maps)) maps = [maps];

		return Promise.all(maps.map(m => m.render())).then(function (nodes) {
			var div = document.createElement('div');
			div.id = 'lora-wrapper';
			nodes.forEach(node => div.appendChild(node));
			return div;
		});
	},
});
