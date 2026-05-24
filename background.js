chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'fetchRmp') {
    return;
  }

  (async () => {
    try {
      const results = await fetchRatingsForProfessors(message.professors || []);
      sendResponse({ ok: true, data: results });
    } catch (error) {
      sendResponse({ ok: false, error: String(error) });
    }
  })();

  return true;
});

/**
 * Iterates through a list of professor names and fetches their RMP data.
 * @param {string[]} professors - Array of professor names.
 * @param {number} [schoolId=982] - The Rate My Professors school ID (defaults to Stevens).
 * @returns {Promise<Object>} Dictionary mapping professor names to their rating data.
 */
async function fetchRatingsForProfessors(professors, schoolId = 982) {
  const unique = Array.from(new Set((professors || []).map(name => name.trim()).filter(Boolean)));
  const results = {};

  await Promise.all(unique.map(async (name) => {
    const data = await fetchRatingsForQuery(name, schoolId);
    if (data) {
      results[name] = data;
    }
  }));

  return results;
}

/**
 * Fetches the Rate My Professors search page and extracts the teacher data.
 * @param {string} query - The professor's name to search.
 * @param {number} schoolId - The Rate My Professors school ID.
 * @returns {Promise<Object|null>} The formatted teacher data or null if not found.
 */
async function fetchRatingsForQuery(query, schoolId) {
  const url = `https://www.ratemyprofessors.com/search/professors/${schoolId}?q=${encodeURIComponent(query)}`;
  const html = await fetch(url).then(response => response.text());
  const store = extractRelayStore(html);
  
  if (!store) return null;

  const teachers = getTeachersForSchool(store, schoolId);
  const match = findTeacherMatch(teachers, query);

  if (!match) return null;

  return {
    name: `${match.firstName} ${match.lastName}`.trim(),
    rating: match.avgRating,
    numRatings: match.numRatings,
    wouldTakeAgainPercent: match.wouldTakeAgainPercent,
    avgDifficulty: match.avgDifficulty,
    department: match.department,
    legacyId: match.legacyId,
    profileUrl: `https://www.ratemyprofessors.com/professor/${match.legacyId}`
  };
}

/**
 * Finds the best matching teacher from a list based on the search query.
 * @param {Object[]} teachers - Array of teacher objects from the Relay store.
 * @param {string} query - The name query to match against.
 * @returns {Object|null} The best matching teacher object, or null.
 */
function findTeacherMatch(teachers, query) {
  const normalizedQuery = normalizeForMatch(query);
  
  const exactMatch = teachers.find((teacher) => {
    const fullName = `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim();
    return normalizeForMatch(fullName) === normalizedQuery;
  });

  if (exactMatch) return exactMatch;

  const partialMatches = teachers.filter((teacher) => {
    const fullName = `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim();
    const normalizedFullName = normalizeForMatch(fullName);
    return normalizedQuery.includes(normalizedFullName);
  });

  if (!partialMatches.length) return null;

  return partialMatches.sort((a, b) => {
    const nameA = normalizeForMatch(`${a.firstName || ''} ${a.lastName || ''}`.trim());
    const nameB = normalizeForMatch(`${b.firstName || ''} ${b.lastName || ''}`.trim());
    return nameB.length - nameA.length;
  })[0];
}

/**
 * Normalizes a string by converting to lowercase and stripping extra spaces.
 * @param {string} value - The string to normalize.
 * @returns {string} The normalized string.
 */
function normalizeName(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Normalizes a string for matching by removing non-alphabetic characters.
 * @param {string} value - The string to normalize.
 * @returns {string} The normalized string suitable for comparison.
 */
function normalizeForMatch(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Filters the Relay store to find all teachers belonging to a specific school.
 * @param {Object} store - The parsed Relay store object.
 * @param {number} schoolId - The target school ID.
 * @returns {Object[]} Array of teacher objects.
 */
function getTeachersForSchool(store, schoolId) {
  const allTeachers = Object.values(store).filter(node => node && node.__typename === 'Teacher');
  const schoolRef = findSchoolRef(store, schoolId);

  if (!schoolRef) return allTeachers;

  return allTeachers.filter(teacher => teacher.school && teacher.school.__ref === schoolRef);
}

/**
 * Finds the internal reference ID for a school in the Relay store.
 * @param {Object} store - The parsed Relay store object.
 * @param {number} schoolId - The target school ID.
 * @returns {string|null} The school's internal reference ID, or null.
 */
function findSchoolRef(store, schoolId) {
  const schoolNode = Object.values(store).find(node => {
    return node && node.__typename === 'School' && Number(node.legacyId) === Number(schoolId);
  });

  return schoolNode ? schoolNode.__id : null;
}

/**
 * Extracts and parses the embedded __RELAY_STORE__ JSON from raw RMP HTML.
 * @param {string} html - The raw HTML string.
 * @returns {Object|null} The parsed JSON store, or null if not found.
 */
function extractRelayStore(html) {
  const marker = 'window.__RELAY_STORE__ = ';
  const start = html.indexOf(marker);
  if (start < 0) return null;

  const after = html.slice(start + marker.length);
  const end = after.indexOf('window.process');
  if (end < 0) return null;

  let jsonText = after.slice(0, end).trim();
  if (jsonText.endsWith(';')) {
    jsonText = jsonText.slice(0, -1);
  }

  try {
    return JSON.parse(jsonText);
  } catch (e) {
    return null;
  }
}