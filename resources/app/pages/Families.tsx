import { tr } from '../lib/i18n';
import { Composer } from '../components/Composer';
import { PostList } from '../components/Post';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BadgeCheck,
  Camera,
  Check,
  CircleX,
  Clock,
  Crown,
  Handshake,
  ImagePlus,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
  UserMinus,
  X,
} from 'lucide-react';
import { api, form } from '../lib/api';
import { useAuth, useMe } from '../lib/auth';
import type { Family, FamilyFull, FamilyMember, FamilyRequest, FamilyStatus, GameProject, Me } from '../lib/types';
import { countLabel, formatDate, fullName } from '../lib/utils';
import { Avatar, Empty, Modal, Spinner, pickFile } from '../components/ui';

/*
 * Система управління родинами (публічно — «Моя родина»). Один сайт для
 * всіх RP-проєктів і серверів: проєкт і сервер — лише поля родини.
 * Нова родина чекає перевірки адміністрацією (адмінка → Родини та союзи).
 */

export function StatusBadge({ status }: { status: FamilyStatus }) {
  if (status === 'verified')
    return (
      <span className="family-badge verified" title={tr('Родину перевірено адміністрацією')}>
        <BadgeCheck size={14} /> {tr('Верифіковано')}
      </span>
    );
  if (status === 'rejected')
    return (
      <span className="family-badge rejected">
        <CircleX size={14} /> {tr('Відхилено')}
      </span>
    );
  return (
    <span className="family-badge pending">
      <Clock size={14} /> {tr('На перевірці')}
    </span>
  );
}

export const familyTitle = (f: { name: string; tag: string | null }) => (f.tag ? `[${f.tag}] ${f.name}` : f.name);

const refreshMe = async (setUser: (u: Me) => void) => {
  try {
    const r = await api<{ user: Me }>('/me');
    setUser(r.user);
  } catch {
    /* меню оновиться при наступному завантаженні */
  }
};


/** Вибране місце: id зі списку або своя назва (нова позиція довідника). */
export interface Place {
  projectId: number | null;
  project: string;
  serverId: number | null;
  server: string;
  /** Логотип нового проєкту (лише для «Інший»). */
  projectLogo?: File | null;
}

