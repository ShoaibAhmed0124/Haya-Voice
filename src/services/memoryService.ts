export interface Memory {
  id: string;
  timestamp: number;
  category: string; // e.g., 'preference', 'project', 'goal', 'important_conversation', 'coding_habit', 'writing_style', 'relationship', 'knowledge', 'behavioral'
  importance: number; // 1 to 10
  keywords: string[];
  summary: string;
  relationships?: string[];
  projects?: string[];
  people?: string[];
  emotion?: string;
  lastAccessTime: number;
  accessCount: number;
  confidence: number; // 0.0 to 1.0
}

export interface IMemoryStorage {
  saveMemory(memory: Omit<Memory, 'id' | 'timestamp' | 'lastAccessTime' | 'accessCount'> & { id?: string }): Promise<Memory>;
  getMemory(id: string): Promise<Memory | null>;
  searchMemories(query: string, category?: string): Promise<Memory[]>;
  deleteMemory(id: string): Promise<boolean>;
  listMemories(category?: string): Promise<Memory[]>;
  clearAllMemories(): Promise<boolean>;
}

export class IndexedDBMemoryStorage implements IMemoryStorage {
  private dbName = "HayaMemoryDB";
  private dbVersion = 1;
  private storeName = "memories";
  private db: IDBDatabase | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: "id" });
          store.createIndex("category", "category", { unique: false });
          store.createIndex("importance", "importance", { unique: false });
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        reject(new Error("Failed to open IndexedDB HayaMemoryDB: " + (event.target as IDBOpenDBRequest).error?.message));
      };
    });
  }

  async saveMemory(
    memory: Omit<Memory, 'id' | 'timestamp' | 'lastAccessTime' | 'accessCount'> & { id?: string }
  ): Promise<Memory> {
    const db = await this.getDB();
    const id = memory.id || "mem_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
    const now = Date.now();

    const fullMemory: Memory = {
      ...memory,
      id,
      timestamp: now,
      lastAccessTime: now,
      accessCount: 1,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.put(fullMemory);

      request.onsuccess = () => {
        resolve(fullMemory);
      };

      request.onerror = (event) => {
        reject(new Error("Failed to save memory: " + (event.target as IDBRequest).error?.message));
      };
    });
  }

  async getMemory(id: string): Promise<Memory | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);

      request.onsuccess = () => {
        const memory = request.result as Memory | undefined;
        if (memory) {
          memory.accessCount += 1;
          memory.lastAccessTime = Date.now();
          store.put(memory); // Update access metrics in background
          resolve(memory);
        } else {
          resolve(null);
        }
      };

      request.onerror = (event) => {
        reject(new Error("Failed to get memory: " + (event.target as IDBRequest).error?.message));
      };
    });
  }

  async deleteMemory(id: string): Promise<boolean> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        resolve(false);
      };
    });
  }

  async listMemories(category?: string): Promise<Memory[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, "readonly");
      const store = transaction.objectStore(this.storeName);
      let request: IDBRequest;

      if (category) {
        const index = store.index("category");
        request = index.getAll(category);
      } else {
        request = store.getAll();
      }

      request.onsuccess = () => {
        resolve(request.result as Memory[]);
      };

      request.onerror = (event) => {
        reject(new Error("Failed to list memories: " + (event.target as IDBRequest).error?.message));
      };
    });
  }

  async searchMemories(query: string, category?: string): Promise<Memory[]> {
    const allMemories = await this.listMemories(category);
    if (!query) return allMemories;

    const queryTokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);

    const scoredMemories = allMemories.map(memory => {
      let matchScore = 0;
      const summaryLower = memory.summary.toLowerCase();

      // Token overlap scoring
      queryTokens.forEach(token => {
        if (summaryLower.includes(token)) {
          matchScore += 2;
        }
        memory.keywords.forEach(keyword => {
          if (keyword.toLowerCase().includes(token)) {
            matchScore += 3;
          }
        });
      });

      // Semantic / Category relevance bump
      if (category && memory.category.toLowerCase() === category.toLowerCase()) {
        matchScore += 2;
      }

      // Importance score weighting (1-10 mapped to 0-1)
      const importanceWeight = memory.importance / 10;

      // Recency decay scoring (exponential decay based on last access time vs current time)
      const hoursSinceAccess = (Date.now() - memory.lastAccessTime) / (1000 * 60 * 60);
      const recencyScore = Math.max(0, 1 / (1 + 0.05 * hoursSinceAccess));

      // Access frequency count weight
      const frequencyScore = Math.min(1.0, memory.accessCount / 10);

      // Final Rank Formula: Match Relevance dominates (50%), with Importance (30%), Recency (15%), and Access Count (5%)
      const finalScore = (matchScore * 0.5) + (importanceWeight * 3.0) + (recencyScore * 1.5) + (frequencyScore * 0.5);

      return {
        memory,
        score: finalScore,
      };
    });

    // Filter memories with positive match or those that are highly important/recent
    return scoredMemories
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.memory);
  }

  async clearAllMemories(): Promise<boolean> {
    const db = await this.getDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(this.storeName, "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  }
}

// Memory Service Manager class matching Premium AI Operating System architecture
export class MemoryService {
  private static instance: MemoryService;
  private storage: IMemoryStorage;

  private constructor() {
    this.storage = new IndexedDBMemoryStorage();
  }

  static getInstance(): MemoryService {
    if (!MemoryService.instance) {
      MemoryService.instance = new MemoryService();
    }
    return MemoryService.instance;
  }

  async save(
    category: string,
    summary: string,
    keywords: string[],
    importance: number = 5,
    meta?: {
      id?: string;
      relationships?: string[];
      projects?: string[];
      people?: string[];
      emotion?: string;
      confidence?: number;
    }
  ): Promise<Memory> {
    return this.storage.saveMemory({
      category,
      summary,
      keywords,
      importance,
      relationships: meta?.relationships || [],
      projects: meta?.projects || [],
      people: meta?.people || [],
      emotion: meta?.emotion || "neutral",
      confidence: meta?.confidence ?? 1.0,
      id: meta?.id,
    });
  }

  async search(query: string, category?: string): Promise<Memory[]> {
    return this.storage.searchMemories(query, category);
  }

  async delete(id: string): Promise<boolean> {
    return this.storage.deleteMemory(id);
  }

  async list(category?: string): Promise<Memory[]> {
    return this.storage.listMemories(category);
  }

  async clear(): Promise<boolean> {
    return this.storage.clearAllMemories();
  }
}
