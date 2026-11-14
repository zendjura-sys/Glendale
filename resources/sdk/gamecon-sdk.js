var GameConSDKModule=(function(){var e=globalThis.__GC_SDK_I18N__??{};function t(t,n){let r=e[t]??t;return n?r.replace(/\{(\w+)\}/g,(e,t)=>t in n?String(n[t]):e):r}var n={users:`<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,chat:`<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>`,mic:`<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>`,micOff:`<line x1="2" x2="22" y1="2" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" x2="12" y1="19" y2="22"/>`,shield:`<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>`,music:`<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>`,trophy:`<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>`,right:`<path d="m9 18 6-6-6-6"/>`,left:`<path d="m15 18-6-6 6-6"/>`,down:`<path d="m6 9 6 6 6-6"/>`,up:`<path d="m18 15-6-6-6 6"/>`,gamepad:`<line x1="6" x2="10" y1="11" y2="11"/><line x1="8" x2="8" y1="9" y2="13"/><line x1="15" x2="15.01" y1="12" y2="12"/><line x1="18" x2="18.01" y1="10" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/>`,x:`<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`,send:`<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>`,login:`<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/>`,play:`<polygon points="6 3 20 12 6 21 6 3"/>`,pause:`<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>`,next:`<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/>`,crown:`<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/>`,wallet:`<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>`,grip:`<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>`,bell:`<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>`},r=e=>`<svg viewBox="0 0 24 24" aria-hidden="true">${n[e]??``}</svg>`,i=e=>String(e??``).replace(/[&<>"']/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`,"'":`&#39;`})[e]),a=e=>e.split(/\s+/).map(e=>e[0]??``).join(``).slice(0,2).toUpperCase(),o={friends:`users`,chat:`chat`,voice:`mic`,groups:`shield`,music:`music`,achievements:`trophy`},s={friends:`Друзі`,chat:`Чат`,voice:`Голос`,groups:`Сім’я й клан`,music:`Музика`,achievements:`Досягнення`},c={user:{sub:`1`,preferred_username:`nova`,name:`Нова`,picture:null},friends:[{id:2,username:`sashko`,name:`Сашко`,avatar_url:null,online:!0,presence:{status:`У матчі · 12:40`,lobby:`A-7`}},{id:3,username:`marta`,name:`Марта`,avatar_url:null,online:!0,presence:{status:`У лобі`,lobby:`A-7`}},{id:4,username:`dmytro`,name:`Дмитро`,avatar_url:null,online:!0,presence:null},{id:5,username:`ira`,name:`Іра`,avatar_url:null,online:!1,presence:null}],party:[{name:`Нова`,avatar:null,online:!0,mic:`speaking`},{name:`Сашко`,avatar:null,online:!0,mic:`on`},{name:`Марта`,avatar:null,online:!0,mic:`off`}],family:{name:`Black Rose`,tag:`BR`,treasury:125e4,my_balance:42e3,online:7,members_count:24,members:[{name:`Tony Rose`,avatar:null,online:!0,rank:`Лідер`},{name:`Nova Rose`,avatar:null,online:!0,rank:`Заступниця`},{name:`Mark Rose`,avatar:null,online:!0,rank:`Боєць`},{name:`Ira Rose`,avatar:null,online:!1,rank:`Новачок`}]},conversations:[{id:1,title:`Паті A-7`,unread:2},{id:2,title:`Black Rose`},{id:3,title:`Сашко`}],messages:{1:[{id:1,body:`Хто на точку B?`,mine:!1,author:`Сашко`},{id:2,body:`Я, вже біжу`,mine:!0},{id:3,body:`Тримаю праву`,mine:!1,author:`Марта`}],2:[{id:4,body:`Збір о 21:00 біля штабу`,mine:!1,author:`Tony`}],3:[{id:5,body:`Го ще одну?`,mine:!1,author:`Сашко`}]},track:{title:`Midnight Drive`,artist:`Neon Lake`,playing:!0}},l=class{version=`1.0.0`;o;vp;token=null;refresh=null;user=null;tab=`friends`;open=!1;chatOpen=!1;conv=null;busy=!1;handlers={};timers=[];device=null;cleanup=[];constructor(e){this.o={base:`https://gamecon.online`,demo:!1,locale:(navigator.language||`uk`).slice(0,2),modules:[`hud`,`drop`],side:`left`,offset:50,theme:`dark`,radius:22,density:84,accent:`#4f7cff`,tabs:[`friends`,`chat`,`voice`,`groups`,`music`,`achievements`],toasts:`top-right`,gamepad:!0,swipe:!0,hideWhenBusy:!0,draggable:!1,blur:`auto`,scopes:[`profile`,`friends`,`chat`,`voice`,`groups`,`music`,`presence`,`invites`,`achievements`],remoteConfig:!0,...e,position:{hud:`top-right`,party:`bottom-left`,family:`top-left`,...e.position??{}},hotkeys:{toggle:`Shift+Tab`,chat:`Alt+G`,...e.hotkeys??{}}},this.o.base=this.o.base.replace(/\/+$/,``),this.token=e.token??null}async start(){return!this.o.demo&&this.o.clientId&&this.o.remoteConfig&&await this.loadRemote(),this.mount(),this.bindKeys(),this.o.demo?this.user=c.user:(this.restore(),await this.finishRedirect(),this.token&&await this.loadUser()),this.render(),this.user&&this.poll(),this.o.onReady?.(this),this.emit(`ready`),this}destroy(){this.timers.forEach(e=>clearInterval(e)),this.cleanup.forEach(e=>e()),this.vp?.remove()}configure(e){Object.assign(this.o,e,{position:{...this.o.position,...e.position??{}},hotkeys:{...this.o.hotkeys,...e.hotkeys??{}}}),this.applyVars(),this.render()}on(e,t){return(this.handlers[e]??=[]).push(t),()=>{this.handlers[e]=(this.handlers[e]??[]).filter(e=>e!==t)}}emit(e,t){this.o.onEvent?.(e,t),(this.handlers[e]??[]).forEach(e=>e(t));try{window.parent?.postMessage({source:`gamecon-sdk`,event:e,data:t},`*`)}catch{}}toggle(e,t){this.open=e??!this.open,t&&(this.tab=t),this.vp.dataset.mode=this.open||this.chatOpen?`active`:`hud`,this.render(),this.emit(this.open?`open`:`close`)}openChat(e){this.chatOpen=e??!this.chatOpen,this.vp.dataset.mode=this.open||this.chatOpen?`active`:`hud`,this.render(),this.chatOpen&&setTimeout(()=>this.vp.querySelector(`.gc-sdk-input input`)?.focus(),60)}setBusy(e){this.busy=e,this.o.hideWhenBusy&&(this.vp.dataset.busy=e?`1`:`0`),e&&(this.open=!1,this.chatOpen=!1,this.vp.dataset.mode=`hud`,this.render())}setMode(e){this.vp.dataset.mode=e}toast(e,t,n=`bell`){if(this.o.toasts===`off`)return;let a=this.vp.querySelector(`.gc-sdk-toasts`);if(!a)return;let o=document.createElement(`div`);o.className=`gc-sdk-toast gc-sdk-frosted-glass gc-sdk-interactive`,o.setAttribute(`role`,`status`),o.innerHTML=`<span class="gc-sdk-dot"></span>${r(n)}<div class="gc-sdk-grow"><div class="gc-sdk-title">${i(e)}</div>${t?`<div class="gc-sdk-sub">${i(t)}</div>`:``}</div>`,a.prepend(o),requestAnimationFrame(()=>o.dataset.in=`1`),setTimeout(()=>{o.dataset.in=`0`,setTimeout(()=>o.remove(),300)},5e3)}async api(e,t={}){if(!this.token)throw Error(`GameCon: not signed in`);let n=await fetch(`${this.o.base}/api/developer/v1/${e.replace(/^\/+/,``)}`,{...t,headers:{Accept:`application/json`,"Content-Type":`application/json`,Authorization:`Bearer ${this.token}`,...t.headers??{}}});if(n.status===401&&this.refresh&&await this.renew())return this.api(e,t);if(!n.ok)throw Error(`GameCon API ${n.status}`);return await n.json()}setPresence(e,t){return this.o.demo?Promise.resolve():this.api(`presence`,{method:`PUT`,body:JSON.stringify({status:e,lobby:t})})}invite(e,n,r){return this.o.demo?(this.toast(t(`Запрошення надіслано`),e),Promise.resolve()):this.api(`invites`,{method:`POST`,body:JSON.stringify({username:e,lobby:n,url:r})})}unlockAchievement(e){return this.o.demo?Promise.resolve():this.api(`achievements/${encodeURIComponent(e)}/unlock`,{method:`POST`})}submitScore(e,t){return this.o.demo?Promise.resolve():this.api(`leaderboards/${encodeURIComponent(e)}/scores`,{method:`POST`,body:JSON.stringify({score:t})})}joinVoice(e,t=!1){return this.api(`voice/rooms/${encodeURIComponent(e)}/join`,{method:`POST`,body:JSON.stringify({listen_only:t})})}key(e){return`gc_sdk_${this.o.clientId??`demo`}_${e}`}store(e,t){try{t===null?localStorage.removeItem(this.key(e)):localStorage.setItem(this.key(e),t)}catch{}}read(e){try{return localStorage.getItem(this.key(e))}catch{return null}}restore(){this.token||(this.token=this.read(`access`),this.refresh=this.read(`refresh`))}saveTokens(e){this.token=e.access_token,this.refresh=e.refresh_token??this.refresh,this.store(`access`,this.token),this.store(`refresh`,this.refresh)}async tokenRequest(e){let t=await fetch(`${this.o.base}/oauth/token`,{method:`POST`,headers:{"Content-Type":`application/x-www-form-urlencoded`,Accept:`application/json`},body:new URLSearchParams({client_id:this.o.clientId??``,...e})});return{ok:t.ok,json:await t.json().catch(()=>({}))}}async renew(){let e=await this.tokenRequest({grant_type:`refresh_token`,refresh_token:this.refresh??``});return e.ok?(this.saveTokens(e.json),!0):(this.logout(),!1)}async login(){if(this.o.demo)return;if(!this.o.redirectUri)return this.loginWithCode();let e=u(crypto.getRandomValues(new Uint8Array(32))),t=u(new Uint8Array(await crypto.subtle.digest(`SHA-256`,new TextEncoder().encode(e)))),n=u(crypto.getRandomValues(new Uint8Array(12)));this.store(`pkce`,JSON.stringify({verifier:e,state:n}));let r=new URLSearchParams({response_type:`code`,client_id:this.o.clientId??``,redirect_uri:this.o.redirectUri,scope:this.o.scopes.join(` `),state:n,code_challenge:t,code_challenge_method:`S256`});location.assign(`${this.o.base}/oauth/authorize?${r}`)}async finishRedirect(){let e=new URL(location.href),t=e.searchParams.get(`code`),n=this.read(`pkce`);if(!t||!n)return;let{verifier:r,state:i}=JSON.parse(n);if(e.searchParams.get(`state`)!==i)return;this.store(`pkce`,null);let a=await this.tokenRequest({grant_type:`authorization_code`,code:t,code_verifier:r,redirect_uri:this.o.redirectUri??``});a.ok&&this.saveTokens(a.json),[`code`,`state`,`iss`].forEach(t=>e.searchParams.delete(t)),history.replaceState(null,``,e.toString())}async loginWithCode(){let e=await fetch(`${this.o.base}/oauth/device`,{method:`POST`,headers:{"Content-Type":`application/x-www-form-urlencoded`,Accept:`application/json`},body:new URLSearchParams({client_id:this.o.clientId??``,scope:this.o.scopes.join(` `)})}),t=await e.json();if(!e.ok)return;this.device={user_code:t.user_code,uri:t.verification_uri_complete},this.toggle(!0);let n=(t.interval||5)*1e3,r=Date.now()+t.expires_in*1e3,i=async()=>{if(!this.device||Date.now()>r){this.device=null,this.render();return}let e=await this.tokenRequest({grant_type:`urn:ietf:params:oauth:grant-type:device_code`,device_code:t.device_code});if(e.ok){this.device=null,this.saveTokens(e.json),await this.loadUser(),this.render(),this.poll();return}if(e.json.error===`slow_down`&&(n+=5e3),e.json.error===`access_denied`||e.json.error===`expired_token`){this.device=null,this.render();return}setTimeout(i,n)};setTimeout(i,n)}logout(){this.token=this.refresh=null,this.user=null,this.store(`access`,null),this.store(`refresh`,null),this.render(),this.emit(`logout`)}async loadUser(){try{this.user=await this.api(`userinfo`),this.o.onLogin?.(this.user),this.emit(`login`,this.user)}catch{this.user=null}}async loadRemote(){try{let e=await fetch(`${this.o.base}/api/developer/v1/sdk/config/${encodeURIComponent(this.o.clientId??``)}`);if(!e.ok)return;let t=(await e.json()).data.overlay;for(let[e,n]of Object.entries({accent:`accent`,logo_url:`logo`,title:`title`,side:`side`,offset:`offset`,theme:`theme`,radius:`radius`,opacity:`density`,toasts:`toasts`,tabs:`tabs`,gamepad:`gamepad`,swipe:`swipe`,hide_when_busy:`hideWhenBusy`}))t[e]!==void 0&&t[e]!==null&&!(n in this.given)&&(this.o[n]=t[e]);t.hotkey&&!this.given.hotkeys&&(this.o.hotkeys.toggle=String(t.hotkey)),t.enabled===!1&&!this.given.modules&&(this.o.modules=this.o.modules.filter(e=>e!==`drop`))}catch{}}given={};friends=[];party=[];family=null;convs=[];msgs=[];track=null;poll(){let e=async()=>{this.o.demo?(this.friends=c.friends,this.party=c.party,this.family=c.family,this.convs=c.conversations,this.conv??=this.convs[0]?.id??null,this.msgs=this.conv?c.messages[this.conv]??[]:[],this.track=c.track):(await Promise.allSettled([this.api(`friends/online`).then(e=>{this.friends=e.data;let t=e.data.find(e=>e.presence?.lobby)?.presence?.lobby;this.party=e.data.filter(e=>t&&e.presence?.lobby===t).map(e=>({name:e.name,avatar:e.avatar_url,online:e.online,mic:`on`}))}),this.api(`groups`).then(async e=>{let t=e.data.find(e=>e.kind===`family`);if(!t)return;let n=await this.api(`groups/families/${t.id}/members`);this.family={...n.family,members:n.data.map(e=>({name:e.nickname,avatar:e.user?.avatar_url??null,online:!!e.user?.online,rank:e.rank_title}))}}),this.api(`chat/conversations`).then(e=>{this.convs=e.data.slice(0,12),this.conv??=this.convs[0]?.id??null}),this.api(`music/now`).then(e=>{this.track=e.data?.title?{title:e.data.title,artist:e.data.artist??``,playing:!!e.data.playing}:null})]),this.conv&&this.chatOpen&&await this.loadMessages()),this.render()};e(),this.o.demo||this.timers.push(window.setInterval(e,2e4))}async loadMessages(){if(this.conv&&!this.o.demo)try{let e=await this.api(`chat/conversations/${this.conv}/messages`);this.msgs=e.data.map(e=>({id:e.id,body:e.body,mine:!!(e.mine??e.is_mine),author:e.user?.name}))}catch{this.msgs=[]}}async send(e){e.trim()&&this.conv&&(this.msgs=[...this.msgs,{id:Date.now(),body:e,mine:!0}],this.render(),this.o.demo||await this.api(`chat/conversations/${this.conv}/messages`,{method:`POST`,body:JSON.stringify({body:e})}).catch(()=>void 0))}mount(){if(!document.getElementById(`gc-sdk-style`)){let e=document.createElement(`style`);e.id=`gc-sdk-style`,e.textContent=`/*
 * GameCon Overlay SDK — CSS-ядро.
 * Безбарвне матове скло (iOS 27+ Achromatic Frosted Glass) на 100 % прозорому полотні.
 * Кольорова лише крапка акценту гри (--gc-accent) на дрібних індикаторах — без заливок.
 */

.gc-sdk-viewport {
    --gc-accent: #4f7cff;
    --gc-radius: 22px;
    --gc-ease: cubic-bezier(0.32, 0.72, 0, 1);
    --gc-glass: rgba(16, 18, 24, 0.78);
    --gc-glass-hud: rgba(14, 16, 22, 0.62);
    --gc-glass-active: rgba(16, 18, 24, 0.84);
    --gc-glass-solid: rgba(16, 18, 24, 0.94);
    --gc-ink: #f8fafc;
    --gc-sub: rgba(248, 250, 252, 0.58);
    --gc-line: rgba(255, 255, 255, 0.14);
    position: fixed;
    inset: 0;
    background: transparent !important;
    /* Усі кліки повз віджети вільно проходять у саму гру */
    pointer-events: none;
    z-index: 2147483647;
    font-family:
        -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif;
    font-size: 13px;
    line-height: 1.35;
    color: var(--gc-ink);
    user-select: none;
    -webkit-font-smoothing: antialiased;
}
/* Вбудовано в контейнер (пісочниця, прев'ю в порталі) */
.gc-sdk-viewport.gc-sdk-contained {
    position: absolute;
    z-index: 5;
}
.gc-sdk-viewport *,
.gc-sdk-viewport *::before,
.gc-sdk-viewport *::after {
    box-sizing: border-box;
}
.gc-sdk-viewport svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
}

.gc-sdk-interactive {
    /* Клікабельні лише самі скляні капсули й вікна */
    pointer-events: auto;
}

/* ───────── Еталонне матове безбарвне скло ───────── */
.gc-sdk-frosted-glass {
    background: var(--gc-glass);
    backdrop-filter: blur(36px) saturate(145%) contrast(105%);
    -webkit-backdrop-filter: blur(36px) saturate(145%) contrast(105%);
    border: 1px solid var(--gc-line);
    box-shadow:
        inset 0 1px 0 0 rgba(255, 255, 255, 0.24),
        inset 0 -1px 0 0 rgba(255, 255, 255, 0.05),
        0 16px 40px -8px rgba(0, 0, 0, 0.75);
    border-radius: var(--gc-radius);
    color: var(--gc-ink);
    transition:
        transform 0.22s var(--gc-ease),
        opacity 0.22s var(--gc-ease),
        background-color 0.2s ease;
}

/* Компактний HUD (гравець бігає й стріляє): прозоріше, щоб не закривати огляд */
.gc-sdk-viewport[data-mode='hud'] .gc-sdk-frosted-glass {
    background: var(--gc-glass-hud);
    backdrop-filter: blur(24px) saturate(140%);
    -webkit-backdrop-filter: blur(24px) saturate(140%);
    opacity: 0.88;
}
/* Активний режим (хоткей чи наведення): щільне скло й легке притягування фокуса */
.gc-sdk-viewport[data-mode='active'] .gc-sdk-frosted-glass,
.gc-sdk-viewport[data-mode='hud'] .gc-sdk-frosted-glass:hover {
    background: var(--gc-glass-active);
    backdrop-filter: blur(40px) saturate(145%) contrast(105%);
    -webkit-backdrop-filter: blur(40px) saturate(145%) contrast(105%);
    opacity: 1;
    transform: scale(1);
}

/* Старі ігрові CEF без GPU-розмиття: щільніша підкладка з дрібним зерном */
.gc-sdk-viewport.gc-sdk-no-blur .gc-sdk-frosted-glass,
.gc-sdk-viewport.gc-sdk-no-blur[data-mode] .gc-sdk-frosted-glass {
    background-color: var(--gc-glass-solid);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .05 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
}
@supports not
((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .gc-sdk-frosted-glass {
        background-color: var(--gc-glass-solid) !important;
    }
}

/* Світла тема гри — те саме безбарвне скло, тільки світле */
.gc-sdk-viewport[data-theme='light'] {
    --gc-glass: rgba(248, 250, 252, 0.72);
    --gc-glass-hud: rgba(248, 250, 252, 0.58);
    --gc-glass-active: rgba(248, 250, 252, 0.82);
    --gc-glass-solid: rgba(248, 250, 252, 0.94);
    --gc-ink: #0f172a;
    --gc-sub: rgba(15, 23, 42, 0.58);
    --gc-line: rgba(15, 23, 42, 0.1);
}

/* Внутрішні кнопки й слоти */
.gc-sdk-slot {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    color: inherit;
    font: inherit;
    text-align: left;
    transition:
        background-color 0.16s ease,
        border-color 0.16s ease;
}
.gc-sdk-slot:hover {
    background: rgba(255, 255, 255, 0.11);
    border-color: rgba(255, 255, 255, 0.18);
}
button.gc-sdk-slot {
    cursor: pointer;
}
.gc-sdk-viewport[data-theme='light'] .gc-sdk-slot {
    background: rgba(15, 23, 42, 0.05);
    border-color: rgba(15, 23, 42, 0.07);
}
.gc-sdk-sub {
    color: var(--gc-sub);
    font-size: 11px;
}
.gc-sdk-title {
    font-weight: 600;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.gc-sdk-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}
.gc-sdk-grow {
    flex: 1;
    min-width: 0;
}
.gc-sdk-icon-btn {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 10px;
    border: 0;
    background: transparent;
    color: var(--gc-sub);
    cursor: pointer;
}
.gc-sdk-icon-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--gc-ink);
}
.gc-sdk-avatar {
    position: relative;
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.12) center / cover no-repeat;
    display: grid;
    place-items: center;
    font-size: 11px;
    font-weight: 600;
}
.gc-sdk-avatar[data-online='1']::after {
    content: '';
    position: absolute;
    right: -1px;
    bottom: -1px;
    width: 9px;
    height: 9px;
    border-radius: 999px;
    background: #34d399;
    box-shadow: 0 0 0 2px rgba(16, 18, 24, 0.9);
}
.gc-sdk-dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: var(--gc-accent);
    flex-shrink: 0;
}
.gc-sdk-kbd {
    padding: 2px 6px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.08);
    font-size: 10px;
    color: var(--gc-sub);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.gc-sdk-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 32px;
    padding: 0 12px;
    border-radius: 11px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(255, 255, 255, 0.14);
    color: var(--gc-ink);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
}
.gc-sdk-btn:hover {
    background: rgba(255, 255, 255, 0.2);
}
.gc-sdk-btn[aria-pressed='true'] {
    border-color: var(--gc-accent);
    box-shadow: inset 0 0 0 1px var(--gc-accent);
}
.gc-sdk-mute {
    color: var(--gc-sub);
}
.gc-sdk-live {
    color: #34d399;
}

