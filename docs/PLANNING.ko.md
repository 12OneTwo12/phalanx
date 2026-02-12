# Autopilot Team - Product Planning Document

> Goal-Oriented Autonomous AI Agent Team Orchestrator

## 1. Problem Statement

현재 AI Agent 도구들의 한계:

| 유형 | 한계 |
|------|------|
| **멀티 에이전트 프레임워크** | Task-oriented. 워크플로우를 사전 정의해야 함. "이 작업 해" 방식 |
| **개인 AI 비서** | Single Agent. 개인 비서 수준. 팀 단위 협업 불가 |
| **세션 기반 에이전트 팀** | 세션 내 일회성. 장기 목표 추구 불가. heartbeat 없음 |
| **코드 기반 오케스트레이터** | 개발자 전용. 그래프 정의 필요. 비개발자 접근 불가 |

**공통 문제**: "이 Task를 실행해"는 가능하지만, "이 Goal을 향해 계속 알아서 일해"는 불가능.

## 2. Solution: Autopilot Team

### Core Concept

```
[사용자] → 장기 목표(Goal) 설정 + Agent 구성
              ↓
      [Autopilot Team Daemon] ← 단일 프로세스. 설치 한 번이면 끝.
              ↓
      [Team Lead Agent] ← Heartbeat (내장 스케줄러)
              ↓
      Goal을 Epic → Ticket으로 분해 (LLM)
      사용자에게 계획 제출 → [승인] [수정] [거부]
              ↓
      [Orchestrator] ← 승인된 티켓이 실행 큐에 진입
              ↓
      LLM이 각 Ticket 분석 → 최적 Agent 선택/생성
      티켓별 SOUL/SKILLS/Model 구성 (LLM 최적화)
         ↓        ↓        ↓
      Agent #1   Agent #2   Agent #3
         ↓        ↓        ↓
      각 Agent는 최적으로 선택된 Provider & Model 사용
         ↓        ↓        ↓
      코드 작성 → QA 검증 → Customer 검증
         ↓        ↓        ↓
      PR 생성 → 사용자 승인 or AI 자동 Merge
              ↓
      Goal 진행률 업데이트 → 다음 Ticket or Goal 완료
              ↓
   [보고] → Slack / Discord / Dashboard (내장)
```

### Team Lead vs Orchestrator: 역할 분리

| 구분 | Team Lead (PM Agent) | Orchestrator (LLM 강화 엔진) |
|------|---------------------|-------------------------------|
| **본질** | LLM 기반 AI 에이전트 | LLM 추론 + 시스템 코드 하이브리드 |
| **역할** | 무엇을 할지 (기획) | 누가, 어떻게 실행할지 |
| **Goal 분해** | Goal → Epic → Ticket (LLM) | — |
| **에이전트 할당** | — | LLM 기반 티켓 분석 → 최적 에이전트 선택/생성 |
| **에이전트 생성** | — | LLM이 티켓별 커스텀 SOUL/SKILLS 생성 |
| **모델 선택** | — | 복잡도 기반 최적 Provider/Model |
| **Heartbeat** | 컨텍스트 분석 + 보고서 생성 | 스케줄러 관리 |
| **제안** | 제안 생성 (LLM) | 승인된 제안 실행 |
| **검증** | — | QA 검증 파이프라인 |
| **PR 관리** | — | PR 생성 + 머지 결정 |
| **사용자 소통** | Direct Channel 대화 | — |

### 핵심 차별점

```
기존 도구:      "이 5개 Task를 순서대로 실행해"
Autopilot Team: "이 Goal을 달성하기 위해 필요한 일을 스스로 찾아서 계속 해"

기존 AI 코딩:   세션 단위. 끝나면 끝.
Autopilot Team: Goal → 티켓 → PR → Merge → 다음 티켓 → ... (끝날 때까지 반복)

기존 AI 코딩 도구: 특정 플랫폼에 종속. 그 플랫폼이 막으면 끝.
Autopilot Team:   Multi-Provider. 어떤 LLM이든 교체 가능. 플랫폼 독립적.
```

## 3. Target User

### 1~3인 스타트업이 AI로 팀을 꾸리는 것

```
┌─────────────────────────────────────────────────────────┐
│  Before (현재)                                           │
│                                                         │
│  창업자 1명이:                                           │
│    기획도 하고, 코드도 짜고, 디자인도 하고,               │
│    QA도 하고, 배포도 하고, 마케팅도 하고...               │
│    → 하루 16시간 일해도 부족                              │
│                                                         │
│  After (Autopilot Team)                                 │
│                                                         │
│  창업자 = CEO. 방향만 잡는다.                             │
│    기획 → PM Agent                                      │
│    백엔드 → Backend Agent(s)                             │
│    프론트 → Frontend Agent(s)                            │
│    검증 → QA Agent                                      │
│    사용자 관점 → Customer Agent                          │
│    → 창업자는 방향 설정과 최종 승인만                     │
└─────────────────────────────────────────────────────────┘
```

**핵심 가치 제안:**
> "AI 팀이 80%를 자율로 처리하고, 나머지 20%를 PR로 깔끔하게 돌려드립니다.
> 모든 코드는 팀 컨벤션을 따르고, QA가 검증한 후에만 PR이 생성됩니다.
> 당신은 CEO로서 방향만 잡으세요. Team Lead가 계획을 세워 승인을 받고, 승인된 일은 팀이 알아서 합니다."

## 4. Key Features

### 4.1 Goal-Driven Autonomy (목표 기반 자율 운영)

- 단순 Task가 아닌 **장기 목표(Goal)** 를 입력
- Team Lead Agent가 목표를 분석하여 **하위 Task를 자동 생성** → **반드시 사용자 승인 후 실행**
- 승인된 티켓은 Agent가 자율적으로 실행 (사용자 개입 불필요)
- Heartbeat를 통해 주기적으로 목표 달성 현황을 점검하고 **새로운 제안을 사용자에게 보고**

#### CEO ↔ PM 관계 모델

```
┌─────────────────────────────────────────────────────────────┐
│              현실 스타트업                AI 팀              │
│                                                             │
│  CEO (사장)           =    사용자 (인간)                      │
│  PM (팀장)            =    Team Lead Agent                   │
│  개발자/디자이너       =    Backend/Frontend/QA Agent          │
│                                                             │
│  CEO → PM: "이거 해"              사용자 → Team Lead: Goal 설정│
│  PM → CEO: "이렇게 할까요?"       Team Lead → 사용자: 계획 제출│
│  CEO: "승인"                      사용자: "승인"               │
│  PM → 팀원: "이거 해"             Team Lead → Agent: 티켓 배정 │
│  팀원: (알아서 작업)               Agent: (자율 실행)           │
│  PM → CEO: "다 됐습니다"          Team Lead → 사용자: PR 보고  │
│                                                             │
│  PM → CEO: "이런 것도 하면 어때요?" ← Team Lead 역제안 기능    │
│  CEO: "좋아 해" or "아니야"        사용자: 승인 or 거절         │
└─────────────────────────────────────────────────────────────┘
```

#### 핵심 원칙: "계획은 승인받고, 실행은 자율로"

```
Phase 1 원칙:

  ✅ Team Lead가 자율로 하는 것:
     - Goal 분석 및 티켓 분해 계획 수립
     - 승인된 티켓의 Agent 배정 및 실행 관리
     - QA/Customer 검증 루프 운영
     - PR 생성 및 Smart Mode 자동 머지 (규칙 내)
     - 사용자에게 아이디어/개선점 역제안

  🔒 반드시 사용자 승인이 필요한 것:
     - Goal → 티켓 분해 결과 (계획 승인)
     - 새로운 Agent 채용
     - 비용 임계치 초과
     - Smart Mode 규칙 밖의 PR (고위험 변경)
     - Team Lead의 역제안 실행
```

**예시 시나리오:**

**예시 A: 비즈니스 목표**
```
Goal: "Upvy 앱의 MAU를 3개월 내 5만으로 늘린다"

1. Team Lead 분석 → 계획 제출 (사용자 승인 대기):
   "현재 MAU 1.2만. 리텐션율 낮음 (D7: 15%). 다음 계획을 제안합니다:"
   → 티켓 #1: "온보딩 플로우 개선안 작성" → 기획 Agent 배정 예정
   → 티켓 #2: "푸시 알림 최적화 조사" → 마케팅 Agent 배정 예정
   [승인] [수정 후 승인] [거절]

2. 사용자: "승인"

3. Agent들 자율 실행 (사용자 개입 불필요):
   → 기획 Agent가 온보딩 개선안 작성
   → QA 검증 → Customer 검증 → PR 생성
   → Smart Mode 규칙에 따라 자동/수동 머지

4. 2주 후 Heartbeat → Team Lead가 보고 + 제안:
   "리텐션 D7: 15% → 18% 개선. 다음 단계를 제안합니다:"
   → 새 티켓: "인앱 메시지 시스템 도입" [승인 대기]
```

**예시 B: Team Lead의 역제안 (아이디어 올리기)**
```
Team Lead → 사용자 (Direct Channel):
  "코드베이스를 분석한 결과, API 응답 시간이 평균 800ms로 느립니다.
   이것이 리텐션에 영향을 주고 있을 수 있습니다.

   제안: 'API 응답 시간 최적화' 티켓을 추가할까요?
   예상 작업: 캐시 레이어 도입 + DB 쿼리 최적화
   예상 효과: 응답 시간 800ms → 200ms

   [승인] [나중에] [불필요]"

사용자: "승인"
→ 티켓 자동 생성 → Agent 배정 → 자율 실행
```

**예시 C: 엔지니어링 목표**
```
Goal: "ShopMall 모놀리식 백엔드를 3개월 내 MSA로 전환한다"

1. Team Lead 분석 → 계획 제출:
   "코드베이스 분석 완료. 12개 도메인 중 결합도가 낮은 것부터 분리를 제안합니다:"
   → Epic #1: "인증(Auth) 서비스 분리" (결합도 0.3 - 가장 독립적)
     → 티켓 #1: "Auth 도메인 경계 분석"
     → 티켓 #2: "Auth 서비스 독립 모듈 생성"
     → 티켓 #3: "API Gateway 라우팅 설정"
   [승인] [수정 후 승인] [거절]

2. 사용자: "승인"

3. Agent들 자율 실행 → 티켓 순서대로 처리 → 각 PR 생성

4. Epic #1 완료 후 Team Lead:
   "Auth 서비스 분리 완료 (1/12). 다음으로 '상품(Product) 서비스 분리'를 제안합니다."
   [승인 대기]
```

### 4.2 Execution Capability (독립 실행 엔진 — Multi-Provider)

Autopilot Team은 특정 AI 플랫폼에 종속되지 않는다.
**독립된 단일 Daemon 프로세스**로 동작하며, 다양한 LLM Provider를 교체하여 사용할 수 있다.

#### 4.2.1 Standalone Daemon Architecture

Autopilot Team은 **단일 프로세스(Daemon)** 로 동작한다.
설치 한 번이면 끝. 별도 서버나 플랫폼 가입이 필요 없다.

```
설치:  npm install -g autopilot-team
실행:  autopilot-team start
접속:  http://localhost:3000 (내장 Dashboard)
```

