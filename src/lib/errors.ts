export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const BadRequest = (message = "Bad request", code?: string) =>
  new HttpError(400, message, code);
export const Unauthorized = (message = "Sign in required", code?: string) =>
  new HttpError(401, message, code);
export const Forbidden = (message = "Not allowed", code?: string) =>
  new HttpError(403, message, code);
export const NotFound = (message = "Not found", code?: string) =>
  new HttpError(404, message, code);
export const Conflict = (message = "Already exists", code?: string) =>
  new HttpError(409, message, code);
