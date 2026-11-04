const PROJECT_DETAILS_API_URL = 'https://kishanbackend.onrender.com/api/projects';
const PROJECT_DETAILS_TIMEOUT_MS = 14000;

function safeProjectUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    if (value.trim() === '#') return null;
    try {
        const url = new URL(value.trim(), PROJECT_DETAILS_API_URL);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
        const api = new URL(PROJECT_DETAILS_API_URL);
        if (url.origin === api.origin && url.pathname === api.pathname) return null;
        return url.href;
    } catch {
        return null;
    }
}

function setProjectLink(element, value, label) {
    const url = safeProjectUrl(value);
    if (!url) {
        element.hidden = true;
        element.removeAttribute('href');
        return;
    }
    element.href = url;
    element.textContent = label;
    element.hidden = false;
}

function updatePageMetadata(project) {
    const projectName = typeof project.name === 'string' && project.name.trim()
        ? project.name.trim()
        : 'Project details';
    const pageTitle = `${projectName} | Kishan Kumar`;
    const pageUrl = new URL(window.location.href);
    if (project.id !== undefined && project.id !== null) pageUrl.searchParams.set('id', String(project.id));

    document.title = pageTitle;
    const canonical = document.querySelector('link[rel="canonical"]');
    const descriptionMeta = document.querySelector('meta[name="description"]');
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const ogDescription = document.querySelector('meta[property="og:description"]');
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (canonical) canonical.href = pageUrl.href;
    const description = (project.description || `Explore ${projectName}, a software project by Kishan Kumar.`)
        .replace(/\s+/g, ' ').trim().slice(0, 160);
    if (descriptionMeta) descriptionMeta.content = description;
    if (ogTitle) ogTitle.content = pageTitle;
    if (ogDescription) ogDescription.content = description;
    if (ogUrl) ogUrl.content = pageUrl.href;
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    const twitterDescription = document.querySelector('meta[name="twitter:description"]');
    if (twitterTitle) twitterTitle.content = pageTitle;
    if (twitterDescription) twitterDescription.content = description;
}

function renderProject(project) {
    project = window.presentPortfolioProject?.(project) || project;
    updatePageMetadata(project);
    const projectName = typeof project.name === 'string' && project.name.trim() ? project.name.trim() : 'Untitled project';
    const category = typeof project.category === 'string' ? project.category.trim().toLowerCase() : '';
    const isAndroid = category === 'android';
    const description = typeof project.description === 'string' && project.description.trim()
        ? project.description.trim()
        : 'A detailed project description is not available yet.';
    document.getElementById('project-title').textContent = projectName;
    document.getElementById('project-summary').textContent = description.replace(/\s+/g, ' ').slice(0, 180);
    document.getElementById('project-description').textContent = description;
    const projectState = document.getElementById('project-detail-state');
    if (projectState) {
        projectState.textContent = typeof project.status === 'string' ? project.status.trim() : '';
        projectState.hidden = !projectState.textContent;
    }

    const liveLink = document.getElementById('live-link');
    const liveUrl = isAndroid && project.apkLink ? project.apkLink : project.liveLink;
    const liveLabel = isAndroid && project.apkLink ? 'Download APK ↓' : 'View live project ↗';
    setProjectLink(liveLink, liveUrl, liveLabel);
    setProjectLink(document.getElementById('github-link'), project.githubLink, 'View source ↗');

    const screenshots = Array.isArray(project.screenshots)
        ? project.screenshots.map(window.resolvePortfolioImageUrl).filter(Boolean)
        : [];
    const mainImage = document.getElementById('main-screenshot');
    const gallery = document.getElementById('screenshot-gallery');
    gallery.replaceChildren();
    if (screenshots.length) {
        mainImage.src = screenshots[0];
        mainImage.alt = `${projectName} screenshot`;
        mainImage.hidden = false;
        mainImage.addEventListener('error', () => {
            mainImage.hidden = true;
        }, { once: true });

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
                mainImage.hidden = false;
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
                badge.className = 'tech-tag';
                badge.textContent = value.trim();
                technologies.appendChild(badge);
            });
    }
    if (!technologies.childElementCount) {
        const noTech = document.createElement('span');
        noTech.className = 'tech-tag';
        noTech.textContent = 'Tools not listed';
        technologies.appendChild(noTech);
    }
    const status = document.getElementById('project-status');
    status.hidden = true;
    status.replaceChildren();
}

