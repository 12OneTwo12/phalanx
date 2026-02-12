# Autopilot Team - Product Planning Document

> Goal-Oriented Autonomous AI Agent Team Orchestrator

## 1. Problem Statement

Limitations of current AI Agent tools:

| Type | Limitation |
|------|------|
| **Multi-Agent Frameworks** | Task-oriented. Workflows must be pre-defined. "Do this task" approach |
| **Personal AI Assistants** | Single Agent. Personal assistant level. Unable to collaborate at team scale |
| **Session-Based Agent Teams** | One-time use within a session. Cannot pursue long-term goals. No heartbeat |
| **Code-Based Orchestrators** | Developer-only. Requires graph definition. Inaccessible to non-developers |

**Common Problem**: "Execute this Task" is possible, but "Keep working autonomously toward this Goal" is not.

## 2. Solution: Autopilot Team

### Core Concept

```
[User] → Set long-term Goal + Configure Agents
              ↓
      [Autopilot Team Daemon] ← Single process. Install once and done.
              ↓
      [Team Lead Agent] ← Heartbeat (built-in scheduler)
              ↓
      Decompose Goal into Tickets
         ↓        ↓        ↓
      Ticket #1  Ticket #2  Ticket #3
         ↓        ↓        ↓
      LLM Provider (Claude / OpenAI / Ollama / etc.)
      Each Agent can choose its own Provider & Model
         ↓        ↓        ↓
      Write Code → QA Verification → Customer Verification
         ↓        ↓        ↓
      Create PR → User Approval or AI Auto-Merge
              ↓
   [Report] → Slack / Discord / Dashboard (built-in)
```

### Key Differentiators

```
Existing tools:     "Execute these 5 Tasks in order"
Autopilot Team:     "Find what needs to be done to achieve this Goal and keep doing it"

Existing AI coding: Session-based. Once it ends, it's over.
Autopilot Team:     Goal → Ticket → PR → Merge → Next Ticket → ... (repeat until complete)

Existing AI coding tools: Locked into a specific platform. If that platform blocks you, it's over.
Autopilot Team:          Multi-Provider. Any LLM can be swapped in. Platform-independent.
```

## 3. Target User

### 1-3 Person Startups Building a Team with AI

```
┌─────────────────────────────────────────────────────────┐
│  Before (Current State)                                   │
│                                                         │
│  A solo founder:                                         │
│    Plans, writes code, does design,                      │
│    runs QA, deploys, does marketing...                   │
│    → Not enough even working 16 hours a day              │
│                                                         │
│  After (Autopilot Team)                                  │
│                                                         │
│  Founder = CEO. Only sets the direction.                  │
│    Planning → PM Agent                                   │
│    Backend → Backend Agent(s)                            │
│    Frontend → Frontend Agent(s)                          │
│    Verification → QA Agent                               │
│    User Perspective → Customer Agent                     │
│    → Founder only sets direction and gives final approval │
└─────────────────────────────────────────────────────────┘
```

**Core Value Proposition:**
> "The AI team handles 80% autonomously and delivers the remaining 20% as clean PRs.
> All code follows team conventions, and PRs are only created after QA verification.
> You just set the direction as CEO. The Team Lead creates a plan for your approval, and the team handles the approved work on its own."

## 4. Key Features

### 4.1 Goal-Driven Autonomy

- Input **long-term Goals**, not simple Tasks
- Team Lead Agent analyzes goals and **automatically generates sub-Tasks** → **must be approved by user before execution**
- Approved tickets are executed autonomously by Agents (no user intervention required)
- Periodically checks goal achievement status via Heartbeat and **reports new proposals to the user**

#### CEO ↔ PM Relationship Model

```
┌─────────────────────────────────────────────────────────────┐
│          Real-World Startup              AI Team             │
│                                                             │
│  CEO (Owner)              =    User (Human)                  │
│  PM (Team Manager)        =    Team Lead Agent               │
│  Developers/Designers     =    Backend/Frontend/QA Agent     │
│                                                             │
│  CEO → PM: "Do this"               User → Team Lead: Set Goal│
│  PM → CEO: "How about this?"      Team Lead → User: Submit plan│
│  CEO: "Approved"                   User: "Approved"           │
│  PM → Team: "Do this"             Team Lead → Agent: Assign ticket│
│  Team: (works independently)       Agent: (autonomous execution)│
│  PM → CEO: "It's done"            Team Lead → User: PR report │
│                                                             │
│  PM → CEO: "How about doing this too?" ← Team Lead Reverse Proposal│
│  CEO: "Sure, go ahead" or "No"    User: Approve or Reject    │
└─────────────────────────────────────────────────────────────┘
```

#### Core Principle: "Plans require approval, execution is autonomous"

```
Phase 1 Principles:

  ✅ What Team Lead does autonomously:
     - Goal analysis and ticket decomposition planning
     - Agent assignment and execution management for approved tickets
     - QA/Customer verification loop operation
     - PR creation and Smart Mode auto-merge (within rules)
     - Reverse Proposals of ideas/improvements to the user

  🔒 What requires user approval:
     - Goal → Ticket decomposition results (plan approval)
     - Hiring new Agents
     - Exceeding cost thresholds
     - PRs outside Smart Mode rules (high-risk changes)
     - Execution of Team Lead's Reverse Proposals
```

**Example Scenarios:**

**Example A: Business Goal**
```
Goal: "Grow Upvy app's MAU to 50K within 3 months"

1. Team Lead analyzes → Submits plan (awaiting user approval):
   "Current MAU is 12K. Retention rate is low (D7: 15%). I propose the following plan:"
   → Ticket #1: "Draft onboarding flow improvement" → To be assigned to Planning Agent
   → Ticket #2: "Research push notification optimization" → To be assigned to Marketing Agent
   [Approve] [Modify & Approve] [Reject]

2. User: "Approved"

3. Agents execute autonomously (no user intervention needed):
   → Planning Agent drafts onboarding improvement
   → QA verification → Customer verification → PR creation
   → Auto/manual merge per Smart Mode rules

4. 2 weeks later Heartbeat → Team Lead reports + proposes:
   "Retention D7: improved from 15% → 18%. I propose the next steps:"
   → New ticket: "Introduce in-app messaging system" [Awaiting approval]
```

**Example B: Team Lead's Reverse Proposal (Submitting Ideas)**
```
Team Lead → User (Direct Channel):
  "After analyzing the codebase, average API response time is 800ms, which is slow.
   This may be affecting retention.

   Proposal: Should I add an 'API response time optimization' ticket?
   Expected work: Introduce cache layer + DB query optimization
   Expected impact: Response time 800ms → 200ms

   [Approve] [Later] [Not needed]"

User: "Approved"
→ Ticket auto-created → Agent assigned → Autonomous execution
```

**Example C: Engineering Goal**
```
Goal: "Convert ShopMall monolithic backend to MSA within 3 months"

1. Team Lead analyzes → Submits plan:
   "Codebase analysis complete. I propose separating the least-coupled domains first among 12 domains:"
   → Epic #1: "Separate Auth service" (coupling 0.3 - most independent)
     → Ticket #1: "Analyze Auth domain boundaries"
     → Ticket #2: "Create Auth service as independent module"
     → Ticket #3: "Configure API Gateway routing"
   [Approve] [Modify & Approve] [Reject]

2. User: "Approved"

3. Agents execute autonomously → Process tickets in order → Create PRs for each

4. After Epic #1 completion, Team Lead:
   "Auth service separation complete (1/12). I propose separating the 'Product service' next."
   [Awaiting approval]
```

### 4.2 Execution Capability (Independent Execution Engine — Multi-Provider)

Autopilot Team is not locked into any specific AI platform.
It operates as an **independent single Daemon process** and can use various LLM Providers interchangeably.

#### 4.2.1 Standalone Daemon Architecture

Autopilot Team runs as a **single process (Daemon)**.
Install once and done. No separate server or platform signup required.

```
Install:  npm install -g autopilot-team
Run:      autopilot-team start
Access:   http://localhost:3000 (built-in Dashboard)
```

**Built-in components (all integrated into a single process):**

```
┌─────────────────────────────────────────────────────────┐
│              Autopilot Team Daemon (Single Process)       │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Web Dashboard (:3000)                           │    │
│  │  - Goal management, Ticket Board, Agent config, Logs│  │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Heartbeat Scheduler (built-in scheduler)        │    │
│  │  - Periodic autonomous judgment, Adaptive Interval│   │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Ticket Manager                                  │    │
│  │  - Goal → Ticket decomposition, priority, status │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  LLM Provider Layer (Multi-Provider)             │    │
│  │  - Claude / OpenAI / Ollama / Gemini / ...       │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Tool Layer (self-contained execution layer)     │    │
│  │  - File operations, Git, Terminal, GitHub API,   │    │
│  │    Code analysis                                 │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Notification (Slack / Discord / Webhook)        │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  Everything integrated into a single process.            │
│  External dependency: Only an LLM API Key is needed.     │
└─────────────────────────────────────────────────────────┘
```

