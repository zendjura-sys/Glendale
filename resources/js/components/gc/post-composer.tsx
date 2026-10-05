import { useForm, usePage } from '@inertiajs/react';
import {
    Earth,
    ImagePlus,
    Lock,
    Megaphone,
    Music2,
    Sparkles,
    UsersRound,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MusicCard } from '@/components/music/music-card';
import { MusicPicker } from '@/components/music/music-picker';
import { musicPayload } from '@/components/music/share-track-dialog';
import { fitTextarea } from '@/lib/textarea';
import { cn } from '@/lib/utils';
import type { TrackCard, Visibility } from '@/types';
import { CommunityAvatar } from './community-avatar';
import { UserAvatar } from './user-avatar';
import { tr } from '@/lib/i18n';

const visibilityOptions: {
    value: Visibility;
    label: string;
    icon: typeof Earth;
}[] = [
    { value: 'public', label: tr('Усім'), icon: Earth },
    { value: 'friends', label: tr('Друзям'), icon: UsersRound },
    { value: 'private', label: tr('Тільки мені'), icon: Lock },
];

type Props = {
    wall?: { username: string; first_name: string } | null;
    community?: {
        id: number;
        slug: string;
        name: string;
        avatar_url: string | null;
        type: 'group' | 'public';
        canPostAsCommunity: boolean;
    } | null;
    className?: string;
};

