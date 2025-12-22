'use strict';
'require view';
'require form';
'require uci';

return view.extend({
    load: function() {
        return uci.load('rs485-module');
    },

    render: function() {
        var m = new form.Map('rs485-module', _('Serial Port Settings'), _('Configure RS485 serial port parameters.'));
        var s = m.section(form.NamedSection, 'serial', _('RS485 Settings'));
        s.addremove = false;

        var o = s.option(form.ListValue, "device", _("Port"));
        o.value("ttyAMA2", "ttyAMA2");
        o.value("ttyAMA3", "ttyAMA3");
        o.value("ttyAMA4", "ttyAMA4");
        o.default = "ttyAMA2";
        o.rmempty = false;

        o = s.option(form.ListValue, "baudrate", _("Baudrate"));
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

        o = s.option(form.ListValue, "databit", _("Data Bits"));
        o.value("5", "5");
        o.value("6", "6");
        o.value("7", "7");
        o.value("8", "8");
        o.default = "8";
        o.rmempty = false;

        o = s.option(form.ListValue, "stopbit", _("Stop Bits"));
        o.value("1", "1");
        o.value("1.5", "1.5");
        o.value("2", "2");
        o.default = "1";
        o.rmempty = false;

        o = s.option(form.ListValue, "checkbit", _("Parity"));
        o.value("none", _("None"));
        o.value("odd", _("Odd"));
        o.value("even", _("Even"));
        o.value("mark", _("Mark"));
        o.value("space", _("Space"));
        o.default = "none";
        o.rmempty = false;

        // Serial Tool UI Container
        o = s.option(form.DummyValue, '_tool_ui');
        o.render = function() {
            return E('div', { 'class': 'serial-tool-container' }, [
                E('style', [
                    '.serial-tool-container { display: flex; flex-direction: column; gap: 8px; margin-top: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 4px; background: #fafafa; }',
                    '.tool-row { display: flex; gap: 10px; align-items: stretch; }',
                    '.tool-left { flex: 1; display: flex; flex-direction: column; min-width: 0; }',  
                    '.tool-right { flex: 0.6; display: flex; flex-direction: column; gap: 8px; }',
                    '.rx-box { height: 300px; width: 100%; resize: vertical; font-family: monospace; font-size: 12px; padding: 8px; border: 1px solid #ccc; border-radius: 3px; box-sizing: border-box; background: #fff; }',
                    '.tx-box { height: 100px; width: 100%; resize: vertical; font-family: monospace; font-size: 12px; padding: 8px; border: 1px solid #ccc; border-radius: 3px; box-sizing: border-box; background: #fff; }',
                    '#serial_settings_panel { display: flex; flex-direction: column; gap: 5px; width: 100%; }',
                    '#serial_settings_panel .cbi-value { margin: 0; padding: 0; border: none; background: #fff; border-radius: 3px; display: flex; width: 100%; }',
                    '#serial_settings_panel .cbi-value-title { width: 35%; min-width: 100px; padding: 8px 10px; font-size: 13px; font-weight: 500; text-align: left; }',
                    '#serial_settings_panel .cbi-value-field { width: 65%; padding: 6px 10px; }',
                    '#serial_settings_panel .cbi-value-field select { width: 100%; font-size: 12px; height: 32px; }',
                    '.tool-btn { width: 100%; height: 32px; margin: 0; font-size: 13px; cursor: pointer; }',
                    '.tool-label { font-weight: 600; margin-bottom: 5px; font-size: 14px; color: #333; }',
                ]),
                E('div', { 'class': 'tool-row' }, [
                    E('div', { 'class': 'tool-left' }, [
                        E('div', { 'class': 'tool-label' }, _('Receive Buffer')),
                        E('textarea', { 'id': 'serial_rx', 'class': 'rx-box', 'readonly': 'readonly', 'placeholder': 'Received data will appear here...' })
                    ]),
                    E('div', { 'class': 'tool-right', 'id': 'serial_settings_panel' }, [
                        E('div', { 'class': 'tool-label', 'style': 'text-align: center; margin-bottom: 8px;' }, _('Serial Settings')),
                        E('div', { 'id': 'settings_placeholder' }),
                        E('div', { 'class': 'divider' }),
                        E('button', { 'class': 'cbi-button cbi-button-apply tool-btn', 'id': 'btn_open_close' }, _('Open Serial Port')),
                        E('button', { 'class': 'cbi-button cbi-button-reset tool-btn', 'id': 'btn_clear_rx' }, _('Clear Receive'))
                    ])
                ]),
                E('div', { 'class': 'tool-row' }, [
                    E('div', { 'class': 'tool-left' }, [
                        E('div', { 'class': 'tool-label' }, _('Send Buffer')),
                        E('textarea', { 'id': 'serial_tx', 'class': 'tx-box', 'placeholder': 'Enter data to send...' })
                    ]),
                    E('div', { 'class': 'tool-right' }, [
                        E('div', { 'style': 'height: 24px;' }),
                        E('button', { 'class': 'cbi-button cbi-button-action tool-btn', 'id': 'btn_send', 'disabled': 'disabled' }, _('Send')),
                        E('button', { 'class': 'cbi-button cbi-button-reset tool-btn', 'id': 'btn_clear_tx' }, _('Clear Send'))
                    ])
                ]),
                E('script', [
                    'setTimeout(function() {',
                    'var panel = document.getElementById("settings_placeholder");',
                    'var widgets = ["device", "baudrate", "databit", "stopbit", "checkbit"];',
                    'widgets.forEach(function(w) {',
                    'var el = document.getElementById("cbid.rs485-module-serial-" + w);',
                    'if (!el) el = document.querySelector("[id*=\'serial-" + w + "\']");',
                    'if (el && panel) {',
                    'panel.appendChild(el);',
                    '}',
                    '});',
                    '',
                    'var btnOpen = document.getElementById("btn_open_close");',
                    'var btnSend = document.getElementById("btn_send");',
                    'var btnClearRx = document.getElementById("btn_clear_rx");',
                    'var btnClearTx = document.getElementById("btn_clear_tx");',
                    'var rxBox = document.getElementById("serial_rx");',
                    'var txBox = document.getElementById("serial_tx");',
                    'var isOpen = false;',
                    '',
                    'if (btnOpen) {',
                    'btnOpen.onclick = function(e) {',
                    'e.preventDefault();',
                    'isOpen = !isOpen;',
                    'if (isOpen) {',
                    'this.textContent = "Close Serial Port";',
                    'this.className = "cbi-button cbi-button-negative tool-btn";',
                    'btnSend.disabled = false;',
                    'rxBox.value = "[" + new Date().toLocaleTimeString() + "] Serial port opened\\n";',
                    '} else {',
                    'this.textContent = "Open Serial Port";',
                    'this.className = "cbi-button cbi-button-apply tool-btn";',
                    'btnSend.disabled = true;',
                    'rxBox.value += "[" + new Date().toLocaleTimeString() + "] Serial port closed\\n";',
                    '}',
                    '};',
                    '}',
                    '',
                    'if (btnSend) {',
                    'btnSend.onclick = function(e) {',
                    'e.preventDefault();',
                    'if (!isOpen) return;',
                    'var data = txBox.value;',
                    'if (data) {',
                    'rxBox.value += "[" + new Date().toLocaleTimeString() + "] TX: " + data + "\\n";',
                    'rxBox.scrollTop = rxBox.scrollHeight;',
                    '}',
                    '};',
                    '}',
                    '',
                    'if (btnClearRx) {',
                    'btnClearRx.onclick = function(e) {',
                    'e.preventDefault();',
                    'rxBox.value = "";',
                    '};',
                    '}',
                    '',
                    'if (btnClearTx) {',
                    'btnClearTx.onclick = function(e) {',
                    'e.preventDefault();',
                    'txBox.value = "";',
                    '};',
                    '}',
                    '}, 100);'
                ].join('\n'))
            ]);
        };

        return m.render();
    }
});
