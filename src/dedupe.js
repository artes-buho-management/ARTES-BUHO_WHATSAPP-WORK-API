export class MessageDedupeStore {
  constructor(ttlMs) {
    this.ttlMs = ttlMs;
    this.map = new Map();
  }

  seen(messageId) {
    if (!messageId) {
      return false;
    }

    const now = Date.now();
    const previous = this.map.get(messageId);

    if (previous && now - previous < this.ttlMs) {
      return true;
    }

    this.map.set(messageId, now);
    this.cleanup(now);
    return false;
  }

  cleanup(now = Date.now()) {
    for (const [id, timestamp] of this.map.entries()) {
      if (now - timestamp >= this.ttlMs) {
        this.map.delete(id);
      }
    }
  }
}