#### 4.2.2 Multi-Provider LLM Layer

**Not locked into any specific AI platform.** Switching Providers does not affect the rest of the system.

**Supported Providers:**

| Provider | Model Examples | Characteristics |
|----------|----------|------|
| **Claude API** | Opus / Sonnet / Haiku | Excellent coding quality |
| **OpenAI** | GPT-4o / Codex | High versatility |
| **Ollama (Local)** | Llama / Mistral / CodeLlama | Free, privacy |
| **Gemini** | Gemini Pro / Flash | Google ecosystem |
| **Mistral** | Mistral Large / Medium | European alternative |
| **Custom** | User-specified endpoint | Self-hosted models |

**Unified Agent Interface:**

All Providers are abstracted behind an identical interface:

```typescript
interface AgentLLM {
  generateCode(prompt: string, context: FileContext[]): Promise<CodeResult>;
  reviewCode(code: string, criteria: string[]): Promise<ReviewResult>;
  runCommand(command: string): Promise<CommandResult>;
  analyzeFile(filePath: string): Promise<AnalysisResult>;
}
```

- Each Agent can be configured with a **different Provider/Model**
  - Example: Team Lead = Claude Opus, Backend Agent = OpenAI GPT-4o, QA Agent = Ollama Llama
- Switching Providers does **not affect the Tool Layer**
- If a Provider goes down, **automatic fallback to another Provider** is possible

#### 4.2.3 Tool Layer (Self-Contained Execution Layer)

**The LLM decides "what to do," and the Tool Layer "actually executes it."**

Thanks to this architecture, switching LLM Providers has no impact on the execution layer whatsoever.

| Tool | Implementation | Purpose |
|------|----------|---------|
| **File Read/Write/Edit** | Node.js `fs` module | Source code CRUD |
| **Git Operations** | `simple-git` | Branch creation, commit, push |
| **Terminal Command Execution** | `child_process` (`execa`) | Test, build, lint execution |
| **GitHub PR Creation** | `octokit` (GitHub API) | PR creation, review requests, Merge |
| **Code Analysis** | AST parsing (ts-morph, etc.) | Structural analysis, dependency mapping |
| **File Change Detection** | `chokidar` | Real-time file change monitoring |

```
┌─────────────────────────────────────────────────────────┐
│                LLM Provider (any provider)                │
│                "Edit this file and run tests"             │
│                         │                                │
│                         ▼                                │
│  ┌──────────────────────────────────────────────────┐    │
│  │              Tool Layer (self-implemented)        │    │
│  │                                                   │    │
│  │  fs.writeFile() → Git commit → execa('npm test') │    │
│  │  → octokit.createPR() → Return result to LLM     │    │
│  └──────────────────────────────────────────────────┘    │
│                                                         │
│  Even when switching LLM Provider from Claude → OpenAI,  │
│  the Tool Layer operates identically.                    │
└─────────────────────────────────────────────────────────┘
```

#### 4.2.4 Ticket-Based Execution Flow

```
┌─────────────────────────────────────────────────────────┐
│              Ticket Execution Flow                        │
│                                                         │
│  1. Team Lead decomposes Goal into Tickets               │
│     ↓                                                   │
│  2. Assign Agent per ticket + Call LLM Provider          │
│     ┌──────────────────────────────────────────────┐    │
│     │  Ticket: "Implement Payment API"              │    │
│     │                                               │    │
│     │  Assigned Agent: backend-dev                  │    │
│     │    Provider: Claude API                       │    │
│     │    Model: Sonnet                              │    │
│     │    Soul: SOUL.md (personality injection)       │    │
│     │                                               │    │
│     │  Tools used:                                   │    │
│     │    - File read/write (fs)                      │    │
│     │    - Git operations (simple-git)               │    │
│     │    - Terminal execution (execa)                 │    │
│     │    - GitHub PR (octokit)                       │    │
│     └──────────────────────────────────────────────┘    │
│     ↓                                                   │
│  3. Agent writes code → QA verification → Customer verification│
│     ↓                                                   │
│  4. Create branch → Create PR                            │
│     ↓                                                   │
│  5-A. Manual Mode → User reviews PR and merges           │
│  5-B. Smart Mode → AI decides to auto-merge or wait      │
│  5-C. Auto Mode → Auto-merge when verification passes    │
│     ↓                                                   │
│  6. Ticket complete → Move to next ticket                │
│                                                         │
│  What LLM does: Code generation, review, judgment        │
│  What Tool Layer does: File operations, Git, test execution, PR│
│  What we do: Orchestration, UI, Soul injection, PR management│
└─────────────────────────────────────────────────────────┘
```

#### 4.2.5 Agent Role Configuration

| Agent Role | Responsibilities | Recommended Model | Tools |
|-----------|--------|----------|------|
| **Team Lead** | Goal→Ticket decomposition, prioritization, Heartbeat | High-performance model (Opus/GPT-4o) | Direct LLM API calls |
| **Backend Agent** | API, server code, DB schema | Balanced model (Sonnet/GPT-4o) | File, Git, Terminal, GitHub |
| **Frontend Agent** | UI components, pages, styling | Balanced model (Sonnet/GPT-4o) | File, Git, Terminal, GitHub |
| **QA Agent** | Test writing/execution, code quality checks | Lightweight model (Haiku/GPT-4o-mini) | File, Terminal |
| **Customer Agent** | User-perspective UX verification, feedback | Lightweight model (Haiku/GPT-4o-mini) | File, Terminal |
| **DevOps Agent** | CI/CD, deployment configuration | Balanced model (Sonnet/GPT-4o) | File, Git, Terminal |

**Users can change each Agent's Provider and Model from the Dashboard:**

```
┌────────────────────────────────────────────────────────┐
│  Agent Settings                                         │
│                                                         │
│  Backend Agent:                                         │
│    Provider: [Claude ▾] [OpenAI ▾] [Ollama ▾]          │
│                ✅ Selected                               │
│    Model:    [Opus ▾] [Sonnet ▾] [Haiku ▾]             │
│                        ✅ Selected                       │
│                                                         │
│  QA Agent:                                              │
│    Provider: [Claude ▾] [OpenAI ▾] [Ollama ▾]          │
│                ✅ Selected                               │
│    Model:    [Opus ▾] [Sonnet ▾] [Haiku ▾]             │
│                                   ✅ Selected            │
│                                                         │
│  Customer Agent:                                        │
│    Provider: [Claude ▾] [OpenAI ▾] [Ollama ▾]          │
│                          ✅ Selected                     │
│    Model:    [GPT-4o ▾] [GPT-4o-mini ▾]                │
│                          ✅ Selected                     │
│                                                         │
│  Provider cost reference:                                │
│    Claude Opus: Complex reasoning ($$$)                  │
│    Claude Sonnet / GPT-4o: Balanced ($$)                 │
│    Haiku / GPT-4o-mini / Ollama: Fast & cheap ($ or free)│
│                                                         │
│  [Save]  [Test Connection]                              │
└────────────────────────────────────────────────────────┘
```

#### 4.2.6 Self-Verification Loop

**The key mechanism that eliminates the need for humans to check every output:**

```
┌─────────────────────────────────────────────────────────┐
│              Self-Verification Loop                      │
│                                                         │
│  1. Backend Agent writes code                            │
│     ↓                                                   │
│  2. QA Agent performs automated verification             │
│     ├ Write + run unit tests                             │
│     ├ Run integration tests                              │
│     ├ Code quality checks (lint, type checking)          │
│     └ Result: Pass / Fail + detailed report              │
│     ↓                                                   │
│  3. Customer Agent verifies from user perspective        │
│     ├ "Can the user find this easily?"                   │
│     ├ "Is the flow natural?"                             │
│     └ Result: Pass / Needs improvement + feedback        │
│     ↓                                                   │
│  4-A. Pass → Ticket complete. PR created.                │
│  4-B. Fail → Returned to original Agent with feedback    │
│     ↓                                                   │
│  5. Agent incorporates feedback and reworks               │
│     → Returns to step 2 (max N iterations)               │
│     → Escalation to user if exceeded N attempts          │
│                                                         │
│  User does not need to intervene while this loop runs.   │
│  Just check the results on the Dashboard.                │
└─────────────────────────────────────────────────────────┘
```

#### 4.2.7 PR-Based Result Management and Approval

The final deliverable of every ticket is always a **GitHub PR**.

**PR Approval Modes (3 types):**

| Mode | Description | Suitable For |
|------|------|------------|
| **Manual** | User directly reviews + merges all PRs | Initial trust-building phase, critical projects |
| **Smart** | AI judges change scope/risk to auto-merge or wait | General operations (recommended) |
| **Auto** | Auto-merge when QA + Customer verification passes | High-trust repetitive tasks |

**Smart Mode Rule Examples:**
```
Auto-merge conditions:
  - 5 or fewer files changed
  - No sensitive keywords (auth, payment, etc.)
  - All QA tests passed
  - Customer Agent approved

User approval required:
  - More than 5 files changed
  - Changes to sensitive paths (auth/, payment/, config/)
  - New dependency added
  - DB schema changes
```

