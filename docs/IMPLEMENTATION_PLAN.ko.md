# Phalanx - 구현 계획서

> 작성일: 2026-02-11
> 기반: PLANNING.md 기획서 + OpenClaw/oh-my-opencode 레퍼런스 분석

---

## 목차

1. [아키텍처 설계](#1-아키텍처-설계)
2. [기술 스택 확정](#2-기술-스택-확정)
3. [핵심 모듈 구현 계획](#3-핵심-모듈-구현-계획)
4. [팀 컨벤션 시스템](#4-팀-컨벤션-시스템)
5. [레퍼런스 코드 활용 전략](#5-레퍼런스-코드-활용-전략)
6. [Phase 1 MVP 상세 구현 로드맵](#6-phase-1-mvp-상세-구현-로드맵)
7. [디렉토리 구조](#7-디렉토리-구조)
8. [핵심 인터페이스 설계](#8-핵심-인터페이스-설계)
9. [비용 최적화 전략](#9-비용-최적화-전략)
10. [위험 완화 전략](#10-위험-완화-전략)

---

## 1. 아키텍처 설계

### 1.1 전체 시스템 구조

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
│  │              Orchestrator                             │   │
│  │  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐  │   │
│  │  │  Ticket      │ │  Verification│ │  PR Control  │  │   │
│  │  │  Assignment  │ │  Loop        │ │  (3 modes)   │  │   │
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

### 1.2 핵심 설계 원칙 (레퍼런스에서 검증된 패턴)

| 원칙 | 출처 | 적용 |
|------|------|------|
| Hub-and-spoke 오케스트레이션 | OpenClaw Gateway, oh-my-opencode Atlas | Team Lead가 허브, 각 Agent가 스포크 |
| Category 기반 라우팅 | oh-my-opencode delegate-task | 모델명이 아닌 역할/카테고리로 태스크 배분 |
| Notepad 검증 프로토콜 | oh-my-opencode Atlas hook | Self-Verification Loop에 활용 |
| 5단계 모델 해석 파이프라인 | oh-my-opencode | Agent별 최적 모델 자동 선택 |
| Thinking Level 제어 | oh-my-opencode + OpenClaw /think | 태스크 중요도에 따른 비용 최적화 |
| SOUL/IDENTITY 분리 | OpenClaw agent workspace | Agent 정체성 시스템 |
| safeCreate 패턴 | oh-my-opencode safeCreateHook | 개별 컴포넌트 실패 격리 |
| 상태 머신 기반 태스크 관리 | oh-my-opencode BackgroundManager | Ticket lifecycle 관리 |

---

## 2. 기술 스택 확정

| 레이어 | 기술 | 선정 이유 |
|--------|------|-----------|
| **Runtime** | Node.js 22+ (TypeScript) | 레퍼런스 동일. LLM SDK 생태계 최적 |
| **Package Manager** | pnpm | Monorepo 지원, 디스크 효율 |
| **Dashboard** | Next.js 15 + Tailwind CSS | 기획서 명시. SSR + API routes 통합 |
| **LLM SDK** | @anthropic-ai/sdk, openai, @google/genai | 공식 SDK 직접 사용 |
| **Database** | better-sqlite3 + drizzle-orm | 로컬 설치, 제로 설정, 타입 안전 |
| **Git** | simple-git | 기획서 명시. 표준 라이브러리 |
| **GitHub** | octokit | PR 생성/리뷰/머지 |
| **Terminal** | execa | child_process 대비 안전한 실행 |
| **Scheduler** | node-cron | Heartbeat 구현 |
| **File Watch** | chokidar | 실시간 변경 감지 |
| **Code Analysis** | ts-morph | AST 기반 코드 분석 |
| **Schema Validation** | zod | oh-my-opencode 검증 패턴. 런타임 타입 안전 |
| **CLI** | commander.js | oh-my-opencode 동일. 표준 |
| **Build** | tsup (esbuild) | 빠른 빌드 |
| **Test** | vitest | oh-my-opencode 동일 |
| **Notifications** | @slack/web-api, discord.js | 기획서 명시 |

---

## 3. 핵심 모듈 구현 계획

### 3.1 LLM Provider Layer

**레퍼런스:** oh-my-opencode의 5단계 모델 해석 + OpenClaw의 Model Resolver

```
해석 우선순위:
1. Ticket 레벨 모델 override
2. Agent config의 모델 지정
3. Role 기본 모델 (Team Lead → Opus, QA → Haiku 등)
4. Provider fallback chain
5. 시스템 기본값
```

**핵심 기능:**
- **Unified Interface**: 모든 provider를 동일한 인터페이스로 래핑
- **Thinking Level Control**: off/low/medium/high (태스크 중요도에 따라 자동 조절)
  - Team Lead의 Goal 분해: `high` (정확성 중요)
  - Backend Agent 코드 작성: `medium`
  - QA lint 검사: `low`
  - 단순 파일 읽기: `off`
- **Fallback Chain**: primary provider 실패 시 자동 전환
- **Rate Limit Cooldown**: oh-my-opencode 패턴 - 제한 걸린 키 자동 쿨다운
- **Token Budget Tracking**: 일별/Goal별 토큰 사용량 추적

**비용 절감 핵심 - Provider의 Plan/Thinking 기능 활용:**
- Claude Extended Thinking → budget_tokens 파라미터로 thinking 비용 제어
- OpenAI reasoning models → 복잡한 분해 작업에 활용
- 별도의 "planning agent"를 만드는 것보다 LLM 자체 thinking 기능이 저렴

### 3.2 Tool Layer

**레퍼런스:** OpenClaw createOpenClawCodingTools + oh-my-opencode tools/

| 도구 | 구현 방식 | 보안 |
|------|-----------|------|
| file_read | fs.readFile | 프로젝트 디렉토리 제한 |
| file_write | fs.writeFile | 프로젝트 디렉토리 제한 |
| file_edit | diff-match-patch | 원자적 편집 |
| git_* | simple-git | 브랜치 격리 |
| terminal_exec | execa | 타임아웃 + allowlist |
| github_pr | octokit | 토큰 기반 인증 |
| code_analyze | ts-morph | 읽기 전용 |

**도구 권한 시스템 (OpenClaw 패턴 참고):**
- Agent Role별 도구 허용/차단 목록
- Team Lead: 모든 도구 (단, terminal_exec은 제한)
- QA Agent: file_read + terminal_exec(test 명령어만) + code_analyze
- Customer Agent: file_read + code_analyze (읽기 전용)

### 3.3 Agent System

**레퍼런스:** OpenClaw SOUL.md + oh-my-opencode 에이전트 정의

**Agent 구성 파일 (4개):**
```
agents/{agent-id}/
├── SOUL.md        # 정체성, 가치관, 의견 (사용자 편집)
├── IDENTITY.md    # 이름, 아이콘, 색상 (사용자 편집)
├── MEMORY.md      # 학습 내용 (에이전트 자동 업데이트)
└── SKILLS.md      # 기술 스택, 사용 가능 도구 (시스템 생성)
```

**Agent Execution Loop (oh-my-opencode 패턴):**
```
1. System Prompt 구성 (SOUL + IDENTITY + SKILLS + CONVENTIONS + Ticket Context)
2. LLM API 호출 (도구 정의 포함)
3. 응답 = 텍스트 → 완료
4. 응답 = 도구 호출 → 도구 실행 → 결과를 대화에 추가 → 2로 복귀
5. 오류 발생 → 에러를 모델에 전달 (예외 아닌 결과로) → 모델이 복구 시도
6. 최대 반복 초과 → 사용자에게 에스컬레이션
```

### 3.4 Goal & Ticket Manager

**레퍼런스:** oh-my-opencode Prometheus → plan → Atlas 실행 패턴

**Goal → Ticket 분해 프로세스 (CEO↔PM 모델):**
```
1. 사용자(CEO)가 Goal 입력 (예: "MVP 쇼핑몰 3주 내 완성")
2. Team Lead(PM)가 Goal 분석 (Thinking Level: HIGH)
   - 기술적 요구사항 추출
   - 의존성 그래프 생성
   - 우선순위 결정
3. Epic 레벨로 1차 분해 (예: "인증 시스템", "상품 관리", "결제")
4. Epic → Ticket으로 2차 분해 (실행 가능한 단위)
5. 분해 결과를 사용자에게 제출 → 승인 대기
   - [전체 승인] [수정 후 승인] [거절]
6. 사용자 승인 후 → Ticket에 에이전트 배정 + 모델 선택
7. SQLite에 저장 + Dashboard 반영 → 자율 실행 시작

※ 이미 승인된 Ticket은 Agent가 자율적으로 실행 (사용자 개입 불필요)
※ Team Lead는 역제안도 가능 ("이런 것도 하면 어때요?" → 사용자 승인 후 실행)
```

**Ticket 상태 머신 (oh-my-opencode BackgroundManager 패턴 + CEO↔PM 승인):**
```
PENDING_APPROVAL → (사용자 승인) → BACKLOG → ASSIGNED → IN_PROGRESS → VERIFICATION → DONE
      ↓                                              ↘                    ↗
  (거절) → REJECTED                                    → FAILED → RETRY →
                                                                   ↓
                                                              ESCALATED (사용자에게)
```

### 3.5 Self-Verification Loop

**레퍼런스:** oh-my-opencode Atlas notepad verification protocol

```
1. Agent가 코드 작성 완료
2. QA Agent 검증:
   a. 단위 테스트 실행 (terminal_exec)
   b. lint + type check (terminal_exec)
   c. 코드 리뷰 (LLM 기반, Thinking: LOW)
3. Customer Agent 검증 (Phase 1에서는 선택적):
   a. 요구사항 대비 구현 확인 (LLM 기반)
   b. UX 관점 검토
4. 결과 기록 → Notepad 패턴:
   - learnings.md (발견한 패턴)
   - issues.md (발견한 문제)
   - verification.md (테스트 결과)
5. PASS → PR 생성
6. FAIL → 원본 Agent에 피드백 + 재시도 (max N회)
7. max 초과 → ESCALATED
```

### 3.6 Heartbeat System

**레퍼런스:** OpenClaw HEARTBEAT.md + node-cron

**Phase 1: "알림 + 제안" 모드 (CEO↔PM 모델)**

Heartbeat는 자율 실행이 아닌 **보고 + 제안** 수준으로 동작한다.
새로운 행동은 반드시 사용자 승인 후 실행. 이미 승인된 티켓은 자율 실행 유지.

```
Heartbeat Cycle (Phase 1):
1. Wake (기본 30분 간격)
2. Context Check (자율 분석):
   - 진행 중인 Ticket 상태 확인
   - 완료된 Ticket 확인
   - 실패/정체된 Ticket 감지
   - 코드베이스 변화 감지
3. 보고서 + 제안 생성 (자율 판단):
   - 현재 진행 상황 요약
   - 새 Ticket 필요 시 → 제안으로 포함 (자동 생성 아님)
   - 우선순위 변경 필요 시 → 제안으로 포함
   - 개선 아이디어 발견 시 → 역제안으로 포함
4. 사용자에게 보고 (Dashboard + Slack/Discord):
   - Heartbeat Report (상황 요약 + 제안 목록)
   - [전체 승인] [개별 검토] [나중에]
5. 사용자 응답 처리:
   - 승인된 제안 → 즉시 실행
   - 미승인 → 다음 Heartbeat까지 보류
   - 기존 승인된 Ticket은 계속 자율 실행
6. Sleep

자율 실행 vs 승인 필요 (Phase 1):
  ✅ 자율: 승인된 Ticket 실행, QA/Customer 검증, Smart Mode PR 머지
  🔒 승인: 새 Ticket 생성, 우선순위 변경, Agent 채용/해고, 역제안 실행

Phase 2+: 신뢰 축적 후 점진적 자율화
  → 낮은 위험도 행동은 자율, 높은 위험도만 승인

Adaptive Interval:
- 활발한 변화: 15분
- 보통: 30분
- 저활동: 1시간
- 거의 없음: 2시간
```

### 3.7 PR Control System

**세 가지 모드:**

| 모드 | 동작 | 사용 시나리오 |
|------|------|-------------|
| Manual | 모든 PR → 사용자 리뷰 필수 | 초기 신뢰 구축 단계 |
| Smart | 규칙 기반 자동/수동 분류 | 권장 기본값 |
| Auto | QA+Customer PASS → 자동 머지 | 높은 신뢰 단계 |

**Smart Mode 규칙 (설정 가능):**
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

**컨셉:** Team Lead가 프로젝트 분석 후 팀 컨벤션을 자동 생성하고, 모든 Agent가 이를 참조하여 일관성을 유지한다. 사용자(인간)는 언제든 컨벤션을 직접 수정할 수 있다.

**레퍼런스:** Claude Code의 CLAUDE.md, OpenClaw의 AGENTS.md, oh-my-opencode의 `.sisyphus/learnings.md`

**기존 도구와의 차이점:**
- 기존: 사람이 직접 컨벤션 파일 작성
- Phalanx: Team Lead가 코드베이스 분석 후 자동 생성 → 사람은 수정/승인만

#### 3.8.1 컨벤션 파일 구조

```
.phalanx/
├── CONVENTIONS.md       # 팀 컨벤션 (코드 스타일, Git 규칙, 네이밍 등)
├── ARCHITECTURE.md      # 아키텍처 결정 사항 (패턴, 폴더 구조, 의존성 규칙)
└── STYLE.md             # 코드 스타일 상세 (언어별 규칙, 포맷팅)
```

#### 3.8.2 CONVENTIONS.md 예시

```markdown
# Team Conventions
> Auto-generated by Team Lead | Last updated: 2026-02-11
> Human-editable: YES (Dashboard 또는 직접 편집)

## Git
- Branch: feature/{ticket-id}-{slug}, fix/{ticket-id}-{slug}
- Commit: conventional commits (feat:, fix:, refactor:, test:)
- PR: 제목 70자 이내, 본문에 ticket ID 포함

## Code Style
- Language: TypeScript strict mode
- Naming: camelCase (변수/함수), PascalCase (타입/클래스)
- 파일: kebab-case.ts
- 패턴: Repository Pattern for DB, Factory for services

## Testing
- 최소 커버리지: 70%
- 네이밍: describe("UserService") > it("should return user by id")
- E2E: Playwright

## Architecture
- API: REST, /api/v1 prefix
- Error: { code, message, details } 형식 통일
- Auth: JWT with refresh token

## Dependencies
- 새 패키지 추가 시 Team Lead 승인 필요
- 번들 사이즈 고려: lodash 대신 개별 유틸 함수
```

#### 3.8.3 컨벤션 생성 프로세스

```
프로젝트 초기화 시 (autopilot-team init):
1. Team Lead가 기존 코드베이스 스캔
   - package.json (언어, 프레임워크, 린터 설정)
   - 기존 .eslintrc, .prettierrc, tsconfig.json 분석
   - 폴더 구조 패턴 분석
   - 기존 코드에서 네이밍 패턴 추출 (ts-morph AST 분석)
   - Git 히스토리에서 커밋 메시지 패턴 분석
2. 분석 결과로 CONVENTIONS.md 초안 자동 생성
3. Dashboard에서 사용자에게 초안 제시 → 수정/승인
4. 승인 후 .phalanx/ 디렉토리에 저장
```

#### 3.8.4 컨벤션 적용 흐름

```
매 Ticket 실행 시:
1. Agent System Prompt 구성:
   [SOUL.md] + [IDENTITY.md] + [SKILLS.md] + [CONVENTIONS.md] + [Ticket Context]
                                               ^^^^^^^^^^^^^^^^
                                               모든 Agent에 공통 주입

2. QA Agent 검증 시 컨벤션 기반 체크 추가:
   - 네이밍 규칙 준수 여부
   - Git 커밋 메시지 형식
   - 폴더 구조 규칙
   - 테스트 커버리지 기준
   → 컨벤션 위반 = Verification FAIL

3. PR 생성 시:
   - PR 템플릿이 CONVENTIONS.md의 PR 규칙 따름
   - 브랜치 이름이 컨벤션 규칙 따름
```

#### 3.8.5 컨벤션 수정 권한

| 행위 | 사용자 (인간) | Team Lead | 일반 Agent |
|------|:---:|:---:|:---:|
| 컨벤션 직접 수정 | O | X | X |
| 컨벤션 수정 제안 | - | O (사용자 승인 필요) | X |
| 컨벤션 기반 검증 수행 | - | O (QA에게 지시) | - |
| 컨벤션 무시 (override) | O | X | X |
| 컨벤션 읽기 | O | O | O |

**Team Lead의 컨벤션 수정 제안 시나리오:**
```
1. 반복되는 패턴 발견 시:
   "3번 이상 같은 에러 패턴 발생 → 컨벤션에 규칙 추가 제안"
   예: "try-catch에서 에러를 삼키는 패턴 반복 → 에러 로깅 필수 규칙 제안"

2. Heartbeat에서 코드 품질 하락 감지 시:
   "최근 5개 PR에서 테스트 커버리지 50% 미만 → 최소 커버리지 상향 제안"

3. 새로운 기술 도입 시:
   "Prisma ORM 도입 → 관련 네이밍/구조 컨벤션 추가 제안"
```

**수정 제안 흐름:**
```
Team Lead가 제안 생성
    ↓
Dashboard 알림 + Direct Channel 메시지
    ↓
사용자 확인: [승인] / [수정 후 승인] / [거절]
    ↓
승인 시 CONVENTIONS.md 자동 업데이트
    ↓
변경 이력 git commit으로 추적
```

#### 3.8.6 컨벤션 변경 이력 추적

```
.phalanx/
├── CONVENTIONS.md              # 현재 컨벤션
├── ARCHITECTURE.md             # 현재 아키텍처 결정
├── STYLE.md                    # 현재 코드 스타일
└── history/                    # 변경 이력
    └── conventions-changelog.md
```

**conventions-changelog.md 예시:**
```markdown
## 2026-02-15: 에러 처리 규칙 추가
- **제안자:** Team Lead
- **사유:** Backend Agent가 3회 연속 빈 catch 블록 작성
- **변경:** "모든 catch 블록에서 logger.error() 필수" 규칙 추가
- **승인:** 사용자 승인 (2026-02-15 14:30)

## 2026-02-11: 초기 컨벤션 생성
- **제안자:** Team Lead (자동 생성)
- **사유:** 프로젝트 초기화
- **승인:** 사용자 승인 (2026-02-11 10:00)
```

---

## 4. 팀 컨벤션 시스템

> 3.8절의 상세 설계를 참조. 이 섹션은 시스템 전체에서 컨벤션이 어떻게 연동되는지 요약한다.

### 컨벤션 연동 맵

```
┌─────────────┐
│ CONVENTIONS │──────────────────────────────────────────┐
│ .md files   │                                          │
└──────┬──────┘                                          │
       │                                                 │
       ├──→ Agent System Prompt (모든 Agent에 주입)       │
       │    → 코드 작성 시 컨벤션 준수                     │
       │                                                 │
       ├──→ QA Verification (검증 기준으로 활용)           │
       │    → 컨벤션 위반 시 FAIL                         │
       │                                                 │
       ├──→ PR Controller (PR 템플릿/브랜치 규칙)          │
       │    → 브랜치명, 커밋 메시지, PR 본문 형식           │
       │                                                 │
       ├──→ Goal Decomposition (Ticket 생성 시 참고)      │
       │    → 아키텍처 결정사항 반영한 Ticket 설계          │
       │                                                 │
       └──→ Dashboard (편집 UI + 변경 이력 조회)           │
            → 사용자가 실시간 수정 가능                     │
```

---

## 5. 레퍼런스 코드 활용 전략

### oh-my-opencode에서 가져올 패턴

| 패턴 | 소스 파일 | 적용 위치 |
|------|-----------|-----------|
| 5단계 모델 해석 파이프라인 | `tools/delegate-task/tools.ts` (~1,070 LOC) | LLM Provider Layer |
| BackgroundManager 상태 머신 | `features/background-agent/manager.ts` (~1,500 LOC) | Ticket Manager |
| Notepad 검증 프로토콜 | `hooks/atlas/index.ts` (~750 LOC) | Self-Verification Loop |
| Planning Triad 구조 | `agents/prometheus-prompt.ts` (~1,200 LOC) | Goal → Ticket 분해 |
| safeCreate 에러 격리 | `index.ts` | 모든 모듈 초기화 |
| context-window-monitor | `hooks/` | Agent 실행 루프 |
| todo-continuation-enforcer | `hooks/` | Ticket 완료 보장 |
| Category 기반 라우팅 | `tools/delegate-task/` | Agent 배정 |

### OpenClaw에서 가져올 패턴

| 패턴 | 소스 | 적용 위치 |
|------|------|-----------|
| SOUL.md + IDENTITY.md 시스템 | `agents/workspace/` | Agent Soul 시스템 |
| HEARTBEAT.md | `agents/workspace/` | Heartbeat 시스템 |
| Model Resolver + Rate Limit | `providers/` | LLM Provider Layer |
| 도구 권한 계층 | `security/` | Tool Layer 보안 |
| Hub-and-spoke Gateway | `gateway/` | Core Engine |
| sessions_spawn | `sessions/` | Agent 간 위임 |

---

## 6. Phase 1 MVP 상세 구현 로드맵

### Week 1-2: Foundation

#### W1: 프로젝트 골격 + LLM Provider Layer

**목표:** 단일 LLM 호출이 작동하는 상태

```
Day 1-2: 프로젝트 설정
- pnpm workspace 초기화
- TypeScript + ESLint + Prettier 설정
- tsup 빌드 설정
- vitest 테스트 설정
- CLI 진입점 (commander.js)

Day 3-4: LLM Provider Layer
- Provider 인터페이스 정의 (generateText, generateCode, reviewCode)
- AnthropicProvider 구현 (Claude API)
  - Extended Thinking 지원 (budget_tokens)
  - Tool use 지원
- OpenAIProvider 구현
  - Chat Completions API
  - Function calling 지원
- Thinking Level 시스템 (off/low/medium/high)
- 검증: 각 provider로 코드 생성 테스트

Day 5: Model Resolver
- 5단계 모델 해석 파이프라인 구현
- Provider fallback chain
- Rate limit cooldown 로직
- Token 사용량 추적
- 검증: provider 전환 테스트
```

#### W2: Tool Layer + Agent System

**목표:** Agent가 도구를 사용해 파일을 읽고 쓸 수 있는 상태

```
Day 1-2: Tool Layer
- Tool 인터페이스 정의
- file_read, file_write, file_edit 구현
- git_* 도구 구현 (simple-git)
- terminal_exec 구현 (execa, 타임아웃+sandboxing)
- Tool 권한 시스템 (role별 allow/deny)
- 검증: 각 도구 단위 테스트

Day 3-4: Agent System
- Agent 설정 로더 (SOUL/IDENTITY/MEMORY/SKILLS.md)
- Agent Execution Loop 구현
  - System prompt 구성
  - LLM 호출 → Tool 실행 → 결과 반환 루프
  - 오류 복구 (oh-my-opencode 패턴)
  - 최대 반복 제한
- 기본 Agent Role 템플릿 (Team Lead, Backend, QA)
- 검증: Agent에게 간단한 코드 작성 태스크 실행

Day 5: 통합 테스트
- Provider + Tool + Agent 통합
- Agent가 파일 읽기 → 코드 작성 → 파일 저장하는 E2E 테스트
```

### Week 3-4: Core Engine

#### W3: Ticket System + Goal Decomposition

**목표:** Goal을 입력하면 Ticket으로 분해되는 상태

```
Day 1-2: Data Layer
- SQLite 스키마 설계 (drizzle-orm)
  - goals, epics, tickets (approval_status 포함), agents, activity_logs, token_usage, conventions
  - proposals (Heartbeat 제안), reverse_proposals (Team Lead 역제안)
  - heartbeat_logs (보고서 + 승인 상태)
- Migration 시스템
- CRUD 서비스

Day 3: Team Conventions System
- 코드베이스 분석 로직 (package.json, eslint, tsconfig, git history)
- CONVENTIONS.md / ARCHITECTURE.md / STYLE.md 자동 생성
- 컨벤션 로더 (Agent system prompt 주입용)
- 사용자 수정 → 파일 감시(chokidar) → 즉시 반영
- 검증: 기존 프로젝트에서 컨벤션 자동 생성 테스트

Day 4: Goal → Ticket 분해 + 승인 플로우
- Team Lead Agent에 Goal 분해 프롬프트 구성
  - oh-my-opencode Prometheus 패턴 참고
  - Thinking Level: HIGH 사용
- Goal → Epic → Ticket 3단계 분해
- 의존성 그래프 생성
- 우선순위 자동 결정
- 분해 결과 사용자 승인 플로우 구현 (CEO↔PM 모델)
  - 승인 대기 상태 (pending_approval)
  - [전체 승인] [수정 후 승인] [거절] UI
  - 승인 후 자율 실행 시작
- Team Lead 역제안 기능 구현 (아이디어/개선점 제안)
- 검증: 실제 Goal 입력 → 분해 → 승인 → 실행 테스트

Day 5: Ticket Assignment
- Category 기반 라우팅 (oh-my-opencode 패턴)
- Agent Role 매칭
- 모델 자동 선택
- Ticket 상태 머신 구현
```

#### W4: Orchestrator + Verification

**목표:** 승인된 Ticket이 자율적으로 실행되고 검증되는 상태

```
Day 1-2: Orchestrator
- Ticket 실행 큐
- Agent에 Ticket 배정 → 실행 → 결과 수집
- 동시성 제어 (oh-my-opencode BackgroundManager 패턴)
  - per-provider 동시성 제한
  - per-model 동시성 제한
- 브랜치 자동 생성 (ticket/{id}-{slug})

Day 3-4: Self-Verification Loop
- QA Agent 검증 파이프라인
  - 테스트 실행
  - lint + type check
  - CONVENTIONS.md 기반 컨벤션 준수 검증
  - LLM 기반 코드 리뷰
- Notepad 시스템 (oh-my-opencode Atlas 패턴)
  - learnings, issues, verification 기록
- Retry 로직 (피드백 → 재시도 → max 초과 시 에스컬레이션)
- 검증: 의도적 오류 코드 → QA가 잡는지 테스트

Day 5: PR 생성
- octokit으로 PR 자동 생성
- PR 본문에 Ticket 정보 + 검증 결과 포함
- Manual/Smart/Auto 모드 구현
- 검증: 실제 GitHub repo에 PR 생성 테스트
```

### Week 5-6: Dashboard + Integration

#### W5: Web Dashboard

**목표:** 브라우저에서 모든 상태를 확인하고 조작할 수 있는 상태

```
Day 1-2: Dashboard 골격
- Next.js 15 + Tailwind 프로젝트 설정
- API Routes (REST)
- WebSocket 실시간 업데이트
- 레이아웃 + 네비게이션

Day 3-4: 핵심 페이지
- Goal 관리 페이지 (생성, 진행률)
- Ticket Board (Kanban: Pending Approval → Backlog → In Progress → Verification → Done)
  - 승인 대기 Ticket 목록 + [승인] [수정] [거절] UI
- Heartbeat Report 페이지 (보고서 + 제안 목록 + 승인 UI)
- Team Lead 역제안 알림 + 승인 UI
- Agent 목록 + 상태 (Active/Working/Idle)
- Activity Log (실시간 스트림)
- Conventions Editor (CONVENTIONS/ARCHITECTURE/STYLE.md 편집 + 변경 이력)

Day 5: Direct Channel
- Team Lead와 대화 UI (채팅 인터페이스)
- 메시지 → Team Lead Agent로 전달
- Team Lead 응답 실시간 표시
- 대화 로그 저장
```

#### W6: Heartbeat + CLI + 통합

**목표:** 검증된 자율 운영 루프가 작동하는 상태 (계획 승인 → 자율 실행 → QA 검증)

```
Day 1-2: Heartbeat System ("알림+제안" 모드)
- node-cron 기반 주기적 실행
- Context Check 구현 (자율 분석)
- 보고서 + 제안 생성 로직
  - 상황 요약, 새 티켓 제안, 역제안(아이디어)
- Heartbeat Report → Dashboard + Slack/Discord 전달
- 사용자 승인 처리 플로우 ([전체 승인] [개별 검토] [나중에])
- 적응형 간격 조정

Day 3: CLI
- `phalanx init` (프로젝트 초기화)
- `phalanx start` (데몬 시작)
- `phalanx stop` (데몬 중지)
- `phalanx status` (현재 상태)
- `phalanx goal <description>` (Goal 추가)

Day 4: Agent Soul Editor
- Dashboard에서 SOUL.md 편집 UI
- IDENTITY.md 편집 (이름, 아이콘, 색상)
- 변경 이력 추적
- Agent 추가/제거 UI

Day 5: 통합 테스트 + 버그 수정
- E2E: Goal 입력 → Ticket 분해 → 사용자 승인 → Agent 자율 실행 → QA 검증 → PR 생성
- Heartbeat "알림+제안" 모드 동작 확인
- Team Lead 역제안 → 사용자 승인 → 실행 플로우 확인
- Dashboard 실시간 반영 확인
- CLI 전체 플로우 확인
```

---

## 7. 디렉토리 구조

```
phalanx/
├── packages/
│   ├── core/                    # 핵심 엔진
│   │   ├── src/
│   │   │   ├── llm/             # LLM Provider Layer
│   │   │   │   ├── providers/
│   │   │   │   │   ├── anthropic.ts
│   │   │   │   │   ├── openai.ts
│   │   │   │   │   ├── ollama.ts
│   │   │   │   │   └── gemini.ts
│   │   │   │   ├── model-resolver.ts    # 5단계 모델 해석
│   │   │   │   ├── thinking-level.ts    # Thinking Level 제어
│   │   │   │   ├── token-tracker.ts     # 토큰 사용량 추적
│   │   │   │   └── types.ts
│   │   │   ├── tools/           # Tool Layer
│   │   │   │   ├── file-ops.ts
│   │   │   │   ├── git.ts
│   │   │   │   ├── terminal.ts
│   │   │   │   ├── github-pr.ts
│   │   │   │   ├── code-analysis.ts
│   │   │   │   └── tool-registry.ts     # 도구 권한 관리
│   │   │   ├── conventions/     # Team Conventions System
│   │   │   │   ├── analyzer.ts          # 코드베이스 분석 (AST, config 파싱)
│   │   │   │   ├── generator.ts         # 컨벤션 자동 생성
│   │   │   │   ├── loader.ts            # 컨벤션 로드 + Agent prompt 주입
│   │   │   │   ├── validator.ts         # 컨벤션 준수 검증 (QA용)
│   │   │   │   ├── watcher.ts           # 파일 변경 감지 (chokidar)
│   │   │   │   └── types.ts
│   │   │   ├── agents/          # Agent System
│   │   │   │   ├── agent-runner.ts      # Execution Loop
│   │   │   │   ├── agent-registry.ts    # Agent 등록/관리
│   │   │   │   ├── soul-loader.ts       # SOUL/IDENTITY/MEMORY 로드
│   │   │   │   └── roles/               # Role 기본 템플릿
│   │   │   │       ├── team-lead.ts
│   │   │   │       ├── backend.ts
│   │   │   │       ├── frontend.ts
│   │   │   │       ├── qa.ts
│   │   │   │       └── customer.ts
│   │   │   ├── engine/          # Core Engine
│   │   │   │   ├── goal-manager.ts      # Goal CRUD + 진행률
│   │   │   │   ├── ticket-manager.ts    # Ticket CRUD + 상태 머신
│   │   │   │   ├── orchestrator.ts      # 배정 + 실행 + 동시성
│   │   │   │   ├── verification.ts      # Self-Verification Loop
│   │   │   │   ├── pr-controller.ts     # PR 3가지 모드
│   │   │   │   └── heartbeat.ts         # Heartbeat Scheduler
│   │   │   ├── db/              # Data Layer
│   │   │   │   ├── schema.ts            # drizzle-orm 스키마
│   │   │   │   ├── migrations/
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── dashboard/               # Web Dashboard
│   │   ├── src/
│   │   │   ├── app/             # Next.js App Router
│   │   │   │   ├── page.tsx             # 메인 대시보드
│   │   │   │   ├── goals/               # Goal 관리
│   │   │   │   ├── tickets/             # Ticket Board
│   │   │   │   ├── agents/              # Agent 관리 + Soul Editor
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
├── templates/                   # Agent Soul 기본 템플릿
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

# 사용자 프로젝트에 생성되는 구조:
# my-project/
# ├── .phalanx/
# │   ├── CONVENTIONS.md          # 팀 컨벤션
# │   ├── ARCHITECTURE.md         # 아키텍처 결정
# │   ├── STYLE.md                # 코드 스타일
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
# └── (기존 프로젝트 파일들)
```

---

## 8. 핵심 인터페이스 설계

### 8.1 LLM Provider Interface

```typescript
// 모든 LLM Provider가 구현하는 통합 인터페이스
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

// Provider별 Thinking Level 매핑
// Claude: off → none, low → budget 1024, medium → 4096, high → 16384
// OpenAI: reasoning effort parameter
// Gemini: thinking mode toggle
```

### 8.2 Tool Interface

```typescript
interface Tool {
  name: string;
  description: string;
  parameters: z.ZodSchema;          // zod 스키마로 정의
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
  soul: SoulConfig;       // SOUL.md 파싱 결과
  identity: IdentityConfig;
  memory: string;         // MEMORY.md 내용
  skills: SkillsConfig;
  provider: string;       // 예: 'anthropic'
  model: string;          // 예: 'claude-sonnet-4-5-20250929'
  thinkingLevel: ThinkingLevel;
  allowedTools: string[];
  deniedTools: string[];
}

type AgentRole = 'team-lead' | 'backend' | 'frontend' | 'qa' | 'customer' | 'devops';

interface AgentRunner {
  execute(agent: Agent, ticket: Ticket, conventions: TeamConventions): Promise<ExecutionResult>;
  // 내부적으로 Execution Loop 수행:
  // System Prompt 구성 (SOUL + CONVENTIONS 포함) → LLM 호출 → Tool 실행 → 반복 → 결과
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
  approvalStatus: ApprovalStatus;  // CEO↔PM 모델: 사용자 승인 상태
  priority: 'critical' | 'high' | 'medium' | 'low';
  assignedAgent?: string;
  branch?: string;
  prUrl?: string;
  retryCount: number;
  maxRetries: number;
  verification?: VerificationResult;
  dependsOn: string[];       // 다른 Ticket ID
  proposedBy?: string;       // 제안한 주체 ('team-lead' | 'user')
  approvedAt?: Date;         // 사용자 승인 시각
  createdAt: Date;
  updatedAt: Date;
}

// 사용자 승인 상태 (Phase 1: 모든 새 Ticket은 승인 필요)
type ApprovalStatus =
  | 'pending'          // 사용자 승인 대기 중
  | 'approved'         // 승인됨 → 자율 실행 가능
  | 'rejected'         // 거절됨
  | 'modified';        // 수정 후 승인됨

type TicketStatus =
  | 'backlog'
  | 'pending_approval'   // 사용자 승인 대기 (CEO↔PM 모델)
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
  conventions: string;      // CONVENTIONS.md 원본
  architecture: string;     // ARCHITECTURE.md 원본
  style: string;            // STYLE.md 원본
  lastUpdated: Date;
  updatedBy: 'user' | 'team-lead';
}

interface ConventionAnalyzer {
  // 코드베이스 분석 → 컨벤션 초안 생성
  analyze(projectDir: string): Promise<ConventionDraft>;
}

interface ConventionDraft {
  conventions: string;      // 생성된 CONVENTIONS.md
  architecture: string;     // 생성된 ARCHITECTURE.md
  style: string;            // 생성된 STYLE.md
  detectedPatterns: {       // 분석에서 감지한 패턴들
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
  // QA Agent가 사용: 코드가 컨벤션을 준수하는지 검증
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
  rule: string;             // 위반한 컨벤션 규칙
  severity: 'error' | 'warning';
  message: string;
  suggestion?: string;      // 수정 제안
}

interface ConventionProposal {
  id: string;
  proposedBy: 'team-lead';
  reason: string;           // 제안 사유
  diff: string;             // 변경 내용 (diff 형식)
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}
```

---

## 9. 비용 최적화 전략

### 9.1 Thinking Level 기반 비용 제어 (가장 핵심)

| 작업 유형 | Thinking Level | 예상 비용 비율 |
|-----------|---------------|---------------|
| Goal 분해, 아키텍처 결정 | HIGH | 1x (기준) |
| 코드 작성, 리팩토링 | MEDIUM | 0.6x |
| QA 검증, lint 검사 | LOW | 0.3x |
| 단순 파일 읽기/정리 | OFF | 0.1x |

### 9.2 Model Tiering

| Agent Role | Primary Model | Cost | Fallback |
|------------|--------------|------|----------|
| Team Lead | claude-opus-4-6 | $$$$ | gpt-4o |
| Backend/Frontend | claude-sonnet-4-5 | $$ | gpt-4o-mini |
| QA | claude-haiku-4-5 | $ | gpt-4o-mini |
| Customer | claude-haiku-4-5 | $ | gpt-4o-mini |

### 9.3 추가 절감 전략

- **Adaptive Heartbeat**: 변화 적으면 간격 확장 (30분 → 2시간)
- **Idle Detection**: 할 일 없는 Agent는 토큰 소비 0
- **Batch Processing**: 비긴급 Ticket은 모아서 처리
- **Ollama Fallback**: 단순 작업은 로컬 모델 활용 (무료)
- **Token Budget**: 일별/Goal별 한도 설정, 초과 시 사용자 알림

---

## 10. 위험 완화 전략

### 10.1 코드 품질 위험

| 위험 | 완화 |
|------|------|
| LLM이 잘못된 코드 생성 | Self-Verification Loop (QA 검증 필수) |
| 테스트 없이 머지 | Smart Mode 기본: 테스트 통과 필수 |
| 오류 전파 (한 Agent 실패가 다음에 영향) | Notepad 시스템으로 학습 전파 |
| 무한 retry 루프 | maxRetries 제한 (기본 3회) + 에스컬레이션 |
| 코드 일관성 부족 (Agent마다 다른 스타일) | Team Conventions 시스템 (CONVENTIONS.md 공통 주입) |

### 10.2 비용 위험

| 위험 | 완화 |
|------|------|
| 예상 초과 비용 | Token budget + 일별 한도 + 초과 알림 |
| Debate 모드 비용 폭발 | Smart Mode 기본값 (중요 결정만 debate) |
| Heartbeat 과다 실행 | Adaptive interval |

### 10.3 컨텍스트 윈도우 위험

| 위험 | 완화 |
|------|------|
| 대화 길이 초과 | oh-my-opencode context-window-monitor 패턴 적용 |
| 거대 파일 분석 | 파일 청크 분할 + AST 기반 선택적 로드 |
| 컨벤션 파일이 너무 길어짐 | 컨벤션 요약 버전 자동 생성 (프롬프트용) |

### 10.4 보안 위험

| 위험 | 완화 |
|------|------|
| 위험한 명령어 실행 | terminal_exec allowlist + 타임아웃 |
| 민감 파일 접근 | 프로젝트 디렉토리 제한 + 경로 차단 목록 |
| API 키 노출 | 환경변수 관리 + .env 커밋 방지 |

---

## 부록: MVP 이후 확장 계획 (Phase 2-3)

### Phase 2 (+4주)
- Ollama 로컬 모델 지원
- Debate System (Smart Mode)
- GitHub Issues / Jira / Linear 연동
- Slack / Discord 알림
- 자동 문서화 (Daily Log, Meeting Minutes)
- 비용 추적 대시보드

### Phase 3 (미래)
- Team Meeting 시스템
- Multi-team 지원
- Plugin 시스템
- Community 템플릿
- DevOps Agent (CI/CD)

---

## 결론

**구현 가능성: 높음**

모든 핵심 구성요소가 OpenClaw과 oh-my-opencode에서 검증된 패턴을 가지고 있습니다.
특히 oh-my-opencode의 Planning Triad(Prometheus/Metis/Momus) → Atlas 실행 패턴은
Phalanx의 Team Lead → Agent 실행 구조와 거의 1:1 매핑됩니다.

핵심 차별점인 **"검증된 자율 (Verified Autonomy)"** 은 기존 레퍼런스의 패턴을 확장하여 구현 가능하며,
CEO↔PM 모델(계획 승인 → 자율 실행 → QA 검증)로 사용자 신뢰를 점진적으로 축적합니다.
LLM Provider의 Thinking Level 기능을 적극 활용하면 별도 planning agent 없이도
비용 효율적인 의사결정이 가능합니다.

Phase 1에서 "알림+제안" 수준의 Heartbeat로 시작하고, 신뢰가 쌓이면 Phase 2+에서
자율 범위를 확대하는 전략은 사용자 수용성과 제품 안정성 모두를 확보합니다.
