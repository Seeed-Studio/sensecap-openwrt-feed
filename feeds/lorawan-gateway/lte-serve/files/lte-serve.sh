#!/bin/sh

# LTE Module Initialization Script
# Handles GPIO control and AT command sending

LOG_TAG="[LTE-Serve]"
AT_RETRY_INTERVAL=180

log() {
    logger -t "$LOG_TAG" "$1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') $LOG_TAG $1"
}

# Send AT command to 4G module
send_at_command() {
    local cmd="$1"
    local device="$2"
    
    if [ -e "$device" ]; then
        log "Sending AT command: $cmd to $device"
        echo -e "${cmd}\r" > "$device" 2>/dev/null
        return 0
    else
        return 1
    fi
}

# Check if wwan0 interface exists
wwan0_exists() {
    ip link show wwan0 &>/dev/null
}

# Main loop
main() {
    log "Starting LTE Module Initialization Service"
    
    # Load GPIO configuration
    LTE_RST_CHIP=$(uci get hardware.hardware.lte_rst_chip)
    LTE_RST_LINE=$(uci get hardware.hardware.lte_rst_line)
    LTE_USB_PORT=$(uci get hardware.hardware.lte_usb_port)
    
    # Check and set GPIO if low
    GPIO_VALUE=$(gpioget -c "$LTE_RST_CHIP" "$LTE_RST_LINE" 2>/dev/null)
    if ! echo "$GPIO_VALUE" | grep -q "=active"; then
        log "LTE RST is LOW, setting to HIGH"
        gpioset -z -c "$LTE_RST_CHIP" "${LTE_RST_LINE}=1" 2>/dev/null
    fi
    
    local last_at_time=0
    
    while true; do
        # Check USB port and wwan0
        if [ -e "$LTE_USB_PORT" ]; then
            # USB port exists
            if ! wwan0_exists; then
                # wwan0 not exists, send AT commands
                current_time=$(date +%s)
                if [ $((current_time - last_at_time)) -ge $AT_RETRY_INTERVAL ]; then
                    log "wwan0 not found, sending AT commands to initialize LTE module"
                    send_at_command 'AT+QCFG="usbnet",0' "$LTE_USB_PORT"
                    sleep 2
                    send_at_command 'AT+CFUN=1,1' "$LTE_USB_PORT"
                    last_at_time=$current_time
                fi
            fi
        fi
        
        sleep 10
    done
}

# Run main loop
main
