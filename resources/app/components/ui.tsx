import { tr } from '../lib/i18n';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { DotSpinner } from './uiverse';

// Теплі фірмові відтінки (золото, бронза, бордо, смарагд) — аватар без фото.
const COLORS = ['#b8862b', '#d9ad52', '#8a5a2b', '#a33b3b', '#2f7d6d', '#4a5a8a', '#c0703a', '#6b4a8a'];

export function Avatar({
  src,
  name,
  id,
  size = 40,
  online,
  square,
}: {
  src: string | null | undefined;
  name: string;
  id: number;
  size?: number;
  online?: boolean;
  square?: boolean;
}) {
  const initials = name
    .split(/\s+/)
    .filter((w) => /^[\p{L}\p{N}]/u.test(w))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  const bg = `linear-gradient(135deg, ${COLORS[id % COLORS.length]}, ${COLORS[(id + 3) % COLORS.length]})`;
  return (
    <div className={`avatar${square ? ' square' : ''}`} style={{ width: size, height: size }}>
      {src ? (
        <img src={src} alt="" loading="lazy" decoding="async" />
      ) : (
        <div className="initials" style={{ background: bg, fontSize: size * 0.38 }}>
          {initials}
        </div>
      )}
      {online && <span className="online-dot" />}
    </div>
  );
}

export const Spinner = ({ small }: { small?: boolean }) => <DotSpinner small={small} />;

export function Empty({ icon, title, children }: { icon?: ReactNode; title?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      {title && <h3>{title}</h3>}
      {children && <div>{children}</div>}
    </div>
  );
}

export function PostSkeleton() {
  return (
    <div className="card post">
      <div className="post-head">
        <div className="skeleton" style={{ width: 40, height: 40, borderRadius: '50%' }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton" style={{ width: 140, height: 12, marginBottom: 6 }} />
          <div className="skeleton" style={{ width: 90, height: 10 }} />
        </div>
      </div>
      <div className="skeleton" style={{ height: 12, marginBottom: 6 }} />
      <div className="skeleton" style={{ height: 12, width: '70%', marginBottom: 12 }} />
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-label={title}>
        <div className="modal-head">
          {title}
          <button className="icon-btn" onClick={onClose} aria-label={tr('Закрыть')}>
            <X size={20} />
          </button>
        </div>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function PhotoViewer({ urls, index, onClose }: { urls: string[]; index: number; onClose: () => void }) {
  const [i, setI] = useState(index);
  const go = (d: number) => setI((x) => (x + d + urls.length) % urls.length);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
  return createPortal(
    <div className="viewer" onClick={onClose}>
      <img src={urls[i]} alt="" onClick={(e) => e.stopPropagation()} />
      <button className="icon-btn close" onClick={onClose} aria-label={tr('Закрыть')}>
        <X size={28} />
      </button>
      {urls.length > 1 && (
        <>
          <button className="icon-btn nav prev" onClick={(e) => (e.stopPropagation(), go(-1))} aria-label={tr('Назад')}>
            <ChevronLeft size={28} />
          </button>
          <button className="icon-btn nav next" onClick={(e) => (e.stopPropagation(), go(1))} aria-label={tr('Вперёд')}>
            <ChevronRight size={28} />
          </button>
          <div className="counter">
            {i + 1} {tr('из')} {urls.length}
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}

/** Textarea that grows with its content. */
export function AutoTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [props.value]);
  return <textarea ref={ref} rows={1} {...props} />;
}

export function PhotoTile({ url, onClick, style }: { url: string; onClick: () => void; style?: CSSProperties }) {
  return (
    <button className="photo-tile" style={style} onClick={onClick}>
      <img src={url} alt="" loading="lazy" decoding="async" />
    </button>
  );
}

export const Aurora = () => (
  <div className="aurora" aria-hidden>
    <i />
    <i />
    <i />
    <i />
  </div>
);

/** Calls `onVisible` whenever the returned sentinel scrolls into view. */
export function useSentinel(onVisible: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onVisible);
  cb.current = onVisible;
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && cb.current(), { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);
  return ref;
}

/** Closes a popup when clicking outside of it. */
export function useClickOutside<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);
  return ref;
}

export function pickFile(accept = 'image/jpeg,image/png,image/gif,image/webp', multiple = false): Promise<File[]> {
  return new Promise((resolve) => {
    // The input must live in the document: detached inputs don't reliably fire `change` (Safari, automation).
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.style.display = 'none';
    document.body.appendChild(input);
    let settled = false;
    const done = (files: File[]) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(files);
    };
    input.addEventListener('change', () => done(Array.from(input.files ?? [])));
    // Some browsers fire `cancel` right before `change`; only treat it as a cancel if no files follow.
    input.addEventListener('cancel', () => setTimeout(() => done(Array.from(input.files ?? [])), 500));
    input.click();
  });
}