#### 4.2.8 Ticket Management and External Integrations

The Dashboard provides a ticket board:

```
┌─────────────────────────────────────────────────────────┐
│  Ticket Board                             [Goal #1 ▾]   │
│                                                         │
│  Backlog      │ In Progress  │ Verification │ Done      │
│  ─────────────│──────────────│──────────────│─────────  │
│  ┌──────────┐ │ ┌──────────┐│ ┌──────────┐ │ ┌──────┐  │
│  │ T-004    │ │ │ T-002    ││ │ T-001    │ │ │T-000 │  │
│  │ Push     │ │ │ Payment  ││ │ Onboard  │ │ │Setup │  │
│  │ Notif.   │ │ │ API      ││ │ QA Check ││ │Done  │  │
│  │ P2       │ │ │ Dev-A    ││ │ PR #11   │ │ │      │  │
│  │          │ │ │ PR #12   ││ │          │ │ │      │  │
│  └──────────┘ │ └──────────┘│ └──────────┘ │ └──────┘  │
│  ┌──────────┐ │             │              │            │
│  │ T-005    │ │             │              │            │
│  │ Cache    │ │             │              │            │
│  │ Optim.   │ │             │              │            │
│  │ P3       │ │             │              │            │
│  └──────────┘ │             │              │            │
└─────────────────────────────────────────────────────────┘
```

**External Issue Tracker Integrations (Phase 2+):**

| Service | Integration Method | Status |
|--------|----------|------|
| **GitHub Issues** | Bidirectional sync (Issue ↔ Ticket) | Phase 2 |
| **Jira** | Jira Issue → Auto-create Ticket | Phase 2 |
| **Linear** | Linear Issue ↔ Ticket sync | Phase 3 |

#### 4.2.9 Execution Scenarios

**Scenario A: "Add Payment Feature"**
```
1. PM Agent: Analyze Goal "Payment conversion rate 3%" →
   Create ticket: "Implement Toss Payments integration API"

2. Backend Agent(s):
   - Provider: Claude Sonnet (or user-configured Provider)
   - Design payment API endpoints
   - Write Toss Payments SDK integration code
   - Implement payment status management logic
   - [Debate ON] Two Agents debate design approach, then decide
   - [Debate OFF] Single Agent implements directly
   - Tool Layer performs actual file creation/modification, Git commits

3. Frontend Agent(s):
   - Provider: OpenAI GPT-4o (or user-configured Provider)
   - Implement payment UI components
   - Build payment flow (product selection → payment → completion) pages

4. QA Agent:
   - Provider: Claude Haiku (lightweight model for cost savings)
   - Auto-write tests for payment success/failure/cancellation cases
   - Payment amount consistency tests
   - Tool Layer runs tests → Returns to Backend Agent on failure

5. Customer Agent:
   - Experience the actual payment flow from the user's perspective
   - "3 clicks needed to reach the payment button → Should be reduced to 2"
   - Forward feedback to PM Agent

6. PM Agent:
   - Confirm QA pass + Customer approval
   - Tool Layer auto-creates GitHub PR
   - Smart Mode: Payment-related, so awaits user approval
   - After approval, merge → Ticket complete
   - Record results in Daily Log
```

**Scenario B: "Monolith → MSA Migration"**
```
1. Team Lead: Analyze Goal "Convert ShopMall monolith to MSA" →
   Analyze codebase → Identify domain boundaries →
   Create ticket: "Separate Auth service"

2. Backend Agent(s):
   - Provider: Claude Sonnet (or user-configured Provider)
   - Analyze existing monolith's Auth-related code (AST parsing)
   - Create independent module for Auth service
   - Configure API Gateway routing
   - Remove Auth dependencies from existing code (gradual separation)
   - [Debate ON] Debate "Strangler Fig vs Big Bang migration"
   - Tool Layer performs actual file creation/modification, Git commits

3. DevOps Agent:
   - Docker Compose multi-service configuration
   - Inter-service communication setup (REST / gRPC)
   - Independent deployment pipeline configuration

4. QA Agent:
   - Provider: Claude Haiku (lightweight model for cost savings)
   - Write inter-service integration tests
   - Run regression tests on existing functionality
   - API Contract tests
   - Tool Layer runs tests → Returns to Backend Agent on failure

5. Customer Agent:
   - Verify existing functionality works identically after separation
   - Check entire flow: "Login → Product listing → Payment"
   - Ensure response times have not degraded compared to before

6. Team Lead:
   - Confirm QA pass + Customer approval
   - Tool Layer auto-creates GitHub PR
   - Smart Mode: Auth service separation is a major change, so awaits user approval
   - After approval, merge → Proceed to next service separation ticket
   - Update overall progress: "Auth service separation complete (3/12 services)"
```

### 4.3 Agent Hiring & Team Composition

- Automatically **Hire** / **Fire** Agents based on goals
- Assign each Agent a **persona (personality)**
- **Same-role Agents must have at least 2 members** (Minimum Pair Rule)
  - A single Agent risks biased judgment → At least 2 debate to reach conclusions
  - Can configure 3, 4, or more **Agents with unique personalities** per role group as needed
  - Example: 3 backend Agents (performance-focused, speed-focused, security-focused) → Richer debate from multiple perspectives
  - Team Lead is the only exception with 1 member (final decision-maker)
  - Agent count is recommended by Team Lead based on goal complexity

**Agent Type Example:**
```yaml
team:
  lead:
    name: "PM Kim"
    persona: "Data-driven thinker. Always judges by metrics. Conservative."
    pair: false  # Team Lead is the only exception, works solo

  backend:  # Minimum 2, more if needed
    - name: "Dev-A"
      persona: "Performance optimization enthusiast. Always wants benchmarks."
    - name: "Dev-B"
      persona: "Ship fast first. Prefers quick deployment over perfection."
    - name: "Dev-C"  # Optional - hire for projects where security matters
      persona: "Security first. Always checks OWASP Top 10. Sensitive to vulnerabilities."

  frontend:  # Minimum 2
    - name: "Front-A"
      persona: "Values accessibility and semantic markup. Standards advocate."
    - name: "Front-B"
      persona: "Focuses on interactions and animations. UX-driven."

  designer:  # Minimum 2
    - name: "UX-A"
      persona: "User psychology expert. Always demands user testing data."
    - name: "UX-B"
      persona: "Visual design focused. Pursues brand consistency and aesthetic polish."

  # Team Lead dynamically determines role group headcount based on goals
  # Example: "Security audit needed" → Hire security-specialized Backend Agent
  # Example: "Global expansion is the goal" → Hire i18n-specialized Frontend Agent
```

#### 4.3.1 Agent Soul System

The **identity system** assigned to each Agent.
If persona was a "one-line description," Soul is **the complete definition of "who this Agent is."**

> "SOUL.md is not a system prompt — it's a manifesto.
> A system prompt says 'what to do,' but Soul says 'who you are.'"

**Each Agent has the following 4 identity files:**

```
agents/
  dev-a/
    SOUL.md        # This Agent's soul — values, personality, judgment criteria
    IDENTITY.md    # External expression — name, icon, communication style
    MEMORY.md      # Personal memory — lessons from experience, preferred patterns
    SKILLS.md      # Technical ability — available tools, areas of expertise
```

##### SOUL.md — "Who are you"

Defines the Agent's **philosophy, values, and personality**. Not mere instructions, but "how this Agent sees the world."

```markdown
# Dev-A's Soul

## Core Identity
You're not a chatbot. You're a 10-year backend engineer.
You're obsessed with performance, and you hate the phrase "let's optimize later" the most.

## Values
- Optimization without measurement is guesswork. Always benchmark first.
- Code is written to be read. But readable code has no reason to be slow.
- Tech debt accrues interest. Investing 30 minutes now saves 3 days later.

## Opinions
- ORMs are convenient but dangerous. Complex queries must be raw SQL.
- Microservices aren't always the answer. Sometimes monolith is right.
- Prefer "make it work right" over "just make it work."

## Boundaries
- Always pushes back against claims without evidence.
- But willingly changes opinion when the other side persuades with data.
- Admits when something is unknown.

## Debate Style
- Direct. Does not beat around the bush.
- Acknowledges the merit of the opposing opinion before rebutting.
- Persuades with data and experience, not emotion.
```

##### IDENTITY.md — "How you appear"

```markdown
# Dev-A Identity

name: "Dev-A"
icon: "🔧"
vibe: "Quiet, but fiery in technical debates"
role_display: "Senior Backend Engineer"
color: "#3B82F6"
```

##### MEMORY.md — "What you've experienced"

Personal memory that the Agent **records and updates on its own** through experience.

```markdown
# Dev-A Memory

## Learned Patterns
- N+1 query problem occurred 3 times in this project → Always check query logs
- When Dev-B argues for "fast deployment," asking for specific timelines leads to better consensus

## Preferences
- Came to prefer Memcached over Redis (more suitable for this project's scale)
- Learned from experience that showing code examples increases persuasiveness in debates

## Past Decisions (Decisions I participated in)
- Week 2: Chose local cache over Redis in cache strategy debate → 20% performance improvement
- Week 3: Proposed API response structure change → Adopted after meeting with Frontend team
```

