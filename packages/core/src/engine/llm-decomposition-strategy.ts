/**
 * LLM-powered decomposition strategy.
 *
 * Sends the goal description to an LLM with a structured prompt and
 * parses the JSON response into DecomposedEpic[]. Uses Zod for
 * response validation and handles markdown fences in LLM output.
 */
import { z } from 'zod';
import type { LLMProvider } from '../llm/types.js';
import type { DecomposedEpic } from './types.js';
import type { DecompositionStrategy } from './decomposition-service.js';

// ---------------------------------------------------------------------------
// Response schema
// ---------------------------------------------------------------------------

const DecomposedTicketSchema = z.object({
  title: z.string(),
  description: z.string(),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  dependsOn: z.array(z.string()).default([]),
  category: z.string().default('backend'),
});

const DecomposedEpicSchema = z.object({
  title: z.string(),
  description: z.string(),
  tickets: z.array(DecomposedTicketSchema),
});

const DecompositionResponseSchema = z.object({
  epics: z.array(DecomposedEpicSchema),
});

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface LLMDecompositionConfig {
  /** Model ID to use */
  model: string;
  /** Max tokens for the response */
  maxTokens: number;
  /** Temperature for generation */
  temperature: number;
}

const DEFAULT_CONFIG: LLMDecompositionConfig = {
  model: 'claude-sonnet-4-5-20250929',
  maxTokens: 4096,
  temperature: 0.3,
};

// ---------------------------------------------------------------------------
// Strategy
// ---------------------------------------------------------------------------

export class LLMDecompositionStrategy implements DecompositionStrategy {
  private readonly config: LLMDecompositionConfig;
  private readonly conventions?: string;

  constructor(
    private readonly provider: LLMProvider,
    options?: {
      conventions?: string;
      config?: Partial<LLMDecompositionConfig>;
    },
  ) {
    this.config = { ...DEFAULT_CONFIG, ...options?.config };
    this.conventions = options?.conventions;
  }

  async decompose(goalDescription: string): Promise<DecomposedEpic[]> {
    const systemPrompt = this.buildSystemPrompt();
    const userMessage = `Decompose this goal into epics and tickets:\n\n${goalDescription}`;

    const result = await this.provider.chat({
      model: this.config.model,
      messages: [{ role: 'user', content: userMessage }],
      systemPrompt,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
    });

    return this.parseResponse(result.content);
  }

  private buildSystemPrompt(): string {
    const sections = [
      `You are a senior technical project manager. Given a goal description, decompose it into epics and tickets.`,
      `Respond with ONLY a JSON object matching this exact schema:
{
  "epics": [
    {
      "title": "Epic title",
      "description": "Epic description",
      "tickets": [
        {
          "title": "Ticket title",
          "description": "Detailed ticket description with acceptance criteria",
          "priority": "critical" | "high" | "medium" | "low",
          "dependsOn": ["Title of another ticket this depends on"],
          "category": "backend" | "frontend" | "qa" | "devops"
        }
      ]
    }
  ]
}`,
      `Guidelines:
- Each epic should have 2-5 tickets
- Tickets should be small enough for one developer to complete
- Use dependsOn to express ordering constraints (reference by ticket title)
- Assign priority based on criticality and blocking relationships
- Include QA tickets for testing`,
    ];

    if (this.conventions) {
      sections.push(`Project conventions to follow:\n${this.conventions}`);
    }

    return sections.join('\n\n');
  }

  /** Parse LLM response, handling markdown fences */
  parseResponse(raw: string): DecomposedEpic[] {
    // Strip markdown code fences if present
    let json = raw.trim();
    const fenceMatch = json.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fenceMatch) {
      json = fenceMatch[1].trim();
    }

    const parsed = JSON.parse(json);
    const validated = DecompositionResponseSchema.parse(parsed);
    return validated.epics;
  }
}
