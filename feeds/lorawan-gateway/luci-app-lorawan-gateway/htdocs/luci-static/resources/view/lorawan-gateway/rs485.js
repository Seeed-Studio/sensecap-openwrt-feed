'use strict';
'require view';
'require form';
'require uci';

return view.extend({
    load: function() {
        return uci.load('lorawan-gateway');
    },

    render: function() {
        var m = new form.Map('lorawan-gateway', _('RS485 Configuration'), _('Configure RS485 bridge parameters.'));

        // Main Section with two tabs
        var s = m.section(form.NamedSection, 'serial', _('RS485 Settings'));
        s.addremove = false;
        
        // Create two tabs
        s.tab('serial', _('Serial Port Settings'));
        s.tab('mqtt', _('MQTT Settings'));

        // ===== Serial Port Settings Tab =====
        var o = s.taboption('serial', form.ListValue, "device", _("Port"));
        o.value("ttyAMA2", "ttyAMA2");
        o.value("ttyAMA3", "ttyAMA3");
        o.value("ttyAMA4", "ttyAMA4");
        o.default = "ttyAMA2";
        o.rmempty = false;

        o = s.taboption('serial', form.ListValue, "baudrate", _("Baudrate"));
        o.value("110", "110");
        o.value("300", "300");
        o.value("600", "600");
        o.value("1200", "1200");
        o.value("2400", "2400");
        o.value("4800", "4800");
        o.value("9600", "9600");
        o.value("14400", "14400");
        o.value("19200", "19200");
        o.value("38400", "38400");
        o.value("57600", "57600");
        o.value("115200", "115200");
        o.value("128000", "128000");
        o.value("256000", "256000");
        o.default = "9600";
        o.rmempty = false;

        o = s.taboption('serial', form.ListValue, "databit", _("Data Bits"));
        o.value("5", "5");
        o.value("6", "6");
        o.value("7", "7");
        o.value("8", "8");
        o.default = "8";
        o.rmempty = false;

        o = s.taboption('serial', form.ListValue, "stopbit", _("Stop Bits"));
        o.value("1", "1");
        o.value("1.5", "1.5");
        o.value("2", "2");
        o.default = "1";
        o.rmempty = false;

        o = s.taboption('serial', form.ListValue, "checkbit", _("Parity"));
        o.value("none", _("None"));
        o.value("odd", _("Odd"));
        o.value("even", _("Even"));
        o.value("mark", _("Mark"));
        o.value("space", _("Space"));
        o.default = "none";
        o.rmempty = false;

        // Serial Tool UI Container
        o = s.taboption('serial', form.DummyValue, '_tool_ui');
        o.render = function() {
            return E('div', { 'class': 'serial-tool-container' }, [
                E('style', [
                    '.serial-tool-container { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }',
                    '.tool-row { display: flex; gap: 10px; align-items: stretch; }',
                    '.tool-left { flex: 7; display: flex; flex-direction: column; }',
                    '.tool-right { flex: 3; display: flex; flex-direction: column; gap: 5px; }',
                    '.rx-box { flex: 1; width: 100%; resize: none; font-family: monospace; padding: 5px; border: 1px solid #ccc; box-sizing: border-box; }',
                    '.tx-box { height: 100px; width: 100%; resize: none; font-family: monospace; padding: 5px; border: 1px solid #ccc; box-sizing: border-box; }',
                    '#serial_settings_panel .cbi-value { margin-bottom: 0; padding: 5px 0; border: none; }',
                    '#serial_settings_panel .cbi-value-title { width: 40%; float: left; text-align: left; font-weight: normal; }',
                    '#serial_settings_panel .cbi-value-field { width: 60%; float: left; }',
                    '.tool-btn { width: 100%; margin-top: 5px; }'
                ]),
                // Top Row: RX + Settings
                E('div', { 'class': 'tool-row' }, [
                    E('div', { 'class': 'tool-left' }, [
                        E('label', { 'style': 'font-weight:bold; margin-bottom:5px;' }, _('Receive Buffer')),
                        E('textarea', { 'id': 'serial_rx', 'class': 'rx-box', 'readonly': 'readonly' })
                    ]),
                    E('div', { 'class': 'tool-right', 'id': 'serial_settings_panel' }, [
                        // Settings will be moved here
                        E('div', { 'id': 'settings_placeholder' }),
                        E('button', { 'class': 'cbi-button cbi-button-apply tool-btn', 'id': 'btn_open_close' }, _('Open Serial Port')),
                        E('button', { 'class': 'cbi-button cbi-button-reset tool-btn', 'id': 'btn_clear_rx' }, _('Clear Receive'))
                    ])
                ]),
                // Bottom Row: TX + Controls
                E('div', { 'class': 'tool-row' }, [
                    E('div', { 'class': 'tool-left' }, [
                        E('label', { 'style': 'font-weight:bold; margin-bottom:5px;' }, _('Send Buffer')),
                        E('textarea', { 'id': 'serial_tx', 'class': 'tx-box' })
                    ]),
                    E('div', { 'class': 'tool-right' }, [
                        E('div', { 'style': 'height: 24px;' }), // Spacer for label alignment
                        E('button', { 'class': 'cbi-button cbi-button-action tool-btn', 'id': 'btn_send' }, _('Send')),
                        E('button', { 'class': 'cbi-button cbi-button-reset tool-btn', 'id': 'btn_clear_tx' }, _('Clear Send'))
                    ])
                ]),
                // Script to move widgets and handle events
                E('script', [
                    'requestAnimationFrame(function() {',
                    '	var panel = document.getElementById("settings_placeholder");',
                    '	var widgets = ["device", "baudrate", "databit", "stopbit", "checkbit"];',
                    '	widgets.forEach(function(w) {',
                    '		var el = document.getElementById("cbi-lorawan-gateway-serial-" + w);',
                    '		if (el && panel) {',
                    '			panel.appendChild(el);',
                    '		}',
                    '	});',
                    '	var btnOpen = document.getElementById("btn_open_close");',
                    '	if (btnOpen) {',
                    '		btnOpen.onclick = function(e) {',
                    '			e.preventDefault();',
                    '			var mqttEnabled = document.getElementById("cbid.lorawan-gateway.serial.mqtt_enabled");',
                    '			if (mqttEnabled && mqttEnabled.checked) {',
                    '				alert("Please disable MQTT to enable serial port tool");',
                    '				return;',
                    '			}',
                    '			if (this.innerText === "Open Serial Port") {',
                    '				this.innerText = "Close Serial Port";',
                    '				this.className = "cbi-button cbi-button-reset tool-btn";',
                    '			} else {',
                    '				this.innerText = "Open Serial Port";',
                    '				this.className = "cbi-button cbi-button-apply tool-btn";',
                    '			}',
                    '		};',
                    '	}',
                    '});'
                ].join('\n'))
            ]);
        };
        
        // Connection section header
        o = s.taboption('mqtt', form.DummyValue, "_connection_header");
        o.rawhtml = true;
        o.cfgvalue = function() {
            return '<h3 style="margin-top:0;padding-top:10px;border-bottom:1px solid #ccc;">Connection</h3>';
        };

        // Get mqtt section for reading values
        o = s.taboption('mqtt', form.Flag, "mqtt_enabled", _("Enable MQTT Bridge"));
        o.rmempty = false;
        o.default = "0";
        o.cfgvalue = function(section_id) {
            return uci.get('lorawan-gateway', 'mqtt', 'enabled') || '0';
        };
        o.write = function(section_id, value) {
            return uci.set('lorawan-gateway', 'mqtt', 'enabled', value);
        };

        o = s.taboption('mqtt', form.ListValue, "mqtt_transport", _("Transport Protocol"));
        o.value("tcp", "TCP");
        o.value("ssl", "SSL/TLS");
        o.value("ws", "WebSocket");
        o.value("wss", "WebSocket Secure");
        o.default = "tcp";
        o.cfgvalue = function(section_id) {
            return uci.get('lorawan-gateway', 'mqtt', 'transport') || 'tcp';
        };
        o.write = function(section_id, value) {
            return uci.set('lorawan-gateway', 'mqtt', 'transport', value);
        };

        o = s.taboption('mqtt', form.Value, "mqtt_host", _("Server Address"));
        o.datatype = "or(hostname,ipaddr)";
        o.placeholder = "mqtt.example.com";
        o.rmempty = false;
        o.cfgvalue = function(section_id) {
            return uci.get('lorawan-gateway', 'mqtt', 'host') || '';
        };
        o.write = function(section_id, value) {
            return uci.set('lorawan-gateway', 'mqtt', 'host', value);
        };

        o = s.taboption('mqtt', form.Value, "mqtt_port", _("Server Port"));
        o.datatype = "port";
        o.placeholder = "1883";
        o.default = "1883";
        o.cfgvalue = function(section_id) {
            return uci.get('lorawan-gateway', 'mqtt', 'port') || '1883';
        };
        o.write = function(section_id, value) {
            return uci.set('lorawan-gateway', 'mqtt', 'port', value);
        };

        o = s.taboption('mqtt', form.Value, "mqtt_client_id", _("Client ID"));
        o.datatype = "maxlength(32)";
        o.placeholder = "gateway-bridge";
        o.cfgvalue = function(section_id) {
            return uci.get('lorawan-gateway', 'mqtt', 'client_id') || '';
        };
        o.write = function(section_id, value) {
            return uci.set('lorawan-gateway', 'mqtt', 'client_id', value);
        };

        o = s.taboption('mqtt', form.Value, "mqtt_keepalive", _("Keep Alive (seconds)"));
        o.datatype = "range(5,120)";
        o.placeholder = "30";
        o.default = "30";
        o.cfgvalue = function(section_id) {
            return uci.get('lorawan-gateway', 'mqtt', 'keepalive') || '30';
        };
        o.write = function(section_id, value) {
            return uci.set('lorawan-gateway', 'mqtt', 'keepalive', value);
        };

        // Serial Select section header
        o = s.taboption('mqtt', form.DummyValue, "_serial_header");
        o.rawhtml = true;
        o.cfgvalue = function() {
            return '<h3 style="margin-top:20px;padding-top:10px;border-bottom:1px solid #ccc;">Serial Select</h3>';
        };

        o = s.taboption('mqtt', form.ListValue, "mqtt_device", _("Port"));
        o.value("ttyAMA2", "ttyAMA2");
        o.value("ttyAMA3", "ttyAMA3");
        o.value("ttyAMA4", "ttyAMA4");
        o.default = "ttyAMA2";
        o.rmempty = false;
        o.cfgvalue = function(section_id) {
            return uci.get('lorawan-gateway', 'mqtt', 'device') || 'ttyAMA2';
        };
        o.write = function(section_id, value) {
            return uci.set('lorawan-gateway', 'mqtt', 'device', value);
        };

        o = s.taboption('mqtt', form.ListValue, "mqtt_baudrate", _("Baudrate"));
        o.value("110", "110");
        o.value("300", "300");
        o.value("600", "600");
        o.value("1200", "1200");
        o.value("2400", "2400");
        o.value("4800", "4800");
        o.value("9600", "9600");
        o.value("14400", "14400");
        o.value("19200", "19200");
        o.value("38400", "38400");
        o.value("57600", "57600");
        o.value("115200", "115200");
        o.value("128000", "128000");
        o.value("256000", "256000");
        o.default = "9600";
        o.rmempty = false;
        o.cfgvalue = function(section_id) {
            return uci.get('lorawan-gateway', 'mqtt', 'baudrate') || '9600';
        };
        o.write = function(section_id, value) {
            return uci.set('lorawan-gateway', 'mqtt', 'baudrate', value);
        };

        o = s.taboption('mqtt', form.ListValue, "mqtt_databit", _("Data Bits"));
        o.value("5", "5");
        o.value("6", "6");
        o.value("7", "7");
        o.value("8", "8");
        o.default = "8";
        o.rmempty = false;
        o.cfgvalue = function(section_id) {
            return uci.get('lorawan-gateway', 'mqtt', 'databit') || '8';
        };
        o.write = function(section_id, value) {
            return uci.set('lorawan-gateway', 'mqtt', 'databit', value);
        };

        o = s.taboption('mqtt', form.ListValue, "mqtt_stopbit", _("Stop Bits"));
        o.value("1", "1");
        o.value("1.5", "1.5");
        o.value("2", "2");
        o.default = "1";
        o.rmempty = false;
        o.cfgvalue = function(section_id) {
            return uci.get('lorawan-gateway', 'mqtt', 'stopbit') || '1';
        };
        o.write = function(section_id, value) {
            return uci.set('lorawan-gateway', 'mqtt', 'stopbit', value);
        };

        o = s.taboption('mqtt', form.ListValue, "mqtt_checkbit", _("Parity"));
        o.value("none", _("None"));
        o.value("odd", _("Odd"));
        o.value("even", _("Even"));
        o.value("mark", _("Mark"));
        o.value("space", _("Space"));
        o.default = "none";
        o.rmempty = false;
        o.cfgvalue = function(section_id) {
            return uci.get('lorawan-gateway', 'mqtt', 'checkbit') || 'none';
        };
        o.write = function(section_id, value) {
            return uci.set('lorawan-gateway', 'mqtt', 'checkbit', value);
        };

        // Security section header
        o = s.taboption('mqtt', form.DummyValue, "_security_header");
        o.rawhtml = true;
        o.cfgvalue = function() {
            return '<h3 style="margin-top:20px;padding-top:10px;border-bottom:1px solid #ccc;">Security</h3>';
        };

        o = s.taboption('mqtt', form.Value, "mqtt_username", _("Username"));
        o.optional = true;
        o.cfgvalue = function(section_id) {
            return uci.get('lorawan-gateway', 'mqtt', 'username') || '';
        };
        o.write = function(section_id, value) {
            return uci.set('lorawan-gateway', 'mqtt', 'username', value);
        };

        o = s.taboption('mqtt', form.Value, "mqtt_password", _("Password"));
        o.password = true;
        o.optional = true;
        o.cfgvalue = function(section_id) {
            return uci.get('lorawan-gateway', 'mqtt', 'password') || '';
        };
        o.write = function(section_id, value) {
            return uci.set('lorawan-gateway', 'mqtt', 'password', value);
        };

        o = s.taboption('mqtt', form.ListValue, "mqtt_auth_mode", _("Authentication Mode"));
        o.value("none", _("Username/Password Only"));
        o.value("tls-server", _("TLS Server Verification"));
        o.value("mutual-tls", _("Mutual TLS"));
        o.value("token", _("Token Authentication"));
        o.default = "none";
        o.cfgvalue = function(section_id) {
            return uci.get('lorawan-gateway', 'mqtt', 'auth_mode') || 'none';
        };
        o.write = function(section_id, value) {
            return uci.set('lorawan-gateway', 'mqtt', 'auth_mode', value);
        };

        o = s.taboption('mqtt', form.TextValue, "mqtt_ca_cert", _("CA Certificate"));
        o.rows = 6;
        o.wrap = "off";
        o.optional = true;
        o.depends("mqtt_auth_mode", "tls-server");
        o.depends("mqtt_auth_mode", "mutual-tls");
        o.cfgvalue = function(section_id) {
            return uci.get('lorawan-gateway', 'mqtt', 'ca_cert') || '';
        };
        o.write = function(section_id, value) {
            return uci.set('lorawan-gateway', 'mqtt', 'ca_cert', value);
        };

        o = s.taboption('mqtt', form.TextValue, "mqtt_client_cert", _("Client Certificate"));
        o.rows = 6;
        o.wrap = "off";
        o.optional = true;
        o.depends("mqtt_auth_mode", "mutual-tls");
        o.cfgvalue = function(section_id) {
            return uci.get('lorawan-gateway', 'mqtt', 'client_cert') || '';
        };
        o.write = function(section_id, value) {
            return uci.set('lorawan-gateway', 'mqtt', 'client_cert', value);
        };

        o = s.taboption('mqtt', form.TextValue, "mqtt_client_key", _("Client Private Key"));
        o.rows = 6;
        o.wrap = "off";
        o.optional = true;
        o.depends("mqtt_auth_mode", "mutual-tls");
        o.cfgvalue = function(section_id) {
            return uci.get('lorawan-gateway', 'mqtt', 'client_key') || '';
        };
        o.write = function(section_id, value) {
            return uci.set('lorawan-gateway', 'mqtt', 'client_key', value);
        };

        o = s.taboption('mqtt', form.Value, "mqtt_token", _("Access Token"));
        o.optional = true;
        o.depends("mqtt_auth_mode", "token");
        o.cfgvalue = function(section_id) {
            return uci.get('lorawan-gateway', 'mqtt', 'token') || '';
        };
        o.write = function(section_id, value) {
            return uci.set('lorawan-gateway', 'mqtt', 'token', value);
        };

        // Topic Mapping section header
        o = s.taboption('mqtt', form.DummyValue, "_topic_header");
        o.rawhtml = true;
        o.cfgvalue = function() {
            return '<h3 style="margin-top:20px;padding-top:10px;border-bottom:1px solid #ccc;">Topic Mapping</h3>';
        };

        o = s.taboption('mqtt', form.Value, "mqtt_uplink_topic", _("Uplink Topic"));
        o.placeholder = "lorawan/uplink";
        o.rmempty = false;
        o.default = "lorawan/uplink";
        o.cfgvalue = function(section_id) {
            return uci.get('lorawan-gateway', 'mqtt', 'uplink_topic') || 'lorawan/uplink';
        };
        o.write = function(section_id, value) {
            return uci.set('lorawan-gateway', 'mqtt', 'uplink_topic', value);
        };

        o = s.taboption('mqtt', form.Value, "mqtt_downlink_topic", _("Downlink Topic"));
        o.placeholder = "lorawan/downlink";
        o.rmempty = false;
        o.default = "lorawan/downlink";
        o.cfgvalue = function(section_id) {
            return uci.get('lorawan-gateway', 'mqtt', 'downlink_topic') || 'lorawan/downlink';
        };
        o.write = function(section_id, value) {
            return uci.set('lorawan-gateway', 'mqtt', 'downlink_topic', value);
        };

        o = s.taboption('mqtt', form.DynamicList, "mqtt_event_topics", _("Additional Event Topics"));
        o.placeholder = "lorawan/event/#";
        o.cfgvalue = function(section_id) {
            return uci.get('lorawan-gateway', 'mqtt', 'event_topics') || [];
        };
        o.write = function(section_id, value) {
            return uci.set('lorawan-gateway', 'mqtt', 'event_topics', value);
        };

        o = s.taboption('mqtt', form.Flag, "mqtt_retain_status", _("Retain Status Messages"));
        o.default = "0";
        o.cfgvalue = function(section_id) {
            return uci.get('lorawan-gateway', 'mqtt', 'retain_status') || '0';
        };
        o.write = function(section_id, value) {
            return uci.set('lorawan-gateway', 'mqtt', 'retain_status', value);
        };

        // Advanced section header
        o = s.taboption('mqtt', form.DummyValue, "_advanced_header");
        o.rawhtml = true;
        o.cfgvalue = function() {
            return '<h3 style="margin-top:20px;padding-top:10px;border-bottom:1px solid #ccc;">Advanced</h3>';
        };

        o = s.taboption('mqtt', form.Flag, "mqtt_clean_session", _("Clean Session"));
        o.default = "1";
        o.cfgvalue = function(section_id) {
            return uci.get('lorawan-gateway', 'mqtt', 'clean_session') || '1';
        };
        o.write = function(section_id, value) {
            return uci.set('lorawan-gateway', 'mqtt', 'clean_session', value);
        };

        o = s.taboption('mqtt', form.ListValue, "mqtt_qos", _("QoS Level"));
        o.value("0", "0 - At most once");
        o.value("1", "1 - At least once");
        o.value("2", "2 - Exactly once");
        o.default = "0";
        o.cfgvalue = function(section_id) {
            return uci.get('lorawan-gateway', 'mqtt', 'qos') || '0';
        };
        o.write = function(section_id, value) {
            return uci.set('lorawan-gateway', 'mqtt', 'qos', value);
        };

        o = s.taboption('mqtt', form.Value, "mqtt_reconnect_delay", _("Reconnect Delay (seconds)"));
        o.datatype = "range(1,120)";
        o.placeholder = "5";
        o.default = "5";
        o.cfgvalue = function(section_id) {
            return uci.get('lorawan-gateway', 'mqtt', 'reconnect_delay') || '5';
        };
        o.write = function(section_id, value) {
            return uci.set('lorawan-gateway', 'mqtt', 'reconnect_delay', value);
        };

        o = s.taboption('mqtt', form.TextValue, "mqtt_notes", _("Maintenance Notes"));
        o.rows = 4;
        o.placeholder = _("Record platform access credentials, certificate expiration dates, etc.");
        o.optional = true;
        o.cfgvalue = function(section_id) {
            return uci.get('lorawan-gateway', 'mqtt', 'notes') || '';
        };
        o.write = function(section_id, value) {
            return uci.set('lorawan-gateway', 'mqtt', 'notes', value);
        };

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
