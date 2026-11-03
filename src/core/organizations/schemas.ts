import { z } from "zod";

export const organizationNameSchema = z
  .string()
  .trim()
  .min(2, "Enter a name of at least 2 characters")
  .max(100, "Keep the name under 100 characters");
