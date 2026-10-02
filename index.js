import { getContext } from '../../../extensions.js';

const PREF_KEY = 'bot_browser_prefs';
const BATCH = 40;
const LONG_NOTES = 220;

const S = {
    items: [],
    view: [],
    query: '',
    sort: 'newest',
    tags: new Set(),
    tagQuery: '',
    allOpen: false,
    flip: new Set(), // ids whose open state differs from the allOpen default
    rendered: 0,
    built: false,
};

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
    } catch { /* ignore */ }
}
function savePrefs() {
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ sort: S.sort })); } catch { /* ignore */ }
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
    const tagById = new Map((ctx.tags || []).map((t) => [t.id, t.name]));
    S.items = (ctx.characters || []).map((c, i) => {
        const notes = toPlain(c.data?.creator_notes ?? c.creatorcomment ?? '');
        let tags = (ctx.tagMap?.[c.avatar] || []).map((id) => tagById.get(id)).filter(Boolean);
        if (!tags.length) tags = (c.data?.tags || c.tags || []).map((t) => String(t).trim()).filter(Boolean);
        const added = Number(c.date_added) || 0;
        const lastChat = Number(c.date_last_chat) || 0;
        const name = c.name || 'Unnamed';
        return {
            id: i,
            name,
            avatar: c.avatar,
            notes,
            tags,
            added,
            lastChat,
            long: notes.length > LONG_NOTES || (notes.match(/\n/g) || []).length > 3,
            hay: `${name}\n${notes}\n${tags.join(' ')}`.toLowerCase(),
        };
    });
    // drop selected tags that no longer exist
    const known = new Set(S.items.flatMap((it) => it.tags));
    for (const t of [...S.tags]) if (!known.has(t)) S.tags.delete(t);
}

function applyFilters() {
    const q = S.query.trim().toLowerCase();
    const words = q ? q.split(/\s+/) : [];
    S.view = S.items
        .filter((it) => [...S.tags].every((t) => it.tags.includes(t)))
        .filter((it) => words.every((w) => it.hay.includes(w)))
        .sort(SORTS[S.sort]);
}

/* ---------- rendering ---------- */
const isOpen = (id) => S.allOpen !== S.flip.has(id);
const avatarUrl = (a) => `/thumbnail?type=avatar&file=${encodeURIComponent(a)}`;

function cardHtml(it) {
    const open = isOpen(it.id);
    const tags = it.tags.map((t) => `<button type="button" class="bb-tag${S.tags.has(t) ? ' is-on' : ''}" data-tag="${esc(t)}">${esc(t)}</button>`).join('');
    const notes = it.notes
        ? `<div class="bb-notes">${esc(it.notes)}</div>`
        : '<div class="bb-notes bb-none">No creator\'s notes</div>';
    const more = it.long ? `<button type="button" class="bb-more">${open ? 'Show less' : 'Show more'}</button>` : '';
    return `<article class="bb-card${open ? ' is-open' : ''}" data-id="${it.id}">
        <button type="button" class="bb-av" data-act="open" aria-label="Open ${esc(it.name)}"><img loading="lazy" alt="" src="${avatarUrl(it.avatar)}"></button>
        <div class="bb-body">
            <div class="bb-top">
                <h3 class="bb-name">${esc(it.name)}</h3>
                <button type="button" class="bb-btn bb-go" data-act="open">Open chat</button>
            </div>
            ${tags ? `<div class="bb-tags">${tags}</div>` : ''}
            ${notes}
            ${more}
        </div>
    </article>`;
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
    $id('bb-count').textContent = S.view.length === S.items.length ? `${S.items.length}` : `${S.view.length} of ${S.items.length}`;
}

