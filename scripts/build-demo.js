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
const { PROGRAMS, PBHA_ROLES } = require("./vocab.js");

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
  bio: p.bio ?? null,
  programs: p.programs || [],
  programYears: null,
  pbhaRole: p.pbhaRole ?? null,
  openToMentor: !!p.openToMentor,
  reachOut: p.reachOut ?? null,
  // Unclaimed rows keep their INVITED treatment in the demo too.
  claimedAt: p.unclaimed ? null : new Date().toISOString(),
  isCurrentStudent: p.year >= studentBoundaryYear(),
  searchText: [p.first, p.last, p.location, p.career, p.industry, p.concentration, p.pbhaRole, ...(p.programs || [])]
    .filter(Boolean).join(" ").toLowerCase(),
}));

const DEMO_VIEWER = profiles.find((p) => p.claimedAt) || profiles[0];

const runtime = `
<script>
(function () {
  var PROFILES = ${JSON.stringify(profiles)};
  var VOCAB = ${JSON.stringify({ programs: PROGRAMS, roles: PBHA_ROLES })};
  var VIEWER_ID = ${JSON.stringify(DEMO_VIEWER.userId)};
  var STUDENT_BOUNDARY = ${studentBoundaryYear()};

  function facets() {
    var programs = {}, industries = {}, locations = {}, roles = {};
    var alumni = 0, students = 0;
    PROFILES.forEach(function (p) {
      (p.programs || []).forEach(function (x) { programs[x] = (programs[x] || 0) + 1; });
      if (p.industry) industries[p.industry] = (industries[p.industry] || 0) + 1;
      if (p.location) locations[p.location] = (locations[p.location] || 0) + 1;
      if (p.pbhaRole) roles[p.pbhaRole] = (roles[p.pbhaRole] || 0) + 1;
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
      locations: toList(locations, true), roles: toList(roles),
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
    var programs = all("program"), industries = all("industry"), roles = all("role");

    var out = PROFILES.filter(function (p) {
      if (who === "alumni" && p.year >= STUDENT_BOUNDARY) return false;
      if (who === "students" && p.year < STUDENT_BOUNDARY) return false;
      if (p.year < yearFrom || p.year > yearTo) return false;
      if (mentor && !p.openToMentor) return false;
      if (industries.length && industries.indexOf(p.industry) === -1) return false;
      if (roles.length && roles.indexOf(p.pbhaRole) === -1) return false;
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

    return { items: out, meta: { page: 1, pageSize: out.length, total: out.length, totalPages: 1 } };
  }

  var signedIn = false;

  window.__demoRequest = function (method, path, body) {
    var url = path.split("?")[0];
    var params = new URLSearchParams(path.split("?")[1] || "");

    if (url === "/api/auth/me") {
      if (!signedIn) return Promise.reject(Object.assign(new Error("Sign in required"), { status: 401 }));
      return Promise.resolve({
        id: VIEWER_ID, email: "demo@pbha.example", role: "ALUM", status: "ACTIVE",
        profile: { first: "Demo", last: "Viewer" }, privacy: null,
      });
    }
    if (url === "/api/auth/signin" || url === "/api/auth/signup") { signedIn = true; return Promise.resolve({ userId: VIEWER_ID }); }
    if (url === "/api/auth/signout") { signedIn = false; return Promise.resolve(null); }
    if (url === "/api/vocab") return Promise.resolve(VOCAB);
    if (url === "/api/directory/facets") return Promise.resolve(facets());
    if (url === "/api/directory") return Promise.resolve(search(params));
    if (url === "/api/users/me/privacy") {
      if (method === "GET") return Promise.resolve({ profileVisibility: "ALUMNI", showInDirectory: true, openToMessages: true });
      return Promise.reject(new Error("This is a static demo — nothing saves here."));
    }
    if (url === "/api/users/me" && method === "PATCH") {
      return Promise.reject(new Error("This is a static demo — nothing saves here."));
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
