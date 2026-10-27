import { getContext, extension_settings } from '../../../extensions.js';

const PREF_KEY = 'bot_browser_prefs';
const FAV_KEY = 'bot_browser_favs';     // local favorites (this browser only)
const EXT_KEY = 'bot_browser';           // synced favorites live in extension_settings[EXT_KEY].favorites
const BATCH = 40;
const LONG_NOTES = 220;

/* ---------- i18n ---------- */
const I18N = {
    en: {
        wand: 'Bot Browser',
        title: 'Bots',
        count_of: '{a} of {b}',
        search_ph: 'Search name, notes or tags',
        sort_aria: 'Sort',
        sort_newest: 'Newest first',
        sort_oldest: 'Oldest first',
        sort_az: 'A to Z',
        sort_za: 'Z to A',
        sort_chatted: 'Recently chatted',
        tags: 'Tags',
        expand_all: 'Expand all',
        collapse_all: 'Collapse all',
        find_tag: 'Find a tag',
        clear_tags: 'Clear tags',
        no_tags: 'No tags found',
        tag_hint: 'Pick Include or Exclude, then tap tags. Tags on cards cycle: include, exclude, off.',
        mode_include: 'Include',
        mode_exclude: 'Exclude',
        empty: 'No bots match. Try fewer tags or a different search.',
        show_more: 'Show more',
        show_less: 'Show less',
        open_chat: 'Open chat',
        open_aria: 'Open {name}',
        no_notes: "No creator's notes",
        close: 'Close',
        settings: 'Settings',
        language: 'Language',
        lang_auto: 'Auto',
        opacity: 'Opacity',
        remove_tag: 'Remove tag',
        unnamed: 'Unnamed',
        tab_all: 'All',
        tab_fav: 'Favorites',
        fav_add: 'Add to favorites',
        fav_remove: 'Remove from favorites',
        fav_empty: 'No favorites yet. Tap the star on any bot to add it.',
        sync_favs: 'Sync favorites',
        sync_hint: 'On: saved in your SillyTavern settings, shared across devices. Off: saved only in this browser. Switching merges or keeps a copy, nothing is lost.',
        sync_na: 'Sync is not available in this SillyTavern version.',
        surprise: 'Surprise me',
        surprise_n_ph: 'How many bots?',
        surprise_need_n: 'Enter a number first (1 or more).',
        surprise_banner: 'Random picks: {a} of {b} matching',
        surprise_again: 'Shuffle again',
        surprise_exit: 'Show all',
    },
    ru: {
        wand: 'Браузер ботов',
        title: 'Боты',
        count_of: '{a} из {b}',
        search_ph: 'Поиск по имени, заметкам и тегам',
        sort_aria: 'Сортировка',
        sort_newest: 'Сначала новые',
        sort_oldest: 'Сначала старые',
        sort_az: 'По алфавиту А–Я',
        sort_za: 'По алфавиту Я–А',
        sort_chatted: 'Недавние чаты',
        tags: 'Теги',
        expand_all: 'Развернуть все',
        collapse_all: 'Свернуть все',
        find_tag: 'Найти тег',
        clear_tags: 'Сбросить теги',
        no_tags: 'Теги не найдены',
        tag_hint: 'Выберите «Включить» или «Исключить» и нажимайте на теги. Теги на карточках переключаются: включить, исключить, выкл.',
        mode_include: 'Включить',
        mode_exclude: 'Исключить',
        empty: 'Ничего не найдено. Уберите часть тегов или измените запрос.',
        show_more: 'Развернуть',
        show_less: 'Свернуть',
        open_chat: 'Открыть чат',
        open_aria: 'Открыть {name}',
        no_notes: 'Нет заметок автора',
        close: 'Закрыть',
        settings: 'Настройки',
        language: 'Язык',
        lang_auto: 'Авто',
        opacity: 'Прозрачность окна',
        remove_tag: 'Убрать тег',
        unnamed: 'Без имени',
        tab_all: 'Все',
        tab_fav: 'Избранное',
        fav_add: 'В избранное',
        fav_remove: 'Убрать из избранного',
        fav_empty: 'Избранного пока нет. Нажмите на звезду у любого бота.',
        sync_favs: 'Синхронизировать избранное',
        sync_hint: 'Вкл: хранится в настройках SillyTavern и доступно на всех устройствах. Выкл: только в этом браузере. При переключении списки объединяются или копируются, ничего не теряется.',
        sync_na: 'Синхронизация недоступна в этой версии SillyTavern.',
        surprise: 'Удиви меня',
        surprise_n_ph: 'Сколько ботов?',
        surprise_need_n: 'Сначала введите число (1 или больше).',
        surprise_banner: 'Случайные: {a} из {b} подходящих',
        surprise_again: 'Ещё раз',
        surprise_exit: 'Показать все',
    },
};

