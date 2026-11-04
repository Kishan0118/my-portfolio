document.addEventListener("DOMContentLoaded", () => {
    const skillsContainer = document.getElementById("skills-groups");
    if (!skillsContainer) return;

    const groups = [
        { title: "Android development", color: "var(--mint)", skills: ["Java", "Kotlin", "Android SDK", "AccessibilityService"] },
        { title: "Backend and APIs", color: "var(--blue)", skills: ["Spring Boot · learning", "REST API development", "Backend services", "MVC Architecture"] },
        { title: "Data", color: "var(--coral)", skills: ["Firebase", "MySQL", "MongoDB"] },
        { title: "Web and tools", color: "var(--blue)", skills: ["HTML", "CSS", "JavaScript", "Git", "GitHub", "Figma"] }
    ];

    groups.forEach((group, index) => {
        const article = document.createElement("article");
        article.className = "skill-group reveal" + (index > 1 ? " reveal-delay-1" : "");
        article.style.setProperty("--skill-color", group.color);

        const heading = document.createElement("h3");
        heading.textContent = group.title;
        const list = document.createElement("ul");
        list.className = "skill-list";
        group.skills.forEach((skill) => {
            const item = document.createElement("li");
            item.className = "skill-tag";
            item.textContent = skill;
            list.appendChild(item);
        });

        article.append(heading, list);
        skillsContainer.appendChild(article);
        requestAnimationFrame(() => article.classList.add("is-visible"));
    });
});
