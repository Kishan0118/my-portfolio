document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.header');
    const menuButton = document.querySelector('.menu-toggle');
    const navigation = document.getElementById('primary-navigation');
    const backdrop = document.querySelector('.menu-backdrop');
    if (!header || !menuButton || !navigation || !backdrop) return;

    const mobileViewport = window.matchMedia('(max-width: 768px)');

    function setMenuOpen(isOpen, restoreFocus = false) {
        document.body.classList.toggle('menu-open', isOpen);
        menuButton.setAttribute('aria-expanded', String(isOpen));
        menuButton.setAttribute(
            'aria-label',
            isOpen ? 'Close navigation menu' : 'Open navigation menu'
        );
        if (restoreFocus) menuButton.focus();
    }

    menuButton.addEventListener('click', () => {
        const isOpening = menuButton.getAttribute('aria-expanded') !== 'true';
        setMenuOpen(isOpening);
        if (isOpening) {
            window.setTimeout(() => {
                if (document.body.classList.contains('menu-open')) {
                    navigation.querySelector('a[href]')?.focus();
                }
            }, 260);
        }
    });

    backdrop.addEventListener('click', () => setMenuOpen(false, true));

    navigation.addEventListener('click', event => {
        if (event.target.closest('a')) setMenuOpen(false);
    });

    document.addEventListener('keydown', event => {
        if (!mobileViewport.matches || menuButton.getAttribute('aria-expanded') !== 'true') return;

        if (event.key === 'Escape') {
            setMenuOpen(false, true);
            return;
        }

        if (event.key !== 'Tab') return;
        const focusableItems = [
            menuButton,
            ...navigation.querySelectorAll('a[href]')
        ];
        const firstItem = focusableItems[0];
        const lastItem = focusableItems[focusableItems.length - 1];

        if (event.shiftKey && document.activeElement === firstItem) {
            event.preventDefault();
            lastItem.focus();
        } else if (!event.shiftKey && document.activeElement === lastItem) {
            event.preventDefault();
            firstItem.focus();
        }
    });

    mobileViewport.addEventListener('change', event => {
        if (!event.matches) setMenuOpen(false);
    });
});
