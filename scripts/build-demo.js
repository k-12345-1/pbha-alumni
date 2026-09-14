/* eslint-disable */
// Builds docs/index.html — the static GitHub Pages demo.
//
// GitHub Pages serves files, not servers, so the demo cannot talk to the API.
// This script takes the real front end verbatim and injects a mock that
// answers the same calls from the seed roster baked in as JSON. The UI code is
// not copied or forked: public/index.html stays the single source of truth,
// and the only demo-awareness in it is the window.__demoRequest hook.
//
//   node scripts/build-demo.js
//
// The demo is read-only. Saves and privacy changes reject with a message
// saying so, rather than silently pretending to work.

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const people = require(path.join(ROOT, "src/seed/demo-people.json"));
const { PROGRAMS, PBHA_ROLES, HOUSES, GENDER_OPTIONS, RACE_OPTIONS, INDUSTRIES, CITIES } = require("./vocab.js");

// Same rule as src/lib/class-year.ts: the boundary rolls on June 1.
const studentBoundaryYear = () => {
  const now = new Date();
  return now.getUTCMonth() < 5 ? now.getUTCFullYear() : now.getUTCFullYear() + 1;
};

const idFor = (email) => email.replace(/[^a-z0-9]/gi, "-").toLowerCase();

const profiles = people.map((p) => ({
  userId: idFor(p.email),
  first: p.first,
  last: p.last,
  pronouns: p.pronouns ?? null,
  year: p.year,
  location: p.location ?? null,
  photoUrl: p.photoUrl ?? null,
  career: p.career ?? null,
  industry: p.industry ?? null,
  concentration: p.concentration ?? null,
  house: p.house ?? null,
  bio: p.bio ?? null,
  // Identity rides along only for members who opted to show it, mirroring
  // what the server sends: it blanks these for everyone else rather than
  // shipping them and hiding them in the UI.
  gender: p.showIdentity ? (p.gender ?? null) : null,
  raceEthnicity: p.showIdentity ? (p.raceEthnicity ?? []) : [],
  showIdentity: !!p.showIdentity,
  programs: p.programs || [],
  programYears: null,
  pbhaRole: p.pbhaRole ?? null,
  involvement: p.involvement ?? null,
  openToMentor: !!p.openToMentor,
  reachOut: p.reachOut ?? null,
  // Unclaimed rows keep their INVITED treatment in the demo too.
  claimedAt: p.unclaimed ? null : new Date().toISOString(),
  isCurrentStudent: p.year >= studentBoundaryYear(),
  searchText: [p.first, p.last, p.location, p.career, p.industry, p.concentration, p.pbhaRole, p.house, p.involvement, ...(p.programs || [])]
    .filter(Boolean).join(" ").toLowerCase(),
}));

const DEMO_VIEWER = profiles.find((p) => p.claimedAt) || profiles[0];

