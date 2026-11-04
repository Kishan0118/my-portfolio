// Copy edits for older public project records. An admin-edited value always wins.
const legacyProjectCopy = {
    SocwVxkPJjVI8gPL1Slc: {
        name: 'E-Commerce Web App',
        description: 'A full-stack shopping experience built with React and Redux, backed by a Node.js and MongoDB service.',
        legacyName: 'E-Commerce Web App',
        legacyDescription: 'A full-stack e-commerce platform...'
    },
    U6kMQPBKnNLjzjwLMaP4: {
        name: 'Weather App',
        description: 'A daily weather app that brings current conditions and multi-day forecasts into a clear Android interface.',
        legacyName: 'Weather App',
        legacyDescription: 'A simple, yet Modern Weather app for daily productivity'
    },
    fU0gkQFnfsDjtN3wPb1c: {
        name: 'Image Recognition AI',
        description: 'A web-based image recognition service that classifies images in real time using a deep learning model.',
        legacyName: 'Image Recognition AI',
        legacyDescription: 'A deep learning module integrated into a web service for real-time image classifiction'
    },
    rNVu2XDaWXpbFLKaP4LE: {
        name: 'Web Scraping Automation Bot',
        description: 'An automation tool that gathers information from multiple websites and organizes the results into CSV files.',
        legacyName: 'web Scraping Automation Bot',
        legacyDescription: 'Automated data extraction from multiple website and consolidation into csv fotmat'
    },
    uP4IOTJW5MMGRIKwIMxe: {
        name: 'Task Manager Android App',
        description: 'An Android task manager for everyday planning, with task data stored locally in SQLite.',
        legacyName: 'Task Manager Android App',
        legacyDescription: 'A simple, yet powerful task management application for daily productivity.'
    }
};

window.presentPortfolioProject = function(project) {
    if (!project || typeof project !== 'object') return project;
    const copy = legacyProjectCopy[String(project.id)];
    if (!copy) return project;
    return {
        ...project,
        name: project.name === copy.legacyName ? copy.name : project.name,
        description: project.description === copy.legacyDescription ? copy.description : project.description
    };
};
