const PROJECTS_API_URL = 'https://kishanbackend.onrender.com/api/projects';
const PROJECTS_CACHE_KEY = 'kishan-portfolio-projects-v1';
const REQUEST_TIMEOUT_MS = 14000;

function textElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = text;
    return element;
}

function safeHttpUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    if (value.trim() === '#') return null;
    try {
        const url = new URL(value.trim(), PROJECTS_API_URL);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
        const api = new URL(PROJECTS_API_URL);
        if (url.origin === api.origin && url.pathname === api.pathname) return null;
        return url.href;
    } catch {
        return null;
    }
}

function normalizedCategory(value) {
    const category = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (category === 'web' || category === 'website' || category === 'websites') return 'websites';
    return category.replace(/[^a-z0-9_-]/g, '') || 'other';
}

function appendExternalLink(container, label, value) {
    const href = safeHttpUrl(value);
    if (!href) return;
    const link = textElement('a', '', label);
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    container.appendChild(link);
}

function createProjectCard(project) {
    project = window.presentPortfolioProject?.(project) || project;
    const category = normalizedCategory(project.category);
    const card = document.createElement('article');
    card.className = 'project-card';
    card.dataset.category = category;

    const media = document.createElement('div');
    media.className = 'project-image-wrap';
    const screenshot = Array.isArray(project.screenshots)
        ? project.screenshots.map(window.resolvePortfolioImageUrl).find(Boolean)
        : null;
    if (screenshot) {
        const image = document.createElement('img');
        image.src = screenshot;
        image.alt = `${project.name || 'Project'} preview`;
        image.loading = 'lazy';
        image.decoding = 'async';
        image.addEventListener('error', () => {
            const placeholder = createProjectPlaceholder(project.name);
            media.replaceChildren(placeholder);
        }, { once: true });
        media.appendChild(image);
    } else {
        media.appendChild(createProjectPlaceholder(project.name));
    }

    const content = document.createElement('div');
    content.className = 'card-content';
    const topline = document.createElement('div');
    topline.className = 'card-topline';
    topline.appendChild(textElement('span', 'project-category', category.replaceAll('-', ' ')));
    if (typeof project.status === 'string' && project.status.trim()) {
        topline.appendChild(textElement('span', 'project-status-badge', project.status.trim()));
    }
    if (Number.isFinite(Number(project.createdAt)) && Number(project.createdAt) > 0) {
        topline.appendChild(textElement('span', 'project-year', String(new Date(Number(project.createdAt)).getFullYear())));
    }
    content.appendChild(topline);
    content.appendChild(textElement('h3', '', project.name || 'Untitled project'));

    const description = typeof project.description === 'string'
        ? project.description.replace(/\s+/g, ' ').trim()
        : '';
    if (description) content.appendChild(textElement('p', 'description', description));

    const technologies = Array.isArray(project.tech)
        ? project.tech.filter(value => typeof value === 'string' && value.trim()).slice(0, 5)
        : [];
    if (technologies.length) {
        const stack = document.createElement('div');
        stack.className = 'tech-stack';
        technologies.forEach(value => stack.appendChild(textElement('span', 'tech-tag', value.trim())));
        content.appendChild(stack);
    }

    const links = document.createElement('div');
    links.className = 'card-links';
    const projectId = project.id === undefined || project.id === null ? '' : String(project.id).trim();
    if (projectId) {
        const details = textElement('a', 'btn btn-secondary', 'Project details');
        details.href = `view_project.html?id=${encodeURIComponent(projectId)}`;
        links.appendChild(details);
    }

    if (category === 'android') appendExternalLink(links, 'Download APK', project.apkLink);
    appendExternalLink(links, 'Live demo', project.liveLink);
    appendExternalLink(links, 'Source code', project.githubLink);
    if (links.childElementCount) content.appendChild(links);

    card.append(media, content);
    return card;
}

