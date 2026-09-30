const navLinks = document.querySelectorAll("nav a[href^='#']");
const experienceCards = document.querySelectorAll(".experience-info-card");
const experienceModal = document.querySelector(".experience-modal");
const experienceModalTitle = document.querySelector("#experience-modal-title");
const experienceModalCopy = document.querySelectorAll(".experience-modal-copy");
const experienceModalExtraContent = document.querySelector(".experience-modal-extra-content-container");
const experienceModalClose = document.querySelector(".experience-modal-close");
const sections = Array.from(navLinks)
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);
const siteHeader = document.querySelector(".site-header");

if (siteHeader) {
  const updateHeaderShadow = () => {
    siteHeader.classList.toggle("is-scrolled", window.scrollY > 4);
  };

  updateHeaderShadow();
  window.addEventListener("scroll", updateHeaderShadow, { passive: true });
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
  let modalScrollPosition = 0;

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
      document.querySelector('.experience-modal-panel')?.classList.add('modal-gallery');
    }

    modalScrollPosition = window.scrollY;
    document.body.style.top = `-${modalScrollPosition}px`;
    experienceModal.hidden = false;
    document.documentElement.classList.add("is-modal-open");
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
    document.documentElement.classList.remove("is-modal-open");
    document.body.classList.remove("is-modal-open");
    document.body.style.top = "";
    window.scrollTo({ top: modalScrollPosition, left: 0, behavior: "instant" });

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