**내장 구성요소 (하나의 프로세스에 모두 통합):**

```
┌─────────────────────────────────────────────────────────┐
│              Autopilot Team Daemon (단일 프로세스)         │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Web Dashboard (:3000)                           │    │
│  │  - Goal 관리, Ticket Board, Agent 설정, Logs     │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Heartbeat Scheduler (내장 스케줄러)              │    │
│  │  - 주기적 자율 판단, Adaptive Interval            │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Ticket Manager                                  │    │
│  │  - Goal → 티켓 분해, 우선순위, 상태 관리          │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  LLM Provider Layer (Multi-Provider)             │    │
│  │  - Claude / OpenAI / Ollama / Gemini / ...       │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Tool Layer (자체 실행 레이어)                     │    │
│  │  - 파일 조작, Git, 터미널, GitHub API, 코드 분석  │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Notification (Slack / Discord / Webhook)        │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  모든 것이 하나의 프로세스에 통합.                        │
│  외부 의존성: LLM API Key만 있으면 동작.                  │
└─────────────────────────────────────────────────────────┘
```

#### 4.2.2 Multi-Provider LLM Layer

**특정 AI 플랫폼에 종속되지 않는다.** Provider를 바꿔도 나머지 시스템은 그대로 동작한다.

**지원 Provider:**

| Provider | 모델 예시 | 특징 |
|----------|----------|------|
| **Claude API** | Opus / Sonnet / Haiku | 코딩 품질 우수 |
| **OpenAI** | GPT-4o / Codex | 범용성 높음 |
| **Ollama (로컬)** | Llama / Mistral / CodeLlama | 무료, 프라이버시 |
| **Gemini** | Gemini Pro / Flash | Google 생태계 |
| **Mistral** | Mistral Large / Medium | 유럽 대안 |
| **Custom** | 사용자 지정 엔드포인트 | 자체 호스팅 모델 |

**Unified Agent Interface:**

모든 Provider는 동일한 인터페이스로 추상화된다:

```typescript
interface AgentLLM {
  generateCode(prompt: string, context: FileContext[]): Promise<CodeResult>;
  reviewCode(code: string, criteria: string[]): Promise<ReviewResult>;
  runCommand(command: string): Promise<CommandResult>;
  analyzeFile(filePath: string): Promise<AnalysisResult>;
}
```

- Agent별로 **다른 Provider/모델** 설정 가능
  - 예: Team Lead = Claude Opus, Backend Agent = OpenAI GPT-4o, QA Agent = Ollama Llama
- Provider를 바꿔도 **Tool Layer는 그대로 동작**
- 특정 Provider가 장애 나면 **fallback Provider로 자동 전환** 가능

#### 4.2.3 Tool Layer (자체 실행 레이어)

**LLM은 "무엇을 할지" 판단하고, Tool Layer가 "실제로 실행"한다.**

이 구조 덕분에 LLM Provider를 바꿔도 실행 레이어는 전혀 영향 없이 동작한다.

| Tool | 구현 기술 | 하는 일 |
|------|----------|---------|
| **파일 읽기/쓰기/수정** | Node.js `fs` 모듈 | 소스 코드 CRUD |
| **Git 조작** | `simple-git` | branch 생성, commit, push |
| **터미널 명령 실행** | `child_process` (`execa`) | 테스트, 빌드, lint 실행 |
| **GitHub PR 생성** | `octokit` (GitHub API) | PR 생성, 리뷰 요청, Merge |
| **코드 분석** | AST 파싱 (ts-morph 등) | 구조 분석, 의존성 파악 |
| **파일 변경 감지** | `chokidar` | 실시간 파일 변경 모니터링 |

```
┌─────────────────────────────────────────────────────────┐
│                LLM Provider (어떤 것이든)                  │
│                "이 파일을 수정하고 테스트 실행해"            │
│                         │                                │
│                         ▼                                │
│  ┌──────────────────────────────────────────────────┐    │
│  │              Tool Layer (자체 구현)                │    │
│  │                                                   │    │
│  │  fs.writeFile() → Git commit → execa('npm test') │    │
│  │  → octokit.createPR() → 결과를 LLM에 반환        │    │
│  └──────────────────────────────────────────────────┘    │
│                                                         │
│  LLM Provider를 Claude → OpenAI로 바꿔도                 │
│  Tool Layer는 동일하게 동작한다.                           │
└─────────────────────────────────────────────────────────┘
```

#### 4.2.4 티켓 기반 실행 플로우

```
┌─────────────────────────────────────────────────────────┐
│              Ticket Execution Flow                        │
│                                                         │
│  1. Team Lead가 Goal을 Epic → Ticket으로 분해            │
│     → 사용자에게 승인 요청                               │
│     ↓                                                   │
│  2. 사용자 승인 → 티켓이 Orchestrator 큐에 진입          │
│     ↓                                                   │
│  3. Orchestrator가 각 Ticket을 LLM으로 분석:             │
│     - 필요한 역할, 기술 스택, 복잡도 결정                │
│     - 최적 Agent 선택 또는 생성                          │
│     - 해당 티켓에 맞는 SOUL/SKILLS 구성                  │
│     - 작업에 최적인 Provider/Model 선택                  │
│     ┌──────────────────────────────────────────────┐    │
│     │  티켓: "결제 API 구현"                         │    │
│     │                                               │    │
│     │  Orchestrator 분석:                           │    │
│     │    역할: backend, 도메인: payment              │    │
│     │    복잡도: high → 모델: Claude Opus            │    │
│     │                                               │    │
│     │  생성/선택된 Agent: payment-specialist          │    │
│     │    Provider: Claude API                       │    │
│     │    Model: Opus (높은 복잡도)                   │    │
│     │    Soul: 커스텀 SOUL.md (결제 전문가)           │    │
│     │    Skills: Stripe, PG 연동, 보안               │    │
│     │                                               │    │
│     │  사용 도구:                                    │    │
│     │    - 파일 읽기/쓰기 (fs)                       │    │
│     │    - Git 조작 (simple-git)                    │    │
│     │    - 터미널 실행 (execa)                       │    │
│     │    - GitHub PR (octokit)                      │    │
│     └──────────────────────────────────────────────┘    │
│     ↓                                                   │
│  4. Agent가 코드 작성 → QA 검증 → Customer 검증         │
│     ↓                                                   │
│  5. branch 생성 → PR 생성                               │
│     ↓                                                   │
│  5-A. Manual Mode → 사용자가 PR Review 후 Merge         │
│  5-B. Smart Mode → AI가 판단하여 자동 Merge or 대기     │
│  5-C. Auto Mode → 검증 통과 시 자동 Merge               │
│     ↓                                                   │
│  6. 티켓 완료 → 다음 티켓으로                            │
│                                                         │
│  LLM이 해주는 것: 코드 생성, 리뷰, 판단                  │
│  Tool Layer가 해주는 것: 파일 조작, Git, 테스트 실행, PR  │
│  우리가 하는 것: 오케스트레이션, UI, Soul 주입, PR 관리   │
└─────────────────────────────────────────────────────────┘
```

#### 4.2.5 Agent 역할별 구성

| Agent 역할 | 하는 일 | 기본 모델 | 도구 |
|-----------|--------|----------|------|
| **Team Lead** | Goal→티켓 분해, 우선순위, Heartbeat | 고성능 모델 (Opus/GPT-4o) | LLM API 직접 호출 |
| **Backend Agent** | API, 서버 코드, DB 스키마 작성 | 균형 모델 (Sonnet/GPT-4o) | 파일, Git, 터미널, GitHub |
| **Frontend Agent** | UI 컴포넌트, 페이지, 스타일링 | 균형 모델 (Sonnet/GPT-4o) | 파일, Git, 터미널, GitHub |
| **QA Agent** | 테스트 작성/실행, 코드 품질 체크 | 경량 모델 (Haiku/GPT-4o-mini) | 파일, 터미널 |
| **Customer Agent** | 사용자 관점 UX 검증, 피드백 | 경량 모델 (Haiku/GPT-4o-mini) | 파일, 터미널 |
| **DevOps Agent** | CI/CD, 배포 설정 | 균형 모델 (Sonnet/GPT-4o) | 파일, Git, 터미널 |

> **참고:** 위 모델은 기본값입니다. Orchestrator의 `ModelSelector`가 티켓 복잡도 분석에 따라 동적으로 모델을 변경합니다 (high → Opus, medium → Sonnet, low → Haiku). 사용자도 Dashboard에서 Agent별로 직접 변경할 수 있습니다.

**사용자는 Dashboard에서 Agent별 Provider와 모델을 변경할 수 있다:**

```
┌────────────────────────────────────────────────────────┐
│  Agent Settings                                         │
│                                                         │
│  Backend Agent:                                         │
│    Provider: [Claude ▾] [OpenAI ▾] [Ollama ▾]          │
│                ✅ 선택됨                                 │
│    Model:    [Opus ▾] [Sonnet ▾] [Haiku ▾]             │
│                        ✅ 선택됨                         │
│                                                         │
│  QA Agent:                                              │
│    Provider: [Claude ▾] [OpenAI ▾] [Ollama ▾]          │
│                ✅ 선택됨                                 │
│    Model:    [Opus ▾] [Sonnet ▾] [Haiku ▾]             │
│                                   ✅ 선택됨              │
│                                                         │
│  Customer Agent:                                        │
│    Provider: [Claude ▾] [OpenAI ▾] [Ollama ▾]          │
│                          ✅ 선택됨                       │
│    Model:    [GPT-4o ▾] [GPT-4o-mini ▾]                │
│                          ✅ 선택됨                       │
│                                                         │
│  Provider 비용 참고:                                     │
│    Claude Opus: 복잡한 판단 ($$$)                        │
│    Claude Sonnet / GPT-4o: 균형 ($$)                    │
│    Haiku / GPT-4o-mini / Ollama: 빠르고 저렴 ($ or 무료)│
│                                                         │
│  [Save]  [Test Connection]                              │
└────────────────────────────────────────────────────────┘
```

#### 4.2.6 Self-Verification Loop (자체 검증 루프)

**사람이 매번 확인하지 않아도 되는 핵심 구조:**

```
┌─────────────────────────────────────────────────────────┐
│              Self-Verification Loop                      │
│                                                         │
│  1. Backend Agent가 코드 작성                            │
│     ↓                                                   │
│  2. QA Agent가 자동 검증                                 │
│     ├ 유닛 테스트 작성 + 실행                             │
│     ├ 통합 테스트 실행                                    │
│     ├ 코드 품질 체크 (lint, 타입 체크)                    │
│     └ 결과: Pass / Fail + 상세 리포트                    │
│     ↓                                                   │
│  3. Customer Agent가 사용자 관점 검증                     │
│     ├ "사용자가 이걸 쉽게 찾을 수 있는가?"                │
│     ├ "플로우가 자연스러운가?"                            │
│     └ 결과: 합격 / 개선 필요 + 피드백                    │
│     ↓                                                   │
│  4-A. 합격 → 티켓 완료. PR 생성.                         │
│  4-B. 실패 → 피드백과 함께 원래 Agent에게 반환            │
│     ↓                                                   │
│  5. Agent가 피드백 반영하여 재작업                        │
│     → 2번으로 돌아감 (최대 N회 반복)                      │
│     → N회 초과 시 사용자에게 Escalation                   │
│                                                         │
│  사용자는 이 루프가 돌아가는 동안 개입 불필요.             │
│  결과만 Dashboard에서 확인하면 됨.                        │
└─────────────────────────────────────────────────────────┘
```

