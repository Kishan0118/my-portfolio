// view_project.js

// 1. DUMMY DETAILED DATA (Replace with actual Firebase fetching later)
// Use the same structure as the dummy data in projects.js, but add more detail and an image array
const detailedProjectsData = [
    {
        id: 'SocwVxkPJjVI8gPL1Slc',
        name: "E-Commerce Web App",
        category: "websites",
        tech: ["React", "Node.js", "MongoDB", "Redux", "Stripe API"],
        description: "This robust e-commerce platform was built to handle thousands of users concurrently. Key features include user authentication, product catalog management, a custom shopping cart, and integration with the Stripe API for secure payments. The project utilized Redux for complex state management, ensuring a smooth and responsive user experience.",
        screenshots: ["/image/ecommers_m.jpg", "/image/ecomm_gallery_1.jpg"],
        liveLink: "#",
        githubLink: "#"
    },
    {
        id: 'fU0gkQFnfsDjtN3wPb1c',
        name: "Image Recognition AI",
        category: "ai",
        tech: ["Python", "TensorFlow", "Flask"],
        description: "A deep learning module integrated into a web service for real-time image classification.",
        screenshots: ["/image/imagereconize.jpg"],
        liveLink: "#",
        githubLink: "#"
    },
    {
        id: 'rNVu2XDaWXpbFLKaP4LE',
        name: "Web Scraping Automation Bot",
        category: "automation",
        tech: ["Python", "Selenium", "Pandas"],
        description: "Automated data extraction from multiple websites and consolidation into CSV format.",
        screenshots: ["/image/webbot.jpg"],
        liveLink: "#",
        githubLink: "#"
    },
    // Android sample project (for testing Download APK button)
    {
        id: 'uP4IOTJW5MMGRIKwIMxe',
        name: "Task Manager Android App",
        category: "android",
        tech: ["Java", "Android SDK", "SQLite"],
        description: "A simple, yet powerful task management application for daily productivity.",
        screenshots: ["/image/androidapp.jpg", "/image/android_app_screen2.jpg"],
        liveLink: "#",
        githubLink: "#",
        apkLink: "http://localhost:8080/image/androidapp.apk"
    }
];

// --- CORE FUNCTIONS ---

// Function to extract project ID from URL
function getProjectIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    // Return raw id (could be numeric or string from backend)
    return urlParams.get('id');
}

// Function to find the project data (simulating Firebase fetch)
function fetchProjectDetails(id) {
    // In a real app, you would use: 
    // const docRef = doc(db, "projects", id.toString());
    // const docSnap = await getDoc(docRef);
    
    if (!id) return undefined;
    return detailedProjectsData.find(project => String(project.id) === String(id));
}

// Function to render the project details onto the page
function renderProject(project) {
    if (!project) {
        document.getElementById('project-title').textContent = "Error: Project Not Found!";
        document.getElementById('project-description').textContent = "The requested project ID could not be found in the database.";
        return;
    }

    // 1. Update Title and Description
    document.getElementById('project-title').textContent = project.name;
    document.getElementById('project-description').textContent = project.description;

    // 2. Update Links
    const liveButton = document.getElementById('live-link');
    
    // Android projects के लिए "Download APK" button दिखाएं
    if (project.category && project.category.toLowerCase() === 'android') {
        liveButton.innerHTML = '<i class="fa-solid fa-download"></i> Download APK';
        liveButton.href = project.apkLink || '#';
    } else {
        liveButton.innerHTML = '<i class="fa-solid fa-up-right-from-square"></i> View Live Project';
        liveButton.href = project.liveLink || '#';
    }
    
    document.getElementById('github-link').href = project.githubLink;
    
    // 3. Update Main Screenshot
    document.getElementById('main-screenshot').src = project.screenshots[0];

    // 4. Render Tech Stack Bubbles
    const techListContainer = document.getElementById('tech-stack-list');
    techListContainer.innerHTML = '';
    project.tech.forEach(tech => {
        const bubble = `<span class="tech-bubble">${tech}</span>`;
        techListContainer.insertAdjacentHTML('beforeend', bubble);
    });
    
    // 5. Render Screenshot Gallery
    const galleryContainer = document.getElementById('screenshot-gallery');
    galleryContainer.innerHTML = '';
    project.screenshots.forEach((src, index) => {
        const thumb = document.createElement('img');
        thumb.src = src;
        thumb.alt = `${project.name} Screenshot ${index + 1}`;
        thumb.className = 'gallery-thumb';
        // Set first one as active
        if (index === 0) {
            thumb.classList.add('active');
        }
        
        // Add click listener to swap main image
        thumb.addEventListener('click', () => {
            document.getElementById('main-screenshot').src = src;
            // Update active class
            document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
            thumb.classList.add('active');
        });
        
        galleryContainer.appendChild(thumb);
    });
}


// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    const projectId = getProjectIdFromUrl();
    
    if (projectId) {
        // Try fetching the project from the backend API first
        const apiUrl = `http://localhost:8080/api/projects/${encodeURIComponent(projectId)}`;

        fetch(apiUrl)
            .then(resp => {
                if (!resp.ok) throw new Error('Project not found');
                return resp.json();
            })
            .then(projectData => {
                // Backend returns DTO with screenshots as array and tech as array
                renderProject(projectData);
            })
            .catch(err => {
                console.warn('Backend fetch failed, falling back to local data:', err);
                // Fallback: use local detailedProjectsData
                const projectData = fetchProjectDetails(projectId);
                renderProject(projectData);
            });
    } else {
        document.getElementById('project-title').textContent = "Error: No Project ID Provided!";
    }
});
