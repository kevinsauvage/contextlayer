// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalysisStatusBadge } from "@/components/analysis/analysis-status-badge";
import { ClaimStatusBadge } from "@/components/analysis/claim-status-badge";
import { EvidenceList } from "@/components/analysis/evidence-list";
import { EvidenceWarnings } from "@/components/analysis/evidence-warnings";
import { OutdatedResult } from "@/components/analysis/outdated-result";
import { PublishedBar } from "@/components/analysis/published-bar";
import { RevisionNotice } from "@/components/analysis/revision-notice";
import type { Analysis } from "@/features/projects/queries";

afterEach(cleanup);

const analysis = (overrides: Partial<Analysis> = {}) =>
  ({
    status: "completed",
    publishedIssueKey: null,
    kind: "create",
    result: null,
    editedResult: null,
    evidenceIssues: [],
    ...overrides,
  }) as Analysis;

const readyDraft = {
  title: "Round totals",
  description: [{ text: "Totals round down.", status: "inferred", evidenceIds: [] }],
  acceptanceCriteria: [],
  assumptions: [],
  openQuestions: [],
  evidence: [],
};

describe("AnalysisStatusBadge", () => {
  it("shows a published key before the run status", () => {
    render(<AnalysisStatusBadge analysis={analysis({ publishedIssueKey: "SHOP-3", status: "failed" })} />);
    expect(screen.getByText("SHOP-3")).toBeTruthy();
  });

  it("shows running, failed and ready states", () => {
    const { rerender } = render(<AnalysisStatusBadge analysis={analysis({ status: "running" })} />);
    expect(screen.getByText("Running")).toBeTruthy();

    rerender(<AnalysisStatusBadge analysis={analysis({ status: "failed" })} />);
    expect(screen.getByText("Failed")).toBeTruthy();

    rerender(<AnalysisStatusBadge analysis={analysis({ result: readyDraft })} />);
    expect(screen.getByText("Ready")).toBeTruthy();
  });

  it("calls a draft provisional when a question or a blocking issue remains", () => {
    const { rerender } = render(
      <AnalysisStatusBadge
        analysis={analysis({ result: { ...readyDraft, openQuestions: [{ question: "Q?", impact: "I" }] } })}
      />,
    );
    expect(screen.getByText("Provisional")).toBeTruthy();

    rerender(
      <AnalysisStatusBadge
        analysis={analysis({ result: readyDraft, evidenceIssues: [{ path: "description[0]", message: "Bad quote" }] })}
      />,
    );
    expect(screen.getByText("Provisional")).toBeTruthy();
  });

  it("shows Ready for a completed run with no readable draft", () => {
    render(<AnalysisStatusBadge analysis={analysis({ result: { title: 1 } })} />);
    expect(screen.getByText("Ready")).toBeTruthy();
  });
});

describe("ClaimStatusBadge", () => {
  it.each([
    ["verified", "Verified"],
    ["inferred", "Inferred"],
    ["unknown", "Unknown"],
    ["needs_clarification", "Needs clarification"],
  ] as const)("labels %s", (status, label) => {
    render(<ClaimStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeTruthy();
  });
});

describe("PublishedBar", () => {
  it("says what was created and where to open it", () => {
    render(<PublishedBar trackerName="Jira" issueKey="SHOP-1" issueUrl="https://jira.test/SHOP-1" />);

    expect(screen.getByRole("status").textContent).toContain("Created SHOP-1 in Jira");
    expect(screen.getByRole("link", { name: /Open SHOP-1/ }).getAttribute("href")).toBe("https://jira.test/SHOP-1");
  });

  it("says updated for an audit and offers another ticket", () => {
    render(
      <PublishedBar
        trackerName="Jira"
        issueKey="SHOP-1"
        issueUrl="https://jira.test/SHOP-1"
        existingKey="SHOP-1"
        projectId="p1"
      />,
    );

    expect(screen.getByText(/Updated SHOP-1 in Jira/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Draft another ticket" }).getAttribute("href")).toBe(
      "/projects/p1#request",
    );
  });
});

describe("RevisionNotice", () => {
  it("shows both commits and renders nothing without a change", () => {
    const { rerender, container } = render(<RevisionNotice change={{ from: "aaaaaaa", to: "bbbbbbb" }} />);
    expect(screen.getByText("The code changed since the previous draft")).toBeTruthy();
    expect(screen.getByText("bbbbbbb")).toBeTruthy();
    expect(screen.getByText("aaaaaaa")).toBeTruthy();

    rerender(<RevisionNotice change={null} />);
    expect(container.innerHTML).toBe("");
  });
});

describe("OutdatedResult", () => {
  it("names the subject and the action", () => {
    render(<OutdatedResult subject="audit" action="Run the analysis again." />);
    expect(screen.getByText("This audit was created by an older version")).toBeTruthy();
    expect(screen.getByText("Run the analysis again.")).toBeTruthy();
  });
});

describe("EvidenceList", () => {
  it("says when nothing was cited", () => {
    render(<EvidenceList evidence={[]} />);
    expect(screen.getByText("No evidence was cited.")).toBeTruthy();
  });

  it("shows the reference, line range, link and excerpt", () => {
    render(
      <EvidenceList
        evidence={[
          {
            id: "e1",
            kind: "code",
            reference: "src/cart.ts",
            lines: { start: 2, end: 5 },
            url: "https://github.test/a/b/blob/abc/src/cart.ts#L2-L5",
            excerpt: "Math.floor(total)",
          },
          { id: "e2", kind: "jira_issue", reference: "SHOP-1", excerpt: "Related" },
        ]}
      />,
    );

    expect(screen.getByText("e1")).toBeTruthy();
    expect(screen.getByText("code")).toBeTruthy();
    expect(screen.getByRole("link", { name: "src/cart.ts:2-5" })).toBeTruthy();
    expect(screen.getByText("SHOP-1")).toBeTruthy();
    expect(screen.getByText("Math.floor(total)")).toBeTruthy();
    expect(screen.getByText("Related")).toBeTruthy();
  });
});

describe("EvidenceWarnings", () => {
  it("separates a blocking quote from a publishable warning and links the editor", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <EvidenceWarnings
        onSelect={onSelect}
        issues={[
          { path: "description[0]", message: "Quotes text its evidence lacks.", kind: "evidence" },
          { path: "description[1]", message: "States a value an open question asks.", kind: "open_question" },
          { path: "findings[0]", message: "A report-level issue.", kind: "evidence" },
        ]}
      />,
    );

    expect(screen.getByText("Claims don't match their evidence")).toBeTruthy();
    expect(screen.getByText("Approval is blocked until these are fixed.")).toBeTruthy();
    expect(screen.getByText("Claims decide an open question")).toBeTruthy();
    expect(screen.getByText("A report-level issue.")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Quotes text its evidence lacks." }));
    expect(onSelect).toHaveBeenCalledWith("description[0]");
    expect(screen.queryByRole("button", { name: "A report-level issue." })).toBeNull();
  });

  it("renders nothing without issues", () => {
    const { container } = render(<EvidenceWarnings issues={[]} />);
    expect(container.innerHTML).toBe("");
  });
});
