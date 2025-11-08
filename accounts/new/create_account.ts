document.addEventListener("DOMContentLoaded", () => {
    const bankButtons = Array.from(
        document.querySelectorAll<HTMLButtonElement>("#choose-bank .bank-holder button")
    );
    const typeButtons = Array.from(
        document.querySelectorAll<HTMLButtonElement>("#choose-type-card .type-holder button")
    );
    const openBtn = document.querySelector<HTMLButtonElement>("#open");
    if (!openBtn) return;

    let selectedBankId: string | null = null;
    let selectedTypeId: string | null = null;

    // Короткий трансформ, который сам "откатится" за счёт твоих transition'ов
    function transientTransform(el: HTMLElement, tx: string, holdMs = 120) {
        const prev = el.getAttribute("data-prev-transform") ?? el.style.transform ?? "";
        // Сохраняем предыдущий inline-transform, чтобы потом вернуть
        el.setAttribute("data-prev-transform", prev);
        el.style.transform = tx;
        // Даем кадр браузеру применить стиль
        void el.getBoundingClientRect();
        setTimeout(() => {
            el.style.transform = prev;
            el.removeAttribute("data-prev-transform");
        }, holdMs);
    }

    // Лёгкий "откат" всем, кого мы снова делаем disabled
    const animateRevert = (el: HTMLElement) =>
        transientTransform(el, "translateY(-1px) scale(1.02)", 90);

    // Небольшой "пульс" выбранному
    const animatePulse = (el: HTMLElement) =>
        transientTransform(el, "translateY(-1px) scale(1.02)", 140);

    // Примитивный шейк для кнопки Submit (без своих @keyframes)
    function shake(el: HTMLElement) {
        const prev = el.style.transform;
        const seq = [-2, 2, -2, 2, 0];
        let i = 0;
        const step = () => {
            el.style.transform = `translateX(${seq[i]}px)`;
            i += 1;
            if (i < seq.length) setTimeout(step, 55);
            else el.style.transform = prev;
        };
        step();
    }

    function updateOpenState() {
        const ready = Boolean(selectedBankId && selectedTypeId);
        if (openBtn !== null) {
            openBtn.disabled = !ready;
            openBtn.classList.toggle("disabled", !ready);
        }
    }

    // Общая логика одиночного выбора в группе
    function handleGroupSelect(buttons: HTMLButtonElement[], clicked: HTMLButtonElement) {
        buttons.forEach((b) => {
            const wasActive = !b.classList.contains("disabled");
            // Снова делаем disabled всех…
            b.classList.add("disabled");
            b.setAttribute("aria-pressed", "false");
            if (wasActive && b !== clicked) animateRevert(b); // …и проигрываем "откат" тем, кого выключили
        });

        // …кроме кликнутого
        clicked.classList.remove("disabled");
        clicked.setAttribute("aria-pressed", "true");
        animatePulse(clicked);
    }

    // Банки
    bankButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            handleGroupSelect(bankButtons, btn);
            selectedBankId = btn.id || null;
            updateOpenState();
        });
    });

    // Типы счёта/карты
    typeButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            handleGroupSelect(typeButtons, btn);
            selectedTypeId = btn.id || null;
            updateOpenState();
        });
    });

    // Сабмит
    openBtn.addEventListener("click", async (e) => {
        e.preventDefault();

        if (!selectedBankId || !selectedTypeId) {
            shake(openBtn);
            return;
        }

        // временно блокируем от даблкликов
        const wasDisabled = openBtn.disabled;
        openBtn.disabled = true;

        try {
            const res = await fetch("/", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                credentials: "same-origin",
                body: JSON.stringify({
                    bankId: selectedBankId,
                    accountTypeId: selectedTypeId,
                }),
            });

            if (!res.ok) {
                shake(openBtn);
                console.error("Request failed:", res.status, res.statusText);
                return;
            }

            // Успех — маленький "пульс"
            transientTransform(openBtn, "translateY(-1px) scale(1.02)", 140);
            // здесь можешь сделать редирект/тост
        } catch (err) {
            shake(openBtn);
            console.error("Network error:", err);
        } finally {
            // возвращаем кнопку в нужное состояние
            openBtn.disabled = wasDisabled ? true : !(selectedBankId && selectedTypeId);
            openBtn.classList.toggle("disabled", openBtn.disabled);
        }
    });

    // Инициализация
    updateOpenState();
});
