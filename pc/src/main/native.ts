import { createRequire } from 'node:module';
import { join } from 'node:path';
import { app } from 'electron';

export type WindowState = { x: number; y: number; width: number; height: number; alwaysOnTop: boolean; visible: boolean };
export type Rect = { x: number; y: number; width: number; height: number };

/** API нативного ядра (типи NAPI-RS дублюємо, щоб Main не залежав від згенерованого index.d.ts). */
export interface CoreStore {
    readonly mode: string;
    setMode(mode: string): void;
    window(id: string): WindowState | null;
    windows(): Record<string, WindowState>;
    saveWindow(id: string, state: WindowState): void;
    resetWindows(): void;
    get(key: string): unknown;
    set(key: string, value: unknown): void;
}
export interface Core {
    Store: new (dir: string) => CoreStore;
    snap(rect: Rect, areas: Rect[], neighbors: Rect[], threshold: number, gap: number): Rect;
    foregroundGame(ownPid: number): string | null;
}

const require = createRequire(__filename);

/** Нативне ядро Rust: у розробці — з pc/native, у зібраній програмі — з app.asar.unpacked. */
export function loadCore(): Core {
    const base = app.isPackaged ? join(process.resourcesPath, 'app.asar.unpacked', 'native') : join(app.getAppPath(), 'native');
    return require(join(base, 'index.js')) as Core;
}
