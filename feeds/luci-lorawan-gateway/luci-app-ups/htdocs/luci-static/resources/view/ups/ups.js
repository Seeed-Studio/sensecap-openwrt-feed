'use strict';
'require view';
'require form';
'require uci';

return view.extend({
    load: function() {
        return uci.load('ups-module');
    },

    render: function() {
        var m, s, o;

        m = new form.Map('ups-module', _('UPS Configuration'),
            _('Configure UPS power outage commands.'));

        s = m.section(form.NamedSection, 'cmd', 'ups', _('UPS Settings'));
        s.anonymous = true;
        s.addremove = false;

        o = s.option(form.DynamicList, 'commands', _('Power Outage Commands'));

        o = s.option(form.FileUpload, 'script', _('Power Outage Scripts'));
        o.optional = true;
        o.rmempty = true;

        return m.render();
    }
});