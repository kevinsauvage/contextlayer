# Customer discovery

Status: **no interviews conducted yet**. This file holds the guide and the synthesis template; do not summarise interviews that have not happened. Hypotheses tested: H1, H4, H5, H6 in [`business-hypotheses.md`](business-hypotheses.md).

## Who to interview

8 to 12 people who write or refine tickets and have developers acting on them:

- Tech leads and engineering managers at product teams of 5 to 30 engineers.
- Delivery or product leads at small agencies working on client repositories.
- Use Jira Cloud and GitHub, so the integrations apply.
- Mix of companies that do and do not already use Jira AI features or Copilot.

Screener (any "no" ends the call politely): Do you use Jira Cloud? Is the code on GitHub? Did you write or review at least five tickets last month?

## Principles

Ask about past behaviour, not opinions about the product. Never pitch before the last ten minutes. Ask for a real recent ticket and walk through what happened. Listen for workarounds, cost and who decides.

## Interview guide (40 minutes)

1. **Context (5 min).** Team size, tools, who writes tickets, who picks them up.
2. **A recent bad ticket (10 min).** Tell me about the last ticket that caused confusion. What did it say, what was missing, how did you find out, how long did it take to fix, who was involved?
3. **Current process (8 min).** How does a ticket go from idea to ready? Where does someone check the code? What do you already use AI for? What does it get wrong?
4. **Trust (5 min).** When an AI writes a requirement, how do you decide to believe it? Have you been burned?
5. **Show and react (7 min).** Show a draft with labelled claims and citations (from `tests/evaluation/results`, anonymised). What would you change? What would stop you using it?
6. **Access and buying (5 min).** What would you need to approve a GitHub App with read access and Jira write access? Who signs off? What do you pay for similar tools today?

## Note template (one per interview)

```
Date / interviewee role / team size / stack:
Recent bad ticket (what, cost in hours, people involved):
Current process and AI usage:
Trust signals and fears:
Reaction to the labelled draft (quotes):
Integration objections (security, procurement):
Who owns the problem / budget:
Willingness to try (pilot yes / maybe / no) and why:
Surprises:
```

## Synthesis (fill after each batch of 4)

| #   | Role | H1 pain (hours/week) | H4 would connect | H5 owner | H6 pays separately | Pilot? |
| --- | ---- | -------------------- | ---------------- | -------- | ------------------ | ------ |
|     |      |                      |                  |          |                    |        |

Repeat a pattern only if at least 3 people raised it unprompted.