/* ───────── Капсула-док (HUD) ───────── */
.gc-sdk-pill {
    position: absolute;
    display: flex;
    align-items: center;
    gap: 10px;
    height: 40px;
    padding: 0 8px 0 6px;
    border-radius: 999px !important;
    cursor: pointer;
}
.gc-sdk-logo {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.12);
    font-weight: 800;
    font-size: 14px;
    background-size: cover;
    background-position: center;
}
.gc-sdk-sep {
    width: 1px;
    height: 18px;
    background: rgba(255, 255, 255, 0.14);
}

/* ───────── Картки-віджети (паті, сім'я) ───────── */
.gc-sdk-card {
    position: absolute;
    width: 280px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.gc-sdk-card-head {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: grab;
}
.gc-sdk-card-head:active {
    cursor: grabbing;
}
.gc-sdk-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 220px;
    overflow: auto;
    scrollbar-width: thin;
}
.gc-sdk-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
}
.gc-sdk-stat {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
}
.gc-sdk-stat b {
    font-size: 15px;
    font-variant-numeric: tabular-nums;
}

/* ───────── Чат, що виїжджає справа ───────── */
.gc-sdk-drawer {
    position: absolute;
    top: 12px;
    right: 12px;
    bottom: 12px;
    width: min(340px, calc(100% - 24px));
    display: flex;
    flex-direction: column;
    padding: 12px;
    gap: 10px;
    transform: translateX(calc(100% + 24px));
    opacity: 0;
    transition:
        transform 0.42s var(--gc-ease),
        opacity 0.3s var(--gc-ease) !important;
}
.gc-sdk-viewport[data-hud-corner='top-right'] .gc-sdk-drawer {
    top: 62px;
}
.gc-sdk-drawer[data-open='1'] {
    transform: translateX(0);
    opacity: 1;
}
.gc-sdk-messages {
    flex: 1;
    min-height: 0;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-right: 2px;
    scrollbar-width: thin;
}
.gc-sdk-bubble {
    max-width: 82%;
    padding: 7px 10px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.08);
    user-select: text;
    word-wrap: break-word;
}
.gc-sdk-bubble[data-mine='1'] {
    align-self: flex-end;
    background: rgba(255, 255, 255, 0.16);
}
.gc-sdk-input {
    display: flex;
    gap: 6px;
}
.gc-sdk-input input {
    flex: 1;
    min-width: 0;
    height: 36px;
    padding: 0 12px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.06);
    color: var(--gc-ink);
    font: inherit;
    outline: none;
    user-select: text;
}
.gc-sdk-input input:focus {
    border-color: rgba(255, 255, 255, 0.3);
}
.gc-sdk-convs {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
}
.gc-sdk-chip {
    flex-shrink: 0;
    padding: 5px 10px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.05);
    color: var(--gc-sub);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
}
.gc-sdk-chip[aria-selected='true'] {
    color: var(--gc-ink);
    background: rgba(255, 255, 255, 0.14);
}

