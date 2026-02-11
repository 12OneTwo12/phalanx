/**
 * Convention file watcher using chokidar with debounce.
 * Watches .phalanx/ directory for changes to convention files.
 */
import { watch, type FSWatcher } from 'chokidar';
import { EventEmitter } from 'node:events';
import type { WatcherEvent, WatcherEventType } from './types.js';

export interface ConventionWatcherOptions {
  /** Directory to watch (typically .phalanx/) */
  watchDir: string;
  /** Debounce delay in milliseconds. Default: 300 */
  debounceMs?: number;
  /** File patterns to watch. Default: all markdown files */
  patterns?: string[];
}

/**
 * Watches convention files for changes and emits debounced events.
 * 
 * @example
 * ```ts
 * const watcher = new ConventionWatcher({ watchDir: '.phalanx' });
 * watcher.on('change', (events) => console.log('Changed:', events));
 * await watcher.start();
 * ```
 */
export class ConventionWatcher extends EventEmitter {
  private fsWatcher: FSWatcher | null = null;
  private pendingEvents: WatcherEvent[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly debounceMs: number;
  private readonly watchDir: string;
  private readonly patterns: string[];

  constructor(options: ConventionWatcherOptions) {
    super();
    this.watchDir = options.watchDir;
    this.debounceMs = options.debounceMs ?? 300;
    this.patterns = options.patterns ?? ['**/*.md'];
  }

  /** Start watching for file changes */
  async start(): Promise<void> {
    if (this.fsWatcher) return;

    this.fsWatcher = watch(this.patterns, {
      cwd: this.watchDir,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100 },
    });

    this.fsWatcher.on('add', (p) => this.enqueue('added', p));
    this.fsWatcher.on('change', (p) => this.enqueue('changed', p));
    this.fsWatcher.on('unlink', (p) => this.enqueue('removed', p));
    this.fsWatcher.on('error', (err) => this.emit('error', err));

    // Wait for watcher to be ready
    return new Promise((resolve) => {
      this.fsWatcher!.on('ready', () => resolve());
    });
  }

  /** Stop watching */
  async stop(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.fsWatcher) {
      await this.fsWatcher.close();
      this.fsWatcher = null;
    }
    this.pendingEvents = [];
  }

  /** Whether the watcher is currently active */
  get isWatching(): boolean {
    return this.fsWatcher !== null;
  }

  private enqueue(type: WatcherEventType, path: string): void {
    this.pendingEvents.push({ type, path });

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      const events = [...this.pendingEvents];
      this.pendingEvents = [];
      this.debounceTimer = null;
      this.emit('change', events);
    }, this.debounceMs);
  }
}