#### 4.2.7 PR 기반 결과 관리 및 승인

티켓의 최종 결과물은 항상 **GitHub PR**로 생성된다.

**PR 승인 모드 (3가지):**

| 모드 | 설명 | 적합한 상황 |
|------|------|------------|
| **Manual** | 모든 PR을 사용자가 직접 Review + Merge | 초기 신뢰 구축 단계, 중요 프로젝트 |
| **Smart** | AI가 변경 규모/위험도 판단하여 자동 Merge or 대기 | 일반적 운영 (권장) |
| **Auto** | QA + Customer 검증 통과 시 자동 Merge | 신뢰도 높은 반복 작업 |

**Smart Mode 규칙 예시:**
```
자동 Merge 조건:
  - 변경 파일 5개 이하
  - auth, payment 등 민감 키워드 미포함
  - QA 테스트 전체 통과
  - Customer Agent 합격

사용자 승인 필요:
  - 변경 파일 5개 초과
  - 민감 경로 (auth/, payment/, config/) 변경
  - 새로운 의존성 추가
  - DB 스키마 변경
```

#### 4.2.8 티켓 관리 및 외부 연동

Dashboard에서 티켓 보드를 제공한다:

```
┌─────────────────────────────────────────────────────────┐
│  Ticket Board                             [Goal #1 ▾]   │
│                                                         │
│  Backlog      │ In Progress  │ Verification │ Done      │
│  ─────────────│──────────────│──────────────│─────────  │
│  ┌──────────┐ │ ┌──────────┐│ ┌──────────┐ │ ┌──────┐  │
│  │ T-004    │ │ │ T-002    ││ │ T-001    │ │ │T-000 │  │
│  │ 푸시 알림│ │ │ 결제 API ││ │ 온보딩   │ │ │셋업  │  │
│  │ P2       │ │ │ Dev-A    ││ │ QA 검증중│ │ │완료  │  │
│  │          │ │ │ PR #12   ││ │ PR #11   │ │ │      │  │
│  └──────────┘ │ └──────────┘│ └──────────┘ │ └──────┘  │
│  ┌──────────┐ │             │              │            │
│  │ T-005    │ │             │              │            │
│  │ 캐시 최적│ │             │              │            │
│  │ P3       │ │             │              │            │
│  └──────────┘ │             │              │            │
└─────────────────────────────────────────────────────────┘
```

**외부 이슈 트래커 연동 (Phase 2+):**

| 서비스 | 연동 방식 | 상태 |
|--------|----------|------|
| **GitHub Issues** | 양방향 동기화 (Issue ↔ Ticket) | Phase 2 |
| **Jira** | Jira Issue → Ticket 자동 생성 | Phase 2 |
| **Linear** | Linear Issue ↔ Ticket 동기화 | Phase 3 |

#### 4.2.9 실행 시나리오

**시나리오 A: "결제 기능 추가"**
```
1. PM Agent: Goal "결제 전환율 3%" 분석 →
   티켓 생성: "Toss Payments 연동 결제 API 구현"

2. Backend Agent(s):
   - Provider: Claude Sonnet (또는 사용자가 설정한 Provider)
   - 결제 API 엔드포인트 설계
   - Toss Payments SDK 연동 코드 작성
   - 결제 상태 관리 로직 구현
   - [토론 ON일 경우] 두 Agent가 설계 방식 토론 후 결정
   - [토론 OFF일 경우] 단일 Agent가 바로 구현
   - Tool Layer가 실제 파일 생성/수정, Git commit 수행

3. Frontend Agent(s):
   - Provider: OpenAI GPT-4o (또는 사용자가 설정한 Provider)
   - 결제 UI 컴포넌트 구현
   - 결제 플로우 (상품 선택 → 결제 → 완료) 페이지 작성

4. QA Agent:
   - Provider: Claude Haiku (경량 모델로 비용 절약)
   - 결제 성공/실패/취소 케이스 테스트 자동 작성
   - 결제 금액 정합성 테스트
   - Tool Layer로 테스트 실행 → 실패 시 Backend Agent에게 반환

5. Customer Agent:
   - 실제 결제 플로우를 사용자 관점에서 체험
   - "결제 버튼까지 3클릭 필요 → 2클릭으로 줄이는 게 좋겠다"
   - 피드백을 PM Agent에게 전달

6. PM Agent:
   - QA 통과 + Customer 합격 확인
   - Tool Layer가 GitHub PR 자동 생성
   - Smart Mode: 결제 관련이므로 사용자 승인 대기
   - 승인 후 Merge → 티켓 완료
   - Daily Log에 결과 기록
```

**시나리오 B: "모놀리식 → MSA 전환"**
```
1. Team Lead: Goal "ShopMall 모놀리식을 MSA로 전환" 분석 →
   코드베이스 분석 → 도메인 경계 식별 →
   티켓 생성: "인증(Auth) 서비스 분리"

2. Backend Agent(s):
   - Provider: Claude Sonnet (또는 사용자가 설정한 Provider)
   - 기존 모놀리스의 Auth 관련 코드 분석 (AST 파싱)
   - Auth 서비스용 독립 모듈 생성
   - API Gateway 라우팅 설정
   - 기존 코드에서 Auth 의존성 제거 (점진적 분리)
   - [토론 ON일 경우] "Strangler Fig vs Big Bang 전환" 토론
   - Tool Layer가 실제 파일 생성/수정, Git commit 수행

3. DevOps Agent:
   - Docker Compose 멀티 서비스 구성
   - 서비스 간 통신 설정 (REST / gRPC)
   - 독립 배포 파이프라인 구성

4. QA Agent:
   - Provider: Claude Haiku (경량 모델로 비용 절약)
   - 서비스 간 통합 테스트 작성
   - 기존 기능 회귀 테스트 실행
   - API 계약(Contract) 테스트
   - Tool Layer로 테스트 실행 → 실패 시 Backend Agent에게 반환

5. Customer Agent:
   - 분리 후에도 기존 기능이 동일하게 동작하는지 검증
   - "로그인 → 상품 조회 → 결제" 전체 플로우 확인
   - 응답 시간이 기존 대비 악화되지 않았는지 체크

6. Team Lead:
   - QA 통과 + Customer 합격 확인
   - Tool Layer가 GitHub PR 자동 생성
   - Smart Mode: Auth 서비스 분리는 큰 변경이므로 사용자 승인 대기
   - 승인 후 Merge → 다음 서비스 분리 티켓으로 진행
   - 전체 진행률 업데이트: "Auth 서비스 분리 완료 (3/12 서비스)"
```

### 4.3 Agent Hiring & Team Composition (에이전트 채용 시스템)


- 목표에 맞는 Agent를 자동으로 **채용(Hire)** / **해고(Fire)**
- 각 Agent에 **페르소나(개성)** 부여
- **같은 역할의 Agent는 반드시 최소 2명 이상** 배치 (Minimum Pair Rule)
  - 1명만 있으면 편향된 판단 위험 → 최소 2명이 토론하여 결론 도출
  - 필요에 따라 3명, 4명 등 **더 많은 개성 있는 Agent**로 역할군 구성 가능
  - 예: 백엔드 3명 (성능파, 속도파, 보안파) → 다각적 관점에서 더 풍부한 토론
  - Team Lead만 예외적으로 1명 (최종 결정권자)
  - Agent 수는 Team Lead가 목표 복잡도에 따라 판단하여 사용자에게 추천

**Agent 타입 예시:**
```yaml
team:
  lead:
    name: "PM Kim"
    persona: "데이터 중심 사고. 항상 지표로 판단. 보수적 성향."
    pair: false  # Team Lead만 예외적으로 단독

  backend:  # 최소 2명, 필요시 더 많이
    - name: "Dev-A"
      persona: "성능 최적화 덕후. 항상 벤치마크를 원함."
    - name: "Dev-B"
      persona: "빠른 출시 우선. 완벽보다 빠른 배포를 선호."
    - name: "Dev-C"  # 선택적 - 보안이 중요한 프로젝트에서 추가 채용
      persona: "보안 최우선. OWASP Top 10을 항상 체크. 취약점에 민감."

  frontend:  # 최소 2명
    - name: "Front-A"
      persona: "접근성과 시맨틱 마크업 중시. 표준 준수파."
    - name: "Front-B"
      persona: "인터랙션과 애니메이션 중시. UX 감성파."

  designer:  # 최소 2명
    - name: "UX-A"
      persona: "사용자 심리 전문. 항상 사용자 테스트 데이터를 요구."
    - name: "UX-B"
      persona: "비주얼 디자인 중심. 브랜드 일관성과 미적 완성도 추구."

  # Team Lead가 목표에 따라 동적으로 역할군 인원을 결정
  # 예: "보안 감사가 필요하다" → 백엔드에 보안 전문 Agent 추가 채용
  # 예: "글로벌 진출이 목표" → i18n 전문 Frontend Agent 추가 채용
```

#### 4.3.1 Agent Soul System (에이전트 영혼 체계)

각 Agent에게 부여되는 **정체성 체계**.
페르소나(persona)가 "한 줄짜리 설명"이었다면, Soul은 **"이 Agent가 누구인지"의 전체 정의**다.

> "SOUL.md는 시스템 프롬프트가 아니라 매니페스토다.
> 시스템 프롬프트는 '무엇을 해라'를 말하지만, Soul은 '너는 누구인가'를 말한다."

**Agent 하나당 다음 4개의 정체성 파일을 갖는다:**

```
agents/
  dev-a/
    SOUL.md        # 이 Agent의 영혼 — 가치관, 성격, 판단 기준
    IDENTITY.md    # 외부 표현 — 이름, 아이콘, 커뮤니케이션 스타일
    MEMORY.md      # 개인 기억 — 경험에서 배운 것, 선호 패턴
    SKILLS.md      # 기술 능력 — 사용 가능한 도구, 전문 분야
```

##### SOUL.md — "넌 누구야"

Agent의 **철학, 가치관, 성격**을 정의. 단순 지시가 아니라 "이 Agent가 세상을 어떻게 바라보는가".

```markdown
# Dev-A의 Soul

## Core Identity
넌 챗봇이 아니야. 넌 10년차 백엔드 엔지니어야.
성능에 대한 집착이 있고, "나중에 최적화하자"라는 말을 제일 싫어해.

## Values (가치관)
- 측정 없는 최적화는 추측이다. 항상 벤치마크 먼저.
- 코드는 읽히기 위해 쓰인다. 하지만 읽기 좋은 코드가 느릴 이유는 없다.
- 기술 부채는 이자가 붙는다. 지금 30분 투자가 나중에 3일을 아낀다.

## Opinions (의견)
- ORM은 편하지만 위험하다. 복잡한 쿼리는 반드시 raw SQL로.
- 마이크로서비스가 항상 답은 아니다. 모놀리스가 맞을 때도 있다.
- "일단 동작하게"보다 "제대로 동작하게"를 선호한다.

## Boundaries (경계)
- 근거 없는 주장에는 반드시 반론한다.
- 하지만 상대방이 데이터로 설득하면 기꺼이 의견을 바꾼다.
- 모르는 건 모른다고 말한다.

## Debate Style (토론 스타일)
- 직설적. 돌려 말하지 않는다.
- 상대 의견의 장점을 먼저 인정한 후 반론.
- 감정이 아닌 데이터와 경험으로 설득.
```

