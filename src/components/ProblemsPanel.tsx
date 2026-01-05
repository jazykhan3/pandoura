import React, { useMemo } from 'react'
import './ProblemsPanel.css'

export interface Diagnostic {
  id?: string
  type?: string
  severity?: string
  message: string
  line?: number
  column?: number
  source?: string
  timestamp?: string
}

interface ProblemsPanelProps {
  diagnostics: Diagnostic[]
  onDiagnosticClick?: (diagnostic: Diagnostic) => void
  height?: string
}

export function ProblemsPanel({ diagnostics, onDiagnosticClick, height = '200px' }: ProblemsPanelProps) {
  const stats = useMemo(() => {
    const errors = diagnostics.filter(d => 
      d.severity === 'error' || d.severity === 'ERROR' || d.type === 'error'
    ).length
    const warnings = diagnostics.filter(d => 
      d.severity === 'warning' || d.severity === 'WARNING' || d.type === 'warning'
    ).length
    const infos = diagnostics.filter(d => 
      d.severity === 'info' || d.severity === 'INFO' || d.type === 'info'
    ).length
    
    return { errors, warnings, infos, total: diagnostics.length }
  }, [diagnostics])

  const getSeverityIcon = (diagnostic: Diagnostic) => {
    const severity = diagnostic.severity || diagnostic.type || 'info'
    const severityLower = severity.toLowerCase()
    
    if (severityLower === 'error') return '❌'
    if (severityLower === 'warning') return '⚠️'
    return 'ℹ️'
  }

  const getSeverityClass = (diagnostic: Diagnostic) => {
    const severity = diagnostic.severity || diagnostic.type || 'info'
    const severityLower = severity.toLowerCase()
    
    if (severityLower === 'error') return 'problem-error'
    if (severityLower === 'warning') return 'problem-warning'
    return 'problem-info'
  }

  return (
    <div className="problems-panel" style={{ height }}>
      <div className="problems-header">
        <h3>Problems</h3>
        <div className="problems-stats">
          {stats.errors > 0 && (
            <span className="stat-errors">
              ❌ {stats.errors}
            </span>
          )}
          {stats.warnings > 0 && (
            <span className="stat-warnings">
              ⚠️ {stats.warnings}
            </span>
          )}
          {stats.infos > 0 && (
            <span className="stat-infos">
              ℹ️ {stats.infos}
            </span>
          )}
          {stats.total === 0 && (
            <span className="stat-none">✅ No problems</span>
          )}
        </div>
      </div>
      
      <div className="problems-list">
        {diagnostics.length === 0 ? (
          <div className="problems-empty">
            <p>No problems detected</p>
          </div>
        ) : (
          diagnostics.map((diagnostic, index) => (
            <div
              key={diagnostic.id || `diagnostic-${index}`}
              className={`problem-item ${getSeverityClass(diagnostic)}`}
              onClick={() => onDiagnosticClick?.(diagnostic)}
              role="button"
              tabIndex={0}
            >
              <span className="problem-icon">
                {getSeverityIcon(diagnostic)}
              </span>
              <div className="problem-content">
                <div className="problem-message">
                  {diagnostic.message}
                </div>
                <div className="problem-location">
                  {diagnostic.line !== undefined && (
                    <span className="problem-line">
                      Line {diagnostic.line}
                      {diagnostic.column !== undefined && `:${diagnostic.column}`}
                    </span>
                  )}
                  {diagnostic.source && (
                    <span className="problem-source">
                      [{diagnostic.source}]
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
