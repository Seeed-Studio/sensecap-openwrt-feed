'use strict';
'require view';
'require form';
'require uci';
'require lora.regions as regions';

return view.extend({
	load: function() {
		return uci.load('lora');
	},
	render: function() {
		var m = new form.Map('lora', _('Channel Plan'), _('Configure LoRaWAN channel plan.'));

		var s = m.section(form.NamedSection, 'radio', 'radio', _('Channel Plan Settings'));
		s.addremove = false;

		var o = s.option(form.ListValue, 'channel_plan', _('Channel-plan'), _('Select the channel-plan to use. This must be supported by the selected shield.'));
		o.forcewrite = true;

		regions.channelPlanRender(o);

		o.write = function (section_id, value) {
			// Save channel_plan to lora config
			uci.set('lora', section_id, 'channel_plan', value);
			regions.setLoRaRegion(value);
		}

		return m.render();
	}
});
