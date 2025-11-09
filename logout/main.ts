// Удаляет все (не-HttpOnly) куки и редиректит на /login
(function () {
    // Сгенерировать набор доменов и путей, чтобы "прибить" куки в разных вариантах
    const getDomainVariants = (host: string): string[] => {
        // Для localhost/IP domain= нельзя ставить
        if (host === 'localhost' || /^[\d.]+$/.test(host)) return [];
        const parts = host.split('.');
        const variants: string[] = [];
        for (let i = 0; i <= parts.length - 2; i++) {
            variants.push(parts.slice(i).join('.')); // sub.example.com, example.com
        }
        return variants;
    };

    const getPathVariants = (pathname: string): string[] => {
        const res = new Set<string>(['/']);
        const parts = pathname.split('/').filter(Boolean);
        let acc = '';
        for (const p of parts) {
            acc += '/' + p;
            res.add(acc);
        }
        return Array.from(res);
    };

    const deleteAllCookies = (): void => {
        const names = document.cookie
            .split(';')
            .map(c => c.split('=')[0].trim())
            .filter(Boolean);

        if (names.length === 0) return;

        const host = location.hostname;
        const domains = getDomainVariants(host);
        const paths = getPathVariants(location.pathname);
        const expires = 'Thu, 01 Jan 1970 00:00:00 GMT';
        const secure = location.protocol === 'https:' ? '; Secure' : '';
        const sameSite = '; SameSite=Lax';

        for (const name of names) {
            // 1) Без domain=
            for (const path of paths) {
                document.cookie = `${name}=; expires=${expires}; path=${path}${secure}${sameSite}`;
            }
            // 2) С domain= для текущего и родительских доменов
            for (const d of domains) {
                for (const path of paths) {
                    document.cookie = `${name}=; expires=${expires}; path=${path}; domain=.${d}${secure}${sameSite}`;
                }
            }
        }
    };

    try {
        deleteAllCookies();
    } finally {
        // Замещаем историю, чтобы нельзя было вернуться на защищённую страницу по Back
        window.location.replace('/login/');
    }
})();
