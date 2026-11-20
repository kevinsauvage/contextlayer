import { describe, expect, it } from "vitest";
import { assertE2eDatabase, E2E_DATABASE_URL } from "../e2e/database";

describe("assertE2eDatabase", () => {
  it("accepts the suite's own database names", () => {
    expect(() => assertE2eDatabase(E2E_DATABASE_URL)).not.toThrow();
    expect(() => assertE2eDatabase("postgres://u:p@localhost:5432/contextlayer_e2e")).not.toThrow();
  });

  it("refuses the development database before global setup can drop it", () => {
    expect(() => assertE2eDatabase("postgres://u:p@localhost:5432/contextlayer")).toThrow(
      'Refusing to drop "contextlayer": E2E_DATABASE_URL must name a database ending in "_e2e"',
    );
    expect(() => assertE2eDatabase("postgres://u:p@localhost:5432/contextlayer_e2e_backup")).toThrow();
  });

  it("names the default so the message says what to use", () => {
    expect(() => assertE2eDatabase("postgres://u:p@localhost:5432/app")).toThrow("contextlayer_e2e");
  });
});
