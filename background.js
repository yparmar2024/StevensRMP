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

async function fetchRatingsForQuery(query, schoolId) {
  const url = `https://www.ratemyprofessors.com/search/professors/${schoolId}?q=${encodeURIComponent(query)}`;
  const html = await fetch(url).then(response => response.text());
  const store = extractRelayStore(html);
  if (!store) {
    return null;
  }

  const teachers = getTeachersForSchool(store, schoolId);
  console.log(teachers);
  const match = findTeacherMatch(teachers, query);

  if (!match) {
    return null;
  }

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

function findTeacherMatch(teachers, query) {
  const normalized = normalizeName(query);
  return teachers.find((teacher) => {
    const fullName = `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim();
    return normalizeName(fullName) === normalized;
  }) || null;
}

function normalizeName(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function getTeachersForSchool(store, schoolId) {
  const allTeachers = Object.values(store).filter(node => node && node.__typename === 'Teacher');
  const schoolRef = findSchoolRef(store, schoolId);

  if (!schoolRef) {
    return allTeachers;
  }

  return allTeachers.filter(teacher => teacher.school && teacher.school.__ref === schoolRef);
}

function findSchoolRef(store, schoolId) {
  const schoolNode = Object.values(store).find(node => {
    return node && node.__typename === 'School' && Number(node.legacyId) === Number(schoolId);
  });

  return schoolNode ? schoolNode.__id : null;
}

function extractRelayStore(html) {
  const marker = 'window.__RELAY_STORE__ = ';
  const start = html.indexOf(marker);
  if (start < 0) {
    return null;
  }

  const after = html.slice(start + marker.length);
  const end = after.indexOf('window.process');
  if (end < 0) {
    return null;
  }

  let jsonText = after.slice(0, end).trim();
  if (jsonText.endsWith(';')) {
    jsonText = jsonText.slice(0, -1);
  }

  return JSON.parse(jsonText);
}