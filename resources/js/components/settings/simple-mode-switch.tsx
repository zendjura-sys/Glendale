import { usePage } from '@inertiajs/react';
import { Accessibility } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { SettingsSwitch } from '@/layouts/settings/layout';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';

/** Режим «Простий» (№280): крупніший текст і кнопки, підписи під іконками, без анімацій. */
export function SimpleModeSwitch() {
    const saved = usePage().props.auth.user?.simple_ui === true;
    const [on, setOn] = useState(saved);

    return (
        <SettingsSwitch
            icon={<Accessibility />}
            label={tr('Простий режим')}
            hint={tr(
                'Крупніший текст і кнопки, підписи під іконками, без анімацій',
            )}
            checked={on}
            onChange={(next) => {
                setOn(next);
                document.documentElement.classList.toggle('gc-simple', next);
                api('PUT', '/settings/simple-ui', { simple: next }).catch(
                    () => {
                        setOn(!next);
                        document.documentElement.classList.toggle(
                            'gc-simple',
                            !next,
                        );
                        toast.error(tr('Не вдалося зберегти.'));
                    },
                );
            }}
        />
    );
}