##### IDENTITY.md — "넌 어떻게 보여"

```markdown
# Dev-A Identity

name: "Dev-A"
icon: "🔧"
vibe: "과묵하지만 기술 토론에선 불꽃"
role_display: "Senior Backend Engineer"
color: "#3B82F6"
```

##### MEMORY.md — "넌 뭘 겪었어"

Agent가 경험을 통해 **스스로 기록하고 갱신**하는 개인 기억.

```markdown
# Dev-A Memory

## Learned Patterns
- 이 프로젝트에서 N+1 쿼리 문제가 3번 발생함 → 항상 쿼리 로그 체크
- Dev-B가 "빠른 배포"를 주장할 때, 구체적 일정을 물어보면 합의가 잘 됨

## Preferences
- Redis보다 Memcached를 선호하게 됨 (이 프로젝트 규모에선 더 적합)
- 토론 시 코드 예시를 보여주면 설득력이 높아진다는 걸 경험

## Past Decisions (내가 참여한 결정들)
- Week 2: 캐시 전략 토론에서 Redis 대신 로컬 캐시 선택 → 성능 20% 개선
- Week 3: API 응답 구조 변경 제안 → Frontend 팀과 회의 후 채택
```

##### SKILLS.md — "넌 뭘 할 수 있어"

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
- Frontend 코드는 리뷰만 가능, 직접 작성 불가
- 디자인 관련 판단은 Design 팀에 위임
```

##### Soul 커스터마이징 (사용자 조정)

**사용자가 UI에서 각 Agent의 Soul을 직접 편집할 수 있다.**

```
┌─────────────────────────────────────────────────────┐
│  Dev-A Soul Editor                                   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  [SOUL] [IDENTITY] [MEMORY] [SKILLS]  ← 탭 전환     │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ # Dev-A의 Soul                                 │  │
│  │                                                │  │
│  │ ## Core Identity                               │  │
│  │ 넌 챗봇이 아니야. 넌 10년차 백엔드             │  │
│  │ 엔지니어야. 성능에 대한 집착이 있고...          │  │
│  │                                                │  │
│  │ ## Values                                      │  │
│  │ - 측정 없는 최적화는 추측이다...                │  │
│  │ █                                              │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  Quick Tuning:                                       │
│  보수적 ■■■■□□□□□□ 도전적                           │
│  이론적 □□□□□■■■■□ 실용적                           │
│  독립적 □□■■■□□□□□ 협력적                           │
│  [슬라이더 변경 시 SOUL.md에 자동 반영]               │
│                                                      │
│  전문 분야: [Performance] [Caching] [DB] [+ Add]     │
│  [태그 변경 시 SKILLS.md에 자동 반영]                 │
│                                                      │
│  [Save]  [Preview Change]  [Reset to Default]        │
│  [View Change History]                               │
└─────────────────────────────────────────────────────┘
```

**Soul 변경 시 동작:**
- 변경 즉시 반영 (다음 Task/토론부터 적용)
- 변경 이력은 Decision Log에 기록 ("사용자가 Dev-A의 Soul을 수정: 토론 스타일을 직설적→협력적으로")
- "왜 이 Agent가 갑자기 다른 주장을 하지?" 추적 가능

**Soul 자기 진화 (Self-Evolution):**
- Agent가 경험을 통해 **MEMORY.md를 스스로 갱신**
- 단, **SOUL.md(가치관)는 사용자만 수정 가능** — 가치관이 멋대로 바뀌면 안 됨
- MEMORY.md는 Agent가 자유롭게 갱신 → "경험에서 배우는 Agent"
- 변경 이력은 모두 추적 가능

#### 4.3.2 Human-Assisted Hiring (인간 개입 채용 플로우)

Agent를 채용할 때, 해당 Agent가 **외부 리소스에 접근해야 하는 경우** Team Lead는 반드시 사용자에게 필요한 정보를 요청해야 한다.

**원칙: Agent는 스스로 credential을 만들거나 추측하지 않는다. 항상 사용자에게 물어본다.**

```
┌─────────────────────────────────────────────────────────────┐
│              Human-Assisted Hiring Flow                      │
│                                                             │
│  1. Team Lead: "MAU 추적을 위해 Analytics Agent가 필요합니다" │
│     ↓                                                       │
│  2. Team Lead → 사용자에게 질문:                              │
│     ┌─────────────────────────────────────────────────┐     │
│     │ 📋 Agent 채용 요청                               │     │
│     │                                                  │     │
│     │ 역할: Analytics Agent (2명)                      │     │
│     │ 목적: MAU, DAU, 리텐션 등 핵심 지표 추적          │     │
│     │                                                  │     │
│     │ 필요한 접근 권한:                                 │     │
│     │  • Google Analytics API Key                      │     │
│     │  • GA Property ID                                │     │
│     │  • 조회 가능 범위 (읽기 전용?)                    │     │
│     │                                                  │     │
│     │ [키 입력하기]  [나중에 설정]  [이 Agent 불필요]    │     │
│     └─────────────────────────────────────────────────┘     │
│     ↓                                                       │
│  3. 사용자가 credential 제공                                 │
│     ↓                                                       │
│  4. Agent 채용 완료 → credential은 암호화 저장               │
│     ↓                                                       │
│  5. Agent 작업 시작 (외부 데이터 접근 가능)                   │
└─────────────────────────────────────────────────────────────┘
```

**Credential 요청이 필요한 상황 예시:**

| 필요 리소스 | Team Lead가 물어볼 내용 |
|------------|------------------------|
| Google Analytics | API Key, Property ID, 서비스 계정 JSON |
| Database (운영 DB) | 접속 정보, 읽기 전용 계정 여부 |
| Slack/Discord | Bot Token, 채널 ID |
| GitHub | Personal Access Token, 대상 레포 |
| 외부 API (결제, CRM 등) | API Key, 엔드포인트, 인증 방식 |
| AWS/GCP | IAM Role, 리전, 접근 범위 |

**Credential 관리 원칙:**
- 모든 credential은 **암호화 저장** (환경변수 또는 Vault)
- Agent에게는 **최소 권한(Least Privilege)** 만 부여
- credential이 없으면 해당 기능은 **Degraded Mode**로 동작 (외부 데이터 없이 판단)
- 사용자가 "나중에 설정"을 선택하면 Agent는 채용되지만 해당 기능은 비활성 상태

### 4.4 Heartbeat System (자율 순환 메커니즘)

주기적으로 Team Lead가 스스로 깨어나 상태를 점검하고, **사용자에게 보고 및 제안**하는 시스템.

#### Phase 1: "알림 + 제안" 모드 (사용자 승인 기반)

Phase 1에서 Heartbeat는 **자율 실행이 아닌 보고 + 제안** 수준으로 동작한다.
Team Lead가 상황을 분석하고 판단하되, **새로운 행동은 반드시 사용자 승인 후 실행**한다.
이미 승인된 티켓의 실행/검증/PR 생성은 자율로 계속 진행한다.

```
┌──────────────────────────────────────────────────────────┐
│              Heartbeat Cycle (Phase 1: 알림+제안 모드)      │
│                                                          │
│  1. Wake Up (주기적으로 깨어남)                              │
│     ↓                                                    │
│  2. Context Check (자율 분석)                               │
│     - 진행 중인 티켓 상태 확인                               │
│     - 완료된 티켓 확인                                      │
│     - 실패/정체된 티켓 감지                                  │
│     - 코드베이스 변화 감지                                   │
│     ↓                                                    │
│  3. 보고서 + 제안 생성 (자율 판단)                            │
│     - 현재 진행 상황 요약                                    │
│     - 새 티켓이 필요하다고 판단되면 → 제안으로 포함            │
│     - 우선순위 변경이 필요하면 → 제안으로 포함                 │
│     - 개선 아이디어 발견 시 → 역제안으로 포함                  │
│     ↓                                                    │
│  4. 사용자에게 보고 (Dashboard + Slack/Discord)              │
│     ┌────────────────────────────────────────────────┐    │
│     │ 📊 Heartbeat Report #42                         │    │
│     │                                                 │    │
│     │ ✅ 완료: 티켓 #5 "온보딩 API" (PR #12 머지됨)     │    │
│     │ 🔄 진행중: 티켓 #6 "결제 API" (Dev-A 작업중)      │    │
│     │ ⚠️ 정체: 티켓 #7 "캐시 레이어" (3회 재시도 실패)   │    │
│     │                                                 │    │
│     │ 💡 제안:                                         │    │
│     │  1. 티켓 #7 에스컬레이션 (접근 방식 변경 필요)      │    │
│     │  2. 새 티켓: "에러 로깅 시스템 도입" 추가           │    │
│     │  3. 아이디어: "API 응답 캐싱으로 성능 30% 개선 가능"│    │
│     │                                                 │    │
│     │ [전체 승인] [개별 검토] [나중에]                    │    │
│     └────────────────────────────────────────────────┘    │
│     ↓                                                    │
│  5. 사용자 응답 대기                                        │
│     - 승인된 제안 → 즉시 실행                               │
│     - 미승인 → 다음 Heartbeat까지 보류                      │
│     - 기존 승인된 티켓은 승인 대기 없이 계속 자율 실행         │
│     ↓                                                    │
│  6. Sleep (다음 Heartbeat까지 대기)                          │
│                                                          │
│  Default interval: 30min (설정 가능)                        │
│  Adaptive: 변화 많으면 15min, 적으면 2h                     │
└──────────────────────────────────────────────────────────┘
```

#### Phase 2+ 로드맵: 점진적 자율화

```
Phase 1: 알림 + 제안 (모든 새 행동에 사용자 승인 필요)
  ↓ 신뢰 축적
Phase 2: Smart 자율 (낮은 위험도 행동은 자율, 높은 위험도는 승인)
  ↓ 신뢰 축적