const S = {
    items: [],
    view: [],
    query: '',
    sort: 'newest',
    lang: 'auto',
    opacity: 100,
    sync: false,
    tab: 'all',
    surprise: null,      // { shown, total } while random picks are displayed
    favs: new Set(),     // avatar filenames
    tags: new Set(),     // must have
    exclude: new Set(),  // must not have
    tagQuery: '',
    tagMode: 'include',
    allOpen: false,
    flip: new Set(),     // ids whose open state differs from the allOpen default
    rendered: 0,
    built: false,
};

const effLang = () => (S.lang === 'auto'
    ? ((navigator.language || 'en').toLowerCase().startsWith('ru') ? 'ru' : 'en')
    : S.lang);
const t = (k, v = {}) => String(I18N[effLang()][k] ?? I18N.en[k] ?? k).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? '');

const SORTS = {
    newest: (a, b) => b.added - a.added || b.id - a.id,
    oldest: (a, b) => a.added - b.added || a.id - b.id,
    az: (a, b) => cmpName(a, b),
    za: (a, b) => cmpName(b, a),
    chatted: (a, b) => b.lastChat - a.lastChat || cmpName(a, b),
};

const $id = (id) => document.getElementById(id);
const cmpName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- prefs ---------- */
function loadPrefs() {
    try {
        const p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
        if (SORTS[p.sort]) S.sort = p.sort;
        if (['auto', 'en', 'ru'].includes(p.lang)) S.lang = p.lang;
        const o = Number(p.opacity);
        if (o >= 20 && o <= 100) S.opacity = o;
        S.sync = p.sync === true;
    } catch { /* ignore */ }
}
function savePrefs() {
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ sort: S.sort, lang: S.lang, opacity: S.opacity, sync: S.sync })); } catch { /* ignore */ }
}

/* ---------- favorites ---------- */
function syncStore() {
    try {
        if (!extension_settings) return null;
        const st = (extension_settings[EXT_KEY] ??= {});
        if (!Array.isArray(st.favorites)) st.favorites = [];
        return st;
    } catch { return null; }
}
const canSync = () => !!syncStore();
const cleanList = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string' && x) : []);

