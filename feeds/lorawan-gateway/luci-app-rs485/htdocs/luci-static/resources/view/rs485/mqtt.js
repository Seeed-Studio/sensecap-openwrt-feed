'use strict';
'require view';
'require form';
'require uci';
'require ui';

return view.extend({
    load: function() {
        return uci.load('rs485-module');
    },

    render: function() {
        var m = new form.Map('rs485-module', _('MQTT Settings'), _('Configure MQTT bridge parameters.'));
        var s = m.section(form.NamedSection, 'mqtt', 'mqtt');
        s.addremove = false;
        
        var o = s.option(form.DummyValue, "_connection_header");
        o.rawhtml = true;
        o.cfgvalue = function() {
            return '<h3 style="margin-top:0;padding-top:10px;">Connection</h3>';
        };

        o = s.option(form.Button, '_toggle_mqtt', _('MQTT Bridge Status'));
        o.inputtitle = function() {
            var enabled = uci.get('rs485-module', 'mqtt', 'enabled');
            return enabled === '1' ? _('Disable MQTT Bridge') : _('Enable MQTT Bridge');
        };
        o.inputstyle = function() {
            var enabled = uci.get('rs485-module', 'mqtt', 'enabled');
            return enabled === '1' ? 'reset' : 'apply';
        };
        o.onclick = function(ev) {
            var currentEnabled = uci.get('rs485-module', 'mqtt', 'enabled');
            
            if (currentEnabled !== '1') {
                var serialEnabled = uci.get('rs485-module', 'serial', 'enabled');
                if (serialEnabled !== '1') {
                    ui.showModal(_('Cannot Enable MQTT Bridge'), [
                        E('p', _('Please enable Serial Port first before enabling MQTT Bridge.')),
                        E('div', { 'style': 'display: flex; justify-content: space-between; margin-top: 10px;' }, [
                            E('button', {
                                'class': 'cbi-button cbi-button-primary',
                                'click': function() {
                                    ui.hideModal();
                                    window.location.href = '/cgi-bin/luci/admin/rs485/serial';
                                }
                            }, _('Go to Serial Settings')),
                            E('button', {
                                'class': 'cbi-button',
                                'click': ui.hideModal
                            }, _('Cancel'))
                        ])
                    ]);
                    return;
                }
                uci.set('rs485-module', 'mqtt', 'enabled', '1');
                ev.target.textContent = _('Disable MQTT Bridge');
                ev.target.className = 'cbi-button cbi-button-reset';
            } else {
                uci.set('rs485-module', 'mqtt', 'enabled', '0');
                ev.target.textContent = _('Enable MQTT Bridge');
                ev.target.className = 'cbi-button cbi-button-apply';
            }
        };

        o = s.option(form.ListValue, "transport", _("Transport Protocol"));
        o.value("tcp", "TCP");
        o.value("ssl", "SSL/TLS");
        o.value("ws", "WebSocket");
        o.value("wss", "WebSocket Secure");
        o.default = "tcp";

        o = s.option(form.Value, "host", _("Server Address"));
        o.datatype = "or(hostname,ipaddr)";
        o.placeholder = "mqtt.example.com";
        o.rmempty = false;

        o = s.option(form.Value, "port", _("Server Port"));
        o.datatype = "port";
        o.placeholder = "1883";
        o.default = "1883";

        o = s.option(form.Value, "client_id", _("Client ID"));
        o.datatype = "maxlength(32)";
        o.placeholder = "gateway-bridge";

        o = s.option(form.Value, "keepalive", _("Keep Alive (seconds)"));
        o.datatype = "range(5,120)";
        o.placeholder = "30";
        o.default = "30";
        
        // Security section header
        o = s.option(form.DummyValue, "_security_header");
        o.rawhtml = true;
        o.cfgvalue = function() {
            return '<h3 style="margin-top:20px;padding-top:10px;">Security</h3>';
        };

        o = s.option(form.Value, "username", _("Username"));
        o.optional = true;

        o = s.option(form.Value, "password", _("Password"));
        o.password = true;
        o.optional = true;

        o = s.option(form.ListValue, "auth_mode", _("Authentication Mode"));
        o.value("none", _("Username/Password Only"));
        o.value("tls-server", _("TLS Server Verification"));
        o.value("mutual-tls", _("Mutual TLS"));
        o.value("token", _("Token Authentication"));
        o.default = "none";

        o = s.option(form.FileUpload, "ca_cert", _("CA Certificate"));
        o.optional = true;
        o.depends("auth_mode", "tls-server");
        o.depends("auth_mode", "mutual-tls");

        o = s.option(form.FileUpload, "client_cert", _("Client Certificate"));
        o.optional = true;
        o.depends("auth_mode", "mutual-tls");

        o = s.option(form.FileUpload, "client_key", _("Client Private Key"));
        o.optional = true;
        o.depends("auth_mode", "mutual-tls");

        o = s.option(form.Value, "token", _("Access Token"));
        o.optional = true;
        o.depends("auth_mode", "token");

        o = s.option(form.DummyValue, "_topic_header");
        o.rawhtml = true;
        o.cfgvalue = function() {
            return '<h3 style="margin-top:20px;padding-top:10px;">Topic Mapping</h3>';
        };

        o = s.option(form.Value, "uplink_topic", _("Uplink Topic"));
        o.placeholder = "lorawan/uplink";
        o.rmempty = false;
        o.default = "lorawan/uplink";

        o = s.option(form.Value, "downlink_topic", _("Downlink Topic"));
        o.placeholder = "lorawan/downlink";
        o.rmempty = false;
        o.default = "lorawan/downlink";

        o = s.option(form.DynamicList, "event_topics", _("Additional Event Topics"));
        o.placeholder = "lorawan/event/#";

        o = s.option(form.Flag, "retain_status", _("Retain Status Messages"));
        o.default = "0";

        o = s.option(form.DummyValue, "_advanced_header");
        o.rawhtml = true;
        o.cfgvalue = function() {
            return '<h3 style="margin-top:20px;padding-top:10px;">Advanced</h3>';
        };

        o = s.option(form.Flag, "clean_session", _("Clean Session"));
        o.default = "1";

        o = s.option(form.ListValue, "qos", _("QoS Level"));
        o.value("0", "0 - At most once");
        o.value("1", "1 - At least once");
        o.value("2", "2 - Exactly once");
        o.default = "0";

        o = s.option(form.Value, "reconnect_delay", _("Reconnect Delay (seconds)"));
        o.datatype = "range(1,120)";
        o.placeholder = "5";
        o.default = "5";

        o = s.option(form.TextValue, "notes", _("Maintenance Notes"));
        o.rows = 4;
        o.placeholder = _("Record platform access credentials, certificate expiration dates, etc.");
        o.optional = true;

        return m.render();
    }
});
