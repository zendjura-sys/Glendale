//! Нативне ядро програми GameCon для ПК. Flutter викликає його через dart:ffi (C ABI), без кодогенерації.
//!
//! `gamecon_foreground_game(buf, cap)` — якщо на передньому плані гра на весь екран (не робочий стіл
//! і не сам GameCon), пише назву її вікна (UTF-16) у `buf` і повертає кількість символів; інакше 0.

/// # Safety
/// `buf` — буфер щонайменше на `cap` символів UTF-16 (або null при `cap == 0`).
#[no_mangle]
pub unsafe extern "C" fn gamecon_foreground_game(buf: *mut u16, cap: i32) -> i32 {
    imp::foreground_game(buf, cap)
}

#[cfg(windows)]
mod imp {
    use windows_sys::Win32::Foundation::RECT;
    use windows_sys::Win32::Graphics::Gdi::{GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST};
    use windows_sys::Win32::UI::WindowsAndMessaging::{GetClassNameW, GetForegroundWindow, GetWindowRect, GetWindowTextW, GetWindowThreadProcessId};

    pub unsafe fn foreground_game(buf: *mut u16, cap: i32) -> i32 {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            return 0;
        }
        let mut rect: RECT = std::mem::zeroed();
        if GetWindowRect(hwnd, &mut rect) == 0 {
            return 0;
        }
        let mut info: MONITORINFO = std::mem::zeroed();
        info.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
        if GetMonitorInfoW(MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST), &mut info) == 0 {
            return 0;
        }
        let mut class = [0u16; 64];
        let len = GetClassNameW(hwnd, class.as_mut_ptr(), class.len() as i32).max(0) as usize;
        let shell = matches!(String::from_utf16_lossy(&class[..len]).as_str(), "Progman" | "WorkerW" | "Shell_TrayWnd");
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, &mut pid);
        let m = info.rcMonitor;
        if !gamecon_core::looks_like_game((rect.left, rect.top, rect.right, rect.bottom), (m.left, m.top, m.right, m.bottom), shell, pid == std::process::id()) {
            return 0;
        }
        if buf.is_null() || cap <= 0 {
            return 0;
        }
        GetWindowTextW(hwnd, buf, cap).max(0)
    }
}

#[cfg(not(windows))]
mod imp {
    pub unsafe fn foreground_game(_buf: *mut u16, _cap: i32) -> i32 {
        0
    }
}