function readLocalFavs() {
    try { return cleanList(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')); } catch { return []; }
}
function writeLocalFavs(list) {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}
function writeSyncedFavs(list) {
    const st = syncStore();
    if (!st) return false;
    st.favorites = list;
    try { (getContext().saveSettingsDebounced || (() => {}))(); } catch { /* ignore */ }
    return true;
}

function loadFavs() {
    const st = S.sync ? syncStore() : null;
    if (S.sync && !st) S.sync = false; // sync unavailable here, fall back to local
    S.favs = new Set(S.sync ? cleanList(st.favorites) : readLocalFavs());
}
function persistFavs() {
    const list = [...S.favs];
    if (S.sync) writeSyncedFavs(list); else writeLocalFavs(list);
}

// Turning sync on merges this browser's list into the account list.
// Turning it off keeps a copy of the account list in this browser.
function setSync(on) {
    if (on && !canSync()) return false;
    const synced = canSync() ? cleanList(syncStore().favorites) : [];
    if (on) {
        S.favs = new Set([...synced, ...readLocalFavs(), ...S.favs]);
        S.sync = true;
    } else {
        S.sync = false; // current list is kept as-is and written to this browser
    }
    persistFavs();
    savePrefs();
    return true;
}

/* ---------- theme / opacity ---------- */
function themeRgb() {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeBlurTintColor').trim();
    if (/^#/.test(v)) {
        let h = v.slice(1);
        if (h.length < 6) h = h.split('').map((c) => c + c).join('');
        return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    const n = v.match(/[\d.]+/g);
    if (n && n.length >= 3) return n.slice(0, 3).map(Number);
    return [29, 29, 36];
}

function applyOpacity() {
    const el = $id('bb-overlay');
    if (!el) return;
    const [r, g, b] = themeRgb();
    const a = S.opacity / 100;
    el.style.setProperty('--bb-shell-bg', `rgba(${r}, ${g}, ${b}, ${a})`);
    el.style.setProperty('--bb-sticky-bg', `rgba(${r}, ${g}, ${b}, ${Math.max(a, 0.92)})`);
    el.style.setProperty('--bb-blur', a < 1 ? '8px' : '0px');
    $id('bb-op-val').textContent = `${S.opacity}%`;
}

/* ---------- data ---------- */
function toPlain(raw) {
    if (!raw) return '';
    const html = String(raw)
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|h[1-6])>/gi, '\n');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return (doc.body.textContent || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

function buildItems() {
    const ctx = getContext();
    const tagById = new Map((ctx.tags || []).map((tg) => [tg.id, tg.name]));
    S.items = (ctx.characters || []).map((c, i) => {
        const notes = toPlain(c.data?.creator_notes ?? c.creatorcomment ?? '');
        let tags = (ctx.tagMap?.[c.avatar] || []).map((id) => tagById.get(id)).filter(Boolean);
        if (!tags.length) tags = (c.data?.tags || c.tags || []).map((x) => String(x).trim()).filter(Boolean);
        const name = c.name || t('unnamed');
        return {
            id: i,
            name,
            avatar: c.avatar,
            notes,
            tags,
            added: Number(c.date_added) || 0,
            lastChat: Number(c.date_last_chat) || 0,
            long: notes.length > LONG_NOTES || (notes.match(/\n/g) || []).length > 3,
            hay: `${name}\n${notes}\n${tags.join(' ')}`.toLowerCase(),
        };
    });
    const known = new Set(S.items.flatMap((it) => it.tags));
    for (const set of [S.tags, S.exclude]) for (const x of [...set]) if (!known.has(x)) set.delete(x);
}

function applyFilters() {
    const q = S.query.trim().toLowerCase();
    const words = q ? q.split(/\s+/) : [];
    S.view = S.items
        .filter((it) => S.tab !== 'fav' || S.favs.has(it.avatar))
        .filter((it) => [...S.tags].every((x) => it.tags.includes(x)))
        .filter((it) => ![...S.exclude].some((x) => it.tags.includes(x)))
        .filter((it) => words.every((w) => it.hay.includes(w)))
        .sort(SORTS[S.sort]);
}

/* ---------- rendering ---------- */
const isOpen = (id) => S.allOpen !== S.flip.has(id);
const avatarUrl = (a) => `/thumbnail?type=avatar&file=${encodeURIComponent(a)}`;
const tagState = (x) => (S.tags.has(x) ? ' is-on' : S.exclude.has(x) ? ' is-off' : '');

function favBtnHtml(on) {
    return `<button type="button" class="bb-btn bb-fav${on ? ' is-fav' : ''}" data-act="fav" aria-pressed="${on}" aria-label="${esc(t(on ? 'fav_remove' : 'fav_add'))}" title="${esc(t(on ? 'fav_remove' : 'fav_add'))}"><i class="${on ? 'fa-solid' : 'fa-regular'} fa-star"></i></button>`;
}

function cardHtml(it) {
    const open = isOpen(it.id);
    const tags = it.tags.map((x) => `<button type="button" class="bb-tag${tagState(x)}" data-tag="${esc(x)}">${esc(x)}</button>`).join('');
    const notes = it.notes
        ? `<div class="bb-notes">${esc(it.notes)}</div>`
        : `<div class="bb-notes bb-none">${esc(t('no_notes'))}</div>`;
    const less = it.long
        ? `<button type="button" class="bb-btn bb-less" aria-expanded="${open}"><i class="fa-solid fa-chevron-up"></i><span>${esc(t('show_less'))}</span></button>`
        : '';
    const more = it.long
        ? `<button type="button" class="bb-more" aria-expanded="${open}"><i class="fa-solid fa-chevron-down"></i> <span>${esc(t('show_more'))}</span></button>`
        : '';
    const fav = S.favs.has(it.avatar);
    return `<article class="bb-card${open ? ' is-open' : ''}" data-id="${it.id}">
        <button type="button" class="bb-av" data-act="open" aria-label="${esc(t('open_aria', { name: it.name }))}"><img loading="lazy" alt="" src="${avatarUrl(it.avatar)}"></button>
        <div class="bb-body">
            <div class="bb-top">
                <h3 class="bb-name">${esc(it.name)}</h3>
                ${favBtnHtml(fav)}
                ${less}
                <button type="button" class="bb-btn bb-go" data-act="open"><i class="fa-solid fa-comment"></i><span>${esc(t('open_chat'))}</span></button>
            </div>
            ${tags ? `<div class="bb-tags">${tags}</div>` : ''}
            ${notes}
            ${more}
        </div>
    </article>`;
}

function syncCard(card) {
    const open = isOpen(Number(card.dataset.id));
    card.classList.toggle('is-open', open);
    card.querySelectorAll('.bb-more, .bb-less').forEach((b) => b.setAttribute('aria-expanded', String(open)));
}

function renderList(reset = true) {
    const grid = $id('bb-grid');
    if (reset) {
        grid.innerHTML = '';
        S.rendered = 0;
        $id('bb-scroll').scrollTop = 0;
    }
    const next = S.view.slice(S.rendered, S.rendered + BATCH);
    grid.insertAdjacentHTML('beforeend', next.map(cardHtml).join(''));
    S.rendered += next.length;
    updateCount();
}

function favTotal() {
    return S.items.reduce((n, it) => n + (S.favs.has(it.avatar) ? 1 : 0), 0);
}

function updateCount() {
    const empty = $id('bb-empty');
    empty.hidden = S.view.length > 0;
    empty.textContent = t(S.tab === 'fav' && !favTotal() ? 'fav_empty' : 'empty');
    $id('bb-count').textContent = S.view.length === S.items.length
        ? `${S.items.length}`
        : t('count_of', { a: S.view.length, b: S.items.length });
    const n = favTotal();
    $id('bb-fav-n').textContent = n ? String(n) : '';
}

function syncTabs() {
    document.querySelectorAll('#bb-overlay .bb-tabbtn').forEach((b) => {
        const on = b.dataset.tab === S.tab;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', String(on));
    });
}

function toggleFav(id, card) {
    const it = S.items[id];
    if (!it) return;
    const on = !S.favs.has(it.avatar);
    if (on) S.favs.add(it.avatar); else S.favs.delete(it.avatar);
    persistFavs();
    if (S.tab === 'fav' && !on) {
        // leaves the Favorites tab right away
        card.remove();
        S.view = S.view.filter((v) => v.id !== id);
        S.rendered = Math.max(0, S.rendered - 1);
    } else {
        const btn = card.querySelector('.bb-fav');
        btn.classList.toggle('is-fav', on);
        btn.setAttribute('aria-pressed', String(on));
        btn.setAttribute('aria-label', t(on ? 'fav_remove' : 'fav_add'));
        btn.title = t(on ? 'fav_remove' : 'fav_add');
        btn.firstElementChild.className = `${on ? 'fa-solid' : 'fa-regular'} fa-star`;
    }
    updateCount();
}

function renderTagPanel() {
    const counts = new Map();
    S.items.forEach((it) => it.tags.forEach((x) => counts.set(x, (counts.get(x) || 0) + 1)));
    const tq = S.tagQuery.trim().toLowerCase();
    const list = [...counts.entries()]
        .filter(([x]) => !tq || x.toLowerCase().includes(tq))
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    $id('bb-chips').innerHTML = list.length
        ? list.map(([x, n]) => `<button type="button" class="bb-chip${tagState(x)}" data-tag="${esc(x)}">${esc(x)} <span>${n}</span></button>`).join('')
        : `<span class="bb-muted">${esc(t('no_tags'))}</span>`;
}

function renderActive() {
    const n = S.tags.size + S.exclude.size;
    $id('bb-tags-n').textContent = n ? String(n) : '';
    $id('bb-tags-btn').classList.toggle('is-on', n > 0);
    const chip = (x, cls) => `<button type="button" class="bb-chip ${cls}" data-tag="${esc(x)}" data-remove="1" aria-label="${esc(t('remove_tag'))} ${esc(x)}">${esc(x)} <i class="fa-solid fa-xmark"></i></button>`;
    $id('bb-active').innerHTML = [
        ...[...S.tags].map((x) => chip(x, 'is-on')),
        ...[...S.exclude].map((x) => chip(x, 'is-off')),
    ].join('');
}

function refresh() {
    S.surprise = null; // any filter, search, sort or tab change leaves surprise mode
    applyFilters();
    renderActive();
    renderList(true);
    renderSurprise();
    if (!$id('bb-tagpanel').hidden) renderTagPanel();
}

/* ---------- surprise ---------- */
function renderSurprise() {
    const bar = $id('bb-surprise');
    bar.hidden = !S.surprise;
    if (S.surprise) $id('bb-sur-text').textContent = t('surprise_banner', { a: S.surprise.shown, b: S.surprise.total });
}

function setNeedN(on) {
    $id('bb-n').classList.toggle('is-bad', on);
    $id('bb-n-err').hidden = !on;
}

// Random bots from whatever the current tag filters allow (all bots when no tags are picked).
// Search text and the Favorites tab still apply, so the pool is exactly what the list would show.
function runSurprise() {
    const inp = $id('bb-n');
    const n = Math.floor(Number(inp.value));
    if (!inp.value.trim() || !(n >= 1)) { setNeedN(true); inp.focus(); return; }
    setNeedN(false);
    applyFilters();
    const pool = S.view.slice();
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    S.view = pool.slice(0, n);
    S.surprise = { shown: S.view.length, total: pool.length };
    renderActive();
    renderList(true);
    renderSurprise();
}

// neutral -> include -> exclude -> neutral
function cycleTag(x) {
    if (S.tags.has(x)) { S.tags.delete(x); S.exclude.add(x); }
    else if (S.exclude.has(x)) { S.exclude.delete(x); }
    else { S.tags.add(x); }
    refresh();
}

function setTag(x, mode) {
    const set = mode === 'exclude' ? S.exclude : S.tags;
    const other = mode === 'exclude' ? S.tags : S.exclude;
    if (set.has(x)) set.delete(x);
    else { set.add(x); other.delete(x); }
    refresh();
}

function syncMode() {
    document.querySelectorAll('#bb-tagpanel .bb-segbtn').forEach((b) => b.classList.toggle('is-active', b.dataset.mode === S.tagMode));
    $id('bb-tagpanel').classList.toggle('bb-mode-exclude', S.tagMode === 'exclude');
}

function removeTag(x) {
    S.tags.delete(x);
    S.exclude.delete(x);
    refresh();
}

function applyLang() {
    const el = $id('bb-overlay');
    if (el) {
        el.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
        el.querySelectorAll('[data-i18n-ph]').forEach((n) => { n.placeholder = t(n.dataset.i18nPh); });
        el.querySelectorAll('[data-i18n-aria]').forEach((n) => n.setAttribute('aria-label', t(n.dataset.i18nAria)));
        $id('bb-expand').textContent = t(S.allOpen ? 'collapse_all' : 'expand_all');
        el.setAttribute('aria-label', t('wand'));
        const sw = $id('bb-sync');
        const na = !canSync();
        sw.disabled = na;
        $id('bb-sync-hint').textContent = t(na ? 'sync_na' : 'sync_hint');
        document.querySelectorAll('#bb-grid .bb-fav').forEach((b) => {
            const on = b.classList.contains('is-fav');
            b.setAttribute('aria-label', t(on ? 'fav_remove' : 'fav_add'));
            b.title = t(on ? 'fav_remove' : 'fav_add');
        });
    }
    const w = $id('bb-wand-label');
    if (w) w.textContent = t('wand');
    const b = $id('bb-list-btn');
    if (b) b.title = t('wand');
}

/* ---------- actions ---------- */
async function openCharacter(id) {
    closeBrowser();
    const ctx = getContext();
    try {
        await ctx.selectCharacterById(Number(id));
    } catch {
        jQuery(`#rm_print_characters_block .character_select[chid="${id}"]`).trigger('click');
    }
}

function setAllOpen(open) {
    S.allOpen = open;
    S.flip.clear();
    document.querySelectorAll('#bb-grid .bb-card').forEach(syncCard);
    $id('bb-expand').textContent = t(open ? 'collapse_all' : 'expand_all');
}

function debounce(fn, ms) {
    let timer;
    return (...a) => { clearTimeout(timer); timer = setTimeout(() => fn(...a), ms); };
}

/* ---------- overlay ---------- */
function build() {
    if (S.built) return;
    S.built = true;
    const el = document.createElement('div');
    el.id = 'bb-overlay';
    el.className = 'bb-overlay';
    el.hidden = true;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.innerHTML = `
    <div class="bb-shell">
        <header class="bb-head">
            <div class="bb-row">
                <h2 class="bb-title"><span data-i18n="title"></span> <span id="bb-count" class="bb-muted"></span></h2>
                <button type="button" id="bb-gear" class="bb-icon" data-i18n-aria="settings"><i class="fa-solid fa-gear"></i></button>
                <button type="button" id="bb-close" class="bb-icon" data-i18n-aria="close"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div id="bb-settings" class="bb-pop" hidden>
                <label class="bb-field"><span data-i18n="language"></span>
                    <select id="bb-lang">
                        <option value="auto" data-i18n="lang_auto"></option>
                        <option value="en">English</option>
                        <option value="ru">Русский</option>
                    </select>
                </label>
                <label class="bb-field"><span data-i18n="opacity"></span>
                    <span class="bb-range"><input id="bb-op" type="range" min="20" max="100" step="5"><output id="bb-op-val"></output></span>
                </label>
                <label class="bb-field"><span data-i18n="sync_favs"></span>
                    <input id="bb-sync" type="checkbox" class="bb-sw">
                </label>
                <div id="bb-sync-hint" class="bb-hint" data-i18n="sync_hint"></div>
            </div>
            <label class="bb-search">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input id="bb-q" type="search" data-i18n-ph="search_ph" autocomplete="off" enterkeyhint="search">
            </label>
            <div class="bb-seg bb-tabs" role="tablist">
                <button type="button" class="bb-tabbtn is-active" role="tab" data-tab="all"><i class="fa-solid fa-table-cells-large"></i> <span data-i18n="tab_all"></span></button>
                <button type="button" class="bb-tabbtn" role="tab" data-tab="fav"><i class="fa-solid fa-star"></i> <span data-i18n="tab_fav"></span> <b id="bb-fav-n" class="bb-badge"></b></button>
            </div>
            <div class="bb-row bb-tools">
                <select id="bb-sort" data-i18n-aria="sort_aria">
                    <option value="newest" data-i18n="sort_newest"></option>
                    <option value="oldest" data-i18n="sort_oldest"></option>
                    <option value="az" data-i18n="sort_az"></option>
                    <option value="za" data-i18n="sort_za"></option>
                    <option value="chatted" data-i18n="sort_chatted"></option>
                </select>
                <button type="button" id="bb-tags-btn" class="bb-btn"><i class="fa-solid fa-tags"></i> <span data-i18n="tags"></span> <b id="bb-tags-n"></b></button>
                <button type="button" id="bb-expand" class="bb-btn"></button>
            </div>
            <div class="bb-row bb-surprise-row">
                <input id="bb-n" type="number" inputmode="numeric" min="1" step="1" data-i18n-ph="surprise_n_ph" autocomplete="off" enterkeyhint="go">
                <button type="button" id="bb-surprise-btn" class="bb-btn"><i class="fa-solid fa-dice"></i> <span data-i18n="surprise"></span></button>
            </div>
            <div id="bb-n-err" class="bb-hint bb-err" data-i18n="surprise_need_n" hidden></div>
            <div id="bb-active" class="bb-chips"></div>
            <div id="bb-surprise" class="bb-banner" hidden>
                <span id="bb-sur-text" class="bb-banner-text"></span>
                <button type="button" id="bb-sur-again" class="bb-btn"><i class="fa-solid fa-shuffle"></i> <span data-i18n="surprise_again"></span></button>
                <button type="button" id="bb-sur-exit" class="bb-btn"><i class="fa-solid fa-xmark"></i> <span data-i18n="surprise_exit"></span></button>
            </div>
            <div id="bb-tagpanel" class="bb-tagpanel" hidden>
                <div class="bb-row">
                    <div class="bb-seg" role="group">
                        <button type="button" class="bb-segbtn is-active" data-mode="include"><i class="fa-solid fa-plus"></i> <span data-i18n="mode_include"></span></button>
                        <button type="button" class="bb-segbtn" data-mode="exclude"><i class="fa-solid fa-minus"></i> <span data-i18n="mode_exclude"></span></button>
                    </div>
                    <button type="button" id="bb-tclear" class="bb-btn" data-i18n="clear_tags"></button>
                </div>
                <input id="bb-tq" type="search" data-i18n-ph="find_tag" autocomplete="off">
                <div class="bb-hint" data-i18n="tag_hint"></div>
                <div id="bb-chips" class="bb-chips bb-chips-scroll"></div>
            </div>
        </header>
        <main id="bb-scroll" class="bb-scroll">
            <div class="bb-inner">
                <div id="bb-grid" class="bb-grid"></div>
                <div id="bb-empty" class="bb-empty" hidden></div>
                <div id="bb-sentinel" aria-hidden="true"></div>
            </div>
        </main>
    </div>`;
    document.body.appendChild(el);

    $id('bb-sort').value = S.sort;
    $id('bb-lang').value = S.lang;
    $id('bb-op').value = String(S.opacity);
    $id('bb-sync').checked = S.sync;

    $id('bb-close').addEventListener('click', closeBrowser);
    $id('bb-gear').addEventListener('click', () => { $id('bb-settings').hidden = !$id('bb-settings').hidden; });
    el.addEventListener('mousedown', (e) => { if (e.target === el) closeBrowser(); });

    $id('bb-q').addEventListener('input', debounce((e) => { S.query = e.target.value; refresh(); }, 150));
    $id('bb-sort').addEventListener('change', (e) => { S.sort = e.target.value; savePrefs(); refresh(); });
    $id('bb-lang').addEventListener('change', (e) => {
        S.lang = e.target.value;
        savePrefs();
        applyLang();
        refresh();
    });
    $id('bb-op').addEventListener('input', (e) => {
        S.opacity = Number(e.target.value);
        applyOpacity();
        savePrefs();
    });

    $id('bb-sync').addEventListener('change', (e) => {
        if (!setSync(e.target.checked)) e.target.checked = false;
        refresh();
    });
    el.querySelectorAll('.bb-tabbtn').forEach((b) => b.addEventListener('click', () => {
        if (S.tab === b.dataset.tab) return;
        S.tab = b.dataset.tab;
        syncTabs();
        refresh();
    }));

    $id('bb-surprise-btn').addEventListener('click', runSurprise);
    $id('bb-sur-again').addEventListener('click', runSurprise);
    $id('bb-sur-exit').addEventListener('click', refresh);
    $id('bb-n').addEventListener('input', () => setNeedN(false));
    $id('bb-n').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); runSurprise(); } });

    $id('bb-tags-btn').addEventListener('click', () => {
        const p = $id('bb-tagpanel');
        p.hidden = !p.hidden;
        if (!p.hidden) renderTagPanel();
    });
    $id('bb-tq').addEventListener('input', debounce((e) => { S.tagQuery = e.target.value; renderTagPanel(); }, 120));
    $id('bb-tclear').addEventListener('click', () => { S.tags.clear(); S.exclude.clear(); refresh(); });
    $id('bb-expand').addEventListener('click', () => setAllOpen(!S.allOpen));

    // header chips + closing the settings popover on outside click
    el.addEventListener('click', (e) => {
        const pop = $id('bb-settings');
        if (!pop.hidden && !e.target.closest('#bb-settings') && !e.target.closest('#bb-gear')) pop.hidden = true;
        const seg = e.target.closest('.bb-segbtn');
        if (seg) { S.tagMode = seg.dataset.mode; syncMode(); return; }
        const chip = e.target.closest('.bb-chip');
        if (!chip) return;
        if (chip.dataset.remove) removeTag(chip.dataset.tag);
        else setTag(chip.dataset.tag, S.tagMode);
    });

    // cards
    $id('bb-grid').addEventListener('click', (e) => {
        const card = e.target.closest('.bb-card');
        if (!card) return;
        const id = Number(card.dataset.id);
        const tag = e.target.closest('.bb-tag');
        if (tag) return cycleTag(tag.dataset.tag);
        if (e.target.closest('.bb-more, .bb-less')) {
            S.flip.has(id) ? S.flip.delete(id) : S.flip.add(id);
            syncCard(card);
            if (!isOpen(id)) card.scrollIntoView({ block: 'nearest' });
            return;
        }
        if (e.target.closest('[data-act="fav"]')) return toggleFav(id, card);
        if (e.target.closest('[data-act="open"]')) openCharacter(id);
    });
    $id('bb-grid').addEventListener('error', (e) => {
        if (e.target.tagName === 'IMG' && !e.target.dataset.fb) {
            e.target.dataset.fb = '1';
            e.target.src = 'img/ai4.png';
        }
    }, true);

    // infinite scroll
    new IntersectionObserver((entries) => {
        if (entries.some((x) => x.isIntersecting) && S.rendered < S.view.length) renderList(false);
    }, { root: $id('bb-scroll'), rootMargin: '600px' }).observe($id('bb-sentinel'));

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || el.hidden) return;
        e.stopPropagation();
        const pop = $id('bb-settings');
        if (!pop.hidden) pop.hidden = true;
        else closeBrowser();
    }, true);
}

