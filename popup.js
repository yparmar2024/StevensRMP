document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('status');
  const searchInput = document.getElementById('professorSearch');
  const cardsContainer = document.getElementById('professorCards');

  // 1. Get the current active tab
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // 2. Verify we are on the Stevens Workday domain
  if (!tab.url) {
    statusEl.textContent = 'Please navigate to the Stevens Workday site to use this extension.';
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(tab.url);
  } catch (error) {
    statusEl.textContent = 'Invalid Workday URL.';
    return;
  }

  const isWorkdayHost = parsedUrl.hostname === 'wd5.myworkday.com';
  const isStevensPath = parsedUrl.pathname.startsWith('/stevens/');
  if (!isWorkdayHost || !isStevensPath) {
    statusEl.textContent = 'Please navigate to the Stevens Workday site to use this extension.';
    return;
  }

  // 3. Inject and execute the scraping script
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: scrapeProfessors
  }, (results) => {
    if (chrome.runtime.lastError || !results || !results[0]) {
      statusEl.textContent = 'Error scanning the page.';
      return;
    }

    const professors = results[0].result;

    // 4. Process the results
    if (!professors || professors.length === 0) {
      statusEl.textContent = 'No professors found.';
    } else {
      const uniqueProfessors = [...new Set(professors)];
      
      statusEl.textContent = `Found ${uniqueProfessors.length} unique professor(s):`;
      cardsContainer.innerHTML = ''; // Clear container

      const cardMap = new Map();
      
      // 5. Build the UI Cards
      uniqueProfessors.forEach(prof => {
        // Create main card
        const card = document.createElement('div');
        card.className = 'prof-card';
        card.dataset.professorName = normalizeText(prof);
        
        const ratingWrap = document.createElement('div');
        ratingWrap.className = 'prof-rating';
        ratingWrap.innerHTML = `
          <div class="rmp-rating-box"><span class="rmp-rating">--</span></div>
          <div class="rmp-rating-count">Loading...</div>
        `;

        const infoWrap = document.createElement('div');
        infoWrap.className = 'prof-info';
        infoWrap.innerHTML = `
          <a class="prof-name-link" target="_blank" rel="noopener noreferrer"></a>
          <div class="prof-meta">
            <div class="prof-department">Loading...</div>
            <div class="prof-take-again">Loading...</div>
            <div class="prof-difficulty">Loading...</div>
          </div>
        `;
        
        infoWrap.querySelector('.prof-name-link').textContent = prof;
        card.appendChild(ratingWrap);
        card.appendChild(infoWrap);
        cardsContainer.appendChild(card);

        cardMap.set(prof, {
          cardEl: card,
          ratingEl: ratingWrap.querySelector('.rmp-rating'),
          ratingBoxEl: ratingWrap.querySelector('.rmp-rating-box'),
          countEl: ratingWrap.querySelector('.rmp-rating-count'),
          nameLinkEl: infoWrap.querySelector('.prof-name-link'),
          departmentEl: infoWrap.querySelector('.prof-department'),
          takeAgainEl: infoWrap.querySelector('.prof-take-again'),
          difficultyEl: infoWrap.querySelector('.prof-difficulty')
        });
      });

      if (searchInput) {
        searchInput.addEventListener('input', () => {
          const query = normalizeText(searchInput.value);
          uniqueProfessors.forEach((prof) => {
            const cardRefs = cardMap.get(prof);
            if (!cardRefs) return;
            const matches = !query || cardRefs.cardEl.dataset.professorName.includes(query);
            cardRefs.cardEl.style.display = matches ? '' : 'none';
          });
        });
      }

      chrome.runtime.sendMessage(
        { type: 'fetchRmp', professors: uniqueProfessors },
        (response) => {
          if (!response || !response.ok) {
            statusEl.textContent = 'Error fetching Rate My Professors data.';
            return;
          }

          const data = response.data || {};
          uniqueProfessors.forEach((prof) => {
            const cardRefs = cardMap.get(prof);
            if (!cardRefs) return;

            const record = data[prof];
            if (!record) {
              cardRefs.ratingEl.textContent = '--';
              cardRefs.ratingBoxEl.style.background = '#e9ecef';
              cardRefs.countEl.textContent = 'No ratings';
              cardRefs.nameLinkEl.removeAttribute('href');
              cardRefs.departmentEl.textContent = 'Not found on Rate My Professors';
              cardRefs.takeAgainEl.textContent = '';
              cardRefs.difficultyEl.textContent = '';
              return;
            }

            cardRefs.ratingEl.textContent = record.rating ?? '--';
            cardRefs.ratingBoxEl.style.background = getRatingColor(record.rating);
            cardRefs.countEl.textContent = formatRatingCount(record.numRatings);
            cardRefs.nameLinkEl.href = record.profileUrl;
            cardRefs.departmentEl.textContent = record.department || 'Department unavailable';
            cardRefs.takeAgainEl.innerHTML = formatTakeAgainLine(record.wouldTakeAgainPercent);
            cardRefs.difficultyEl.innerHTML = formatDifficultyLine(record.avgDifficulty);
          });
        }
      );
    }
  });
});

/**
 * Injected into the webpage to scrape the Workday DOM.
 */
function scrapeProfessors() {
  const nodes = document.querySelectorAll('.gwt-InlineLabel.WPNF.WOMF');
  const instructors = [];
  
  nodes.forEach(node => {
    if (node.title) {
      const parts = node.title.split('|');
      if (parts.length >= 3) {
        const instructor = parts[2].trim();
        if (instructor) {
          instructors.push(instructor);
        }
      }
    }
  });
  
  return instructors;
}

function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function getRatingColor(rating) {
  const value = Number(rating);
  if (!Number.isFinite(value)) {
    return '#e9ecef';
  }
  if (value < 3) {
    return '#ff9c9d';
  }
  if (value < 4) {
    return '#fff271';
  }
  return '#7ff6c4';
}

function formatRatingCount(count) {
  const value = Number(count);
  if (!Number.isFinite(value)) {
    return 'No ratings';
  }
  return `${value} rating${value === 1 ? '' : 's'}`;
}

function formatTakeAgainLine(wouldTakeAgainPercent) {
  const value = Number(wouldTakeAgainPercent);
  if (!Number.isFinite(value)) {
    return 'No data for take again';
  }
  const displayValue = Math.round(value);
  return `<span class="prof-meta-value">${displayValue}%</span> would take again`;
}

function formatDifficultyLine(avgDifficulty) {
  const value = Number(avgDifficulty);
  if (!Number.isFinite(value)) {
    return 'No difficulty data';
  }
  return `<span class="prof-meta-value">${value.toFixed(1)}</span> level of difficulty`;
}