const recommendationData = [
  {
    quote: 'Iustin is an absolute gem! He is incredibly product-minded, and develops a deep understanding of how things should work and what is best for users, this quality means he writes genuinely useful test cases, and is able to identify bugs others just wouldn\'t spot whiles hardly ever raising issues where there are none. He is a genuinely lovely and unique individual who has contributed more to our team culture than almost anyone else bringing his own brand of quirky fun.',
    author: 'Ben Deavin',
    title: 'Senior Engineering Manager at Secret Escapes',
    date: 'Jun 30, 2026',
    type: 'received',
    relationship: 'Managed Iustin directly',
    imageSrc: 'https://media.licdn.com/dms/image/v2/D4E03AQFLlTo6oo3kCg/profile-displayphoto-shrink_100_100/profile-displayphoto-shrink_100_100/0/1686319753850?e=1792022400&v=beta&t=n9OOyIKIPMIUZd3UaA7OC_Ed5i_xOiUD3QySTEEBmp0',
    imageAlt: 'Portrait of Ben Deavin',
  },
  {
    quote: 'Iustin is an extremely good QA who is highly skilled in manual testing and finding bugs, whether they be critical or based on specific edge cases. However, many QA engineers can do this, what sets him apart is his ability to understand multiple complicated processes and flows. He works across several different teams, seamlessly integrating with all, and is able to provide vital QA on various different parts of the system, from payments, search, pricing and multiple other highly varied and complex flows. Moreover, he is a keen advocate for testing quality, forming an integral member and a founder of a testing COP, which has embraced and continuously explored ways of utilising the ever growing portfolio of automated and AI tools to supercharge QA across the business. In summary, he is a great QA engineer, able to understand, test and contribute to multiple flows, and crucially, is able to collaborate, integrate and form social bonds across multiple teams which makes him an ideal fit for any company.',
    author: 'Irfan Hakim Boulestin',
    title: 'Senior Software Engineer at Secret Escapes',
    date: 'Dec 2, 2025',
    type: 'received',
    relationship: 'Worked on the same team',
    imageSrc: 'https://media.licdn.com/dms/image/v2/D4E03AQE8vaMzrytV5A/profile-displayphoto-shrink_100_100/profile-displayphoto-shrink_100_100/0/1673290519235?e=1792022400&v=beta&t=BffA3EQLTyf1O-hAaeYW_zc1X0H08oEvPMBAcSJhplQ',
    imageAlt: 'Portrait of Irfan Hakim Boulestin',
  },
  {
    quote: 'I had the pleasure to work with Iustin at Secret Escapes where he was a quality assurance engineer across multiple product teams. Even though he was thinly spread across all of us, he always took the time to understand in depth what we were building, participated to our ceremonies and was involved in refinement sessions. He is one of the most hard-working, proactive people I have met in my career so far. He’s also super fun to work with and has a positive attitude that lights up the atmosphere in any team. I highly recommend Iustin and would love to work with him again in the future!',
    author: 'Cristina Trifonescu',
    title: 'Head of Product at Tide (GenAI, AI/ML)',
    date: 'Jan 27, 2021',
    type: 'received',
    relationship: 'Worked on the same team',
    imageSrc: 'https://media.licdn.com/dms/image/v2/D4E03AQFf5TKK75xqrA/profile-displayphoto-scale_100_100/B4EZxYOiKYGgAc-/0/1771006736501?e=1792022400&v=beta&t=UEWfQYxpKSstRfszQO7e9hfYv0lmziIFP8WdGdQ4-10',
    imageAlt: 'Portrait of Cristina Trifonescu',
  },
  {
    quote: 'I worked with Iustin at Tangent for a few months in 2018 where he was the QA/Web Manager for a challenging digital web project. One of my requirements of a manual tester is that they\'re super detailed in what they do, and without doubt, this is what Iustin is. The way in which he tests, re-tests and then re-tests the re-tests is fabulous. Iustin is also extremely articulate in how he documents bugs that he finds. The level of clarity in Jira tickets any tester creates is extremely important to Developers. Provide too little information, and it\'s really tricky to know what you\'re looking for. Iustin takes real care and attention in providing an incredible level of detail in bugs he both finds and raises. It makes the life of a Developer working alongside him that much easier. Couple this with the fact that he\'s a super smart guy and a really lovely person, and he\'s an absolute gem to work with. I\'ll miss working alongside him. I sure hope we get to work together again in the future. Highly recommended.',
    author: 'Martin Burford',
    title: 'Senior Front-End Developer (27+ years exp) immediately available for React work | 141 recommendations',
    date: 'Apr 3, 2018',
    type: 'received',
    relationship: 'Worked on the same team',
    imageSrc: 'assets/martin-burford.jpg',
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

setActiveRecommendationFilter('received');

const robotGuide = document.querySelector('#robot-guide');
const robotSearchInput = document.querySelector('#robot-search-input');
const robotSearchForm = document.querySelector('.robot-search-form');
const robotChatLog = document.querySelector('.robot-chat-log');
const robotCloseButtons = document.querySelectorAll('.robot-close');

if (robotGuide) {
  const showSearchPrompt = () => {
    robotGuide.classList.remove('is-oh', 'is-scratching');
    robotGuide.classList.add('is-searching');
    robotSearchInput?.focus({ preventScroll: true });
  };

  window.setTimeout(() => {
    robotGuide.hidden = false;
    requestAnimationFrame(() => {
      robotGuide.classList.add('is-visible');
    });

    window.setTimeout(() => {
      robotGuide.classList.add('is-greeting');
    }, 4800);

    window.setTimeout(() => {
      robotGuide.classList.remove('is-greeting');
      robotGuide.classList.add('is-looking-away', 'is-oh');
    }, 9500);

    window.setTimeout(() => {
      robotGuide.classList.remove('is-oh');
      robotGuide.classList.add('is-scratching');
    }, 12500);

    window.setTimeout(showSearchPrompt, 14000);
  }, 10000);
}

const clearRobotHighlights = () => {
  document.querySelectorAll('main .robot-highlight').forEach((highlight) => {
    highlight.replaceWith(document.createTextNode(highlight.textContent || ''));
  });
};

const getRobotEditDistance = (first, second) => {
  const previousRow = Array.from({ length: second.length + 1 }, (_, index) => index);

  for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
    const currentRow = [firstIndex];
    for (let secondIndex = 1; secondIndex <= second.length; secondIndex += 1) {
      const substitutionCost = first[firstIndex - 1] === second[secondIndex - 1] ? 0 : 1;
      currentRow[secondIndex] = Math.min(
        currentRow[secondIndex - 1] + 1,
        previousRow[secondIndex] + 1,
        previousRow[secondIndex - 1] + substitutionCost
      );
    }
    previousRow.splice(0, previousRow.length, ...currentRow);
  }

  return previousRow[second.length];
};

const resolveRobotTerms = (terms) => {
  const pageWords = (document.querySelector('main')?.innerText.toLowerCase().match(/[a-z0-9+#.-]+/g) || []);
  const vocabulary = [...new Set(pageWords.filter((word) => word.length > 2))];
  const vocabularySet = new Set(vocabulary);
  const corrections = [];

  const resolvedTerms = terms.map((term) => {
    if (vocabularySet.has(term) || term.length < 4) return term;

    const maximumDistance = term.length >= 7 ? 2 : 1;
    let closestTerm = term;
    let closestDistance = maximumDistance + 1;

    vocabulary.forEach((candidate) => {
      if (Math.abs(candidate.length - term.length) > maximumDistance) return;
      const distance = getRobotEditDistance(term, candidate);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestTerm = candidate;
      }
    });

    if (closestTerm !== term) corrections.push({ from: term, to: closestTerm });
    return closestTerm;
  });

  return { terms: [...new Set(resolvedTerms)], corrections };
};

const getRobotAlternatives = (terms) => {
  const cvText = document.querySelector('main')?.innerText.toLowerCase() || '';
  const cvTopics = [
    'accessibility', 'agile', 'api', 'automation', 'cypress', 'jira',
    'leadership', 'manual', 'mobile', 'performance', 'playwright', 'qa',
    'selenium', 'testing'
  ].filter((topic) => cvText.includes(topic));

  const rankedTopics = cvTopics
    .map((topic) => ({
      topic,
      distance: Math.min(...terms.map((term) => getRobotEditDistance(term, topic)))
    }))
    .sort((first, second) => first.distance - second.distance);
  const closeTopics = rankedTopics
    .filter(({ distance }) => distance <= 3)
    .slice(0, 2)
    .map(({ topic }) => topic);

  return closeTopics.length ? closeTopics : ['qa', 'automation', 'testing'];
};

const highlightRobotSearch = (value) => {
  clearRobotHighlights();
  const query = value.trim();
  if (!query) return { count: 0, terms: [] };

  const stopWords = new Set([
    'a', 'about', 'all', 'an', 'and', 'any', 'are', 'can', 'cv', 'did', 'do',
    'does', 'experience', 'for', 'has', 'have', 'he', 'his', 'how', 'i', 'in',
    'is', 'it', 'know', 'me', 'of', 'on', 'please', 'show', 'skills', 'tell',
    'the', 'to', 'what', 'with', 'work', 'worked', 'you'
  ]);
  const requestedTerms = [...new Set(query
    .toLowerCase()
    .match(/[a-z0-9+#.-]+/g) || [])]
    .filter((term) => term.length > 1 && !stopWords.has(term));
  const { terms: resolvedTerms, corrections } = resolveRobotTerms(requestedTerms);
  const terms = resolvedTerms
    .sort((first, second) => second.length - first.length)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!terms.length) return { count: 0, terms: [], corrections: [] };

  const matcher = new RegExp(terms.join('|'), 'gi');
  const walker = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let currentNode = walker.nextNode();
  while (currentNode) {
    if (!currentNode.parentElement?.closest('script, style')) {
      textNodes.push(currentNode);
    }
    currentNode = walker.nextNode();
  }

  let firstMatch = null;
  let matchCount = 0;
  textNodes.forEach((textNode) => {
    matcher.lastIndex = 0;
    if (!matcher.test(textNode.nodeValue || '')) return;
    matcher.lastIndex = 0;
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match = matcher.exec(textNode.nodeValue || '');
    while (match) {
      fragment.appendChild(document.createTextNode((textNode.nodeValue || '').slice(lastIndex, match.index)));
      const highlight = document.createElement('mark');
      highlight.className = 'robot-highlight';
      highlight.textContent = match[0];
      fragment.appendChild(highlight);
      matchCount += 1;
      firstMatch ||= highlight;
      lastIndex = match.index + match[0].length;
      match = matcher.exec(textNode.nodeValue || '');
    }
    fragment.appendChild(document.createTextNode((textNode.nodeValue || '').slice(lastIndex)));
    textNode.replaceWith(fragment);
  });

  firstMatch?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return { count: matchCount, terms, corrections };
};

const addRobotMessage = (message, sender) => {
  if (!robotChatLog) return;
  const chatMessage = document.createElement('p');
  chatMessage.className = `robot-chat-message robot-chat-message-${sender}`;
  chatMessage.textContent = message;
  robotChatLog.appendChild(chatMessage);
  robotChatLog.scrollTop = robotChatLog.scrollHeight;
};

const getRobotFallbackMessage = (topics, count) => {
  const relatedAreas = count === 1 ? 'related area' : 'related areas';
  const responses = [
    `That sounds closest to ${topics}. I've highlighted ${count} ${relatedAreas} you may find useful.`,
    `A useful direction here is ${topics}. I've marked ${count} ${relatedAreas} across the CV.`,
    `The strongest related themes are ${topics}. You can now see ${count} highlighted ${relatedAreas}.`,
    `I'd point you toward ${topics}. I've highlighted ${count} ${relatedAreas} worth exploring.`,
    `${topics} look like the best related fit. I've surfaced ${count} ${relatedAreas} for you.`
  ];

  return responses[Math.floor(Math.random() * responses.length)];
};

const answerRobotQuestion = () => {
  const question = robotSearchInput?.value.trim() || '';
  if (!question) return;

  addRobotMessage(question, 'user');
  const result = highlightRobotSearch(question);
  const correctionMessage = result.corrections.length
    ? `I understood ${result.corrections.map(({ from, to }) => `“${from}” as “${to}”`).join(' and ')}. `
    : '';

  if (!result.terms.length) {
    addRobotMessage('Ask me about a specific skill, tool, role, or type of testing.', 'bot');
  } else if (result.count === 0) {
    const alternatives = getRobotAlternatives(result.terms);
    const alternativeResult = highlightRobotSearch(alternatives.join(' '));
    const alternativeSubject = alternatives.join(', ');
    const fallbackMessage = getRobotFallbackMessage(alternativeSubject, alternativeResult.count);
    addRobotMessage(`${correctionMessage}${fallbackMessage}`, 'bot');
  } else {
    const subject = result.terms.map((term) => term.replace(/\\/g, '')).join(', ');
    const mentions = result.count === 1 ? 'mention' : 'mentions';
    addRobotMessage(`${correctionMessage}Yes — I found ${result.count} ${mentions} related to ${subject}. I've highlighted them for you.`, 'bot');
  }

  robotSearchInput.value = '';
};

robotSearchForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  answerRobotQuestion();
});

robotSearchInput?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  answerRobotQuestion();
});

robotCloseButtons.forEach((button) => {
  button.addEventListener('click', () => {
    robotGuide.hidden = true;
    robotGuide.classList.remove(
      'is-visible',
      'is-greeting',
      'is-looking-away',
      'is-oh',
      'is-scratching',
      'is-searching'
    );
  });
});
