import { z } from "zod";

const guid = z.guid();

// Ids come from URLs; a malformed one must read as "not found", not as a Postgres cast error.
export const isUuid = (value: string) => guid.safeParse(value).success;
