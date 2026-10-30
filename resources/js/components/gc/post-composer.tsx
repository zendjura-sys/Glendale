import { Link, useForm, usePage } from '@inertiajs/react';
import {
    BarChart3,
    CalendarClock,
    Check,
    ChevronDown,
    Earth,
    FilePen,
    Files,
    ImagePlay,
    Plus,
    ImagePlus,
    EyeOff,
    Lock,
    Megaphone,
    Music2,
    Laugh,
    Smile,
    Sparkles,
    UsersRound,
    X,
    SlidersHorizontal,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MusicCard } from '@/components/music/music-card';
import { MusicPicker } from '@/components/music/music-picker';
import { musicPayload } from '@/components/music/share-track-dialog';
import { api } from '@/lib/api';
import { fitTextarea } from '@/lib/textarea';
import { cn } from '@/lib/utils';
import type { PostItem, TrackCard, Visibility } from '@/types';
import { CommunityAvatar } from './community-avatar';
import { StickerPicker, stickerEmoji } from './stickers';
import { GifPicker } from './gif-picker';
import { PhotoEditor } from './photo-editor';
import type { GifItem } from './gif-picker';
import { UserAvatar } from './user-avatar';
import { tr } from '@/lib/i18n';
import { usePlugin } from '@/lib/plugins';

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
        tags?: string[];
    } | null;
    className?: string;
};