function createProjectPlaceholder(name) {
    const placeholder = document.createElement('div');
    placeholder.className = 'project-image-placeholder';
    placeholder.setAttribute('aria-hidden', 'true');
    const initials = (typeof name === 'string' ? name.trim() : '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0].toUpperCase())
        .join('') || 'KK';
    placeholder.appendChild(textElement('strong', '', initials));
    return placeholder;
}

function setStatus(status, message, canRetry = false) {
    if (!status) return;
    status.replaceChildren(document.createTextNode(message));
    status.hidden = false;
    if (canRetry) {
        const actions = document.createElement('div');
        actions.className = 'status-actions';
        const retry = textElement('button', 'btn btn-secondary', 'Try again');
        retry.type = 'button';
        retry.addEventListener('click', () => loadProjects());
        actions.appendChild(retry);
        status.appendChild(actions);
    }
}

function applyProjectFilters(grid, filters) {
    filters.forEach(button => {
        if (button.dataset.listenerAttached === 'true') return;
        button.dataset.listenerAttached = 'true';
        button.addEventListener('click', () => {
            filters.forEach(filter => {
                const active = filter === button;
                filter.classList.toggle('active', active);
                filter.setAttribute('aria-pressed', String(active));
            });
            const selected = button.dataset.filter;
            grid.querySelectorAll('.project-card:not([data-slider-copy])').forEach(card => {
                card.hidden = selected !== 'all' && card.dataset.category !== selected;
            });
            window.initializeProjectSlider?.(grid, true);
        });
    });
}

function renderProjects(projects) {
    const grids = [
        { element: document.getElementById('projects-grid'), status: document.getElementById('projects-status') },
        { element: document.getElementById('home-projects-grid'), status: document.getElementById('home-projects-status') }
    ].filter(target => target.element);
    if (!grids.length) return;

    grids.forEach(({ element: grid, status }) => {
        grid.replaceChildren();
        const limit = Number.parseInt(grid.dataset.projectLimit || '', 10);
        const visibleProjects = Number.isInteger(limit) && limit > 0 ? projects.slice(0, limit) : projects;
        const fragment = document.createDocumentFragment();
        visibleProjects.forEach(project => fragment.appendChild(createProjectCard(project)));
        grid.appendChild(fragment);
        if (status) status.hidden = true;
        const filters = [...document.querySelectorAll('.filter-btn')];
        applyProjectFilters(grid, filters);
        const selectedCategory = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
        grid.querySelectorAll('.project-card:not([data-slider-copy])').forEach(card => {
            card.hidden = selectedCategory !== 'all' && card.dataset.category !== selectedCategory;
        });
        window.initializeProjectSlider?.(grid, true);
    });
}

function readCachedProjects() {
    try {
        const cached = JSON.parse(sessionStorage.getItem(PROJECTS_CACHE_KEY) || 'null');
        return Array.isArray(cached) ? cached : null;
    } catch {
        return null;
    }
}

async function readFallbackProjects() {
    try {
        const response = await fetch('projects-fallback.json', { headers: { Accept: 'application/json' } });
        if (!response.ok) return null;
        const projects = await response.json();
        return Array.isArray(projects) ? projects : null;
    } catch {
        return null;
    }
}

async function readLocalProjects() {
    try {
        const response = await fetch('projects-local.json', { headers: { Accept: 'application/json' } });
        if (!response.ok) return [];
        const projects = await response.json();
        return Array.isArray(projects) ? projects : [];
    } catch {
        return [];
    }
}

function mergePortfolioProjects(primary, secondary) {
    const result = [];
    const seenNames = new Set();
    [...(Array.isArray(primary) ? primary : []), ...(Array.isArray(secondary) ? secondary : [])]
        .forEach(project => {
            if (!project || typeof project !== 'object') return;
            const name = typeof project.name === 'string' ? project.name.trim().toLowerCase().replace(/\s+/g, ' ') : '';
            const id = project.id === undefined || project.id === null ? '' : String(project.id).trim().toLowerCase();
            const key = name || id;
            if (!key || seenNames.has(key)) return;
            seenNames.add(key);
            result.push(project);
        });
    return result;
}

async function loadProjects() {
    const statuses = [document.getElementById('projects-status'), document.getElementById('home-projects-status')]
        .filter(Boolean);
    const localProjects = await readLocalProjects();
    let initialProjects = readCachedProjects();
    if (!initialProjects) initialProjects = await readFallbackProjects();
    initialProjects = mergePortfolioProjects(localProjects, initialProjects);
    if (initialProjects.length) {
        renderProjects(initialProjects);
        statuses.forEach(status => setStatus(status, 'Checking for the latest projects…'));
    } else {
        statuses.forEach(status => setStatus(status, 'Loading selected work…'));
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const response = await fetch(PROJECTS_API_URL, {
            headers: { Accept: 'application/json' },
            signal: controller.signal
        });
        if (!response.ok) throw new Error(`Projects service returned ${response.status}.`);
        const remoteProjects = await response.json();
        if (!Array.isArray(remoteProjects)) throw new Error('Projects service returned an unexpected response.');
        const projects = mergePortfolioProjects(localProjects, remoteProjects);
        try { sessionStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify(projects)); } catch { /* Cache is optional. */ }
        renderProjects(projects);
        if (!projects.length) statuses.forEach(status => setStatus(status, 'The project list is empty. Add projects from the portfolio admin when it is available.'));
    } catch (error) {
        console.error('Unable to load portfolio projects.', error);
        const message = initialProjects
            ? 'Showing saved project details. The live project service is unavailable right now.'
            : error.name === 'AbortError'
                ? 'The project service is taking too long to respond. Please try again.'
                : 'Projects are temporarily unavailable. The project service may be waking up; please try again.';
        statuses.forEach(status => setStatus(status, message, true));
    } finally {
        window.clearTimeout(timeout);
    }
}

document.addEventListener('DOMContentLoaded', loadProjects);
