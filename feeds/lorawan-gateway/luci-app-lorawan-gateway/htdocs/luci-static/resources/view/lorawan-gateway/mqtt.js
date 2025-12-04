'use strict';
'require view';
'require form';
'require uci';

function ensureSection(type) {
	var section = uci.sections("lorawan-gateway", type)[0];
	return section ? section[".name"] : uci.add("lorawan-gateway", type);
}

return view.extend({
	load: function() {
		return uci.load('lorawan-gateway');
	},

	render: function() {
		var m = new form.Map('lorawan-gateway', _('MQTT Configuration'), _('Configure MQTT bridge parameters.'));

		var mqttSid = ensureSection("broker");
		var mqttSection = m.section(form.NamedSection, mqttSid, "broker", _("MQTT Settings"));
		mqttSection.addremove = false;
		mqttSection.tab("general", _("Connection"));
		mqttSection.tab("security", _("Security"));
		mqttSection.tab("topic", _("Topic Mapping"));
		mqttSection.tab("advanced", _("Advanced"));

		var o = mqttSection.taboption("general", form.Flag, "enabled", _("Enable MQTT Bridge"));
		o.rmempty = false;
		o.default = "0";

		o = mqttSection.taboption("general", form.ListValue, "transport", _("Transport Protocol"));
		o.value("tcp", "tcp");
		o.value("ssl", "ssl");
		o.value("ws", "ws");
		o.value("wss", "wss");
		o.default = "tcp";

		o = mqttSection.taboption("general", form.Value, "host", _("Server Address"));
		o.datatype = "or(hostname,ipaddr)";
		o.placeholder = "mqtt.example.com";
		o.rmempty = false;

		o = mqttSection.taboption("general", form.Value, "port", _("Port"));
		o.datatype = "port";
		o.placeholder = "1883";

		o = mqttSection.taboption("general", form.Value, "client_id", _("Client ID"));
		o.datatype = "maxlength(32)";
		o.placeholder = "gateway-bridge";

		o = mqttSection.taboption("general", form.Value, "keepalive", _("Keepalive (s)"));
		o.datatype = "range(5,120)";
		o.placeholder = "30";

		o = mqttSection.taboption("security", form.Value, "username", _("Username"));
		o.optional = true;

		o = mqttSection.taboption("security", form.Value, "password", _("Password"));
		o.password = true;
		o.optional = true;

		o = mqttSection.taboption("security", form.ListValue, "auth_mode", _("Authentication Mode"));
		o.value("none", _("Username/Password only"));
		o.value("tls-server", _("TLS Server Verification"));
		o.value("mutual-tls", _("Mutual TLS"));
		o.value("token", _("Token Authentication"));
		o.default = "none";

		o = mqttSection.taboption("security", form.TextValue, "ca_cert", _("CA Certificate"));
		o.rows = 6;
		o.wrap = "off";
		o.optional = true;
		o.depends("auth_mode", "tls-server");
		o.depends("auth_mode", "mutual-tls");

		o = mqttSection.taboption("security", form.TextValue, "client_cert", _("Client Certificate"));
		o.rows = 6;
		o.wrap = "off";
		o.optional = true;
		o.depends("auth_mode", "mutual-tls");

		o = mqttSection.taboption("security", form.TextValue, "client_key", _("Client Private Key"));
		o.rows = 6;
		o.wrap = "off";
		o.optional = true;
		o.depends("auth_mode", "mutual-tls");

		o = mqttSection.taboption("security", form.Value, "token", _("Access Token"));
		o.optional = true;
		o.depends("auth_mode", "token");

		o = mqttSection.taboption("topic", form.Value, "uplink_topic", _("Uplink Topic"));
		o.placeholder = "lorawan/uplink";
		o.rmempty = false;

		o = mqttSection.taboption("topic", form.Value, "downlink_topic", _("Downlink Topic"));
		o.placeholder = "lorawan/downlink";
		o.rmempty = false;

		o = mqttSection.taboption("topic", form.DynamicList, "event_topics", _("Additional Event Topics"));
		o.placeholder = "lorawan/event/#";

		o = mqttSection.taboption("topic", form.Flag, "retain_status", _("Retain Status"));
		o.default = "0";

		o = mqttSection.taboption("advanced", form.Flag, "clean_session", _("Clean Session"));
		o.default = "1";

		o = mqttSection.taboption("advanced", form.Value, "qos", _("QoS Level"));
		o.datatype = "range(0,2)";
		o.placeholder = "0";

		o = mqttSection.taboption("advanced", form.Value, "reconnect_delay", _("Reconnect Delay (s)"));
		o.datatype = "range(1,120)";
		o.placeholder = "5";

		o = mqttSection.taboption("advanced", form.TextValue, "notes", _("Maintenance Notes"));
		o.rows = 4;
		o.placeholder = _("Record platform access, certificate expiration, etc.");
		o.optional = true;

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

		o = navSection.option(form.Button, '_log', _('Go to Log Viewer'));
		o.inputstyle = 'action';
		o.inputtitle = _('Logs');
		o.onclick = function() {
			location.href = L.url('admin/lorawan-gateway/log');
		};

		return m.render();
	}
});