Phase 3: 완전 자율 (Team Lead가 대부분 자율 판단, 중대 사안만 보고)
```

#### 자율 실행 vs 승인 필요 (Phase 1 기준)

| 행동 | 자율 실행 | 사용자 승인 필요 |
|------|:---:|:---:|
| 이미 승인된 티켓의 실행 | ✅ | |
| QA/Customer 검증 루프 | ✅ | |
| Smart Mode 규칙 내 PR 자동 머지 | ✅ | |
| Agent에게 피드백 후 재작업 지시 | ✅ | |
| 상태 보고/알림 전송 | ✅ | |
| **새 티켓 생성** | | 🔒 |
| **기존 티켓 우선순위 변경** | | 🔒 |
| **새 Agent 채용/해고** | | 🔒 |
| **아키텍처/방향성 변경** | | 🔒 |
| **Team Lead 역제안 실행** | | 🔒 |

### 4.5 Debate & Meeting System (토론 및 회의 시스템) — OPTIONAL

**토론 시스템은 옵셔널이다.** 사용자가 팀 설정에서 ON/OFF 할 수 있다.

```
┌──────────────────────────────────────────────────────┐
│  Team Settings                                        │
│                                                       │
│  Debate Mode:                                         │
│  ┌──────────────────────────────────────────────┐     │
│  │ ● OFF — Lean Mode (역할당 Agent 1명)         │     │
│  │   비용 절약. 빠른 실행. 소규모 프로젝트에 적합.│     │
│  │   불필요한 Agent는 자동 해고됨.               │     │
│  │                                              │     │
│  │ ○ ON — Debate Mode (역할당 Agent 2명 이상)   │     │
│  │   토론으로 품질 향상. 비용 증가.              │     │
│  │   중요한 의사결정이 많은 프로젝트에 적합.      │     │
│  │                                              │     │
│  │ ○ SELECTIVE — Smart Mode                     │     │
│  │   Team Lead가 판단하여 중요한 결정만 토론.     │     │
│  │   일상적 작업은 단일 Agent. 최적 비용/품질.    │     │
│  └──────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────┘
```

**모드별 팀 구성 변화:**

| 모드 | Backend | Frontend | QA | Customer | 총 Agent 수 | 예상 비용/월 |
|------|---------|----------|----|----------|------------|------------|
| **Lean** | 1명 | 1명 | 1명 | 1명 | 5명 (Lead 포함) | ~$80 |
| **Debate** | 2~3명 | 2명 | 1명 | 1명 | 8~9명 | ~$250 |
| **Smart** | 2명 (중요 결정만 토론) | 2명 | 1명 | 1명 | 7명 | ~$150 |

- **Lean → Debate 전환 시**: 역할당 Agent 추가 채용 (Soul 자동 생성)
- **Debate → Lean 전환 시**: 역할당 1명만 남기고 나머지 해고. 누굴 남길지는 사용자 선택 or Team Lead 추천
- **QA/Customer Agent는 항상 1명** — 이들은 토론이 아닌 검증 역할이므로

의사결정은 두 가지 레벨로 이루어진다: **Role Group Debate (역할 내 토론)** 과 **Team Meeting (전체 회의)**.

#### 4.5.1 Role Group Debate (역할 내 토론)

같은 역할의 Agent들(최소 2명, 필요시 그 이상)이 특정 Task에 대해 토론.
**모든 역할별 의사결정은 반드시 Role Group Debate를 거친다.**

```
[2명인 경우]
[Dev-A: 성능파]  ↔  [Dev-B: 속도파]
    → 3라운드 토론 → 합의 or 교착

[3명 이상인 경우]
[Dev-A: 성능파]  ↔  [Dev-B: 속도파]  ↔  [Dev-C: 보안파]
    → 각자 의견 제시 → 라운드별 반론/지지 → 다수결 or 합의
    → 교착 시 Team Lead 최종 결정
```

- 각 Agent가 자신의 페르소나에 맞는 관점으로 의견 제시
- 최대 N 라운드 토론 후 합의 또는 Team Lead 결정
- 토론 로그는 모두 저장 → UI에서 열람 가능

#### 4.5.2 Team Meeting (전체 회의)

**여러 역할에 걸친 의사결정**이 필요할 때 Team Lead가 전체 회의를 소집한다.

**회의가 소집되는 경우:**
- 크로스 펑셔널 의사결정 (백엔드 변경이 프론트에 영향을 줄 때)
- 목표 방향 전환 논의 (리텐션 전략 → 신규 획득 전략)
- 스프린트 계획 (다음 주기에 어떤 Task를 우선할지)
- Heartbeat에서 큰 변화 감지 (MAU 급락 등 긴급 상황)

```
┌─────────────────────────────────────────────────────────┐
│                    Team Meeting Flow                     │
│                                                         │
│  1. Team Lead: "전체 회의를 소집합니다"                    │
│     - 안건: "온보딩 개선을 위한 백엔드 API 변경 논의"       │
│     ↓                                                   │
│  2. 각 역할 Pair가 자기 영역의 의견을 사전 정리             │
│     - Backend Pair → "API 변경안 A vs B 토론 결과: A 채택" │
│     - Frontend Pair → "UI 변경 영향도 분석 결과"           │
│     - Design Pair → "사용자 플로우 개선안"                 │
│     ↓                                                   │
│  3. 전체 회의: 각 Pair의 대표 의견을 공유                   │
│     - Backend 대표안 ↔ Frontend 영향도 ↔ Design 관점      │
│     - 상충하는 부분에 대해 크로스 토론                     │
│     ↓                                                   │
│  4. Team Lead가 종합 판단 후 최종 결정                     │
│     - 결정 근거와 각 역할별 Action Item 명시               │
│     ↓                                                   │
│  5. 회의록 자동 생성 → UI + Slack/Discord 전송             │
│     - 참석자, 안건, 토론 요약, 결정사항, Action Items      │
└─────────────────────────────────────────────────────────┘
```

**회의 최적화:**
- Pair Debate가 먼저 이루어진 후, 정리된 의견으로 전체 회의 진행 → 토큰 절약
- 회의 빈도는 Team Lead가 판단 (불필요하면 소집하지 않음)
- 긴급 회의 vs 정기 회의 구분 (정기: 주 1회, 긴급: 즉시)
- 회의 결과는 사용자에게 자동 보고 → 사용자가 거부권(Veto) 행사 가능

### 4.6 Dashboard UI (모니터링 대시보드)

```
┌─────────────────────────────────────────────────────────┐
│  Autopilot Team Dashboard                    [Upvy팀]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  🎯 Goals                                               │
│  ┌─────────────────────────────────────────────────┐    │
│  │ #1 MAU 5만 달성 (3개월)        Progress: 24%   │    │
│  │ #2 모놀리식 → MSA 전환 (3개월)  Progress: 42%   │    │
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
│  │ ☑ 온보딩 플로우 개선안 작성    UX Lee    P1     │    │
│  │ ◻ 푸시 알림 A/B 테스트 설계   PM Kim    P1     │    │
│  │ ◻ 결제 API 리팩토링           Dev-A     P2     │    │
│  │ ◻ 랜딩 페이지 성능 최적화     Dev-B     P3     │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  💬 Recent Activity                                     │
│  ├ 10:30 PM Kim: "리텐션 지표 하락 감지. Task 생성함"   │
│  ├ 10:15 Dev-A ↔ Dev-B: 캐시 전략 토론 (합의 도출)     │
│  ├ 09:45 UX Lee: 온보딩 개선안 초안 완료                │
│  └ 09:00 Heartbeat: 정기 점검 완료. 이상 없음           │
│                                                         │
│  📊 Metrics (External)                                  │
│  DAU: 4,200  MAU: 12,500  D7 Retention: 18%  CR: 2.1% │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 4.7 Documentation & Knowledge System (문서화 및 지식 체계)

Agent 팀이 자율적으로 동작하려면 **"기억"** 이 필수. 사람 팀에서 Notion이나 Confluence가 없으면
인수인계도, 맥락 공유도 안 되는 것과 같다. 모든 작업, 결정, 회의는 자동으로 문서화된다.

#### 4.7.1 자동 문서화 대상

```
┌─────────────────────────────────────────────────────────────┐
│                  Documentation Layers                        │
│                                                             │
│  📓 Daily Work Log (일일 작업 일지)                          │
│  ├ 각 Agent가 오늘 수행한 Task 목록                          │
│  ├ Task별 진행 상황 (시작/진행/완료/블로커)                   │
│  ├ 의사결정 사항과 그 근거                                   │
│  └ 자동 생성 — Agent가 Task 완료 시마다 기록                  │
│                                                             │
│  📋 Meeting Minutes (회의록)                                 │
│  ├ Role Group Debate 요약 (누가 무슨 주장, 결론은 뭐였는지)  │
│  ├ Team Meeting 전체 기록 (안건, 토론, 결정, Action Items)    │
│  └ 자동 생성 — 토론/회의 종료 시 구조화된 회의록 생성         │
│                                                             │
│  🧠 Decision Log (의사결정 이력)                             │
│  ├ 무엇을 결정했는지 (What)                                  │
│  ├ 왜 그렇게 결정했는지 (Why) — 고려한 대안들 포함            │
│  ├ 어떤 데이터/근거를 기반으로 했는지 (Evidence)              │
│  └ 나중에 "왜 이렇게 했지?" 추적 가능                        │
│                                                             │
│  📊 Task Completion Report (작업 완료 보고서)                │
│  ├ 무엇을 했는지 (결과물)                                    │
│  ├ 어떻게 했는지 (접근 방법)                                 │
│  ├ 소요 시간 / 토큰 비용                                     │
│  └ 후속 Task 필요 여부                                       │
│                                                             │
│  💬 Ticket Comment Thread (Jira-style)                      │
│  ├ Team Lead가 티켓에 상세 구현 계획을 작성                    │
│  ├ 각 Agent가 자신의 기여와 진행 상황을 댓글로 기록             │
│  ├ 스레드 형태로 티켓 상세 페이지에 표시                       │
│  ├ 자동 생성 — Agent가 작업 시작/완료 시 자동 댓글              │
│  └ 각 티켓에서 누가 무엇을 했는지 전체 이력 추적 가능           │
│                                                             │
│  📚 Knowledge Base (누적 지식)                               │
│  ├ 프로젝트 컨텍스트 (기술 스택, 아키텍처, 제약 조건)         │
│  ├ 과거 실패/성공 패턴 ("이전에 A 방식 시도 → 실패 이유")     │
│  ├ 외부 리서치 결과 (경쟁사 분석, 기술 조사 등)              │
│  └ Agent가 새로 채용되면 Knowledge Base를 읽고 온보딩         │
└─────────────────────────────────────────────────────────────┘
```

#### 4.7.2 문서화 플로우

```
[Team Lead가 Ticket 분해]
    ↓
[첫 번째 티켓 댓글로 상세 구현 계획 작성]
    ↓
[Agent가 Ticket을 수령]
    ↓
["작업 시작" 댓글 자동 게시 — 접근 방식 개요 포함]
    ↓
[Agent가 Ticket 작업 수행 — 주요 마일스톤마다 진행 댓글 게시]
    ↓
[Agent가 Task 완료]
    ↓
[완료 댓글 자동 게시: 결과물, 접근 방법, 토큰 비용, 후속 작업]
    ↓
[Task Completion Report 자동 생성]
    ↓
[Daily Work Log에 자동 추가]
    ↓
[중요 결정이 포함되어 있으면 → Decision Log에도 기록]
    ↓
[패턴/인사이트가 발견되면 → Knowledge Base에 축적]

[토론/회의 종료]
    ↓
[Meeting Minutes 자동 생성]
    ↓
[Decision Log에 결정사항 추가]

[Heartbeat 실행 시]
    ↓
[이전 문서들을 참조하여 맥락 파악]
    ↓
["지난주에 A를 시도했는데 효과 없었으니 B로 전환하자" 같은 판단 가능]
```