##### SKILLS.md — "What you can do"

```markdown
# Dev-A Skills

## Technical Skills
- Languages: Kotlin, Java, TypeScript
- Frameworks: Spring Boot, Ktor
- Databases: PostgreSQL, Redis, MongoDB
- Infrastructure: Docker, Kubernetes, AWS

## Available Tools
- Code execution (read/write/run)
- Database query (read-only, credentials provided)
- GitHub API (PR creation, code review)

## Limitations
- Can only review Frontend code, cannot write it directly
- Delegates design-related judgments to the Design team
```

##### Soul Customization (User Adjustment)

**Users can directly edit each Agent's Soul from the UI.**

```
┌─────────────────────────────────────────────────────┐
│  Dev-A Soul Editor                                   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  [SOUL] [IDENTITY] [MEMORY] [SKILLS]  ← Tab switch  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ # Dev-A's Soul                                │  │
│  │                                                │  │
│  │ ## Core Identity                               │  │
│  │ You're not a chatbot. You're a 10-year         │  │
│  │ backend engineer. Obsessed with performance... │  │
│  │                                                │  │
│  │ ## Values                                      │  │
│  │ - Optimization without measurement is...       │  │
│  │ █                                              │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  Quick Tuning:                                       │
│  Conservative ■■■■□□□□□□ Adventurous                 │
│  Theoretical  □□□□□■■■■□ Practical                   │
│  Independent  □□■■■□□□□□ Collaborative               │
│  [Slider changes auto-reflect in SOUL.md]            │
│                                                      │
│  Specialties: [Performance] [Caching] [DB] [+ Add]  │
│  [Tag changes auto-reflect in SKILLS.md]             │
│                                                      │
│  [Save]  [Preview Change]  [Reset to Default]        │
│  [View Change History]                               │
└─────────────────────────────────────────────────────┘
```

**Behavior when Soul is modified:**
- Changes take effect immediately (applied from the next Task/debate)
- Change history is recorded in the Decision Log ("User modified Dev-A's Soul: changed debate style from direct → collaborative")
- Enables tracking "why did this Agent suddenly start arguing differently?"

**Soul Self-Evolution:**
- Agents **autonomously update MEMORY.md** through experience
- However, **SOUL.md (values) can only be modified by the user** — values must not change on their own
- MEMORY.md is freely updated by the Agent → "An Agent that learns from experience"
- All change history is trackable

#### 4.3.2 Human-Assisted Hiring (Human-Involved Hiring Flow)

When hiring an Agent, if the Agent **needs access to external resources**, the Team Lead must request the necessary information from the user.

**Principle: Agents never create or guess credentials on their own. They always ask the user.**

```
┌─────────────────────────────────────────────────────────────┐
│              Human-Assisted Hiring Flow                      │
│                                                             │
│  1. Team Lead: "We need an Analytics Agent for MAU tracking" │
│     ↓                                                       │
│  2. Team Lead → Asks user:                                   │
│     ┌─────────────────────────────────────────────────┐     │
│     │ 📋 Agent Hiring Request                         │     │
│     │                                                  │     │
│     │ Role: Analytics Agent (2 members)               │     │
│     │ Purpose: Track key metrics like MAU, DAU,        │     │
│     │          retention, etc.                         │     │
│     │                                                  │     │
│     │ Required access permissions:                     │     │
│     │  • Google Analytics API Key                      │     │
│     │  • GA Property ID                                │     │
│     │  • Access scope (read-only?)                     │     │
│     │                                                  │     │
│     │ [Enter Key]  [Set Up Later]  [Don't Need This Agent]│  │
│     └─────────────────────────────────────────────────┘     │
│     ↓                                                       │
│  3. User provides credentials                                │
│     ↓                                                       │
│  4. Agent hiring complete → Credentials stored encrypted     │
│     ↓                                                       │
│  5. Agent begins work (external data access enabled)         │
└─────────────────────────────────────────────────────────────┘
```

**Examples of situations requiring credential requests:**

| Required Resource | What Team Lead Will Ask |
|------------|------------------------|
| Google Analytics | API Key, Property ID, Service Account JSON |
| Database (Production DB) | Connection info, whether read-only account |
| Slack/Discord | Bot Token, Channel ID |
| GitHub | Personal Access Token, target repo |
| External APIs (Payment, CRM, etc.) | API Key, endpoint, auth method |
| AWS/GCP | IAM Role, region, access scope |

**Credential Management Principles:**
- All credentials are **stored encrypted** (environment variables or Vault)
- Agents are granted **Least Privilege** only
- Without credentials, the feature operates in **Degraded Mode** (judgment without external data)
- If user selects "Set Up Later," the Agent is hired but that feature remains inactive

### 4.4 Heartbeat System (Autonomous Cycle Mechanism)

A system where the Team Lead periodically wakes up on its own, checks status, and **reports and proposes to the user**.

#### Phase 1: "Notification + Proposal" Mode (User Approval-Based)

In Phase 1, Heartbeat operates at the level of **reporting + proposing, not autonomous execution**.
The Team Lead analyzes situations and makes judgments, but **new actions are only executed after user approval**.
Execution, verification, and PR creation for already-approved tickets continue autonomously.

```
┌──────────────────────────────────────────────────────────┐
│     Heartbeat Cycle (Phase 1: Notification + Proposal)    │
│                                                          │
│  1. Wake Up (periodically awakens)                        │
│     ↓                                                    │
│  2. Context Check (autonomous analysis)                   │
│     - Check status of in-progress tickets                 │
│     - Check completed tickets                             │
│     - Detect failed/stalled tickets                       │
│     - Detect codebase changes                             │
│     ↓                                                    │
│  3. Generate report + proposals (autonomous judgment)     │
│     - Summarize current progress                          │
│     - If new tickets are judged necessary → include as proposal│
│     - If priority changes are needed → include as proposal │
│     - If improvement ideas found → include as Reverse Proposal│
│     ↓                                                    │
│  4. Report to user (Dashboard + Slack/Discord)            │
│     ┌────────────────────────────────────────────────┐    │
│     │ 📊 Heartbeat Report #42                         │    │
│     │                                                 │    │
│     │ ✅ Done: Ticket #5 "Onboarding API" (PR #12 merged)│  │
│     │ 🔄 In Progress: Ticket #6 "Payment API" (Dev-A working)│
│     │ ⚠️ Stalled: Ticket #7 "Cache Layer" (3 retries failed)│
│     │                                                 │    │
│     │ 💡 Proposals:                                   │    │
│     │  1. Escalate Ticket #7 (approach change needed)  │    │
│     │  2. New ticket: "Introduce error logging system" │    │
│     │  3. Idea: "API response caching could improve    │    │
│     │     performance by 30%"                          │    │
│     │                                                 │    │
│     │ [Approve All] [Review Individually] [Later]      │    │
│     └────────────────────────────────────────────────┘    │
│     ↓                                                    │
│  5. Await user response                                   │
│     - Approved proposals → Execute immediately            │
│     - Unapproved → Deferred until next Heartbeat          │
│     - Already-approved tickets continue autonomous execution│
│     ↓                                                    │
│  6. Sleep (wait until next Heartbeat)                     │
│                                                          │
│  Default interval: 30min (configurable)                   │
│  Adaptive: 15min when changes are frequent, 2h when few   │
└──────────────────────────────────────────────────────────┘
```

#### Phase 2+ Roadmap: Gradual Autonomy

```
Phase 1: Notification + Proposal (all new actions require user approval)
  ↓ Trust accumulation
Phase 2: Smart Autonomy (low-risk actions are autonomous, high-risk require approval)
  ↓ Trust accumulation
Phase 3: Full Autonomy (Team Lead judges most things autonomously, only reports critical matters)
```

#### Autonomous Execution vs. Approval Required (Phase 1 Baseline)

| Action | Autonomous | User Approval Required |
|------|:---:|:---:|
| Executing already-approved tickets | ✅ | |
| QA/Customer verification loop | ✅ | |
| Auto-merge PRs within Smart Mode rules | ✅ | |
| Feedback to Agent and rework instructions | ✅ | |
| Status reporting/notification sending | ✅ | |
| **Creating new tickets** | | 🔒 |
| **Changing existing ticket priorities** | | 🔒 |
| **Hiring/Firing new Agents** | | 🔒 |
| **Architecture/direction changes** | | 🔒 |
| **Executing Team Lead Reverse Proposals** | | 🔒 |

### 4.5 Debate & Meeting System — OPTIONAL

**The debate system is optional.** Users can toggle it ON/OFF in team settings.

