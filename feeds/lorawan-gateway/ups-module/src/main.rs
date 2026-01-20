use chrono::Local;
use gpio_cdev::{Chip, LineRequestFlags, EventRequestFlags, EventType};
use std::fs::{File, OpenOptions};
use std::io::Write;
use std::process::Command;
use std::sync::{Arc, Mutex as StdMutex};
use std::time::{Duration, Instant};
use tokio::time::sleep;

// UPS Configuration Structure
#[derive(Debug, Clone, PartialEq)]
struct Config {
    commands: Vec<String>,
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
        std::fs::create_dir_all("/tmp/ups")?;

        // Open log file in append mode
        let file = OpenOptions::new()
            .create(true)   // Create the file if it doesn't exist
            .append(true)   // Append to the file
            .open("/tmp/ups/log")?;

        // Acquire lock and set initialized file
        let mut file_guard = self.file.lock().unwrap();
        *file_guard = Some(file);
        Ok(())
    }

    fn log(&self, message: &str) {
        // Get current timestamp
        let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S");
        // Format log line
        let log_line = format!("[{}][UPS-Module]: {}\n", timestamp, message);
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

fn load_config() -> Result<Config, String> {
    let mut commands = Vec::new();
    
    let config_content = std::fs::read_to_string("/etc/config/ups-module")
        .map_err(|e| format!("Failed to read config file: {}", e))?;
    
    for line in config_content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("list commands") {
            if let Some(start) = trimmed.find('\'') {
                if let Some(end) = trimmed.rfind('\'') {
                    if start < end {
                        let cmd = &trimmed[start + 1..end];
                        commands.push(cmd.to_string());
                    }
                }
            }
        }
    }
    
    Ok(Config { commands })
}

// Execute power outage commands
async fn execute_commands(commands: &[String], logger: &Logger) {
    logger.log("Power outage detected! Starting command execution...");

    for (index, cmd) in commands.iter().enumerate() {
        logger.log(&format!("Executing command {}/{}: {}", index + 1, commands.len(), cmd));

        let output = Command::new("sh")
            .arg("-c")
            .arg(cmd)
            .output();

        match output {
            Ok(result) => {
                if result.status.success() {
                    logger.log(&format!("Command {} completed successfully", index + 1));
                    if !result.stdout.is_empty() {
                        let stdout = String::from_utf8_lossy(&result.stdout);
                        logger.log(&format!("Output: {}", stdout.trim()));
                    }
                } else {
                    logger.log(&format!("Command {} failed with exit code: {:?}", 
                        index + 1, result.status.code()));
                    if !result.stderr.is_empty() {
                        let stderr = String::from_utf8_lossy(&result.stderr);
                        logger.log(&format!("Error: {}", stderr.trim()));
                    }
                }
            }
            Err(e) => {
                logger.log(&format!("Failed to execute command {}: {}", index + 1, e));
            }
        }

        // Small delay between commands
        sleep(Duration::from_millis(100)).await;
    }
}

// Monitor UPS GPIO for falling edge
async fn monitor_gpio(logger: Arc<Logger>) -> Result<(), Box<dyn std::error::Error>> {
    logger.log("Initializing UPS monitoring ...");

    let uci_get = |config: &str, section: &str, option: &str| -> Result<String, Box<dyn std::error::Error>> {
        let output = Command::new("uci")
            .args(&["get", &format!("{}.{}.{}", config, section, option)])
            .output()?;
        if output.status.success() {
            Ok(String::from_utf8(output.stdout)?.trim().to_string())
        } else {
            Err(format!("uci get failed: {}.{}.{}", config, section, option).into())
        }
    };

    // Load GPIO configuration from UCI
    let ups_gpio_chip = uci_get("hardware", "hardware", "ups_gpio_chip")?;
    let ups_gpio_line: u32 = uci_get("hardware", "hardware", "ups_gpio_line")?.parse()?;
        
    logger.log(&format!("Using GPIO chip: {}, line: {}", ups_gpio_chip, ups_gpio_line));

    // Open UPS GPIO chip
    let mut chip = Chip::new(&ups_gpio_chip)?;

    // Get UPS GPIO line
    let line = chip.get_line(ups_gpio_line)?;
    
    // Request line for input with falling edge events
    let mut line_handle = line.events(
        LineRequestFlags::INPUT,
        EventRequestFlags::FALLING_EDGE,
        "ups-monitor",
    )?;

    logger.log("UPS monitoring started, waiting for power outage signal...");

    let debounce_duration = Duration::from_millis(500);
    let mut last_event_time: Option<Instant> = None;

    loop {
        match line_handle.next() {
            Some(Ok(evt)) => {
                if evt.event_type() == EventType::FallingEdge {
                    let now = Instant::now();
                    
                    if let Some(last_time) = last_event_time {
                        let elapsed = last_time.elapsed();
                        if elapsed < debounce_duration {
                            continue;
                        }
                    }
                    
                    let current_value = line_handle.get_value()?;
                    if current_value == 0 {
                        match load_config() {
                            Ok(config) => {
                                if !config.commands.is_empty() {
                                    execute_commands(&config.commands, &logger).await;
                                }
                            }
                            Err(e) => {
                                logger.log(&format!("Failed to load config: {}", e));
                            }
                        }
                        
                        last_event_time = Some(now);
                    }
                }
            }
            Some(Err(e)) => {
                logger.log(&format!("GPIO event error: {}", e));
                sleep(Duration::from_secs(1)).await;
            }
            None => {
                sleep(Duration::from_millis(100)).await;
            }
        }
    }
}

#[tokio::main]
async fn main() {
    // Create logger instance
    let logger = Arc::new(Logger::new());

    // Initialize logger
    if let Err(e) = logger.init() {
        eprintln!("Failed to initialize logger: {}", e);
        return;
    }

    // Start GPIO monitoring
    if let Err(e) = monitor_gpio(logger.clone()).await {
        logger.log(&format!("UPS monitoring failed: {}", e));
    }
}
