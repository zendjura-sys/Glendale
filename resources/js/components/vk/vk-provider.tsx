import '@vkontakte/vkui/dist/vkui.css';
import {
    AdaptivityProvider,
    AppRoot,
    ConfigProvider,
    Platform,
} from '@vkontakte/vkui';
import { useEffect } from 'react';
import { useSiteTheme } from '@/hooks/use-site-theme';
import type { PropsWithChildren } from 'react';

/**
 * Дизайн-система VKUI (MIT, github.com/VKCOM/VKUI): вигляд vk.com на комп'ютері, мобільний VK на телефоні.
 * Режим partial — стилі VKUI діють лише на його компоненти й токени, решта сайту (Tailwind) працює як була.
 */
export function VkProvider({ children }: PropsWithChildren) {
    const theme = useSiteTheme();

    // Токени vk.com — на <html>: їх бачать і вміст сторінки, і спливаючі вікна в порталах.
    useEffect(() => {
        const root = document.documentElement.classList;
        root.remove('vkui--vkCom--light', 'vkui--vkCom--dark');
        root.add(`vkui--vkCom--${theme}`, 'gc-vk');
    }, [theme]);

    return (
        <ConfigProvider
            colorScheme={theme}
            platform={Platform.VKCOM}
            locale="uk"
        >
            <AdaptivityProvider>
                <AppRoot mode="partial" userSelectMode="enabled">
                    {children}
                </AppRoot>
            </AdaptivityProvider>
        </ConfigProvider>
    );
}
