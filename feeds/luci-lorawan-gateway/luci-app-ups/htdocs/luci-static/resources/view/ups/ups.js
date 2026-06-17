'use strict';
'require view';
'require form';
'require uci';
'require fs';
'require poll';

return view.extend({
    load: function() {
        return Promise.all([
            uci.load('ups-module'),
            L.resolveDefault(fs.read('/tmp/ups/log'), '')
        ]);
    },

    render: function(data) {
        var logPayload = (data[1] || '').trim();
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

        // Add log viewer section
        var logSection = m.section(form.NamedSection, 'cmd', 'ups', _('UPS Log'));
        logSection.anonymous = true;
        logSection.addremove = false;

        var logView = logSection.option(form.DummyValue, '_log');
        logView.renderWidget = function(section_id, option_id, cfgvalue) {
            return E('div', {
                'id': 'ups_log_view',
                'style': 'width:100%; height:400px; overflow:auto; border:1px solid var(--sensecap-log-border); padding:10px; font-family:monospace; white-space:pre; background:var(--sensecap-muted-bg); color:var(--sensecap-log-fg); resize:vertical;'
            }, _('Loading logs...'));
        };

        var updateLog = function(content) {
            var view = document.getElementById('ups_log_view');
            if (!view) return;

            var lines = (content || '').trim().split('\n');
            var htmlContent = lines.map(function(line) {
                return line.replace(/[&<>"']/g, function(m) {
                    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
                });
            }).join('\n');

            var wasScrolledBottom = view.scrollHeight - view.scrollTop <= view.clientHeight + 50;
            view.innerHTML = htmlContent || _('No logs available');

            if (wasScrolledBottom) {
                view.scrollTop = view.scrollHeight;
            }
        };

        // Poll for log updates every second
        poll.add(function() {
            return fs.read('/tmp/ups/log').then(function(res) {
                updateLog(res);
            }).catch(function() { });
        }, 1);

        return m.render().then(function(node) {
            setTimeout(function() {
                updateLog(logPayload);
            }, 0);
            return node;
        });
    }
});