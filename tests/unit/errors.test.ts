import { describe, expect, it } from "vitest";
import {
  AnalysisAlreadyRunningError,
  AnalysisLimitError,
  ConnectionMissingError,
  ForbiddenError,
  InvalidGrantError,
  ReconnectRequiredError,
  TrackerNotFoundError,
  TrackerRejectedError,
  errorSummary,
  httpStatusOf,
} from "@/core/errors";
import { toActionError, withActionErrors } from "@/features/errors";

describe("errorSummary", () => {
  it("keeps only the name and message of an Error", () => {
    expect(errorSummary(new Error("boom"))).toBe("Error: boom");
    expect(errorSummary(new TypeError("bad value"))).toBe("TypeError: bad value");
  });

  it("stringifies a thrown non-error without keeping its object", () => {
    expect(errorSummary("plain failure")).toBe("plain failure");
    expect(errorSummary(undefined)).toBe("undefined");
  });
});

describe("httpStatusOf", () => {
  it("reads a numeric status from any object and ignores anything else", () => {
    expect(httpStatusOf({ status: 404 })).toBe(404);
    expect(httpStatusOf({ status: "401" })).toBe(401);
    expect(httpStatusOf({ status: "nope" })).toBeUndefined();
    expect(httpStatusOf({})).toBeUndefined();
    expect(httpStatusOf(null)).toBeUndefined();
    expect(httpStatusOf("500")).toBeUndefined();
  });
});

describe("toActionError", () => {
  it.each([
    [new ForbiddenError(), "Only organization owners and admins can do this. Ask one of them."],
    [new AnalysisAlreadyRunningError(), "This analysis is already running. Wait for it to finish."],
    [new AnalysisLimitError("Your daily limit is reached."), "Your daily limit is reached."],
    [
      new ReconnectRequiredError("Acme Jira"),
      "The connection to Acme Jira expired. An admin needs to reconnect it in Integrations.",
    ],
    [new TrackerRejectedError("Summary is too long"), "Summary is too long"],
    [new TrackerNotFoundError("Issue SHOP-9 is gone"), "Issue SHOP-9 is gone"],
    [new ConnectionMissingError("The tracker is disconnected"), "The tracker is disconnected"],
  ])("maps %s to what the person can act on", (error, message) => {
    expect(toActionError(error)).toEqual({ error: message });
  });

  it("ignores errors it does not own, including grants that need a new consent", () => {
    expect(toActionError(new Error("unexpected"))).toBeNull();
    expect(toActionError(new InvalidGrantError("revoked"))).toBeNull();
    expect(toActionError("thrown string")).toBeNull();
  });
});

describe("withActionErrors", () => {
  it("returns the result when the action succeeds", async () => {
    await expect(withActionErrors(async () => ({ error: "validation" }))).resolves.toEqual({ error: "validation" });
    await expect(withActionErrors(async () => ({}))).resolves.toEqual({});
  });

  it("returns a known refusal as a value", async () => {
    await expect(
      withActionErrors(async () => {
        throw new TrackerRejectedError("Jira refused the ticket");
      }),
    ).resolves.toEqual({ error: "Jira refused the ticket" });
  });

  it("lets an unknown error reach the boundary, so redirects and bugs stay visible", async () => {
    const boom = new Error("NEXT_REDIRECT:/projects");
    await expect(
      withActionErrors(async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
  });
});
