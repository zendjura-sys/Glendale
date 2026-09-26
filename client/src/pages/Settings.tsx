import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, LogOut, Palette, ShieldCheck, UserRound } from 'lucide-react';
import { api, form } from '../lib/api';
import { useAuth, useMe } from '../lib/auth';
import { useTheme } from '../lib/theme';
import type { User } from '../lib/types';
import { fullName } from '../lib/utils';
import { Avatar, pickFile } from '../components/ui';
import { ThemeSwitch } from '../components/uiverse';

function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const option = (value: 'light' | 'dark', label: string, bg: string, card: string, accent: string) => (
    <button className={`theme-option${theme === value ? ' active' : ''}`} onClick={() => setTheme(value)}>
      <div className="theme-preview" style={{ background: bg }}>
        <i style={{ width: 24, background: card }} />
        <i style={{ flex: 1, background: card, display: 'flex', flexDirection: 'column', gap: 6, padding: 6 }}>
          <b style={{ height: 6, width: '60%', background: accent, borderRadius: 3 }} />
          <b style={{ height: 6, width: '80%', background: bg, borderRadius: 3 }} />
          <b style={{ height: 6, width: '40%', background: bg, borderRadius: 3 }} />
        </i>
      </div>
      {label}
    </button>
  );
  return (
    <div className="theme-options">
      {option('light', 'Светлая', 'linear-gradient(135deg,#c7ceff,#f3d6ff,#ffd6ea)', 'rgba(255,255,255,.65)', '#4c5bf5')}
      {option('dark', 'Тёмная', 'linear-gradient(135deg,#1a1f6b,#3b1a6b,#5a1646)', 'rgba(24,27,44,.6)', '#9aa3ff')}
    </div>
  );
}

function ProfileForm() {
  const me = useMe();
  const { setUser } = useAuth();
  const qc = useQueryClient();
  const [f, setF] = useState({
    firstName: me.firstName,
    lastName: me.lastName,
    status: me.status,
    city: me.city,
    birthday: me.birthday,
    bio: me.bio,
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const u = await api<User>('/me', { method: 'PATCH', body: f });
      setUser(u);
      qc.invalidateQueries({ queryKey: ['user', u.id] });
      setMsg({ ok: true, text: 'Изменения сохранены' });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    }
  };

  const changeAvatar = async () => {
    const [file] = await pickFile();
    if (!file) return;
    const u = await api<User>('/me/avatar', { body: form({ image: file }) });
    setUser(u);
    qc.invalidateQueries({ queryKey: ['user', u.id] });
  };

  return (
    <form onSubmit={save} style={{ padding: '0 20px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <Avatar src={me.avatar} name={fullName(me)} id={me.id} size={72} />
        <button type="button" className="btn secondary" onClick={changeAvatar}>
          <Camera size={16} /> Изменить фотографию
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-row">
          <label className="label">Имя</label>
          <input className="field" value={f.firstName} onChange={set('firstName')} maxLength={50} required />
        </div>
        <div className="form-row">
          <label className="label">Фамилия</label>
          <input className="field" value={f.lastName} onChange={set('lastName')} maxLength={50} required />
        </div>
        <div className="form-row">
          <label className="label">Город</label>
          <input className="field" value={f.city} onChange={set('city')} maxLength={80} />
        </div>
        <div className="form-row">
          <label className="label">День рождения</label>
          <input className="field" type="date" value={f.birthday} onChange={set('birthday')} />
        </div>
      </div>
      <div className="form-row">
        <label className="label">Статус</label>
        <input className="field" value={f.status} onChange={set('status')} maxLength={140} />
      </div>
      <div className="form-row">
        <label className="label">О себе</label>
        <textarea className="field" value={f.bio} onChange={set('bio')} maxLength={1000} />
      </div>
      {msg && <div className={msg.ok ? 'muted' : 'error-text'} style={{ marginBottom: 10 }}>{msg.text}</div>}
      <button className="btn">Сохранить</button>
    </form>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api('/me/password', { body: { current, next } });
      setCurrent('');
      setNext('');
      setMsg({ ok: true, text: 'Пароль изменён' });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    }
  };
  return (
    <form onSubmit={save} style={{ padding: '0 20px 20px' }}>
      <div className="form-row">
        <label className="label">Текущий пароль</label>
        <input className="field" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
      </div>
      <div className="form-row">
        <label className="label">Новый пароль</label>
        <input className="field" type="password" value={next} onChange={(e) => setNext(e.target.value)} minLength={6} autoComplete="new-password" required />
      </div>
      {msg && <div className={msg.ok ? 'muted' : 'error-text'} style={{ marginBottom: 10 }}>{msg.text}</div>}
      <button className="btn secondary">Изменить пароль</button>
    </form>
  );
}

export default function SettingsPage() {
  const { signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  return (
    <div className="col-main">
      <div className="card">
        <div className="card-title">
          <Palette size={18} /> Внешний вид
          <span className="right">
            <ThemeSwitch dark={theme === 'dark'} onChange={(d) => setTheme(d ? 'dark' : 'light')} size={10} />
          </span>
        </div>
        <ThemePicker />
      </div>
      <div className="card">
        <div className="card-title">
          <UserRound size={18} /> Профиль
        </div>
        <ProfileForm />
      </div>
      <div className="card">
        <div className="card-title">
          <ShieldCheck size={18} /> Безопасность
        </div>
        <PasswordForm />
      </div>
      <div className="card card-pad">
        <button className="btn danger" onClick={signOut}>
          <LogOut size={16} /> Выйти из аккаунта
        </button>
      </div>
    </div>
  );
}