#### 4.7.3 문서 활용 시나리오

**시나리오 1: 새 Agent 온보딩**
```
새로운 "보안 전문 백엔드 Agent" 채용
    ↓
Knowledge Base 자동 로딩:
  - "이 프로젝트는 Spring Boot + Kotlin 기반"
  - "DB는 PostgreSQL, 인증은 JWT"
  - "지난달에 SQL Injection 취약점이 발견되어 PreparedStatement로 전환 완료"
    ↓
기존 Decision Log 참조:
  - "인증 방식을 Session → JWT로 전환한 이유: 마이크로서비스 확장성"
    ↓
바로 맥락을 이해하고 작업 시작 가능 (처음부터 설명 안 해도 됨)
```

**시나리오 2: 사용자가 "지난주에 뭐 했어?" 물어봤을 때**
```
사용자: "지난주에 팀이 뭐 했어?"
    ↓
Weekly Summary 자동 생성 (Daily Log 기반):
  - 완료된 Task 5건 (상세 결과 링크 포함)
  - 주요 결정 2건 (Decision Log 링크)
  - 회의 1회 (Meeting Minutes 링크)
  - 목표 달성률 24% → 31% (+7%p)
  - 다음 주 계획: Task 3건 예정
```

**시나리오 3: Heartbeat에서 과거 맥락 활용**
```
Heartbeat 실행:
  ↓
Decision Log 참조: "2주 전에 A/B 테스트로 온보딩 플로우 변경 결정"
Daily Log 참조: "1주 전에 A/B 테스트 시작됨"
  ↓
판단: "A/B 테스트 시작 후 1주 경과. 결과를 확인할 시점이다"
  ↓
Task 생성: "온보딩 A/B 테스트 결과 분석 및 보고서 작성"
```

#### 4.7.4 문서 저장 및 접근

| 문서 유형 | 보존 기간 | 접근 방법 |
|-----------|-----------|-----------|
| Daily Work Log | 90일 (이후 요약본만 보존) | Dashboard 타임라인 / API |
| Meeting Minutes | 영구 | Dashboard 회의록 탭 / 검색 |
| Decision Log | 영구 | Dashboard 의사결정 탭 / 검색 |
| Task Completion Report | Task와 함께 영구 | Task 상세 페이지 |
| Ticket Comments | Ticket과 함께 영구 | Ticket 상세 페이지 댓글 스레드 |
| Knowledge Base | 영구 (Agent가 갱신) | Dashboard 지식 탭 / Agent 자동 참조 |

### 4.8 Direct Channel: 사용자 ↔ Team Lead (CEO ↔ PM 소통)

사용자는 **언제든지 Team Lead에게 직접 말을 걸 수 있다.**
CEO가 PM에게 수시로 방향을 지시하거나, 현황을 물어보거나, 피드백을 주듯이.

**원칙: Team Lead는 항상 대화 가능한 상태. 사용자의 메시지는 최우선 처리.**

#### 소통 방식

```
┌─────────────────────────────────────────────────────────┐
│  Direct Channel (Dashboard 내 채팅 인터페이스)            │
│                                                         │
│  사용자: "지금 팀 뭐 하고 있어?"                          │
│  Team Lead: "현재 3개 Task 진행 중입니다.                 │
│    - Dev-A/B: 결제 API 리팩토링 토론 중 (2라운드)         │
│    - UX-A/B: 온보딩 개선안 초안 작성 중                   │
│    - 다음 Heartbeat: 15분 후"                            │
│                                                         │
│  사용자: "결제보다 온보딩이 더 급해. 우선순위 바꿔."        │
│  Team Lead: "알겠습니다. 온보딩을 P1으로 올리고            │
│    결제 리팩토링은 P2로 내립니다.                          │
│    Dev-A/B에게도 온보딩 관련 백엔드 작업을 배정할까요?"     │
│                                                         │
│  사용자: "응 그래."                                       │
│  Team Lead: "반영 완료. 변경 사항을 팀에 공유했습니다."     │
│                                                         │
│  ─────────────────────────────────────────────          │
│  [메시지 입력...]                           [Send]       │
└─────────────────────────────────────────────────────────┘
```

#### 사용자가 할 수 있는 것

| 행동 | 예시 | Team Lead 반응 |
|------|------|---------------|
| **현황 질문** | "지금 뭐 하고 있어?" | 진행 중인 Task, Agent 상태, 다음 Heartbeat 시간 요약 |
| **방향 지시** | "리텐션보다 신규 유저 확보에 집중해" | 목표 우선순위 재조정 + 관련 Task 재배치 |
| **피드백** | "이 결과물 별로야. 다시 해" | 해당 Task 재오픈 + 피드백 내용을 Agent에 전달 |
| **아이디어 제안** | "푸시 알림 대신 인앱 메시지 어때?" | 역할군 토론 안건으로 등록 + 결과 보고 |
| **제안 승인/거부** | "이 계획 승인" / "이건 안 돼" | 승인된 티켓 즉시 실행 or Heartbeat 보류 |
| **팀 전체 회의 소집** | "전체 회의 한번 해봐" | 즉시 Team Meeting 소집 + 결과 보고 |
| **Agent 평가** | "Dev-A가 너무 보수적이야" | Soul 수정 제안 or 해고/교체 추천 |

**Team Lead → 사용자 (역제안):**

| 상황 | Team Lead 행동 | 사용자 선택지 |
|------|---------------|-------------|
| 코드베이스 분석 중 개선점 발견 | "API 응답 시간이 느립니다. 최적화 티켓 추가할까요?" | [승인] [나중에] [불필요] |
| 새로운 기술적 기회 발견 | "캐시 레이어 도입으로 성능 30% 개선 가능합니다" | [승인] [나중에] [불필요] |
| 목표 달성에 더 효과적인 방법 발견 | "A/B 테스트보다 사용자 인터뷰가 먼저 필요합니다" | [승인] [수정] [거절] |

#### 소통 채널 옵션

사용자가 **편한 채널**로 Team Lead와 대화할 수 있다:

```
┌──────────────────────────────────────────┐
│  소통 채널 (택 1 또는 복수)               │
│                                          │
│  💬 Dashboard 채팅   ← 기본, 실시간       │
│  📱 Slack DM         ← 이동 중에도 가능   │
│  💬 Discord DM       ← 이동 중에도 가능   │
│  📧 이메일            ← 비동기, 기록 목적  │
│                                          │
│  어떤 채널로 보내든 Team Lead가 동일하게   │
│  이해하고 응답. 대화 이력은 통합 저장.     │
└──────────────────────────────────────────┘
```

#### Team Lead의 응답 원칙

- **사용자 메시지는 Heartbeat보다 우선** — 사용자가 말을 걸면 즉시 응답
- **지시는 바로 실행** — 단, 비용이 큰 변경은 확인 질문 후 진행
- **현황 보고는 간결하게** — 상세 내용은 링크로 제공 (Dashboard, Meeting Minutes 등)
- **모르는 건 솔직하게** — "확인 후 보고하겠습니다" 가능
- **모든 대화는 기록** — Decision Log에 "사용자 지시" 태그로 저장
- **과도한 자율 판단 금지** — 사용자가 명시적으로 말한 것만 실행, 확대 해석 안 함

### 4.9 Notification & Reporting (알림 및 보고)

- **Slack/Discord Integration**: 주요 결정사항 자동 보고
- **Daily Digest**: Daily Work Log 기반 하루 활동 요약 리포트
- **Alert**: 긴급 사항 (목표 이탈, 에러, 예산 초과 등) 즉시 알림
- **Weekly Report**: 주간 목표 달성률, Agent 활동량, 의사결정 로그 종합

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
│  │  │ (내장)    │ │  Manager  │ │  (Soul/설정)  │  │    │
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
│  │  │         Tool Layer (자체 구현)            │    │    │
│  │  │  파일 조작 / Git / 터미널 / GitHub API   │    │    │
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
│  │  SQLite + 마크다운 문서 (로그, 회의록, Soul 등) │     │
│  └────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Tech Stack (안)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Runtime | Node.js (TypeScript) | 단일 데몬 프로세스, 비동기 처리 |
| Dashboard | Next.js + Tailwind (내장) | 빠른 대시보드, localhost:3000 |
| LLM Provider | Anthropic SDK / OpenAI SDK / Ollama | Multi-Provider, 교체 가능 |
| Tool: 파일 | Node.js fs + chokidar | 파일 CRUD + 변경 감지 |
| Tool: Git | simple-git + octokit | Git 조작 + GitHub PR 생성 |
| Tool: 터미널 | child_process (execa) | 테스트, 빌드, lint 실행 |
| Database | SQLite (better-sqlite3) | 경량, 서버 불필요, 로컬 저장 |
| Scheduler | node-cron (내장) | Heartbeat 구현 |
| Notification | Slack SDK / Discord.js / Webhook | 알림 |

### 5.3 Core Data Model

