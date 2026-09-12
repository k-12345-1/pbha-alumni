// Student vs alumni is derived from the class year rather than stored, so it
// stays correct without anyone flipping a flag each June.
//
// The boundary is the class year of the students who are still enrolled: in
// the fall of 2026 the classes of 2027-2030 are on campus, so anyone with
// year >= 2027 counts as a current student. Commencement is late May, so the
// roll happens on June 1.
export const studentBoundaryYear = (now: Date = new Date()): number => {
  const year = now.getUTCFullYear();
  const beforeCommencement = now.getUTCMonth() < 5; // Jan-May
  return beforeCommencement ? year : year + 1;
};

export const isCurrentStudent = (classYear: number, now?: Date): boolean =>
  classYear >= studentBoundaryYear(now);
