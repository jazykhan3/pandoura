/**
 * Pull from PLC State Machine
 * 
 * Centralized state management for Pull-from-PLC flow.
 * All entry points route through this state machine.
 */

export type PullFlowState = 
  | 'idle'
  | 'selecting-runtime'
  | 'selecting-scope'
  | 'reviewing-approval'
  | 'executing-pull'
  | 'success'
  | 'error'
  | 'approval-pending'

export type PullFlowContext = {
  // Entry point info
  entryPoint: 'project-wizard' | 'empty-project-cta' | 'topbar-menu' | 'runtime-card' | 'manual'
  projectId?: string
  projectName?: string
  
  // Selected runtime
  runtimeId?: string
  runtimeName?: string
  runtimeEnvironment?: 'production' | 'staging' | 'development'
  
  // Snapshot scope
  scope?: {
    programs: boolean
    tags: boolean
    dataTypes: boolean
    routines: boolean
    aois: boolean
    executionUnits: boolean
    constants: boolean
  }
  
  // Approval info
  requiresApproval: boolean
  approvalRequestId?: string
  
  // Result
  snapshotId?: string
  error?: string
  itemsPulled?: number
  // Created project info (for new projects created from runtime pull)
  createdProjectId?: string
  createdProjectName?: string
}

export type PullFlowEvent =
  | { type: 'START'; payload: { entryPoint: PullFlowContext['entryPoint']; projectId?: string; projectName?: string } }
  | { type: 'RUNTIME_SELECTED'; payload: { runtimeId: string; runtimeName: string; environment: string } }
  | { type: 'SCOPE_SELECTED'; payload: PullFlowContext['scope'] }
  | { type: 'APPROVAL_REQUIRED'; payload: { requestId: string } }
  | { type: 'EXECUTE_PULL' }
  | { type: 'PULL_SUCCESS'; payload: { snapshotId: string; itemsPulled: number; projectId?: string; projectName?: string } }
  | { type: 'PULL_ERROR'; payload: { error: string } }
  | { type: 'RESET' }
  | { type: 'CANCEL' }

/**
 * Pull Flow State Machine
 */
export class PullFlowStateMachine {
  private state: PullFlowState = 'idle'
  private context: PullFlowContext = {
    entryPoint: 'manual',
    requiresApproval: false,
    scope: {
      programs: false,
      tags: false,
      dataTypes: false,
      routines: false,
      aois: false,
      executionUnits: false,
      constants: false
    }
  }
  private listeners: Array<(state: PullFlowState, context: PullFlowContext) => void> = []

  getState(): PullFlowState {
    return this.state
  }

  getContext(): PullFlowContext {
    return { ...this.context }
  }

  subscribe(listener: (state: PullFlowState, context: PullFlowContext) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  private setState(newState: PullFlowState, contextUpdates?: Partial<PullFlowContext>): void {
    this.state = newState
    if (contextUpdates) {
      this.context = { ...this.context, ...contextUpdates }
    }
    this.notifyListeners()
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.state, this.context))
  }

  send(event: PullFlowEvent): void {
    console.log(`[PullFlow] Event: ${event.type}, Current State: ${this.state}`)

    switch (event.type) {
      case 'START':
        this.setState('selecting-runtime', {
          entryPoint: event.payload.entryPoint,
          projectId: event.payload.projectId,
          projectName: event.payload.projectName
        })
        break

      case 'RUNTIME_SELECTED':
        this.setState('selecting-scope', {
          runtimeId: event.payload.runtimeId,
          runtimeName: event.payload.runtimeName,
          runtimeEnvironment: event.payload.environment as any
        })
        break

      case 'SCOPE_SELECTED':
        this.setState('reviewing-approval', {
          scope: event.payload
        })
        break

      case 'APPROVAL_REQUIRED':
        this.setState('approval-pending', {
          requiresApproval: true,
          approvalRequestId: event.payload.requestId
        })
        break

      case 'EXECUTE_PULL':
        this.setState('executing-pull')
        break

      case 'PULL_SUCCESS':
        this.setState('success', {
          snapshotId: event.payload.snapshotId,
          itemsPulled: event.payload.itemsPulled,
          createdProjectId: event.payload.projectId,
          createdProjectName: event.payload.projectName
        })
        break

      case 'PULL_ERROR':
        this.setState('error', {
          error: event.payload.error
        })
        break

      case 'RESET':
      case 'CANCEL':
        this.state = 'idle'
        this.context = {
          entryPoint: 'manual',
          requiresApproval: false,
          scope: {
            programs: false,
            tags: false,
            dataTypes: false,
            routines: false,
            aois: false,
            executionUnits: false,
            constants: false
          }
        }
        this.notifyListeners()
        break
    }
  }
}

// Global singleton instance
export const pullFlowMachine = new PullFlowStateMachine()
