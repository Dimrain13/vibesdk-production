/**
 * Memory System
 * 
 * Persistent memory for agent context across conversations.
 */

export interface MemoryEntry {
    key: string;
    value: string;
    category: MemoryCategory;
    timestamp: number;
    importance: number;
}

export type MemoryCategory = 
    | 'user_preference'
    | 'project_context'
    | 'task_history'
    | 'error_pattern'
    | 'solution_pattern'
    | 'file_context';

export interface MemoryConfig {
    maxEntries: number;
    maxAge: number;
    pruneThreshold: number;
}

const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
    maxEntries: 100,
    maxAge: 86400000, // 24 hours
    pruneThreshold: 0.8, // Prune when 80% full
};

export class MemorySystem {
    private memories: Map<string, MemoryEntry> = new Map();
    private config: MemoryConfig;

    constructor(config: Partial<MemoryConfig> = {}) {
        this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
    }

    /**
     * Store a memory
     */
    store(
        key: string,
        value: string,
        category: MemoryCategory,
        importance: number = 0.5
    ): void {
        // Prune if needed
        if (this.memories.size >= this.config.maxEntries * this.config.pruneThreshold) {
            this.prune();
        }

        this.memories.set(key, {
            key,
            value,
            category,
            timestamp: Date.now(),
            importance: Math.max(0, Math.min(1, importance)),
        });
    }

    /**
     * Retrieve a memory by key
     */
    retrieve(key: string): MemoryEntry | undefined {
        const entry = this.memories.get(key);
        if (!entry) return undefined;

        // Check if expired
        if (Date.now() - entry.timestamp > this.config.maxAge) {
            this.memories.delete(key);
            return undefined;
        }

        return entry;
    }

    /**
     * Search memories by category
     */
    searchByCategory(category: MemoryCategory): MemoryEntry[] {
        const results: MemoryEntry[] = [];
        const now = Date.now();

        for (const entry of this.memories.values()) {
            if (entry.category === category && now - entry.timestamp <= this.config.maxAge) {
                results.push(entry);
            }
        }

        return results.sort((a, b) => b.importance - a.importance);
    }

    /**
     * Search memories by keyword
     */
    search(query: string): MemoryEntry[] {
        const results: MemoryEntry[] = [];
        const lowerQuery = query.toLowerCase();
        const now = Date.now();

        for (const entry of this.memories.values()) {
            if (now - entry.timestamp > this.config.maxAge) continue;
            
            if (
                entry.key.toLowerCase().includes(lowerQuery) ||
                entry.value.toLowerCase().includes(lowerQuery)
            ) {
                results.push(entry);
            }
        }

        return results.sort((a, b) => b.importance - a.importance);
    }

    /**
     * Get context summary for current conversation
     */
    getContextSummary(): string {
        const categories: Record<MemoryCategory, MemoryEntry[]> = {
            user_preference: [],
            project_context: [],
            task_history: [],
            error_pattern: [],
            solution_pattern: [],
            file_context: [],
        };

        const now = Date.now();
        for (const entry of this.memories.values()) {
            if (now - entry.timestamp <= this.config.maxAge) {
                categories[entry.category].push(entry);
            }
        }

        const lines: string[] = [];

        if (categories.project_context.length > 0) {
            lines.push('## Project Context');
            categories.project_context.slice(0, 5).forEach(m => {
                lines.push(`- ${m.key}: ${m.value}`);
            });
        }

        if (categories.user_preference.length > 0) {
            lines.push('## User Preferences');
            categories.user_preference.slice(0, 5).forEach(m => {
                lines.push(`- ${m.key}: ${m.value}`);
            });
        }

        if (categories.task_history.length > 0) {
            lines.push('## Recent Tasks');
            categories.task_history.slice(0, 3).forEach(m => {
                lines.push(`- ${m.value}`);
            });
        }

        return lines.join('\n');
    }

    /**
     * Prune old/low-importance memories
     */
    private prune(): void {
        const entries = Array.from(this.memories.entries());
        const now = Date.now();

        // Sort by age and importance (older and less important first)
        entries.sort(([, a], [, b]) => {
            const ageA = now - a.timestamp;
            const ageB = now - b.timestamp;
            const scoreA = a.importance - (ageA / this.config.maxAge);
            const scoreB = b.importance - (ageB / this.config.maxAge);
            return scoreA - scoreB;
        });

        // Remove bottom 20%
        const removeCount = Math.floor(entries.length * 0.2);
        for (let i = 0; i < removeCount; i++) {
            this.memories.delete(entries[i][0]);
        }
    }

    /**
     * Clear all memories
     */
    clear(): void {
        this.memories.clear();
    }

    /**
     * Get memory statistics
     */
    getStats(): { total: number; byCategory: Record<MemoryCategory, number> } {
        const byCategory: Record<MemoryCategory, number> = {
            user_preference: 0,
            project_context: 0,
            task_history: 0,
            error_pattern: 0,
            solution_pattern: 0,
            file_context: 0,
        };

        for (const entry of this.memories.values()) {
            byCategory[entry.category]++;
        }

        return {
            total: this.memories.size,
            byCategory,
        };
    }
}

// Singleton instance
export const memorySystem = new MemorySystem();
