document.addEventListener("DOMContentLoaded", () => {
    const menuButton = document.querySelector(".menu-toggle");
    const navigation = document.getElementById("primary-navigation");
    const backdrop = document.querySelector(".menu-backdrop");
    const mobileViewport = window.matchMedia("(max-width: 760px)");

    if (menuButton && navigation && backdrop) {
        const setMenuOpen = (isOpen, returnFocus) => {
            document.body.classList.toggle("menu-open", isOpen);
            menuButton.setAttribute("aria-expanded", String(isOpen));
            menuButton.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
            if (returnFocus) menuButton.focus();
        };

        menuButton.addEventListener("click", () => {
            setMenuOpen(menuButton.getAttribute("aria-expanded") !== "true", false);
        });
        backdrop.addEventListener("click", () => setMenuOpen(false, true));
        navigation.addEventListener("click", (event) => {
            if (event.target.closest("a")) setMenuOpen(false, false);
        });
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") {
                setMenuOpen(false, true);
            }
        });
        mobileViewport.addEventListener("change", (event) => {
            if (!event.matches) setMenuOpen(false, false);
        });
    }

    const revealItems = document.querySelectorAll(".reveal");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || !("IntersectionObserver" in window)) {
        revealItems.forEach((item) => item.classList.add("is-visible"));
        return;
    }

    const observer = new IntersectionObserver((entries, currentObserver) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                currentObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: "0px 0px -24px 0px" });

    revealItems.forEach((item) => observer.observe(item));
});
