'use strict';
'require view';
'require ui';
'require uci';
'require rpc';
'require form';

var callTimezone;

callTimezone = rpc.declare({
    object: 'luci',
    method: 'getTimezones',
    expect: { '': {} }
});

return view.extend({
    load: function () {
        return Promise.all([
            callTimezone(),
            uci.load('luci'),
            uci.load('system')
        ]);
    },

    render: function (rpc_replies) {
        var timezones = rpc_replies[0],
            m, s, o;

        m = new form.Map('system',
            _('General Settings'),
            _('Configure the basic aspects of your device.'));

        m.chain('luci');

        s = m.section(form.TypedSection, 'system');
        s.anonymous = true;
        s.addremove = false;

        o = s.option(form.Value, 'hostname', _('Hostname'));
        o.datatype = 'hostname';
        o.default = 'SenseCAP';

        o = s.option(form.Value, 'description', _('Description'), _('An optional, short description for this device'));
        o.optional = true;

        o = s.option(form.TextValue, 'notes', _('Notes'), _('Optional, free-form notes about this device'));
        o.optional = true;

        return m.render();
    }
});
