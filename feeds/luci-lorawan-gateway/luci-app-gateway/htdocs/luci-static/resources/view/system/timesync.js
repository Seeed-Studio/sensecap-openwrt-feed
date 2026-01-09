'use strict';
'require view';
'require poll';
'require ui';
'require uci';
'require rpc';
'require form';
'require tools.widgets as widgets';

var callRcList, callRcInit, callTimezone,
    callGetLocaltime, callSetLocaltime, CBILocalTime;

callRcList = rpc.declare({
    object: 'rc',
    method: 'list',
    params: ['name'],
    expect: { '': {} },
    filter: function (res) {
        for (var k in res)
            return +res[k].enabled;
        return null;
    }
});

callRcInit = rpc.declare({
    object: 'rc',
    method: 'init',
    params: ['name', 'action'],
    expect: { result: false }
});

callGetLocaltime = rpc.declare({
    object: 'system',
    method: 'info',
    expect: { localtime: 0 }
});

callSetLocaltime = rpc.declare({
    object: 'luci',
    method: 'setLocaltime',
    params: ['localtime'],
    expect: { result: 0 }
});

callTimezone = rpc.declare({
    object: 'luci',
    method: 'getTimezones',
    expect: { '': {} }
});

function formatTime(epoch) {
    var date = new Date(epoch * 1000);

    return '%04d-%02d-%02d %02d:%02d:%02d'.format(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds()
    );
}

CBILocalTime = form.DummyValue.extend({
    renderWidget: function (section_id, option_id, cfgvalue) {
        return E([], [
            E('input', {
                'id': 'localtime',
                'type': 'text',
                'readonly': true,
                'value': formatTime(cfgvalue)
            }),
            E('br'),
            E('span', { 'class': 'control-group' }, [
                E('button', {
                    'class': 'cbi-button cbi-button-apply',
                    'click': ui.createHandlerFn(this, function () {
                        return callSetLocaltime(Math.floor(Date.now() / 1000));
                    }),
                    'disabled': (this.readonly != null) ? this.readonly : this.map.readonly
                }, _('Sync with browser')),
                ' ',
                this.ntpd_support ? E('button', {
                    'class': 'cbi-button cbi-button-apply',
                    'click': ui.createHandlerFn(this, function () {
                        return callRcInit('sysntpd', 'restart');
                    }),
                    'disabled': (this.readonly != null) ? this.readonly : this.map.readonly
                }, _('Sync with NTP-Server')) : ''
            ])
        ]);
    },
});

return view.extend({
    load: function () {
        return Promise.all([
            callRcList('sysntpd'),
            callTimezone(),
            callGetLocaltime(),
            uci.load('luci'),
            uci.load('system')
        ]);
    },

    render: function (rpc_replies) {
        var ntpd_enabled = rpc_replies[0],
            timezones = rpc_replies[1],
            localtime = rpc_replies[2],
            m, s, o;

        m = new form.Map('system',
            _('Time Synchronization'),
            _('Configure time synchronization and timezone settings.'));

        m.chain('luci');

        s = m.section(form.TypedSection, 'system');
        s.anonymous = true;
        s.addremove = false;

        o = s.option(CBILocalTime, '_systime', _('Local Time'));
        o.cfgvalue = function () { return localtime };
        o.ntpd_support = ntpd_enabled;

        o = s.option(form.ListValue, 'zonename', _('Timezone'));
        o.value('UTC');

        var zones = Object.keys(timezones || {}).sort();
        for (var i = 0; i < zones.length; i++)
            o.value(zones[i]);

        o.write = function (section_id, formvalue) {
            var tz = timezones[formvalue] ? timezones[formvalue].tzstring : null;
            uci.set('system', section_id, 'zonename', formvalue);
            uci.set('system', section_id, 'timezone', tz);
        };

        /*
         * NTP
         */

        if (L.hasSystemFeature('sysntpd')) {
            var default_servers = [
                '0.openwrt.pool.ntp.org', '1.openwrt.pool.ntp.org',
                '2.openwrt.pool.ntp.org', '3.openwrt.pool.ntp.org'
            ];

            o = s.option(form.Flag, 'enabled', _('Enable NTP client'));
            o.rmempty = false;
            o.ucisection = 'ntp';
            o.default = o.disabled;
            o.write = function (section_id, value) {
                ntpd_enabled = +value;

                if (ntpd_enabled && !uci.get('system', 'ntp')) {
                    uci.add('system', 'timeserver', 'ntp');
                    uci.set('system', 'ntp', 'server', default_servers);
                }

                if (!ntpd_enabled)
                    uci.set('system', 'ntp', 'enabled', 0);
                else
                    uci.unset('system', 'ntp', 'enabled');

                return callRcInit('sysntpd', 'enable');
            };
            o.load = function (section_id) {
                return (ntpd_enabled == 1 &&
                    uci.get('system', 'ntp') != null &&
                    uci.get('system', 'ntp', 'enabled') != 0) ? '1' : '0';
            };

            o = s.option(form.Flag, 'enable_server', _('Provide NTP server'));
            o.ucisection = 'ntp';
            o.depends('enabled', '1');

            o = s.option(widgets.NetworkSelect, 'interface',
                _('Bind NTP server'),
                _('Provide the NTP server to the selected interface or, if unspecified, to all interfaces'));
            o.ucisection = 'ntp';
            o.depends('enable_server', '1');
            o.multiple = false;
            o.nocreate = true;
            o.optional = true;

            o = s.option(form.Flag, 'use_dhcp', _('Use DHCP advertised servers'));
            o.ucisection = 'ntp';
            o.default = o.enabled;
            o.depends('enabled', '1');

            o = s.option(form.DynamicList, 'server', _('NTP server candidates'),
                _('List of upstream NTP server candidates with which to synchronize.'));
            o.datatype = 'host(0)';
            o.ucisection = 'ntp';
            o.depends('enabled', '1');
            o.load = function (section_id) {
                return uci.get('system', 'ntp', 'server');
            };
        }

        return m.render().then(function (mapEl) {
            poll.add(function () {
                return callGetLocaltime().then(function (t) {
                    mapEl.querySelector('#localtime').value = formatTime(t);
                });
            }, 1);

            return mapEl;
        });
    }
});
