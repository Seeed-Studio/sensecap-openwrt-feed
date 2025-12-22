use std::{thread, time::Duration};

use gpio_cdev::{Chip, LineRequestFlags};

const GPIOCHIP: &str = "/dev/gpiochip2";

// Offsets on gpiochip2 (0/1/2)
const SX1302_POWER_EN: u32 = 0;
const SX1302_RESET: u32 = 1;
const SX1261_RESET: u32 = 2;

fn wait_gpio() {
    thread::sleep(Duration::from_millis(100));
}

fn start() -> anyhow::Result<()> {
    let mut chip = Chip::new(GPIOCHIP)?;

    let h_power = chip
        .get_line(SX1302_POWER_EN)?
        .request(LineRequestFlags::OUTPUT, 0, "radio_init:power_en")?;
    let h_sx1302 = chip
        .get_line(SX1302_RESET)?
        .request(LineRequestFlags::OUTPUT, 0, "radio_init:sx1302_reset")?;
    let h_sx1261 = chip
        .get_line(SX1261_RESET)?
        .request(LineRequestFlags::OUTPUT, 0, "radio_init:sx1261_reset")?;

    println!(
        "CoreCell power enable via {} line {}...",
        GPIOCHIP, SX1302_POWER_EN
    );
    h_power.set_value(1)?;
    wait_gpio();

    println!("CoreCell reset via {} line {}...", GPIOCHIP, SX1302_RESET);
    h_sx1302.set_value(1)?;
    wait_gpio();
    h_sx1302.set_value(0)?;
    wait_gpio();

    println!("SX1261 reset via {} line {}...", GPIOCHIP, SX1261_RESET);
    h_sx1261.set_value(0)?;
    wait_gpio();
    h_sx1261.set_value(1)?;
    wait_gpio();

    Ok(())
}

fn stop() -> anyhow::Result<()> {
    let mut chip = Chip::new(GPIOCHIP)?;

    let h_power = chip
        .get_line(SX1302_POWER_EN)?
        .request(LineRequestFlags::OUTPUT, 0, "radio_stop:power_en")?;
    let h_sx1302 = chip
        .get_line(SX1302_RESET)?
        .request(LineRequestFlags::OUTPUT, 0, "radio_stop:sx1302_reset")?;
    let h_sx1261 = chip
        .get_line(SX1261_RESET)?
        .request(LineRequestFlags::OUTPUT, 0, "radio_stop:sx1261_reset")?;

    println!(
        "CoreCell power disable via {} line {}...",
        GPIOCHIP, SX1302_POWER_EN
    );
    h_power.set_value(0)?;
    wait_gpio();

    h_sx1261.set_value(0)?;
    wait_gpio();

    println!("CoreCell reset via {} line {}...", GPIOCHIP, SX1302_RESET);
    h_sx1302.set_value(0)?;
    wait_gpio();

    Ok(())
}

fn main() -> anyhow::Result<()> {
    let args: Vec<String> = std::env::args().collect();

    if args.len() == 1 || (args.len() == 2 && args[1] == "start") {
        start()
    } else if args.len() == 2 && args[1] == "stop" {
        stop()
    } else {
        eprintln!("Usage: {} [start|stop]", args[0]);
        std::process::exit(1);
    }
}