export function PostComposer({
    wall = null,
    community = null,
    className,
}: Props) {
    const { auth, site, modules } = usePage().props;
    const [focused, setFocused] = useState(false);
    const [picking, setPicking] = useState(false);
    const [track, setTrack] = useState<TrackCard | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const form = useForm<{
        body: string;
        visibility: Visibility;
        wall: string | null;
        community: string | null;
        as_community: boolean;
        images: File[];
    }>({
        body: '',
        visibility: 'public',
        wall: wall?.username ?? null,
        community: community?.slug ?? null,
        as_community:
            community?.type === 'public' ||
            (community?.canPostAsCommunity ?? false),
        images: [],
    });
    const asCommunity = !!community && form.data.as_community;

    const previews = useMemo(
        () => form.data.images.map((file) => URL.createObjectURL(file)),
        [form.data.images],
    );
    useEffect(
        () => () => previews.forEach((url) => URL.revokeObjectURL(url)),
        [previews],
    );

    const expanded =
        focused ||
        form.data.body.length > 0 ||
        form.data.images.length > 0 ||
        track !== null;
    const canSubmit =
        (form.data.body.trim().length > 0 ||
            form.data.images.length > 0 ||
            track !== null) &&
        !form.processing;

    const addFiles = (files: FileList | null) => {
        if (!files) return;
        const images = Array.from(files).filter((file) =>
            file.type.startsWith('image/'),
        );
        form.setData(
            'images',
            [...form.data.images, ...images].slice(0, site.max_attachments),
        );
    };

    const submit = () => {
        if (!canSubmit) return;

        form.transform((data) => ({
            ...data,
            ...(track ? { music: musicPayload(track) } : {}),
        }));
        form.post('/posts', {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                form.reset('body', 'images');
                setTrack(null);
                setFocused(false);
            },
        });
    };

    const placeholder = community
        ? asCommunity
            ? tr('Новина від імені «{name}»…', { name: community.name })
            : tr('Напишіть щось у спільноті…')
        : wall
          ? tr('Напишіть щось {first_name}…', { first_name: wall.first_name })
          : tr('Що нового, {first_name}?', {
                first_name: auth.user.first_name,
            });

    return (
        <section
            className={cn(
                'glass relative overflow-clip rounded-3xl p-4 transition sm:p-5',
                expanded &&
                    'border-[#7c8cff]/30 shadow-[0_0_0_1px_rgb(124_140_255/0.15),0_30px_60px_-30px_rgb(109_93_252/0.6)]',
                className,
            )}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
                event.preventDefault();
                addFiles(event.dataTransfer.files);
            }}
        >
            <div className="pointer-events-none absolute -top-24 -right-24 size-56 rounded-full bg-[#6d5dfc]/20 blur-3xl" />
            <div className="relative flex gap-3">
                {asCommunity && community ? (
                    <CommunityAvatar community={community} size="md" />
                ) : (
                    <UserAvatar user={auth.user} size="md" showOnline={false} />
                )}
                <div className="min-w-0 flex-1">
                    <textarea
                        value={form.data.body}
                        onChange={(event) => {
                            form.setData('body', event.target.value);
                            fitTextarea(event.target, 420);
                        }}
                        onFocus={() => setFocused(true)}
                        onKeyDown={(event) => {
                            if (
                                event.key === 'Enter' &&
                                (event.metaKey || event.ctrlKey)
                            )
                                submit();
                        }}
                        rows={expanded ? 3 : 1}
                        placeholder={placeholder}
                        className="[field-sizing:content] max-h-[420px] w-full resize-none bg-transparent pt-2.5 text-[15px] leading-relaxed text-white placeholder:text-white/40 focus:outline-none"
                    />
                    {form.errors.body && (
                        <p className="mt-1 text-xs text-rose-300">
                            {form.errors.body}
                        </p>
                    )}
                    {Object.entries(form.errors)
                        .filter(([key]) => key.startsWith('images'))
                        .slice(0, 1)
                        .map(([key, message]) => (
                            <p key={key} className="mt-1 text-xs text-rose-300">
                                {message}
                            </p>
                        ))}
                </div>
            </div>

            {previews.length > 0 && (
                <div className="relative mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {previews.map((url, index) => (
                        <div
                            key={url}
                            className="group relative aspect-square animate-rise overflow-hidden rounded-xl bg-white/5"
                        >
                            <img
                                src={url}
                                alt=""
                                className="size-full object-cover"
                            />
                            <button
                                type="button"
                                onClick={() =>
                                    form.setData(
                                        'images',
                                        form.data.images.filter(
                                            (_, i) => i !== index,
                                        ),
                                    )
                                }
                                className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white opacity-0 backdrop-blur transition group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                                aria-label={tr('Прибрати фото')}
                            >
                                <X className="size-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {track && (
                <div className="relative mt-3 flex items-center gap-2">
                    <MusicCard track={track} compact className="flex-1" />
                    <button
                        type="button"
                        onClick={() => setTrack(null)}
                        className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
                        aria-label={tr('Прибрати трек')}
                    >
                        <X className="size-4" />
                    </button>
                </div>
            )}
            {Object.entries(form.errors)
                .filter(([key]) => key.startsWith('music'))
                .slice(0, 1)
                .map(([key, message]) => (
                    <p key={key} className="mt-1 text-xs text-rose-300">
                        {message}
                    </p>
                ))}

            {form.progress && (
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/5">
                    <div
                        className="h-full bg-gradient-brand transition-all"
                        style={{ width: `${form.progress.percentage}%` }}
                    />
                </div>
            )}

            <div
                className={cn(
                    'relative mt-3 flex items-center gap-1.5',
                    !expanded && 'sm:pl-14',
                )}
            >
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(event) => addFiles(event.target.files)}
                />
                <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex h-9 items-center gap-2 rounded-xl px-2.5 text-sm font-medium text-white/65 transition hover:bg-white/[0.06] hover:text-white sm:px-3"
                >
                    <ImagePlus className="size-[18px] text-[#6fa2ff]" />
                    <span className="hidden sm:inline">{tr('Фото')}</span>
                </button>
                {modules.includes('music') && (
                    <button
                        type="button"
                        onClick={() => setPicking(true)}
                        className="inline-flex h-9 items-center gap-2 rounded-xl px-2.5 text-sm font-medium text-white/65 transition hover:bg-white/[0.06] hover:text-white sm:px-3"
                    >
                        <Music2 className="size-[18px] text-[#c58bff]" />
                        <span className="hidden sm:inline">{tr('Музика')}</span>
                    </button>
                )}

                {community &&
                    community.type === 'group' &&
                    community.canPostAsCommunity && (
                        <button
                            type="button"
                            onClick={() =>
                                form.setData(
                                    'as_community',
                                    !form.data.as_community,
                                )
                            }
                            className={cn(
                                'inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-medium transition',
                                form.data.as_community
                                    ? 'bg-[#6d5dfc]/20 text-white'
                                    : 'text-white/50 hover:bg-white/[0.06] hover:text-white',
                            )}
                        >
                            <Megaphone className="size-4 text-[#a58bff]" />
                            {tr('Від імені спільноти')}
                        </button>
                    )}

                {!wall && !community && (
                    <div className="flex rounded-xl bg-white/[0.04] p-0.5">
                        {visibilityOptions.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() =>
                                    form.setData('visibility', option.value)
                                }
                                title={option.label}
                                className={cn(
                                    'inline-flex h-8 items-center gap-1.5 rounded-[10px] px-2.5 text-xs font-medium transition',
                                    form.data.visibility === option.value
                                        ? 'bg-white/10 text-white'
                                        : 'text-white/45 hover:text-white/80',
                                )}
                            >
                                <option.icon className="size-3.5" />
                                <span
                                    className={cn(
                                        'whitespace-nowrap',
                                        form.data.visibility === option.value
                                            ? 'hidden md:inline'
                                            : 'hidden',
                                    )}
                                >
                                    {option.label}
                                </span>
                            </button>
                        ))}
                    </div>
                )}

                <button
                    type="button"
                    onClick={submit}
                    disabled={!canSubmit}
                    aria-label={tr('Опублікувати')}
                    className="btn-glow ml-auto inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold disabled:pointer-events-none disabled:opacity-40 sm:px-5"
                >
                    <Sparkles className="size-4" />
                    <span className="hidden min-[440px]:inline">
                        {tr('Опублікувати')}
                    </span>
                    <span className="min-[440px]:hidden">{tr('Пост')}</span>
                </button>
            </div>

            {modules.includes('music') && (
                <MusicPicker
                    open={picking}
                    onOpenChange={setPicking}
                    onPick={(picked) => {
                        setTrack(picked);
                        setFocused(true);
                    }}
                />
            )}
        </section>
    );
}
