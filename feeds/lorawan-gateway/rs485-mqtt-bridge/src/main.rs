use chrono::Local;
use rumqttc::{AsyncClient, Event, Incoming, MqttOptions, QoS};
use serde::{Deserialize, Serialize};
use std::fs::{File, OpenOptions};
use std::io::Write;
use std::process::Command;
use std::sync::{Arc, Mutex as StdMutex};
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::time::sleep;
use tokio_serial::{DataBits, Parity, StopBits, SerialPortBuilderExt};

// Mqtt and Serial Configuration Structures
#[derive(Debug, Clone, Serialize, Deserialize)]
struct Config {
    mqtt: MqttConfig,
    serial: SerialConfig,
}

// MQTT Configuration Structure
#[derive(Debug, Clone, Serialize, Deserialize)]
struct MqttConfig {
    enabled: bool,
    host: String,
    port: u16,
    username: Option<String>,
    password: Option<String>,
    client_id: String,
    keepalive: u64,
    uplink_topic: String,
    downlink_topic: String,
    qos_level: u8,
    reconnect_delay: u64,
}

// Serial Configuration Structure
#[derive(Debug, Clone, Serialize, Deserialize)]
struct SerialConfig {
    device: String,
    baudrate: u32,
    databit: u8,
    stopbit: String,
    checkbit: String,
}

// RS485 -> MQTT Message Structure
#[derive(Debug, Serialize)]
struct UplinkMessage {
    data: String,
}

// MQTT -> RS485 Message Structure
#[derive(Debug, Deserialize)]
struct DownlinkMessage {
    data: String,
}

// Logger Structure
struct Logger {
    file: StdMutex<Option<File>>,
}

// Logger Implementation
impl Logger {
    // Create a new Logger instance
    fn new() -> Self {
        Logger {
            file: StdMutex::new(None),
        }
    }

    // Initialize the logger by creating log directory and file
    fn init(&self) -> std::io::Result<()> {
        // Create log directory if it doesn't exist
        std::fs::create_dir_all("/tmp/lorawan-gateway")?;

        // Open log file in append mode
        let file = OpenOptions::new()
            .create(true)   // Create the file if it doesn't exist
            .append(true)   // Append to the file
            .open("/tmp/lorawan-gateway/log")?;

        // Acquire lock and set initialized file
        let mut file_guard = self.file.lock().unwrap();
        *file_guard = Some(file);
        Ok(())
    }

    fn log(&self, message: &str) {
        // Get current timestamp
        let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S");
        // Format log line
        let log_line = format!("[{}][RS485-MQTT]: {}\n", timestamp, message);
        print!("{}", log_line);

        // Write log line to file if initialized
        if let Ok(mut file_guard) = self.file.lock() {
            if let Some(ref mut file) = *file_guard {
                let _ = file.write_all(log_line.as_bytes());
                let _ = file.flush();
            }
        }
    }
}

// Load configuration from UCI
fn load_config_from_uci() -> Result<Config, Box<dyn std::error::Error + Send + Sync>> {
    // uci get helper function
    let uci_get = |config: &str, section: &str, option: &str| -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let output = Command::new("uci")
            .args(&["get", &format!("{}.{}.{}", config, section, option)])
            .output()?;
        if output.status.success() {
            Ok(String::from_utf8(output.stdout)?.trim().to_string())
        } else {
            Err(format!("uci get failed: {}.{}.{}", config, section, option).into())
        }
    };

    // MQTT config
    let enabled = uci_get("lorawan-gateway", "mqtt", "enabled")
        .ok()
        .and_then(|s| s.parse::<u8>().ok())
        .unwrap_or(0)
        == 1;   
    let host = uci_get("lorawan-gateway", "mqtt", "host").unwrap_or_default();
    let port = uci_get("lorawan-gateway", "mqtt", "port")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(1883);
    let username = uci_get("lorawan-gateway", "mqtt", "username").ok();
    let password = uci_get("lorawan-gateway", "mqtt", "password").ok();
    let client_id = uci_get("lorawan-gateway", "mqtt", "client_id").unwrap_or_else(|_| "rs485_bridge".to_string());
    let keepalive = uci_get("lorawan-gateway", "mqtt", "keepalive")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(30);
    let uplink_topic = uci_get("lorawan-gateway", "mqtt", "uplink_topic").unwrap_or_else(|_| "rs485/uplink".to_string());
    let downlink_topic = uci_get("lorawan-gateway", "mqtt", "downlink_topic").unwrap_or_else(|_| "rs485/downlink".to_string());
    let qos_level = uci_get("lorawan-gateway", "mqtt", "qos")
        .ok()
        .and_then(|s| s.parse::<u8>().ok())
        .unwrap_or(0);
    let reconnect_delay = uci_get("lorawan-gateway", "mqtt", "reconnect_delay")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(30);

    let mqtt_config = MqttConfig {
        enabled,
        host,
        port,
        username,
        password,
        client_id,
        keepalive,
        uplink_topic,
        downlink_topic,
        qos_level,
        reconnect_delay,
    };

    // Serial config
    let device = format!(
        "/dev/{}",
        uci_get("lorawan-gateway", "mqtt", "device").unwrap_or_else(|_| "ttyAMA2".to_string())
    );
    let baudrate = uci_get("lorawan-gateway", "mqtt", "baudrate")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(9600);
    let databit = uci_get("lorawan-gateway", "mqtt", "databit")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(8);
    let stopbit = uci_get("lorawan-gateway", "mqtt", "stopbit").unwrap_or_else(|_| "1".to_string());
    let checkbit = uci_get("lorawan-gateway", "mqtt", "checkbit").unwrap_or_else(|_| "none".to_string());

    let serial_config = SerialConfig {
        device,
        baudrate,
        databit,
        stopbit,
        checkbit,
    };

    Ok(Config {
        mqtt: mqtt_config,
        serial: serial_config,
    })
}