const runtime = `
<script>
(function () {
  var PROFILES = ${JSON.stringify(profiles)};
  var VOCAB = ${JSON.stringify({ programs: PROGRAMS, roles: PBHA_ROLES, houses: HOUSES, genders: GENDER_OPTIONS, races: RACE_OPTIONS, industries: INDUSTRIES, cities: CITIES })};
  var VIEWER_ID = ${JSON.stringify(DEMO_VIEWER.userId)};
  var STUDENT_BOUNDARY = ${studentBoundaryYear()};

  function facets() {
    var programs = {}, industries = {}, locations = {}, roles = {}, houses = {};
    var alumni = 0, students = 0;
    PROFILES.forEach(function (p) {
      (p.programs || []).forEach(function (x) { programs[x] = (programs[x] || 0) + 1; });
      if (p.industry) industries[p.industry] = (industries[p.industry] || 0) + 1;
      if (p.location) locations[p.location] = (locations[p.location] || 0) + 1;
      if (p.pbhaRole) roles[p.pbhaRole] = (roles[p.pbhaRole] || 0) + 1;
      if (p.house) houses[p.house] = (houses[p.house] || 0) + 1;
      if (p.year >= STUDENT_BOUNDARY) students++; else alumni++;
    });
    var toList = function (o, byCount) {
      var list = Object.keys(o).map(function (k) { return { name: k, count: o[k] }; });
      return byCount
        ? list.sort(function (a, b) { return b.count - a.count; })
        : list.sort(function (a, b) { return a.name.localeCompare(b.name); });
    };
    return {
      programs: toList(programs), industries: toList(industries),
      locations: toList(locations, true), roles: toList(roles), houses: toList(houses),
      totalAlumni: alumni, totalStudents: students,
    };
  }

  function search(params) {
    var all = params.getAll ? params.getAll.bind(params) : function () { return []; };
    var q = (params.get("q") || "").trim().toLowerCase();
    var who = params.get("who") || "all";
    var sort = params.get("sort") || "recent";
    var yearFrom = Number(params.get("yearFrom")) || -Infinity;
    var yearTo = Number(params.get("yearTo")) || Infinity;
    var mentor = params.get("openToMentor") === "true";
    var programs = all("program"), industries = all("industry"), roles = all("role"), houses = all("house");

    var out = PROFILES.filter(function (p) {
      if (who === "alumni" && p.year >= STUDENT_BOUNDARY) return false;
      if (who === "students" && p.year < STUDENT_BOUNDARY) return false;
      if (p.year < yearFrom || p.year > yearTo) return false;
      if (mentor && !p.openToMentor) return false;
      if (industries.length && industries.indexOf(p.industry) === -1) return false;
      if (roles.length && roles.indexOf(p.pbhaRole) === -1) return false;
      if (houses.length && houses.indexOf(p.house) === -1) return false;
      if (programs.length && !programs.some(function (x) { return (p.programs || []).indexOf(x) !== -1; })) return false;
      if (q && p.searchText.indexOf(q) === -1) return false;
      return true;
    });

    out.sort(function (a, b) {
      if (sort === "year-desc") return b.year - a.year || a.last.localeCompare(b.last);
      if (sort === "year-asc") return a.year - b.year || a.last.localeCompare(b.last);
      if (sort === "name") return a.last.localeCompare(b.last) || a.first.localeCompare(b.first);
      return 0;
    });
    // Claimed profiles above unclaimed ones, whatever the sort — same rule the
    // server applies.
    out.sort(function (a, b) { return (b.claimedAt ? 1 : 0) - (a.claimedAt ? 1 : 0); });

    // The server marks these on every card so the frontend knows whether to
    // draw a Message button; the demo has to say the same thing.
    var cards = out.map(function (p) {
      return Object.assign({}, p, { isSelf: p.userId === VIEWER_ID, openToMessages: true });
    });
    return { items: cards, meta: { page: 1, pageSize: cards.length, total: cards.length, totalPages: 1 } };
  }

  var signedIn = false;

  // Messages, in memory. The static build has no server, so a conversation
  // lives for as long as the tab does — enough to show the feature working,
  // and it says so rather than pretending to persist.
  var THREADS = [
    {
      threadId: "t1",
      with: PROFILES.filter(function (p) { return p.first === "Mei Lin"; })[0] || PROFILES[0],
      messages: [
        { id: "m1", body: "Hi! I'm directing CHAP this year and found you in the directory. Could I ask how you handled the Tuesday tutoring split?", createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), fromMe: false },
        { id: "m2", body: "Of course. We ran two rooms with a shared check-in, which meant one coordinator could cover both. Happy to talk it through.", createdAt: new Date(Date.now() - 86400000 * 2 + 3600000).toISOString(), fromMe: true },
        { id: "m3", body: "That would be really helpful. Are you free any evening next week?", createdAt: new Date(Date.now() - 3600000 * 5).toISOString(), fromMe: false },
      ],
      unread: 1,
    },
  ];
  var nextId = 100;

  window.__demoRequest = function (method, path, body) {
    var url = path.split("?")[0];
    var params = new URLSearchParams(path.split("?")[1] || "");

    if (url === "/api/auth/me") {
      if (!signedIn) return Promise.reject(Object.assign(new Error("Sign in required"), { status: 401 }));
      // The name stays fixed, but the photo is read from the live record so
      // an upload reaches the header avatar the way it does against a real
      // server.
      var self = PROFILES.filter(function (p) { return p.userId === VIEWER_ID; })[0] || {};
      return Promise.resolve({
        id: VIEWER_ID, email: "demo@pbha.example", role: "ALUM", status: "ACTIVE",
        profile: { first: "Demo", last: "Viewer", photoUrl: self.photoUrl || null },
        privacy: null,
      });
    }
    if (url === "/api/auth/signin" || url === "/api/auth/signup") { signedIn = true; return Promise.resolve({ userId: VIEWER_ID }); }
    if (url === "/api/auth/signout") { signedIn = false; return Promise.resolve(null); }
    if (url === "/api/vocab") return Promise.resolve(VOCAB);

    if (url === "/api/messages/unread") {
      return Promise.resolve({ unread: THREADS.reduce(function (n, t) { return n + t.unread; }, 0) });
    }
    if (url === "/api/messages" && method === "GET") {
      return Promise.resolve({
        threads: THREADS.map(function (t) {
          var last = t.messages[t.messages.length - 1];
          return {
            threadId: t.threadId,
            updatedAt: last ? last.createdAt : new Date().toISOString(),
            unread: t.unread,
            lastMessage: last ? { body: last.body, createdAt: last.createdAt, fromMe: last.fromMe } : null,
            with: t.with,
          };
        }),
      });
    }
    if (url === "/api/messages/open") {
      var who = PROFILES.filter(function (p) { return p.userId === (body && body.userId); })[0];
      var found = THREADS.filter(function (t) { return t.with && who && t.with.userId === who.userId; })[0];
      if (!found) {
        found = { threadId: "t" + (++nextId), with: who, messages: [], unread: 0 };
        THREADS.unshift(found);
      }
      return Promise.resolve({ threadId: found.threadId });
    }
    if (url.indexOf("/api/messages/") === 0) {
      var rest = url.slice("/api/messages/".length);
      var readMark = rest.indexOf("/read") > -1;
      var id = rest.replace("/read", "");
      var th = THREADS.filter(function (t) { return t.threadId === id; })[0];
      if (!th) return Promise.reject(Object.assign(new Error("Conversation not found"), { status: 404 }));
      if (readMark) { th.unread = 0; return Promise.resolve(null); }
      if (method === "POST") {
        var msg = { id: "m" + (++nextId), body: body.body, createdAt: new Date().toISOString(), fromMe: true };
        th.messages.push(msg);
        THREADS = [th].concat(THREADS.filter(function (t) { return t !== th; }));
        return Promise.resolve(msg);
      }
      // A copy, not the live array. Handing back the array the mock keeps
      // means the UI's optimistic append mutates the mock's own copy too,
      // and the message renders twice. The real API serialises fresh JSON
      // per request, so only the mock can make this mistake.
      return Promise.resolve({ threadId: th.threadId, with: th.with, messages: th.messages.slice() });
    }
    if (url === "/api/directory/facets") return Promise.resolve(facets());
    if (url === "/api/directory") return Promise.resolve(search(params));
    if (url === "/api/users/me/privacy") {
      if (method === "GET") return Promise.resolve({ profileVisibility: "ALUMNI", showInDirectory: true, openToMessages: true, showIdentity: false });
      return Promise.reject(new Error("This is a static demo — nothing saves here."));
    }
    if (url === "/api/users/me" && method === "PATCH") {
      return Promise.reject(new Error("This is a static demo — nothing saves here."));
    }
    // The photo is the one thing the demo can honestly do without a server:
    // the browser has already produced the image, so hand it straight back
    // as the URL. It lives for as long as the tab does.
    if (url === "/api/users/me/photo") {
      if (method === "PUT") {
        var me = PROFILES.filter(function (p) { return p.userId === VIEWER_ID; })[0];
        if (me) me.photoUrl = body.dataUrl;
        return Promise.resolve({ photoUrl: body.dataUrl });
      }
      if (method === "DELETE") {
        var m2 = PROFILES.filter(function (p) { return p.userId === VIEWER_ID; })[0];
        if (m2) m2.photoUrl = null;
        return Promise.resolve({ photoUrl: null });
      }
    }
    if (url.indexOf("/api/users/") === 0) {
      var id = decodeURIComponent(url.slice("/api/users/".length));
      var found = PROFILES.filter(function (p) { return p.userId === id; })[0];
      if (!found) return Promise.reject(Object.assign(new Error("Profile not found"), { status: 404 }));
      return Promise.resolve(Object.assign({}, found, { isSelf: id === VIEWER_ID, openToMessages: true }));
    }
    return Promise.reject(new Error("Not available in the demo"));
  };
})();
</script>
`;

let html = fs.readFileSync(path.join(ROOT, "public/index.html"), "utf8");
// Inject before the React scripts so the hook exists by the time App mounts.
html = html.replace('<script src="https://unpkg.com/react@18', runtime + '<script src="https://unpkg.com/react@18');

const outDir = path.join(ROOT, "docs");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "index.html"), html);

// The logo and favicon are referenced by relative path, so they ship
// beside the page.
for (const f of ["pbha-logo.png", "favicon.png"]) {
  fs.copyFileSync(path.join(ROOT, "public", f), path.join(outDir, f));
}

// The map fetches geo/world.json and geo/locations.json by relative path, so
// they have to sit beside the page in the published output too.
const geoSrc = path.join(ROOT, "public/geo");
const geoOut = path.join(outDir, "geo");
fs.mkdirSync(geoOut, { recursive: true });
for (const f of fs.readdirSync(geoSrc)) {
  fs.copyFileSync(path.join(geoSrc, f), path.join(geoOut, f));
}
// Tells Pages not to run the output through Jekyll.
fs.writeFileSync(path.join(outDir, ".nojekyll"), "");
console.log(`Wrote docs/index.html (${profiles.length} demo profiles) + docs/geo/`);
