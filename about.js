// about.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Define your skills
    const skills = [
        "HTML5", "CSS3", "JavaScript", "Responsive Design", 
        "Google Analytics setup", "Java (strong)", 
         "DataBase Connection", "Authentication", "MVC Architecture", "Spring Boot", "MySQL/Firebase",
        "MongoDB", "Android App Development(java)", 
        "Git", "GitHub", "UI/UX","ChatGPT Automation via AccessibilityService(AI Agents)",
        "Figma", "REST APIs", "Fast learner", "Problem Solver", "Independent developer vibes"
    ];

    const skillsContainer = document.getElementById('skills-container');

    // 2. Loop through the skills and create list items (bubbles)
    skills.forEach(skill => {
        const skillItem = document.createElement('li');
        skillItem.className = 'skill-item'; // Use the CSS class defined in style.css
        skillItem.textContent = skill;
        skillsContainer.appendChild(skillItem);
    });
});