function renderTagPanel() {
    const counts = new Map();
    S.items.forEach((it) => it.tags.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
    const tq = S.tagQuery.trim().toLowerCase();
    const list = [...counts.entries()]
        .filter(([t]) => !tq || t.toLowerCase().includes(tq))
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    $id('bb-chips').innerHTML = list.length
        ? list.map(([t, n]) => `<button type="button" class="bb-chip${S.tags.has(t) ? ' is-on' : ''}" data-tag="${esc(t)}">${esc(t)} <span>${n}</span></button>`).join('')
        : '<span class="bb-muted">No tags found</span>';
}

function renderActive() {
    const n = S.tags.size;
    $id('bb-tags-n').textContent = n ? String(n) : '';
    $id('bb-tags-btn').classList.toggle('is-on', n > 0);
    $id('bb-active').innerHTML = n
        ? [...S.tags].map((t) => `<button type="button" class="bb-chip is-on" data-tag="${esc(t)}" aria-label="Remove tag ${esc(t)}">${esc(t)} <i class="fa-solid fa-xmark"></i></button>`).join('')
        : '';
}

function refresh() {
    applyFilters();
    renderActive();
    renderList(true);
    if (!$id('bb-tagpanel').hidden) renderTagPanel();
}

function toggleTag(t) {
    S.tags.has(t) ? S.tags.delete(t) : S.tags.add(t);
    refresh();
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
    document.querySelectorAll('#bb-grid .bb-card').forEach((card) => {
        card.classList.toggle('is-open', open);
        const m = card.querySelector('.bb-more');
        if (m) m.textContent = open ? 'Show less' : 'Show more';
    });
    $id('bb-expand').textContent = open ? 'Collapse all' : 'Expand all';
}

function debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
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
    el.setAttribute('aria-label', 'Bot Browser');
    el.innerHTML = `
    <div class="bb-shell">
        <header class="bb-head">
            <div class="bb-row">
                <h2 class="bb-title">Bots <span id="bb-count" class="bb-muted"></span></h2>
                <button type="button" id="bb-close" class="bb-icon" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <label class="bb-search">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input id="bb-q" type="search" placeholder="Search name, notes or tags" autocomplete="off" enterkeyhint="search">
            </label>
            <div class="bb-row bb-tools">
                <select id="bb-sort" aria-label="Sort">
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="az">A to Z</option>
                    <option value="za">Z to A</option>
                    <option value="chatted">Recently chatted</option>
                </select>
                <button type="button" id="bb-tags-btn" class="bb-btn"><i class="fa-solid fa-tags"></i> Tags <b id="bb-tags-n"></b></button>
                <button type="button" id="bb-expand" class="bb-btn">Expand all</button>
            </div>
            <div id="bb-active" class="bb-chips"></div>
            <div id="bb-tagpanel" class="bb-tagpanel" hidden>
                <div class="bb-row">
                    <input id="bb-tq" type="search" placeholder="Find a tag" autocomplete="off">
                    <button type="button" id="bb-tclear" class="bb-btn">Clear tags</button>
                </div>
                <div id="bb-chips" class="bb-chips bb-chips-scroll"></div>
            </div>
        </header>
        <main id="bb-scroll" class="bb-scroll">
            <div id="bb-grid" class="bb-grid"></div>
            <div id="bb-empty" class="bb-empty" hidden>No bots match. Try fewer tags or a different search.</div>
            <div id="bb-sentinel" aria-hidden="true"></div>
        </main>
    </div>`;
    document.body.appendChild(el);

    $id('bb-sort').value = S.sort;

    $id('bb-close').addEventListener('click', closeBrowser);
    el.addEventListener('mousedown', (e) => { if (e.target === el) closeBrowser(); });

    $id('bb-q').addEventListener('input', debounce((e) => { S.query = e.target.value; refresh(); }, 150));
    $id('bb-sort').addEventListener('change', (e) => { S.sort = e.target.value; savePrefs(); refresh(); });

    $id('bb-tags-btn').addEventListener('click', () => {
        const p = $id('bb-tagpanel');
        p.hidden = !p.hidden;
        if (!p.hidden) renderTagPanel();
    });
    $id('bb-tq').addEventListener('input', debounce((e) => { S.tagQuery = e.target.value; renderTagPanel(); }, 120));
    $id('bb-tclear').addEventListener('click', () => { S.tags.clear(); refresh(); });
    $id('bb-expand').addEventListener('click', () => setAllOpen(!S.allOpen));

    // chips (panel + active row)
    el.addEventListener('click', (e) => {
        const chip = e.target.closest('.bb-chip');
        if (chip) toggleTag(chip.dataset.tag);
    });

    // cards
    $id('bb-grid').addEventListener('click', (e) => {
        const card = e.target.closest('.bb-card');
        if (!card) return;
        const id = Number(card.dataset.id);
        const tag = e.target.closest('.bb-tag');
        if (tag) return toggleTag(tag.dataset.tag);
        if (e.target.closest('.bb-more')) {
            S.flip.has(id) ? S.flip.delete(id) : S.flip.add(id);
            const open = isOpen(id);
            card.classList.toggle('is-open', open);
            card.querySelector('.bb-more').textContent = open ? 'Show less' : 'Show more';
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
        if (e.key === 'Escape' && !el.hidden) { e.stopPropagation(); closeBrowser(); }
    }, true);
}

function openBrowser() {
    build();
    buildItems();
    $id('bb-overlay').hidden = false;
    document.body.classList.add('bb-lock');
    refresh();
    if (window.matchMedia('(hover: hover)').matches) $id('bb-q').focus();
}

function closeBrowser() {
    const el = $id('bb-overlay');
    if (el) el.hidden = true;
    document.body.classList.remove('bb-lock');
}

/* ---------- entry points ---------- */
function injectButtons() {
    let placed = !!$id('bb-list-btn');
    if (!placed) {
        const btn = document.createElement('div');
        btn.id = 'bb-list-btn';
        btn.className = 'menu_button fa-solid fa-table-cells-large interactable';
        btn.title = 'Bot Browser';
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
        item.innerHTML = '<div class="fa-solid fa-table-cells-large extensionsMenuExtensionButton"></div>Bot Browser';
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
