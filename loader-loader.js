// loader-loader.js
// Fetches `loader.html` and injects into #projects-loader-placeholder
(function(){
    async function injectLoader(){
        try{
            const placeholder = document.getElementById('projects-loader-placeholder');
            if (!placeholder) return;
            const res = await fetch('loader.html');
            if (!res.ok) return;
            const html = await res.text();
            placeholder.innerHTML = html;
        }catch(err){
            // Silent fail — loader is optional
            console.error('Failed to load loader fragment:', err);
        }
    }

    // If the document is already parsed, inject now. Otherwise wait for DOMContentLoaded.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectLoader);
    } else {
        injectLoader();
    }
})();
