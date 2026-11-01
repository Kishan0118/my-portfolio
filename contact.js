document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('contactForm');
    const status = document.getElementById('formStatus');
    if (!form || !status) return;

    form.addEventListener('submit', event => {
        event.preventDefault();
        if (!form.reportValidity()) return;

        const values = new FormData(form);
        const name = String(values.get('name') || '').trim();
        const email = String(values.get('email') || '').trim();
        const subject = String(values.get('subject') || '').trim();
        const message = String(values.get('message') || '').trim();
        if (!name || !email || !subject || !message) {
            status.textContent = 'Please complete every field before continuing.';
            return;
        }

        const body = `Name: ${name}\nEmail: ${email}\n\n${message}`;
        const mailto = `mailto:kishankumarbgp2006@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        status.textContent = 'Your email app should open with the message ready to send.';
        window.location.href = mailto;
    });
});
