type ApiResp = {
    accounts?: Array<{
        balances?: Array<{ currency: string; amount: number }>
    }>
};

type Tx = {
    id: string;
    account_id: string;
    link_id: number;
    bank: string; // "awesome" | "smart" | "virtual" | ...
    amount: number; // >0 вход, <0 расход
    currency: string; // "RUB"
    description: string;
    transaction_date: string; // ISO
    booking_date: string; // ISO
};

const API_URL =
    'https://deallet.ru:5545/multibank/api/v1/accounts?include_balances=true&type=debit';

const TRANSACTIONS_URL =
    'https://deallet.ru:5545/multibank/api/v1/transactions?from=2024-04-01&to=2024-04-30&page=1&page_size=50';

document.addEventListener('DOMContentLoaded', () => {
    // Баланс
    fetchAndRenderBalances().catch(() => renderSum(0, true));
    // История
    fetchAndRenderHistory().catch(() => {
        // молча не трогаем плейсхолдеры, если что-то пошло не так
        console.error('Failed to render history');
    });
});

/* ---------- Балансы ---------- */
async function fetchAndRenderBalances() {
    const token = getTokenFromCookies();
    if (!token) {
        clearAllCookies();
        location.assign('/login/');
        return;
    }

    const res = await fetch(API_URL, {
        method: 'GET',
        headers: {
            accept: 'application/json',
            Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        cache: 'no-store',
    }).catch((e) => {
        console.error('Fetch error', e);
        return null;
    });

    if (!res) {
        renderSum(0, true);
        return;
    }

    if (res.status === 401) {
        clearAllCookies();
        location.assign('/login/');
        return;
    }

    if (!res.ok) {
        console.error('Accounts fetch failed:', res.status, res.statusText);
        renderSum(0, true);
        return;
    }

    const data: ApiResp = await res.json();
    const accounts = data.accounts ?? [];

    const total = accounts.reduce((acc, a) => {
        const sumBalances = (a.balances ?? []).reduce((s, b) => s + (Number(b.amount) || 0), 0);
        return acc + sumBalances;
    }, 0);

    renderSum(total, accounts.length === 0);
}

function renderSum(total: number, noAccounts = false) {
    const value = noAccounts ? '0' : formatRub(total);

    const allMoneyDiv = document.querySelector<HTMLDivElement>('.all-money');
    if (allMoneyDiv) allMoneyDiv.textContent = value;

    const allCardP = document.querySelector<HTMLParagraphElement>('#all-card .text-holder p');
    if (allCardP) allCardP.textContent = value;
}

function formatRub(value: number): string {
    try {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    } catch {
        const [int, frac] = value.toFixed(2).split('.');
        return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ' )},${frac} ₽`;
    }
}

/* ---------- История ---------- */
async function fetchAndRenderHistory() {
    const token = getTokenFromCookies();
    if (!token) {
        clearAllCookies();
        location.assign('/login/');
        return;
    }

    const res = await fetch(TRANSACTIONS_URL, {
        method: 'GET',
        headers: {
            accept: 'application/json',
            Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        cache: 'no-store',
    }).catch((e) => {
        console.error('Transactions fetch error', e);
        return null;
    });

    if (!res) return;

    if (res.status === 401) {
        clearAllCookies();
        location.assign('/login/');
        return;
    }

    if (!res.ok) {
        console.error('Transactions fetch failed:', res.status, res.statusText);
        return;
    }

    const data: { transactions?: Tx[] } = await res.json();
    const txs = (data.transactions ?? [])
        .filter((t) => !!t && !!t.transaction_date) // sanity
        .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
        .slice(0, 3);

    renderHistory(txs);
}

function renderHistory(txs: Tx[]) {
    const ul = document.querySelector<HTMLUListElement>('#history ul');
    if (!ul) return;

    // Переписываем список на актуальные последние 3 операции
    ul.innerHTML = '';

    for (const tx of txs) {
        ul.appendChild(buildHistoryItem(tx));
    }
}

function buildHistoryItem(tx: Tx): HTMLLIElement {
    const isIncome = tx.amount > 0;
    const arrowSrc = isIncome ? '/svg/main/VectorDown.svg' : '/svg/main/VectorUp.svg';

    const { logoSrc, bankCss } = mapBankLogo(tx.bank);

    const li = document.createElement('li');

    const a = document.createElement('a');
    a.href = `/operation/${encodeURIComponent(tx.id)}/`;

    const imageDiv = document.createElement('div');
    imageDiv.className = 'image';

    const arrowImg = document.createElement('img');
    arrowImg.src = arrowSrc;
    arrowImg.alt = '';

    const bankImg = document.createElement('img');
    bankImg.src = logoSrc;
    bankImg.alt = '';
    bankImg.className = `bank-logo ${bankCss}`;

    imageDiv.appendChild(arrowImg);
    imageDiv.appendChild(bankImg);

    const tm = document.createElement('div');
    tm.className = 'text-and-money';

    const textDiv = document.createElement('div');
    textDiv.className = 'text';

    const nameP = document.createElement('p');
    nameP.className = 'name';
    nameP.textContent = tx.description ?? '';

    const descrP = document.createElement('p');
    descrP.className = 'secondary description';
    descrP.textContent = `${formatRelativeDate(tx.transaction_date)} • Оплата услуг`;

    textDiv.appendChild(nameP);
    textDiv.appendChild(descrP);

    const moneyP = document.createElement('p');
    moneyP.className = 'money' + (isIncome ? ' plus' : '');

    // Сумма с сохранением знака: + для дохода, минус — как пришёл
    const abs = Math.abs(Number(tx.amount) || 0);
    const formatted = formatRub(abs);
    moneyP.textContent = (isIncome ? '+' : tx.amount < 0 ? '-' : '') + formatted.replace('-', '');

    tm.appendChild(textDiv);
    tm.appendChild(moneyP);

    a.appendChild(imageDiv);
    a.appendChild(tm);

    li.appendChild(a);
    return li;
}

function formatRelativeDate(iso: string): string {
    const d = new Date(iso);
    const now = new Date();

    const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
    const diffMs = startOf(now).getTime() - startOf(d).getTime();
    const diffDays = Math.round(diffMs / 86_400_000);

    if (diffDays === 0) return 'Сегодня';
    if (diffDays === 1) return 'Вчера';

    return new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'long',
    }).format(d);
}

