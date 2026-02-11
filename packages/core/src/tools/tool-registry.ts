import type { Tool, ToolCategory, AgentToolPermissions } from './types.js';
import { filterToolsByPermissions } from './tool-permissions.js';

// ---------------------------------------------------------------------------
// ToolRegistry — central registry for all available tools
// ---------------------------------------------------------------------------

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  /** Register a tool. Throws if a tool with the same name already exists. */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool '${tool.name}' is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  /** Register multiple tools at once. */
  registerAll(tools: Tool[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /** Get a tool by name, or undefined if not found. */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /** Check if a tool is registered. */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /** Get all registered tools. */
  getAll(): Tool[] {
    return [...this.tools.values()];
  }

  /** Get all tools in a specific category. */
  getByCategory(category: ToolCategory): Tool[] {
    return this.getAll().filter((t) => t.category === category);
  }

  /**
   * Get tools filtered by agent permissions.
   * Uses the deny-always-wins resolution from tool-permissions.
   */
  getForAgent(permissions: AgentToolPermissions): Tool[] {
    return filterToolsByPermissions(this.getAll(), permissions);
  }

  /** Get the number of registered tools. */
  get size(): number {
    return this.tools.size;
  }

  /** Remove a tool by name. Returns true if the tool existed. */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /** Remove all registered tools. */
  clear(): void {
    this.tools.clear();
  }
}