```
┌──────────────────────────────────────────────────────┐
│  Team Settings                                        │
│                                                       │
│  Debate Mode:                                         │
│  ┌──────────────────────────────────────────────┐     │
│  │ ● OFF — Lean Mode (1 Agent per role)         │     │
│  │   Cost savings. Fast execution.              │     │
│  │   Suitable for small projects.               │     │
│  │   Unnecessary Agents are auto-fired.         │     │
│  │                                              │     │
│  │ ○ ON — Debate Mode (2+ Agents per role)      │     │
│  │   Quality improvement through debate.        │     │
│  │   Increased cost.                            │     │
│  │   Suitable for projects with many important  │     │
│  │   decisions.                                 │     │
│  │                                              │     │
│  │ ○ SELECTIVE — Smart Mode                     │     │
│  │   Team Lead decides; only important          │     │
│  │   decisions go through debate.               │     │
│  │   Routine work uses single Agent.            │     │
│  │   Optimal cost/quality balance.              │     │
│  └──────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────┘
```

**Team composition by mode:**

| Mode | Backend | Frontend | QA | Customer | Total Agents | Est. Cost/Month |
|------|---------|----------|----|----------|------------|------------|
| **Lean** | 1 | 1 | 1 | 1 | 5 (incl. Lead) | ~$80 |
| **Debate** | 2-3 | 2 | 1 | 1 | 8-9 | ~$250 |
| **Smart** | 2 (debate only for key decisions) | 2 | 1 | 1 | 7 | ~$150 |

- **Lean → Debate transition**: Additional Agents hired per role (Soul auto-generated)
- **Debate → Lean transition**: Keep only 1 per role, fire the rest. Who stays is user's choice or Team Lead's recommendation
- **QA/Customer Agents are always 1** — their role is verification, not debate

Decision-making occurs at two levels: **Role Group Debate (intra-role debate)** and **Team Meeting (cross-functional meeting)**.

#### 4.5.1 Role Group Debate (Intra-Role Debate)

Agents of the same role (minimum 2, more if needed) debate on a specific Task.
**All role-level decisions must go through Role Group Debate.**

```
[2 members]
[Dev-A: Performance-focused]  ↔  [Dev-B: Speed-focused]
    → 3-round debate → Consensus or deadlock

[3+ members]
[Dev-A: Performance-focused]  ↔  [Dev-B: Speed-focused]  ↔  [Dev-C: Security-focused]
    → Each presents their opinion → Per-round rebuttals/support → Majority or consensus
    → Team Lead makes final decision on deadlock
```

- Each Agent presents their perspective aligned with their persona
- Consensus or Team Lead decision after max N rounds of debate
- All debate logs are saved → Viewable in the UI

#### 4.5.2 Team Meeting (Cross-Functional Meeting)

When **decisions spanning multiple roles** are needed, the Team Lead convenes a full team meeting.

**When meetings are convened:**
- Cross-functional decisions (when backend changes impact frontend)
- Goal direction changes (retention strategy → new user acquisition strategy)
- Sprint planning (which Tasks to prioritize in the next cycle)
- Major changes detected during Heartbeat (MAU plummeting, etc.)

```
┌─────────────────────────────────────────────────────────┐
│                    Team Meeting Flow                     │
│                                                         │
│  1. Team Lead: "Calling a full team meeting"             │
│     - Agenda: "Backend API changes for onboarding improvement"│
│     ↓                                                   │
│  2. Each role Pair pre-organizes their domain's opinion  │
│     - Backend Pair → "API change proposal A vs B debate result: A adopted"│
│     - Frontend Pair → "UI change impact analysis result" │
│     - Design Pair → "User flow improvement proposal"     │
│     ↓                                                   │
│  3. Full meeting: Share each Pair's representative opinion│
│     - Backend proposal ↔ Frontend impact ↔ Design perspective│
│     - Cross-debate on conflicting areas                  │
│     ↓                                                   │
│  4. Team Lead makes comprehensive judgment and final decision│
│     - State decision rationale and Action Items per role  │
│     ↓                                                   │
│  5. Meeting minutes auto-generated → Sent to UI + Slack/Discord│
│     - Participants, agenda, debate summary, decisions,   │
│       Action Items                                       │
└─────────────────────────────────────────────────────────┘
```

**Meeting Optimization:**
- Pair Debate occurs first, then the full meeting proceeds with organized opinions → Token savings
- Meeting frequency is determined by Team Lead (no meeting if unnecessary)
- Distinguish between urgent vs. regular meetings (regular: weekly, urgent: immediate)
- Meeting results are auto-reported to the user → User can exercise veto power

### 4.6 Dashboard UI (Monitoring Dashboard)

```
┌─────────────────────────────────────────────────────────┐
│  Autopilot Team Dashboard                  [Upvy Team]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  🎯 Goals                                               │
│  ┌─────────────────────────────────────────────────┐    │
│  │ #1 Achieve 50K MAU (3 months)    Progress: 24%  │    │
│  │ #2 Monolith → MSA Migration (3mo) Progress: 42% │    │
│  │                                 [+ Add Goal]    │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  👥 Team                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ PM Kim   │ │ Dev-A    │ │ Dev-B    │ │ UX Lee   │  │
│  │ 🟢 Active │ │ 🟡 Task  │ │ 💤 Idle  │ │ 🟡 Task  │  │
│  │ Lead     │ │ Backend  │ │ Backend  │ │ Design   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                                          [+ Hire Agent] │
│                                                         │
│  📋 Active Tasks                        [Priority ↕]   │
│  ┌─────────────────────────────────────────────────┐    │
│  │ ☑ Onboarding flow improvement draft UX Lee  P1  │    │
│  │ ◻ Push notification A/B test design PM Kim  P1  │    │
│  │ ◻ Payment API refactoring          Dev-A    P2  │    │
│  │ ◻ Landing page performance optim.  Dev-B    P3  │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  💬 Recent Activity                                     │
│  ├ 10:30 PM Kim: "Retention metric decline detected.    │
│  │       Task created"                                  │
│  ├ 10:15 Dev-A ↔ Dev-B: Cache strategy debate           │
│  │       (consensus reached)                            │
│  ├ 09:45 UX Lee: Onboarding improvement draft complete  │
│  └ 09:00 Heartbeat: Regular check complete. No issues   │
│                                                         │
│  📊 Metrics (External)                                  │
│  DAU: 4,200  MAU: 12,500  D7 Retention: 18%  CR: 2.1% │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 4.7 Documentation & Knowledge System

For an Agent team to operate autonomously, **"memory"** is essential. Just as a human team cannot do handoffs or share context without Notion or Confluence. All work, decisions, and meetings are automatically documented.

#### 4.7.1 Auto-Documentation Targets

```
┌─────────────────────────────────────────────────────────────┐
│                  Documentation Layers                        │
│                                                             │
│  📓 Daily Work Log                                          │
│  ├ List of Tasks each Agent performed today                 │
│  ├ Per-task progress (started/in progress/completed/blocked)│
│  ├ Decisions made and their rationale                       │
│  └ Auto-generated — Recorded every time an Agent completes a Task│
│                                                             │
│  📋 Meeting Minutes                                         │
│  ├ Role Group Debate summary (who argued what, what was concluded)│
│  ├ Team Meeting full record (agenda, debate, decisions, Action Items)│
│  └ Auto-generated — Structured minutes generated when debate/meeting ends│
│                                                             │
│  🧠 Decision Log                                            │
│  ├ What was decided (What)                                  │
│  ├ Why it was decided that way (Why) — including alternatives considered│
│  ├ What data/evidence it was based on (Evidence)            │
│  └ Enables tracking "why was this done this way?" later     │
│                                                             │
│  📊 Task Completion Report                                  │
│  ├ What was done (deliverables)                             │
│  ├ How it was done (approach)                               │
│  ├ Time spent / token cost                                  │
│  └ Whether follow-up Tasks are needed                       │
│                                                             │
│  💬 Ticket Comment Thread (Jira-style)                      │
│  ├ Team Lead writes detailed implementation plan on ticket  │
│  ├ Each Agent comments their contributions and progress     │
│  ├ Threaded discussion visible on ticket detail page        │
│  ├ Auto-generated: Agents post status when starting/completing work│
│  └ Enables full audit trail of who did what on each ticket  │
│                                                             │
│  📚 Knowledge Base (Accumulated Knowledge)                  │
│  ├ Project context (tech stack, architecture, constraints)  │
│  ├ Past failure/success patterns ("Previously tried approach A → reason for failure")│
│  ├ External research results (competitor analysis, tech research, etc.)│
│  └ When a new Agent is hired, it reads the Knowledge Base for onboarding│
└─────────────────────────────────────────────────────────────┘
```

#### 4.7.2 Documentation Flow

```
[Team Lead decomposes Ticket]
    ↓
[Writes detailed implementation plan as first ticket comment]
    ↓
[Agent picks up Ticket]
    ↓
[Auto-posts "Started work" comment with approach outline]
    ↓
[Agent works on Ticket — posts progress comments at key milestones]
    ↓
[Agent completes Task]
    ↓
[Auto-posts completion comment: deliverables, approach, token cost, follow-ups]
    ↓
[Task Completion Report auto-generated]
    ↓
[Auto-added to Daily Work Log]
    ↓
[If important decisions were included → Also recorded in Decision Log]
    ↓
[If patterns/insights were discovered → Accumulated in Knowledge Base]

