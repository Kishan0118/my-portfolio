const PROJECTS_API_URL = 'https://kishanbackend.onrender.com/api/projects';

function safeProjectUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return null;

    try {
        const url = new URL(value.trim(), PROJECTS_API_URL);
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
    } catch {
        return null;
    }
}

function setProjectLink(element, value) {
    const url = safeProjectUrl(value);
    if (!url) {
        element.hidden = true;
        element.removeAttribute('href');
        return;
    }

    element.href = url;
    element.hidden = false;
}

function renderProject(project) {
    document.title = `${project.name || 'Project details'} | Kishan Kumar`;
    document.getElementById('project-title').textContent = project.name || 'Untitled project';
    document.getElementById('project-description').textContent =
        project.description || 'A detailed project description is not available yet.';

    const liveLink = document.getElementById('live-link');
    const isAndroid = typeof project.category === 'string'
        && project.category.toLowerCase() === 'android';
    const liveUrl = isAndroid ? project.apkLink : project.liveLink;
    liveLink.innerHTML = isAndroid
        ? '<i class="fa-solid fa-download" aria-hidden="true"></i> Download APK'
        : '<i class="fa-solid fa-up-right-from-square" aria-hidden="true"></i> View live project';
    setProjectLink(liveLink, liveUrl);
    setProjectLink(document.getElementById('github-link'), project.githubLink);

    const screenshots = Array.isArray(project.screenshots)
        ? project.screenshots.map(safeProjectUrl).filter(Boolean)
        : [];
    const mainImage = document.getElementById('main-screenshot');
    const gallery = document.getElementById('screenshot-gallery');
    gallery.replaceChildren();

    if (screenshots.length) {
        mainImage.src = screenshots[0];
        mainImage.alt = `${project.name || 'Project'} screenshot`;
        mainImage.hidden = false;

        screenshots.forEach((source, index) => {
            const thumbnail = document.createElement('button');
            thumbnail.type = 'button';
            thumbnail.className = 'gallery-thumb-button';
            thumbnail.setAttribute('aria-label', `Show screenshot ${index + 1}`);
            thumbnail.setAttribute('aria-pressed', String(index === 0));

            const image = document.createElement('img');
            image.src = source;
            image.alt = '';
            image.loading = 'lazy';
            image.className = `gallery-thumb${index === 0 ? ' active' : ''}`;
            thumbnail.appendChild(image);
            thumbnail.addEventListener('click', () => {
                mainImage.src = source;
                gallery.querySelectorAll('button').forEach(button => {
                    const active = button === thumbnail;
                    button.setAttribute('aria-pressed', String(active));
                    button.querySelector('img').classList.toggle('active', active);
                });
            });
            gallery.appendChild(thumbnail);
        });
    } else {
        mainImage.removeAttribute('src');
        mainImage.hidden = true;
    }

    const technologies = document.getElementById('tech-stack-list');
    technologies.replaceChildren();
    if (Array.isArray(project.tech)) {
        project.tech.filter(value => typeof value === 'string' && value.trim())
            .forEach(value => {
                const badge = document.createElement('span');
                badge.className = 'tech-bubble';
                badge.textContent = value;
                technologies.appendChild(badge);
            });
    }
}

async function loadProject() {
    const title = document.getElementById('project-title');
    const projectId = new URLSearchParams(window.location.search).get('id');
    if (!projectId) {
        title.textContent = 'Project not found';
        document.getElementById('project-description').textContent =
            'No project was selected. Return to the projects page to choose one.';
        return;
    }

    try {
        const response = await fetch(
            `${PROJECTS_API_URL}/${encodeURIComponent(projectId)}`,
            { headers: { Accept: 'application/json' } }
        );
        if (response.status === 404) {
            title.textContent = 'Project not found';
            document.getElementById('project-description').textContent =
                'This project may have been removed or the link may be incorrect.';
            return;
        }
        if (!response.ok) {
            throw new Error(`Project request failed with status ${response.status}`);
        }

        const project = await response.json();
        if (!project || typeof project !== 'object') {
            throw new Error('Project API returned an invalid response.');
        }
        renderProject(project);
    } catch (error) {
        console.error('Unable to load project details.', error);
        title.textContent = 'Project details unavailable';
        document.getElementById('project-description').textContent =
            'The project could not be loaded right now. Please try again later.';
    }
}

document.addEventListener('DOMContentLoaded', loadProject);
