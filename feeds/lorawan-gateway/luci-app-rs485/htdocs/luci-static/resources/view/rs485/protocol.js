'use strict';
'require view';
'require form';
'require fs';
'require ui';
'require uci';
'require rpc';

var callFileRead = rpc.declare({
    object: 'file',
    method: 'read',
    params: ['path'],
    expect: { data: '' }
});

return view.extend({
    load: function() {
        return Promise.all([
            L.resolveDefault(fs.stat('/tmp/rs485'), null)
        ]);
    },

    render: function(data) {
        var m, s, o;

        m = new form.Map('rs485-module', _('RS485 Protocol Configuration'),
            _('Configure RS485 protocol settings'));

        s = m.section(form.TypedSection, 'protocol', _('Protocol Settings'));
        s.anonymous = true;
        s.addremove = false;

        o = s.option(form.Flag, 'enabled', _('Enable Protocol Processing'));
        o.default = '0';
        o.rmempty = false;

        o = s.option(form.ListValue, 'type', _('Protocol Type'));
        o.value('modbus-rtu', 'Modbus RTU');
        o.value('bacnet-mstp', 'BACnet MS/TP');
        o.default = 'modbus-rtu';

        o = s.option(form.Value, 'device_address', _('Device Address (Slave ID)'));
        o.datatype = 'range(1,247)';
        o.placeholder = '1';
        o.default = '1';

        o = s.option(form.ListValue, 'function_code', _('Function Code'));
        o.value('01', '01 - Read Coils');
        o.value('02', '02 - Read Discrete Inputs');
        o.value('03', '03 - Read Holding Registers');
        o.value('04', '04 - Read Input Registers');
        o.value('05', '05 - Write Single Coil');
        o.value('06', '06 - Write Single Register');
        o.value('15', '15 - Write Multiple Coils');
        o.value('16', '16 - Write Multiple Registers');
        o.default = '03';

        o = s.option(form.Value, 'register_address', _('Register Address'));
        o.datatype = 'range(0,65535)';
        o.placeholder = '40001';
        o.default = '40001';

        o = s.option(form.Value, 'data_length', _('Data Length (Words/Bits)'));
        o.datatype = 'range(1,125)';
        o.placeholder = '10';
        o.default = '10';

        o = s.option(form.Flag, 'enable_crc', _('Enable CRC Check'));
        o.default = '1';
        o.rmempty = false;

        o = s.option(form.Button, '_show_frame_btn', _('Read Data'));
        o.inputtitle = _('Read Data');
        o.inputstyle = 'apply';
        o.depends('function_code', '01');
        o.depends('function_code', '02');
        o.depends('function_code', '03');
        o.depends('function_code', '04');
        o.onclick = L.bind(function (ev) {
            var btn = ev.target;
            var resultArea = document.getElementById('modbus_result');
            
            // Check if protocol is enabled first
            return uci.load('rs485-module').then(function() {
                var protocolEnabled = uci.get('rs485-module', 'protocol', 'enabled');
                
                if (protocolEnabled !== '1') {
                    if (resultArea) {
                        resultArea.value = 'Error: Protocol processing is not enabled. Please enable it and save first.';
                        resultArea.style.color = '#d00';
                    }
                    return Promise.reject('Protocol not enabled');
                }
                
                btn.disabled = true;
                btn.innerText = _('Reading...');
                
                // Clean up old files first
                return fs.exec('/bin/sh', ['-c', 'rm -f /tmp/rs485/modbus_read /tmp/rs485/modbus_result'])
                    .then(function() {
                        // Create trigger file
                        return fs.exec('/bin/sh', ['-c', 'mkdir -p /tmp/rs485 && touch /tmp/rs485/modbus_read']);
                    })
                    .then(function () {
                        // Poll for result file (max 5 seconds)
                        var pollCount = 0;
                        var pollInterval = setInterval(function () {
                            pollCount++;

                            L.resolveDefault(fs.read('/tmp/rs485/modbus_result'))
                                .then(function (content) {
                                    if (content) {
                                        clearInterval(pollInterval);
                                        if (resultArea) {
                                            if (content.startsWith('Error:')) {
                                                resultArea.value = content;
                                                resultArea.style.color = '#d00';
                                            } else {
                                                resultArea.value = content;
                                                resultArea.style.color = '#000';
                                            }
                                        }
                                        btn.disabled = false;
                                        btn.innerText = _('Read Data');
                                        // Clean up files
                                        fs.exec('/bin/sh', ['-c', 'rm -f /tmp/rs485/modbus_read /tmp/rs485/modbus_result']);
                                    }
                                })
                                .catch(function (err) {
                                    if (pollCount >= 50) {
                                        clearInterval(pollInterval);
                                        if (resultArea) {
                                            resultArea.value = 'Timeout: No response from Modbus device';
                                            resultArea.style.color = '#d00';
                                        }
                                        btn.disabled = false;
                                        btn.innerText = _('Read Data');
                                        // Clean up files
                                        fs.exec('/bin/sh', ['-c', 'rm -f /tmp/rs485/modbus_read /tmp/rs485/modbus_result']);
                                    }
                                });
                        }, 100);
                    });
            }).catch(function(err) {
                if (resultArea) {
                    resultArea.value = 'Error: ' + (err.message || err);
                    resultArea.style.color = '#d00';
                }
                btn.disabled = false;
                btn.innerText = _('Read Data');
            });
        }, this);

        // Write Data button (for function codes 05, 06, 15, 16)
        o = s.option(form.Button, '_write_data_btn', _('Write Data'));
        o.inputtitle = _('Write Data');
        o.inputstyle = 'apply';
        o.depends('function_code', '05');
        o.depends('function_code', '06');
        o.depends('function_code', '15');
        o.depends('function_code', '16');
        o.onclick = L.bind(function (ev) {
            var btn = ev.target;
            var resultArea = document.getElementById('modbus_result');
            
            // Check if protocol is enabled first
            return uci.load('rs485-module').then(function() {
                var protocolEnabled = uci.get('rs485-module', 'protocol', 'enabled');
                
                if (protocolEnabled !== '1') {
                    if (resultArea) {
                        resultArea.value = 'Error: Protocol processing is not enabled. Please enable it and save first.';
                        resultArea.style.color = '#d00';
                    }
                    return Promise.reject('Protocol not enabled');
                }
                
                btn.disabled = true;
                btn.innerText = _('Writing...');
                
                // Clean up old files first
                return fs.exec('/bin/sh', ['-c', 'rm -f /tmp/rs485/modbus_write /tmp/rs485/modbus_result'])
                    .then(function() {
                        return fs.exec('/bin/sh', ['-c', 'mkdir -p /tmp/rs485 && touch /tmp/rs485/modbus_write']);
                    })
                    .then(function () {
                        var pollCount = 0;
                        // Poll for result file (max 5 seconds)
                        var pollInterval = setInterval(function () {
                            pollCount++;

                            L.resolveDefault(fs.read('/tmp/rs485/modbus_result'))
                                .then(function (content) {
                                    if (content) {
                                        clearInterval(pollInterval);
                                        if (resultArea) {
                                            if (content.startsWith('Error:')) {
                                                resultArea.value = content;
                                                resultArea.style.color = '#d00';
                                            } else {
                                                resultArea.value = content;
                                                resultArea.style.color = '#000';
                                            }
                                        }
                                        btn.disabled = false;
                                        btn.innerText = _('Write Data');
                                        // Clean up files
                                        fs.exec('/bin/sh', ['-c', 'rm -f /tmp/rs485/modbus_write /tmp/rs485/modbus_result']);
                                    }
                                })
                                .catch(function (err) {
                                    if (pollCount >= 50) {
                                        clearInterval(pollInterval);
                                        if (resultArea) {
                                            resultArea.value = 'Timeout: No response from Modbus device';
                                            resultArea.style.color = '#d00';
                                        }
                                        btn.disabled = false;
                                        btn.innerText = _('Write Data');
                                        // Clean up files
                                        fs.exec('/bin/sh', ['-c', 'rm -f /tmp/rs485/modbus_write /tmp/rs485/modbus_result']);
                                    }
                                });
                        }, 100);
                    });
            }).catch(function(err) {
                if (resultArea) {
                    resultArea.value = 'Error: ' + (err.message || err);
                    resultArea.style.color = '#d00';
                }
                btn.disabled = false;
                btn.innerText = _('Write Data');
            });
        }, this);

        // Write data value input
        o = s.option(form.Value, 'write_value', _('Write Value'));
        o.depends('function_code', '05');
        o.depends('function_code', '06');
        o.depends('function_code', '15');
        o.depends('function_code', '16');

        // Result display area
        o = s.option(form.DummyValue, '_result_display', _('Frame Data'));
        o.rawhtml = true;
        o.cfgvalue = function() {
            return '<div style="margin-top:10px;">' +
                   '<textarea id="modbus_result" readonly style="width:100%;min-height:100px;font-family:monospace;padding:8px;background:#f5f5f5;border:1px solid #ddd;border-radius:4px;" placeholder="Frame data..."></textarea>' +
                   '</div>';
        };

        return m.render();
    }
});
