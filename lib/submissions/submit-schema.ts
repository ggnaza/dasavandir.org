import { z } from "zod";

/**
 * Max length of a learner's written response, in characters.
 * Shared by the submit API and the submitter UI so the counter and the
 * server agree. The AI grader only reads the first 3,000 characters, so this
 * cap is about payload size, not grading. It was 10,000, which rejected long
 * pasted Armenian essays with a bare "Invalid input".
 */
export const MAX_SUBMISSION_CONTENT_CHARS = 100_000;

export const submitSchema = z.object({
  assignment_id: z.string().uuid(),
  // Client sends explicit null for empty fields → accept null as well as undefined.
  content: z
    .string()
    .max(MAX_SUBMISSION_CONTENT_CHARS, {
      message: `Written response is too long — max ${MAX_SUBMISSION_CONTENT_CHARS.toLocaleString("en-US")} characters.`,
    })
    .nullish(),
  file_path: z.string().max(500).nullish(),
  file_name: z.string().max(255, { message: "File name is too long — rename the file and try again." }).nullish(),
  link_url: z
    .string()
    .url({ message: "Link must be a full URL starting with https://" })
    .max(2000, { message: "Link is too long." })
    .nullish(),
  group_id: z.string().uuid().nullable().optional(),
});

/** A learner-readable message for the first validation failure. */
export function submitErrorMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}
