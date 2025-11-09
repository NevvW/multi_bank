// login.ts
type LoginResponse = {
    tokens: {
        access_token: string;
        access_token_expires_at: string;
        refresh_token: string;
        refresh_token_expires_at: string;
    };
    user: {
        created_at: string;
        id: number;
        login: string;
        uuid: string;
    };
};

const API_URL = "https://deallet.ru:5545/multibank/api/v1/auth/login";

function setCookie(name: string, value: string, expiresAtISO?: string) {
    const expires = expiresAtISO ? `; expires=${new Date(expiresAtISO).toUTCString()}` : "";
    const path = "; path=/";
    const sameSite = "; SameSite=Lax";
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}${expires}${path}${sameSite}${secure}`;
}

function getCookie(name: string): string | null {
    const m = document.cookie.match(new RegExp(`(?:^|; )${encodeURIComponent(name)}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : null;
}

function getEl<T extends HTMLElement>(selector: string): T {
    const el = document.querySelector(selector) as T | null;
    if (!el) throw new Error(`Элемент не найден: ${selector}`);
    return el;
}

function showMessage(msg: string, type: "error" | "success" = "error") {
    let box = document.getElementById("form-messages") as HTMLDivElement | null;
    if (!box) {
        box = document.createElement("div");
        box.id = "form-messages";
        box.style.marginTop = "12px";
        box.style.fontSize = "14px";
        box.style.lineHeight = "1.4";
        getEl<HTMLFormElement>("form").appendChild(box);
    }
    box.textContent = msg;
    box.style.color = type === "error" ? "#b00020" : "#0b7a0b";
    box.setAttribute("role", "alert");
}

function isValidEmail(v: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

let inFlight = false;

window.addEventListener("DOMContentLoaded", () => {
    const form = getEl<HTMLFormElement>("form");
    const loginInput = getEl<HTMLInputElement>("#login");
    const passInput = getEl<HTMLInputElement>("#password");
    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;

    const savedLogin = getCookie("login");
    if (savedLogin && !loginInput.value) loginInput.value = savedLogin;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (inFlight) return;

        const login = loginInput.value.trim();
        const password = passInput.value;

        if (!login || !password) {
            showMessage("Заполните логин и пароль.");
            return;
        }
        if (!isValidEmail(login)) {
            showMessage("Некорректный e-mail.");
            loginInput.focus();
            return;
        }

        try {
            inFlight = true;
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.dataset.prevText = submitBtn.textContent || "";
                submitBtn.textContent = "Входим…";
            }

            const res = await fetch(API_URL, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ login, password }),
            });

            const text = await res.text();
            let data: LoginResponse | null = null;
            try {
                data = text ? (JSON.parse(text) as LoginResponse) : null;
            } catch {
                data = null;
            }

            if (!res.ok) {
                // Спец-обработка 401
                if (res.status === 401) {
                    showMessage("Неверный логин или пароль.", "error");
                    passInput.focus();
                    passInput.select();
                    return;
                }
                const serverMsg =
                    (data as any)?.message ||
                    (data as any)?.detail ||
                    text ||
                    `Ошибка входа (${res.status})`;
                showMessage(String(serverMsg), "error");
                return;
            }

            if (!data?.tokens?.access_token || !data?.tokens?.refresh_token) {
                showMessage("Сервер не вернул токены.", "error");
                return;
            }

            setCookie("access_token", data.tokens.access_token, data.tokens.access_token_expires_at);
            setCookie("refresh_token", data.tokens.refresh_token, data.tokens.refresh_token_expires_at);
            setCookie("login", data.user?.login ?? login);

            location.href = "/";
        } catch (err) {
            console.error(err);
            showMessage("Нет связи с сервером. Попробуйте позже.", "error");
        } finally {
            inFlight = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = submitBtn.dataset.prevText || "Войти";
            }
        }
    });
});