/* ───────── «Крапля» зі стрілкою + панель ───────── */
.gc-sdk-drop {
    position: absolute;
    display: grid;
    place-items: center;
    border: 1px solid var(--gc-line);
    cursor: pointer;
    color: var(--gc-ink);
    padding: 0;
}
.gc-sdk-drop::before {
    /* Тоненька лінія акценту гри по внутрішньому краю */
    content: '';
    position: absolute;
    border-radius: 999px;
    background: var(--gc-accent);
    opacity: 0.9;
}
.gc-sdk-drop[data-side='left'] {
    left: 0;
    width: 26px;
    height: 58px;
    border-left: 0;
    border-radius: 0 999px 999px 0 !important;
    transform: translateY(-50%);
}
.gc-sdk-drop[data-side='right'] {
    right: 0;
    width: 26px;
    height: 58px;
    border-right: 0;
    border-radius: 999px 0 0 999px !important;
    transform: translateY(-50%);
}
.gc-sdk-drop[data-side='top'] {
    top: 0;
    width: 58px;
    height: 26px;
    border-top: 0;
    border-radius: 0 0 999px 999px !important;
    transform: translateX(-50%);
}
.gc-sdk-drop[data-side='left']::before,
.gc-sdk-drop[data-side='right']::before {
    top: 16px;
    bottom: 16px;
    width: 2px;
}
.gc-sdk-drop[data-side='left']::before {
    left: 3px;
}
.gc-sdk-drop[data-side='right']::before {
    right: 3px;
}
.gc-sdk-drop[data-side='top']::before {
    left: 16px;
    right: 16px;
    height: 2px;
    top: 3px;
}
.gc-sdk-viewport[data-busy='1'] .gc-sdk-drop,
.gc-sdk-viewport[data-busy='1'] .gc-sdk-pill {
    opacity: 0.18 !important;
}

