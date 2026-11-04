window.resolvePortfolioImageUrl = function (value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    if (value.trim() === '#') return null;

    try {
        const imageUrl = new URL(value.trim(), 'https://kishanbackend.onrender.com');
        const hostname = imageUrl.hostname.toLowerCase().replace(/\.$/, '');
        if (
            hostname === 'kishanbackend.onrender.com'
            && imageUrl.pathname === '/api/projects'
        ) return null;

        if (
            imageUrl.protocol === 'http:'
            && (hostname === 'localhost' || hostname === '127.0.0.1')
            && imageUrl.port === '8080'
        ) {
            imageUrl.protocol = 'https:';
            imageUrl.hostname = 'kishanbackend.onrender.com';
            imageUrl.port = '';
            return imageUrl.href;
        }

        if (imageUrl.protocol !== 'https:') return null;
        if (
            hostname === 'localhost'
            || hostname.endsWith('.localhost')
            || hostname.endsWith('.local')
            || hostname.endsWith('.internal')
            || !hostname.includes('.')
            || hostname.startsWith('[')
        ) {
            return null;
        }

        if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) return null;

        return imageUrl.href;
    } catch {
        return null;
    }
};
