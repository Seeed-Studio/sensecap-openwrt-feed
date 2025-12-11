'use strict';
'require baseclass';
'require form';
'require uci';

const tx_gain_lut_915_low = [
	{ rf_power: 1, pa_gain: 0, pwr_idx: 5 },
	{ rf_power: 2, pa_gain: 0, pwr_idx: 6 },
	{ rf_power: 3, pa_gain: 0, pwr_idx: 7 },
	{ rf_power: 4, pa_gain: 0, pwr_idx: 8 },
	{ rf_power: 5, pa_gain: 0, pwr_idx: 9 },
	{ rf_power: 6, pa_gain: 0, pwr_idx: 10 },
	{ rf_power: 7, pa_gain: 0, pwr_idx: 11 },
	{ rf_power: 8, pa_gain: 0, pwr_idx: 12 },
	{ rf_power: 9, pa_gain: 0, pwr_idx: 13 },
	{ rf_power: 10, pa_gain: 0, pwr_idx: 14 },
	{ rf_power: 11, pa_gain: 0, pwr_idx: 15 },
	{ rf_power: 12, pa_gain: 0, pwr_idx: 16 },
	{ rf_power: 13, pa_gain: 0, pwr_idx: 17 },
	{ rf_power: 14, pa_gain: 0, pwr_idx: 18 },
	{ rf_power: 15, pa_gain: 0, pwr_idx: 19 },
	{ rf_power: 16, pa_gain: 1, pwr_idx: 3 },
	{ rf_power: 17, pa_gain: 1, pwr_idx: 4 },
	{ rf_power: 18, pa_gain: 1, pwr_idx: 5 },
	{ rf_power: 19, pa_gain: 1, pwr_idx: 6 },
	{ rf_power: 20, pa_gain: 1, pwr_idx: 7 },
	{ rf_power: 21, pa_gain: 1, pwr_idx: 8 },
	{ rf_power: 22, pa_gain: 1, pwr_idx: 9 },
	{ rf_power: 23, pa_gain: 1, pwr_idx: 11 },
	{ rf_power: 24, pa_gain: 1, pwr_idx: 12 },
	{ rf_power: 25, pa_gain: 1, pwr_idx: 13 },
	{ rf_power: 26, pa_gain: 1, pwr_idx: 14 },
	{ rf_power: 27, pa_gain: 1, pwr_idx: 15 }
];
const tx_gain_lut_915_high = [
	{ rf_power: 1, pa_gain: 0, pwr_idx: 5 },
	{ rf_power: 2, pa_gain: 0, pwr_idx: 6 },
	{ rf_power: 3, pa_gain: 0, pwr_idx: 7 },
	{ rf_power: 4, pa_gain: 0, pwr_idx: 8 },
	{ rf_power: 5, pa_gain: 0, pwr_idx: 9 },
	{ rf_power: 6, pa_gain: 0, pwr_idx: 10 },
	{ rf_power: 7, pa_gain: 0, pwr_idx: 11 },
	{ rf_power: 8, pa_gain: 0, pwr_idx: 12 },
	{ rf_power: 9, pa_gain: 0, pwr_idx: 13 },
	{ rf_power: 10, pa_gain: 0, pwr_idx: 14 },
	{ rf_power: 11, pa_gain: 0, pwr_idx: 15 },
	{ rf_power: 12, pa_gain: 0, pwr_idx: 16 },
	{ rf_power: 13, pa_gain: 0, pwr_idx: 17 },
	{ rf_power: 14, pa_gain: 0, pwr_idx: 18 },
	{ rf_power: 15, pa_gain: 0, pwr_idx: 19 },
	{ rf_power: 16, pa_gain: 1, pwr_idx: 3 },
	{ rf_power: 17, pa_gain: 1, pwr_idx: 4 },
	{ rf_power: 18, pa_gain: 1, pwr_idx: 5 },
	{ rf_power: 19, pa_gain: 1, pwr_idx: 6 },
	{ rf_power: 20, pa_gain: 1, pwr_idx: 7 },
	{ rf_power: 21, pa_gain: 1, pwr_idx: 8 },
	{ rf_power: 22, pa_gain: 1, pwr_idx: 9 },
	{ rf_power: 23, pa_gain: 1, pwr_idx: 11 },
	{ rf_power: 24, pa_gain: 1, pwr_idx: 12 },
	{ rf_power: 25, pa_gain: 1, pwr_idx: 13 },
	{ rf_power: 26, pa_gain: 1, pwr_idx: 14 },
	{ rf_power: 27, pa_gain: 1, pwr_idx: 15 }
];
const tx_gain_lut_868_low = [
	{ rf_power: 1, pa_gain: 0, pwr_idx: 4 },
	{ rf_power: 2, pa_gain: 0, pwr_idx: 5 },
	{ rf_power: 3, pa_gain: 0, pwr_idx: 6 },
	{ rf_power: 4, pa_gain: 0, pwr_idx: 7 },
	{ rf_power: 5, pa_gain: 0, pwr_idx: 8 },
	{ rf_power: 6, pa_gain: 0, pwr_idx: 9 },
	{ rf_power: 7, pa_gain: 0, pwr_idx: 10 },
	{ rf_power: 8, pa_gain: 0, pwr_idx: 11 },
	{ rf_power: 9, pa_gain: 0, pwr_idx: 12 },
	{ rf_power: 10, pa_gain: 0, pwr_idx: 13 },
	{ rf_power: 11, pa_gain: 0, pwr_idx: 14 },
	{ rf_power: 12, pa_gain: 0, pwr_idx: 15 },
	{ rf_power: 13, pa_gain: 0, pwr_idx: 16 },
	{ rf_power: 14, pa_gain: 0, pwr_idx: 17 },
	{ rf_power: 15, pa_gain: 0, pwr_idx: 18 },
	{ rf_power: 16, pa_gain: 0, pwr_idx: 19 },
	{ rf_power: 17, pa_gain: 1, pwr_idx: 1 },
	{ rf_power: 18, pa_gain: 1, pwr_idx: 2 },
	{ rf_power: 19, pa_gain: 1, pwr_idx: 3 },
	{ rf_power: 20, pa_gain: 1, pwr_idx: 4 },
	{ rf_power: 21, pa_gain: 1, pwr_idx: 5 },
	{ rf_power: 22, pa_gain: 1, pwr_idx: 6 },
	{ rf_power: 23, pa_gain: 1, pwr_idx: 7 },
	{ rf_power: 24, pa_gain: 1, pwr_idx: 8 },
	{ rf_power: 25, pa_gain: 1, pwr_idx: 10 },
	{ rf_power: 26, pa_gain: 1, pwr_idx: 13 },
	{ rf_power: 27, pa_gain: 1, pwr_idx: 16 }
];
const tx_gain_lut_868_high = [
	{ rf_power: 1, pa_gain: 0, pwr_idx: 4 },
	{ rf_power: 2, pa_gain: 0, pwr_idx: 5 },
	{ rf_power: 3, pa_gain: 0, pwr_idx: 6 },
	{ rf_power: 4, pa_gain: 0, pwr_idx: 7 },
	{ rf_power: 5, pa_gain: 0, pwr_idx: 8 },
	{ rf_power: 6, pa_gain: 0, pwr_idx: 9 },
	{ rf_power: 7, pa_gain: 0, pwr_idx: 10 },
	{ rf_power: 8, pa_gain: 0, pwr_idx: 11 },
	{ rf_power: 9, pa_gain: 0, pwr_idx: 12 },
	{ rf_power: 10, pa_gain: 0, pwr_idx: 13 },
	{ rf_power: 11, pa_gain: 0, pwr_idx: 14 },
	{ rf_power: 12, pa_gain: 0, pwr_idx: 15 },
	{ rf_power: 13, pa_gain: 0, pwr_idx: 16 },
	{ rf_power: 14, pa_gain: 0, pwr_idx: 17 },
	{ rf_power: 15, pa_gain: 0, pwr_idx: 18 },
	{ rf_power: 16, pa_gain: 0, pwr_idx: 19 },
	{ rf_power: 17, pa_gain: 1, pwr_idx: 1 },
	{ rf_power: 18, pa_gain: 1, pwr_idx: 2 },
	{ rf_power: 19, pa_gain: 1, pwr_idx: 3 },
	{ rf_power: 20, pa_gain: 1, pwr_idx: 4 },
	{ rf_power: 21, pa_gain: 1, pwr_idx: 5 },
	{ rf_power: 22, pa_gain: 1, pwr_idx: 6 },
	{ rf_power: 23, pa_gain: 1, pwr_idx: 7 },
	{ rf_power: 24, pa_gain: 1, pwr_idx: 8 },
	{ rf_power: 25, pa_gain: 1, pwr_idx: 10 },
	{ rf_power: 26, pa_gain: 1, pwr_idx: 13 },
	{ rf_power: 27, pa_gain: 1, pwr_idx: 16 }
];

