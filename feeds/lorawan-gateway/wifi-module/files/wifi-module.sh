#!/bin/sh

MEDIA_DIR="/media"
CONFIG_FILE="WLAN.txt"
WIRELESS_CONFIG="/etc/config/wireless"
LAST_CONFIG_MD5=""
LAST_INTERFACES=""

log_message() {
    logger -t wifi-module "$1"
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

check_new_interfaces() {
    local current_interfaces=$(ip -o link show | awk -F': ' '{print $2}' | sort | tr '\n' ' ')
    
    if [ -n "$LAST_INTERFACES" ] && [ "$current_interfaces" != "$LAST_INTERFACES" ]; then
        log_message "Network interface change detected, restarting WiFi..."
        wifi reload && wifi down radio0 && wifi up radio0
        log_message "WiFi restarted"
    fi
    
    LAST_INTERFACES="$current_interfaces"
}

log_message "WiFi Module Monitor started"

while true; do
    check_new_interfaces
    check_usb_mounts
    sleep 1
done
