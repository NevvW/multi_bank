// main.ts
type RegisterResponse = {
    tokens: {
        access_token: string;
        access_token_expires_at: string; // ISO
        refresh_token: string;
        refresh_token_expires_at: string; // ISO
    };
    user: {
        created_at: string;
        id: number;
        login: string;
        uuid: string;
    };
};

const API_URL = "http://87.251.66.140:5545/multibank/api/v1/auth/register";

function setCookie(name: string, value: string, expiresAtISO?: string) {
    // HttpOnly из JS поставить нельзя.
    const expires = expiresAtISO ? `; expires=${new Date(expiresAtISO).toUTCString()}` : "";
    const path = "; path=/";
    const sameSite = "; SameSite=Lax";
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}${expires}${path}${sameSite}${secure}`;
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
    // Простая проверка, без фанатизма
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

let inFlight = false;

window.addEventListener("DOMContentLoaded", () => {
    const form = getEl<HTMLFormElement>("form");
    const loginInput = getEl<HTMLInputElement>("#login");
    const passInput = getEl<HTMLInputElement>("#password");
    const pass2Input = getEl<HTMLInputElement>("#repeat-password");
    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (inFlight) return;

        const login = loginInput.value.trim();
        const password = passInput.value;
        const repeat = pass2Input.value;

        // Клиентские проверки
        if (!login || !password || !repeat) {
            showMessage("Заполните все поля.");
            return;
        }
        if (!isValidEmail(login)) {
            showMessage("Некорректный e-mail.");
            loginInput.focus();
            return;
        }
        if (password.length < 8) {
            showMessage("Пароль слишком короткий (минимум 8 символов).");
            passInput.focus();
            return;
        }
        if (password !== repeat) {
            showMessage("Пароли не совпадают.");
            pass2Input.focus();
            return;
        }

        // Отправка
        try {
            inFlight = true;
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.dataset.prevText = submitBtn.textContent || "";
                submitBtn.textContent = "Регистрируем…";
            }

            const res = await fetch(API_URL, {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ login, password }),
            });

            // Попробуем распарсить тело в любом случае
            const text = await res.text();
            let data: RegisterResponse | null = null;
            try {
                data = text ? (JSON.parse(text) as RegisterResponse) : null;
            } catch {
                data = null;
            }

            if (!res.ok) {
                const serverMsg =
                    (data as any)?.message ||
                    (data as any)?.detail ||
                    text ||
                    `Ошибка регистрации (${res.status})`;
                showMessage(String(serverMsg), "error");
                return;
            }

            if (!data?.tokens?.access_token || !data?.tokens?.refresh_token) {
                showMessage("Сервер не вернул токены.", "error");
                return;
            }

            // Сохраняем токены в куки
            setCookie("access_token", data.tokens.access_token, data.tokens.access_token_expires_at);
            setCookie("refresh_token", data.tokens.refresh_token, data.tokens.refresh_token_expires_at);
            setCookie("login", data.user?.login ?? login); // удобство, без срока


            location.href = "/";
            // showMessage("Готово. Вы зарегистрированы.", "success");

            // Здесь можно редиректнуть на личный кабинет, если нужно:
            // location.href = "/dashboard";
        } catch (err) {
            console.error(err);
            showMessage("Нет связи с сервером. Попробуйте позже.", "error");
        } finally {
            inFlight = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = submitBtn.dataset.prevText || "Зарегистрироваться";
            }
        }
    });

    // UX-мелочи: мгновенная проверка совпадения паролей
    const syncPasswordMatchHint = () => {
        if (!pass2Input.value) return;
        if (passInput.value !== pass2Input.value) {
            pass2Input.setCustomValidity("Пароли не совпадают");
        } else {
            pass2Input.setCustomValidity("");
        }
    };
    passInput.addEventListener("input", syncPasswordMatchHint);
    pass2Input.addEventListener("input", syncPasswordMatchHint);
});
