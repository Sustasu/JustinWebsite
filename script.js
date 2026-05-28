const navLinks = document.querySelectorAll("nav a[href^='#']");
const experienceCards = document.querySelectorAll(".experience-info-card");
const experienceModal = document.querySelector(".experience-modal");
const experienceModalTitle = document.querySelector("#experience-modal-title");
const experienceModalCopy = document.querySelectorAll(".experience-modal-copy");
const experienceModalClose = document.querySelector(".experience-modal-close");
const sections = Array.from(navLinks)
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

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

if (experienceModal && experienceModalTitle && experienceModalCopy.length === 2) {
  let activeExperienceCard = null;

  const openExperienceModal = (card) => {
    activeExperienceCard = card;
    experienceModalTitle.textContent = card.dataset.modalTitle || "";
    experienceModalCopy[0].textContent = card.dataset.modalCopyOne || "";
    experienceModalCopy[1].textContent = card.dataset.modalCopyTwo || "";

    experienceModal.hidden = false;
    document.body.classList.add("is-modal-open");
    experienceModalClose?.focus();
  };

  const closeExperienceModal = () => {
    experienceModal.hidden = true;
    document.body.classList.remove("is-modal-open");

    if (activeExperienceCard) {
      activeExperienceCard.focus();
      activeExperienceCard = null;
    }
  };

  document.addEventListener("click", (event) => {
    const card = event.target.closest(".experience-info-card");

    if (card) {
      openExperienceModal(card);
    }
  });

  experienceModalClose?.addEventListener("click", closeExperienceModal);

  experienceModal.addEventListener("click", (event) => {
    if (event.target === experienceModal) {
      closeExperienceModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !experienceModal.hidden) {
      closeExperienceModal();
    }
  });
}
