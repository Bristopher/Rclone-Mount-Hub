/// Spawn a process without flashing a console window on Windows.
#[cfg(target_os = "windows")]
pub fn cmd(program: &str) -> std::process::Command {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let mut c = std::process::Command::new(program);
    c.creation_flags(CREATE_NO_WINDOW);
    c
}

#[cfg(not(target_os = "windows"))]
pub fn cmd(program: &str) -> std::process::Command {
    std::process::Command::new(program)
}
