import { z } from "zod";

// Emojis in a name break the directory's sort and search, and nobody's legal
// name has one. Free-text fields (bio, reachOut) allow them.
const EMOJI = /\p{Extended_Pictographic}/u;
export const noEmoji = (s: string) => !EMOJI.test(s);
export const NO_EMOJI_MSG = "Please use letters only";

export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(254);

export const passwordField = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(200);

export const signupSchema = z
  .object({
    email: emailField,
    password: passwordField,
    first: z.string().trim().min(1).max(60).refine(noEmoji, NO_EMOJI_MSG),
    last: z.string().trim().min(1).max(60).refine(noEmoji, NO_EMOJI_MSG),
    year: z.coerce
      .number()
      .int()
      .min(1904, "Class year must be 1904 or later")
      .max(2050, "Class year must be 2050 or earlier"),
    inviteCode: z.string().max(120).optional(),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: "Please accept the community guidelines" }),
    }),
  })
  .strict();

export const signinSchema = z
  .object({
    email: emailField,
    password: z.string().min(1, "Enter your password").max(200),
  })
  .strict();

export type SignupInput = z.infer<typeof signupSchema>;
export type SigninInput = z.infer<typeof signinSchema>;
