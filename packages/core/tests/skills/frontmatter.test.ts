import { describe, it, expect } from 'vitest';
import { parseFrontmatter } from '../../src/skills/frontmatter.js';

describe('parseFrontmatter', () => {
  it('parses basic frontmatter with name and description', () => {
    const raw = `---
name: my-skill
description: A test skill
---

Instructions here.
`;
    const { frontmatter, body } = parseFrontmatter(raw);
    expect(frontmatter.name).toBe('my-skill');
    expect(frontmatter.description).toBe('A test skill');
    expect(body).toBe('Instructions here.');
  });

  it('returns body-only when no frontmatter', () => {
    const raw = 'Just plain markdown.';
    const { frontmatter, body } = parseFrontmatter(raw);
    expect(frontmatter).toEqual({});
    expect(body).toBe('Just plain markdown.');
  });

  it('parses JSON metadata field with phalanx wrapper', () => {
    const raw = `---
name: weather
description: Weather skill
metadata: { "phalanx": { "emoji": "🌤️", "roles": ["team-lead", "devops"], "requires": { "bins": ["curl"] } } }
---

Get weather data.
`;
    const { frontmatter } = parseFrontmatter(raw);
    expect(frontmatter.metadata?.emoji).toBe('🌤️');
    expect(frontmatter.metadata?.roles).toEqual(['team-lead', 'devops']);
    expect(frontmatter.metadata?.requires?.bins).toEqual(['curl']);
  });

  it('parses flat JSON metadata (no phalanx wrapper)', () => {
    const raw = `---
name: simple
description: Simple skill
metadata: { "roles": ["backend"], "emoji": "🔧" }
---

Content.
`;
    const { frontmatter } = parseFrontmatter(raw);
    expect(frontmatter.metadata?.roles).toEqual(['backend']);
    expect(frontmatter.metadata?.emoji).toBe('🔧');
  });

  it('falls back to YAML-style nested metadata', () => {
    const raw = `---
name: yaml-style
description: YAML metadata
roles:
  - backend
  - qa
requires:
  bins:
    - docker
  env:
    - DOCKER_HOST
---

Docker instructions.
`;
    const { frontmatter } = parseFrontmatter(raw);
    expect(frontmatter.metadata?.roles).toEqual(['backend', 'qa']);
    expect(frontmatter.metadata?.requires?.bins).toEqual(['docker']);
    expect(frontmatter.metadata?.requires?.env).toEqual(['DOCKER_HOST']);
  });

  it('handles quoted values', () => {
    const raw = `---
name: "quoted-name"
description: 'quoted desc'
---

Body.
`;
    const { frontmatter } = parseFrontmatter(raw);
    expect(frontmatter.name).toBe('quoted-name');
    expect(frontmatter.description).toBe('quoted desc');
  });
});