function showProjectStatus(message, canRetry = false) {
    const status = document.getElementById('project-status');
    status.replaceChildren(document.createTextNode(message));
    status.hidden = false;
    if (canRetry) {
        const actions = document.createElement('div');
        actions.className = 'status-actions';
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'btn btn-secondary';
        retry.textContent = 'Try again';
        retry.addEventListener('click', loadProject);
        actions.appendChild(retry);
        status.appendChild(actions);
    }
}

async function readProjectFromList(source, projectId) {
    try {
        const response = await fetch(source, { headers: { Accept: 'application/json' } });
        if (!response.ok) return null;
        const projects = await response.json();
        if (Array.isArray(projects)) {
            const match = projects.find(project => String(project.id) === projectId);
            if (match) return match;
        }
    } catch {
        return null;
    }
    return null;
}

async function readFallbackProject(projectId) {
    return readProjectFromList('projects-fallback.json', projectId);
}

function renderMissingProject() {
    document.getElementById('project-title').textContent = 'Project not found';
    document.getElementById('project-summary').textContent = 'This project may have been removed.';
    document.getElementById('project-description').textContent = 'Check the link or return to the projects page to browse the available work.';
    const mainImage = document.getElementById('main-screenshot');
    mainImage.removeAttribute('src');
    mainImage.hidden = true;
    document.getElementById('screenshot-gallery').replaceChildren();
    document.getElementById('tech-stack-list').replaceChildren();
    ['live-link', 'github-link'].forEach(id => {
        const link = document.getElementById(id);
        link.hidden = true;
        link.removeAttribute('href');
    });
}

async function loadProject() {
    const projectId = new URLSearchParams(window.location.search).get('id');
    if (!projectId) {
        document.getElementById('project-title').textContent = 'Project not found';
        document.getElementById('project-summary').textContent = 'No project was selected.';
        document.getElementById('project-description').textContent = 'Return to the projects page to choose a project.';
        showProjectStatus('No project ID was included in this link.');
        return;
    }

    const localProject = await readProjectFromList('projects-local.json', projectId);
    if (localProject) {
        renderProject(localProject);
        showProjectStatus(localProject.status === 'In progress'
            ? 'This project is in progress. No APK or download link is available yet.'
            : 'No APK or download link is available for this project yet.');
        return;
    }

    const fallbackProject = await readFallbackProject(projectId);
    if (fallbackProject) {
        renderProject(fallbackProject);
        showProjectStatus('Checking for the latest project details…');
    } else {
        showProjectStatus('Loading project details…');
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), PROJECT_DETAILS_TIMEOUT_MS);
    try {
        const response = await fetch(`${PROJECT_DETAILS_API_URL}/${encodeURIComponent(projectId)}`, {
            headers: { Accept: 'application/json' },
            signal: controller.signal
        });
        if (response.status === 404) {
            if (fallbackProject) {
                renderProject(fallbackProject);
                showProjectStatus(fallbackProject.status === 'In progress'
                    ? 'This project is in progress. Download links will be added when they are available.'
                    : 'This project is listed in the portfolio. Download links are not available yet.');
                return;
            }
            renderMissingProject();
            showProjectStatus('This project could not be found.');
            return;
        }
        if (!response.ok) throw new Error(`Project service returned ${response.status}.`);
        const project = await response.json();
        if (!project || typeof project !== 'object') throw new Error('Project service returned an unexpected response.');
        renderProject(project);
    } catch (error) {
        console.error('Unable to load project details.', error);
        if (fallbackProject) {
            showProjectStatus('Showing saved project details. Live downloads and links may be unavailable while the project service is offline.', true);
        } else {
            document.getElementById('project-title').textContent = 'Project details unavailable';
            document.getElementById('project-summary').textContent = 'The project service did not respond in time.';
            document.getElementById('project-description').textContent = 'Try again in a moment, or return to the projects page.';
            showProjectStatus(error.name === 'AbortError'
                ? 'The project service is taking too long to respond.'
                : 'The project service is temporarily unavailable.', true);
        }
    } finally {
        window.clearTimeout(timeout);
    }
}

document.addEventListener('DOMContentLoaded', loadProject);
