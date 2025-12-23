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
        var m, s, o;

        m = new form.Map('rs485-module', _('Serial Port Settings'), 
            _('Configure serial port parameters for RS485 communication.'));

        s = m.section(form.NamedSection, 'serial', 'serial');
        s.addremove = false;

        o = s.option(form.DummyValue, "_control_header");
        o.rawhtml = true;
        o.cfgvalue = function() {
            return '<h3 style="margin-top:0;padding-top:10px;">Port Control</h3>';
        };

        o = s.option(form.Button, '_toggle_serial', _('Serial Port Status'));
        o.inputtitle = function() {
            var enabled = uci.get('rs485-module', 'serial', 'enabled');
            return enabled === '1' ? _('Close Serial Port') : _('Open Serial Port');
        };
        o.inputstyle = function() {
            var enabled = uci.get('rs485-module', 'serial', 'enabled');
            return enabled === '1' ? 'reset' : 'apply';
        };
        o.onclick = function(ev) {
            var currentEnabled = uci.get('rs485-module', 'serial', 'enabled');
            
            if (currentEnabled === '1') {
                var mqttEnabled = uci.get('rs485-module', 'mqtt', 'enabled');
                if (mqttEnabled === '1') {
                    ui.showModal(_('Cannot Close Serial Port'), [
                        E('p', _('Please disable MQTT Bridge first before closing the serial port.')),
                        E('div', { 'style': 'display: flex; justify-content: space-between; margin-top: 10px;' }, [
                            E('button', {
                                'class': 'cbi-button cbi-button-primary',
                                'click': function() {
                                    ui.hideModal();
                                    window.location.href = '/cgi-bin/luci/admin/rs485/mqtt';
                                }
                            }, _('Go to MQTT Settings')),
                            E('button', {
                                'class': 'cbi-button',
                                'click': ui.hideModal
                            }, _('Cancel'))
                        ])
                    ]);
                    return;
                }
                uci.set('rs485-module', 'serial', 'enabled', '0');
                ev.target.textContent = _('Open Serial Port');
                ev.target.className = 'cbi-button cbi-button-apply';
            } else {
                uci.set('rs485-module', 'serial', 'enabled', '1');
                ev.target.textContent = _('Close Serial Port');
                ev.target.className = 'cbi-button cbi-button-reset';
            }
        };

        o = s.option(form.DummyValue, "_config_header");
        o.rawhtml = true;
        o.cfgvalue = function() {
            return '<h3 style="margin-top:20px;padding-top:10px;">Port Configuration</h3>';
        };

        o = s.option(form.ListValue, 'device', _('Serial Device'));
        o.value('ttyAMA2', 'ttyAMA2');
        o.value('ttyAMA3', 'ttyAMA3');
        o.value('ttyAMA4', 'ttyAMA4');
        o.value('ttyUSB0', 'ttyUSB0');
        o.value('ttyUSB1', 'ttyUSB1');
        o.default = 'ttyAMA2';

        o = s.option(form.ListValue, 'baudrate', _('Baud Rate'));
        o.value('1200', '1200');
        o.value('2400', '2400');
        o.value('4800', '4800');
        o.value('9600', '9600');
        o.value('19200', '19200');
        o.value('38400', '38400');
        o.value('57600', '57600');
        o.value('115200', '115200');
        o.default = '9600';

        o = s.option(form.ListValue, 'databit', _('Data Bits'));
        o.value('5', '5');
        o.value('6', '6');
        o.value('7', '7');
        o.value('8', '8');
        o.default = '8';

        o = s.option(form.ListValue, 'stopbit', _('Stop Bits'));
        o.value('1', '1');
        o.value('2', '2');
        o.default = '1';

        o = s.option(form.ListValue, 'checkbit', _('Parity'));
        o.value('none', _('None'));
        o.value('odd', _('Odd'));
        o.value('even', _('Even'));
        o.default = 'none';

        o = s.option(form.ListValue, 'flowcontrol', _('Flow Control'));
        o.value('none', _('None'));
        o.value('rtscts', _('RTS/CTS'));
        o.value('xonxoff', _('XON/XOFF'));
        o.default = 'none';

        o = s.option(form.Value, 'timeout', _('Read Timeout (ms)'));
        o.datatype = 'range(100,10000)';
        o.placeholder = '1000';
        o.default = '1000';

        return m.render();
    }
});
