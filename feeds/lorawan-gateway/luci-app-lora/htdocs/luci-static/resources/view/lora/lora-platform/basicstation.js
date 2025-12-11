'use strict';
'require form';
'require view';
'require uci';
'require tools.widgets as widgets';

return view.extend({
    view: function () {
        let s, o;

        var mMap = new form.Map('basicstation');

        s = mMap.section(form.NamedSection, 'auth', 'auth',
            _('Advanced Settings'));

        o = s.option(form.ListValue, 'cred', _('Credentials'),
            _('Credentials for LNS (TC) or CUPS (CUPS)'));
        o.value('tc', _('TC'));
        o.value('cups', _('CUPS'));
        o.default = 'cups';

        o = s.option(form.ListValue, 'mode', _('Authentication mode'),
            _('Authentication mode for server connection'));
        o.value('no', _('No Authentication'));
        o.value('server', _('TLS Server Authentication'));
        o.value('serverAndClient', _('TLS Server and Client Authentication'));
        o.value('serverAndClientToken', _('TLS Server Authentication and Client Token'));
        o.default = 'serverAndClientToken';

        o = s.option(form.Value, 'addr', _('Server address'));
        o.optional = false;
        o.rmempty = false;
        o.placeholder = 'eu1.cloud.thethings.network';

        o = s.option(form.Value, 'port', _('Port'));
        o.optional = false;
        o.rmempty = false;
        o.datatype = 'uinteger';
        o.placeholder = '8887';

        o = s.option(form.Value, 'token', _('Authorization token'));
        o.optional = false;
        o.rmempty = false;
        o.depends({ mode: 'serverAndClientToken' });

        o = s.option(form.Value, 'key', _('Private station key'));
        o.optional = false;
        o.rmempty = false;
        o.depends({ mode: 'serverAndClient' });

        o = s.option(form.FileUpload, 'crt', _('Private station certificate'));
        o.optional = false;
        o.rmempty = false;
        o.depends({ mode: "serverAndClient" });

        o = s.option(form.FileUpload, 'trust', _('CA certificate'));
        o.optional = false;
        o.rmempty = false;
        o.depends({ mode: "no", "!reverse": true });

        return mMap;
    }
});