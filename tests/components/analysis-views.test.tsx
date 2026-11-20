// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuditView } from "@/components/analysis/audit-view";
import { CreationView } from "@/components/analysis/creation-view";
import type { AuditReport } from "@/core/audit/schemas";
import type { TicketDraft } from "@/core/requirements/schemas";
import type { Analysis } from "@/features/projects/queries";

const actions = vi.hoisted(() => ({
  applyAuditToTracker: vi.fn(),
  publishTicket: vi.fn(),
  saveDraftEdits: vi.fn(),
}));

vi.mock("@/features/ticket-audit/actions", () => ({ applyAuditToTracker: actions.applyAuditToTracker }));
vi.mock("@/features/ticket-creation/actions", () => ({
  publishTicket: actions.publishTicket,
  saveDraftEdits: actions.saveDraftEdits,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/ui/toast", () => ({ notify: vi.fn(), notifyError: vi.fn() }));

afterEach(() => {
  cleanup();
  Object.values(actions).forEach((mock) => mock.mockReset());
});

const startedAt = new Date("2026-11-01T10:00:00.000Z");
const analysis = {
  id: "a1",
  projectId: "p1",
  kind: "audit",
  status: "completed",
  runToken: "run-1",
  startedAt,
  publishedIssueKey: null,
  publishedIssueUrl: null,
} as unknown as Analysis;

const evidence = [
  {
    id: "e1",
    kind: "code" as const,
    reference: "src/cart.ts",
    url: "https://github.test/a/b/blob/abc/src/cart.ts",
    excerpt: "Math.floor(total)",
  },
];

const proposal: TicketDraft = {
  title: "Round cart totals",
  description: [{ text: "Totals round down.", status: "verified" as const, evidenceIds: ["e1"] }],
  acceptanceCriteria: [],
  assumptions: [],
  openQuestions: [],
  evidence,
};

const report: AuditReport = {
  auditedIssue: {
    summary: "Cart total",
    description: "Rounds oddly.\nUses `Math.floor` today.",
  },
  summary: "The ticket leaves rounding ambiguous.",
  findings: [
    {
      category: "ambiguity",
      status: "needs_clarification",
      text: "Which rounding mode?",
      evidenceIds: [],
      suggestion: "Say half up.",
    },
    {
      category: "conflict_with_code",
      status: "verified",
      text: "The code rounds down.",
      evidenceIds: ["e1"],
    },
  ],
  proposedTicket: proposal,
  evidence,
};

describe("AuditView", () => {
  it("shows an outdated audit when the report no longer parses", () => {
    render(
      <AuditView
        analysis={analysis}
        input={{ kind: "audit", issueKey: "SHOP-12" }}
        report={null}
        draft={null}
        trackerName="Jira"
        trackerKey="SHOP"
      />,
    );

    expect(screen.getByText("This audit was created by an older version")).toBeTruthy();
    expect(screen.getByText("Run the analysis again to update it.")).toBeTruthy();
  });

  it("shows the findings, their evidence and the proposed ticket", () => {
    render(
      <AuditView
        analysis={analysis}
        input={{ kind: "audit", issueKey: "SHOP-12" }}
        report={report}
        draft={proposal}
        trackerName="Jira"
        trackerKey="SHOP"
      />,
    );

    expect(screen.getByText("The ticket leaves rounding ambiguous.")).toBeTruthy();
    expect(screen.getByText("Which rounding mode?")).toBeTruthy();
    expect(screen.getByText(/Say half up/)).toBeTruthy();
    expect(screen.getByText("The code rounds down.")).toBeTruthy();
    expect(screen.getByText("ambiguity")).toBeTruthy();
    const evidenceLinks = screen.getAllByRole("link", { name: "Evidence e1: src/cart.ts" });
    expect(evidenceLinks.map((link) => link.getAttribute("href"))).toEqual(["#audit-evidence-e1", "#evidence-e1"]);
    expect(screen.getByRole("heading", { name: "Current ticket" })).toBeTruthy();
    expect(screen.getByText("Cart total")).toBeTruthy();
    expect(screen.getByText(/Uses/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Proposed ticket" })).toBeTruthy();
    expect(screen.getByText("SHOP-12")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Approve & update the Jira ticket" })).toBeTruthy();
  });

  it("stops calling the snapshot current once the audit is applied", () => {
    render(
      <AuditView
        analysis={{ ...analysis, publishedIssueKey: "SHOP-12" }}
        input={{ kind: "audit", issueKey: "SHOP-12" }}
        report={report}
        draft={proposal}
        trackerName="Jira"
        trackerKey="SHOP"
      />,
    );

    expect(screen.getByRole("heading", { name: "Ticket before this audit" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Current ticket" })).toBeNull();
  });

  it("applies the proposal to the audited issue", async () => {
    actions.applyAuditToTracker.mockResolvedValue({ issueKey: "SHOP-12", issueUrl: "https://jira.test/SHOP-12" });
    const user = userEvent.setup();
    render(
      <AuditView
        analysis={analysis}
        input={{ kind: "audit", issueKey: "SHOP-12" }}
        report={report}
        draft={proposal}
        trackerName="Jira"
        trackerKey="SHOP"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Approve & update the Jira ticket" }));
    expect(screen.getByRole("alert").textContent).toContain("Replaces the title and description of SHOP-12.");
    await user.click(screen.getByRole("button", { name: "Replace the ticket" }));

    await waitFor(() => expect(actions.applyAuditToTracker).toHaveBeenCalledWith("a1", proposal));
    expect(await screen.findByText(/Updated SHOP-12 in Jira/)).toBeTruthy();
  });

  it("says no findings when the report has none", () => {
    render(
      <AuditView
        analysis={analysis}
        input={{ kind: "audit", issueKey: "SHOP-12" }}
        report={{ ...report, findings: [] }}
        draft={proposal}
        trackerName="Jira"
        trackerKey="SHOP"
      />,
    );

    expect(screen.getByText("No findings.")).toBeTruthy();
  });

  it("shows an outdated proposed ticket when the draft does not parse", () => {
    render(
      <AuditView
        analysis={analysis}
        input={{ kind: "audit", issueKey: "SHOP-12" }}
        report={report}
        draft={null}
        trackerName="Jira"
        trackerKey="SHOP"
      />,
    );

    expect(screen.getByText("This proposed ticket was created by an older version")).toBeTruthy();
  });
});

describe("CreationView", () => {
  const createAnalysis = { ...analysis, kind: "create", publishedIssueKey: null } as unknown as Analysis;

  it("asks for a redraft when no draft is stored", () => {
    render(
      <CreationView
        analysis={createAnalysis}
        draft={null}
        trackerName="Jira"
        trackerKey="SHOP"
        questionsAnchored={false}
        issues={[]}
      />,
    );

    expect(screen.getByText("Send a message in the conversation to run it again.")).toBeTruthy();
  });

  it("renders the draft with the create label and the autosave wiring", () => {
    render(
      <CreationView
        analysis={createAnalysis}
        draft={proposal}
        trackerName="Jira"
        trackerKey="SHOP"
        questionsAnchored
        issues={[]}
      />,
    );

    expect(screen.getByRole("button", { name: "Approve & create in Jira" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Edit" })).toBeTruthy();
  });
});
