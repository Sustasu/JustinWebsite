const navLinks = document.querySelectorAll("nav a[href^='#']");
const experienceCards = document.querySelectorAll(".experience-info-card");
const experienceModal = document.querySelector(".experience-modal");
const experienceModalTitle = document.querySelector("#experience-modal-title");
const experienceModalCopy = document.querySelectorAll(".experience-modal-copy");
const experienceModalExtraContent = document.querySelector(".experience-modal-extra-content-container");
const experienceModalClose = document.querySelector(".experience-modal-close");
const heroActions = document.querySelector(".hero-actions");
const sections = Array.from(navLinks)
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

if (heroActions) {
  const stickyPlaceholder = document.createElement("div");
  stickyPlaceholder.className = "hero-actions-placeholder";
  stickyPlaceholder.setAttribute("aria-hidden", "true");
  heroActions.after(stickyPlaceholder);

  let stickyStart = 0;
  let ticking = false;

  const setStickyPosition = (sourceRect) => {
    heroActions.style.setProperty("--sticky-actions-top", "0px");
    heroActions.style.setProperty("--sticky-actions-left", "0px");
    heroActions.style.setProperty("--sticky-actions-width", "100vw");
  };

  const measureHeroActions = () => {
    const wasSticky = heroActions.classList.contains("is-sticky");

    if (wasSticky) {
      heroActions.classList.remove("is-sticky");
      stickyPlaceholder.style.display = "none";
    }

    const rect = heroActions.getBoundingClientRect();
    stickyStart = rect.top + window.scrollY;
    setStickyPosition(rect);

    if (wasSticky) {
      stickyPlaceholder.style.display = "block";
      stickyPlaceholder.style.height = `${rect.height}px`;
      heroActions.classList.add("is-sticky");
    }
  };

  const updateHeroActionsSticky = () => {
    ticking = false;
    const shouldStick = window.scrollY >= stickyStart - 1;

    if (shouldStick && !heroActions.classList.contains("is-sticky")) {
      const rect = heroActions.getBoundingClientRect();
      stickyPlaceholder.style.display = "block";
      stickyPlaceholder.style.height = `${rect.height}px`;
      setStickyPosition(rect);
      heroActions.classList.add("is-sticky");
      return;
    }

    if (!shouldStick && heroActions.classList.contains("is-sticky")) {
      heroActions.classList.remove("is-sticky");
      stickyPlaceholder.style.display = "none";
    }
  };

  const requestStickyUpdate = () => {
    if (!ticking) {
      window.requestAnimationFrame(updateHeroActionsSticky);
      ticking = true;
    }
  };

  measureHeroActions();
  updateHeroActionsSticky();
  window.addEventListener("scroll", requestStickyUpdate, { passive: true });
  window.addEventListener("resize", () => {
    measureHeroActions();
    requestStickyUpdate();
  });
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

if (experienceModal && experienceModalTitle && experienceModalCopy.length === 2) {
  let activeExperienceCard = null;

  const openExperienceModal = (card) => {
    activeExperienceCard = card;
    experienceModalTitle.textContent = card.dataset.modalTitle || "";

    experienceModalCopy.forEach((copy, index) => {
      const text = index === 0 ? card.dataset.modalCopyOne || "" : card.dataset.modalCopyTwo || "";
      copy.innerHTML = text;
      copy.hidden = text.trim() === "";
    });

    if (experienceModalExtraContent) {
      const extraContent = card.querySelector(".experience-modal-extra-content");
      experienceModalExtraContent.innerHTML = extraContent ? extraContent.innerHTML : "";
    }

    // If the injected content contains a PDF slideshow, initialise it
    const pdfContainer = experienceModalExtraContent.querySelector('.pdf-slideshow');
    if (pdfContainer && window.pdfjsLib) {
      initPdfSlideshow(pdfContainer);
      document.querySelector('.experience-modal-panel')?.classList.add('modal-pdf');
    }

    // If the injected content contains an image slideshow, initialise it
    const imageContainer = experienceModalExtraContent.querySelector('.image-slideshow');
    if (imageContainer) {
      initImageSlideshow(imageContainer);
      document.querySelector('.experience-modal-panel')?.classList.add('modal-gallery');
    }

    experienceModal.hidden = false;
    document.body.classList.add("is-modal-open");
    experienceModalClose?.focus();
  };

  // PDF slideshow state
  let _pdfState = null;
  let _imageState = null;

  const closeExperienceModal = () => {
    // cleanup pdf if present
    if (_pdfState && _pdfState.pdfDoc) {
      try {
        if (_pdfState.keyHandler) {
          document.removeEventListener('keydown', _pdfState.keyHandler);
        }
        _pdfState.pdfDoc.destroy();
      } catch (e) {
        /* ignore */
      }
      _pdfState = null;
    }
    if (_imageState && _imageState.keyHandler) {
      document.removeEventListener('keydown', _imageState.keyHandler);
      _imageState = null;
    }
    document.querySelector('.experience-modal-panel')?.classList.remove('modal-pdf');
    document.querySelector('.experience-modal-panel')?.classList.remove('modal-gallery');

    experienceModal.hidden = true;
    document.body.classList.remove("is-modal-open");

    if (activeExperienceCard) {
      activeExperienceCard.focus();
      activeExperienceCard = null;
    }
  };

  function initPdfSlideshow(container) {
    const url = container.dataset.pdfSrc;
    if (!url) return;

    const canvas = container.querySelector('.pdf-canvas');
    const prevBtn = container.querySelector('.pdf-prev');
    const nextBtn = container.querySelector('.pdf-next');
    const currentEl = container.querySelector('.pdf-current');
    const totalEl = container.querySelector('.pdf-total');
    const pagination = container.querySelector('.pdf-pagination');

    const ctx = canvas.getContext('2d');

    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.8.162/pdf.worker.min.js';

    _pdfState = { pdfDoc: null, currentPage: 1, totalPages: 0, rendering: false };

    pdfjsLib.getDocument(url).promise.then((pdfDoc_) => {
      _pdfState.pdfDoc = pdfDoc_;
      _pdfState.totalPages = pdfDoc_.numPages;
      totalEl.textContent = pdfDoc_.numPages;

      // build pagination dots
      pagination.innerHTML = '';
      for (let i = 1; i <= pdfDoc_.numPages; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.page = i;
        if (i === 1) btn.classList.add('active');
        btn.addEventListener('click', () => {
          queueRenderPage(i);
        });
        pagination.appendChild(btn);
      }

      renderPage(1);
    }).catch((err) => {
      console.error('PDF load error', err);
    });

    function renderPage(num) {
      if (!_pdfState || !_pdfState.pdfDoc) return;
      _pdfState.rendering = true;
      _pdfState.pdfDoc.getPage(num).then((page) => {
        const viewport = page.getViewport({ scale: 1 });
        const containerWidth = Math.min(document.querySelector('.experience-modal-panel').clientWidth * 0.9, 1000);
        const scale = containerWidth / viewport.width * 0.95;
        const vp = page.getViewport({ scale });
        canvas.width = vp.width;
        canvas.height = vp.height;
        const renderContext = {
          canvasContext: ctx,
          viewport: vp,
        };
        page.render(renderContext).promise.then(() => {
          _pdfState.rendering = false;
          _pdfState.currentPage = num;
          currentEl.textContent = num;
          // update dots
          Array.from(pagination.children).forEach((b) => b.classList.toggle('active', Number(b.dataset.page) === num));
        });
      });
    }

    let renderQueue = null;
    function queueRenderPage(num) {
      if (_pdfState.rendering) {
        renderQueue = num;
        const check = setInterval(() => {
          if (!_pdfState.rendering) {
            clearInterval(check);
            const q = renderQueue;
            renderQueue = null;
            renderPage(q);
          }
        }, 100);
      } else {
        renderPage(num);
      }
    }

    prevBtn.addEventListener('click', () => {
      const target = Math.max(1, _pdfState.currentPage - 1);
      if (target !== _pdfState.currentPage) queueRenderPage(target);
    });

    nextBtn.addEventListener('click', () => {
      const target = Math.min(_pdfState.totalPages, _pdfState.currentPage + 1);
      if (target !== _pdfState.currentPage) queueRenderPage(target);
    });

    // left/right keyboard navigation when modal open
    const keyHandler = (e) => {
      if (experienceModal.hidden) return;
      if (e.key === 'ArrowLeft') prevBtn.click();
      if (e.key === 'ArrowRight') nextBtn.click();
    };
    document.addEventListener('keydown', keyHandler);
    _pdfState.keyHandler = keyHandler;
  }

  function initImageSlideshow(container) {
    const slides = Array.from(container.querySelectorAll('.slide-image'));
    const prevBtn = container.querySelector('.slide-prev');
    const nextBtn = container.querySelector('.slide-next');
    const currentEl = container.querySelector('.slide-current');
    const totalEl = container.querySelector('.slide-total');
    const pagination = container.querySelector('.slide-pagination');

    if (!slides.length) return;

    let currentPage = 1;
    totalEl.textContent = slides.length;

    slides.forEach((slide, index) => {
      slide.classList.toggle('active', index === 0);
      slide.dataset.index = index + 1;
    });

    pagination.innerHTML = '';
    slides.forEach((_, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.page = index + 1;
      btn.classList.toggle('active', index === 0);
      btn.addEventListener('click', () => {
        setSlide(index + 1);
      });
      pagination.appendChild(btn);
    });

    const setSlide = (page) => {
      if (page < 1 || page > slides.length || page === currentPage) return;
      slides.forEach((slide) => {
        slide.classList.toggle('active', Number(slide.dataset.index) === page);
      });
      currentPage = page;
      currentEl.textContent = page;
      Array.from(pagination.children).forEach((btn) => {
        btn.classList.toggle('active', Number(btn.dataset.page) === page);
      });
    };

    prevBtn.addEventListener('click', () => {
      setSlide(Math.max(1, currentPage - 1));
    });

    nextBtn.addEventListener('click', () => {
      setSlide(Math.min(slides.length, currentPage + 1));
    });

    const keyHandler = (e) => {
      if (experienceModal.hidden) return;
      if (e.key === 'ArrowLeft') prevBtn.click();
      if (e.key === 'ArrowRight') nextBtn.click();
    };
    document.addEventListener('keydown', keyHandler);
    _imageState = { keyHandler };
  }

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

const recommendationGrid = document.querySelector('#recommendation-grid');
const recommendationTabs = document.querySelectorAll('.recommendation-tab');
const recommendationActionButton = document.querySelector('.recommendation-action');

const recommendationData = [
  {
    quote: 'Iustin is an extremely good QA who is highly skilled in manual testing and finding bugs, whether they be critical or based on specific edge cases. However, many QA engineers can do this, what sets him apart is his ability to understand multiple complicated processes and flows. He works across several different teams, seamlessly integrating with all, and is able to provide vital QA on various different parts of the system, from payments, search, pricing and multiple other highly varied and complex flows. Moreover, he is a keen advocate for testing quality, forming an integral member and a founder of a testing COP, which has embraced and continuously explored ways of utilising the ever growing portfolio of automated and AI tools to supercharge QA across the business. In summary, he is a great QA engineer, able to understand, test and contribute to multiple flows, and crucially, is able to collaborate, integrate and form social bonds across multiple teams which makes him an ideal fit for any company.',
    author: 'Irfan Hakim Boulestin',
    title: 'Senior Software Engineer at Secret Escapes',
    date: 'Jun 2025',
    type: 'received',
    relationship: 'Worked together at Secret Escapes',
    imageSrc: 'https://media.licdn.com/dms/image/v2/D4E03AQE8vaMzrytV5A/profile-displayphoto-shrink_100_100/profile-displayphoto-shrink_100_100/0/1673290519235?e=1781740800&v=beta&t=5ohcR7iU8VSkyx2jXGKg-ZvzRt4ExzHNHOmxD2k7EPY',
    imageAlt: 'Portrait of Irfan Hakim Boulestin',
  },
  {
    quote: 'I had the pleasure to work with Iustin at Secret Escapes where he was a quality assurance engineer across multiple product teams. Even though he was thinly spread across all of us, he always took the time to understand in depth what we were building, participated to our ceremonies and was involved in refinement sessions. He is one of the most hard-working, proactive people I have met in my career so far. He’s also super fun to work with and has a positive attitude that lights up the atmosphere in any team. I highly recommend Iustin and would love to work with him again in the future!',
    author: 'Cristina Trifonescu',
    title: 'Head of Product at Tide (GenAI, AI/ML)',
    date: 'Jan 2025',
    type: 'received',
    relationship: 'Collaborated on product strategy and delivery',
    imageSrc: 'https://media.licdn.com/dms/image/v2/D4E03AQFf5TKK75xqrA/profile-displayphoto-scale_100_100/B4EZxYOiKYGgAc-/0/1771006736501?e=1781740800&v=beta&t=EQ-tuEeXYduupK_pYwdfBeqT8cbkvj4V1fFB2GSURZI',
    imageAlt: 'Portrait of Cristina Trifonescu',
  },
  {
    quote: 'I worked with Iustin at Tangent for a few months in 2018 where he was the QA/Web Manager for a challenging digital web project. One of my requirements of a manual tester is that they\'re super detailed in what they do, and without doubt, this is what Iustin is. The way in which he tests, re-tests and then re-tests the re-tests is fabulous. Iustin is also extremely articulate in how he documents bugs that he finds. The level of clarity in Jira tickets any tester creates is extremely important to Developers. Provide too little information, and it\'s really tricky to know what you\'re looking for. Iustin takes real care and attention in providing an incredible level of detail in bugs he both finds and raises. It makes the life of a Developer working alongside him that much easier. Couple this with the fact that he\'s a super smart guy and a really lovely person, and he\'s an absolute gem to work with. I\'ll miss working alongside him. I sure hope we get to work together again in the future. Highly recommended.',
    author: 'Martin Burford',
    title: 'Senior Front-End Developer',
    date: 'Dec 2018',
    type: 'received',
    relationship: 'Worked together at Tangent',
    imageSrc: 'https://media.licdn.com/dms/image/v2/D4E35AQG_IJ6Jzgwb3Q/profile-framedphoto-shrink_100_100/B4EZniUl72HoAk-/0/1760438673631?e=1781020800&v=beta&t=HKL6wWoTmoI6-j3oVrL2n6YrkK6Q9uGAK46J7zSkkK0',
    imageAlt: 'Portrait of Martin Burford',
  },
];

function renderRecommendations(recommendations) {
  if (!recommendationGrid) return;

  recommendationGrid.innerHTML = '';

  if (!recommendations.length) {
    recommendationGrid.innerHTML = '<div class="recommendation-loading">No recommendations are available yet.</div>';
    return;
  }

  recommendations.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'recommendation-card';

    const meta = document.createElement('div');
    meta.className = 'recommendation-meta';

    const avatar = document.createElement('div');
    avatar.className = 'recommendation-avatar';
    const img = document.createElement('img');
    img.src = item.imageSrc;
    img.alt = item.imageAlt || item.author;
    avatar.appendChild(img);

    const textMeta = document.createElement('div');
    textMeta.className = 'recommendation-text-meta';

    const name = document.createElement('p');
    name.className = 'recommendation-name';
    name.textContent = item.author;

    const details = document.createElement('div');
    details.className = 'recommendation-details';

    const title = document.createElement('span');
    title.textContent = item.title;

    const relationship = document.createElement('span');
    relationship.textContent = item.relationship;

    const date = document.createElement('span');
    date.textContent = item.date;

    details.append(title, relationship, date);
    textMeta.append(name, details);
    meta.append(avatar, textMeta);

    const quote = document.createElement('p');
    quote.className = 'recommendation-quote';
    quote.textContent = `"${item.quote}"`;

    const author = document.createElement('p');
    author.className = 'recommendation-author';
    author.textContent = `— ${item.author}`;

    card.append(meta, quote, author);
    recommendationGrid.appendChild(card);
  });
}

function setActiveRecommendationFilter(filter) {
  const filtered = recommendationData.filter((item) => item.type === filter);
  recommendationTabs.forEach((tab) => {
    const isActive = tab.dataset.filter === filter;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });
  renderRecommendations(filtered);
}

recommendationTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    setActiveRecommendationFilter(tab.dataset.filter);
  });
});

recommendationActionButton?.addEventListener('click', () => {
  window.open('https://www.linkedin.com/in/iustin-balta-cojocaru-stan-3200a2139/details/recommendations/?detailScreenTabIndex=0', '_blank');
});

setActiveRecommendationFilter('received');