.gc-sdk-panel {
    position: absolute;
    width: min(320px, calc(100% - 48px));
    max-height: min(480px, calc(100% - 48px));
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    opacity: 0;
    pointer-events: none;
}
.gc-sdk-panel[data-open='1'] {
    opacity: 1;
    pointer-events: auto;
}
.gc-sdk-panel[data-side='left'] {
    left: 34px;
    transform: translate(-12px, -50%) scale(0.97);
}
.gc-sdk-panel[data-side='right'] {
    right: 34px;
    transform: translate(12px, -50%) scale(0.97);
}
.gc-sdk-panel[data-side='top'] {
    top: 34px;
    transform: translate(-50%, -12px) scale(0.97);
}
.gc-sdk-panel[data-side='left'][data-open='1'],
.gc-sdk-panel[data-side='right'][data-open='1'] {
    transform: translate(0, -50%) scale(1);
}
.gc-sdk-panel[data-side='top'][data-open='1'] {
    transform: translate(-50%, 0) scale(1);
}
.gc-sdk-tabs {
    display: flex;
    gap: 4px;
}
.gc-sdk-tab {
    flex: 1;
    display: grid;
    place-items: center;
    height: 32px;
    border-radius: 10px;
    border: 0;
    background: transparent;
    color: var(--gc-sub);
    cursor: pointer;
    position: relative;
}
.gc-sdk-tab:hover {
    background: rgba(255, 255, 255, 0.07);
}
.gc-sdk-tab[aria-selected='true'] {
    background: rgba(255, 255, 255, 0.14);
    color: var(--gc-ink);
}
.gc-sdk-tab[aria-selected='true']::after {
    content: '';
    position: absolute;
    bottom: 3px;
    width: 14px;
    height: 2px;
    border-radius: 2px;
    background: var(--gc-accent);
}
.gc-sdk-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow: auto;
    min-height: 0;
    scrollbar-width: thin;
}