export function PostComposer({
    wall = null,
    community = null,
    className,
}: Props) {
    const { auth, site, modules } = usePage().props;
    const scheduleOn = usePlugin('scheduled_posts');
    const memesOn = usePlugin('meme_maker');
    const [focused, setFocused] = useState(false);
    const [picking, setPicking] = useState(false);
    const [track, setTrack] = useState<TrackCard | null>(null);
    const [card, setCard] = useState<NonNullable<PostItem['card']> | null>(
        null,
    );
    const [cardQuery, setCardQuery] = useState('');
    const [cardHits, setCardHits] = useState<NonNullable<PostItem['card']>[]>(
        [],
    );
    const [pickingCard, setPickingCard] = useState(false);
    const [publishAt, setPublishAt] = useState('');
    const [scheduling, setScheduling] = useState(false);
    const [pickingSticker, setPickingSticker] = useState(false);
    const gifOn = usePlugin('gif_search');
    const photoEditorOn = usePlugin('photo_editor');
    const [editing, setEditing] = useState<number | null>(null);
    const [gif, setGif] = useState<GifItem | null>(null);
    const [pickingGif, setPickingGif] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const storageKey = `gc-composer:${community?.slug ?? wall?.username ?? 'feed'}`;
    const restored = useRef(false);
    const form = useForm<{
        body: string;
        visibility: Visibility;
        wall: string | null;
        community: string | null;
        as_community: boolean;
        images: File[];
        poll: { question: string; options: string[] } | null;
        spoiler: boolean;
        sticker: string | null;
        tag: string;
    }>({
        tag: '',
        body: '',
        spoiler: false,
        sticker: null,
        visibility: 'public',
        wall: wall?.username ?? null,
        community: community?.slug ?? null,
        as_community:
            community?.type === 'public' ||
            (community?.canPostAsCommunity ?? false),
        images: [],
        poll: null,
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
    useEffect(() => {
        if (restored.current) return;
        restored.current = true;
        const saved = window.localStorage.getItem(storageKey);
        if (saved) {
            form.setData('body', saved);
            setFocused(true);
        }
    }, [form, storageKey]);
    useEffect(() => {
        const timer = window.setTimeout(() => {
            if (form.data.body.trim()) {
                window.localStorage.setItem(storageKey, form.data.body);
            } else {
                window.localStorage.removeItem(storageKey);
            }
        }, 300);

        return () => window.clearTimeout(timer);
    }, [form.data.body, storageKey]);

    const expanded =
        focused ||
        form.data.body.length > 0 ||
        form.data.images.length > 0 ||
        track !== null ||
        card !== null ||
        form.data.poll !== null ||
        form.data.sticker !== null;
    const pollReady =
        form.data.poll !== null &&
        form.data.poll.question.trim().length > 0 &&
        form.data.poll.options.filter((option) => option.trim()).length >= 2;
    const canSubmit =
        (form.data.body.trim().length > 0 ||
            form.data.images.length > 0 ||
            track !== null ||
            card !== null ||
            gif !== null ||
            pollReady ||
            form.data.sticker !== null) &&
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

    const submit = (asDraft = false) => {
        if (!canSubmit) return;

        form.transform((data) => {
            const options =
                data.poll?.options
                    .map((option) => option.trim())
                    .filter(Boolean) ?? [];

            return {
                ...data,
                draft: asDraft ? 1 : 0,
                ...(!asDraft && publishAt ? { publish_at: publishAt } : {}),
                poll:
                    data.poll &&
                    data.poll.question.trim() &&
                    options.length >= 2
                        ? { question: data.poll.question.trim(), options }
                        : undefined,
                ...(track ? { music: musicPayload(track) } : {}),
                ...(card ? { card: { kind: card.kind, id: card.id } } : {}),
                ...(gif ? { gif: { url: gif.url, title: gif.title } } : {}),
                ...(data.sticker ? { sticker: data.sticker } : {}),
            };
        });
        form.post('/posts', {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                form.reset(
                    'body',
                    'images',
                    'poll',
                    'spoiler',
                    'sticker',
                    'tag',
                );
                setPickingSticker(false);
                setTrack(null);
                setCard(null);
                setGif(null);
                setPickingGif(false);
                setPickingCard(false);
                setFocused(false);
                setPublishAt('');
                setScheduling(false);
                window.localStorage.removeItem(storageKey);
            },
        });
    };

    const toolTile =
        'flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-center text-[11px] leading-tight text-white/75 focus:bg-white/[0.08] focus:text-white';
    const toolIcon =
        'flex size-10 items-center justify-center rounded-xl bg-white/[0.06]';
    const tools: {
        key: string;
        label: string;
        icon: typeof Earth;
        color: string;
        href?: string;
        active?: boolean;
        disabled?: boolean;
        onSelect?: () => void;
    }[] = [
        {
            key: 'sticker',
            label: tr('Стікер'),
            icon: Smile,
            color: '#ffd27a',
            active: Boolean(form.data.sticker),
            onSelect: () => setPickingSticker(true),
        },
        ...(gifOn
            ? [
                  {
                      key: 'gif',
                      label: 'GIF',
                      icon: ImagePlay,
                      color: '#7ee0b5',
                      active: gif !== null,
                      onSelect: () => setPickingGif(true),
                  },
              ]
            : []),
        {
            key: 'poll',
            label: tr('Опитування'),
            icon: BarChart3,
            color: '#7dffb3',
            active: form.data.poll !== null,
            onSelect: () =>
                form.setData(
                    'poll',
                    form.data.poll ? null : { question: '', options: ['', ''] },
                ),
        },
        ...(modules.includes('music')
            ? [
                  {
                      key: 'music',
                      label: tr('Музика'),
                      icon: Music2,
                      color: '#c58bff',
                      active: track !== null,
                      onSelect: () => setPicking(true),
                  },
              ]
            : []),
        {
            key: 'card',
            label: tr('Картка'),
            icon: Sparkles,
            color: '#ffd27a',
            active: card !== null,
            onSelect: () => setPickingCard(true),
        },
        ...(memesOn && !community
            ? [
                  {
                      key: 'meme',
                      label: tr('Мем'),
                      icon: Laugh,
                      color: '#ff9d7a',
                      href: '/memes/new',
                  },
              ]
            : []),
        {
            key: 'spoiler',
            label: tr('Спойлер'),
            icon: EyeOff,
            color: '#c9d2e3',
            active: form.data.spoiler,
            onSelect: () => form.setData('spoiler', !form.data.spoiler),
        },
        ...(scheduleOn
            ? [
                  {
                      key: 'schedule',
                      label: tr('Розклад'),
                      icon: CalendarClock,
                      color: '#8fb4ff',
                      active: scheduling,
                      onSelect: () => setScheduling(true),
                  },
              ]
            : []),
        {
            key: 'draft',
            label: tr('Чернетка'),
            icon: FilePen,
            color: '#a8b3c7',
            disabled: !canSubmit,
            onSelect: () => submit(true),
        },
        {
            key: 'drafts',
            label: tr('Мої чернетки'),
            icon: Files,
            color: '#a8b3c7',
            href: '/posts/drafts',
        },
    ];
    const extrasCount = [
        form.data.sticker,
        gif,
        form.data.poll,
        track,
        card,
        form.data.spoiler || null,
    ].filter(Boolean).length;
    const currentVisibility =
        visibilityOptions.find(
            (option) => option.value === form.data.visibility,
        ) ?? visibilityOptions[0];

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
                'glass relative overflow-clip rounded-2xl p-4 transition sm:p-5',
                expanded && 'ring-1 ring-primary/25',
                className,
            )}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
                event.preventDefault();
                addFiles(event.dataTransfer.files);
            }}
        >
            <div className="pointer-events-none absolute -top-24 -right-24 size-56 rounded-full bg-gc-indigo/20 blur-3xl" />
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
                                loading="lazy"
                                decoding="async"
                                src={url}
                                alt=""
                                className="size-full object-cover"
                            />
                            {photoEditorOn && (
                                <button
                                    type="button"
                                    onClick={() => setEditing(index)}
                                    className="absolute top-1.5 left-1.5 rounded-full bg-black/60 p-1 text-white opacity-0 backdrop-blur transition group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                                    aria-label={tr('Редагувати фото')}
                                >
                                    <SlidersHorizontal className="size-3.5" />
                                </button>
                            )}
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

            {card && (
                <div className="relative mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <span className="min-w-0 flex-1">
                        <span className="block text-xs text-white/40">
                            {tr(card.hint)}
                        </span>
                        <span className="block truncate text-sm font-medium text-white">
                            {card.title}
                        </span>
                    </span>
                    <button
                        type="button"
                        onClick={() => setCard(null)}
                        aria-label={tr('Прибрати картку')}
                    >
                        <X className="size-4 text-white/50" />
                    </button>
                </div>
            )}
            {pickingCard && !card && (
                <div className="relative mt-3 space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <input
                        value={cardQuery}
                        onChange={(event) => {
                            const value = event.target.value;
                            setCardQuery(value);
                            if (value.trim().length < 2) {
                                setCardHits([]);
                                return;
                            }
                            window.setTimeout(() => {
                                void api<{
                                    cards: NonNullable<PostItem['card']>[];
                                }>(
                                    'GET',
                                    `/cards/search?q=${encodeURIComponent(value.trim())}`,
                                ).then((response) =>
                                    setCardHits(response.cards),
                                );
                            }, 200);
                        }}
                        placeholder={tr('Гра, сервер або подія')}
                        className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
                    />
                    {cardHits.map((hit) => (
                        <button
                            key={`${hit.kind}-${hit.id}`}
                            type="button"
                            onClick={() => {
                                setCard(hit);
                                setPickingCard(false);
                            }}
                            className="block w-full rounded-xl px-2 py-1.5 text-left text-sm text-white hover:bg-white/[0.06]"
                        >
                            <span className="text-xs text-white/40">
                                {tr(hit.hint)}
                            </span>
                            <span className="block truncate">{hit.title}</span>
                        </button>
                    ))}
                </div>
            )}

            {form.data.poll && (
                <div className="relative mt-3 space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <input
                        value={form.data.poll.question}
                        onChange={(event) =>
                            form.setData('poll', {
                                ...form.data.poll!,
                                question: event.target.value,
                            })
                        }
                        placeholder={tr('Питання опитування')}
                        className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
                    />
                    {form.data.poll.options.map((option, index) => (
                        <input
                            key={index}
                            value={option}
                            onChange={(event) => {
                                const options = [...form.data.poll!.options];
                                options[index] = event.target.value;
                                form.setData('poll', {
                                    ...form.data.poll!,
                                    options,
                                });
                            }}
                            placeholder={tr('Варіант {n}', { n: index + 1 })}
                            className="w-full rounded-xl bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none"
                        />
                    ))}
                    {form.data.poll.options.length < 4 && (
                        <button
                            type="button"
                            onClick={() =>
                                form.setData('poll', {
                                    ...form.data.poll!,
                                    options: [...form.data.poll!.options, ''],
                                })
                            }
                            className="text-xs font-medium text-gc-lilac-300"
                        >
                            {tr('Ще варіант')}
                        </button>
                    )}
                </div>
            )}

            {editing !== null && form.data.images[editing] && (
                <PhotoEditor
                    file={form.data.images[editing]}
                    onClose={() => setEditing(null)}
                    onDone={(edited) => {
                        form.setData(
                            'images',
                            form.data.images.map((f, i) =>
                                i === editing ? edited : f,
                            ),
                        );
                        setEditing(null);
                    }}
                />
            )}
            {pickingGif && (
                <GifPicker
                    onPick={(picked) => {
                        setGif(picked);
                        setPickingGif(false);
                    }}
                    onClose={() => setPickingGif(false)}
                />
            )}
            {gif && (
                <div className="relative mt-3 w-fit max-w-full">
                    <img
                        src={gif.url}
                        alt={gif.title}
                        className="max-h-56 rounded-xl"
                    />
                    <button
                        type="button"
                        onClick={() => setGif(null)}
                        aria-label={tr('Прибрати GIF')}
                        className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white backdrop-blur"
                    >
                        <X className="size-3.5" />
                    </button>
                </div>
            )}

            {pickingSticker && (
                <div className="mt-3">
                    <StickerPicker
                        value={form.data.sticker}
                        onChange={(key) => form.setData('sticker', key)}
                    />
                </div>
            )}
            {form.data.sticker && (
                <div className="mt-3 text-5xl leading-none">
                    {stickerEmoji(form.data.sticker)}
                </div>
            )}

            {form.progress && (
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/5">
                    <div
                        className="h-full bg-gradient-brand transition-all"
                        style={{ width: `${form.progress.percentage}%` }}
                    />
                </div>
            )}

            {(form.data.spoiler || scheduling) && (
                <div
                    className={cn(
                        'relative mt-3 flex flex-wrap items-center gap-1.5',
                        !expanded && 'sm:pl-14',
                    )}
                >
                    {form.data.spoiler && (
                        <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/[0.07] pr-1 pl-3 text-xs text-white/80">
                            <EyeOff className="size-3.5" />
                            {tr('Спойлер')}
                            <button
                                type="button"
                                onClick={() => form.setData('spoiler', false)}
                                aria-label={tr('Прибрати')}
                                className="flex size-6 items-center justify-center rounded-full text-white/50 hover:bg-white/10 hover:text-white"
                            >
                                <X className="size-3.5" />
                            </button>
                        </span>
                    )}
                    {scheduling && (
                        <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-gc-indigo/20 pr-1 pl-3 text-xs text-white/85">
                            <CalendarClock className="size-3.5 text-gc-lilac-300" />
                            <input
                                type="datetime-local"
                                value={publishAt}
                                onChange={(event) =>
                                    setPublishAt(event.target.value)
                                }
                                aria-label={tr('Час публікації')}
                                className="w-[10.5rem] min-w-0 bg-transparent text-xs text-white/85 [color-scheme:dark] focus:outline-none"
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    setScheduling(false);
                                    setPublishAt('');
                                }}
                                aria-label={tr('Без розкладу')}
                                className="flex size-6 items-center justify-center rounded-full text-white/50 hover:bg-white/10 hover:text-white"
                            >
                                <X className="size-3.5" />
                            </button>
                        </span>
                    )}
                </div>
            )}

            {community &&
                ((community.type === 'group' && community.canPostAsCommunity) ||
                    (community.tags?.length ?? 0) > 0) && (
                    <div
                        className={cn(
                            'relative mt-3 flex flex-wrap items-center gap-1.5',
                            !expanded && 'sm:pl-14',
                        )}
                    >
                        {community.type === 'group' &&
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
                                            ? 'bg-gc-indigo/20 text-white'
                                            : 'text-white/50 hover:bg-white/[0.06] hover:text-white',
                                    )}
                                >
                                    <Megaphone className="size-4 text-gc-violet-300" />
                                    {tr('Від імені спільноти')}
                                </button>
                            )}
                        {(community.tags?.length ?? 0) > 0 && (
                            <select
                                value={form.data.tag}
                                onChange={(event) =>
                                    form.setData('tag', event.target.value)
                                }
                                aria-label={tr('Мітка запису')}
                                className="h-9 max-w-36 rounded-xl bg-white/[0.04] px-2 text-xs text-white/70"
                            >
                                <option value="">{tr('Без мітки')}</option>
                                {(community.tags ?? []).map((tag) => (
                                    <option key={tag} value={tag}>
                                        #{tag}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                )}

            {/* Одна лінія: фото й «＋» (усі вкладення в меню), праворуч — кому видно і «Пост». */}
            <div
                className={cn(
                    'relative mt-3 flex items-center gap-1',
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
                    title={tr('Фото')}
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-white/65 transition hover:bg-white/[0.06] hover:text-white"
                >
                    <ImagePlus className="size-5 text-[#6fa2ff]" />
                    <span className="sr-only">{tr('Фото')}</span>
                </button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            title={tr('Додати до запису')}
                            className="group inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 text-sm font-medium text-white/80 transition hover:bg-white/[0.1] hover:text-white data-[state=open]:bg-gc-indigo/25 data-[state=open]:text-white"
                        >
                            <Plus className="size-4 transition-transform group-data-[state=open]:rotate-45" />
                            <span className="hidden min-[380px]:inline">
                                {tr('Додати')}
                            </span>
                            {extrasCount > 0 && (
                                <span className="flex size-5 items-center justify-center rounded-full bg-gc-indigo text-[11px] font-semibold text-white tabular-nums">
                                    {extrasCount}
                                </span>
                            )}
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="start"
                        sideOffset={8}
                        className="grid w-[17.5rem] grid-cols-4 gap-1 rounded-2xl p-2"
                    >
                        {tools.map((tool) =>
                            tool.href ? (
                                <DropdownMenuItem
                                    key={tool.key}
                                    asChild
                                    className={toolTile}
                                >
                                    <Link href={tool.href}>
                                        <span
                                            className={toolIcon}
                                            style={{ color: tool.color }}
                                        >
                                            <tool.icon
                                                className="size-5 text-current"
                                                style={{ color: tool.color }}
                                            />
                                        </span>
                                        {tool.label}
                                    </Link>
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem
                                    key={tool.key}
                                    disabled={tool.disabled}
                                    onSelect={tool.onSelect}
                                    className={cn(
                                        toolTile,
                                        tool.active && 'bg-white/[0.08]',
                                    )}
                                >
                                    <span
                                        className={toolIcon}
                                        style={{ color: tool.color }}
                                    >
                                        <tool.icon
                                            className="size-5 text-current"
                                            style={{ color: tool.color }}
                                        />
                                    </span>
                                    {tool.label}
                                </DropdownMenuItem>
                            ),
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="ml-auto flex shrink-0 items-center gap-1">
                    {!wall && !community && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    title={tr('Кому видно')}
                                    className="inline-flex h-10 items-center gap-1 rounded-xl px-2.5 text-white/70 transition hover:bg-white/[0.06] hover:text-white"
                                >
                                    <currentVisibility.icon className="size-4" />
                                    <span className="hidden text-xs sm:inline">
                                        {currentVisibility.label}
                                    </span>
                                    <ChevronDown className="size-3.5 text-white/40" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align="end"
                                sideOffset={8}
                                className="w-48 rounded-2xl p-1.5"
                            >
                                {visibilityOptions.map((option) => (
                                    <DropdownMenuItem
                                        key={option.value}
                                        onSelect={() =>
                                            form.setData(
                                                'visibility',
                                                option.value,
                                            )
                                        }
                                        className="h-10 gap-2.5 rounded-xl px-3"
                                    >
                                        <option.icon className="size-4" />
                                        <span className="flex-1">
                                            {option.label}
                                        </span>
                                        {form.data.visibility ===
                                            option.value && (
                                            <Check className="size-4 text-gc-lilac-300" />
                                        )}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                    <button
                        type="button"
                        onClick={() => submit(false)}
                        disabled={!canSubmit}
                        aria-label={
                            scheduling && publishAt
                                ? tr('Запланувати')
                                : tr('Опублікувати')
                        }
                        className="btn-glow inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:pointer-events-none disabled:opacity-40 sm:px-5"
                    >
                        {scheduling && publishAt ? (
                            <CalendarClock className="size-4" />
                        ) : (
                            <Sparkles className="size-4" />
                        )}
                        <span className="hidden sm:inline">
                            {scheduling && publishAt
                                ? tr('Запланувати')
                                : tr('Опублікувати')}
                        </span>
                        <span className="sm:hidden">{tr('Пост')}</span>
                    </button>
                </div>
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