function openBrowser() {
    build();
    loadFavs();
    $id('bb-sync').checked = S.sync;
    buildItems();
    $id('bb-overlay').hidden = false;
    document.body.classList.add('bb-lock');
    applyOpacity();
    applyLang();
    syncMode();
    syncTabs();
    refresh();
    if (window.matchMedia('(hover: hover)').matches) $id('bb-q').focus();
}

function closeBrowser() {
    const el = $id('bb-overlay');
    if (el) {
        el.hidden = true;
        $id('bb-settings').hidden = true;
    }
    document.body.classList.remove('bb-lock');
}

/* ---------- entry points ---------- */
function injectButtons() {
    let placed = !!$id('bb-list-btn');
    if (!placed) {
        const btn = document.createElement('div');
        btn.id = 'bb-list-btn';
        btn.className = 'menu_button fa-solid fa-table-cells-large interactable';
        btn.title = t('wand');
        btn.tabIndex = 0;
        btn.setAttribute('role', 'button');
        btn.addEventListener('click', openBrowser);
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBrowser(); }
        });
        const anchor = document.querySelector('#rm_button_group_chats') || document.querySelector('#rm_button_create');
        if (anchor) { anchor.after(btn); placed = true; }
        else {
            const form = document.querySelector('#form_character_search_form');
            if (form) { form.prepend(btn); placed = true; }
        }
    }
    // second entry point: wand / extensions menu
    const menu = $id('extensionsMenu');
    if (menu && !$id('bb-wand-btn')) {
        const item = document.createElement('div');
        item.id = 'bb-wand-btn';
        item.className = 'list-group-item flex-container flexGap5 interactable';
        item.tabIndex = 0;
        item.innerHTML = `<div class="fa-solid fa-table-cells-large extensionsMenuExtensionButton"></div><span id="bb-wand-label">${esc(t('wand'))}</span>`;
        item.addEventListener('click', openBrowser);
        menu.appendChild(item);
    }
    return placed && !!$id('bb-wand-btn');
}

jQuery(() => {
    loadPrefs();
    let tries = 0;
    const timer = setInterval(() => {
        if (injectButtons() || ++tries > 40) clearInterval(timer);
    }, 500);
    try {
        const ctx = getContext();
        ctx.eventSource?.on(ctx.eventTypes?.APP_READY, injectButtons);
    } catch { /* ignore */ }
});