// Setup MQTT client
fn setup_mqtt_client(
    config: &MqttConfig,
) -> Result<(AsyncClient, rumqttc::EventLoop), Box<dyn std::error::Error + Send + Sync>> {
    // Create MQTT options
    let mut mqttoptions = MqttOptions::new(&config.client_id, &config.host, config.port);

    // Set keep alive interval
    mqttoptions.set_keep_alive(Duration::from_secs(config.keepalive));
    
    // Set credentials if provided
    if let (Some(username), Some(password)) = (&config.username, &config.password) {
        mqttoptions.set_credentials(username, password);
    }
    
    // Create AsyncClient and EventLoop
    let (client, eventloop) = AsyncClient::new(mqttoptions, 10);
    Ok((client, eventloop))
}

// Configure serial port settings
async fn setup_serial(
    config: &SerialConfig,
    logger: &Arc<Logger>,
) -> Result<tokio_serial::SerialStream, Box<dyn std::error::Error + Send + Sync>> {

    // Map databit to DataBits enum
    let databits = match config.databit {
        5 => DataBits::Five,
        6 => DataBits::Six,
        7 => DataBits::Seven,
        8 => DataBits::Eight,
        _ => DataBits::Eight,
    };

    // Map stopbit to StopBits enum
    let stopbits = match config.stopbit.as_str() {
        "1" => StopBits::One,
        "2" => StopBits::Two,
        _ => StopBits::One,
    };

    // Map checkbit to Parity enum
    let parity = match config.checkbit.as_str() {
        "odd" => Parity::Odd,
        "even" => Parity::Even,
        _ => Parity::None,
    };

    // Log serial port settings
    logger.log(&format!(
        "Opening serial port: {} @ {} baud, {} data bits, {:?} stop bits, {:?} parity",
        config.device, config.baudrate, config.databit, stopbits, parity
    ));

    // Open serial port with specified settings
    let port = tokio_serial::new(&config.device, config.baudrate)
        .data_bits(databits)
        .stop_bits(stopbits)
        .parity(parity)
        .open_native_async()
        .map_err(|e| {
            logger.log(&format!("Failed to open serial port: {}", e));
            e
        })?;
    
    logger.log("Serial port opened successfully");
    Ok(port)
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Initialize logger
    let logger = Arc::new(Logger::new());
    logger.init()?;
    logger.log("RS485-MQTT Bridge starting...");

    // Load initial configuration from UCI
    let mut config = match load_config_from_uci() {
        Ok(cfg) => cfg,
        Err(e) => {
            logger.log(&format!("Failed to load config: {}", e));
            return Err(e);
        }
    };

    // Initialize serial port
    let mut serial_port = match setup_serial(&config.serial, &logger).await {
        Ok(port) => port,
        Err(e) => {
            logger.log(&format!("Failed to setup serial: {}", e));
            return Err(e);
        }
    };

    let mut mqtt_client: Option<AsyncClient> = None;                // MQTT client
    let mut mqtt_eventloop: Option<rumqttc::EventLoop> = None;      // MQTT event loop
    let mut mqtt_state = "not_connect";                             // MQTT connection state   
    let mqtt_qos = match config.mqtt.qos_level {
        0 => QoS::AtMostOnce,
        1 => QoS::AtLeastOnce,
        2 => QoS::ExactlyOnce,
        _ => QoS::AtLeastOnce, 
    };

    loop {
            // Reload configuration
            config = match load_config_from_uci() {
                Ok(cfg) => cfg,
                Err(e) => {
                    logger.log(&format!("Failed to load config: {}", e));
                    return Err(e);
                }
            };

            if config.mqtt.enabled {
                if mqtt_state == "not_connect" {
                    logger.log("MQTT enabled, start connection...");
                    match setup_mqtt_client(&config.mqtt) {
                        Ok((client, el)) => {
                            mqtt_client = Some(client);
                            mqtt_eventloop = Some(el);

                            logger.log(&format!("Success connecting to {}:{}", config.mqtt.host, config.mqtt.port));
                            mqtt_state = "success_connect";
                        }
                        Err(e) => {
                            logger.log(&format!("Failed connecting: {}", e));
                            mqtt_state = "failed_connect";
                        }
                    }
                }
                else if mqtt_state == "success_connect" {
                    tokio::select! {
                        // Handle MQTT events
                        mqtt_result = async {
                            if let Some(ref mut el) = mqtt_eventloop {
                                el.poll().await
                            } else {
                                std::future::pending().await
                            }
                        } => {
                            match mqtt_result {
                                Ok(Event::Incoming(incoming)) => {
                                    match incoming {
                                        // Handle connection acknowledgment
                                        Incoming::ConnAck(_) => {
                                            // Subscribe to downlink topic
                                            if let Some(ref client) = mqtt_client {
                                                match client.subscribe(&config.mqtt.downlink_topic, mqtt_qos).await {
                                                    Ok(_) => {
                                                        logger.log(&format!("Subscribed to topic: {}", config.mqtt.downlink_topic));
                                                    }
                                                    Err(e) => {
                                                        logger.log(&format!("Failed to subscribe: {}", e));
                                                    }
                                                }
                                            }
                                        }
                                        // Handle incoming publish messages
                                        Incoming::Publish(p) => {
                                            let payload = String::from_utf8_lossy(&p.payload);
                                            logger.log(&format!("MQTT received: {}", payload));
                                            
                                            if let Ok(msg) = serde_json::from_str::<DownlinkMessage>(&payload) {
                                                let data = msg.data.as_bytes();
                                                match AsyncWriteExt::write_all(&mut serial_port, data).await {
                                                    Ok(_) => {
                                                        logger.log(&format!("Forwarded to RS485: {}", msg.data));
                                                    }
                                                    Err(e) => {
                                                        logger.log(&format!("RS485 write failed: {}", e));
                                                    }
                                                }
                                            } else {
                                                logger.log(&format!("Invalid message format, expected {{\"data\":\"...\"}}, got: {}", payload));
                                            }
                                        }
                                        // Handle subscription acknowledgment
                                        Incoming::SubAck(_) => {
                                            logger.log("Subscription acknowledged");
                                        }
                                        // Handle disconnection
                                        Incoming::Disconnect => {
                                            logger.log("MQTT disconnected");
                                            mqtt_state = "failed_connect";
                                        }
                                        // Handle other incoming events
                                        other => {
                                            // logger.log(&format!("MQTT event: {:?}", other));
                                        }
                                    }
                                }
                                Ok(Event::Outgoing(_)) => {
                                    // Outgoing events are normal
                                }
                                Err(e) => {
                                    logger.log(&format!("MQTT error: {}", e));
                                    mqtt_state = "failed_connect";
                                }
                            }
                        }

                        serial_result = async { 
                            let mut serial_buffer = vec![0u8; 1024];
                            serial_port.read(&mut serial_buffer).await.map(|n| (n, serial_buffer))
                        } => {
                            match serial_result {
                                Ok((n, buffer)) if n > 0 => {
                                    let data_str = String::from_utf8_lossy(&buffer[..n]).trim().to_string();
                                    logger.log(&format!("RS485 received ({} bytes): {}", n, data_str));
                                    
                                    if let Some(ref client) = mqtt_client {
                                        let uplink_msg = UplinkMessage { data: data_str.clone() };
                                        match serde_json::to_string(&uplink_msg) {
                                            Ok(json) => {
                                                match client.publish(&config.mqtt.uplink_topic, mqtt_qos, false, json.as_bytes()).await {
                                                    Ok(_) => {
                                                        logger.log(&format!("Published to MQTT: {}", data_str));
                                                    }
                                                    Err(e) => {
                                                        logger.log(&format!("MQTT publish failed: {}", e));
                                                    }
                                                }
                                            }
                                            Err(e) => {
                                                logger.log(&format!("JSON serialization failed: {}", e));
                                            }
                                        }
                                    }
                                }
                                Err(e) if e.kind() != std::io::ErrorKind::WouldBlock => {
                                    logger.log(&format!("Serial read error: {}", e));
                                }
                                _ => {}
                            }
                        }
                    }     
                }
                else if mqtt_state == "failed_connect" {
                    tokio::select! {
                        // Reconnect timer
                        _ = tokio::time::sleep(Duration::from_secs(config.mqtt.reconnect_delay)) => {
                            logger.log("Retrying connection...");
                            match setup_mqtt_client(&config.mqtt) {
                                Ok((client, el)) => {
                                    mqtt_client = Some(client);
                                    mqtt_eventloop = Some(el);

                                    logger.log(&format!("Success connecting to {}:{}", config.mqtt.host, config.mqtt.port));
                                    mqtt_state = "success_connect";
                                }
                                Err(e) => {
                                    mqtt_client = None;
                                    mqtt_eventloop = None;

                                    logger.log(&format!("Reconnect failed: {}", e));
                                    mqtt_state = "failed_connect";
                                }
                            }
                        }
                    }
                }
            }
            else {
                if mqtt_state != "not_connect" {
                    mqtt_client = None;
                    mqtt_eventloop = None;

                    logger.log("MQTT disabled");
                    mqtt_state = "not_connect";
                }
            }

        sleep(Duration::from_millis(1)).await;
    }
}
