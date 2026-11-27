import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/app.css';

// Анти-браузерні правила: без стандартного контекстного меню й перетягування картинок.
window.addEventListener('contextmenu', (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest('input, textarea, [data-selectable]')) e.preventDefault();
});
window.addEventListener('dragstart', (e) => {
    if ((e.target as HTMLElement).tagName === 'IMG') e.preventDefault();
});

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