const tx_gain_lut_470 = [
	{ rf_power: -6, pa_gain: 1, pwr_idx: 0 },
	{ rf_power: -3, pa_gain: 1, pwr_idx: 1 },
	{ rf_power: 0, pa_gain: 1, pwr_idx: 2 },
	{ rf_power: 3, pa_gain: 0, pwr_idx: 3 },
	{ rf_power: 6, pa_gain: 0, pwr_idx: 4 },
	{ rf_power: 10, pa_gain: 0, pwr_idx: 5 },
	{ rf_power: 11, pa_gain: 0, pwr_idx: 6 },
	{ rf_power: 12, pa_gain: 0, pwr_idx: 7 },
	{ rf_power: 13, pa_gain: 0, pwr_idx: 8 },
	{ rf_power: 14, pa_gain: 0, pwr_idx: 9 },
	{ rf_power: 16, pa_gain: 0, pwr_idx: 10 },
	{ rf_power: 20, pa_gain: 0, pwr_idx: 11 },
	{ rf_power: 23, pa_gain: 0, pwr_idx: 12 },
	{ rf_power: 25, pa_gain: 0, pwr_idx: 13 },
	{ rf_power: 26, pa_gain: 0, pwr_idx: 14 },
	{ rf_power: 27, pa_gain: 0, pwr_idx: 15 }
];

