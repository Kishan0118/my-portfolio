// Load and inject footer.html into all pages
document.addEventListener('DOMContentLoaded', function() {
    // Create a placeholder div for footer
    let footerPlaceholder = document.getElementById('footer-placeholder');
    
    if (footerPlaceholder) {
        // Fetch footer.html and insert it
        fetch('footer.html')
            .then(response => response.text())
            .then(data => {
                footerPlaceholder.innerHTML = data;
                // Update year after footer is injected
                const yearElement = document.getElementById('year');
                if (yearElement) {
                    yearElement.textContent = new Date().getFullYear();
                }
            })
            .catch(error => console.error('Error loading footer:', error));
    } else {
        // Fallback: just update year if footer already exists
        const yearElement = document.getElementById('year');
        if (yearElement) {
            yearElement.textContent = new Date().getFullYear();
        }
    }
});
