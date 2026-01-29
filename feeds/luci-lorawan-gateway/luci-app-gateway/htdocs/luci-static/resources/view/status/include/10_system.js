'use strict';
'require baseclass';
'require fs';
'require rpc';

var callLuciVersion = rpc.declare({
	object: 'luci',
	method: 'getVersion'
});

var callSystemBoard = rpc.declare({
	object: 'system',
	method: 'board'
});

var callSystemInfo = rpc.declare({
	object: 'system',
	method: 'info'
});

return baseclass.extend({
	title: _('System'),

	load: function() {
		return Promise.all([
			L.resolveDefault(callSystemBoard(), {}),
			L.resolveDefault(callSystemInfo(), {}),
			L.resolveDefault(callLuciVersion(), { revision: _('unknown version'), branch: 'LuCI' }),
			fs.exec('/bin/cat', ['/etc/deviceinfo/sn']).then(function(res) {
				return res.stdout || '';
			}).catch(function() {
				return '';
			}),
			fs.exec('/bin/cat', ['/etc/deviceinfo/eui']).then(function(res) {
				return res.stdout || '';
			}).catch(function() {
				return '';
			}),
			fs.exec('/bin/cat', ['/version.txt']).then(function(res) {
				return res.stdout || '';
			}).catch(function() {
				return '';
			}),
			fs.exec('/bin/cat', ['/etc/deviceinfo/freq_plan']).then(function(res) {
				return res.stdout || '';
			}).catch(function() {
				return '';
			})
		]);
	},

	render: function(data) {
		var boardinfo   = data[0],
		    systeminfo  = data[1],
		    luciversion = data[2],
		    sn          = data[3] ? data[3].trim() : '',
		    eui         = data[4] ? data[4].trim() : '',
		    versionText = data[5] || '',
		    freqPlan    = data[6] ? data[6].trim() : '';

		// Parse version.txt - only extract version number
		var firmwareVersion = '';
		if (versionText) {
			var lines = versionText.split('\n');
			for (var i = 0; i < lines.length; i++) {
				if (lines[i].indexOf('Version:') === 0) {
					firmwareVersion = lines[i].replace('Version:', '').trim();
					break;
				}
			}
		}

		luciversion = luciversion.branch + ' ' + luciversion.revision;

		var datestr = null;

		if (systeminfo.localtime) {
			var date = new Date(systeminfo.localtime * 1000);

			datestr = '%04d-%02d-%02d %02d:%02d:%02d'.format(
				date.getUTCFullYear(),
				date.getUTCMonth() + 1,
				date.getUTCDate(),
				date.getUTCHours(),
				date.getUTCMinutes(),
				date.getUTCSeconds()
			);
		}

		var fields = [
			_('Hostname'),         boardinfo.hostname,
			_('Model'),            boardinfo.model,
			_('SN'),               sn || '-',
			_('EUI'),              eui || '-',
			_('Architecture'),     boardinfo.system,
			_('Target Platform'),  (L.isObject(boardinfo.release) ? boardinfo.release.target : ''),
			_('Build Version'),    (L.isObject(boardinfo.release) ? boardinfo.release.description + ' / ' : '') + (luciversion || ''),
			_('Firmware Version'), firmwareVersion || '-',
			_('Kernel Version'),   boardinfo.kernel,
			_('LoRaWAN Region'),   freqPlan || '-',
			_('Local Time'),       datestr,
			_('Uptime'),           systeminfo.uptime ? '%t'.format(systeminfo.uptime) : null,
			_('Load Average'),     Array.isArray(systeminfo.load) ? '%.2f, %.2f, %.2f'.format(
				systeminfo.load[0] / 65535.0,
				systeminfo.load[1] / 65535.0,
				systeminfo.load[2] / 65535.0
			) : null
		];

		var table = E('table', { 'class': 'table', 'id': 'system-status-table' });

		for (var i = 0; i < fields.length; i += 2) {
			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': '33%' }, [ fields[i] ]),
				E('td', { 'class': 'td left' }, [ (fields[i + 1] != null) ? fields[i + 1] : '?' ])
			]));
		}

		// Start auto refresh timer (runs independently of main status poll)
		if (!window._systemStatusRefreshTimer) {
			var self = this;
			window._systemStatusRefreshTimer = window.setInterval(function() {
				self.load().then(function(data) {
					var container = document.getElementById('system-status-table');
					if (container) {
						var newTable = self.render(data);
						container.parentNode.replaceChild(newTable, container);
					}
				}).catch(function(err) {
					console.log('System status refresh error:', err);
				});
			}, 1000);
		}

		return table;
	}
});