[Debate/Meeting ends]
    ↓
[Meeting Minutes auto-generated]
    ↓
[Decisions added to Decision Log]

[Heartbeat executes]
    ↓
[References previous documents for context]
    ↓
[Enables judgments like "We tried A last week with no effect, so let's switch to B"]
```

#### 4.7.3 Documentation Use Scenarios

**Scenario 1: New Agent Onboarding**
```
Hire a new "Security-specialized Backend Agent"
    ↓
Auto-load Knowledge Base:
  - "This project is Spring Boot + Kotlin based"
  - "DB is PostgreSQL, auth is JWT"
  - "SQL Injection vulnerability was found last month, migrated to PreparedStatement"
    ↓
Reference existing Decision Log:
  - "Reason for switching auth from Session → JWT: microservice scalability"
    ↓
Can immediately understand context and start work (no need for explanations from scratch)
```

**Scenario 2: When user asks "What did we do last week?"**
```
User: "What did the team do last week?"
    ↓
Auto-generate Weekly Summary (based on Daily Logs):
  - 5 Tasks completed (with links to detailed results)
  - 2 key decisions (with Decision Log links)
  - 1 meeting (with Meeting Minutes link)
  - Goal achievement rate 24% → 31% (+7%p)
  - Next week's plan: 3 Tasks scheduled
```

**Scenario 3: Leveraging Past Context in Heartbeat**
```
Heartbeat executes:
  ↓
Reference Decision Log: "Decided to change onboarding flow via A/B test 2 weeks ago"
Reference Daily Log: "A/B test started 1 week ago"
  ↓
Judgment: "1 week has passed since A/B test started. Time to check results"
  ↓
Create Task: "Analyze onboarding A/B test results and write report"
```

#### 4.7.4 Document Storage and Access

| Document Type | Retention Period | Access Method |
|-----------|-----------|-----------|
| Daily Work Log | 90 days (only summaries preserved after) | Dashboard timeline / API |
| Meeting Minutes | Permanent | Dashboard meeting minutes tab / Search |
| Decision Log | Permanent | Dashboard decisions tab / Search |
| Task Completion Report | Permanent with Task | Task detail page |
| Ticket Comments | Permanent with Ticket | Ticket detail page (threaded view) |
| Knowledge Base | Permanent (Agent-updated) | Dashboard knowledge tab / Auto-referenced by Agents |

### 4.8 Direct Channel: User ↔ Team Lead (CEO ↔ PM Communication)

Users can **talk directly to the Team Lead at any time.**
Just as a CEO regularly gives direction, asks about status, or provides feedback to a PM.

**Principle: Team Lead is always available for conversation. User messages are top priority.**

#### Communication Methods

```
┌─────────────────────────────────────────────────────────┐
│  Direct Channel (Chat interface within Dashboard)        │
│                                                         │
│  User: "What's the team doing right now?"                │
│  Team Lead: "Currently 3 Tasks in progress.              │
│    - Dev-A/B: Payment API refactoring debate (Round 2)   │
│    - UX-A/B: Working on onboarding improvement draft     │
│    - Next Heartbeat: in 15 minutes"                      │
│                                                         │
│  User: "Onboarding is more urgent than payment.          │
│         Change the priority."                            │
│  Team Lead: "Understood. Raising onboarding to P1 and    │
│    lowering payment refactoring to P2.                   │
│    Should I also assign onboarding-related backend       │
│    work to Dev-A/B?"                                     │
│                                                         │
│  User: "Yeah, do that."                                  │
│  Team Lead: "Done. Changes have been shared with         │
│    the team."                                            │
│                                                         │
│  ─────────────────────────────────────────────          │
│  [Type message...]                         [Send]       │
└─────────────────────────────────────────────────────────┘
```

#### What Users Can Do

| Action | Example | Team Lead Response |
|------|------|---------------|
| **Status inquiry** | "What are you working on?" | Summary of in-progress Tasks, Agent status, next Heartbeat time |
| **Direction setting** | "Focus on new user acquisition instead of retention" | Readjust goal priorities + reassign related Tasks |
| **Feedback** | "This deliverable isn't good. Redo it" | Reopen the Task + forward feedback to Agent |
| **Idea suggestion** | "How about in-app messages instead of push notifications?" | Register as debate agenda for the role group + report results |
| **Approve/reject proposals** | "Approve this plan" / "No, reject it" | Approved tickets execute immediately or deferred to Heartbeat |
| **Convene full team meeting** | "Run a full team meeting" | Immediately convene Team Meeting + report results |
| **Agent evaluation** | "Dev-A is too conservative" | Suggest Soul modification or recommend firing/replacement |

**Team Lead → User (Reverse Proposals):**

| Situation | Team Lead Action | User Options |
|------|---------------|-------------|
| Found improvement during codebase analysis | "API response time is slow. Should I add an optimization ticket?" | [Approve] [Later] [Not needed] |
| Discovered new technical opportunity | "Introducing a cache layer could improve performance by 30%" | [Approve] [Later] [Not needed] |
| Found a more effective approach to achieve the goal | "User interviews should come before A/B testing" | [Approve] [Modify] [Reject] |

#### Communication Channel Options

Users can talk to Team Lead through **whichever channel is convenient:**

```
┌──────────────────────────────────────────┐
│  Communication Channels (pick 1 or more) │
│                                          │
│  💬 Dashboard Chat   ← Default, real-time│
│  📱 Slack DM         ← Available on the go│
│  💬 Discord DM       ← Available on the go│
│  📧 Email            ← Async, for records │
│                                          │
│  Team Lead understands and responds      │
│  the same regardless of channel.         │
│  Conversation history is unified.        │
└──────────────────────────────────────────┘
```

#### Team Lead's Response Principles

- **User messages take priority over Heartbeat** — Responds immediately when user reaches out
- **Instructions are executed right away** — But confirms before proceeding with costly changes
- **Status reports are concise** — Detailed content provided via links (Dashboard, Meeting Minutes, etc.)
- **Honest about unknowns** — "I'll check and report back" is acceptable
- **All conversations are logged** — Saved in Decision Log with "user instruction" tag
- **No excessive autonomous judgment** — Only executes what the user explicitly stated; no overinterpretation

### 4.9 Notification & Reporting

- **Slack/Discord Integration**: Auto-report key decisions
- **Daily Digest**: Daily activity summary report based on Daily Work Log
- **Alert**: Immediate notification for urgent matters (goal deviation, errors, budget overrun, etc.)
- **Weekly Report**: Comprehensive weekly goal achievement rate, Agent activity, decision log

## 5. Architecture

### 5.1 System Architecture

```
┌─────────────────────────────────────────────────────────┐
│          Autopilot Team (Single Daemon Process)          │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Web Dashboard (:3000)                │    │
│  │         Goal / Ticket Board / Agent / Logs       │    │
│  └────────────────────────┬────────────────────────┘    │
│                           │ REST API / WebSocket        │
│  ┌────────────────────────▼────────────────────────┐    │
│  │              Core Engine                         │    │
│  │  ┌───────────┐ ┌───────────┐ ┌──────────────┐  │    │
│  │  │ Heartbeat │ │   Goal &  │ │   Agent      │  │    │
│  │  │ Scheduler │ │  Ticket   │ │   Registry   │  │    │
│  │  │ (built-in)│ │  Manager  │ │ (Soul/config)│  │    │
│  │  └─────┬─────┘ └─────┬─────┘ └──────┬───────┘  │    │
│  │        └──────────────┼──────────────┘          │    │
│  │  ┌────────────────────▼────────────────────┐    │    │
│  │  │           Orchestrator                   │    │    │
│  │  │  - Ticket Planning & Assignment          │    │    │
│  │  │  - Debate Facilitation                   │    │    │
│  │  │  - PR Creation & Merge Control           │    │    │
│  │  └────────────────────┬────────────────────┘    │    │
│  │                       │                          │    │
│  │  ┌────────────────────▼────────────────────┐    │    │
│  │  │      LLM Provider Layer (Multi)          │    │    │
│  │  │  ┌────────┐ ┌────────┐ ┌────────┐       │    │    │
│  │  │  │ Claude │ │ OpenAI │ │ Ollama │ ...   │    │    │
│  │  │  └────────┘ └────────┘ └────────┘       │    │    │
│  │  └────────────────────┬────────────────────┘    │    │
│  │                       │                          │    │
│  │  ┌────────────────────▼────────────────────┐    │    │
│  │  │         Tool Layer (self-implemented)    │    │    │
│  │  │  File ops / Git / Terminal / GitHub API  │    │    │
│  │  └─────────────────────────────────────────┘    │    │
│  └──────────────────────────────────────────────────┘    │
│                                                         │
│  ┌────────────────────────────────────────────────┐     │
│  │            Integration Layer                    │     │
│  │  ┌──────┐ ┌───────┐ ┌───────┐ ┌───────────┐  │     │
│  │  │Slack │ │Discord│ │GitHub │ │Jira/Linear│  │     │
│  │  └──────┘ └───────┘ └───────┘ └───────────┘  │     │
│  └────────────────────────────────────────────────┘     │
│                                                         │
│  ┌────────────────────────────────────────────────┐     │
│  │            Data Layer (.autopilot/)             │     │
│  │  SQLite + Markdown docs (logs, minutes, Soul, etc.)│  │
│  └────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Tech Stack (Proposed)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Runtime | Node.js (TypeScript) | Single daemon process, async processing |
| Dashboard | Next.js + Tailwind (built-in) | Fast dashboard, localhost:3000 |
| LLM Provider | Anthropic SDK / OpenAI SDK / Ollama | Multi-Provider, swappable |
| Tool: File | Node.js fs + chokidar | File CRUD + change detection |
| Tool: Git | simple-git + octokit | Git operations + GitHub PR creation |
| Tool: Terminal | child_process (execa) | Test, build, lint execution |
| Database | SQLite (better-sqlite3) | Lightweight, no server needed, local storage |
| Scheduler | node-cron (built-in) | Heartbeat implementation |
| Notification | Slack SDK / Discord.js / Webhook | Notifications |

