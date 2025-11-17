const API_BASE = 'http://localhost:8000/api';

export type EditorSession = {
  id: string;
  editor_state: {
    activeFileId: string | null;
    openTabs: Array<{ id: string; name: string; unsaved?: boolean }>;
    unsavedChanges: Record<string, string | undefined>;
  };
  settings: {
    autoSave: boolean;
    vendor: 'neutral' | 'rockwell' | 'siemens' | 'beckhoff';
    theme: 'light' | 'dark';
  };
  last_accessed: string;
};

class SessionService {
  private sessionId: string;

  constructor() {
    // Generate or retrieve session ID
    this.sessionId = localStorage.getItem('pandaura-session-id') || this.generateSessionId();
    localStorage.setItem('pandaura-session-id', this.sessionId);
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getSession(): Promise<EditorSession> {
    try {
      const response = await fetch(`${API_BASE}/sessions/${this.sessionId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to get session:', error);
      // Return default session if backend is unavailable
      return this.getDefaultSession();
    }
  }

  async updateSession(sessionData: Partial<EditorSession>): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/sessions/${this.sessionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sessionData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to update session:', error);
      // Fall back to localStorage
      this.saveToLocalStorage(sessionData);
    }
  }

  async saveEditorState(editorState: EditorSession['editor_state']): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/sessions/${this.sessionId}/save-editor-state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editorState),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to save editor state:', error);
      // Fall back to localStorage
      localStorage.setItem('pandaura-editor-state', JSON.stringify(editorState));
    }
  }

  private getDefaultSession(): EditorSession {
    const stored = localStorage.getItem('pandaura-session');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.error('Failed to parse stored session:', error);
      }
    }

    return {
      id: this.sessionId,
      editor_state: {
        activeFileId: null,
        openTabs: [],
        unsavedChanges: {},
      },
      settings: {
        autoSave: false,
        vendor: 'neutral',
        theme: 'light',
      },
      last_accessed: new Date().toISOString(),
    };
  }

  private saveToLocalStorage(sessionData: Partial<EditorSession>): void {
    const existing = this.getDefaultSession();
    const updated = { ...existing, ...sessionData };
    localStorage.setItem('pandaura-session', JSON.stringify(updated));
  }

  // Debounced auto-save for editor state
  private autoSaveTimeout: ReturnType<typeof setTimeout> | null = null;
  
  debouncedSaveEditorState(editorState: EditorSession['editor_state'], delay = 1000): void {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    
    this.autoSaveTimeout = setTimeout(() => {
      this.saveEditorState(editorState);
    }, delay);
  }
}

export const sessionService = new SessionService();