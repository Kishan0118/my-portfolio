// projects.js

// -------------------------------------------------------------------------
// --- 1. DATA FETCHING (Backend Connection) ---
// -------------------------------------------------------------------------

// यह फंक्शन API से डेटा प्राप्त करता है और रेंडरिंग शुरू करता है
async function fetchProjects() {
    try {
        // show loader immediately when starting fetch
        if (typeof showLoader === 'function') showLoader();
        // आपका Java Spring Boot API Endpoint
        const apiUrl = 'http://localhost:8080/api/projects'; 
        
        const response = await fetch(apiUrl); 
        
        if (!response.ok) {
            throw new Error("HTTP error! Status: ${response.status}");
        }
        
        const projectsData = await response.json(); 
        console.log("Backend से मिला डेटा:", projectsData);
        
        // Debug: Log first project's screenshots
        if (projectsData && projectsData.length > 0) {
            console.log("First project screenshots:", projectsData[0].screenshots);
            if (projectsData[0].screenshots && projectsData[0].screenshots.length > 0) {
                console.log("First screenshot URL:", projectsData[0].screenshots[0]);
            }
        }
        
        // डेटा मिलने के बाद, रेंडर और फ़िल्टरिंग शुरू करें
        if (projectsData && projectsData.length > 0) {
            renderProjects(projectsData);
            setupFilters(projectsData); // फ़िल्टर लॉजिक के लिए डेटा पास करें
        } else {
            // यदि डेटाबेस खाली है तो संदेश दिखाएँ
            const grid = document.getElementById('projects-grid');
            if (grid) {
                grid.innerHTML = '<p style="text-align: center;">क्षमा करें, डेटाबेस में कोई प्रोजेक्ट नहीं मिला।</p>';
            }
        }
        // ensure loader is hidden if nothing to render (renderProjects hides on success)
        if (typeof hideLoader === 'function') hideLoader();
        
    } catch (error) {
        console.error("Error fetching projects from backend API:", error);
        if (typeof hideLoader === 'function') hideLoader();
        // यदि कनेक्शन विफल हो जाता है तो त्रुटि संदेश दिखाएँ
        const grid = document.getElementById('projects-grid');
        if (grid) {
            grid.innerHTML = '<p style="color: red; text-align: center;">माफ़ करना, प्रोजेक्ट डेटा लोड करने में कोई समस्या आई। कृपया Java सर्वर चल रहा है या नहीं, जाँच करें।</p>';
        }
    }
}


// -------------------------------------------------------------------------
// --- 2. CORE FUNCTIONS (Renders data using old CSS classes) ---
// -------------------------------------------------------------------------

// Function to render projects dynamically
function renderProjects(projectsToRender) {
    // projects.html में इस्तेमाल की गई ID: 'projects-grid'
    const grid = document.getElementById('projects-grid'); 

    if (!grid) return; 

    grid.innerHTML = ''; // पुराने कंटेंट को साफ करें


    projectsToRender.forEach(project => {
        
        // category को लोअरकेस में बदलें ताकि CSS फ़िल्टर काम करे
        const categoryClass = project.category ? project.category.toLowerCase() : 'uncategorized';

        // Backend provides `screenshots` as an array in the DTO.
        // Use the first screenshot if available, otherwise fall back to a placeholder.
        const firstScreenshot = Array.isArray(project.screenshots) && project.screenshots.length > 0
            ? project.screenshots[0]
            : null;

        // Debug log
        console.log(`Project: ${project.name}, Screenshots:`, project.screenshots, "First:", firstScreenshot);

        // Build a full URL for the image. If the screenshot already contains a protocol,
        // use it as-is; otherwise assume it's served from the frontend static `/image` path
        // on the frontend server or from the backend under `/image`.
        const imageUrl = firstScreenshot
            ? (firstScreenshot.startsWith('http') ? firstScreenshot : `${firstScreenshot}`)
            : '/image/placeholder.jpg';
        
        console.log(`Final imageUrl for ${project.name}:`, imageUrl);

        const cardHTML = `
            <div class="project-card ${categoryClass}" data-category="${categoryClass}">
                
                <img src="${imageUrl}" alt="${project.name || 'Project Screenshot'}" style="width: 100%; height: auto; object-fit: cover;">
                
                <div class="card-content">
                    <h3>${project.name || 'Untitled Project'}</h3>
                    
                    <p class="tech-stack">Tech: ${Array.isArray(project.tech) ? project.tech.join(', ') : (project.tech || 'N/A')}</p>
                    
                    <p class="description">${project.description || 'A brief description is missing.'}</p>
                    
                    <div class="card-links">
                        <a href="${project.liveLink || '#'}" target="_blank"><i class="fa-solid fa-up-right-from-square"></i> Live</a>
                        <a href="${project.githubLink || '#'}" target="_blank"><i class="fa-brands fa-github"></i> GitHub</a>
                        <a href="view_project.html?id=${project.id}" class="btn view-more">View More</a>
                    </div>
                </div>
            </div>
        `;

        grid.insertAdjacentHTML('beforeend', cardHTML);
    });
    
    // After rendering the projects, hide the loader and ensure grid is visible
    if (typeof hideLoader === 'function') hideLoader();
}


// Function to handle filtering logic
function setupFilters(allProjectsData) {
    const filterButtons = document.querySelectorAll('.filter-btn');

    filterButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const filterValue = e.target.getAttribute('data-filter');

            // 1. Update active button state
            filterButtons.forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');

            // 2. Filter the projects (uses the data fetched from the API)
            // Fix: category field के null होने पर भी क्रैश न हो, इसलिए सुरक्षा जाँच जोड़ी गई है
            const filteredProjects = (filterValue === 'all')
                ? allProjectsData
                : allProjectsData.filter(p => p.category && p.category.toLowerCase() === filterValue);

            // 3. Render the filtered results
            renderProjects(filteredProjects);
        });
    });
}


// -------------------------------------------------------------------------
// --- 3. INITIALIZATION ---
// -------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    // पेज लोड होने पर API से डेटा फेच करें
    fetchProjects(); 
});
// --------------------
// Loader helpers
// --------------------
function showLoader(){
    const l = document.getElementById('projects-loader');
    const grid = document.getElementById('projects-grid');
    if (l) { l.style.display = 'flex'; l.setAttribute('aria-busy','true'); }
    if (grid) { grid.style.display = 'none'; }
}

function hideLoader(){
    const l = document.getElementById('projects-loader');
    const grid = document.getElementById('projects-grid');
    if (l) { l.style.display = 'none'; l.setAttribute('aria-busy','false'); }
    if (grid) { grid.style.display = ''; }}

