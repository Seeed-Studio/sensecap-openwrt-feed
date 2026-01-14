#!/bin/sh

MEDIA_DIR="/media"
CONFIG_FILE="WLAN.txt"
WIRELESS_CONFIG="/etc/config/wireless"
LAST_CONFIG_MD5=""
SN_FILE="/etc/deviceinfo/sn"

log_message() {
    logger -t wifi-module "$1"
}

initialize_default_ap() {
    rm -f /etc/config/wireless
    touch /etc/config/wireless
    rm -rf /tmp/luci-*
    /etc/init.d/rpcd restart
    /etc/init.d/uhttpd restart

    while true; do
        if ip link show wlan0 &>/dev/null; then
            log_message "wlan0 interface detected"
            break
        fi
        sleep 2
    done

    log_message "Initializing default AP configuration"
    
    local sn=""
    local ssid="R1225-0000"
    
    if [ ! -f "$SN_FILE" ]; then
        log_message "SN file not found, waiting 5 seconds before creating default..."
        sleep 5
        
        mkdir -p "$(dirname "$SN_FILE")"
        
        echo "seeed0000" > "$SN_FILE"
        log_message "Created default SN file: $SN_FILE with content 'seeed0000'"
    fi
    
    if [ -f "$SN_FILE" ]; then
        sn=$(cat "$SN_FILE" | tr -d '[:space:]')
        if [ ${#sn} -ge 4 ]; then
            local last_four=${sn: -4}
            ssid="R1225-${last_four}"
        fi
    fi
    
    log_message "Setting up AP with SSID: $ssid"

    if ! uci -q get wireless.radio0 >/dev/null 2>&1; then
        log_message "Creating wifi-device radio0"
        uci set wireless.radio0='wifi-device'
        uci set wireless.radio0.type='mac80211'
        uci set wireless.radio0.path='platform/soc/fe300000.mmcnr/mmc_host/mmc1/mmc1:0001/mmc1:0001:1'
        uci commit wireless
    fi
    
    uci set wireless.radio0.disabled='0'
    uci set wireless.radio0.band='2g'
    uci set wireless.radio0.channel='6'
    uci -q delete wireless.radio0.htmode
    
    uci -q delete wireless.default_radio0
    uci -q delete wireless.wifinet0
    
    uci set wireless.default_radio0='wifi-iface'
    uci set wireless.default_radio0.device='radio0'
    uci set wireless.default_radio0.network='wan'
    uci set wireless.default_radio0.mode='ap'
    uci set wireless.default_radio0.ifname='wlan0'
    uci set wireless.default_radio0.ssid="$ssid"
    uci set wireless.default_radio0.encryption='psk2'
    uci set wireless.default_radio0.key='1234567890'
    
    uci commit wireless
    wifi reload
    
    rm -rf /tmp/luci-*
    /etc/init.d/rpcd restart
    /etc/init.d/uhttpd restart
    
    log_message "Default AP initialized: SSID=$ssid, Password=1234567890"
}

apply_wifi_config() {
    local config_path="$1"
    
    log_message "Found WLAN.txt at: $config_path"
    
    local mode=""
    local ap_ssid=""
    local ap_password=""
    local sta_ssid=""
    local sta_password=""
    
    while IFS='=' read -r key value; do
        key=$(echo "$key" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        value=$(echo "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        
        case "$key" in
            MODE|mode)
                mode="$value"
                ;;
            AP_SSID|ap_ssid)
                ap_ssid="$value"
                ;;
            AP_PASSWORD|ap_password)
                ap_password="$value"
                ;;
            STA_SSID|sta_ssid)
                sta_ssid="$value"
                ;;
            STA_PASSWORD|sta_password)
                sta_password="$value"
                ;;
        esac
    done < "$config_path"
    
    if [ -z "$mode" ]; then
        log_message "ERROR: MODE not specified in WLAN.txt"
        return 1
    fi
    
    log_message "Applying WiFi configuration: MODE=$mode"
    
    if [ "$mode" = "ap" ] || [ "$mode" = "AP" ]; then
        if [ -z "$ap_ssid" ]; then
            log_message "ERROR: AP_SSID not specified for AP mode"
            return 1
        fi
        
        uci set wireless.radio0.disabled='0'
        uci set wireless.radio0.band='2g'
        uci set wireless.radio0.channel='6'
        uci -q delete wireless.radio0.htmode
        
        uci -q delete wireless.default_radio0
        uci -q delete wireless.wifinet0
        
        uci set wireless.default_radio0='wifi-iface'
        uci set wireless.default_radio0.device='radio0'
        uci set wireless.default_radio0.network='wan'
        uci set wireless.default_radio0.mode='ap'
        uci set wireless.default_radio0.ifname='wlan0'
        uci set wireless.default_radio0.ssid="$ap_ssid"
        
        if [ -n "$ap_password" ] && [ ${#ap_password} -ge 8 ]; then
            uci set wireless.default_radio0.encryption='psk2'
            uci set wireless.default_radio0.key="$ap_password"
        else
            uci set wireless.default_radio0.encryption='none'
        fi
        
        uci commit wireless
        log_message "Configured as AP: SSID=$ap_ssid"
        
    elif [ "$mode" = "sta" ] || [ "$mode" = "STA" ]; then
        if [ -z "$sta_ssid" ]; then
            log_message "ERROR: STA_SSID not specified for STA mode"
            return 1
        fi
        
        uci set wireless.radio0.disabled='0'
        uci set wireless.radio0.band='2g'
        uci set wireless.radio0.htmode='HT20'
        uci set wireless.radio0.channel='auto'
        uci set wireless.radio0.country='CN'
        
        uci -q delete wireless.default_radio0
        uci -q delete wireless.wifinet0
        
        uci set wireless.default_radio0='wifi-iface'
        uci set wireless.default_radio0.device='radio0'
        uci set wireless.default_radio0.network='wlan'
        uci set wireless.default_radio0.mode='sta'
        uci set wireless.default_radio0.ifname='wlan0'
        uci set wireless.default_radio0.ssid="$sta_ssid"
        
        if [ -n "$sta_password" ]; then
            uci set wireless.default_radio0.encryption='psk2'
            uci set wireless.default_radio0.key="$sta_password"
        else
            uci set wireless.default_radio0.encryption='none'
        fi
        
        uci commit wireless
        log_message "Configured as STA: SSID=$sta_ssid"
        
    else
        log_message "ERROR: Invalid MODE: $mode (must be 'ap' or 'sta')"
        return 1
    fi
    
    wifi reload
    log_message "WiFi configuration applied and reloaded"
    
    return 0
}

check_usb_mounts() {
    [ -d "$MEDIA_DIR" ] || return
    
    local config_file=$(find "$MEDIA_DIR" -name "$CONFIG_FILE" -type f 2>/dev/null | head -n 1)
    
    if [ -n "$config_file" ] && [ -f "$config_file" ]; then
        local current_md5=$(md5sum "$config_file" 2>/dev/null | awk '{print $1}')
        
        if [ "$current_md5" != "$LAST_CONFIG_MD5" ]; then
            apply_wifi_config "$config_file"
            if [ $? -eq 0 ]; then
                LAST_CONFIG_MD5="$current_md5"
            fi
        fi
    fi
}

log_message "WiFi Module Monitor started"

initialize_default_ap

while true; do
    check_usb_mounts
    sleep 1
done
