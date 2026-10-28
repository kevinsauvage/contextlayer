import { describe, expect, it } from "vitest";
import type { Claim, Evidence } from "@/core/evidence/schemas";
import { validateEvidenceReferences, validateOpenQuestions } from "@/core/evidence/validate";
import type { TicketDraft } from "@/core/requirements/schemas";

const evidence: Evidence[] = [{ id: "e1", kind: "code", reference: "src/PayButton.tsx", excerpt: "<button/>" }];
const claim = (overrides: Partial<Claim>): Claim => ({
  text: "x",
  status: "verified",
  evidenceIds: ["e1"],
  ...overrides,
});
const validate = (c: Claim, ev = evidence) => validateEvidenceReferences(ev, { description: [c] });

describe("validateEvidenceReferences", () => {
  it("accepts references that resolve", () => expect(validate(claim({}))).toEqual([]));

  it("flags unknown evidence ids", () => expect(validate(claim({ evidenceIds: ["missing"] }))).toHaveLength(1));

  it("flags verified claims without evidence", () =>
    expect(validate(claim({ evidenceIds: [] }))[0]?.message).toBe(
      "Description paragraph 1 is marked Verified but cites no evidence.",
    ));

  it("allows inferred claims without evidence", () =>
    expect(validate(claim({ status: "inferred", evidenceIds: [] }))).toEqual([]));

  it("flags a verified claim that quotes an identifier its evidence lacks", () => {
    const [issue] = validate(claim({ text: "`PayButton` calls `chargeCard`." }), [
      { id: "e1", kind: "code", reference: "src/PayButton.tsx", excerpt: "export const PayButton = () => null;" },
    ]);
    expect(issue?.message).toBe(
      'Description paragraph 1 is marked Verified but quotes "chargecard", which its cited evidence does not contain.',
    );
  });

  it("accepts quotes found in the excerpt or the file path, ignoring case and spacing", () =>
    expect(
      validate(claim({ text: 'The label reads "Pay  now" in `src/paybutton.tsx`.' }), [
        { id: "e1", kind: "code", reference: "src/PayButton.tsx", excerpt: "<button>pay now</button>" },
      ]),
    ).toEqual([]));

  it("accepts a bare tag whose element carries attributes in the evidence", () =>
    expect(
      validate(claim({ text: "Its header is a `<p>` holding the availability pill." }), [
        { id: "e1", kind: "code", reference: "src/Hero.tsx", excerpt: "<p className='inline-flex rounded-full'>" },
      ]),
    ).toEqual([]));

  it("does not accept a bare tag that only prefixes another element", () =>
    expect(
      validate(claim({ text: "Wrapped in a `<p>`." }), [
        { id: "e1", kind: "code", reference: "src/Icon.tsx", excerpt: '<path d="M0 0h24v24H0z" />' },
      ]),
    ).toHaveLength(1));

  it("still flags a bare tag the evidence does not render", () =>
    expect(validate(claim({ text: "Wrapped in a `<p>`." })).map((issue) => issue.message)).toEqual([
      'Description paragraph 1 is marked Verified but quotes "<p>", which its cited evidence does not contain.',
    ]));

  it("accepts an id written as a selector", () =>
    expect(
      validate(claim({ text: "The heading keeps `#hero-title`." }), [
        { id: "e1", kind: "code", reference: "src/Hero.tsx", excerpt: "<h1 id='hero-title'>Hi</h1>" },
      ]),
    ).toEqual([]));

  it("accepts a dotted path and a dotted path with its value when the parts appear", () =>
    expect(
      validate(claim({ text: "`viewport.themeColor` is `images.unoptimized: true`." }), [
        {
          id: "e1",
          kind: "code",
          reference: "src/app/layout.tsx",
          excerpt: "export const viewport = { themeColor: '#000000' }; images: { unoptimized: true }",
        },
      ]),
    ).toEqual([]));

  it("still flags a paraphrase of what the evidence says", () =>
    expect(validate(claim({ text: "The spec asserts `total > 1`." })).map((issue) => issue.message)).toEqual([
      'Description paragraph 1 is marked Verified but quotes "total > 1", which its cited evidence does not contain.',
    ]));

  it("does not check quotes in claims that are not verified", () =>
    expect(validate(claim({ status: "inferred", text: "Probably `missingThing`." }))).toEqual([]));

  it("flags duplicate evidence ids", () =>
    expect(validate(claim({}), [...evidence, ...evidence])[0]?.message).toMatch(/listed twice/));
});

describe("validateOpenQuestions", () => {
  const draft = (text: string, options: string[]): TicketDraft => ({
    title: "Add rate limiting",
    description: [{ text, status: "inferred", evidenceIds: [] }],
    acceptanceCriteria: [],
    assumptions: [],
    openQuestions: [
      {
        question: "What should a caller receive?",
        impact: "A fixed code changes the API contract.",
        options: options.map((option) => ({ text: option, recommended: false })),
      },
    ],
    evidence: [],
  });

  it("flags a claim that states a value the open question offers", () => {
    const [issue] = validateOpenQuestions(
      draft("Requests are rejected with 429.", ["429 Too Many Requests", "403 Forbidden"]),
    );
    expect(issue?.message).toBe(
      'Description paragraph 1 states "429", which open question 1 asks; leave it undecided until the question is answered.',
    );
  });

  it("accepts a claim that leaves the value open", () => {
    expect(
      validateOpenQuestions(draft("Requests are rejected with the agreed status code.", ["429 Too Many Requests"])),
    ).toEqual([]);
  });

  it("ignores a question without options and aims its warning at the right claim", () => {
    expect(validateOpenQuestions(draft("Nothing decided.", []))).toEqual([]);
    const withOptions = draft("Requests are rejected with 429.", ["429 Too Many Requests"]);
    withOptions.acceptanceCriteria = [
      {
        text: "A limited caller sees 429.",
        status: "needs_clarification",
        evidenceIds: [],
        requiresProductDecision: true,
      },
    ];
    expect(validateOpenQuestions(withOptions).map((issue) => issue.path)).toEqual([
      "description[0]",
      "acceptanceCriteria[0]",
    ]);
  });
});