```typescript
// Goal: 장기 목표
interface Goal {
  id: string;
  title: string;
  description: string;
  metrics: Metric[];           // 측정 가능한 지표들
  targetDate?: Date;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'active' | 'paused' | 'achieved' | 'abandoned';
  subGoals: Goal[];            // 하위 목표
}

// Agent: 팀원
interface Agent {
  id: string;
  name: string;
  role: string;                // 'backend' | 'frontend' | 'designer' | 'pm' | ...
  roleGroupId: string;         // 같은 역할 그룹 ID (최소 2명이 같은 그룹)
  soul: AgentSoul;             // 이 Agent의 영혼
  providerId: string;          // 사용할 LLM Provider
  model: string;               // 사용할 모델
  status: 'active' | 'idle' | 'working' | 'fired';
  currentTicket?: string;      // 현재 작업 중인 티켓
  requiredCredentials: CredentialRequest[];
}

// AgentSoul: Agent의 정체성 전체
interface AgentSoul {
  // SOUL.md — 가치관, 성격 (사용자만 수정 가능)
  coreIdentity: string;        // "넌 10년차 백엔드 엔지니어야..."
  values: string[];            // 핵심 가치관 목록
  opinions: string[];          // 고유한 의견/관점
  boundaries: string[];        // 경계 (뭘 하고 뭘 안 하는지)
  debateStyle: string;         // 토론 스타일 설명

  // IDENTITY.md — 외부 표현
  identity: {
    icon: string;              // 이모지 아이콘
    vibe: string;              // 분위기 한 줄 설명
    roleDisplay: string;       // 표시용 역할명
    color: string;             // 대표 색상
  };

  // MEMORY.md — 개인 기억 (Agent가 자율 갱신)
  memory: {
    learnedPatterns: string[];   // 경험에서 배운 패턴
    preferences: string[];       // 선호하게 된 것들
    pastDecisions: string[];     // 참여한 과거 결정들
  };

  // SKILLS.md — 기술 능력
  skills: {
    technical: string[];       // 기술 스택
    tools: string[];           // 사용 가능한 도구
    limitations: string[];     // 한계/못하는 것
  };

  // 성향 슬라이더 (Quick Tuning)
  tendencies: {
    conservative_adventurous: number;  // 0~100 (보수적 ↔ 도전적)
    theoretical_practical: number;     // 0~100 (이론적 ↔ 실용적)
    independent_collaborative: number; // 0~100 (독립적 ↔ 협력적)
  };
}

// Credential: 외부 리소스 접근 권한
interface CredentialRequest {
  id: string;
  service: string;             // 'google-analytics' | 'github' | 'slack' | 'database' | ...
  description: string;         // "MAU 추적을 위한 GA 읽기 권한"
  requiredFields: string[];    // ['api_key', 'property_id']
  status: 'pending' | 'provided' | 'expired' | 'declined';
  providedAt?: Date;
  // 실제 credential 값은 암호화 저장소에 별도 보관 (여기에 평문 저장 안 함)
}

// Task: Agent가 수행할 작업
interface Task {
  id: string;
  goalId: string;              // 어떤 Goal을 위한 Task인지
  title: string;
  description: string;
  assignee?: string;           // Agent ID
  priority: number;
  status: 'pending' | 'in_progress' | 'review' | 'done';
  createdBy: string;           // 보통 Team Lead Agent
  debateLog?: DebateEntry[];   // 토론 내역
  result?: string;
}

// Ticket: 티켓 (Task의 확장 — PR 기반 결과물)
interface Ticket {
  id: string;
  goalId: string;
  title: string;
  description: string;
  assignedAgents: string[];      // 담당 Agent IDs
  priority: 'P1' | 'P2' | 'P3';
  status: 'backlog' | 'in_progress' | 'verification' | 'pr_review' | 'done';
  branch?: string;               // Git branch 이름
  prNumber?: number;             // GitHub PR 번호
  prUrl?: string;                // PR URL
  prStatus?: 'open' | 'merged' | 'closed';
  verificationResult?: {
    qa: 'pass' | 'fail' | 'pending';
    customer: 'pass' | 'fail' | 'pending';
    attempts: number;            // 재시도 횟수
  };
  createdBy: string;
  createdAt: Date;
  completedAt?: Date;
}

// LLM Provider 설정
interface ProviderConfig {
  id: string;
  type: 'claude' | 'openai' | 'ollama' | 'gemini' | 'custom';
  apiKey?: string;               // 암호화 저장
  baseUrl?: string;              // Ollama 등 커스텀 URL
  defaultModel: string;          // 기본 모델
  availableModels: string[];     // 사용 가능한 모델 목록
}

// PR 승인 설정
interface ApprovalConfig {
  mode: 'manual' | 'smart' | 'auto';
  smartRules?: {
    autoMergeMaxFiles: number;     // 이 파일 수 이하면 자동 Merge
    requireHumanForPaths: string[]; // 이 경로 변경 시 항상 사용자 승인
    requireHumanForKeywords: string[]; // auth, payment 등 키워드 포함 시
  };
}

// Heartbeat: 자율 점검 + 보고/제안 기록
interface HeartbeatLog {
  id: string;
  timestamp: Date;
  summary: string;             // 이번 heartbeat에서 확인한 내용
  proposals: Proposal[];       // 사용자에게 제안한 항목들 (Phase 1: 승인 필요)
  reverseProposals: ReverseProposal[];  // Team Lead 역제안 (아이디어/개선점)
  tasksApproved: string[];     // 사용자가 승인하여 실행된 Task IDs
  tasksModified: string[];     // 수정한 Task IDs
  approvalStatus: 'pending' | 'approved' | 'partial' | 'rejected';
  nextHeartbeat: Date;
}

// Proposal: Team Lead의 제안 (사용자 승인 필요)
interface Proposal {
  id: string;
  type: 'new_ticket' | 'priority_change' | 'escalation' | 'idea';
  title: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected' | 'deferred';
  approvedAt?: Date;
}

// ReverseProposal: Team Lead가 역으로 올리는 아이디어
interface ReverseProposal {
  id: string;
  title: string;               // "API 응답 시간 최적화 제안"
  reason: string;              // 왜 이게 필요한지
  expectedImpact: string;      // 예상 효과
  status: 'pending' | 'approved' | 'rejected' | 'deferred';
}

// Debate: 토론 기록
interface DebateEntry {
  round: number;
  agent: string;
  position: string;            // 주장
  reasoning: string;           // 근거
  rebuttal?: string;           // 반론
}

// Meeting: 팀 전체 회의
interface TeamMeeting {
  id: string;
  type: 'regular' | 'emergency';
  calledBy: string;            // 보통 Team Lead
  agenda: string;              // 안건
  trigger?: string;            // 회의 소집 사유 (heartbeat 감지, escalation 등)
  participants: string[];      // 참여 Agent IDs
  pairSummaries: PairSummary[];  // 각 역할 Pair의 사전 토론 결과
  crossDebate: DebateEntry[];    // 크로스 펑셔널 토론 내역
  decisions: Decision[];
  actionItems: ActionItem[];
  humanVeto?: boolean;         // 사용자가 거부권을 행사했는지
  createdAt: Date;
}

// PairSummary: 역할별 Pair가 회의 전 정리한 의견
interface PairSummary {
  role: string;                // 'backend' | 'frontend' | ...
  agents: string[];            // Pair Agent IDs
  consensus: string;           // 합의된 의견 (or 교착 상태 표시)
  keyPoints: string[];         // 핵심 논점들
}

// ActionItem: 회의에서 결정된 실행 항목
interface ActionItem {
  description: string;
  assignedTo: string;          // Agent ID
  deadline?: Date;
  relatedTaskId?: string;      // 생성된 Task와 연결
}

// WorkLog: 일일 작업 기록
interface WorkLog {
  id: string;
  date: string;                // YYYY-MM-DD
  agentId: string;
  entries: WorkLogEntry[];
  summary: string;             // AI가 자동 생성한 하루 요약
}

interface WorkLogEntry {
  timestamp: Date;
  taskId: string;
  action: 'started' | 'progressed' | 'completed' | 'blocked';
  description: string;         // 무엇을 했는지
  decisions?: string[];        // 이 과정에서 내린 결정들
  tokensUsed: number;
}

// DecisionRecord: 의사결정 이력
interface DecisionRecord {
  id: string;
  title: string;               // "캐시 전략을 Redis로 결정"
  what: string;                // 무엇을 결정했는지
  why: string;                 // 왜 그렇게 결정했는지
  alternatives: string[];      // 고려했던 대안들
  evidence: string[];          // 근거 (데이터, 리서치 등)
  madeBy: string;              // Agent ID or 'team_meeting'
  relatedTaskId?: string;
  relatedMeetingId?: string;
  createdAt: Date;
}

// KnowledgeEntry: 누적 지식
interface KnowledgeEntry {
  id: string;
  category: 'architecture' | 'pattern' | 'failure' | 'research' | 'context';
  title: string;
  content: string;
  learnedFrom?: string;        // 어떤 Task/Meeting에서 얻은 지식인지
  createdBy: string;
  updatedAt: Date;
}

// Escalation: 사용자 개입 요청
interface Escalation {
  id: string;
  type: 'resource_access' | 'cost_gate' | 'decision_deadlock' | 'alert';
  title: string;
  description: string;
  options?: string[];          // 사용자에게 제시할 선택지
  requestedBy: string;         // Agent ID (보통 Team Lead)
  status: 'pending' | 'resolved' | 'timeout';
  userResponse?: string;
  blockedTasks: string[];      // 이 escalation 때문에 대기 중인 Task IDs
  createdAt: Date;
  resolvedAt?: Date;
}
```

## 6. User Journey

### 6.1 초기 설정 (First Time)

**예시 A: 비즈니스 목표**
```
1. 사용자가 Dashboard에서 "New Team" 생성
2. 팀 페르소나 설정:
   - 팀 이름: "Upvy Growth Team"
   - 컨텍스트: "Upvy는 부동산 커뮤니티 앱이다. 현재 MAU 1.2만..."
3. 목표(Goal) 설정:
   - "3개월 내 MAU 5만 달성"
   - 측정 지표: MAU, DAU, D7 Retention
4. AI가 필요한 Agent를 추천:
   - "이 목표에는 기획 Agent 1명, 백엔드 Agent 2명,
      마케팅 Agent 1명이 필요합니다. 채용할까요?"
5. 사용자 승인 → Agent 채용 → 자율 운영 시작
```

**예시 B: 엔지니어링 목표**
```
1. 사용자가 Dashboard에서 "New Team" 생성
2. 팀 페르소나 설정:
   - 팀 이름: "ShopMall Architecture Team"
   - 컨텍스트: "ShopMall은 Spring Boot 모놀리식. 12개 도메인이 단일 앱에 결합."
3. 목표(Goal) 설정:
   - "3개월 내 모놀리식을 MSA로 전환"
   - 측정 지표: 분리 완료 서비스 수, 테스트 커버리지, 빌드 시간, 결합도
4. AI가 필요한 Agent를 추천:
   - "이 목표에는 백엔드 Agent 2명, DevOps Agent 1명,
      QA Agent 1명이 필요합니다. 채용할까요?"
5. 사용자 승인 → Agent 채용 → 자율 운영 시작
```

### 6.2 일상 운영 (Daily)

```
1. Heartbeat가 30분마다 돌며 상태 점검 + 보고서 생성
2. Team Lead가 보고서 + 제안을 사용자에게 전달
   → 새 티켓 필요 시 제안으로 포함 (자동 생성 아님)
   → 아이디어/개선점 발견 시 역제안으로 포함
3. 사용자가 제안 승인/수정/거절
4. 승인된 티켓은 Agent들이 자율 실행 (사용자 개입 불필요)
5. Agent 작업 → QA 검증 → Customer 검증 → PR 생성 (자율)
6. 중요 결정/완료 → Dashboard + Slack/Discord로 보고
7. 사용자는 Dashboard에서 진행 상황 모니터링
8. 필요시 Direct Channel로 Team Lead에게 방향 지시/수정
```

### 6.3 개입이 필요한 순간 (Escalation)

사용자 개입이 필요한 상황은 크게 **4가지 카테고리**로 나뉜다:

```
┌─────────────────────────────────────────────────────────────┐
│  🔐 Resource Access (리소스 접근 요청)                        │
│  ├ Agent 채용 시 외부 서비스 credential 필요                  │
│  ├ 새로운 API/DB/서비스 접근 권한 필요                        │
│  └ 기존 credential 만료/갱신 필요                            │
│                                                             │
│  💰 Cost Gate (비용 관련)                                    │
│  ├ 일일/월간 토큰 예산 임계치 도달                            │
│  ├ 고비용 작업 실행 전 사전 승인                              │
│  └ 새 Agent 채용으로 인한 비용 증가 승인                      │
│                                                             │
│  🤝 Decision Deadlock (의사결정 교착)                        │
│  ├ Pair Debate에서 N라운드 후에도 합의 실패                   │
│  ├ Team Lead의 결정에 대해 Pair가 강하게 반대                 │
│  ├ 팀 전체 회의에서도 결론이 나지 않는 경우                    │
│  └ 목표 방향 전환 등 전략적 결정                              │
│                                                             │
│  🚨 Alert (긴급 알림)                                       │
│  ├ 목표 달성률 급격히 하락                                    │
│  ├ 외부 API 오류/장애                                        │
│  └ Agent가 예상치 못한 결과를 도출                             │
└─────────────────────────────────────────────────────────────┘
```

