const skillCards = document.querySelectorAll(".skill-card");
const cursorHalo = document.querySelector(".cursor-halo");

skillCards.forEach((card) => {
  card.addEventListener("toggle", () => {
    if (!card.open) {
      return;
    }

    skillCards.forEach((otherCard) => {
      if (otherCard !== card) {
        otherCard.open = false;
      }
    });
  });
});

if (cursorHalo && window.matchMedia("(pointer: fine)").matches) {
  let haloX = window.innerWidth / 2;
  let haloY = window.innerHeight / 2;
  let targetX = haloX;
  let targetY = haloY;

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
  });

  document.addEventListener("mouseleave", () => {
    cursorHalo.classList.remove("is-visible");
  });

  animateHalo();
}
