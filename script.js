const cursorHalo = document.querySelector(".cursor-halo");
const navLinks = document.querySelectorAll("nav a[href^='#']");
const sections = Array.from(navLinks)
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

if (cursorHalo && window.matchMedia("(pointer: fine)").matches) {
  let haloX = window.innerWidth / 2;
  let haloY = window.innerHeight / 2;
  let targetX = haloX;
  let targetY = haloY;

  const isRedBackground = (event) => {
    let element = document.elementFromPoint(event.clientX, event.clientY);

    if (!element || element === document.documentElement || element === document.body) {
      return true;
    }

    if (element.closest(".brand, .button.primary, nav a.is-active")) {
      return true;
    }

    while (element && element !== document.documentElement) {
      const backgroundColor = window.getComputedStyle(element).backgroundColor;
      const redMatch = backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);

      if (redMatch) {
        const [, red, green, blue] = redMatch.map(Number);

        if (red > 180 && green < 90 && blue < 110) {
          return true;
        }
      }

      element = element.parentElement;
    }

    return false;
  };

  const animateHalo = () => {
    haloX += (targetX - haloX) * 0.14;
    haloY += (targetY - haloY) * 0.14;

    cursorHalo.style.transform = `translate3d(${haloX}px, ${haloY}px, 0) translate(-50%, -50%)`;
    window.requestAnimationFrame(animateHalo);
  };

  document.addEventListener("mousemove", (event) => {
    targetX = event.clientX;
    targetY = event.clientY;
    cursorHalo.classList.add("is-visible");
    cursorHalo.classList.toggle("is-on-red", isRedBackground(event));
  });

  document.addEventListener("mouseleave", () => {
    cursorHalo.classList.remove("is-visible");
  });

  animateHalo();
}

if ("IntersectionObserver" in window && sections.length > 0) {
  const observer = new IntersectionObserver(
    (entries) => {
      const visibleEntry = entries.find((entry) => entry.isIntersecting);

      if (!visibleEntry) {
        return;
      }

      navLinks.forEach((link) => {
        link.classList.toggle(
          "is-active",
          link.getAttribute("href") === `#${visibleEntry.target.id}`,
        );
      });
    },
    {
      rootMargin: "-35% 0px -55% 0px",
      threshold: 0,
    },
  );

  sections.forEach((section) => observer.observe(section));
}
