
type ApiResp = {
    accounts?: Array<{
        balances?: Array<{ currency: string; amount: number }>
    }>
};

const API_URL =
    'https://deallet.ru:5545/multibank/api/v1/accounts?include_balances=true&type=debit';

document.addEventListener('DOMContentLoaded', () => {
    fetchAndRender().catch(() => renderSum(0, true));
});

async function fetchAndRender() {
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
