use chrono::Local;
use rumqttc::{AsyncClient, Event, Incoming, MqttOptions, QoS, Transport};
use rumqttc::tokio_rustls::rustls::ClientConfig as RustlsClientConfig;
use rustls_pemfile::{certs, pkcs8_private_keys};
use serde::{Deserialize, Serialize};
use std::fs::{File, OpenOptions};
use std::io::Write;
use std::process::Command;
use std::sync::{Arc, Mutex as StdMutex};
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::time::sleep;
use tokio_serial::{DataBits, Parity, StopBits, SerialPortBuilderExt};
use tokio_modbus::prelude::*;
use std::path::Path;

// Configuration Structures
#[derive(Debug, Clone, PartialEq)]
struct Config {
    mqtt: MqttConfig,
    serial: SerialConfig,
    protocol: ProtocolConfig,
}

#[derive(Debug, Clone, PartialEq)]
struct MqttConfig {
    enabled: bool,
    transport: String,
    host: String,
    port: u16,
    username: Option<String>,
    password: Option<String>,
    client_id: String,
    keepalive: u64,
    uplink_topic: String,
    downlink_topic: String,
    qos_level: QoS,
    reconnect_delay: u64,
    auth_mode: String,
    ca_cert: Option<String>,
    client_cert: Option<String>,
    client_key: Option<String>,
    token: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
struct SerialConfig {
    device: String,
    baudrate: u32,
    databit: DataBits,
    stopbit: StopBits,
    checkbit: Parity,
    flowcontrol: tokio_serial::FlowControl,
    timeout: Duration,
}

#[derive(Debug, Clone, PartialEq)]
struct ProtocolConfig {
    device_address: u8,
    function_code: u8,
    register_address: u16,
    data_length: u16,
    write_value: String,
}

// MQTT Message Structures
#[derive(Debug, Serialize)]
struct UplinkMessage {
    data: String,
}

#[derive(Debug, Deserialize)]
struct DownlinkMessage {
    data: String,
}

// Logger Structure
struct Logger {
    file: StdMutex<Option<File>>,
}

impl Logger {
    fn new() -> Self {
        Logger {
            file: StdMutex::new(None),
        }
    }

    fn init(&self) -> std::io::Result<()> {
        std::fs::create_dir_all("/tmp/rs485")?;
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open("/tmp/rs485/log")?;
        let mut file_guard = self.file.lock().unwrap();
        *file_guard = Some(file);
        Ok(())
    }