function mapBankLogo(bank: string): { logoSrc: string; bankCss: string } {
    const key = (bank || '').toLowerCase();
    switch (key) {
        case 'awesome':
            return { logoSrc: '/svg/bankLogo/ABankLogo.png', bankCss: 'ABank' };
        case 'smart':
            return { logoSrc: '/svg/bankLogo/SBankLogo.png', bankCss: 'SBank' };
        case 'virtual':
            return { logoSrc: '/svg/bankLogo/VBankLogo.png', bankCss: 'VBank' };
        default:
            // дефолт пусть будет виртуальный
            return { logoSrc: '/svg/bankLogo/VBankLogo.png', bankCss: 'VBank' };
    }
}

/* ---------- Токен/куки/утилиты ---------- */
/**
 * Достаём access token из cookie.
 * Поддерживаем несколько вариантов:
 *  - mb_token / token / access_token / authorization / auth / jwt / id_token
 *  - строка "Bearer xxx.yyy.zzz" или чистый JWT
 *  - JSON в cookie "auth" с полем access_token
 */
function getTokenFromCookies(): string | null {
    const map = readCookieMap();

    // если cookie "auth" содержит JSON с токеном
    const authRaw = map.get('auth');
    if (authRaw) {
        const val = tryParseTokenFromMaybeJSON(authRaw);
        if (val) return val;
    }

    const candidates = [
        'mb_token',
        'token',
        'access_token',
        'authorization',
        'jwt',
        'id_token',
    ];

    for (const name of candidates) {
        const v = map.get(name);
        if (!v) continue;
        const token = normalizeToken(v);
        if (token) return token;
    }

    // последний шанс: пробежаться по всем кукам и выдрать JWT-подобное
    for (const [, v] of map) {
        const token = normalizeToken(v);
        if (token) return token;
    }

    return null;
}

function readCookieMap(): Map<string, string> {
    const m = new Map<string, string>();
    const raw = document.cookie || '';
    for (const pair of raw.split(';')) {
        if (!pair) continue;
        const [k, ...rest] = pair.split('=');
        if (!k) continue;
        const name = k.trim();
        const value = rest.join('=');
        try {
            m.set(name, decodeURIComponent(value));
        } catch {
            m.set(name, value);
        }
    }
    return m;
}

function tryParseTokenFromMaybeJSON(raw: string): string | null {
    try {
        const obj = JSON.parse(raw);
        const cand =
            obj?.access_token || obj?.token || obj?.jwt || obj?.id_token || obj?.Authorization;
        return cand ? normalizeToken(String(cand)) : null;
    } catch {
        return null;
    }
}

function normalizeToken(value: string): string | null {
    const trimmed = value.trim().replace(/^Bearer\s+/i, '');
    // JWT-подобная строка
    const m = trimmed.match(/([A-Za-z0-9\-_]+)\.([A-Za-z0-9\-_]+)\.([A-Za-z0-9\-_]+)/);
    return m ? m[0] : null;
}

function clearAllCookies() {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
        const eq = cookie.indexOf('=');
        const name = (eq > -1 ? cookie.slice(0, eq) : cookie).trim();

        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;

        const parts = location.hostname.split('.');
        for (let i = 0; i < parts.length - 1; i++) {
            const domain = '.' + parts.slice(i).join('.');
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${domain}`;
        }
    }

    try {
        localStorage.clear();
        sessionStorage.clear();
    } catch {}
}
