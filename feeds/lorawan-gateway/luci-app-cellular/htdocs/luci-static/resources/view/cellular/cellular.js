'use strict';
'require view';
'require form';
'require uci';

return view.extend({
    load: function() {
        return uci.load('lte_config');
    },

    render: function() {
        var m = new form.Map('lte_config', _('Cellular Configuration'), _('Configure cellular network parameters.'));

        // Main Section
        var s = m.section(form.NamedSection, 'cellular', _('Cellular Settings'));
        s.addremove = false;

        // Enable cellular
        var o = s.option(form.Flag, "enabled", _("Enable Cellular"));
        o.rmempty = false;
        o.default = "0";

        // APN
        o = s.option(form.Value, "apn", _("APN"));
        o.depends("enabled", "1");
        o.placeholder = "internet";

        // Username
        o = s.option(form.Value, "username", _("Username"));
        o.depends("enabled", "1");

        // Password
        o = s.option(form.Value, "password", _("Password"), _("Leave empty if not required"));
        o.depends("enabled", "1");
        o.password = true;

        // auth
        o = s.option(form.Value, "auth", _("Authentication Type"));
        o.depends("enabled", "1");
    
        // PIN
        o = s.option(form.Value, "pin", _("SIM PIN"));
        o.depends("enabled", "1");
        o.password = true;

        return m.render();
    }
});