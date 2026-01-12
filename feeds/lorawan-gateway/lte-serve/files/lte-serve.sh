#!/bin/sh

# LTE Module Initialization Script
# Handles GPIO control and AT command sending

LOG_TAG="[LTE-Serve]"
GPIO_PIN=581
GPIO_PATH="/sys/class/gpio/gpio${GPIO_PIN}"
GPIO_EXPORT="/sys/class/gpio/export"
AT_RETRY_INTERVAL=120

log() {
    logger -t "$LOG_TAG" "$1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') $LOG_TAG $1"
}

# Export GPIO pin if not exists
export_gpio() {
    if [ ! -d "$GPIO_PATH" ]; then
        log "Exporting GPIO pin $GPIO_PIN"
        echo "$GPIO_PIN" > "$GPIO_EXPORT" 2>/dev/null
        sleep 1
    fi
}

# Set GPIO direction to output
set_gpio_direction() {
    if [ -d "$GPIO_PATH" ]; then
        echo "out" > "${GPIO_PATH}/direction" 2>/dev/null
    fi
}

# Check if GPIO is high
is_gpio_high() {
    if [ -f "${GPIO_PATH}/value" ]; then
        local value=$(cat "${GPIO_PATH}/value" 2>/dev/null)
        [ "$value" = "1" ]
    else
        return 1
    fi
}

# Set GPIO high
set_gpio_high() {
    if [ -f "${GPIO_PATH}/value" ]; then
        log "Setting GPIO $GPIO_PIN to HIGH"
        echo "1" > "${GPIO_PATH}/value" 2>/dev/null
    fi
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
    
    local last_at_time=0
    
    while true; do
        # Export GPIO if not exists
        if [ ! -d "$GPIO_PATH" ]; then
            export_gpio
            set_gpio_direction
        fi
        
        # Check and set GPIO high if needed
        if ! is_gpio_high; then
            set_gpio_high
            sleep 1
        fi
        
        # Check /dev/ttyUSB2 and wwan0
        if [ -e /dev/ttyUSB2 ]; then
            # ttyUSB2 exists
            if ! wwan0_exists; then
                # wwan0 not exists, send AT commands
                current_time=$(date +%s)
                if [ $((current_time - last_at_time)) -ge $AT_RETRY_INTERVAL ]; then
                    log "wwan0 not found, sending AT commands to initialize LTE module"
                    send_at_command 'AT+QCFG="usbnet",0' /dev/ttyUSB2
                    sleep 2
                    send_at_command 'AT+CFUN=1,1' /dev/ttyUSB2
                    last_at_time=$current_time
                fi
            fi
        fi
        
        sleep 10
    done
}

# Run main loop
main
