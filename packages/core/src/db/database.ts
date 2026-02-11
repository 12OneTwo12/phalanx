/**
 * SQLite connection manager with singleton pattern, WAL mode, and graceful shutdown.
 */
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

export type DrizzleDB = BetterSQLite3Database<typeof schema>;

export interface DatabaseConfig {
  /** Path to SQLite database file. Use ':memory:' for in-memory databases. */
  path: string;
  /** Enable WAL mode for better concurrent read performance. Default: true */
  walMode?: boolean;
  /** Enable verbose logging. Default: false */
  verbose?: boolean;
}

let instance: DatabaseManager | null = null;

/**
 * Manages the SQLite database connection lifecycle.
 * Uses singleton pattern to ensure a single connection per process.
 */
export class DatabaseManager {
  private readonly sqlite: Database.Database;
  private readonly db: DrizzleDB;
  private closed = false;

  private constructor(config: DatabaseConfig) {
    this.sqlite = new Database(config.path, {
      verbose: config.verbose ? console.log : undefined,
    });

    // Enable WAL mode for better concurrent read performance
    if (config.walMode !== false) {
      this.sqlite.pragma('journal_mode = WAL');
    }

    // Performance pragmas
    this.sqlite.pragma('foreign_keys = ON');
    this.sqlite.pragma('busy_timeout = 5000');

    this.db = drizzle(this.sqlite, { schema });
  }

  /**
   * Get or create the singleton database instance.
   */
  static getInstance(config?: DatabaseConfig): DatabaseManager {
    if (instance && !instance.closed) {
      return instance;
    }
    if (!config) {
      throw new Error('DatabaseManager not initialized. Provide config on first call.');
    }
    instance = new DatabaseManager(config);
    return instance;
  }

  /**
   * Create a new non-singleton instance (useful for testing).
   */
  static create(config: DatabaseConfig): DatabaseManager {
    return new DatabaseManager(config);
  }

  /** Get the drizzle ORM instance */
  get orm(): DrizzleDB {
    this.ensureOpen();
    return this.db;
  }

  /** Get the raw better-sqlite3 instance for migrations or direct queries */
  get raw(): Database.Database {
    this.ensureOpen();
    return this.sqlite;
  }

  /** Whether the connection has been closed */
  get isClosed(): boolean {
    return this.closed;
  }

  /**
   * Run raw SQL statements (for migrations).
   */
  exec(sql: string): void {
    this.ensureOpen();
    this.sqlite.exec(sql);
  }

  /**
   * Close the database connection gracefully.
   */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.sqlite.close();
    if (instance === this) {
      instance = null;
    }
  }

  /**
   * Reset the singleton instance (for testing).
   */
  static resetInstance(): void {
    if (instance) {
      instance.close();
    }
    instance = null;
  }

  private ensureOpen(): void {
    if (this.closed) {
      throw new Error('Database connection is closed');
    }
  }
}
