'use strict';
'require view';
'require form';
'require uci';


return view.extend({
    view: function(loraSection) {

        var link = loraSection.option(form.DummyValue, '_link', _(' '));
        link.rawhtml = true;
        link.cfgvalue = function(section_id) {
            var baseURL = window.location.hostname;
            return '<a href="http://' + baseURL + ':8080" target="_blank">' + _('Open ChirpStack Application Server') + '</a>';
        };
        return null;
    }
});