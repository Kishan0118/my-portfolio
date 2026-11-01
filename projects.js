const API_URL = 'https://kishanbackend.onrender.com/api/projects';

function createTextElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = text;
    return element;
}

function safeExternalUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return null;

    try {
        const url = new URL(value.trim());
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
    } catch {
        return null;
    }
}

function createProjectCard(project) {
    const category = typeof project.category === 'string'
        ? project.category.trim().toLowerCase()
        : 'uncategorized';
    const card = document.createElement('article');
    card.className = `project-card ${category.replace(/[^a-z0-9_-]/g, '')}`;
    card.dataset.category = category;

    const screenshot = Array.isArray(project.screenshots)
        ? safeExternalUrl(project.screenshots[0])
        : null;

    if (screenshot) {
        const image = document.createElement('img');
        image.src = screenshot;
        image.alt = `${project.name || 'Project'} screenshot`;
        image.loading = 'lazy';
        image.decoding = 'async';
        card.appendChild(image);
    }

    const content = document.createElement('div');
    content.className = 'card-content';
    content.appendChild(createTextElement('h2', '', project.name || 'Untitled project'));

    const technologies = Array.isArray(project.tech)
        ? project.tech.filter(value => typeof value === 'string' && value.trim()).join(', ')
        : '';
    if (technologies) {
        content.appendChild(createTextElement('p', 'tech-stack', technologies));
    }

    if (project.description) {
        content.appendChild(createTextElement('p', 'description', project.description));
    }

    const links = document.createElement('div');
    links.className = 'card-links';
    const liveUrl = safeExternalUrl(project.liveLink);
    const sourceUrl = safeExternalUrl(project.githubLink);

    if (liveUrl) {
        const liveLink = createTextElement('a', '', 'Live demo');
        liveLink.href = liveUrl;
        liveLink.target = '_blank';
        liveLink.rel = 'noopener noreferrer';
        links.appendChild(liveLink);
    }

    if (sourceUrl) {
        const sourceLink = createTextElement('a', '', 'Source code');
        sourceLink.href = sourceUrl;
        sourceLink.target = '_blank';
        sourceLink.rel = 'noopener noreferrer';
        links.appendChild(sourceLink);
    }

    if (project.id !== undefined && project.id !== null && String(project.id).trim()) {
        const detailsLink = createTextElement('a', 'btn view-more', 'Project details');
        detailsLink.href = `view_project.html?id=${encodeURIComponent(String(project.id))}`;
        links.appendChild(detailsLink);
    }

    if (links.childElementCount) content.appendChild(links);
    card.appendChild(content);
    return card;
}

function renderProjects(projects) {
    const grid = document.getElementById('projects-grid');
    const status = document.getElementById('projects-status');
    const filters = document.querySelectorAll('.filter-btn');
    if (!grid || !status) return;

    grid.replaceChildren();
    if (!projects.length) {
        status.textContent = 'No projects are available right now.';
        status.hidden = false;
        return;
    }

    const fragment = document.createDocumentFragment();
    projects.forEach(project => fragment.appendChild(createProjectCard(project)));
    grid.appendChild(fragment);
    status.hidden = true;

    filters.forEach(button => {
        button.addEventListener('click', () => {
            filters.forEach(filter => {
                const active = filter === button;
                filter.classList.toggle('active', active);
                filter.setAttribute('aria-pressed', String(active));
            });

            const selectedCategory = button.dataset.filter;
            grid.querySelectorAll('.project-card').forEach(card => {
                card.hidden = selectedCategory !== 'all'
                    && card.dataset.category !== selectedCategory;
            });
        });
    });
}

async function fetchProjects() {
    const status = document.getElementById('projects-status');

    try {
        const response = await fetch(API_URL, { headers: { Accept: 'application/json' } });
        if (!response.ok) {
            throw new Error(`Projects request failed with status ${response.status}`);
        }

        const projects = await response.json();
        if (!Array.isArray(projects)) {
            throw new Error('Projects API returned an invalid response.');
        }
        renderProjects(projects);
    } catch (error) {
        console.error('Unable to load portfolio projects.', error);
        if (status) {
            status.textContent = 'Projects could not be loaded. Please try again later.';
            status.hidden = false;
        }
    }
}

document.addEventListener('DOMContentLoaded', fetchProjects);
