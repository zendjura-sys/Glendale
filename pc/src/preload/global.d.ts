import type { GameConApi } from './index';

declare global {
    interface Window {
        gamecon: GameConApi;
    }
}