/** Сервер вручну: номер 1–999 або назва літерами (як перевіряє сервер). */
const SERVER_RE = /^(?:[1-9]\d{0,2}|[A-Za-zА-Яа-яЁёЇїІіЄєҐґ]+(?:[ '’-][A-Za-zА-Яа-яЁёЇїІіЄєҐґ]+)*)$/u;
export const serverValid = (s: string) => SERVER_RE.test(s.trim());

/** Фільтр під час введення: з цифри — лише номер до 999, з літери — лише літери (кирилиця й латиниця). */
function cleanServer(raw: string) {
  const v = raw.trimStart();
  if (/^\d/.test(v)) return v.replace(/\D/g, '').replace(/^0+/, '').slice(0, 3);
  return v.replace(/[^A-Za-zА-Яа-яЁёЇїІіЄєҐґ '’-]/gu, '').replace(/^[ '’-]+/, '').replace(/([ '’-])[ '’-]+/g, '$1').slice(0, 40);
}

const placeReady = (p: Place) => (p.projectId !== null || !!p.project.trim()) && (p.serverId !== null || serverValid(p.server));

const placeBody = (p: Place) => ({
  projectId: p.projectId !== null ? String(p.projectId) : undefined,
  project: p.projectId === null ? p.project.trim() : undefined,
  serverId: p.serverId !== null ? String(p.serverId) : undefined,
  server: p.serverId === null ? p.server.trim() : undefined,
  projectLogo: p.projectId === null ? (p.projectLogo ?? undefined) : undefined,
});

export function useProjects() {
  return useQuery({ queryKey: ['families', 'projects'], queryFn: () => api<GameProject[]>('/families/projects') });
}

/** Ілюстрація проєкту: логотип із довідника або фірмова заглушка з ініціалами. */
export function ProjectLogo({ project, size = 44 }: { project: { id: number; name: string; logo: string | null }; size?: number }) {
  return project.logo ? (
    <img className="project-logo" src={project.logo} alt="" style={{ width: size, height: size }} />
  ) : (
    <span className="project-logo blank" style={{ width: size, height: size, fontSize: size * 0.34 }}>
      {project.name.replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
    </span>
  );
}

/** Понад стільки серверів (діапазони 1–999) — вибір через пошук, а не всі кнопки одразу. */
const MANY_SERVERS = 24;

function visibleServers(servers: GameProject['servers'], query: string, selected: number | null) {
  if (servers.length <= MANY_SERVERS) return servers;
  const q = query.trim().toLowerCase();
  const num = /^\d+$/.test(q) ? q : null;
  const hits = q
    ? servers.filter((s) => (num ? (s.name.match(/\d+/)?.[0] ?? '') === num || s.name.toLowerCase() === q : s.name.toLowerCase().includes(q)))
    : servers;
  const list = hits.slice(0, MANY_SERVERS);
  const sel = servers.find((s) => s.id === selected);
  return sel && !list.includes(sel) ? [sel, ...list] : list;
}

/** Проєкт і сервер — з довідника з ілюстраціями, з можливістю вписати свій. */
function PlacePicker({ value, onChange }: { value: Place; onChange: (p: Place) => void }) {
  const { data: projects } = useProjects();
  const project = projects?.find((p) => p.id === value.projectId);
  const customProject = value.projectId === null && value.project !== '';
  const customServer = value.serverId === null && value.server !== '';
  const [serverQuery, setServerQuery] = useState('');
  return (
    <>
      <div className="form-row">
        <label className="label">{tr('Проєкт')}</label>
        <div className="project-grid">
          {projects?.map((p) => (
            <button
              type="button"
              key={p.id}
              className={`project-card${value.projectId === p.id ? ' on' : ''}`}
              onClick={() => onChange({ projectId: p.id, project: '', serverId: null, server: '' })}
            >
              <ProjectLogo project={p} />
              <span className="ellipsis">{p.name}</span>
            </button>
          ))}
          <button
            type="button"
            className={`project-card${customProject ? ' on' : ''}`}
            onClick={() => onChange({ projectId: null, project: ' ', serverId: null, server: '' })}
          >
            <span className="project-logo blank" style={{ width: 44, height: 44 }}>
              <Plus size={20} />
            </span>
            <span>{tr('Інший')}</span>
          </button>
        </div>
        {customProject && (
          <div className="project-new">
            <button
              type="button"
              className="project-new-logo"
              title={tr('Логотип проєкту')}
              onClick={async () => onChange({ ...value, projectLogo: (await pickFile())[0] ?? value.projectLogo })}
            >
              {value.projectLogo ? <img src={URL.createObjectURL(value.projectLogo)} alt="" /> : <ImagePlus size={18} />}
            </button>
            <input
              className="field"
              autoFocus
              maxLength={60}
              placeholder={tr('Назва проєкту')}
              value={value.project.trimStart()}
              onChange={(e) => onChange({ ...value, project: e.target.value || ' ' })}
            />
          </div>
        )}
      </div>
      {(project || customProject) && (
        <div className="form-row">
          <label className="label">{tr('Сервер')}</label>
          {project && project.servers.length > MANY_SERVERS && !customServer && (
            <input
              className="field"
              style={{ marginBottom: 8 }}
              placeholder={tr('Пошук сервера: номер або назва')}
              value={serverQuery}
              onChange={(e) => setServerQuery(e.target.value)}
            />
          )}
          {!!project?.servers.length && (
            <div className="chips" style={{ padding: 0, marginBottom: customServer ? 8 : 0 }}>
              {visibleServers(project.servers, serverQuery, value.serverId).map((sv) => (
                <button type="button" key={sv.id} className={`chip${value.serverId === sv.id ? ' on' : ''}`} onClick={() => onChange({ ...value, serverId: sv.id, server: '' })}>
                  {sv.name}
                  {sv.players != null && <span className="chip-online">{sv.players}</span>}
                </button>
              ))}
              <button type="button" className={`chip${customServer ? ' on' : ''}`} onClick={() => onChange({ ...value, serverId: null, server: ' ' })}>
                <Plus size={13} /> {tr('Інший')}
              </button>
            </div>
          )}
          {(!project?.servers.length || customServer) && (
            <>
              <input
                className="field"
                maxLength={40}
                placeholder={tr('Номер 1–999 або назва літерами')}
                value={value.server.trimStart()}
                onChange={(e) => onChange({ ...value, serverId: null, server: cleanServer(e.target.value) || ' ' })}
              />
              <p className={`field-hint${value.server.trim() && !serverValid(value.server) ? ' bad' : ''}`}>
                {tr('Лише номер від 1 до 999 або назва літерами (А–Я, а–я, A–Z, a–z).')}
              </p>
            </>
          )}
        </div>
      )}
    </>
  );
}

function RegisterFamilyModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [f, setF] = useState({ name: '', tag: '', description: '', discordUrl: '', telegramUrl: '' });
  const [place, setPlace] = useState<Place>({ projectId: null, project: '', serverId: null, server: '' });
  const [proof, setProof] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const created = await api<FamilyFull>('/families', { body: form({ ...f, ...placeBody(place), proof }) });
      await refreshMe(setUser);
      navigate(`/families/${created.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={tr('Реєстрація родини')}
      onClose={onClose}
      footer={
        <button className="btn" onClick={submit} disabled={busy || !f.name.trim() || !placeReady(place) || !proof}>
          {tr('Надіслати на перевірку')}
        </button>
      }
    >
      <div className="modal-body">
        <p className="muted" style={{ marginBottom: 12 }}>
          {tr('Після перевірки адміністрацією родина з’явиться в каталозі, а гравці зможуть подавати заявки на вступ.')}
        </p>
        <div className="form-grid">
          <div className="form-row">
            <label className="label">{tr('Назва родини')}</label>
            <input className="field" autoFocus value={f.name} maxLength={60} onChange={set('name')} />
          </div>
          <div className="form-row">
            <label className="label">{tr('Тег')}</label>
            <input className="field" value={f.tag} maxLength={8} placeholder="MNS" onChange={set('tag')} />
          </div>
        </div>
        <PlacePicker value={place} onChange={setPlace} />
        <div className="form-row">
          <label className="label">{tr('Про родину')}</label>
          <textarea className="field" value={f.description} maxLength={3000} onChange={set('description')} />
        </div>
        <div className="form-grid">
          <div className="form-row">
            <label className="label">Discord</label>
            <input className="field" type="url" value={f.discordUrl} placeholder="https://discord.gg/…" onChange={set('discordUrl')} />
          </div>
          <div className="form-row">
            <label className="label">Telegram</label>
            <input className="field" type="url" value={f.telegramUrl} placeholder="https://t.me/…" onChange={set('telegramUrl')} />
          </div>
        </div>
        <div className="form-row">
          <label className="label">{tr('Доказ для перевірки')}</label>
          <button type="button" className="btn secondary block" onClick={async () => setProof((await pickFile())[0] ?? proof)}>
            <ImagePlus size={16} /> {proof ? proof.name : tr('Скріншот родини з гри')}
          </button>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            {tr('Наприклад, меню родини в грі, де видно назву й вашу посаду. Бачать лише ви й адміністрація.')}
          </div>
        </div>
        {error && <div className="error-text">{error}</div>}
      </div>
    </Modal>
  );
}

export function FamilyRow({ f }: { f: Family }) {
  return (
    <div className="row">
      <Link to={`/families/${f.id}`}>
        <Avatar src={f.avatar} name={f.name} id={f.id + 300} square size={60} />
      </Link>
      <div className="info">
        <Link to={`/families/${f.id}`} className="name" style={{ fontSize: 14 }}>
          {familyTitle(f)}
        </Link>
        {f.status !== 'verified' ? <StatusBadge status={f.status} /> : <BadgeCheck size={14} className="family-check" aria-label={tr('Верифіковано')} />}
        <div className="meta">
          {[f.project, f.server].filter(Boolean).join(' · ')} · {countLabel(f.membersCount, tr('учасник|учасники|учасників'))}
        </div>
        {f.description && <div className="ellipsis muted">{f.description}</div>}
      </div>
    </div>
  );
}

export default function FamiliesPage() {
  const me = useMe();
  const [query, setQuery] = useState('');
  const [projectId, setProjectId] = useState(0);
  const [registering, setRegistering] = useState(false);
  const { data: mine } = useQuery({ queryKey: ['families', 'mine'], queryFn: () => api<Family[]>('/families/mine') });
  const { data: projects } = useProjects();
  const { data: list, isLoading } = useQuery({
    queryKey: ['families', 'catalog', query.trim(), projectId],
    queryFn: () => api<Family[]>(`/families?q=${encodeURIComponent(query.trim())}&projectId=${projectId}`),
  });

  return (
    <div className="col-main">
      {!!mine?.length && (
        <div className="card">
          <div className="card-title">{tr('Мої родини')}</div>
          {mine.map((f) => (
            <FamilyRow key={f.id} f={f} />
          ))}
        </div>
      )}
      <div className="card">
        <div className="tabs" style={{ alignItems: 'center' }}>
          <span className="tab active">
            <Crown size={16} /> {tr('Родини')}
          </span>
          <Link to="/unions" className="tab">
            <Handshake size={16} /> {tr('Союзи')}
          </Link>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={() => setRegistering(true)}>
            <Plus size={16} /> {tr('Зареєструвати родину')}
          </button>
        </div>
        <div style={{ padding: '12px 20px 4px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 32, top: 22, color: 'var(--icon)' }} />
          <input className="field" style={{ paddingLeft: 36 }} placeholder={tr('Пошук родини, тегу чи сервера')} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {!!projects?.length && (
          <div className="project-strip">
            <button className={`project-card${projectId === 0 ? ' on' : ''}`} onClick={() => setProjectId(0)}>
              <span className="project-logo blank" style={{ width: 44, height: 44 }}>
                <Crown size={20} />
              </span>
              <span>{tr('Усі проєкти')}</span>
            </button>
            {projects
              .filter((p) => p.approved)
              .map((p) => (
                <button key={p.id} className={`project-card${projectId === p.id ? ' on' : ''}`} onClick={() => setProjectId(p.id)}>
                  <ProjectLogo project={p} />
                  <span className="ellipsis">{p.name}</span>
                  <span className="n">{countLabel(p.families, tr('родина|родини|родин'))}</span>
                </button>
              ))}
          </div>
        )}
        {isLoading && <Spinner />}
        {!isLoading && !list?.length && (
          <Empty icon={<Crown size={48} />} title={tr('Родин не знайдено')}>
            {tr('Зареєструйте свою — після перевірки вона з’явиться тут.')}
          </Empty>
        )}
        {list?.map((f) => (
          <FamilyRow key={f.id} f={f} />
        ))}
      </div>
      {registering && <RegisterFamilyModal onClose={() => setRegistering(false)} />}
      {me.canManageFamilies && (
        <a className="card more-link" style={{ padding: 14, textAlign: 'center' }} href="/admin/families">
          <Shield size={15} /> {tr('Перевірка родин і союзів — в адмінці')}
        </a>
      )}
    </div>
  );
}

function EditFamilyModal({ family, onClose, onSaved }: { family: FamilyFull; onClose: () => void; onSaved: (f: FamilyFull) => void }) {
  const locked = family.status === 'verified';
  const [place, setPlace] = useState<Place>({ projectId: family.projectId, project: family.projectId ? '' : family.project, serverId: family.serverId, server: family.serverId ? '' : family.server });
  const [f, setF] = useState({
    name: family.name,
    tag: family.tag ?? '',
    description: family.description,
    discordUrl: family.discordUrl ?? '',
    telegramUrl: family.telegramUrl ?? '',
  });
  const [error, setError] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    try {
      const body: Record<string, string | File | null | undefined> = {
        tag: f.tag || null,
        description: f.description,
        discordUrl: f.discordUrl || null,
        telegramUrl: f.telegramUrl || null,
      };
      if (!locked) Object.assign(body, { name: f.name, ...placeBody(place) });
      // Файл (логотип нового проєкту) — лише multipart: POST з _method=PATCH.
      const res = body.projectLogo
        ? await api<FamilyFull>(`/families/${family.id}`, { body: form({ ...body, _method: 'PATCH' }) })
        : await api<FamilyFull>(`/families/${family.id}`, { method: 'PATCH', body });
      onSaved(res);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Modal title={tr('Редагувати родину')} onClose={onClose} footer={<button className="btn" onClick={save}>{tr('Зберегти')}</button>}>
      <div className="modal-body">
        {locked && <p className="muted" style={{ marginBottom: 12 }}>{tr('Назву, проєкт і сервер верифікованої родини змінює адміністрація.')}</p>}
        <div className="form-grid">
          <div className="form-row">
            <label className="label">{tr('Назва родини')}</label>
            <input className="field" value={f.name} disabled={locked} onChange={set('name')} />
          </div>
          <div className="form-row">
            <label className="label">{tr('Тег')}</label>
            <input className="field" value={f.tag} maxLength={8} onChange={set('tag')} />
          </div>
        </div>
        {locked ? (
          <p className="muted" style={{ marginBottom: 12 }}>
            {[family.project, family.server].filter(Boolean).join(' · ')}
          </p>
        ) : (
          <PlacePicker value={place} onChange={setPlace} />
        )}
        <div className="form-row">
          <label className="label">{tr('Про родину')}</label>
          <textarea className="field" value={f.description} maxLength={3000} onChange={set('description')} />
        </div>
        <div className="form-grid">
          <div className="form-row">
            <label className="label">Discord</label>
            <input className="field" type="url" value={f.discordUrl} onChange={set('discordUrl')} />
          </div>
          <div className="form-row">
            <label className="label">Telegram</label>
            <input className="field" type="url" value={f.telegramUrl} onChange={set('telegramUrl')} />
          </div>
        </div>
        {error && <div className="error-text">{error}</div>}
      </div>
    </Modal>
  );
}

function Requests({ family }: { family: FamilyFull }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['family', family.id, 'requests'], queryFn: () => api<FamilyRequest[]>(`/families/${family.id}/requests`) });
  const decide = async (userId: number, ok: boolean) => {
    try {
      await api(`/families/${family.id}/requests/${userId}`, { method: ok ? 'POST' : 'DELETE' });
    } catch (e) {
      alert((e as Error).message);
    }
    qc.invalidateQueries({ queryKey: ['family', family.id] });
  };
  if (!data?.length) return null;
  return (
    <div className="card">
      <div className="card-title">
        {tr('Заявки на вступ')} <span className="count">{data.length}</span>
      </div>
      {data.map((r) => (
        <div key={r.id} className="row">
          <Link to={`/id/${r.id}`}>
            <Avatar src={r.avatar} name={fullName(r)} id={r.id} size={44} />
          </Link>
          <div className="info">
            <Link to={`/id/${r.id}`} className="name">
              {fullName(r)}
            </Link>
            {r.message && <div className="muted">«{r.message}»</div>}
            <div className="meta">{formatDate(r.requestedAt)}</div>
          </div>
          <div className="actions" style={{ display: 'flex', gap: 6 }}>
            <button className="btn" onClick={() => decide(r.id, true)}>
              <Check size={16} /> {tr('Прийняти')}
            </button>
            <button className="icon-btn" onClick={() => decide(r.id, false)} aria-label={tr('Відхилити')}>
              <X size={20} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Members({ family }: { family: FamilyFull }) {
  const me = useMe();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['family', family.id, 'members'], queryFn: () => api<FamilyMember[]>(`/families/${family.id}/members`) });
  const act = async (path: string, method: string, body?: unknown, question?: string) => {
    if (question && !confirm(question)) return;
    try {
      await api(`/families/${family.id}/members/${path}`, { method, body });
    } catch (e) {
      alert((e as Error).message);
    }
    qc.invalidateQueries({ queryKey: ['family', family.id] });
  };
  return (
    <div className="card">
      <div className="card-title">
        {tr('Склад родини')} <span className="count">{data?.length ?? family.membersCount}</span>
      </div>
      {isLoading && <Spinner />}
      {data?.map((m) => (
        <div key={m.id} className="row">
          <Link to={`/id/${m.id}`}>
            <Avatar src={m.avatar} name={fullName(m)} id={m.id} size={44} online={m.online} />
          </Link>
          <div className="info">
            <Link to={`/id/${m.id}`} className="name">
              {fullName(m)}
            </Link>
            <div className={`family-role ${m.role}`}>{m.roleLabel}</div>
          </div>
          {m.id !== me.id && m.role !== 'leader' && (
            <div className="actions" style={{ display: 'flex', gap: 4 }}>
              {family.isLeader && (
                <>
                  <button
                    className={`icon-btn${m.role === 'deputy' ? ' on' : ''}`}
                    title={m.role === 'deputy' ? tr('Зняти заступника') : tr('Зробити заступником')}
                    onClick={() => act(String(m.id), 'PATCH', { role: m.role === 'deputy' ? 'member' : 'deputy' })}
                  >
                    <Shield size={18} />
                  </button>
                  <button
                    className="icon-btn"
                    title={tr('Передати лідерство')}
                    onClick={() => act(String(m.id), 'PATCH', { role: 'leader' }, tr('Передати лідерство «{name}»? Ви станете заступником.', { name: fullName(m) }))}
                  >
                    <Crown size={18} />
                  </button>
                </>
              )}
              {family.canManage && (family.isLeader || m.role === 'member') && (
                <button className="icon-btn" title={tr('Виключити')} onClick={() => act(String(m.id), 'DELETE', undefined, tr('Виключити {name} з родини?', { name: fullName(m) }))}>
                  <UserMinus size={18} />
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function FamilyPage() {
  const { id } = useParams();
  const familyId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { setUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data: f, isLoading, error } = useQuery({ queryKey: ['family', familyId], queryFn: () => api<FamilyFull>(`/families/${familyId}`) });

  if (isLoading) return <Spinner />;
  if (error || !f)
    return (
      <div className="col-main">
        <div className="card">
          <Empty icon={<Crown size={48} />} title={tr('Родину не знайдено')} />
        </div>
      </div>
    );

  const update = (next: FamilyFull) => qc.setQueryData(['family', familyId], next);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const upload = (kind: 'avatar' | 'cover' | 'proof') =>
    run(async () => {
      const [file] = await pickFile();
      if (file) update(await api<FamilyFull>(`/families/${f.id}/${kind}`, { body: form({ image: file }) }));
      return;
    });
  const join = () =>
    run(async () => {
      const message = prompt(tr('Кілька слів про себе для лідера (необов’язково)')) ?? '';
      update(await api<FamilyFull>(`/families/${f.id}/join`, { body: { message } }));
    });
  const leave = () =>
    run(async () => {
      if (f.myRole && !confirm(tr('Вийти з родини «{name}»?', { name: f.name }))) return;
      update(await api<FamilyFull>(`/families/${f.id}/join`, { method: 'DELETE' }));
      await refreshMe(setUser);
      qc.invalidateQueries({ queryKey: ['families'] });
    });
  const dissolve = () =>
    run(async () => {
      if (!confirm(tr('Розпустити родину «{name}»? Це незворотно.', { name: f.name }))) return;
      await api(`/families/${f.id}`, { method: 'DELETE' });
      await refreshMe(setUser);
      qc.invalidateQueries({ queryKey: ['families'] });
      navigate('/families');
    });
  const resubmit = () =>
    run(async () => {
      update(await api<FamilyFull>(`/families/${f.id}/resubmit`, { method: 'POST' }));
    });

  return (
    <div className="col-main">
      <div className="card profile-header">
        <div className="cover" style={f.cover ? { backgroundImage: `url(${f.cover})` } : undefined}>
          {f.canManage && (
            <button className="btn secondary cover-edit" onClick={() => upload('cover')} disabled={busy}>
              <Camera size={16} /> {f.cover ? tr('Змінити обкладинку') : tr('Додати обкладинку')}
            </button>
          )}
        </div>
        <div className="family-head">
          <div className="family-avatar" onClick={() => f.canManage && upload('avatar')} title={f.canManage ? tr('Змінити емблему') : undefined}>
            <Avatar src={f.avatar} name={f.name} id={f.id + 300} square size={96} />
          </div>
          <div className="family-title">
            <h1>
              {familyTitle(f)} {f.status === 'verified' && <BadgeCheck size={20} className="family-check" />}
            </h1>
            <div className="muted">
              {[f.project, f.server].filter(Boolean).join(' · ')} · {countLabel(f.membersCount, tr('учасник|учасники|учасників'))}
            </div>
            {f.leader && (
              <div className="muted" style={{ fontSize: 13 }}>
                {tr('Лідер')}: <Link to={`/id/${f.leader.id}`}>{fullName(f.leader)}</Link>
              </div>
            )}
          </div>
          <div className="family-actions">
            {!f.myRole && f.status === 'verified' && !f.requested && (
              <button className="btn" onClick={join} disabled={busy}>
                <Plus size={16} /> {tr('Подати заявку')}
              </button>
            )}
            {f.requested && (
              <button className="btn secondary" onClick={leave} disabled={busy} title={tr('Скасувати заявку')}>
                <Clock size={16} /> {tr('Заявку надіслано')}
              </button>
            )}
            {f.myRole && f.myRole !== 'leader' && (
              <button className="btn secondary" onClick={leave} disabled={busy}>
                {tr('Вийти з родини')}
              </button>
            )}
            {f.canManage && (
              <button className="btn secondary" onClick={() => setEditing(true)}>
                <Pencil size={16} /> {tr('Редагувати')}
              </button>
            )}
            {f.isLeader && (
              <button className="icon-btn" onClick={dissolve} disabled={busy} title={tr('Розпустити родину')}>
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      {f.status !== 'verified' && (
        <div className={`card family-review ${f.status}`}>
          <StatusBadge status={f.status} />
          {f.status === 'pending' && <p>{tr('Адміністрація перевіряє родину. Після підтвердження вона з’явиться в каталозі, а гравці зможуть подавати заявки.')}</p>}
          {f.status === 'rejected' && (
            <>
              <p>
                <b>{tr('Причина')}:</b> {f.reviewNote || '—'}
              </p>
              {f.isLeader && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn secondary" onClick={() => setEditing(true)}>
                    <Pencil size={16} /> {tr('Виправити дані')}
                  </button>
                  <button className="btn secondary" onClick={() => upload('proof')} disabled={busy}>
                    <ImagePlus size={16} /> {tr('Новий скріншот')}
                  </button>
                  <button className="btn" onClick={resubmit} disabled={busy}>
                    {tr('Подати знову')}
                  </button>
                </div>
              )}
            </>
          )}
          {f.proof && (
            <a href={f.proof} target="_blank" rel="noreferrer" className="family-proof">
              <img src={f.proof} alt={tr('Доказ')} />
            </a>
          )}
        </div>
      )}

      {(f.description || f.discordUrl || f.telegramUrl || f.union) && (
        <div className="card" style={{ padding: 20 }}>
          {f.description && <p style={{ whiteSpace: 'pre-wrap', marginBottom: 12 }}>{f.description}</p>}
          <div className="family-links">
            {f.union && (
              <Link to={`/unions/${f.union.id}`} className="chip on">
                <Handshake size={14} /> {tr('Союз')}: {familyTitle(f.union)}
              </Link>
            )}
            {f.discordUrl && (
              <a className="chip" href={f.discordUrl} target="_blank" rel="noreferrer">
                Discord
              </a>
            )}
            {f.telegramUrl && (
              <a className="chip" href={f.telegramUrl} target="_blank" rel="noreferrer">
                Telegram
              </a>
            )}
          </div>
        </div>
      )}

      {f.canManage && f.requestsCount > 0 && <Requests family={f} />}
      <Members family={f} />
      {f.myRole && f.status === 'verified' && (
        <>
          <div className="section-title">{tr('Стіна родини')}</div>
          <Composer ownerType="family" ownerId={f.id} queryKeys={[['posts', 'family', f.id], ['posts', 'feed', 'news']]} placeholder={tr('Написати родині…')} />
          <PostList queryKey={['posts', 'family', f.id]} path={`/wall/family/${f.id}`} emptyText={tr('Тут учасники пишуть одне одному, діляться фільмами й домовляються про збори. Стіну бачать лише учасники родини.')} />
        </>
      )}
      {editing && (
        <EditFamilyModal
          family={f}
          onClose={() => setEditing(false)}
          onSaved={(next) => {
            update(next);
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}
