# 멀티 메신저 채널 통합 설계서

## 1. 아키텍처 개요

```
┌─────────────────────────────────────────────────────────┐
│                    Phalanx Core                          │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────┐ │
│  │ChannelRouter │──▶│ChannelRegistry│──▶│TeamLeadChat  │ │
│  │  (inbound)   │   │  (plugins)    │   │  Service     │ │
│  └──────┬───────┘   └──────────────┘   └──────┬───────┘ │
│         │                                      │         │
│  ┌──────▼──────────────────────────────────────▼───────┐ │
│  │              ChannelMessage (통합 타입)               │ │
│  └──────┬──────────────────────────────────────┬───────┘ │
│         │                                      │         │
│  ┌──────▼───────┐ ┌──────▼──────┐ ┌───────▼──────┐     │
│  │  WebProvider  │ │TelegramProv.│ │DiscordProv.  │ ... │
│  │  (기존 채팅)  │ │ (Bot API)   │ │ (Bot API)    │     │
│  └──────────────┘ └─────────────┘ └──────────────┘     │
└─────────────────────────────────────────────────────────┘
```

## 2. 핵심 인터페이스

### ChannelProvider
각 메신저 프로바이더가 구현해야 하는 인터페이스.

```typescript
interface ChannelProvider {
  id: string;                    // 'telegram', 'discord', 'slack', 'web'
  name: string;                  // 표시명
  capabilities: ChannelCapabilities;
  
  // Lifecycle
  start(config: ChannelProviderConfig): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
  
  // Messaging
  sendMessage(ctx: OutboundMessageContext): Promise<SendResult>;
  
  // Optional
  sendReaction?(ctx: ReactionContext): Promise<void>;
  editMessage?(ctx: EditMessageContext): Promise<void>;
  deleteMessage?(messageId: string, channelId: string): Promise<void>;
}
```

### ChannelMessage (통합 타입)
모든 메신저에서 수신한 메시지를 통합하는 타입.

```typescript
interface ChannelMessage {
  id: string;
  channelProvider: string;       // 'telegram' | 'discord' | 'slack' | 'web'
  channelId: string;             // 채널/채팅방 ID
  senderId: string;
  senderName?: string;
  content: string;
  role: 'user' | 'team-lead';
  replyToId?: string;
  threadId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
```

## 3. 설계 결정 사항

### 참고 아키텍처 분석 결과
- **Plugin 패턴**: 각 채널은 독립적인 플러그인으로 등록
- **Adapter 분리**: config, outbound, security, gateway 등 관심사별 adapter 분리
- **Registry**: 중앙 레지스트리에서 플러그인 로드/관리
- **Normalize**: 각 채널별 메시지 정규화 레이어
- **Session**: 인바운드 메시지를 세션에 매핑하여 컨텍스트 유지

### Phalanx 적용 방침
1. **단순화**: 참고 프로젝트는 8+ 채널을 지원하는 성숙한 시스템. Phalanx는 핵심만 취함
2. **플러그인 구조**: `ChannelProvider` 인터페이스 + `ChannelRegistry` (Map 기반)
3. **기존 호환**: 현재 `channelMessages` 테이블에 `channelProvider`, `channelId`, `senderId` 컬럼 추가
4. **Config 기반**: `.phalanx/config.json`에 `channels` 섹션 추가
5. **Webhook 우선**: Telegram은 polling, Discord/Slack은 WebSocket/Socket Mode

## 4. 구현 순서

### Step 1: Channel 추상화 레이어 (core)
- `packages/core/src/channel/types.ts` — 통합 타입 정의
- `packages/core/src/channel/provider.ts` — ChannelProvider 인터페이스
- `packages/core/src/channel/registry.ts` — ChannelRegistry
- `packages/core/src/channel/router.ts` — ChannelRouter (인바운드 라우팅)

### Step 2: Web 프로바이더 (기존 채팅 마이그레이션)
- `packages/core/src/channel/providers/web.ts` — WebChannelProvider

### Step 3: Telegram 프로바이더
- `packages/core/src/channel/providers/telegram.ts`

### Step 4: Discord 프로바이더
- `packages/core/src/channel/providers/discord.ts`

### Step 5: Slack 프로바이더
- `packages/core/src/channel/providers/slack.ts`

### Step 6: DB 마이그레이션
- `packages/core/src/db/migrations/0005_channel_providers.ts`

### Step 7: 설정 확장
- config.json `channels` 섹션

### Step 8: Dashboard API 확장
- `/api/channel` 엔드포인트 업데이트

## 5. 테스트 전략
- 각 프로바이더 유닛 테스트 (모킹)
- ChannelRegistry/Router 유닛 테스트
- 기존 team-lead-chat.test.ts가 깨지지 않는지 확인
- 빌드 통과 확인

## 6. 설정 구조

```json
{
  "channels": {
    "web": { "enabled": true },
    "telegram": {
      "enabled": true,
      "accounts": {
        "default": {
          "botToken": "env:TELEGRAM_BOT_TOKEN",
          "allowFrom": [],
          "mode": "polling"
        }
      }
    },
    "discord": {
      "enabled": false,
      "accounts": {
        "default": {
          "botToken": "env:DISCORD_BOT_TOKEN",
          "guildIds": []
        }
      }
    },
    "slack": {
      "enabled": false,
      "accounts": {
        "default": {
          "botToken": "env:SLACK_BOT_TOKEN",
          "appToken": "env:SLACK_APP_TOKEN"
        }
      }
    }
  }
}
```
