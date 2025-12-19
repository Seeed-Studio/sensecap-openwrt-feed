#!/bin/sh
# USB WiFi Auto Configuration Monitor
# Checks /media for USB drives with WLAN.txt every second

MEDIA_DIR="/media"
CONFIG_FILE="WLAN.txt"
WIRELESS_CONFIG="/etc/config/wireless"
LAST_CONFIG_MD5=""

log_message() {
    logger -t usb-wifi "$1"
}

apply_wifi_config() {
    local config_path="$1"
    
    log_message "Found WLAN.txt at: $config_path"
    
    # Parse configuration file
    local mode=""
    local ap_ssid=""
    local ap_password=""
    local sta_ssid=""
    local sta_password=""
    
    while IFS='=' read -r key value; do
        # Remove leading/trailing whitespace
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
    
    # Validate configuration
    if [ -z "$mode" ]; then
        log_message "ERROR: MODE not specified in WLAN.txt"
        return 1
    fi
    
    log_message "Applying WiFi configuration: MODE=$mode"
    
    # Configure wireless based on mode
    if [ "$mode" = "ap" ] || [ "$mode" = "AP" ]; then
        if [ -z "$ap_ssid" ]; then
            log_message "ERROR: AP_SSID not specified for AP mode"
            return 1
        fi
        
        # Configure as Access Point
        uci set wireless.radio0.disabled='0'
        uci set wireless.radio0.band='2g'
        uci set wireless.radio0.htmode='HT20'
        uci set wireless.radio0.channel='auto'
        uci set wireless.radio0.country='CN'
        
        # Remove existing interfaces
        uci -q delete wireless.default_radio0
        uci -q delete wireless.wifinet0
        
        # Add AP interface
        uci set wireless.default_radio0='wifi-iface'
        uci set wireless.default_radio0.device='radio0'
        uci set wireless.default_radio0.network='wlan'
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
        
        # Configure as Station (Client)
        uci set wireless.radio0.disabled='0'
        uci set wireless.radio0.band='2g'
        uci set wireless.radio0.htmode='HT20'
        uci set wireless.radio0.channel='auto'
        uci set wireless.radio0.country='CN'
        
        # Remove existing interfaces
        uci -q delete wireless.default_radio0
        uci -q delete wireless.wifinet0
        
        # Add STA interface
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
    
    # Reload WiFi
    wifi reload
    log_message "WiFi configuration applied and reloaded"
    
    return 0
}

check_usb_mounts() {
    # Check if /media directory exists
    [ -d "$MEDIA_DIR" ] || return
    
    # Scan all mounted directories in /media
    for mount_point in "$MEDIA_DIR"/*; do
        [ -d "$mount_point" ] || continue
        
        # Look for WLAN.txt
        local config_file="$mount_point/$CONFIG_FILE"
        if [ -f "$config_file" ]; then
            # Calculate MD5 to detect changes
            local current_md5=$(md5sum "$config_file" 2>/dev/null | awk '{print $1}')
            
            # Only apply if config changed or first time
            if [ "$current_md5" != "$LAST_CONFIG_MD5" ]; then
                apply_wifi_config "$config_file"
                if [ $? -eq 0 ]; then
                    LAST_CONFIG_MD5="$current_md5"
                fi
            fi
            
            return
        fi
    done
}

# Main loop
log_message "USB WiFi Monitor started"

while true; do
    check_usb_mounts
    sleep 1
done