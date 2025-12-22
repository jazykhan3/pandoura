import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Shield,
  Clock,
  User,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Filter,
  Download,
  RefreshCw,
  Eye,
  Lock,
  Unlock,
  Activity
} from 'lucide-react'
import { auditApi } from '../services/api'

interface AuditEntry {
  id: string
  timestamp: string
  event_type: string
  actor: string
  resource: string
  action: string
  details: Record<string, any>
  metadata: Record<string, any>
  hash: string
  sequence: number
}

interface AuditStats {
  total_entries: number
  event_types: Record<string, number>
  actors: Record<string, number>
  recent_activity: AuditEntry[]
  integrity: {
    valid: boolean
    errors: any[]
    verified_entries: number
    total_entries: number
  }
}

export function AuditViewer() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null)
  const [filters, setFilters] = useState({
    event_type: '',
    actor: '',
    search: '',
    start_date: '',
    end_date: ''
  })
  
  const [showFilters, setShowFilters] = useState(false)
  const [integrityStatus, setIntegrityStatus] = useState<any>(null)

  useEffect(() => {
    loadAuditData()
    checkIntegrity()
  }, [filters])

  const loadAuditData = async () => {
    try {
      setLoading(true)
      
      // Load entries with filters
      const entriesResponse = await auditApi.getEntries(filters)
      setEntries(entriesResponse.entries || [])
      
      // Load statistics
      const statsResponse = await auditApi.getStats()
      setStats(statsResponse.stats)
      
    } catch (error) {
      console.error('Failed to load audit data:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkIntegrity = async () => {
    try {
      const response = await auditApi.checkIntegrity()
      setIntegrityStatus(response)
    } catch (error) {
      console.error('Failed to check integrity:', error)
    }
  }

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'deployment': return <Activity className="w-4 h-4" />
      case 'approval': return <CheckCircle className="w-4 h-4" />
      case 'safety_override': return <AlertTriangle className="w-4 h-4" />
      case 'vendor_adapter': return <FileText className="w-4 h-4" />
      case 'system_initialization': return <Lock className="w-4 h-4" />
      default: return <Eye className="w-4 h-4" />
    }
  }

  const getEventColor = (eventType: string, action: string) => {
    if (action === 'failed' || action === 'rejected') return 'text-red-600'
    if (action === 'completed' || action === 'approved') return 'text-green-600'
    if (eventType === 'safety_override') return 'text-yellow-600'
    return 'text-blue-600'
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  const exportAuditLog = async () => {
    try {
      const allEntries = await auditApi.getEntries({ limit: 10000 })
      const csv = convertToCSV(allEntries.entries)
      downloadCSV(csv, 'audit-log-export.csv')
    } catch (error) {
      console.error('Failed to export audit log:', error)
    }
  }

  const convertToCSV = (entries: AuditEntry[]) => {
    const headers = ['Timestamp', 'Event Type', 'Actor', 'Resource', 'Action', 'Hash', 'Sequence']
    const rows = entries.map(entry => [
      entry.timestamp,
      entry.event_type,
      entry.actor,
      entry.resource,
      entry.action,
      entry.hash,
      entry.sequence.toString()
    ])
    
    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Audit Trail</h1>
            <p className="text-gray-600">Immutable security and compliance log</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <button
            onClick={exportAuditLog}
            className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => { loadAuditData(); checkIntegrity() }}
            className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Integrity Status */}
      {integrityStatus && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-lg border ${
            integrityStatus.valid 
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-3">
            {integrityStatus.valid ? (
              <Lock className="w-5 h-5" />
            ) : (
              <Unlock className="w-5 h-5" />
            )}
            <div>
              <h3 className="font-medium">
                Chain Integrity: {integrityStatus.valid ? 'VERIFIED' : 'COMPROMISED'}
              </h3>
              <p className="text-sm">
                {integrityStatus.verified_entries}/{integrityStatus.total_entries} entries verified
                {!integrityStatus.valid && ` • ${integrityStatus.errors?.length || 0} errors found`}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Statistics Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.total_entries}</p>
                <p className="text-sm text-gray-600">Total Entries</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <User className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{Object.keys(stats.actors).length}</p>
                <p className="text-sm text-gray-600">Unique Actors</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{Object.keys(stats.event_types).length}</p>
                <p className="text-sm text-gray-600">Event Types</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-orange-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.recent_activity[0] ? 
                    new Date(stats.recent_activity[0].timestamp).toLocaleDateString() : 'N/A'}
                </p>
                <p className="text-sm text-gray-600">Last Activity</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-gray-50 p-4 rounded-lg border"
        >
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Event Type
              </label>
              <select
                value={filters.event_type}
                onChange={(e) => setFilters({ ...filters, event_type: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">All Types</option>
                <option value="deployment">Deployment</option>
                <option value="approval">Approval</option>
                <option value="safety_override">Safety Override</option>
                <option value="vendor_adapter">Vendor Adapter</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Actor
              </label>
              <select
                value={filters.actor}
                onChange={(e) => setFilters({ ...filters, actor: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">All Actors</option>
                <option value="engineer_demo">Engineer Demo</option>
                <option value="admin_demo">Admin Demo</option>
                <option value="supervisor_demo">Supervisor Demo</option>
                <option value="system">System</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={() => setFilters({
                  event_type: '',
                  actor: '',
                  search: '',
                  start_date: '',
                  end_date: ''
                })}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-100"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Entries List */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-medium text-gray-900">Audit Entries</h2>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-gray-400" />
            <p className="mt-2 text-gray-600">Loading audit entries...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No audit entries found</p>
          </div>
        ) : (
          <div className="divide-y">
            {entries.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelectedEntry(entry)}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${getEventColor(entry.event_type, entry.action)}`}>
                    {getEventIcon(entry.event_type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 capitalize">
                        {entry.event_type.replace('_', ' ')}
                      </span>
                      <span className="text-sm text-gray-500">•</span>
                      <span className="text-sm text-gray-600 capitalize">{entry.action}</span>
                      <span className="text-sm text-gray-500">•</span>
                      <span className="text-sm text-gray-500">#{entry.sequence}</span>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-2">
                      {entry.actor} → {entry.resource}
                    </p>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(entry.timestamp)}
                      </span>
                      <span className="font-mono">
                        Hash: {entry.hash?.substring(0, 12)}...
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Entry Details Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
          >
            <div className="px-6 py-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Audit Entry Details</h3>
                <button
                  onClick={() => setSelectedEntry(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Event Type</label>
                    <p className="capitalize">{selectedEntry.event_type.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Action</label>
                    <p className="capitalize">{selectedEntry.action}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Actor</label>
                    <p>{selectedEntry.actor}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Resource</label>
                    <p>{selectedEntry.resource}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Timestamp</label>
                    <p>{formatTimestamp(selectedEntry.timestamp)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Sequence</label>
                    <p>#{selectedEntry.sequence}</p>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Hash (SHA-256)</label>
                  <p className="font-mono text-sm break-all bg-gray-100 p-2 rounded">
                    {selectedEntry.hash}
                  </p>
                </div>
                
                {Object.keys(selectedEntry.details).length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Details</label>
                    <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                      {JSON.stringify(selectedEntry.details, null, 2)}
                    </pre>
                  </div>
                )}
                
                {Object.keys(selectedEntry.metadata).length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Metadata</label>
                    <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                      {JSON.stringify(selectedEntry.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}