/* Відкрита панель — інші картки відступають на другий план */
.gc-sdk-viewport[data-panel='1'] .gc-sdk-card {
    opacity: 0.22;
    pointer-events: none;
}

/* ───────── Тост ───────── */
.gc-sdk-toasts {
    position: absolute;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: min(320px, calc(100% - 24px));
}
.gc-sdk-toast {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px 9px 10px;
    border-radius: 999px !important;
    transform: translateY(-8px);
    opacity: 0;
}
.gc-sdk-toast[data-in='1'] {
    transform: none;
    opacity: 1;
}

/* Перетягування віджетів (пісочниця й ігри з draggable: true) */
.gc-sdk-dragging {
    transition: none !important;
}

@media (prefers-reduced-motion: reduce) {
    .gc-sdk-viewport *,
    .gc-sdk-frosted-glass,
    .gc-sdk-drawer {
        transition-duration: 0.01ms !important;
    }
}

/* Закриті панелі сильніші за прозорість режиму HUD */
.gc-sdk-viewport .gc-sdk-panel[data-open='0'],
.gc-sdk-viewport .gc-sdk-drawer[data-open='0'] {
    opacity: 0 !important;
    visibility: hidden;
    pointer-events: none;
    transition:
        transform 0.3s var(--gc-ease),
        opacity 0.2s var(--gc-ease),
        visibility 0s linear 0.3s !important;
}
.gc-sdk-viewport .gc-sdk-toast[data-in='0'],
.gc-sdk-viewport .gc-sdk-toast:not([data-in]) {
    opacity: 0 !important;
}
`,document.head.appendChild(e)}this.vp=document.createElement(`div`),this.vp.className=`gc-sdk-viewport`+(this.o.root?` gc-sdk-contained`:``),this.vp.dataset.mode=`hud`,this.vp.setAttribute(`aria-label`,`GameCon`),(this.o.root??document.body).appendChild(this.vp);let e=!this.o.root&&window.top!==window.self,t=this.o.blur===!1||this.o.blur===`auto`&&(e||!(CSS.supports?.(`backdrop-filter`,`blur(1px)`)||CSS.supports?.(`-webkit-backdrop-filter`,`blur(1px)`)));this.vp.classList.toggle(`gc-sdk-no-blur`,t),this.applyVars(),this.vp.addEventListener(`click`,e=>this.onClick(e)),this.vp.addEventListener(`submit`,e=>{e.preventDefault();let t=e.target.querySelector(`input`);t&&(this.send(t.value),t.value=``)})}applyVars(){let e=this.vp.style;e.setProperty(`--gc-accent`,this.o.accent),e.setProperty(`--gc-radius`,`${this.o.radius}px`);let t=Math.min(100,Math.max(60,this.o.density))/100;e.setProperty(`--gc-glass-active`,`rgba(16, 18, 24, ${t})`),e.setProperty(`--gc-glass`,`rgba(16, 18, 24, ${Math.max(.6,t-.06)})`);let n=this.o.theme===`dark`||this.o.theme===`auto`&&!matchMedia(`(prefers-color-scheme: light)`).matches;this.vp.dataset.theme=n?`dark`:`light`}corner(e,t=12){let[n,r]=e.split(`-`);return`${n}:${t}px;${r}:${t}px;`}render(){if(!this.vp)return;let e=new Set(this.o.modules);this.vp.dataset.panel=this.open&&e.has(`drop`)?`1`:`0`,this.vp.dataset.hudCorner=e.has(`hud`)?this.o.position.hud:``;let t=this.vp.querySelector(`.gc-sdk-input input`)?.value??``,n=[];e.has(`hud`)&&n.push(this.hud()),e.has(`party`)&&this.user&&n.push(this.partyCard()),e.has(`family`)&&this.user&&this.family&&n.push(this.familyCard()),e.has(`drop`)&&n.push(this.drop()),(e.has(`chat`)||e.has(`drop`))&&n.push(this.drawer());let r=this.o.toasts===`off`?`top-right`:this.o.toasts,i=r===`top`?`top:12px;left:50%;transform:translateX(-50%);`:this.corner(r,12),a=this.vp.querySelector(`.gc-sdk-toasts`);this.vp.innerHTML=n.join(``);let o=a??document.createElement(`div`);o.className=`gc-sdk-toasts`,o.setAttribute(`style`,i+(e.has(`hud`)&&r===this.o.position.hud?`margin-top:52px;`:``)+(this.chatOpen&&r.endsWith(`right`)?`right:364px;`:``)),this.vp.appendChild(o);let s=this.vp.querySelector(`.gc-sdk-input input`);s&&t&&(s.value=t),this.o.draggable&&this.enableDrag();let c=this.vp.querySelector(`.gc-sdk-messages`);c&&(c.scrollTop=c.scrollHeight)}avatar(e,t,n){return`<span class="gc-sdk-avatar" data-online="${+!!n}" ${t?`style="background-image:url('${i(t)}')"`:``}>${t?``:i(a(e))}</span>`}hud(){let e=this.friends.filter(e=>e.online).length,n=this.o.logo?`<span class="gc-sdk-logo" style="background-image:url('${i(this.o.logo)}')"></span>`:`<span class="gc-sdk-logo">G</span>`,a=this.party.length?`<span class="gc-sdk-row gc-sdk-live">${r(`mic`)}<span>${this.party.length}</span></span><span class="gc-sdk-sep"></span>`:``,o=this.user?`<span class="gc-sdk-row">${r(`users`)}<span>${t(`{n} онлайн`,{n:e})}</span></span><span class="gc-sdk-sep"></span>${a}`:`<span class="gc-sdk-row">${r(`login`)}<span>${t(`Увійти`)}</span></span><span class="gc-sdk-sep"></span>`;return`<button type="button" data-act="toggle" class="gc-sdk-pill gc-sdk-frosted-glass gc-sdk-interactive" data-w="hud" style="${this.corner(this.o.position.hud)}" aria-label="GameCon">${n}${o}<span class="gc-sdk-kbd">${i(this.o.hotkeys.toggle)}</span></button>`}partyCard(){let e=this.party.map(e=>`<div class="gc-sdk-slot">${this.avatar(e.name,e.avatar,e.online)}<span class="gc-sdk-grow gc-sdk-title">${i(e.name)}</span><span class="${e.mic===`speaking`?`gc-sdk-live`:`gc-sdk-mute`}">${r(e.mic===`off`?`micOff`:`mic`)}</span></div>`).join(``);return`<section class="gc-sdk-card gc-sdk-frosted-glass gc-sdk-interactive" data-w="party" style="${this.corner(this.o.position.party)}">
<div class="gc-sdk-card-head">${r(`users`)}<span class="gc-sdk-grow gc-sdk-title">${t(`Моє паті`)}</span><span class="gc-sdk-sub">${t(`{n} у голосі`,{n:this.party.length})}</span></div>
<div class="gc-sdk-list">${e||`<div class="gc-sdk-sub">${t(`Покличте друзів із вкладки «Друзі»`)}</div>`}</div>
<button type="button" class="gc-sdk-btn" data-act="ready" aria-pressed="${this.ready?`true`:`false`}">${r(`gamepad`)}${t(`Готовий грати`)}</button></section>`}ready=!1;familyCard(){let e=this.family,n=e=>`$`+e.toLocaleString(this.o.locale),a=e.members.slice(0,6).map(e=>`<div class="gc-sdk-slot">${this.avatar(e.name,e.avatar,e.online)}<span class="gc-sdk-grow"><span class="gc-sdk-title" style="display:block">${i(e.name)}</span><span class="gc-sdk-sub">${i(e.rank??``)}</span></span></div>`).join(``);return`<section class="gc-sdk-card gc-sdk-frosted-glass gc-sdk-interactive" data-w="family" style="${this.corner(this.o.position.family)}">
<div class="gc-sdk-card-head">${r(`crown`)}<span class="gc-sdk-grow gc-sdk-title">${i(e.name)} <span class="gc-sdk-sub">[${i(e.tag)}]</span></span><span class="gc-sdk-sub">${t(`{n} онлайн`,{n:e.online})}</span></div>
<div class="gc-sdk-stats"><div class="gc-sdk-slot gc-sdk-stat"><span class="gc-sdk-sub">${t(`Казна штабу`)}</span><b>${n(e.treasury)}</b></div><div class="gc-sdk-slot gc-sdk-stat"><span class="gc-sdk-sub">${t(`Мій баланс`)}</span><b>${n(e.my_balance)}</b></div></div>
<div class="gc-sdk-list">${a}</div></section>`}drop(){let e=this.o.side,n=e===`top`?`left:${this.o.offset}%;`:`top:${this.o.offset}%;`,i=e===`top`?this.open?`up`:`down`:e===`left`===this.open?`left`:`right`,a=e===`top`?`left:${this.o.offset}%;`:`top:${this.o.offset}%;`;return`<button type="button" data-act="toggle" class="gc-sdk-drop gc-sdk-frosted-glass gc-sdk-interactive" data-side="${e}" style="${n}" aria-expanded="${this.open}" aria-label="${t(`Відкрити GameCon`)}">${r(i)}</button>
<section class="gc-sdk-panel gc-sdk-frosted-glass" data-side="${e}" data-open="${+!!this.open}" style="${a}" role="dialog" aria-label="GameCon">${this.panelBody()}</section>`}panelBody(){let e=`<div class="gc-sdk-row">${this.o.logo?`<span class="gc-sdk-logo" style="background-image:url('${i(this.o.logo)}')"></span>`:`<span class="gc-sdk-logo">G</span>`}<span class="gc-sdk-grow gc-sdk-title">${i(this.o.title||`GameCon`)}</span><button type="button" class="gc-sdk-icon-btn" data-act="close" aria-label="${t(`Закрити`)}">${r(`x`)}</button></div>`;return this.user?`${e}<div class="gc-sdk-tabs" role="tablist">${this.o.tabs.map(e=>`<button type="button" class="gc-sdk-tab" role="tab" data-tab="${e}" aria-selected="${this.tab===e}" title="${i(t(s[e]))}">${r(o[e])}</button>`).join(``)}</div><div class="gc-sdk-body">${this.tabBody()}</div>`:e+this.loginBody()}loginBody(){return this.device?`<div class="gc-sdk-body" style="align-items:center;text-align:center;gap:10px">
<img alt="" width="132" height="132" style="border-radius:14px;background:#fff;padding:6px" src="${i(this.o.base)}/link/qr.svg?code=${encodeURIComponent(this.device.user_code)}">
<div class="gc-sdk-sub">${t(`Скануйте QR у застосунку GameCon або відкрийте gamecon.online/link і введіть код`)}</div>
<div style="font:600 22px ui-monospace,monospace;letter-spacing:.2em">${i(this.device.user_code)}</div></div>`:`<div class="gc-sdk-body" style="gap:10px"><div class="gc-sdk-sub">${t(`Увійдіть через GameCon, щоб бачити друзів, чат, голос і свою сім’ю просто в грі.`)}</div>
<button type="button" class="gc-sdk-btn" data-act="login">${r(`login`)}${t(`Увійти через GameCon`)}</button>
<div class="gc-sdk-sub">${t(`Немає акаунта? Його можна створити за хвилину під час входу.`)}</div></div>`}tabBody(){switch(this.tab){case`friends`:return this.friends.map(e=>`<div class="gc-sdk-slot">${this.avatar(e.name,e.avatar_url,e.online)}<span class="gc-sdk-grow"><span class="gc-sdk-title" style="display:block">${i(e.name)}</span><span class="gc-sdk-sub">${i(e.presence?.status??(e.online?t(`Онлайн`):t(`Не в мережі`)))}</span></span>${e.online?`<button type="button" class="gc-sdk-btn" style="height:26px;padding:0 9px;font-size:11px" data-act="invite" data-user="${i(e.username)}">${t(`Покликати`)}</button>`:``}</div>`).join(``)||`<div class="gc-sdk-sub">${t(`Друзів поки немає`)}</div>`;case`chat`:return this.convs.map(e=>`<button type="button" class="gc-sdk-slot" data-act="conv" data-id="${e.id}">${r(`chat`)}<span class="gc-sdk-grow gc-sdk-title">${i(e.title)}</span>${e.unread?`<span class="gc-sdk-dot"></span>`:``}</button>`).join(``);case`voice`:return this.party.length?this.party.map(e=>`<div class="gc-sdk-slot">${this.avatar(e.name,e.avatar,e.online)}<span class="gc-sdk-grow gc-sdk-title">${i(e.name)}</span><span class="${e.mic===`speaking`?`gc-sdk-live`:`gc-sdk-mute`}">${r(e.mic===`off`?`micOff`:`mic`)}</span></div>`).join(``):`<div class="gc-sdk-sub">${t(`Голосовий канал порожній`)}</div>`;case`groups`:return this.family?`<div class="gc-sdk-slot">${r(`crown`)}<span class="gc-sdk-grow gc-sdk-title">${i(this.family.name)}</span><span class="gc-sdk-sub">${t(`{n} онлайн`,{n:this.family.online})}</span></div><div class="gc-sdk-slot">${r(`wallet`)}<span class="gc-sdk-grow">${t(`Казна штабу`)}</span><b>$${this.family.treasury.toLocaleString(this.o.locale)}</b></div>`:`<div class="gc-sdk-sub">${t(`Ви ще не в сім’ї чи клані`)}</div>`;case`music`:return this.track?`<div class="gc-sdk-slot">${r(`music`)}<span class="gc-sdk-grow"><span class="gc-sdk-title" style="display:block">${i(this.track.title)}</span><span class="gc-sdk-sub">${i(this.track.artist)}</span></span><button type="button" class="gc-sdk-icon-btn" data-act="music" data-cmd="${this.track.playing?`pause`:`play`}" aria-label="${this.track.playing?t(`Пауза`):t(`Грати`)}">${r(this.track.playing?`pause`:`play`)}</button><button type="button" class="gc-sdk-icon-btn" data-act="music" data-cmd="next" aria-label="${t(`Далі`)}">${r(`next`)}</button></div>`:`<div class="gc-sdk-sub">${t(`Зараз нічого не грає`)}</div>`;case`achievements`:return`<div class="gc-sdk-slot">${r(`trophy`)}<span class="gc-sdk-grow">${t(`Досягнення гри з’являться тут`)}</span></div>`}return``}drawer(){let e=this.convs.map(e=>`<button type="button" class="gc-sdk-chip" role="tab" data-act="conv" data-id="${e.id}" aria-selected="${e.id===this.conv}">${i(e.title)}</button>`).join(``),n=this.msgs.map(e=>`<div class="gc-sdk-bubble" data-mine="${+!!e.mine}">${e.author&&!e.mine?`<div class="gc-sdk-sub">${i(e.author)}</div>`:``}${i(e.body)}</div>`).join(``);return`<aside class="gc-sdk-drawer gc-sdk-frosted-glass ${this.chatOpen?`gc-sdk-interactive`:``}" data-open="${+!!this.chatOpen}" aria-hidden="${!this.chatOpen}">
<div class="gc-sdk-row">${r(`chat`)}<span class="gc-sdk-grow gc-sdk-title">${t(`Чат GameCon`)}</span><span class="gc-sdk-kbd">${i(this.o.hotkeys.chat)}</span><button type="button" class="gc-sdk-icon-btn" data-act="chat-close" aria-label="${t(`Закрити`)}">${r(`x`)}</button></div>
<div class="gc-sdk-convs" role="tablist">${e}</div><div class="gc-sdk-messages">${n||`<div class="gc-sdk-sub">${this.user?t(`Повідомлень поки немає`):t(`Увійдіть, щоб писати друзям`)}</div>`}</div>
<form class="gc-sdk-input"><input placeholder="${t(`Повідомлення…`)}" aria-label="${t(`Повідомлення…`)}" ${this.user?``:`disabled`}><button type="submit" class="gc-sdk-btn" aria-label="${t(`Надіслати`)}" ${this.user?``:`disabled`}>${r(`send`)}</button></form></aside>`}onClick(e){let n=e.target.closest(`[data-act],[data-tab]`);if(n&&!this.dragged){if(n.dataset.tab){this.tab=n.dataset.tab,this.tab===`chat`&&this.o.modules.includes(`chat`)&&this.openChat(!0),this.render();return}switch(n.dataset.act){case`toggle`:return!this.user&&!this.o.demo&&n.classList.contains(`gc-sdk-pill`)?void this.login():this.toggle();case`close`:return this.toggle(!1);case`chat-close`:return this.openChat(!1);case`login`:this.login();return;case`ready`:this.ready=!this.ready,this.setPresence(this.ready?t(`Готовий грати`):null),this.render(),this.ready&&this.toast(t(`Друзі бачать, що ви готові грати`),void 0,`gamepad`);return;case`invite`:this.invite(n.dataset.user??``,`lobby`);return;case`conv`:this.conv=Number(n.dataset.id),this.o.demo&&(this.msgs=c.messages[this.conv]??[]),this.openChat(!0),this.loadMessages().then(()=>this.render());return;case`music`:{let e=n.dataset.cmd??`play`;this.track&&e!==`next`&&(this.track={...this.track,playing:e===`play`}),this.render(),this.o.demo||this.api(`music/command`,{method:`POST`,body:JSON.stringify({command:e})}).catch(()=>void 0);return}}}}bindKeys(){let e=(e,t)=>{let n=e.split(`+`).map(e=>e.trim().toLowerCase()),r=n.pop();return n.includes(`shift`)===t.shiftKey&&n.includes(`alt`)===t.altKey&&n.includes(`ctrl`)===t.ctrlKey&&n.includes(`meta`)===t.metaKey&&(t.key.toLowerCase()===r||t.code.toLowerCase()===`key${r}`||t.code.toLowerCase()===r)},t=t=>{e(this.o.hotkeys.toggle,t)?(t.preventDefault(),this.toggle()):e(this.o.hotkeys.chat,t)?(t.preventDefault(),this.openChat()):t.key===`Escape`&&(this.open||this.chatOpen)&&(this.open=this.chatOpen=!1,this.vp.dataset.mode=`hud`,this.render())};if(window.addEventListener(`keydown`,t,!0),this.cleanup.push(()=>window.removeEventListener(`keydown`,t,!0)),this.o.gamepad&&`getGamepads`in navigator){let e=!1,t=window.setInterval(()=>{let t=Array.from(navigator.getGamepads?.()??[]).some(e=>e?.buttons?.[16]?.pressed);t&&!e&&this.toggle(),e=t},120);this.timers.push(t)}if(this.o.swipe){let e=0,t=0,n=n=>{e=n.touches[0].clientX,t=n.touches[0].clientY},r=n=>{let r=n.changedTouches[0],i=window.innerWidth,a=r.clientX-e,o=r.clientY-t,s=this.o.side;(s===`left`&&e<24&&a>60||s===`right`&&e>i-24&&a<-60||s===`top`&&t<24&&o>60)&&this.toggle(!0)};window.addEventListener(`touchstart`,n,{passive:!0}),window.addEventListener(`touchend`,r,{passive:!0}),this.cleanup.push(()=>{window.removeEventListener(`touchstart`,n),window.removeEventListener(`touchend`,r)})}let n=e=>{let t=e.data;if(!t||t.target!==`gamecon-sdk`||!t.cmd)return;let n=this[t.cmd];typeof n==`function`&&[`toggle`,`openChat`,`setBusy`,`setMode`,`toast`,`configure`,`login`,`logout`,`setPresence`].includes(t.cmd)&&n.apply(this,t.args??[])};window.addEventListener(`message`,n),this.cleanup.push(()=>window.removeEventListener(`message`,n))}dragged=!1;enableDrag(){this.vp.querySelectorAll(`[data-w]`).forEach(e=>{let t=e.querySelector(`.gc-sdk-card-head`)??e;t.onpointerdown=t=>{if(t.target.closest(`.gc-sdk-btn,.gc-sdk-icon-btn`))return;let n=this.vp.getBoundingClientRect(),r=e.getBoundingClientRect(),i=t.clientX-r.left,a=t.clientY-r.top,o=!1;e.classList.add(`gc-sdk-dragging`);let s=t=>{o=!0;let s=Math.max(0,Math.min(n.width-r.width,t.clientX-n.left-i)),c=Math.max(0,Math.min(n.height-r.height,t.clientY-n.top-a));e.style.cssText+=`left:${s}px;top:${c}px;right:auto;bottom:auto;`},c=t=>{if(window.removeEventListener(`pointermove`,s),window.removeEventListener(`pointerup`,c),e.classList.remove(`gc-sdk-dragging`),!o)return;this.dragged=!0,setTimeout(()=>this.dragged=!1,0);let r=t.clientX-n.left<n.width/2?`left`:`right`,i=t.clientY-n.top<n.height/2?`top`:`bottom`,a=e.dataset.w;this.o.position[a]=`${i}-${r}`,this.emit(`move`,{widget:a,corner:this.o.position[a]}),this.render()};window.addEventListener(`pointermove`,s),window.addEventListener(`pointerup`,c)}})}setGiven(e){this.given=e}};function u(e){let t=``;return e.forEach(e=>t+=String.fromCharCode(e)),btoa(t).replace(/\+/g,`-`).replace(/\//g,`_`).replace(/=+$/,``)}var d={version:`1.0.0`,instance:null,async init(e={}){d.instance?.destroy();let t=new l(e);return t.setGiven(e),d.instance=t,t.start()}};return window.GameConSDK=d,d})();