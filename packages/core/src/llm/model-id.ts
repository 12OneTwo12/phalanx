// ---------------------------------------------------------------------------
// Parse "provider/model" format
// ---------------------------------------------------------------------------

export function parseModelId(fullId: string): { provider: string; model: string } {
  const slashIndex = fullId.indexOf('/');
  if (slashIndex === -1) {
    throw new Error(`Invalid model ID "${fullId}": expected "provider/model" format`);
  }
  return {
    provider: fullId.slice(0, slashIndex),
    model: fullId.slice(slashIndex + 1),
  };
}

export function formatModelId(provider: string, model: string): string {
  return `${provider}/${model}`;
}
