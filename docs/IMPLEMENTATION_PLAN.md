# Phalanx - Implementation Plan

> Date: 2026-02-11
> Based on: PLANNING.md specification + OpenClaw/oh-my-opencode reference analysis

---

## Table of Contents

1. [Architecture Design](#1-architecture-design)
2. [Technology Stack](#2-technology-stack)
3. [Core Module Implementation Plan](#3-core-module-implementation-plan)
4. [Team Conventions System](#4-team-conventions-system)
5. [Reference Code Utilization Strategy](#5-reference-code-utilization-strategy)
6. [Phase 1 MVP Detailed Implementation Roadmap](#6-phase-1-mvp-detailed-implementation-roadmap)
7. [Directory Structure](#7-directory-structure)
8. [Core Interface Design](#8-core-interface-design)
9. [Cost Optimization Strategy](#9-cost-optimization-strategy)
10. [Risk Mitigation Strategy](#10-risk-mitigation-strategy)

---

## 1. Architecture Design

### 1.1 Overall System Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    phalanx daemon                     │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Web Dashboard (:3000)                    │   │
│  │  Next.js + Tailwind (Goal, Ticket Board, Agent,      │   │
│  │  Direct Channel, Activity Log, Soul Editor)           │   │
│  └──────────────┬───────────────────────────────────────┘   │
│                 │ REST/WebSocket API                         │
│  ┌──────────────┴───────────────────────────────────────┐   │
│  │              Core Engine                              │   │
│  │  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐  │   │
│  │  │  Heartbeat   │ │  Goal &      │ │   Agent      │  │   │
│  │  │  Scheduler   │ │  Ticket Mgr  │ │   Registry   │  │   │
│  │  └─────────────┘ └──────────────┘ └──────────────┘  │   │
│  └──────────────┬───────────────────────────────────────┘   │
│                 │                                            │
│  ┌──────────────┴───────────────────────────────────────┐   │
│  │              Orchestrator (LLM-Enhanced)               │   │
│  │  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐  │   │
│  │  │  Smart       │ │  Agent       │ │  Model       │  │   │
│  │  │  Assignment  │ │  Configurator│ │  Selector    │  │   │
│  │  │  (LLM)       │ │  (LLM)       │ │  (rules)     │  │   │
│  │  └─────────────┘ └──────────────┘ └──────────────┘  │   │
│  │  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐  │   │
│  │  │  Scheduler   │ │  Verification│ │  PR Control  │  │   │
│  │  │  + Queue     │ │  Loop        │ │  (3 modes)   │  │   │
│  │  └─────────────┘ └──────────────┘ └──────────────┘  │   │
│  └──────────────┬───────────────────────────────────────┘   │
│                 │                                            │
│  ┌──────────────┴───────────────────────────────────────┐   │
│  │              LLM Provider Layer                       │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │   │
│  │  │Anthropic│ │ OpenAI │ │ Ollama │ │ Gemini │ ...    │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘        │   │
│  │  Model Resolver + Fallback + Rate Limit Cooldown     │   │
│  │  Thinking Level Control (off/low/medium/high)        │   │
│  └──────────────┬───────────────────────────────────────┘   │
│                 │                                            │
│  ┌──────────────┴───────────────────────────────────────┐   │
│  │              Tool Layer                               │   │
│  │  File Ops │ Git │ Terminal │ GitHub API │ Code AST    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Data Layer                               │   │
│  │  SQLite (tickets, agents, logs) + Markdown (docs)     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Core Design Principles (Patterns Validated from References)

| Principle | Source | Application |
|-----------|--------|-------------|
| Hub-and-spoke Orchestration | OpenClaw Gateway, oh-my-opencode Atlas | Team Lead as hub, each Agent as spoke |
| Category-based Routing | oh-my-opencode delegate-task | Task distribution by role/category, not model name |
| Notepad Verification Protocol | oh-my-opencode Atlas hook | Used in Self-Verification Loop |
| 5-step Model Resolution Pipeline | oh-my-opencode | Automatic optimal model selection per Agent |
| Thinking Level Control | oh-my-opencode + OpenClaw /think | Cost optimization based on task importance |
| SOUL/IDENTITY Separation | OpenClaw agent workspace | Agent identity system |
| safeCreate Pattern | oh-my-opencode safeCreateHook | Individual component failure isolation |
| State Machine-based Task Management | oh-my-opencode BackgroundManager | Ticket lifecycle management |

---

## 2. Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Runtime** | Node.js 22+ (TypeScript) | Same as references. Optimal for LLM SDK ecosystem |
| **Package Manager** | pnpm | Monorepo support, disk efficiency |
| **Dashboard** | Next.js 15 + Tailwind CSS | Specified in planning doc. SSR + API routes integration |
| **LLM SDK** | @anthropic-ai/sdk, openai, @google/genai | Direct use of official SDKs |
| **Database** | better-sqlite3 + drizzle-orm | Local installation, zero config, type safety |
| **Git** | simple-git | Specified in planning doc. Standard library |
| **GitHub** | octokit | PR creation/review/merge |
| **Terminal** | execa | Safer execution compared to child_process |
| **Scheduler** | node-cron | Heartbeat implementation |
| **File Watch** | chokidar | Real-time change detection |
| **Code Analysis** | ts-morph | AST-based code analysis |
| **Schema Validation** | zod | oh-my-opencode validation pattern. Runtime type safety |
| **CLI** | commander.js | Same as oh-my-opencode. Standard |
| **Build** | tsup (esbuild) | Fast builds |
| **Test** | vitest | Same as oh-my-opencode |
| **Notifications** | @slack/web-api, discord.js | Specified in planning doc |

---

## 3. Core Module Implementation Plan

### 3.1 LLM Provider Layer

**Reference:** oh-my-opencode's 5-step model resolution + OpenClaw's Model Resolver

```
Resolution Priority:
1. Ticket-level model override
2. Model specified in Agent config
3. Role default model (Team Lead → Opus, QA → Haiku, etc.)
4. Provider fallback chain
5. System default
```

**Core Features:**
- **Unified Interface**: Wrap all providers with a consistent interface
- **Thinking Level Control**: off/low/medium/high (auto-adjusted based on task importance)
  - Team Lead's Goal decomposition: `high` (accuracy matters)
  - Backend Agent code writing: `medium`
  - QA lint checks: `low`
  - Simple file reads: `off`
- **Fallback Chain**: Automatic switch on primary provider failure
- **Rate Limit Cooldown**: oh-my-opencode pattern - auto cooldown for rate-limited keys
- **Token Budget Tracking**: Track token usage per day/Goal

**Key Cost Reduction - Leveraging Provider's Plan/Thinking Capabilities:**
- Claude Extended Thinking → Control thinking cost via budget_tokens parameter
- OpenAI reasoning models → Used for complex decomposition tasks
- Using LLM's native thinking capabilities is cheaper than building a separate "planning agent"

### 3.2 Tool Layer

**Reference:** OpenClaw createOpenClawCodingTools + oh-my-opencode tools/

| Tool | Implementation | Security |
|------|---------------|----------|
| file_read | fs.readFile | Restricted to project directory |
| file_write | fs.writeFile | Restricted to project directory |
| file_edit | diff-match-patch | Atomic edits |
| git_* | simple-git | Branch isolation |
| terminal_exec | execa | Timeout + allowlist |
| github_pr | octokit | Token-based authentication |
| code_analyze | ts-morph | Read-only |

**Tool Permission System (based on OpenClaw pattern):**
- Allow/deny list per Agent Role
- Team Lead: All tools (but terminal_exec is restricted)
- QA Agent: file_read + terminal_exec (test commands only) + code_analyze
- Customer Agent: file_read + code_analyze (read-only)

### 3.3 Agent System

**Reference:** OpenClaw SOUL.md + oh-my-opencode agent definitions

**Agent Configuration Files (4 files):**
```
agents/{agent-id}/
├── SOUL.md        # Identity, values, opinions (user-editable)
├── IDENTITY.md    # Name, icon, color (user-editable)
├── MEMORY.md      # Learned content (auto-updated by agent)
└── SKILLS.md      # Tech stack, available tools (system-generated)
```

**Agent Execution Loop (oh-my-opencode pattern):**
```
1. Construct System Prompt (SOUL + IDENTITY + SKILLS + CONVENTIONS + Ticket Context)
2. LLM API call (with tool definitions)
3. Response = text → complete
4. Response = tool call → execute tool → add result to conversation → return to step 2
5. Error occurs → pass error to model (as result, not exception) → model attempts recovery
6. Max iterations exceeded → escalate to user
```

### 3.4 Goal & Ticket Manager

**Reference:** oh-my-opencode Prometheus → plan → Atlas execution pattern

#### 3.4.1 Team Lead vs Orchestrator: Role Separation

| Aspect | Team Lead (PM Agent) | Orchestrator (LLM-Enhanced Engine) |
|--------|---------------------|-----------------------------------|
| **Nature** | LLM-powered AI agent | LLM reasoning + system code hybrid |
| **Focus** | What to do (planning) | Who & How to execute |
| **Goal Decomposition** | Goal → Epic → Ticket (LLM) | — |
| **Agent Assignment** | — | LLM-based ticket analysis → optimal agent selection/creation |
| **Agent Creation** | — | LLM generates custom SOUL/SKILLS per ticket |
| **Model Selection** | — | Complexity-based optimal Provider/Model |
| **Heartbeat** | Context analysis + report generation | Scheduler management |
| **Proposals** | Generate proposals (LLM) | Execute approved proposals |
| **Verification** | — | QA verification pipeline |
| **PR Control** | — | PR creation + merge decisions |
| **User Communication** | Direct Channel conversations | — |

#### 3.4.2 Goal → Ticket Decomposition Process (CEO↔PM Model)

**Goal → Ticket Decomposition Process (CEO↔PM Model):**
```
1. User (CEO) inputs Goal (e.g., "Complete MVP shopping mall within 3 weeks")
2. Team Lead (PM) analyzes Goal (Thinking Level: HIGH)
   - Extract technical requirements
   - Generate dependency graph
   - Determine priorities
3. First-level decomposition into Epics (e.g., "Auth System", "Product Management", "Payments")
4. Second-level decomposition: Epic → Tickets (actionable units)
5. Submit decomposition result to user → await approval
   - [Approve All] [Modify & Approve] [Reject]
6. After user approval → Tickets enter Orchestrator queue
7. Orchestrator performs LLM-powered smart assignment (see 3.4.3)
8. Save to SQLite + reflect on Dashboard → autonomous execution begins

* Already approved Tickets are executed autonomously by Agents (no user intervention needed)
* Team Lead can also make Reverse Proposals ("How about we also do this?" → execute after user approval)
```

#### 3.4.3 Orchestrator: LLM Smart Assignment & Agent Auto-Creation

The Orchestrator uses LLM reasoning (Thinking Level: LOW for cost optimization) to analyze each ticket and determine the optimal agent configuration.

**Smart Assignment Flow:**
```
Ticket enters queue
    ↓
[Orchestrator LLM Analysis] (Thinking: LOW, cost-optimized)
    ├── Analyze ticket requirements (tech stack, complexity, domain)
    ├── Select best candidate from existing idle agents
    │   └── No match: Create new agent with optimized SOUL/SKILLS
    ├── Select Provider/Model based on complexity
    │   ├── High complexity → Opus / GPT-4o
    │   ├── Medium complexity → Sonnet / GPT-4o-mini
    │   └── Low complexity → Haiku / Ollama
    └── Configure tool permissions (security policy applied)
    ↓
Agent configured and assigned → execution begins
```

**Core Components:**

| Component | Responsibility |
|-----------|---------------|
| `SmartAssignmentService` | LLM analyzes ticket → selects/creates optimal agent |
| `AgentConfigurator` | LLM generates custom SOUL/SKILLS per ticket |
| `ModelSelector` | Complexity-based Provider/Model selection |
| `OrchestratorScheduler` | Periodic queue processing with start/stop lifecycle |

**SmartAssignmentService Interface:**
```typescript
interface TicketAnalysis {
  requiredRole: AgentRole;
  techStack: string[];           // e.g., ['TypeScript', 'Stripe', 'PostgreSQL']
  complexity: 'low' | 'medium' | 'high';
  requiredTools: string[];       // e.g., ['file_write', 'terminal_exec']
  domain: string;                // e.g., 'payment', 'auth', 'frontend-ui'
  specializations: string[];     // e.g., ['API design', 'security']
}

interface AssignmentResult {
  agentId: string;
  isNewAgent: boolean;
  selectedModel: ResolvedModel;
  reasoning: string;             // LLM's assignment rationale
}
```

**Cost Optimization:**
- Assignment analysis uses Thinking Level: LOW (minimal cost)
- Skip LLM call when simple category matching suffices (fallback logic)
- Cache analysis results for same-domain tickets

**Ticket State Machine (oh-my-opencode BackgroundManager pattern + CEO↔PM approval):**
```
PENDING_APPROVAL → (user approval) → BACKLOG → ASSIGNED → IN_PROGRESS → VERIFICATION → DONE
      ↓                                              ↘                    ↗
  (rejected) → REJECTED                                → FAILED → RETRY →
                                                                   ↓
                                                              ESCALATED (to user)
```

### 3.5 Self-Verification Loop

**Reference:** oh-my-opencode Atlas notepad verification protocol

```
1. Agent completes code writing
2. QA Agent verification:
   a. Run unit tests (terminal_exec)
   b. lint + type check (terminal_exec)
   c. Code review (LLM-based, Thinking: LOW)
3. Customer Agent verification (optional in Phase 1):
   a. Verify implementation against requirements (LLM-based)
   b. UX perspective review
4. Record results → Notepad pattern:
   - learnings.md (discovered patterns)
   - issues.md (discovered issues)
   - verification.md (test results)
5. PASS → create PR
6. FAIL → feedback to original Agent + retry (max N times)
7. Max exceeded → ESCALATED
```

### 3.6 Heartbeat System

**Reference:** OpenClaw HEARTBEAT.md + node-cron

**Phase 1: "Notification + Proposal" Mode (CEO↔PM Model)**

The Heartbeat operates at the level of **reporting + proposals**, not autonomous execution.
New actions must be approved by the user before execution. Already approved tickets continue to execute autonomously.

```
Heartbeat Cycle (Phase 1):
1. Wake (default 30-minute interval)
2. Context Check (autonomous analysis):
   - Check status of in-progress Tickets
   - Check completed Tickets
   - Detect failed/stalled Tickets
   - Detect codebase changes
3. Generate Report + Proposals (autonomous judgment):
   - Summary of current progress
   - If new Ticket needed → include as proposal (not auto-created)
   - If priority change needed → include as proposal
   - If improvement idea discovered → include as Reverse Proposal
4. Report to user (Dashboard + Slack/Discord):
   - Heartbeat Report (status summary + list of proposals)
   - [Approve All] [Review Individually] [Later]
5. Process user response:
   - Approved proposals → execute immediately
   - Not approved → defer until next Heartbeat
   - Existing approved Tickets continue autonomous execution
6. Sleep

Autonomous vs Approval Required (Phase 1):
  Autonomous: Execute approved Tickets, QA/Customer verification, Smart Mode PR merge
  Requires Approval: New Ticket creation, priority changes, Agent hire/fire, Reverse Proposal execution

Phase 2+: Gradual autonomy expansion after trust accumulation
  → Low-risk actions become autonomous, only high-risk requires approval

Adaptive Interval:
- Active changes: 15 minutes
- Normal: 30 minutes
- Low activity: 1 hour
- Minimal activity: 2 hours
```

### 3.7 PR Control System

**Three modes:**

| Mode | Behavior | Use Case |
|------|----------|----------|
| Manual | All PRs → user review required | Initial trust-building phase |
| Smart | Rule-based auto/manual classification | Recommended default |
| Auto | QA+Customer PASS → auto merge | High trust phase |

**Smart Mode Rules (configurable):**
```typescript
const autoMergeRules = {
  maxFilesChanged: 5,
  forbiddenPaths: ['auth/', 'payment/', 'config/', 'migration/'],
  requireAllTestsPass: true,
  requireQAApproval: true,
  forbiddenKeywords: ['password', 'secret', 'key', 'token'],
  requireNoNewDependencies: true,
};
```

### 3.8 Team Conventions System

**Concept:** Team Lead automatically generates team conventions after analyzing the project, and all Agents reference them to maintain consistency. The user (human) can edit conventions directly at any time.

**Reference:** Claude Code's CLAUDE.md, OpenClaw's AGENTS.md, oh-my-opencode's `.sisyphus/learnings.md`

**How it differs from existing tools:**
- Existing: Humans write convention files manually
- Phalanx: Team Lead auto-generates after codebase analysis → humans only modify/approve

#### 3.8.1 Convention File Structure

```
.phalanx/
├── CONVENTIONS.md       # Team conventions (code style, Git rules, naming, etc.)
├── ARCHITECTURE.md      # Architecture decisions (patterns, folder structure, dependency rules)
└── STYLE.md             # Detailed code style (language-specific rules, formatting)
```

#### 3.8.2 CONVENTIONS.md Example

```markdown
# Team Conventions
> Auto-generated by Team Lead | Last updated: 2026-02-11
> Human-editable: YES (via Dashboard or direct editing)

## Git
- Branch: feature/{ticket-id}-{slug}, fix/{ticket-id}-{slug}
- Commit: conventional commits (feat:, fix:, refactor:, test:)
- PR: Title under 70 characters, include ticket ID in body

## Code Style
- Language: TypeScript strict mode
- Naming: camelCase (variables/functions), PascalCase (types/classes)
- Files: kebab-case.ts
- Patterns: Repository Pattern for DB, Factory for services

## Testing
- Minimum coverage: 70%
- Naming: describe("UserService") > it("should return user by id")
- E2E: Playwright

## Architecture
- API: REST, /api/v1 prefix
- Error: Unified { code, message, details } format
- Auth: JWT with refresh token

## Dependencies
- New package additions require Team Lead approval
- Consider bundle size: use individual utility functions instead of lodash
```

#### 3.8.3 Convention Generation Process

```
During project initialization (autopilot-team init):
1. Team Lead scans the existing codebase
   - package.json (language, framework, linter settings)
   - Analyze existing .eslintrc, .prettierrc, tsconfig.json
   - Analyze folder structure patterns
   - Extract naming patterns from existing code (ts-morph AST analysis)
   - Analyze commit message patterns from Git history
2. Auto-generate CONVENTIONS.md draft from analysis results
3. Present draft to user on Dashboard → modify/approve
4. Save to .phalanx/ directory after approval
```

#### 3.8.4 Convention Application Flow

```
For each Ticket execution:
1. Agent System Prompt construction:
   [SOUL.md] + [IDENTITY.md] + [SKILLS.md] + [CONVENTIONS.md] + [Ticket Context]
                                               ^^^^^^^^^^^^^^^^
                                               Injected into all Agents as shared context

2. QA Agent adds convention-based checks during verification:
   - Naming rule compliance
   - Git commit message format
   - Folder structure rules
   - Test coverage thresholds
   → Convention violation = Verification FAIL

3. During PR creation:
   - PR template follows CONVENTIONS.md PR rules
   - Branch name follows convention rules
```

#### 3.8.5 Convention Modification Permissions

| Action | User (Human) | Team Lead | Regular Agent |
|--------|:---:|:---:|:---:|
| Directly modify conventions | O | X | X |
| Propose convention changes | - | O (requires user approval) | X |
| Perform convention-based verification | - | O (instructs QA) | - |
| Override conventions | O | X | X |
| Read conventions | O | O | O |

**Scenarios for Team Lead Convention Change Proposals:**
```
1. When a recurring pattern is detected:
   "Same error pattern occurred 3+ times → propose adding a convention rule"
   Example: "Repeated pattern of swallowing errors in try-catch → propose mandatory error logging rule"

2. When code quality degradation detected during Heartbeat:
   "Test coverage below 50% in last 5 PRs → propose raising minimum coverage"

3. When new technology is introduced:
   "Prisma ORM introduced → propose adding related naming/structure conventions"
```

**Change Proposal Flow:**
```
Team Lead generates proposal
    ↓
Dashboard notification + Direct Channel message
    ↓
User review: [Approve] / [Modify & Approve] / [Reject]
    ↓
On approval, CONVENTIONS.md auto-updated
    ↓
Change history tracked via git commit
```

#### 3.8.6 Convention Change History Tracking

```
.phalanx/
├── CONVENTIONS.md              # Current conventions
├── ARCHITECTURE.md             # Current architecture decisions
├── STYLE.md                    # Current code style
└── history/                    # Change history
    └── conventions-changelog.md
```

**conventions-changelog.md example:**
```markdown
## 2026-02-15: Error Handling Rule Added
- **Proposed by:** Team Lead
- **Reason:** Backend Agent wrote empty catch blocks 3 times in a row
- **Change:** Added rule "logger.error() required in all catch blocks"
- **Approved:** User approved (2026-02-15 14:30)

## 2026-02-11: Initial Convention Generation
- **Proposed by:** Team Lead (auto-generated)
- **Reason:** Project initialization
- **Approved:** User approved (2026-02-11 10:00)
```

---

## 4. Team Conventions System

> Refer to Section 3.8 for detailed design. This section summarizes how conventions integrate across the entire system.

### Convention Integration Map

```
┌─────────────┐
│ CONVENTIONS │──────────────────────────────────────────┐
│ .md files   │                                          │
└──────┬──────┘                                          │
       │                                                 │
       ├──→ Agent System Prompt (injected into all Agents)
       │    → Convention compliance during code writing    │
       │                                                 │
       ├──→ QA Verification (used as verification criteria)
       │    → FAIL on convention violation                │
       │                                                 │
       ├──→ PR Controller (PR templates/branch rules)     │
       │    → Branch name, commit message, PR body format │
       │                                                 │
       ├──→ Goal Decomposition (referenced during Ticket creation)
       │    → Ticket design reflecting architecture decisions
       │                                                 │
       └──→ Dashboard (editing UI + change history view)  │
            → User can modify in real-time                │
```

---

## 5. Reference Code Utilization Strategy

### Patterns from oh-my-opencode

| Pattern | Source File | Application |
|---------|-------------|-------------|
| 5-step Model Resolution Pipeline | `tools/delegate-task/tools.ts` (~1,070 LOC) | LLM Provider Layer |
| BackgroundManager State Machine | `features/background-agent/manager.ts` (~1,500 LOC) | Ticket Manager |
| Notepad Verification Protocol | `hooks/atlas/index.ts` (~750 LOC) | Self-Verification Loop |
| Planning Triad Structure | `agents/prometheus-prompt.ts` (~1,200 LOC) | Goal → Ticket Decomposition |
| safeCreate Error Isolation | `index.ts` | All module initialization |
| context-window-monitor | `hooks/` | Agent Execution Loop |
| todo-continuation-enforcer | `hooks/` | Ticket Completion Guarantee |
| Category-based Routing | `tools/delegate-task/` | Agent Assignment |

### Patterns from OpenClaw

| Pattern | Source | Application |
|---------|--------|-------------|
| SOUL.md + IDENTITY.md System | `agents/workspace/` | Agent Soul System |
| HEARTBEAT.md | `agents/workspace/` | Heartbeat System |
| Model Resolver + Rate Limit | `providers/` | LLM Provider Layer |
| Tool Permission Hierarchy | `security/` | Tool Layer Security |
| Hub-and-spoke Gateway | `gateway/` | Core Engine |
| sessions_spawn | `sessions/` | Agent-to-Agent Delegation |

---

## 6. Phase 1 MVP Detailed Implementation Roadmap

### Week 1-2: Foundation

#### W1: Project Skeleton + LLM Provider Layer

**Goal:** A state where a single LLM call works

```
Day 1-2: Project Setup
- Initialize pnpm workspace
- Configure TypeScript + ESLint + Prettier
- Set up tsup build
- Set up vitest testing
- CLI entry point (commander.js)

Day 3-4: LLM Provider Layer
- Define Provider interface (generateText, generateCode, reviewCode)
- Implement AnthropicProvider (Claude API)
  - Extended Thinking support (budget_tokens)
  - Tool use support
- Implement OpenAIProvider
  - Chat Completions API
  - Function calling support
- Thinking Level system (off/low/medium/high)
- Verification: Test code generation with each provider

Day 5: Model Resolver
- Implement 5-step model resolution pipeline
- Provider fallback chain
- Rate limit cooldown logic
- Token usage tracking
- Verification: Test provider switching
```

#### W2: Tool Layer + Agent System

**Goal:** A state where Agents can read and write files using tools

```
Day 1-2: Tool Layer
- Define Tool interface
- Implement file_read, file_write, file_edit
- Implement git_* tools (simple-git)
- Implement terminal_exec (execa, timeout + sandboxing)
- Tool permission system (allow/deny per role)
- Verification: Unit tests for each tool

Day 3-4: Agent System
- Agent config loader (SOUL/IDENTITY/MEMORY/SKILLS.md)
- Implement Agent Execution Loop
  - System prompt construction
  - LLM call → Tool execution → result return loop
  - Error recovery (oh-my-opencode pattern)
  - Max iteration limit
- Default Agent Role templates (Team Lead, Backend, QA)
- Verification: Execute a simple code-writing task with an Agent

Day 5: Integration Testing
- Provider + Tool + Agent integration
- E2E test: Agent reads file → writes code → saves file
```

### Week 3-4: Core Engine

#### W3: Ticket System + Goal Decomposition

**Goal:** A state where a Goal input is decomposed into Tickets

```
Day 1-2: Data Layer
- SQLite schema design (drizzle-orm)
  - goals, epics, tickets (with approval_status), agents, activity_logs, token_usage, conventions
  - proposals (Heartbeat proposals), reverse_proposals (Team Lead Reverse Proposals)
  - heartbeat_logs (reports + approval status)
- Migration system
- CRUD services

Day 3: Team Conventions System
- Codebase analysis logic (package.json, eslint, tsconfig, git history)
- Auto-generation of CONVENTIONS.md / ARCHITECTURE.md / STYLE.md
- Convention loader (for Agent system prompt injection)
- User edits → file watch (chokidar) → instant reflection
- Verification: Test auto-generation of conventions on an existing project

Day 4: Goal → Ticket Decomposition + Approval Flow
- Configure Goal decomposition prompt for Team Lead Agent
  - Reference oh-my-opencode Prometheus pattern
  - Use Thinking Level: HIGH
- 3-level decomposition: Goal → Epic → Ticket
- Dependency graph generation
- Automatic priority determination
- Implement user approval flow for decomposition results (CEO↔PM Model)
  - Pending approval state (pending_approval)
  - [Approve All] [Modify & Approve] [Reject] UI
  - Autonomous execution starts after approval
- Implement Team Lead Reverse Proposal feature (ideas/improvements)
- Verification: Test actual Goal input → decomposition → approval → execution

Day 5: Ticket Assignment
- Category-based routing (oh-my-opencode pattern)
- Agent Role matching
- Automatic model selection
- Implement Ticket state machine
```

#### W4: Orchestrator + Verification

**Goal:** A state where approved Tickets execute and are verified autonomously

```
Day 1-2: Orchestrator
- Ticket execution queue
- Assign Ticket to Agent → execute → collect results
- Concurrency control (oh-my-opencode BackgroundManager pattern)
  - Per-provider concurrency limit
  - Per-model concurrency limit
- Auto-create branch (ticket/{id}-{slug})

Day 3-4: Self-Verification Loop
- QA Agent verification pipeline
  - Test execution
  - lint + type check
  - Convention compliance verification based on CONVENTIONS.md
  - LLM-based code review
- Notepad system (oh-my-opencode Atlas pattern)
  - Record learnings, issues, verification
- Retry logic (feedback → retry → escalation on max exceeded)
- Verification: Test QA catching intentionally buggy code

Day 5: PR Creation
- Auto-create PR with octokit
- Include Ticket info + verification results in PR body
- Implement Manual/Smart/Auto modes
- Verification: Test PR creation on an actual GitHub repo
```

### Week 5-6: Dashboard + Integration

#### W5: Web Dashboard

**Goal:** A state where all status can be viewed and managed from the browser

```
Day 1-2: Dashboard Skeleton
- Next.js 15 + Tailwind project setup
- API Routes (REST)
- WebSocket real-time updates
- Layout + navigation

Day 3-4: Core Pages
- Goal management page (creation, progress)
- Ticket Board (Kanban: Pending Approval → Backlog → In Progress → Verification → Done)
  - Pending approval Ticket list + [Approve] [Modify] [Reject] UI
- Heartbeat Report page (report + proposal list + approval UI)
- Team Lead Reverse Proposal notification + approval UI
- Agent list + status (Active/Working/Idle)
- Activity Log (real-time stream)
- Conventions Editor (CONVENTIONS/ARCHITECTURE/STYLE.md editing + change history)

Day 5: Direct Channel
- Chat UI for communicating with Team Lead (chat interface)
- Messages → forwarded to Team Lead Agent
- Real-time display of Team Lead responses
- Save conversation logs
```

#### W6: Heartbeat + CLI + Integration

**Goal:** A state where the Verified Autonomy operation loop works (plan approval → autonomous execution → QA verification)

```
Day 1-2: Heartbeat System ("Notification + Proposal" mode)
- Periodic execution based on node-cron
- Implement Context Check (autonomous analysis)
- Report + proposal generation logic
  - Status summary, new ticket proposals, Reverse Proposals (ideas)
- Heartbeat Report → deliver to Dashboard + Slack/Discord
- User approval processing flow ([Approve All] [Review Individually] [Later])
- Adaptive interval adjustment

Day 3: CLI
- `phalanx init` (project initialization)
- `phalanx start` (start daemon)
- `phalanx stop` (stop daemon)
- `phalanx status` (current status)
- `phalanx goal <description>` (add Goal)

Day 4: Agent Soul Editor
- SOUL.md editing UI on Dashboard
- IDENTITY.md editing (name, icon, color)
- Change history tracking
- Agent add/remove UI

Day 5: Integration Testing + Bug Fixes
- E2E: Goal input → Ticket decomposition → user approval → Agent autonomous execution → QA verification → PR creation
- Verify Heartbeat "Notification + Proposal" mode operation
- Verify Team Lead Reverse Proposal → user approval → execution flow
- Verify Dashboard real-time updates
- Verify full CLI flow
```

---

## 7. Directory Structure

```
phalanx/
├── packages/
│   ├── core/                    # Core engine
│   │   ├── src/
│   │   │   ├── llm/             # LLM Provider Layer
│   │   │   │   ├── providers/
│   │   │   │   │   ├── anthropic.ts
│   │   │   │   │   ├── openai.ts
│   │   │   │   │   ├── ollama.ts
│   │   │   │   │   └── gemini.ts
│   │   │   │   ├── model-resolver.ts    # 5-step model resolution
│   │   │   │   ├── thinking-level.ts    # Thinking Level control
│   │   │   │   ├── token-tracker.ts     # Token usage tracking
│   │   │   │   └── types.ts
│   │   │   ├── tools/           # Tool Layer
│   │   │   │   ├── file-ops.ts
│   │   │   │   ├── git.ts
│   │   │   │   ├── terminal.ts
│   │   │   │   ├── github-pr.ts
│   │   │   │   ├── code-analysis.ts
│   │   │   │   └── tool-registry.ts     # Tool permission management
│   │   │   ├── conventions/     # Team Conventions System
│   │   │   │   ├── analyzer.ts          # Codebase analysis (AST, config parsing)
│   │   │   │   ├── generator.ts         # Auto-generate conventions
│   │   │   │   ├── loader.ts            # Load conventions + inject into Agent prompts
│   │   │   │   ├── validator.ts         # Convention compliance verification (for QA)
│   │   │   │   ├── watcher.ts           # File change detection (chokidar)
│   │   │   │   └── types.ts
│   │   │   ├── agents/          # Agent System
│   │   │   │   ├── agent-runner.ts      # Execution Loop
│   │   │   │   ├── agent-registry.ts    # Agent registration/management
│   │   │   │   ├── soul-loader.ts       # Load SOUL/IDENTITY/MEMORY
│   │   │   │   └── roles/               # Role default templates
│   │   │   │       ├── team-lead.ts
│   │   │   │       ├── backend.ts
│   │   │   │       ├── frontend.ts
│   │   │   │       ├── qa.ts
│   │   │   │       └── customer.ts
│   │   │   ├── engine/          # Core Engine
│   │   │   │   ├── goal-manager.ts      # Goal CRUD + progress tracking
│   │   │   │   ├── ticket-manager.ts    # Ticket CRUD + state machine
│   │   │   │   ├── orchestrator.ts      # Assignment + execution + concurrency
│   │   │   │   ├── verification.ts      # Self-Verification Loop
│   │   │   │   ├── pr-controller.ts     # PR 3 modes
│   │   │   │   └── heartbeat.ts         # Heartbeat Scheduler
│   │   │   ├── db/              # Data Layer
│   │   │   │   ├── schema.ts            # drizzle-orm schema
│   │   │   │   ├── migrations/
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── dashboard/               # Web Dashboard
│   │   ├── src/
│   │   │   ├── app/             # Next.js App Router
│   │   │   │   ├── page.tsx             # Main dashboard
│   │   │   │   ├── goals/               # Goal management
│   │   │   │   ├── tickets/             # Ticket Board
│   │   │   │   ├── agents/              # Agent management + Soul Editor
│   │   │   │   ├── channel/             # Direct Channel
│   │   │   │   ├── activity/            # Activity Log
│   │   │   │   ├── conventions/         # Conventions Editor
│   │   │   │   └── api/                 # API Routes
│   │   │   ├── components/
│   │   │   └── lib/
│   │   └── package.json
│   │
│   └── cli/                     # CLI
│       ├── src/
│       │   ├── commands/
│       │   │   ├── init.ts
│       │   │   ├── start.ts
│       │   │   ├── stop.ts
│       │   │   ├── status.ts
│       │   │   └── goal.ts
│       │   └── index.ts
│       └── package.json
│
├── templates/                   # Agent Soul default templates
│   ├── team-lead/
│   │   ├── SOUL.md
│   │   ├── IDENTITY.md
│   │   └── SKILLS.md
│   ├── backend/
│   ├── frontend/
│   ├── qa/
│   └── customer/
│
├── pnpm-workspace.yaml
├── tsconfig.json
├── package.json
└── PLANNING.md

# Structure created in the user's project:
# my-project/
# ├── .phalanx/
# │   ├── CONVENTIONS.md          # Team conventions
# │   ├── ARCHITECTURE.md         # Architecture decisions
# │   ├── STYLE.md                # Code style
# │   └── history/
# │       └── conventions-changelog.md
# ├── .phalanx/agents/
# │   ├── team-lead/
# │   │   ├── SOUL.md
# │   │   ├── IDENTITY.md
# │   │   ├── MEMORY.md
# │   │   └── SKILLS.md
# │   ├── backend-1/
# │   ├── backend-2/
# │   ├── qa-1/
# │   └── ...
# └── (existing project files)
```

---

## 8. Core Interface Design

### 8.1 LLM Provider Interface

```typescript
// Unified interface that all LLM Providers implement
interface LLMProvider {
  readonly name: string;
  readonly models: ModelInfo[];

  chat(params: ChatParams): Promise<ChatResult>;
  chatWithTools(params: ChatWithToolsParams): Promise<ToolCallResult>;
}

interface ChatParams {
  model: string;
  messages: Message[];
  thinkingLevel: ThinkingLevel;    // off | low | medium | high
  maxTokens?: number;
  temperature?: number;
}

interface ChatWithToolsParams extends ChatParams {
  tools: ToolDefinition[];
}

type ThinkingLevel = 'off' | 'low' | 'medium' | 'high';

// Thinking Level mapping per Provider
// Claude: off → none, low → budget 1024, medium → 4096, high → 16384
// OpenAI: reasoning effort parameter
// Gemini: thinking mode toggle
```

### 8.2 Tool Interface

```typescript
interface Tool {
  name: string;
  description: string;
  parameters: z.ZodSchema;          // Defined with zod schema
  requiredPermissions: Permission[];
  execute(params: unknown, context: ToolContext): Promise<ToolResult>;
}

interface ToolContext {
  workingDir: string;
  agent: AgentInfo;
  ticket?: TicketInfo;
}

interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}
```

### 8.3 Agent Interface

```typescript
interface Agent {
  id: string;
  role: AgentRole;
  soul: SoulConfig;       // Parsed result of SOUL.md
  identity: IdentityConfig;
  memory: string;         // Content of MEMORY.md
  skills: SkillsConfig;
  provider: string;       // e.g., 'anthropic'
  model: string;          // e.g., 'claude-sonnet-4-5-20250929'
  thinkingLevel: ThinkingLevel;
  allowedTools: string[];
  deniedTools: string[];
}

type AgentRole = 'team-lead' | 'backend' | 'frontend' | 'qa' | 'customer' | 'devops';

interface AgentRunner {
  execute(agent: Agent, ticket: Ticket, conventions: TeamConventions): Promise<ExecutionResult>;
  // Internally performs the Execution Loop:
  // System Prompt construction (including SOUL + CONVENTIONS) → LLM call → Tool execution → repeat → result
}
```

### 8.4 Ticket Interface

```typescript
interface Goal {
  id: string;
  description: string;
  status: 'active' | 'completed' | 'paused';
  progress: number;           // 0-100
  createdAt: Date;
  epics: Epic[];
}

interface Epic {
  id: string;
  goalId: string;
  title: string;
  tickets: Ticket[];
}

interface Ticket {
  id: string;
  epicId: string;
  title: string;
  description: string;
  status: TicketStatus;
  approvalStatus: ApprovalStatus;  // CEO↔PM Model: user approval status
  priority: 'critical' | 'high' | 'medium' | 'low';
  assignedAgent?: string;
  branch?: string;
  prUrl?: string;
  retryCount: number;
  maxRetries: number;
  verification?: VerificationResult;
  dependsOn: string[];       // Other Ticket IDs
  proposedBy?: string;       // Proposing entity ('team-lead' | 'user')
  approvedAt?: Date;         // User approval timestamp
  createdAt: Date;
  updatedAt: Date;
}

// User approval status (Phase 1: all new Tickets require approval)
type ApprovalStatus =
  | 'pending'          // Awaiting user approval
  | 'approved'         // Approved → eligible for autonomous execution
  | 'rejected'         // Rejected
  | 'modified';        // Approved after modification

type TicketStatus =
  | 'backlog'
  | 'pending_approval'   // Awaiting user approval (CEO↔PM Model)
  | 'assigned'
  | 'in_progress'
  | 'verification'
  | 'done'
  | 'failed'
  | 'escalated';
```

### 8.5 Team Conventions Interface

```typescript
interface TeamConventions {
  conventions: string;      // Raw CONVENTIONS.md
  architecture: string;     // Raw ARCHITECTURE.md
  style: string;            // Raw STYLE.md
  lastUpdated: Date;
  updatedBy: 'user' | 'team-lead';
}

interface ConventionAnalyzer {
  // Analyze codebase → generate convention draft
  analyze(projectDir: string): Promise<ConventionDraft>;
}

interface ConventionDraft {
  conventions: string;      // Generated CONVENTIONS.md
  architecture: string;     // Generated ARCHITECTURE.md
  style: string;            // Generated STYLE.md
  detectedPatterns: {       // Patterns detected from analysis
    language: string;
    framework: string;
    linter: string | null;
    testFramework: string | null;
    namingConvention: string;
    commitStyle: string;
    folderStructure: string[];
  };
}

interface ConventionValidator {
  // Used by QA Agent: verify whether code complies with conventions
  validate(
    files: FileChange[],
    conventions: TeamConventions
  ): Promise<ValidationResult>;
}

interface ValidationResult {
  passed: boolean;
  violations: ConventionViolation[];
}

interface ConventionViolation {
  file: string;
  line?: number;
  rule: string;             // Convention rule violated
  severity: 'error' | 'warning';
  message: string;
  suggestion?: string;      // Suggested fix
}

interface ConventionProposal {
  id: string;
  proposedBy: 'team-lead';
  reason: string;           // Reason for proposal
  diff: string;             // Change content (in diff format)
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}
```

---

## 9. Cost Optimization Strategy

### 9.1 Thinking Level-based Cost Control (Most Critical)

| Task Type | Thinking Level | Estimated Cost Ratio |
|-----------|---------------|---------------------|
| Goal decomposition, architecture decisions | HIGH | 1x (baseline) |
| Code writing, refactoring | MEDIUM | 0.6x |
| QA verification, lint checks | LOW | 0.3x |
| Simple file reading/cleanup | OFF | 0.1x |

### 9.2 Model Tiering

| Agent Role | Primary Model | Cost | Fallback |
|------------|--------------|------|----------|
| Team Lead | claude-opus-4-6 | $$$$ | gpt-4o |
| Backend/Frontend | claude-sonnet-4-5 | $$ | gpt-4o-mini |
| QA | claude-haiku-4-5 | $ | gpt-4o-mini |
| Customer | claude-haiku-4-5 | $ | gpt-4o-mini |

### 9.3 Additional Cost Reduction Strategies

- **Adaptive Heartbeat**: Extend interval when changes are minimal (30 min → 2 hours)
- **Idle Detection**: Idle Agents consume 0 tokens
- **Batch Processing**: Process non-urgent Tickets in batches
- **Ollama Fallback**: Use local models for simple tasks (free)
- **Token Budget**: Set daily/per-Goal limits, notify user on exceeding threshold

---

## 10. Risk Mitigation Strategy

### 10.1 Code Quality Risks

| Risk | Mitigation |
|------|------------|
| LLM generates incorrect code | Self-Verification Loop (QA verification mandatory) |
| Merge without tests | Smart Mode default: tests must pass |
| Error propagation (one Agent's failure affects the next) | Learning propagation via Notepad system |
| Infinite retry loop | maxRetries limit (default 3) + escalation |
| Code inconsistency (different styles per Agent) | Team Conventions system (shared CONVENTIONS.md injection) |

### 10.2 Cost Risks

| Risk | Mitigation |
|------|------------|
| Cost exceeding estimates | Token budget + daily limits + threshold alerts |
| Debate mode cost explosion | Smart Mode as default (debate only for critical decisions) |
| Excessive Heartbeat execution | Adaptive interval |

### 10.3 Context Window Risks

| Risk | Mitigation |
|------|------------|
| Conversation length exceeded | Apply oh-my-opencode context-window-monitor pattern |
| Analyzing large files | File chunk splitting + AST-based selective loading |
| Convention files growing too large | Auto-generate summarized convention version (for prompts) |

### 10.4 Security Risks

| Risk | Mitigation |
|------|------------|
| Dangerous command execution | terminal_exec allowlist + timeout |
| Sensitive file access | Project directory restriction + path blocklist |
| API key exposure | Environment variable management + prevent .env commits |

---

## 11. Extension Vision: Distributed Worker Architecture

> Detailed design: see `PLANNING.md` section 8.1

Phase 1~2 operates as a single-process daemon, but Phase 3+ targets **registering other PCs as worker nodes to run Agents in a distributed manner**.

**Phase 1 Design Considerations:**

| Module | Consideration for Distributed Extension |
|--------|----------------------------------------|
| **Orchestrator** | Design `AgentRunner.execute()` to be execution-environment agnostic (local/remote) |
| **Ticket Manager** | Already uses `ticket/{id}-{slug}` branch isolation — naturally compatible with distributed model |
| **Tool Layer** | Tools operate based on `ToolContext.workingDir` — works identically on worker's local git clone |
| **LLM Provider Layer** | Already supports remote endpoints (Ollama etc.) — worker's local LLM is naturally usable |

Phase 1 ensures extensible interfaces for the above modules, but **no distributed code is written**. Only "easy-to-extend interfaces" are needed.

---

## Appendix: Post-MVP Expansion Plan (Phase 2-3)

### Phase 2 (+4 weeks)
- Ollama local model support
- Debate System (Smart Mode)
- GitHub Issues / Jira / Linear integration
- Slack / Discord notifications
- Automated documentation (Daily Log, Meeting Minutes)
- Cost tracking dashboard

### Phase 3 (Future)
- Team Meeting system
- Multi-team support
- Plugin system
- Community templates
- DevOps Agent (CI/CD)
- **Distributed Worker Architecture** (register other PCs as workers to run Agents remotely, Git-based collaboration)

---

## Conclusion

**Implementation Feasibility: High**

All core components have patterns validated in OpenClaw and oh-my-opencode.
In particular, oh-my-opencode's Planning Triad (Prometheus/Metis/Momus) → Atlas execution pattern
maps nearly 1:1 to Phalanx's Team Lead → Agent execution structure.

The key differentiator, **"Verified Autonomy"**, can be implemented by extending patterns from existing references,
and the CEO↔PM Model (plan approval → autonomous execution → QA verification) progressively builds user trust.
By actively leveraging the LLM Provider's Thinking Level capabilities, cost-efficient decision-making
is achievable without a separate planning agent.

Starting with "Notification + Proposal" level Heartbeat in Phase 1, then expanding the scope of autonomy
in Phase 2+ as trust accumulates, is a strategy that secures both user acceptance and product stability.