    fn log(&self, message: &str) {
        let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S");
        let log_line = format!("[{}][RS485-Modbus]: {}\n", timestamp, message);
        print!("{}", log_line);
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
    let mqtt_enabled = uci_get("rs485-module", "mqtt", "enabled")
        .ok()
        .and_then(|s| s.parse::<u8>().ok())
        .unwrap_or(0)
        == 1;
    let host = uci_get("rs485-module", "mqtt", "host").unwrap_or_default();
    let port = uci_get("rs485-module", "mqtt", "port")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(1883);
    let username = uci_get("rs485-module", "mqtt", "username").ok();
    let password = uci_get("rs485-module", "mqtt", "password").ok();
    let client_id = uci_get("rs485-module", "mqtt", "client_id").unwrap_or_else(|_| "rs485_modbus".to_string());
    let keepalive = uci_get("rs485-module", "mqtt", "keepalive")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(30);
    let uplink_topic = uci_get("rs485-module", "mqtt", "uplink_topic").unwrap_or_else(|_| "rs485/uplink".to_string());
    let downlink_topic = uci_get("rs485-module", "mqtt", "downlink_topic").unwrap_or_else(|_| "rs485/downlink".to_string());
    let qos_level = uci_get("rs485-module", "mqtt", "qos")
        .ok()
        .and_then(|s| s.parse::<u8>().ok())
        .unwrap_or(0);
    let reconnect_delay = uci_get("rs485-module", "mqtt", "reconnect_delay")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(30);
    let transport = uci_get("rs485-module", "mqtt", "transport").unwrap_or_else(|_| "tcp".to_string());
    let auth_mode = uci_get("rs485-module", "mqtt", "auth_mode").unwrap_or_else(|_| "none".to_string());
    let ca_cert = uci_get("rs485-module", "mqtt", "ca_cert").ok();
    let client_cert = uci_get("rs485-module", "mqtt", "client_cert").ok();
    let client_key = uci_get("rs485-module", "mqtt", "client_key").ok();
    let token = uci_get("rs485-module", "mqtt", "token").ok();

    let mqtt_config = MqttConfig {
        enabled: mqtt_enabled,
        transport,
        host,
        port,
        username,
        password,
        client_id,
        keepalive,
        uplink_topic,
        downlink_topic,
        qos_level: match qos_level {
            1 => QoS::AtLeastOnce,
            2 => QoS::ExactlyOnce,
            _ => QoS::AtMostOnce,
        },
        reconnect_delay,
        auth_mode,
        ca_cert,
        client_cert,
        client_key,
        token,
    };

    // Serial config
    let device = format!(
        "/dev/{}",
        uci_get("rs485-module", "serial", "device").unwrap_or_else(|_| "ttyAMA2".to_string())
    );
    let baudrate = uci_get("rs485-module", "serial", "baudrate")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(9600);
    let databit = uci_get("rs485-module", "serial", "databit")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(8);
    let stopbit = uci_get("rs485-module", "serial", "stopbit").unwrap_or_else(|_| "1".to_string());
    let checkbit = uci_get("rs485-module", "serial", "checkbit").unwrap_or_else(|_| "none".to_string());
    let flowcontrol = uci_get("rs485-module", "serial", "flowcontrol").unwrap_or_else(|_| "none".to_string());
    let timeout = uci_get("rs485-module", "serial", "timeout")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(1000);

    let serial_config = SerialConfig {
        device,
        baudrate,
        databit: match databit {
            5 => DataBits::Five,
            6 => DataBits::Six,
            7 => DataBits::Seven,
            _ => DataBits::Eight,
        },
        stopbit: match stopbit.as_str() {
            "2" => StopBits::Two,
            _ => StopBits::One,
        },
        checkbit: match checkbit.as_str() {
            "odd" => Parity::Odd,
            "even" => Parity::Even,
            _ => Parity::None,
        },
        flowcontrol: match flowcontrol.as_str() {
            "rtscts" => tokio_serial::FlowControl::Hardware,
            "xonxoff" => tokio_serial::FlowControl::Software,
            _ => tokio_serial::FlowControl::None,
        },
        timeout: Duration::from_millis(timeout),
    };

    // Protocol config
    let device_address = uci_get("rs485-module", "protocol", "device_address")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(1);
    let function_code = uci_get("rs485-module", "protocol", "function_code")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(3);
    let register_address = uci_get("rs485-module", "protocol", "register_address")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(40001);
    let data_length = uci_get("rs485-module", "protocol", "data_length")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(10);

    let protocol_config = ProtocolConfig {
        device_address,
        function_code,
        register_address,
        data_length,
        write_value: uci_get("rs485-module", "protocol", "write_value").unwrap_or_else(|_| "0".to_string()),
    };

    Ok(Config {
        mqtt: mqtt_config,
        serial: serial_config,
        protocol: protocol_config,
    })
}

// Setup MQTT client
fn setup_mqtt_client(
    config: &MqttConfig,
) -> Result<(AsyncClient, rumqttc::EventLoop), Box<dyn std::error::Error + Send + Sync>> {
    let mut mqttoptions = MqttOptions::new(&config.client_id, &config.host, config.port);
    mqttoptions.set_keep_alive(Duration::from_secs(config.keepalive));
    
    if let (Some(username), Some(password)) = (&config.username, &config.password) {
        mqttoptions.set_credentials(username, password);
    }

    match config.transport.as_str() {
        "ssl" | "tls" => {
            let mut root_cert_store = rumqttc::tokio_rustls::rustls::RootCertStore::empty();
            
            match config.auth_mode.as_str() {
                "tls-server" => {
                    if let Some(ca_cert) = &config.ca_cert {
                        let ca_cert_bytes = ca_cert.as_bytes();
                        let mut cursor = std::io::Cursor::new(ca_cert_bytes);
                        for cert in certs(&mut cursor) {
                            root_cert_store.add(cert?)?;
                        }
                    } else {
                        root_cert_store.extend(
                            webpki_roots::TLS_SERVER_ROOTS.iter().cloned()
                        );
                    }
                    
                    let tls_config = RustlsClientConfig::builder()
                        .with_root_certificates(root_cert_store)
                        .with_no_client_auth();
                    
                    mqttoptions.set_transport(Transport::tls_with_config(tls_config.into()));
                }
                "mutual-tls" => {
                    if let Some(ca_cert) = &config.ca_cert {
                        let ca_cert_bytes = ca_cert.as_bytes();
                        let mut cursor = std::io::Cursor::new(ca_cert_bytes);
                        for cert in certs(&mut cursor) {
                            root_cert_store.add(cert?)?;
                        }
                    } else {
                        root_cert_store.extend(
                            webpki_roots::TLS_SERVER_ROOTS.iter().cloned()
                        );
                    }
                    
                    if let (Some(client_cert_pem), Some(client_key_pem)) = (&config.client_cert, &config.client_key) {
                        let cert_bytes = client_cert_pem.as_bytes();
                        let key_bytes = client_key_pem.as_bytes();
                        
                        let mut cert_cursor = std::io::Cursor::new(cert_bytes);
                        let certs: Vec<_> = certs(&mut cert_cursor).collect::<Result<_, _>>()?;
                        
                        let mut key_cursor = std::io::Cursor::new(key_bytes);
                        let mut keys = pkcs8_private_keys(&mut key_cursor).collect::<Result<Vec<_>, _>>()?;
                        
                        if keys.is_empty() {
                            return Err("No private key found".into());
                        }
                        
                        let tls_config = RustlsClientConfig::builder()
                            .with_root_certificates(root_cert_store)
                            .with_client_auth_cert(certs, keys.remove(0).into())?;
                        
                        mqttoptions.set_transport(Transport::tls_with_config(tls_config.into()));
                    } else {
                        return Err("Mutual TLS requires both client certificate and private key".into());
                    }
                }
                _ => {
                    root_cert_store.extend(
                        webpki_roots::TLS_SERVER_ROOTS.iter().cloned()
                    );
                    
                    let tls_config = RustlsClientConfig::builder()
                        .with_root_certificates(root_cert_store)
                        .with_no_client_auth();
                    
                    mqttoptions.set_transport(Transport::tls_with_config(tls_config.into()));
                }
            }
        }
        "ws" => {
            let ws_url = format!("ws://{}:{}/mqtt", config.host, config.port);
            mqttoptions = MqttOptions::new(&config.client_id, &ws_url, config.port);
            mqttoptions.set_keep_alive(Duration::from_secs(config.keepalive));
            if let Some(username) = &config.username {
                mqttoptions.set_credentials(username, config.password.as_deref().unwrap_or(""));
            }
            mqttoptions.set_transport(Transport::Ws);
        }
        "wss" => {
            let wss_url = format!("wss://{}:{}/mqtt", config.host, config.port);
            mqttoptions = MqttOptions::new(&config.client_id, &wss_url, config.port);
            mqttoptions.set_keep_alive(Duration::from_secs(config.keepalive));
            if let Some(username) = &config.username {
                mqttoptions.set_credentials(username, config.password.as_deref().unwrap_or(""));
            }
            
            let mut root_cert_store = rumqttc::tokio_rustls::rustls::RootCertStore::empty();
            
            if let Some(ca_cert) = &config.ca_cert {
                let ca_cert_bytes = ca_cert.as_bytes();
                let mut cursor = std::io::Cursor::new(ca_cert_bytes);
                for cert in certs(&mut cursor) {
                    root_cert_store.add(cert?)?;
                }
            } else {
                root_cert_store.extend(
                    webpki_roots::TLS_SERVER_ROOTS.iter().cloned()
                );
            }
            
            let tls_config = match config.auth_mode.as_str() {
                "mutual-tls" => {
                    if let (Some(client_cert_pem), Some(client_key_pem)) = (&config.client_cert, &config.client_key) {
                        let cert_bytes = client_cert_pem.as_bytes();
                        let key_bytes = client_key_pem.as_bytes();
                        
                        let mut cert_cursor = std::io::Cursor::new(cert_bytes);
                        let certs: Vec<_> = certs(&mut cert_cursor).collect::<Result<_, _>>()?;
                        
                        let mut key_cursor = std::io::Cursor::new(key_bytes);
                        let mut keys = pkcs8_private_keys(&mut key_cursor).collect::<Result<Vec<_>, _>>()?;
                        
                        if keys.is_empty() {
                            return Err("No private key found".into());
                        }
                        
                        RustlsClientConfig::builder()
                            .with_root_certificates(root_cert_store)
                            .with_client_auth_cert(certs, keys.remove(0).into())?
                    } else {
                        return Err("Mutual TLS requires both client certificate and private key".into());
                    }
                }
                _ => {
                    RustlsClientConfig::builder()
                        .with_root_certificates(root_cert_store)
                        .with_no_client_auth()
                }
            };
            
            mqttoptions.set_transport(Transport::wss_with_config(tls_config.into()));
        }
        "tcp" | _ => {
            mqttoptions.set_transport(Transport::Tcp);
        }
    }
    
    let (client, eventloop) = AsyncClient::new(mqttoptions, 10);
    Ok((client, eventloop))
}

// Setup serial port
async fn setup_serial(
    config: &SerialConfig,
) -> Result<tokio_serial::SerialStream, Box<dyn std::error::Error + Send + Sync>> {
    let port = tokio_serial::new(&config.device, config.baudrate)
        .data_bits(config.databit)
        .stop_bits(config.stopbit)
        .parity(config.checkbit)
        .flow_control(config.flowcontrol)
        .timeout(config.timeout)
        .open_native_async()?;
    
    Ok(port)
}

// Read Modbus data
async fn read_modbus_data(
    ctx: &mut client::Context,
    config: &ProtocolConfig,
    logger: &Arc<Logger>,
) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    ctx.set_slave(Slave(config.device_address));
    
