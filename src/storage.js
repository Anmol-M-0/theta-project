/**
 * @file storage.js
 * @description Pluggable persistence adapters (Memory and LocalStorage) for Theta.
 */

/**
 * @typedef {import('./contracts.js').IntakeState} IntakeState
 */

/**
 * @interface StorageAdapter
 */

/**
 * In-memory storage adapter for headless testing and non-browser environments.
 */
export class MemoryStorageAdapter {
  constructor(initialData = null) {
    this._data = initialData ? structuredClone(initialData) : null;
  }

  async load() {
    return this._data ? structuredClone(this._data) : null;
  }

  async save(state) {
    this._data = structuredClone(state);
  }

  async clear() {
    this._data = null;
  }
}

/**
 * LocalStorage persistence adapter for browser sessions.
 */
export class LocalStorageAdapter {
  /**
   * @param {string} key - LocalStorage key
   */
  constructor(key = "theta_intake_draft") {
    this.key = key;
  }

  async load() {
    if (typeof window === "undefined" || !window.localStorage) {
      return null;
    }
    try {
      const raw = window.localStorage.getItem(this.key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      console.warn(`[Theta LocalStorageAdapter] Error loading key '${this.key}':`, err);
      return null;
    }
  }

  async save(state) {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }
    try {
      window.localStorage.setItem(this.key, JSON.stringify(state));
    } catch (err) {
      console.warn(`[Theta LocalStorageAdapter] Error saving key '${this.key}':`, err);
    }
  }

  async clear() {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }
    try {
      window.localStorage.removeItem(this.key);
    } catch (err) {
      console.warn(`[Theta LocalStorageAdapter] Error clearing key '${this.key}':`, err);
    }
  }
}