const options = [
	{
		id: "AS923",
		name: "AS923",
		radio0: {
			rssi_offset: -213.0,
			tx_gain_lut: tx_gain_lut_915_high,
		},
		radio1: {
			rssi_offset: -213.0,
		},
		channelPlans: [
			{ id: "as923", name: "AS923 - Standard channels + 923.6, 923.8, ... 924.6" },
		],
	},
	{
		id: "AS923_2",
		name: "AS923-2",
		radio0: {
			rssi_offset: -213.0,
			tx_gain_lut: tx_gain_lut_915_high,
		},
		radio1: {
			rssi_offset: -213.0,
		},
		channelPlans: [
			{ id: "as923_2", name: "AS923-2 - Standard channels + 921.8, 922.0, ... 922.8" },
		],
	},
	{
		id: "AS923_3",
		name: "AS923-3",
		radio0: {
			rssi_offset: -213.0,
			tx_gain_lut: tx_gain_lut_915_high,
		},
		radio1: {
			rssi_offset: -213.0,
		},
		channelPlans: [
			{ id: "as923_3", name: "AS923-3 - Standard channels + 917.0, 917.2, ... 918.0" },
		],
	},
	{
		id: "AS923_4",
		name: "AS923-4",
		radio0: {
			rssi_offset: -213.0,
			tx_gain_lut: tx_gain_lut_915_high,
		},
		radio1: {
			rssi_offset: -213.0,
		},
		channelPlans: [
			{ id: "as923_4", name: "AS923-4 - Standard channels + 917.7, 917.9, ... 918.7" },
		],
	},
	{
		id: "AU915",
		name: "AU915",
		radio0: {
			rssi_offset: -213.0,
			tx_gain_lut: tx_gain_lut_915_low,
		},
		radio1: {
			rssi_offset: -213.0,
		},
		channelPlans: [
			{ id: "au915_0", name: "AU915 - Channels 0-7 + 64" },
			{ id: "au915_1", name: "AU915 - Channels 8-15 + 65" },
			{ id: "au915_2", name: "AU915 - Channels 16-23 + 66" },
			{ id: "au915_3", name: "AU915 - Channels 24-31 + 67" },
			{ id: "au915_4", name: "AU915 - Channels 32-39 + 68" },
			{ id: "au915_5", name: "AU915 - Channels 40-47 + 69" },
			{ id: "au915_6", name: "AU915 - Channels 48-55 + 70" },
			{ id: "au915_7", name: "AU915 - Channels 56-63 + 71" },
		],
	},
	{
		id: "EU868",
		name: "EU868",
		radio0: {
			rssi_offset: -215.0,
			tx_gain_lut: tx_gain_lut_868_low,
		},
		radio1: {
			rssi_offset: -215.0,
		},
		channelPlans: [
			{ id: "eu868", name: "EU868 - Standard channels + 867.1, 867.3, ... 867.9" },
		]
	},
	{
		id: "IN865",
		name: "IN865",
		radio0: {
			rssi_offset: -215.0,
			tx_gain_lut: tx_gain_lut_868_high,
		},
		radio1: {
			rssi_offset: -215.0,
		},
		channelPlans: [
			{ id: "in865", name: "IN865 - Standard channels" },
		],
	},
	{
		id: "KR920",
		name: "KR920",
		radio0: {
			rssi_offset: -213.0,
			tx_gain_lut: tx_gain_lut_915_high,
		},
		radio1: {
			rssi_offset: -213.0,
		},
		channelPlans: [
			{ id: "kr920", name: "KR920 - Standard channels" },
		],
	},
	{
		id: "RU864",
		name: "RU864",
		radio0: {
			rssi_offset: -215.0,
			tx_gain_lut: tx_gain_lut_868_high,
		},
		radio1: {
			rssi_offset: -215.0,
		},
		channelPlans: [
			{ id: "ru864", name: "RU864 - Standard channels" },
		],
	},
	{
		id: "US915",
		name: "US915",
		radio0: {
			rssi_offset: -213.0,
			tx_gain_lut: tx_gain_lut_915_high,
		},
		radio1: {
			rssi_offset: -213.0,
		},
		channelPlans: [
			{ id: "us915_0", name: "US915 - Channels 0-7 + 64" },
			{ id: "us915_1", name: "US915 - Channels 8-15 + 65" },
			{ id: "us915_2", name: "US915 - Channels 16-23 + 66" },
			{ id: "us915_3", name: "US915 - Channels 24-31 + 67" },
			{ id: "us915_4", name: "US915 - Channels 32-39 + 68" },
			{ id: "us915_5", name: "US915 - Channels 40-47 + 69" },
			{ id: "us915_6", name: "US915 - Channels 48-55 + 70" },
			{ id: "us915_7", name: "US915 - Channels 56-63 + 71" },
		],
	},
];

