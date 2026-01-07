'use strict';
'require view';
'require form';
'require uci';

return view.extend({
    view: function () {

        var mMap = new form.Map('packetforwarder');

        var s = mMap.section(form.TypedSection, 'gateway', _('Advanced Settings'));
        s.anonymous = true;
        // s.addremove = true;
        s.tab('general', _('General Settings'));
        s.tab('interval', _('Intervals Settings'));
        s.tab('beacon', _('Beacon Settings'));
        s.tab('gps', _('GPS Information'));
        s.tab('forward', _('Forward Rules'));
        s.tab('packet_filter', _('Packet Filter'));

        // server
        var server = s.taboption("general", form.Value, "server_address", _("Server Address"));
        server.value("eu1.cloud.thethings.network", "eu1.cloud.thethings.network");
        server.value("nam1.cloud.thethings.network", "nam1.cloud.thethings.network");
        server.default="eu1.cloud.thethings.network";
        server.rmempty= false;
        server.datatype='or(ipaddr,hostname)';

        var port_up = s.taboption("general", form.Value, "serv_port_up", _("Port Up"));
        port_up.default = "1700";
        port_up.rmempty = false;
        port_up.datatype = "port";

        var port_down = s.taboption("general", form.Value, "serv_port_down", _("Port Down"));
        port_down.default = "1700";
        port_down.rmempty = false;
        port_down.datatype = "port";

        // interval tab
        var keepalive_interval = s.taboption("interval", form.Value, "keepalive_interval", _("Keep Alive Interval (s)"))
        keepalive_interval.default = "5"
        keepalive_interval.rmempty = false;
        keepalive_interval.datatype = "uinteger"

        var push_timeout_ms = s.taboption("interval", form.Value, "push_timeout_ms", _("Push Timeout (ms)"))
        push_timeout_ms.default = "950"
        push_timeout_ms.datatype = "uinteger"


        var stat_interval = s.taboption("interval", form.Value, "stat_interval", _("Statistic Interval (s)"))
        stat_interval.default = "30";
        stat_interval.datatype = "uinteger";

        var stat_report_interval_multiple = s.taboption("interval", form.Value, "stat_report_interval_multiple", _("Statistic Report Interval"), _("Statistic package reporting interval multiple configuration. Report Interval =  Multiple * Statistic Interval"))
        stat_report_interval_multiple.default = "1";
        stat_report_interval_multiple.datatype = "uinteger";

        // beacon tab
        var beacon_period_validate = function (section_id, value) {
            if (value > 0 && value < 6) {
                return "Invalid value for Beacon period, must be >= 6 seconds.";
            } else {
                return true
            }
        }

        var beacon_period = s.taboption("beacon", form.Value, "beacon_period", _("Beacon Period"), _("Setting this value to 0 disables class B beacon."))
        beacon_period.default = "0";  /* disable class B beacon */
        beacon_period.datatype = "uinteger"
        beacon_period.validate = beacon_period_validate

        var beacon_freq_hz = s.taboption("beacon", form.Value, "beacon_freq_hz", _("Beacon Frequency (Hz)"))
        beacon_freq_hz.datatype = "uinteger"

        var beacon_freq_nb = s.taboption("beacon", form.Value, "beacon_freq_nb", _("Beacon Channel Number"))
        beacon_freq_nb.datatype = "uinteger"

        var beacon_freq_step = s.taboption("beacon", form.Value, "beacon_freq_step", _("Beacon Frequency Step"))
        beacon_freq_step.datatype = "uinteger"

        var beacon_datarate = s.taboption("beacon", form.ListValue, "beacon_datarate", _("Beacon Datarate"))
        beacon_datarate.value(8, "SF8")
        beacon_datarate.value(9, "SF9")
        beacon_datarate.value(10, "SF10")
        beacon_datarate.value(12, "SF12")
        beacon_datarate.default = "9"

        var beacon_bw_hz = s.taboption("beacon", form.Value, "beacon_bw_hz", _("Beacon Bandwidth"))
        beacon_bw_hz.default = "125000";
        beacon_bw_hz.datatype = "uinteger"

        var beacon_power = s.taboption("beacon", form.Value, "beacon_power", _("Beacon Tx Power"))
        beacon_power.default = "14"
        beacon_power.datatype = "float"

        var beacon_infodesc = s.taboption("beacon", form.Value, "beacon_infodesc", _("Beaconing information descriptor"))
        beacon_infodesc.default = "0"

        // gps tab
        var fake_gps = s.taboption("gps", form.Flag, "fake_gps", _("Fake GPS"))

        var latitude = s.taboption("gps", form.Value, "ref_latitude", _("Latitude"))
        latitude.datatype = "float"

        var longitude = s.taboption("gps", form.Value, "ref_longitude", _("Longitude"))
        longitude.datatype = "float"

        var altitude = s.taboption("gps", form.Value, "ref_altitude", _("Altitude"))
        altitude.datatype = "float"

        // forward tab
        var forward_crc_valid = s.taboption("forward", form.ListValue, "forward_crc_valid", _("Forward When CRC Valid"))
        forward_crc_valid.value("true", "True")
        forward_crc_valid.value("false", "False")
        forward_crc_valid.default = "true"

        var forward_crc_error = s.taboption("forward", form.ListValue, "forward_crc_error", _("Forward When CRC Error"))
        forward_crc_error.value("true", "True")
        forward_crc_error.value("false", "False")
        forward_crc_error.default = "false"

        var forward_crc_disabled = s.taboption("forward", form.ListValue, "forward_crc_disabled", _("Forward When CRC Disabled"))
        forward_crc_disabled.value("true", "True")
        forward_crc_disabled.value("false", "False")
        forward_crc_disabled.default = "false"

        // packet_filter tab
        var whitelist_enable = s.taboption("packet_filter", form.Flag, "whitelist_enable", _("Enable White List Mode"),_("OUI filters Join packets; NetID and DevAddr filter uplink packets, they are \"OR\" filters"))
        whitelist_enable.default = 0

        var whitelist_ouis = s.taboption("packet_filter", form.DynamicList, "whitelist_ouis", _("OUI List"), _("Please enter three-byte hexadecimal, eg: SenseCAP Node OUI is '2CF7F1'.Note: Maximum 16 items"))
        whitelist_ouis.datatype = "hexstring"
    
        var whitelist_netids = s.taboption("packet_filter", form.DynamicList, "whitelist_netids", _("Network ID List"), _("Please enter three-byte hexadecimal, eg: SenseCAP TTN NetID is '000013'. Note: Maximum 16 items"))
        whitelist_netids.datatype = "hexstring"

        var whitelist_devaddr_min = s.taboption("packet_filter", form.Value, "whitelist_devaddr_min", _("Devaddr Min"), _("Please enter four-byte hexadecimal, eg: SenseCAP TTN Devaddr min is '27000000'"))
        whitelist_devaddr_min.default = "00000000"
        whitelist_devaddr_min.datatype = "hexstring"

        var whitelist_devaddr_max = s.taboption("packet_filter", form.Value, "whitelist_devaddr_max", _("Devaddr Max"),_("Please enter four-byte hexadecimal, eg: SenseCAP TTN Devaddr min is '2701FFFF'"))
        whitelist_devaddr_max.default = "00000000"
        whitelist_devaddr_max.datatype = "hexstring"

        return mMap;
    }
});