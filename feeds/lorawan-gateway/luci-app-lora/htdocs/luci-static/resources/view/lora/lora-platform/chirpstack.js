'use strict';
'require view';
'require form';
'require uci';


return view.extend({
    view: function() {
        // set EUI to chirpstack-concentratord gateway id
        var gatewaySections = uci.sections("chirpstack-concentratord", "global");
        uci.set("chirpstack-concentratord", gatewaySections[0]['.name'], "enabled", "1");

        var mMap = new form.Map('chirpstack-udp-forwarder');
        // set true to chirpstack-udp-forwarder global enabled flag 
        var globalSections = uci.sections("chirpstack-udp-forwarder", "global");
        if (globalSections.length > 0) {
            uci.set("chirpstack-udp-forwarder", globalSections[0]['.name'], "enabled", "1");
        }

        var s = mMap.section(form.TypedSection, 'server', _('Advanced Settings'));
        s.anonymous = true;
        s.addremove = true;

        var serverSections = uci.sections("chirpstack-udp-forwarder", "server");
        var serverSectionId = serverSections[0]['.name'];
        uci.set("chirpstack-udp-forwarder", serverSectionId, "server", 'localhost:1700');
        var o = s.option(form.Value, 'server', _('Server'), _('Server handling UDP data, example: localhost:1700'));
        o.validate = function (section_id, value) {
            if (value.length > 0) {
                return true;
            }

            return 'Please enter a hostname:port';
        }

        return mMap;
    }
});