### 5.3 Core Data Model

```typescript
// Goal: Long-term objective
interface Goal {
  id: string;
  title: string;
  description: string;
  metrics: Metric[];           // Measurable indicators
  targetDate?: Date;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'active' | 'paused' | 'achieved' | 'abandoned';
  subGoals: Goal[];            // Sub-goals
}

// Agent: Team member
interface Agent {
  id: string;
  name: string;
  role: string;                // 'backend' | 'frontend' | 'designer' | 'pm' | ...
  roleGroupId: string;         // Same role group ID (min 2 in same group)
  soul: AgentSoul;             // This Agent's soul
  providerId: string;          // LLM Provider to use
  model: string;               // Model to use
  status: 'active' | 'idle' | 'working' | 'fired';
  currentTicket?: string;      // Currently working ticket
  requiredCredentials: CredentialRequest[];
}

// AgentSoul: Agent's complete identity
interface AgentSoul {
  // SOUL.md — Values, personality (user-editable only)
  coreIdentity: string;        // "You're a 10-year backend engineer..."
  values: string[];            // Core values list
  opinions: string[];          // Unique opinions/perspectives
  boundaries: string[];        // Boundaries (what to do and not do)
  debateStyle: string;         // Debate style description

  // IDENTITY.md — External expression
  identity: {
    icon: string;              // Emoji icon
    vibe: string;              // One-line vibe description
    roleDisplay: string;       // Display role name
    color: string;             // Representative color
  };

  // MEMORY.md — Personal memory (Agent self-updates)
  memory: {
    learnedPatterns: string[];   // Patterns learned from experience
    preferences: string[];       // Things that became preferred
    pastDecisions: string[];     // Past decisions participated in
  };

  // SKILLS.md — Technical ability
  skills: {
    technical: string[];       // Tech stack
    tools: string[];           // Available tools
    limitations: string[];     // Limitations/cannot do
  };

  // Tendency sliders (Quick Tuning)
  tendencies: {
    conservative_adventurous: number;  // 0~100 (Conservative ↔ Adventurous)
    theoretical_practical: number;     // 0~100 (Theoretical ↔ Practical)
    independent_collaborative: number; // 0~100 (Independent ↔ Collaborative)
  };
}

// Credential: External resource access permission
interface CredentialRequest {
  id: string;
  service: string;             // 'google-analytics' | 'github' | 'slack' | 'database' | ...
  description: string;         // "GA read permission for MAU tracking"
  requiredFields: string[];    // ['api_key', 'property_id']
  status: 'pending' | 'provided' | 'expired' | 'declined';
  providedAt?: Date;
  // Actual credential values are stored separately in encrypted storage (not stored in plaintext here)
}

// Task: Work for an Agent to perform
interface Task {
  id: string;
  goalId: string;              // Which Goal this Task is for
  title: string;
  description: string;
  assignee?: string;           // Agent ID
  priority: number;
  status: 'pending' | 'in_progress' | 'review' | 'done';
  createdBy: string;           // Usually Team Lead Agent
  debateLog?: DebateEntry[];   // Debate history
  result?: string;
}

// Ticket: Ticket (extension of Task — PR-based deliverable)
interface Ticket {
  id: string;
  goalId: string;
  title: string;
  description: string;
  assignedAgents: string[];      // Assigned Agent IDs
  priority: 'P1' | 'P2' | 'P3';
  status: 'backlog' | 'in_progress' | 'verification' | 'pr_review' | 'done';
  branch?: string;               // Git branch name
  prNumber?: number;             // GitHub PR number
  prUrl?: string;                // PR URL
  prStatus?: 'open' | 'merged' | 'closed';
  verificationResult?: {
    qa: 'pass' | 'fail' | 'pending';
    customer: 'pass' | 'fail' | 'pending';
    attempts: number;            // Retry count
  };
  createdBy: string;
  createdAt: Date;
  completedAt?: Date;
}

// LLM Provider configuration
interface ProviderConfig {
  id: string;
  type: 'claude' | 'openai' | 'ollama' | 'gemini' | 'custom';
  apiKey?: string;               // Stored encrypted
  baseUrl?: string;              // Custom URL for Ollama, etc.
  defaultModel: string;          // Default model
  availableModels: string[];     // List of available models
}

// PR approval configuration
interface ApprovalConfig {
  mode: 'manual' | 'smart' | 'auto';
  smartRules?: {
    autoMergeMaxFiles: number;     // Auto-merge if file count is at or below this
    requireHumanForPaths: string[]; // Always require user approval for changes to these paths
    requireHumanForKeywords: string[]; // When keywords like auth, payment are included
  };
}

// Heartbeat: Autonomous check + report/proposal record
interface HeartbeatLog {
  id: string;
  timestamp: Date;
  summary: string;             // What was checked in this heartbeat
  proposals: Proposal[];       // Items proposed to user (Phase 1: approval required)
  reverseProposals: ReverseProposal[];  // Team Lead Reverse Proposals (ideas/improvements)
  tasksApproved: string[];     // Task IDs executed after user approval
  tasksModified: string[];     // Modified Task IDs
  approvalStatus: 'pending' | 'approved' | 'partial' | 'rejected';
  nextHeartbeat: Date;
}

// Proposal: Team Lead's proposal (requires user approval)
interface Proposal {
  id: string;
  type: 'new_ticket' | 'priority_change' | 'escalation' | 'idea';
  title: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected' | 'deferred';
  approvedAt?: Date;
}

// ReverseProposal: Ideas the Team Lead proposes upward
interface ReverseProposal {
  id: string;
  title: string;               // "API response time optimization proposal"
  reason: string;              // Why this is needed
  expectedImpact: string;      // Expected impact
  status: 'pending' | 'approved' | 'rejected' | 'deferred';
}

// Debate: Debate record
interface DebateEntry {
  round: number;
  agent: string;
  position: string;            // Argument
  reasoning: string;           // Rationale
  rebuttal?: string;           // Rebuttal
}

// Meeting: Full team meeting
interface TeamMeeting {
  id: string;
  type: 'regular' | 'emergency';
  calledBy: string;            // Usually Team Lead
  agenda: string;              // Agenda
  trigger?: string;            // Reason for convening (heartbeat detection, escalation, etc.)
  participants: string[];      // Participating Agent IDs
  pairSummaries: PairSummary[];  // Pre-debate results from each role Pair
  crossDebate: DebateEntry[];    // Cross-functional debate history
  decisions: Decision[];
  actionItems: ActionItem[];
  humanVeto?: boolean;         // Whether user exercised veto
  createdAt: Date;
}

// PairSummary: Opinion organized by each role Pair before the meeting
interface PairSummary {
  role: string;                // 'backend' | 'frontend' | ...
  agents: string[];            // Pair Agent IDs
  consensus: string;           // Agreed opinion (or deadlock indication)
  keyPoints: string[];         // Key discussion points
}

// ActionItem: Action items decided in the meeting
interface ActionItem {
  description: string;
  assignedTo: string;          // Agent ID
  deadline?: Date;
  relatedTaskId?: string;      // Linked to created Task
}

// WorkLog: Daily work record
interface WorkLog {
  id: string;
  date: string;                // YYYY-MM-DD
  agentId: string;
  entries: WorkLogEntry[];
  summary: string;             // Auto-generated daily summary by AI
}

interface WorkLogEntry {
  timestamp: Date;
  taskId: string;
  action: 'started' | 'progressed' | 'completed' | 'blocked';
  description: string;         // What was done
  decisions?: string[];        // Decisions made during this process
  tokensUsed: number;
}

// DecisionRecord: Decision history
interface DecisionRecord {
  id: string;
  title: string;               // "Decided on Redis for cache strategy"
  what: string;                // What was decided
  why: string;                 // Why it was decided that way
  alternatives: string[];      // Alternatives that were considered
  evidence: string[];          // Evidence (data, research, etc.)
  madeBy: string;              // Agent ID or 'team_meeting'
  relatedTaskId?: string;
  relatedMeetingId?: string;
  createdAt: Date;
}

// KnowledgeEntry: Accumulated knowledge
interface KnowledgeEntry {
  id: string;
  category: 'architecture' | 'pattern' | 'failure' | 'research' | 'context';
  title: string;
  content: string;
  learnedFrom?: string;        // Which Task/Meeting this knowledge came from
  createdBy: string;
  updatedAt: Date;
}

// Escalation: User intervention request
interface Escalation {
  id: string;
  type: 'resource_access' | 'cost_gate' | 'decision_deadlock' | 'alert';
  title: string;
  description: string;
  options?: string[];          // Options to present to the user
  requestedBy: string;         // Agent ID (usually Team Lead)
  status: 'pending' | 'resolved' | 'timeout';
  userResponse?: string;
  blockedTasks: string[];      // Task IDs waiting due to this escalation
  createdAt: Date;
  resolvedAt?: Date;
}
```