    let addr = config.register_address as u16;

    match config.function_code {
        3 => {
            let data = ctx.read_holding_registers(addr, config.data_length as u16).await??;
            Ok(format!("Registers: [{}]", 
                data.iter().map(|v| format!("0x{:04X}", *v)).collect::<Vec<_>>().join(", ")))
        }
        4 => {
            let data = ctx.read_input_registers(addr, config.data_length as u16).await??;
            Ok(format!("Registers: [{}]", 
                data.iter().map(|v| format!("0x{:04X}", *v)).collect::<Vec<_>>().join(", ")))
        }
        1 => {
            let data = ctx.read_coils(addr, config.data_length as u16).await??;
            Ok(format!("Coils: [{}]", 
                data.iter().map(|v| if *v { "1" } else { "0" }).collect::<Vec<_>>().join(", ")))
        }
        2 => {
            let data = ctx.read_discrete_inputs(addr, config.data_length as u16).await??;
            Ok(format!("Coils: [{}]", 
                data.iter().map(|v| if *v { "1" } else { "0" }).collect::<Vec<_>>().join(", ")))
        }
        5 => {
            // Write Single Coil
            let value = config.write_value.trim().parse::<u16>().unwrap_or(0) != 0;
            ctx.write_single_coil(addr, value).await??;
            Ok(format!("Write Single Coil: address={}, value={}", addr, if value { "ON" } else { "OFF" }))
        }
        6 => {
            // Write Single Register
            let value = if config.write_value.trim().starts_with("0x") || config.write_value.trim().starts_with("0X") {
                u16::from_str_radix(&config.write_value.trim()[2..], 16).unwrap_or(0)
            } else {
                config.write_value.trim().parse::<u16>().unwrap_or(0)
            };
            ctx.write_single_register(addr, value).await??;
            Ok(format!("Write Single Register: address={}, value=0x{:04X}", addr, value))
        }
        15 => {
            let values: Vec<bool> = config.write_value.trim().split(',')
                .filter_map(|s| s.trim().parse::<u16>().ok())
                .map(|v| v != 0)
                .collect();
            if values.is_empty() {
                return Err("No valid values provided for Write Multiple Coils".into());
            }
            ctx.write_multiple_coils(addr, &values).await??;
            Ok(format!("Write Multiple Coils: address={}, count={}", addr, values.len()))
        }
        16 => {
            // Write Multiple Registers
            let values: Vec<u16> = config.write_value.trim().split(',')
                .filter_map(|s| {
                    let s = s.trim();
                    if s.starts_with("0x") || s.starts_with("0X") {
                        u16::from_str_radix(&s[2..], 16).ok()
                    } else {
                        s.parse::<u16>().ok()
                    }
                })
                .collect();
            if values.is_empty() {
                return Err("No valid values provided for Write Multiple Registers".into());
            }
            ctx.write_multiple_registers(addr, &values).await??;
            Ok(format!("Write Multiple Registers: address={}, count={}", addr, values.len()))
        }
        _ => {
            Err(format!("Unsupported function code: {}", config.function_code).into())
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let logger = Arc::new(Logger::new());
    logger.init()?;
    logger.log("RS485-Modbus Bridge starting...");

    // Load initial configuration from UCI
    let mut config = match load_config_from_uci() {
        Ok(cfg) => cfg,
        Err(e) => {
            logger.log(&format!("Failed to setup config: {}", e));
            return Err(e);
        }
    };

    // Initialize Modbus context
    let port = setup_serial(&config.serial).await?;
    logger.log(&format!(
        "Opening serial port: {} @ {} baud, {:?} data bits, {:?} stop bits, {:?} parity, {:?} flow control, {:?} timeout",
        config.serial.device, config.serial.baudrate, config.serial.databit, config.serial.stopbit, config.serial.checkbit, config.serial.flowcontrol, config.serial.timeout
    ));
    let mut modbus_ctx = rtu::attach(port);
    logger.log("Success opening serial port");
    
    let mut mqtt_client: Option<AsyncClient> = None;                // MQTT client
    let mut mqtt_eventloop: Option<rumqttc::EventLoop> = None;      // MQTT event loop
    let mut mqtt_state = "not_connect";                             // MQTT connection state   

    loop {
        // Load configuration
        config = match load_config_from_uci() {
            Ok(cfg) => cfg,
            Err(e) => {
                logger.log(&format!("Failed to load config: {}", e));
                return Err(e);
            }
        };

        if config.mqtt.enabled {
            if mqtt_state == "not_connect" {
                logger.log("MQTT enabled, connecting...");
                match setup_mqtt_client(&config.mqtt) {
                    Ok((client, el)) => {
                        mqtt_client = Some(client);
                        mqtt_eventloop = Some(el);
                        logger.log(&format!("Connected to {}:{}", config.mqtt.host, config.mqtt.port));
                        mqtt_state = "success_connect";
                    }
                    Err(e) => {
                        logger.log(&format!("Connection failed: {}", e));
                        mqtt_state = "failed_connect";
                    }
                }
            } 
            else if mqtt_state == "success_connect" {
                // Check for modbus_read trigger file first (higher priority)
                let trigger_path = "/tmp/rs485/modbus_read";
                let result_path = "/tmp/rs485/modbus_result";
                
                if Path::new(trigger_path).exists() {
                    // logger.log("Modbus read trigger detected");
                    
                    // Add 3 second timeout for Modbus read
                    let read_future = read_modbus_data(&mut modbus_ctx, &config.protocol, &logger);
                    let timeout_future = tokio::time::sleep(Duration::from_secs(3));
                    
                    let modbus_result = tokio::select! {
                        result = read_future => Some(result),
                        _ = timeout_future => {
                            logger.log("Modbus read timeout after 3 seconds");
                            None
                        }
                    };
                    
                    match modbus_result {
                        Some(Ok(data)) => {
                            // logger.log(&format!("Modbus data: {}", data));
                            match std::fs::write(result_path, &data) {
                                Ok(_) => logger.log(&format!("Modbus data received: {}", data)),
                                Err(e) => logger.log(&format!("Failed to write result file: {}", e)),
                            }
                            
                            // Publish to MQTT if enabled
                            if config.mqtt.enabled {
                                if let Some(ref client) = mqtt_client {
                                    let uplink_msg = UplinkMessage { data: data.clone() };
                                    if let Ok(json) = serde_json::to_string(&uplink_msg) {
                                        match client.publish(&config.mqtt.uplink_topic, config.mqtt.qos_level, false, json.as_bytes()).await {
                                            Ok(_) => logger.log(&format!("Published to MQTT: {}", json)),
                                            Err(e) => logger.log(&format!("MQTT publish failed: {}", e)),
                                        }
                                    }
                                }
                            }
                        }
                        Some(Err(e)) => {
                            logger.log(&format!("Modbus read failed: {}", e));
                            let error_msg = format!("Error: {}", e);
                            match std::fs::write(result_path, &error_msg) {
                                Ok(_) => logger.log("Error result written"),
                                Err(e) => logger.log(&format!("Failed to write error: {}", e)),
                            }
                        }
                        None => {
                            // Timeout occurred
                            let error_msg = "Error: Modbus read timeout";
                            match std::fs::write(result_path, &error_msg) {
                                Ok(_) => logger.log("Error result written"),
                                Err(e) => logger.log(&format!("Failed to write error: {}", e)),
                            }
                        }
                    }
                    
                    let _ = std::fs::remove_file(trigger_path);
                }
                
                // Then handle MQTT events with timeout
                tokio::select! {
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
                                            match client.subscribe(&config.mqtt.downlink_topic, config.mqtt.qos_level).await {
                                                Ok(_) => {
                                                    logger.log(&format!("Subscribed [MQTT->RS485] to topic: {}", config.mqtt.downlink_topic));
                                                }
                                                Err(e) => {
                                                    logger.log(&format!("Failed to topic: {}", e));
                                                }
                                            }
                                        }
                                        logger.log(&format!("Published [RS485->MQTT] to topic: {}", config.mqtt.uplink_topic));
                                    }
                                    // Handle incoming publish messages
                                    Incoming::Publish(p) => {
                                        let payload = String::from_utf8_lossy(&p.payload);
                                        logger.log(&format!("MQTT received: {}", payload));
                                        
                                        if let Ok(msg) = serde_json::from_str::<DownlinkMessage>(&payload) {
                                            let data = msg.data.as_bytes();
                                                
                                            match tokio_serial::new(&config.serial.device, config.serial.baudrate)
                                                .data_bits(config.serial.databit)
                                                .stop_bits(config.serial.stopbit)
                                                .parity(config.serial.checkbit)
                                                .flow_control(config.serial.flowcontrol)
                                                .timeout(config.serial.timeout)
                                                .open_native_async()
                                            {
                                                Ok(mut port) => {
                                                    match AsyncWriteExt::write_all(&mut port, &data).await {
                                                        Ok(_) => logger.log(&format!("Forwarded to RS485: {}", msg.data)),
                                                        Err(e) => logger.log(&format!("RS485 write failed: {}", e)),
                                                    }
                                                }
                                                Err(e) => logger.log(&format!("Failed to open serial port: {}", e)),
                                            }
                                        }
                                    }
                                    // Handle subscription acknowledgment
                                    Incoming::SubAck(_) => {
                                        // logger.log("Subscription acknowledged");
                                    }
                                    // Handle disconnection
                                    Incoming::Disconnect => {
                                        logger.log("MQTT disconnected");
                                        mqtt_state = "failed_connect";
                                    }
                                    // Handle other incoming events
                                    _ => {
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
                    _ = tokio::time::sleep(Duration::from_millis(1000)) => {
                        // Timeout to ensure trigger file checked regularly
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
            // MQTT disabled, only check trigger file
            let trigger_path = "/tmp/rs485/modbus_read";
            let result_path = "/tmp/rs485/modbus_result";
            
            if Path::new(trigger_path).exists() {
                // logger.log("Modbus read trigger detected");
                
                // Add 3 second timeout for Modbus read
                let read_future = read_modbus_data(&mut modbus_ctx, &config.protocol, &logger);
                let timeout_future = tokio::time::sleep(Duration::from_secs(3));
                
                let modbus_result = tokio::select! {
                    result = read_future => Some(result),
                    _ = timeout_future => {
                        logger.log("Modbus read timeout after 3 seconds");
                        None
                    }
                };

                match modbus_result {
                    Some(Ok(data)) => {
                        // logger.log(&format!("Modbus data: {}", data));
                        match std::fs::write(result_path, &data) {
                            Ok(_) => logger.log(&format!("Modbus data received: {}", data)),
                            Err(e) => logger.log(&format!("Failed to write result file: {}", e)),
                        }
                    }
                    Some(Err(e)) => {
                        logger.log(&format!("Modbus read failed: {}", e));
                        let error_msg = format!("Error: {}", e);
                        match std::fs::write(result_path, &error_msg) {
                            Ok(_) => logger.log("Error result written"),
                            Err(e) => logger.log(&format!("Failed to write error: {}", e)),
                        }
                    }
                    None => {
                        // Timeout occurred
                        let error_msg = "Error: Modbus read timeout";
                        match std::fs::write(result_path, &error_msg) {
                            Ok(_) => logger.log("Error result written"),
                            Err(e) => logger.log(&format!("Failed to write error: {}", e)),
                        }
                    }
                }
                    
                let _ = std::fs::remove_file(trigger_path);
            }
            
            if mqtt_state != "not_connect" {
                mqtt_client = None;
                mqtt_eventloop = None;
                logger.log("MQTT disabled");
                mqtt_state = "not_connect";
            }
        }

        // Check for modbus_write trigger file (works regardless of MQTT state)
        let trigger_path = "/tmp/rs485/modbus_write";
        let result_path = "/tmp/rs485/modbus_result";
        
        if Path::new(trigger_path).exists() {
            let write_future = read_modbus_data(&mut modbus_ctx, &config.protocol, &logger);
            let timeout_future = tokio::time::sleep(Duration::from_secs(3));
            
            let modbus_result = tokio::select! {
                result = write_future => Some(result),
                _ = timeout_future => {
                    logger.log("Modbus write operation timeout (3 seconds)");
                    None
                }
            };
            
            match modbus_result {
                Some(Ok(data)) => {
                    logger.log(&format!("Modbus write successful: {}", data));
                    if let Err(e) = std::fs::write(result_path, &data) {
                        logger.log(&format!("Failed to write result file: {}", e));
                    }
                }
                Some(Err(e)) => {
                    let error_msg = format!("Error: Modbus write failed - {}", e);
                    logger.log(&error_msg);
                    let _ = std::fs::write(result_path, error_msg);
                }
                None => {
                    let error_msg = "Error: Modbus write timeout";
                    logger.log(error_msg);
                    let _ = std::fs::write(result_path, error_msg);
                }
            }
            
            // Remove trigger file
            let _ = std::fs::remove_file(trigger_path);
        }

        sleep(Duration::from_millis(100)).await;
    }
}
