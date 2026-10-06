import { getContext } from '../../../extensions.js';

const PREF_KEY = 'bot_browser_prefs';
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
        tag_hint: 'Tap a tag: include, then exclude, then off.',
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
        tag_hint: 'Нажмите на тег: включить, затем исключить, затем выкл.',
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
    },
};

const S = {
    items: [],
    view: [],
    query: '',
    sort: 'newest',
    lang: 'auto',
    opacity: 100,
    tags: new Set(),     // must have
    exclude: new Set(),  // must not have
    tagQuery: '',
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
    } catch { /* ignore */ }
}
function savePrefs() {
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ sort: S.sort, lang: S.lang, opacity: S.opacity })); } catch { /* ignore */ }
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
        .filter((it) => [...S.tags].every((x) => it.tags.includes(x)))
        .filter((it) => ![...S.exclude].some((x) => it.tags.includes(x)))
        .filter((it) => words.every((w) => it.hay.includes(w)))
        .sort(SORTS[S.sort]);
}

/* ---------- rendering ---------- */
const isOpen = (id) => S.allOpen !== S.flip.has(id);
const avatarUrl = (a) => `/thumbnail?type=avatar&file=${encodeURIComponent(a)}`;
const tagState = (x) => (S.tags.has(x) ? ' is-on' : S.exclude.has(x) ? ' is-off' : '');

function cardHtml(it) {
    const open = isOpen(it.id);
    const tags = it.tags.map((x) => `<button type="button" class="bb-tag${tagState(x)}" data-tag="${esc(x)}">${esc(x)}</button>`).join('');
    const notes = it.notes
        ? `<div class="bb-notes">${esc(it.notes)}</div>`
        : `<div class="bb-notes bb-none">${esc(t('no_notes'))}</div>`;
    const toggle = it.long
        ? `<button type="button" class="bb-btn bb-toggle" aria-expanded="${open}"><i class="fa-solid fa-chevron-${open ? 'up' : 'down'}"></i><span>${esc(t(open ? 'show_less' : 'show_more'))}</span></button>`
        : '';
    return `<article class="bb-card${open ? ' is-open' : ''}" data-id="${it.id}">
        <button type="button" class="bb-av" data-act="open" aria-label="${esc(t('open_aria', { name: it.name }))}"><img loading="lazy" alt="" src="${avatarUrl(it.avatar)}"></button>
        <div class="bb-body">
            <div class="bb-top">
                <h3 class="bb-name">${esc(it.name)}</h3>
                ${toggle}
                <button type="button" class="bb-btn bb-go" data-act="open"><i class="fa-solid fa-comment"></i><span>${esc(t('open_chat'))}</span></button>
            </div>
            ${tags ? `<div class="bb-tags">${tags}</div>` : ''}
            ${notes}
        </div>
    </article>`;
}

function syncCard(card) {
    const open = isOpen(Number(card.dataset.id));
    card.classList.toggle('is-open', open);
    const b = card.querySelector('.bb-toggle');
    if (b) {
        b.setAttribute('aria-expanded', String(open));
        b.querySelector('i').className = `fa-solid fa-chevron-${open ? 'up' : 'down'}`;
        b.querySelector('span').textContent = t(open ? 'show_less' : 'show_more');
    }
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
    $id('bb-empty').hidden = S.view.length > 0;
    $id('bb-count').textContent = S.view.length === S.items.length
        ? `${S.items.length}`
        : t('count_of', { a: S.view.length, b: S.items.length });
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
    applyFilters();
    renderActive();
    renderList(true);
    if (!$id('bb-tagpanel').hidden) renderTagPanel();
}

// neutral -> include -> exclude -> neutral
function cycleTag(x) {
    if (S.tags.has(x)) { S.tags.delete(x); S.exclude.add(x); }
    else if (S.exclude.has(x)) { S.exclude.delete(x); }
    else { S.tags.add(x); }
    refresh();
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
            </div>
            <label class="bb-search">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input id="bb-q" type="search" data-i18n-ph="search_ph" autocomplete="off" enterkeyhint="search">
            </label>
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
            <div id="bb-active" class="bb-chips"></div>
            <div id="bb-tagpanel" class="bb-tagpanel" hidden>
                <div class="bb-row">
                    <input id="bb-tq" type="search" data-i18n-ph="find_tag" autocomplete="off">
                    <button type="button" id="bb-tclear" class="bb-btn" data-i18n="clear_tags"></button>
                </div>
                <div class="bb-hint" data-i18n="tag_hint"></div>
                <div id="bb-chips" class="bb-chips bb-chips-scroll"></div>
            </div>
        </header>
        <main id="bb-scroll" class="bb-scroll">
            <div class="bb-inner">
                <div id="bb-grid" class="bb-grid"></div>
                <div id="bb-empty" class="bb-empty" data-i18n="empty" hidden></div>
                <div id="bb-sentinel" aria-hidden="true"></div>
            </div>
        </main>
    </div>`;
    document.body.appendChild(el);

    $id('bb-sort').value = S.sort;
    $id('bb-lang').value = S.lang;
    $id('bb-op').value = String(S.opacity);

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
        const chip = e.target.closest('.bb-chip');
        if (!chip) return;
        chip.dataset.remove ? removeTag(chip.dataset.tag) : cycleTag(chip.dataset.tag);
    });

    // cards
    $id('bb-grid').addEventListener('click', (e) => {
        const card = e.target.closest('.bb-card');
        if (!card) return;
        const id = Number(card.dataset.id);
        const tag = e.target.closest('.bb-tag');
        if (tag) return cycleTag(tag.dataset.tag);
        if (e.target.closest('.bb-toggle')) {
            S.flip.has(id) ? S.flip.delete(id) : S.flip.add(id);
            syncCard(card);
            if (!isOpen(id)) card.scrollIntoView({ block: 'nearest' });
            return;
        }
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
    buildItems();
    $id('bb-overlay').hidden = false;
    document.body.classList.add('bb-lock');
    applyOpacity();
    applyLang();
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