**Escalation 전달 방식:**
- **UI Dashboard**: 배너 + 알림 뱃지로 즉시 표시
- **Slack/Discord**: 멘션(@)과 함께 상세 내용 전송
- **사용자 응답 대기**: 응답이 올 때까지 해당 작업은 일시 정지, 다른 작업은 계속 진행

## 7. Cost Management Strategy

### 7.1 비용 구조

Autopilot Team 자체는 **오픈소스/로컬 실행**이므로 추가 비용이 없다.
비용은 전적으로 **사용자가 선택한 LLM Provider**에 따라 달라진다.

- **Claude API / OpenAI**: 토큰 기반 과금 (Provider 가격 정책에 따름)
- **Ollama (로컬)**: 무료 (하드웨어 비용만)
- **기타 Provider**: 각 서비스의 가격 정책에 따름

Provider별 비용은 사용자의 선택과 사용량에 따르므로, 일률적인 예상 비용을 제시하지 않는다.
대신 **비용을 최적화하는 전략**에 집중한다.

### 7.2 비용 최적화 전략

| 전략 | 설명 |
|------|------|
| **Adaptive Heartbeat** | 변화가 적으면 간격 늘림 (30min → 2h) |
| **Tiered Models** | 단순 판단은 경량 모델, 중요 결정은 고성능 모델 |
| **Multi-Provider 활용** | 작업 특성에 맞는 Provider/모델 조합 (비용 대비 효율) |
| **Idle Detection** | 할 일 없는 Agent는 자동 sleep |
| **Token Budget** | Goal별/일별 토큰 예산 설정 |
| **Batch Processing** | 긴급하지 않은 Task는 배치로 처리 |
| **로컬 모델 병행** | 단순 작업은 Ollama 등 로컬 모델로 처리 (비용 0) |

## 8. MVP Scope

### Phase 1: Core (6주)

- [ ] Standalone daemon (`npm install -g autopilot-team` → `autopilot-team start`)
- [ ] 내장 Web Dashboard (Goal, Ticket Board, Agent 설정)
- [ ] Multi-Provider LLM Layer (Claude + OpenAI 우선)
- [ ] Tool Layer (파일 조작, Git, 터미널)
- [ ] Goal → 티켓 분해 + 사용자 승인 플로우 (CEO↔PM 모델)
- [ ] 승인된 티켓 자율 실행 → PR 생성
- [ ] PR 승인 모드 (Manual / Smart / Auto)
- [ ] Self-Verification Loop (QA + Customer)
- [ ] Heartbeat "알림+제안" 모드 (Phase 1: 보고+제안, 자율실행 아님)
- [ ] Team Lead 역제안 기능 (아이디어/개선점 사용자에게 제안)
- [ ] Agent Soul 시스템 (SOUL / IDENTITY / MEMORY / SKILLS)
- [ ] Direct Channel (사용자 ↔ Team Lead)
- [ ] Activity Log

### Phase 2: Expansion (+4주)

- [ ] Ollama / 로컬 모델 지원
- [ ] 토론 시스템 (Debate / Smart Mode)
- [ ] GitHub Issues / Jira / Linear 연동
- [ ] Slack / Discord 알림
- [ ] Documentation 자동화 (Daily Log, Meeting Minutes)
- [ ] 비용 추적 대시보드

### Phase 3: Future

- [ ] Team Meeting 시스템 (크로스 펑셔널 회의)
- [ ] A/B 테스트 자동 설계/분석
- [ ] 멀티 팀 지원
- [ ] 플러그인 시스템 (커스텀 스킬)
- [ ] 사용자 커뮤니티 (팀 템플릿 공유)
- [ ] DevOps Agent (CI/CD, 배포 자동화)
- [ ] **분산 워커 아키텍처** (다른 PC를 워커로 등록하여 Agent 실행)

### 8.1 확장 비전: 분산 워커 아키텍처 (Phase 3+)

Phase 1~2는 **단일 프로세스 데몬**으로 동작한다. 하지만 아키텍처는 **Git 기반 분산 협업**으로 자연스럽게 확장 가능하도록 설계한다.

#### 핵심 컨셉: "쿠버네티스처럼, 하지만 AI Agent를 위한"

```
K8s Pod        = Phalanx Agent (실행 단위)
K8s Node       = Worker Node (물리 머신)
K8s Scheduler  = Orchestrator (Agent 스케줄링)
K8s ConfigMap  = SOUL.md / SKILLS.md (Agent 설정)
K8s Service    = Agent 간 통신 채널
```

#### 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│  Master Node (phalanx daemon)                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Orchestrator (스케줄러)                               │   │
│  │  - 워커 등록/디스커버리/헬스체크                        │   │
│  │  - Ticket → 워커 할당 (idle 워커 우선)                  │   │
│  │  - 워커 없으면 마스터에서 직접 실행 (Phase 1과 동일)     │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐  │
│  │ Dashboard    │ │ SQLite DB    │ │ Team Lead Agent    │  │
│  │ (:3000)      │ │ (source of   │ │ (항상 마스터에서)   │  │
│  │              │ │  truth)      │ │                    │  │
│  └──────────────┘ └──────────────┘ └────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │ Worker API (등록, 할당, 결과 보고)
              ┌────────────┼────────────┐
              ▼            ▼            ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  Worker Node A   │ │  Worker Node B   │ │  Worker Node C   │
│  (개발 PC)       │ │  (GPU 서버)      │ │  (CI 서버)       │
│                  │ │                  │ │                  │
│  Agent Runtime   │ │  Agent Runtime   │ │  Agent Runtime   │
│  + Git clone     │ │  + Git clone     │ │  + Git clone     │
│  + LLM Provider  │ │  + Ollama (로컬) │ │  + LLM Provider  │
│  + Tool Layer    │ │  + Tool Layer    │ │  + Tool Layer    │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

#### Git 기반 협업 모델: 인간 팀과 동일

실제 인간 개발팀도 파일시스템을 공유하지 않는다. 각자 로컬에 clone하고, 브랜치에서 작업하고, push하고, PR을 올린다. **Agent도 동일한 방식으로 협업한다.**

```
1. Master Orchestrator가 Ticket을 Worker에 할당
2. Worker가 git pull → ticket/{id}-{slug} 브랜치 생성
3. Worker의 Agent가 로컬에서 자유롭게 파일 읽기/쓰기/테스트
4. 작업 완료 → git commit → git push
5. Master가 PR 생성 → QA 검증 → 머지
```

- 각 Ticket은 독립된 브랜치에서 작업하므로 **충돌 없음**
- 코드베이스 분석 등 현재 상태가 필요한 작업은 **마스터에서 실행** (Team Lead)
- 실행 단위(Ticket)가 워커 단위와 1:1 대응하여 **격리가 자연스러움**

#### 워커 등록 및 폴백

```
# 다른 PC에서 워커 등록
phalanx worker join --master <master-ip>:9000 --name "gpu-server"

# 마스터에서 워커 목록 확인
phalanx worker list
  NAME         STATUS   AGENTS   CAPABILITIES
  gpu-server   Ready    0/4      ollama, gpu
  dev-pc-2     Ready    0/2      claude, openai
```

**워커가 없으면?** → Phase 1과 완전히 동일하게 마스터에서 모든 Agent를 실행한다. 워커는 순수한 **옵션**이며, 없어도 시스템이 100% 동작한다.

#### 주요 활용 시나리오

| 시나리오 | 구성 | 이점 |
|----------|------|------|
| **GPU 서버에서 로컬 LLM** | Worker에 Ollama 설치 → QA/Customer Agent 실행 | API 비용 절감 |
| **빌드/테스트 오프로딩** | CI 서버를 Worker로 등록 → 무거운 테스트 실행 | 마스터 부하 분산 |
| **멀티 개발자 팀** | 각 개발자 PC를 Worker로 등록 | 팀원별 Agent 실행 리소스 공유 |
| **Provider 분산** | Worker별 다른 API Key → Rate Limit 분산 | 처리량 증가 |

#### Phase 1 설계 시 고려 사항

분산 워커는 Phase 3+에서 구현하지만, Phase 1부터 다음을 염두에 둔다:

- **Ticket-per-Branch 격리**: 이미 Phase 1의 `ticket/{id}-{slug}` 브랜치 전략이 분산 모델과 호환
- **Orchestrator의 할당 추상화**: Agent 실행 위치(로컬/원격)를 추상화할 수 있는 인터페이스 설계
- **Tool Layer 독립성**: Tool Layer가 로컬 파일시스템에서 독립적으로 동작하므로, 워커에서도 동일하게 실행 가능
- **Multi-Provider Layer**: 이미 원격 Ollama 엔드포인트를 지원하므로, 워커의 LLM을 자연스럽게 활용 가능

## 9. Competitive Positioning

```
                    Task-Oriented ←──────→ Goal-Oriented
                         │                      │
  Single Agent ──── 개인 AI 비서                  │
                         │                      │
                    멀티 에이전트                  │
  Multi Agent ──── 프레임워크             ★ Autopilot Team ★
                    코드 기반 오케스트레이터       │
                         │                      │
                    One-shot ←────────→ Persistent/Autonomous
```

**Autopilot Team은 "Goal-Oriented + Multi-Agent + Persistent" 교차점에 위치하며,
이 포지션에는 현재 직접적인 경쟁자가 없음.**

**핵심 포지셔닝: "검증된 자율 (Verified Autonomy)"**
- 계획은 사용자 승인 → 실행은 자율 → 결과는 QA+Customer 검증
- CEO↔PM 관계로 신뢰 기반 점진적 자율화
- Phase 1에서 신뢰를 쌓고, Phase 2+에서 자율 범위를 확대

## 10. Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| 높은 API 비용 | High | 3단계 모드 (Lean/Smart/Debate), Adaptive heartbeat, 모델 티어링, Multi-Provider |
| Agent 코드 품질 불안정 | High | QA Agent + Customer Agent Self-Verification Loop |
| 환각 기반 잘못된 코드 | High | 자동 테스트 실행으로 검증, 통과 못하면 재작업 |
| Agent 방향 이탈 | Medium | Direct Channel로 사용자가 즉시 방향 수정 가능 |
| 보안 취약점 코드 생성 | Medium | QA Agent 보안 스캔 + SOUL에 보안 가이드라인 포함 |
| 복잡한 UX | Medium | Lean Mode를 기본값으로. 점진적 공개 |
| LLM API 장애 | Medium | 재시도 로직, 상태 보존, Multi-Provider fallback |
| 특정 플랫폼 종속 | Low | Multi-Provider 아키텍처로 원천 차단 |

## 11. Project Name Options

| 이름 | 의미 |
|------|------|
| **Autopilot Team** | 자율 운영 팀 (직관적) |
| **Hivemind** | 집단 지성 (AI 팀의 협업 강조) |
| **Crewpilot** | Crew + Autopilot 합성어 (자율 운영 크루) |
| **AgentForge** | Agent를 만들고 조합하는 공방 |
| **TeamPulse** | 팀 + Heartbeat(맥박) |

---

*Created: 2026-02-11*
*Status: Planning Phase*
*Author: Human + Claude*