return baseclass.extend({
	channelPlanRender: function (o) {
		for (const region of options) {
			for (const channelPlan of region.channelPlans) {
				o.value(channelPlan.id, channelPlan.name);
			}
		}
	},
	setBasicStationRegion: function (regionId) {
		var regionOptions = options.find(r => r.id === regionId);
		var rfconfSections = uci.sections("basicstation", "rfconf");
		var rfconf0 = rfconfSections.find(s => s['.name'] === 'rfconf0');
		if (rfconf0) {
			uci.set("basicstation", rfconf0['.name'], "rssiOffset", String(regionOptions.radio0.rssi_offset));
		}
		var rfconf1 = rfconfSections.find(s => s['.name'] === 'rfconf1');
		if (rfconf1) {
			uci.set("basicstation", rfconf1['.name'], "rssiOffset", String(regionOptions.radio1.rssi_offset));
		}
		// set txlut
		var txlutSections = uci.sections("basicstation", "txlut");
		var newLuts = regionOptions.radio0.tx_gain_lut;

		for (var j = 0; j < newLuts.length; j++) {
			var lut = newLuts[j];
			var sectionName;

			if (j < txlutSections.length) {
				sectionName = txlutSections[j]['.name'];
			} else {
				sectionName = uci.add("basicstation", "txlut");
			}

			uci.set("basicstation", sectionName, "rfPower", lut.rf_power);
			uci.set("basicstation", sectionName, "paGain", lut.pa_gain);
			uci.set("basicstation", sectionName, "pwrIdx", lut.pwr_idx);
			uci.set("basicstation", sectionName, "usedBy", "rfconf0");
		}

		for (var k = newLuts.length; k < txlutSections.length; k++) {
			uci.remove("basicstation", txlutSections[k]['.name']);
		}
	},

	setLoRaRegion: function (channelPlan) {
		var regionId;
		for (const region of options) {
			for (const cp of region.channelPlans) {
				if (cp.id === channelPlan) {
					regionId = region.id;
				}
			}
		}
		var concentratordSections = uci.sections("chirpstack-concentratord", "sx1302");
		uci.set("chirpstack-concentratord", concentratordSections[0]['.name'], "channel_plan", channelPlan);
		uci.set("chirpstack-concentratord", concentratordSections[0]['.name'], "region", regionId);

		this.setBasicStationRegion(regionId);
	}
});