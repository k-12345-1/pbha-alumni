/**
 * Where someone lives, written one way.
 *
 * Left free, this column fills with "Boston", "boston ma", "Boston, Mass.",
 * "Boston, Massachusetts" and "BOSTON, MA" — five spellings of one city, so
 * the directory's location facet lists it five times and a search for one
 * misses the other four. Everything here exists to collapse that to
 * "Boston, MA".
 *
 * The client normalizes as you type so you can see what will be saved, and
 * the server normalizes again on save, because the client is not the only
 * thing that can post to the API.
 */

export const US_STATES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY", "district of columbia": "DC", "puerto rico": "PR",
  // The abbreviations people actually write out by hand.
  mass: "MA", "mass.": "MA", calif: "CA", "calif.": "CA", penn: "PA", "penn.": "PA",
  conn: "CT", "conn.": "CT", wash: "WA", "wash.": "WA", ill: "IL", "ill.": "IL",
  fla: "FL", "fla.": "FL", tex: "TX", "tex.": "TX", "d.c.": "DC", dc: "DC",
};

const ABBREVS = new Set(Object.values(US_STATES));

/** Title case that leaves the small words and the odd capital alone. */
const titleCase = (s: string) =>
  s
    .toLowerCase()
    .split(/(\s|-|')/)
    .map((part) =>
      /^(of|the|de|la|los|las|upon|on|and)$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join("")
    // St, Ft and Mt keep their period off; DC and NY stay upper.
    .replace(/\b(Dc|Nyc|Usa|Uk)\b/g, (m) => m.toUpperCase());

/**
 * "boston ma", "Boston, Massachusetts", "BOSTON,MA" -> "Boston, MA".
 *
 * A place that does not resolve to a US state is left as the person wrote
 * it, only tidied: "london, uk" -> "London, UK". Forcing a two-letter state
 * onto Accra would be worse than leaving it alone.
 */
export const normalizeLocation = (raw: string | null | undefined): string | null => {
  const input = (raw || "").trim().replace(/\s+/g, " ");
  if (!input) return null;

  // Split on the last comma: "Washington, DC" and "Cambridge, MA" both have
  // one, but so does "Brooklyn, New York, NY" if someone is thorough.
  const parts = input.split(",").map((p) => p.trim()).filter(Boolean);
  let city = parts[0] || "";
  let region = parts.length > 1 ? parts[parts.length - 1] : "";

  // No comma: the state may still be the last word, as in "boston ma".
  if (!region) {
    const words = city.split(" ");
    const tail = words[words.length - 1];
    if (words.length > 1 && ABBREVS.has(tail.toUpperCase())) {
      region = tail;
      city = words.slice(0, -1).join(" ");
    } else {
      // Two-word state names: "san francisco california".
      const twoWord = words.slice(-2).join(" ").toLowerCase();
      if (words.length > 2 && US_STATES[twoWord]) {
        region = twoWord;
        city = words.slice(0, -2).join(" ");
      } else if (words.length > 1 && US_STATES[tail.toLowerCase()]) {
        region = tail;
        city = words.slice(0, -1).join(" ");
      }
    }
  }

  if (!city) return null;
  if (!region) return titleCase(city);

  const key = region.toLowerCase().replace(/\.$/, "");
  const state = US_STATES[key] || (ABBREVS.has(region.toUpperCase()) ? region.toUpperCase() : null);
  if (state) return `${titleCase(city)}, ${state}`;

  // Not a US state. Keep it, tidied; two- and three-letter codes stay upper.
  const tidied = region.length <= 3 ? region.toUpperCase() : titleCase(region);
  return `${titleCase(city)}, ${tidied}`;
};

/**
 * The suggestion list. Not every US city — the places PBHA alumni actually
 * land, which is the coasts, the big metros, and the college towns, plus
 * the cities abroad that already appear in the directory. Anything not on
 * the list can still be typed; this only saves keystrokes.
 */
export const CITIES = [
  "Boston, MA", "Cambridge, MA", "Somerville, MA", "Dorchester, MA", "Brookline, MA",
  "Worcester, MA", "Newton, MA", "Medford, MA", "Quincy, MA", "Springfield, MA",
  "New York, NY", "Brooklyn, NY", "Queens, NY", "Bronx, NY", "Buffalo, NY",
  "Rochester, NY", "Albany, NY", "Yonkers, NY", "White Plains, NY", "Ithaca, NY",
  "Washington, DC", "Arlington, VA", "Alexandria, VA", "Richmond, VA", "Charlottesville, VA",
  "Norfolk, VA", "Baltimore, MD", "Bethesda, MD", "Silver Spring, MD", "Annapolis, MD",
  "Philadelphia, PA", "Pittsburgh, PA", "Newark, NJ", "Jersey City, NJ", "Princeton, NJ",
  "Hoboken, NJ", "Providence, RI", "New Haven, CT", "Hartford, CT", "Stamford, CT",
  "Bridgeport, CT", "Portland, ME", "Burlington, VT", "Manchester, NH", "Portsmouth, NH",
  "Chicago, IL", "Evanston, IL", "Urbana, IL", "Detroit, MI", "Ann Arbor, MI",
  "Grand Rapids, MI", "Minneapolis, MN", "Saint Paul, MN", "Madison, WI", "Milwaukee, WI",
  "Cleveland, OH", "Columbus, OH", "Cincinnati, OH", "Indianapolis, IN", "Bloomington, IN",
  "Saint Louis, MO", "Kansas City, MO", "Des Moines, IA", "Iowa City, IA", "Omaha, NE",
  "Atlanta, GA", "Savannah, GA", "Athens, GA", "Charlotte, NC", "Raleigh, NC",
  "Durham, NC", "Chapel Hill, NC", "Charleston, SC", "Columbia, SC", "Nashville, TN",
  "Memphis, TN", "Knoxville, TN", "Louisville, KY", "Lexington, KY", "Birmingham, AL",
  "Jackson, MS", "New Orleans, LA", "Baton Rouge, LA", "Little Rock, AR", "Miami, FL",
  "Orlando, FL", "Tampa, FL", "Jacksonville, FL", "Gainesville, FL", "Tallahassee, FL",
  "Houston, TX", "Austin, TX", "Dallas, TX", "San Antonio, TX", "Fort Worth, TX",
  "El Paso, TX", "Oklahoma City, OK", "Tulsa, OK", "Denver, CO", "Boulder, CO",
  "Colorado Springs, CO", "Salt Lake City, UT", "Albuquerque, NM", "Santa Fe, NM",
  "Phoenix, AZ", "Tucson, AZ", "Tempe, AZ", "Las Vegas, NV", "Reno, NV",
  "Boise, ID", "Missoula, MT", "Bozeman, MT", "Cheyenne, WY", "Sioux Falls, SD",
  "Fargo, ND", "Wichita, KS", "Lawrence, KS", "San Francisco, CA", "Oakland, CA",
  "Berkeley, CA", "San Jose, CA", "Palo Alto, CA", "Mountain View, CA", "Sacramento, CA",
  "Los Angeles, CA", "Pasadena, CA", "Long Beach, CA", "Santa Monica, CA", "San Diego, CA",
  "Irvine, CA", "Santa Barbara, CA", "Fresno, CA", "Santa Cruz, CA", "Davis, CA",
  "Portland, OR", "Eugene, OR", "Seattle, WA", "Tacoma, WA", "Spokane, WA",
  "Bellevue, WA", "Anchorage, AK", "Honolulu, HI", "San Juan, PR", "Charleston, WV",
  // Abroad, where the directory already has people.
  "London, UK", "Oxford, UK", "Cambridge, UK", "Edinburgh, UK", "Dublin, Ireland",
  "Paris, France", "Berlin, Germany", "Madrid, Spain", "Rome, Italy", "Amsterdam, Netherlands",
  "Geneva, Switzerland", "Stockholm, Sweden", "Toronto, Canada", "Montreal, Canada",
  "Vancouver, Canada", "Mexico City, Mexico", "Sao Paulo, Brazil", "Buenos Aires, Argentina",
  "Bogota, Colombia", "Lima, Peru", "Accra, Ghana", "Nairobi, Kenya", "Lagos, Nigeria",
  "Johannesburg, South Africa", "Cairo, Egypt", "Kampala, Uganda", "Dakar, Senegal",
  "Tel Aviv, Israel", "Amman, Jordan", "Dubai, UAE", "Mumbai, India", "New Delhi, India",
  "Bangalore, India", "Beijing, China", "Shanghai, China", "Hong Kong, China",
  "Taipei, Taiwan", "Seoul, South Korea", "Tokyo, Japan", "Singapore, Singapore",
  "Bangkok, Thailand", "Manila, Philippines", "Jakarta, Indonesia", "Sydney, Australia",
  "Melbourne, Australia", "Auckland, New Zealand",
] as const;
