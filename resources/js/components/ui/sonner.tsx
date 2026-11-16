import { useFlashToast } from '@/hooks/use-flash-toast';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

function Toaster({ ...props }: ToasterProps) {
    useFlashToast();

    return (
        <Sonner
            theme="dark"
            className="toaster group"
            position="bottom-right"
            style={
                {
                    '--normal-bg': 'rgb(14 18 38 / 0.92)',
                    '--normal-text': 'var(--popover-foreground)',
                    '--normal-border': 'rgb(255 255 255 / 0.09)',
                } as React.CSSProperties
            }
            {...props}
        />
    );
}

export { Toaster };