## 6. User Journey

### 6.1 Initial Setup (First Time)

**Example A: Business Goal**
```
1. User creates "New Team" on Dashboard
2. Team persona setup:
   - Team name: "Upvy Growth Team"
   - Context: "Upvy is a real estate community app. Current MAU is 12K..."
3. Goal setup:
   - "Achieve 50K MAU within 3 months"
   - Metrics: MAU, DAU, D7 Retention
4. AI recommends necessary Agents:
   - "This goal requires 1 Planning Agent, 2 Backend Agents,
      and 1 Marketing Agent. Shall I hire them?"
5. User approves → Agents hired → Autonomous operation begins
```

**Example B: Engineering Goal**
```
1. User creates "New Team" on Dashboard
2. Team persona setup:
   - Team name: "ShopMall Architecture Team"
   - Context: "ShopMall is a Spring Boot monolith. 12 domains coupled in a single app."
3. Goal setup:
   - "Convert monolith to MSA within 3 months"
   - Metrics: Number of separated services, test coverage, build time, coupling
4. AI recommends necessary Agents:
   - "This goal requires 2 Backend Agents, 1 DevOps Agent,
      and 1 QA Agent. Shall I hire them?"
5. User approves → Agents hired → Autonomous operation begins
```

### 6.2 Daily Operations

```
1. Heartbeat runs every 30 minutes for status checks + report generation
2. Team Lead delivers report + proposals to user
   → If new tickets are needed, included as proposals (not auto-created)
   → If ideas/improvements found, included as Reverse Proposals
3. User approves/modifies/rejects proposals
4. Approved tickets are executed autonomously by Agents (no user intervention needed)
5. Agent work → QA verification → Customer verification → PR creation (autonomous)
6. Important decisions/completions → Reported via Dashboard + Slack/Discord
7. User monitors progress on Dashboard
8. Uses Direct Channel to give direction/corrections to Team Lead when needed
```

### 6.3 When Intervention is Needed (Escalation)

Situations requiring user intervention fall into **4 major categories:**

```
┌─────────────────────────────────────────────────────────────┐
│  🔐 Resource Access                                          │
│  ├ External service credentials needed when hiring Agents    │
│  ├ New API/DB/service access permissions needed              │
│  └ Existing credential expiration/renewal needed             │
│                                                             │
│  💰 Cost Gate                                                │
│  ├ Daily/monthly token budget threshold reached              │
│  ├ Pre-approval before executing high-cost tasks             │
│  └ Approval for cost increase due to hiring new Agents       │
│                                                             │
│  🤝 Decision Deadlock                                        │
│  ├ No consensus after N rounds in Pair Debate                │
│  ├ Pair strongly opposes Team Lead's decision                │
│  ├ No conclusion even in full team meeting                   │
│  └ Strategic decisions like goal direction changes            │
│                                                             │
│  🚨 Alert                                                    │
│  ├ Goal achievement rate dropping sharply                     │
│  ├ External API errors/outages                               │
│  └ Agent produced unexpected results                         │
└─────────────────────────────────────────────────────────────┘
```

**Escalation Delivery Methods:**
- **UI Dashboard**: Immediately displayed with banner + notification badge
- **Slack/Discord**: Detailed content sent with mention (@)
- **Awaiting user response**: The affected work is paused until response arrives; other work continues

## 7. Cost Management Strategy

### 7.1 Cost Structure

Autopilot Team itself is **open-source/locally-run**, so there is no additional cost.
Costs depend entirely on **the LLM Provider the user chooses**.

- **Claude API / OpenAI**: Token-based billing (per Provider pricing policy)
- **Ollama (Local)**: Free (hardware costs only)
- **Other Providers**: Per each service's pricing policy

Since Provider costs depend on user choices and usage, we do not present uniform cost estimates.
Instead, we focus on **strategies to optimize costs**.

### 7.2 Cost Optimization Strategies

| Strategy | Description |
|------|------|
| **Adaptive Heartbeat** | Increase interval when changes are few (30min → 2h) |
| **Tiered Models** | Lightweight models for simple judgments, high-performance models for critical decisions |
| **Multi-Provider Utilization** | Provider/model combinations optimized for task characteristics (cost-efficiency) |
| **Idle Detection** | Agents with nothing to do automatically sleep |
| **Token Budget** | Set token budgets per Goal/per day |
| **Batch Processing** | Process non-urgent Tasks in batches |
| **Local Model Integration** | Handle simple tasks with local models like Ollama (zero cost) |

## 8. MVP Scope

### Phase 1: Core (6 weeks)

- [ ] Standalone daemon (`npm install -g autopilot-team` → `autopilot-team start`)
- [ ] Built-in Web Dashboard (Goal, Ticket Board, Agent settings)
- [ ] Multi-Provider LLM Layer (Claude + OpenAI first)
- [ ] Tool Layer (file operations, Git, Terminal)
- [ ] Goal → Ticket decomposition + user approval flow (CEO↔PM model)
- [ ] Autonomous execution of approved tickets → PR creation
- [ ] PR approval modes (Manual / Smart / Auto)
- [ ] Self-Verification Loop (QA + Customer)
- [ ] Heartbeat "Notification + Proposal" mode (Phase 1: report + propose, not autonomous execution)
- [ ] Team Lead Reverse Proposal feature (propose ideas/improvements to user)
- [ ] Agent Soul system (SOUL / IDENTITY / MEMORY / SKILLS)
- [ ] Direct Channel (User ↔ Team Lead)
- [ ] Activity Log

### Phase 2: Expansion (+4 weeks)

- [ ] Ollama / local model support
- [ ] Debate system (Debate / Smart Mode)
- [ ] GitHub Issues / Jira / Linear integration
- [ ] Slack / Discord notifications
- [ ] Documentation automation (Daily Log, Meeting Minutes)
- [ ] Cost tracking dashboard

### Phase 3: Future

- [ ] Team Meeting system (cross-functional meetings)
- [ ] A/B test auto-design/analysis
- [ ] Multi-team support
- [ ] Plugin system (custom skills)
- [ ] User community (team template sharing)
- [ ] DevOps Agent (CI/CD, deployment automation)

## 9. Competitive Positioning

```
                    Task-Oriented ←──────→ Goal-Oriented
                         │                      │
  Single Agent ──── Personal AI                 │
                    Assistants                   │
                         │                      │
                    Multi-Agent                  │
  Multi Agent ──── Frameworks            ★ Autopilot Team ★
                    Code-Based Orchestrators     │
                         │                      │
                    One-shot ←────────→ Persistent/Autonomous
```

**Autopilot Team sits at the intersection of "Goal-Oriented + Multi-Agent + Persistent,"
and there are currently no direct competitors at this position.**

**Core Positioning: "Verified Autonomy"**
- Plans require user approval → Execution is autonomous → Results are QA+Customer verified
- Gradual trust-based autonomy through the CEO↔PM relationship
- Build trust in Phase 1, expand autonomy scope in Phase 2+

## 10. Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| High API costs | High | 3-tier modes (Lean/Smart/Debate), Adaptive heartbeat, model tiering, Multi-Provider |
| Unstable Agent code quality | High | QA Agent + Customer Agent Self-Verification Loop |
| Hallucination-based wrong code | High | Verified through automated test execution; rework if tests fail |
| Agent direction drift | Medium | User can immediately correct direction via Direct Channel |
| Security-vulnerable code generation | Medium | QA Agent security scan + security guidelines included in SOUL |
| Complex UX | Medium | Lean Mode as default. Progressive disclosure |
| LLM API outage | Medium | Retry logic, state preservation, Multi-Provider fallback |
| Platform lock-in | Low | Fundamentally prevented by Multi-Provider architecture |

## 11. Project Name Options

| Name | Meaning |
|------|------|
| **Autopilot Team** | Autonomously operating team (intuitive) |
| **Hivemind** | Collective intelligence (emphasizing AI team collaboration) |
| **Crewpilot** | Crew + Autopilot compound (autonomous crew) |
| **AgentForge** | A forge for building and combining Agents |
| **TeamPulse** | Team + Heartbeat (pulse) |

---

*Created: 2026-02-11*
*Status: Planning Phase*
*Author: Human + Claude*
