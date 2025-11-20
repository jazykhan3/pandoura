import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  GitBranch,
  GitCommit,
  Tag,
  Package,
  FileText,
  Clock,
  User,
  CheckCircle,
  Circle,
  ChevronRight,
  ChevronDown,
  Download,
  Upload,
  Shield,
  ArrowUpCircle,
  RotateCcw,
  GitMerge,
  FileCode,
  Hash,
  Plus,
  Eye,
  AlertCircle,
  Info,
} from 'lucide-react'
import type { Version, Branch, BranchStage } from '../types'
import { versionApi } from '../services/api'
import { Dialog } from '../components/Dialog'
import { InputDialog } from '../components/InputDialog'
import { useProjectStore } from '../store/projectStore'

const stageColors: Record<BranchStage, string> = {
  main: 'text-purple-600 bg-purple-50',
  dev: 'text-blue-600 bg-blue-50',
  qa: 'text-yellow-600 bg-yellow-50',
  staging: 'text-orange-600 bg-orange-50',
  prod: 'text-green-600 bg-green-50',
}

interface DiffViewProps {
  versionId1: string
  versionId2: string
  onClose: () => void
}

function DiffView({ versionId1, versionId2, onClose }: DiffViewProps) {
  const [comparison, setComparison] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadComparison = async () => {
      try {
        console.log('🔍 Loading comparison:', { versionId1, versionId2 })
        const result = await versionApi.compareVersions(versionId1, versionId2)
        console.log('📊 Comparison result:', result)
        if (result.success) {
          console.log('✅ Setting comparison data:', result.comparison)
          setComparison(result.comparison)
        } else {
          console.error('❌ Comparison failed:', result)
        }
      } catch (error) {
        console.error('Failed to load comparison:', error)
      } finally {
        setLoading(false)
      }
    }
    loadComparison()
  }, [versionId1, versionId2])

  if (loading) {
    return (
      <Dialog isOpen={true} onClose={onClose} title="Version Diff">
        <div className="p-8 text-center">Loading diff...</div>
      </Dialog>
    )
  }

  return (
    <Dialog isOpen={true} onClose={onClose} title="Version Diff" size="large">
      <div className="p-6">
        {!comparison && !loading && (
          <div className="text-center text-gray-500 py-8">
            No diff data available
          </div>
        )}
        {comparison && (
          <>
            <div className="mb-4 flex gap-4 text-sm">
              <div className="text-green-600">+{comparison.summary?.totalLinesAdded || 0} added</div>
              <div className="text-red-600">-{comparison.summary?.totalLinesDeleted || 0} deleted</div>
              <div className="text-gray-600">{comparison.summary?.filesChanged || 0} files changed</div>
            </div>
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {comparison.fileChanges?.map((fileChange: any, idx: number) => (
                <div key={idx} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileCode size={16} />
                    <span className="font-medium">{fileChange.path}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      fileChange.type === 'added' ? 'bg-green-100 text-green-700' :
                      fileChange.type === 'deleted' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {fileChange.type}
                    </span>
                    <span className="text-xs text-gray-600">
                      +{fileChange.linesAdded} -{fileChange.linesDeleted}
                    </span>
                  </div>
                  {console.log('📄 File change:', fileChange)}
                  {console.log('🔍 Diff object:', fileChange.diff)}
                  {console.log('📊 Hunks:', fileChange.diff?.hunks)}
                  <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto">
                    {fileChange.diff?.hunks && fileChange.diff.hunks.length > 0 ? (
                      fileChange.diff.hunks.map((hunk: any, hunkIdx: number) => (
                        <div key={hunkIdx} className="mb-2">
                          <div className="text-blue-600 mb-1">
                            @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                          </div>
                          {hunk.lines?.map((line: any, lineIdx: number) => (
                            <div
                              key={lineIdx}
                              className={
                                line.type === 'add' ? 'bg-green-50 text-green-700' :
                                line.type === 'delete' ? 'bg-red-50 text-red-700' :
                                'text-gray-600'
                              }
                            >
                              {line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' '}
                              {line.content}
                            </div>
                          ))}
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-500 text-center py-2">
                        {fileChange.type === 'added' ? 'New file added' :
                         fileChange.type === 'deleted' ? 'File deleted' :
                         'File modified but no detailed diff available'}
                      </div>
                    )}
                  </pre>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Dialog>
  )
}

export function VersioningCenter() {
  const { activeProject } = useProjectStore()
  const [branches, setBranches] = useState<Branch[]>([])
  const [versions, setVersions] = useState<Version[]>([])
  const [snapshots, setSnapshots] = useState<any[]>([])
  const [releases, setReleases] = useState<any[]>([])
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set())
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null)
  const [selectedVersionDetails, setSelectedVersionDetails] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'versions' | 'releases' | 'snapshots'>('versions')
  const [loading, setLoading] = useState(true)
  const [showDiff, setShowDiff] = useState(false)
  const [diffVersionIds, setDiffVersionIds] = useState<[string, string] | null>(null)
  const [showCreateSnapshot, setShowCreateSnapshot] = useState(false)
  const [showCreateRelease, setShowCreateRelease] = useState(false)
  const [showPromoteDialog, setShowPromoteDialog] = useState(false)
  const [selectedRelease, setSelectedRelease] = useState<any>(null)
  const [showNoParentDialog, setShowNoParentDialog] = useState(false)

  // Load data
  useEffect(() => {
    if (activeProject) {
      loadData()
    }
  }, [activeProject, activeTab])

  const loadData = async () => {
    if (!activeProject) return

    setLoading(true)
    try {
      if (activeTab === 'versions') {
        const [branchesResult, versionsResult] = await Promise.all([
          versionApi.getBranches(activeProject.id),
          versionApi.getVersions(activeProject.id, { limit: 50 }),
        ])
        if (branchesResult.success) setBranches(branchesResult.branches)
        if (versionsResult.success) setVersions(versionsResult.versions)
      } else if (activeTab === 'snapshots') {
        const result = await versionApi.getSnapshots(activeProject.id)
        if (result.success) setSnapshots(result.snapshots)
      } else if (activeTab === 'releases') {
        const result = await versionApi.getReleases(activeProject.id)
        if (result.success) setReleases(result.releases)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load version details when selected
  useEffect(() => {
    if (selectedVersion) {
      loadVersionDetails(selectedVersion.id)
    }
  }, [selectedVersion])

  const loadVersionDetails = async (versionId: string) => {
    try {
      const result = await versionApi.getVersionById(versionId)
      if (result.success) {
        setSelectedVersionDetails(result.version)
      }
    } catch (error) {
      console.error('Failed to load version details:', error)
    }
  }

  const handleViewDiff = (version: Version) => {
    if (version.parentVersionId) {
      console.log('👁️ View diff:', { parent: version.parentVersionId, current: version.id })
      setDiffVersionIds([version.parentVersionId, version.id])
      setShowDiff(true)
    } else {
      setShowNoParentDialog(true)
    }
  }

  const handleCreateSnapshot = async (data: { name: string; description: string }) => {
    if (!activeProject || !selectedVersion) return

    try {
      const result = await versionApi.createSnapshot(activeProject.id, {
        versionId: selectedVersion.id,
        name: data.name,
        description: data.description,
        createdBy: 'Current User', // TODO: Get from auth context
      })

      if (result.success) {
        setShowCreateSnapshot(false)
        loadData()
        alert('Snapshot created successfully!')
      }
    } catch (error) {
      console.error('Failed to create snapshot:', error)
      alert('Failed to create snapshot')
    }
  }

  const handleCreateRelease = async (data: { 
    name: string
    version: string
    description: string
    snapshotId: string
  }) => {
    if (!activeProject || !selectedVersion) return

    try {
      const result = await versionApi.createRelease(activeProject.id, {
        snapshotId: data.snapshotId,
        versionId: selectedVersion.id,
        name: data.name,
        version: data.version,
        description: data.description,
        createdBy: 'Current User', // TODO: Get from auth context
        tags: ['release'],
      })

      if (result.success) {
        setShowCreateRelease(false)
        loadData()
        alert('Release created successfully!')
      }
    } catch (error) {
      console.error('Failed to create release:', error)
      alert('Failed to create release')
    }
  }

  const handlePromoteRelease = async (targetEnvironment: string) => {
    if (!selectedRelease) return

    try {
      const result = await versionApi.promoteRelease(
        selectedRelease.id,
        targetEnvironment,
        'Current User' // TODO: Get from auth context
      )

      if (result.success) {
        setShowPromoteDialog(false)
        loadData()
        alert(`Release promoted to ${targetEnvironment}!`)
      }
    } catch (error) {
      console.error('Failed to promote release:', error)
      alert('Failed to promote release')
    }
  }

  const handleApproveVersion = async (version: Version) => {
    try {
      const result = await versionApi.approveVersion(version.id, 'Current User')
      if (result.success) {
        loadData()
        alert('Version approved!')
      }
    } catch (error: any) {
      console.error('Failed to approve version:', error)
      alert(error.message || 'Failed to approve version')
    }
  }

  const handleSignVersion = async (version: Version) => {
    try {
      const result = await versionApi.signVersion(version.id, 'Current User')
      if (result.success) {
        loadData()
        alert('Version signed!')
      }
    } catch (error) {
      console.error('Failed to sign version:', error)
      alert('Failed to sign version')
    }
  }

  const toggleBranch = (branchId: string) => {
    setExpandedBranches((prev) => {
      const next = new Set(prev)
      if (next.has(branchId)) {
        next.delete(branchId)
      } else {
        next.add(branchId)
      }
      return next
    })
  }

  const getStatusIcon = (status: Version['status']) => {
    switch (status) {
      case 'released':
        return <CheckCircle size={16} className="text-green-500" />
      case 'staged':
        return <Circle size={16} className="text-orange-500" />
      case 'draft':
        return <Circle size={16} className="text-gray-400" />
    }
  }

  if (!activeProject) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle size={48} className="text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No project selected</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Diff Dialog */}
      {showDiff && diffVersionIds && (
        <DiffView
          versionId1={diffVersionIds[0]}
          versionId2={diffVersionIds[1]}
          onClose={() => setShowDiff(false)}
        />
      )}

      {/* No Parent Version Dialog */}
      {showNoParentDialog && (
        <Dialog isOpen={showNoParentDialog} onClose={() => setShowNoParentDialog(false)} title="Cannot View Diff">
          <div className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <Info size={24} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-gray-700 mb-2">
                  This is the first version and has no parent version to compare with.
                </p>
                <p className="text-xs text-gray-500">
                  Create more versions to view diffs between them.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowNoParentDialog(false)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Create Snapshot Dialog */}
      {showCreateSnapshot && (
        <InputDialog
          title="Create Snapshot"
          isOpen={showCreateSnapshot}
          onClose={() => setShowCreateSnapshot(false)}
          onConfirm={(name, description) => handleCreateSnapshot({ name, description })}
          placeholder="Snapshot name"
          descriptionPlaceholder="Description (optional)"
        />
      )}

      {/* Create Release Dialog */}
      {showCreateRelease && (
        <Dialog isOpen={showCreateRelease} onClose={() => setShowCreateRelease(false)} title="Create Release">
          <div className="p-6">
            <p className="text-sm text-gray-600 mb-4">
              Creating a release will bundle the current version and mark it as immutable.
            </p>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Release name"
                className="w-full px-3 py-2 border rounded-lg"
                id="release-name"
              />
              <input
                type="text"
                placeholder="Version (e.g., v1.0.0)"
                className="w-full px-3 py-2 border rounded-lg"
                id="release-version"
              />
              <textarea
                placeholder="Description"
                className="w-full px-3 py-2 border rounded-lg"
                rows={3}
                id="release-description"
              />
              <select
                className="w-full px-3 py-2 border rounded-lg"
                id="release-snapshot"
              >
                <option value="">Select snapshot</option>
                {snapshots.map((snap) => (
                  <option key={snap.id} value={snap.id}>
                    {snap.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <button
                onClick={() => setShowCreateRelease(false)}
                className="px-4 py-2 border rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const name = (document.getElementById('release-name') as HTMLInputElement).value
                  const version = (document.getElementById('release-version') as HTMLInputElement).value
                  const description = (document.getElementById('release-description') as HTMLTextAreaElement).value
                  const snapshotId = (document.getElementById('release-snapshot') as HTMLSelectElement).value
                  if (name && version && snapshotId) {
                    handleCreateRelease({ name, version, description, snapshotId })
                  }
                }}
                className="px-4 py-2 bg-[#FF6A00] text-white rounded-lg"
              >
                Create Release
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Promote Dialog */}
      {showPromoteDialog && (
        <Dialog isOpen={showPromoteDialog} onClose={() => setShowPromoteDialog(false)} title="Promote Release">
          <div className="p-6">
            <p className="text-sm text-gray-600 mb-4">
              Select target environment for deployment
            </p>
            <div className="space-y-2">
              {['dev', 'qa', 'staging', 'prod'].map((env) => (
                <button
                  key={env}
                  onClick={() => handlePromoteRelease(env)}
                  className="w-full px-4 py-2 border rounded-lg hover:bg-gray-50 text-left"
                >
                  {env.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </Dialog>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold text-gray-800">Versioning Center</h1>
            <span className="text-sm text-gray-600">- {activeProject.name}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateSnapshot(true)}
              disabled={!selectedVersion}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Package size={16} />
              Create Snapshot
            </button>
            <button
              onClick={() => setShowCreateRelease(true)}
              disabled={!selectedVersion}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Tag size={16} />
              Create Release
            </button>
            <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2">
              <Upload size={16} />
              Import Bundle
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column - Branch/Stage Tree */}
        <div className="w-[20%] bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Branches & Stages</h2>
            
            {loading ? (
              <div className="text-sm text-gray-500">Loading branches...</div>
            ) : (
              <div className="space-y-1">
                {branches.map((branch) => {
                  const isExpanded = expandedBranches.has(branch.id)
                  const hasChildren = branches.some((b) => b.parentBranchId === branch.id)

                  return (
                    <div key={branch.id}>
                      <button
                        onClick={() => toggleBranch(branch.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
                      >
                        {hasChildren && (
                          <span className="text-gray-400">
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </span>
                        )}
                        {!hasChildren && <span className="w-4" />}
                        <GitBranch size={16} className="text-gray-500" />
                        <span className="text-sm font-medium text-gray-700 flex-1">{branch.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${stageColors[branch.stage]}`}>
                          {branch.stage}
                        </span>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Quick Stats */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h3 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Statistics</h3>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Versions:</span>
                  <span className="font-medium">{versions.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Snapshots:</span>
                  <span className="font-medium">{snapshots.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Releases:</span>
                  <span className="font-medium">{releases.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Main Column - Versions List */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="bg-white border-b border-gray-200 px-6">
            <div className="flex gap-6">
              <button
                onClick={() => setActiveTab('versions')}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'versions'
                    ? 'border-[#FF6A00] text-[#FF6A00]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Versions
              </button>
              <button
                onClick={() => setActiveTab('releases')}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'releases'
                    ? 'border-[#FF6A00] text-[#FF6A00]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Releases
              </button>
              <button
                onClick={() => setActiveTab('snapshots')}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'snapshots'
                    ? 'border-[#FF6A00] text-[#FF6A00]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Snapshots
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="text-center text-gray-500 py-8">Loading...</div>
            ) : (
              <>
                {activeTab === 'versions' && (
                  <div className="space-y-3">
                    {versions.length === 0 ? (
                      <div className="text-center text-gray-500 py-8">
                        No versions yet. Create your first version!
                      </div>
                    ) : (
                      versions.map((version) => (
                        <motion.div
                          key={version.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`bg-white border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer ${
                            selectedVersion?.id === version.id ? 'border-[#FF6A00] ring-2 ring-[#FF6A00]/20' : 'border-gray-200'
                          }`}
                          onClick={() => setSelectedVersion(version)}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <GitCommit size={20} className="text-gray-400" />
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-base font-semibold text-gray-800">{version.version}</h3>
                                  {getStatusIcon(version.status)}
                                  {version.signed && <Shield size={16} className="text-blue-500" />}
                                </div>
                                <p className="text-sm text-gray-600">{version.message || 'No message'}</p>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div className="flex items-center gap-2 text-gray-600">
                              <User size={14} />
                              {version.author}
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <Clock size={14} />
                              {new Date(version.timestamp).toLocaleDateString()}
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <FileCode size={14} />
                              {version.filesChanged} files
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <Hash size={14} />
                              {version.checksum?.substring(0, 8)}
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex gap-2 text-xs text-gray-600">
                              <span>Approvals: {version.approvals}/{version.approvalsRequired}</span>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleViewDiff(version)
                                }}
                                className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors flex items-center gap-1"
                              >
                                <Eye size={12} />
                                Diff
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleApproveVersion(version)
                                }}
                                disabled={version.approvals >= version.approvalsRequired}
                                className="px-3 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded transition-colors disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleSignVersion(version)
                                }}
                                disabled={version.signed}
                                className="px-3 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors flex items-center gap-1 disabled:opacity-50"
                              >
                                <Shield size={12} />
                                Sign
                              </button>
                            </div>
                          </div>

                          {version.tags && version.tags.length > 0 && (
                            <div className="mt-2 flex gap-2">
                              {version.tags.map((tag) => (
                                <span key={tag} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'releases' && (
                  <div className="space-y-3">
                    {releases.length === 0 ? (
                      <div className="text-center text-gray-500 py-8">
                        No releases yet. Create your first release!
                      </div>
                    ) : (
                      releases.map((release) => (
                        <motion.div
                          key={release.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <Package size={20} className="text-[#FF6A00]" />
                              <div>
                                <h3 className="text-base font-semibold text-gray-800">{release.name}</h3>
                                <p className="text-sm text-gray-600">{release.description}</p>
                              </div>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              release.status === 'active' ? 'bg-green-100 text-green-700' :
                              release.status === 'deprecated' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {release.status}
                            </span>
                          </div>

                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex gap-4 text-sm text-gray-600">
                              <span>{release.version}</span>
                              <span>•</span>
                              <span>{new Date(release.createdAt).toLocaleDateString()}</span>
                              {release.signed && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-1 text-blue-600">
                                    <Shield size={14} />
                                    Signed
                                  </span>
                                </>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                setSelectedRelease(release)
                                setShowPromoteDialog(true)
                              }}
                              className="px-3 py-1 text-xs bg-[#FF6A00] text-white hover:bg-[#E55F00] rounded transition-colors flex items-center gap-1"
                            >
                              <ArrowUpCircle size={12} />
                              Promote
                            </button>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'snapshots' && (
                  <div className="space-y-3">
                    {snapshots.length === 0 ? (
                      <div className="text-center text-gray-500 py-8">
                        No snapshots yet. Create your first snapshot!
                      </div>
                    ) : (
                      snapshots.map((snapshot) => (
                        <motion.div
                          key={snapshot.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all"
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <Package size={20} className="text-gray-400" />
                            <div>
                              <h3 className="text-base font-semibold text-gray-800">{snapshot.name}</h3>
                              <p className="text-sm text-gray-600">{snapshot.description}</p>
                            </div>
                          </div>
                          <div className="text-sm text-gray-600">
                            Created {new Date(snapshot.createdAt).toLocaleDateString()} by {snapshot.createdBy}
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Column - Version Details */}
        <div className="w-[20%] bg-white border-l border-gray-200 overflow-y-auto">
          <div className="p-4">
            {selectedVersion && selectedVersionDetails ? (
              <>
                <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Version Details</h2>
                
                <div className="space-y-4">
                  {/* Status Section */}
                  <div>
                    <h3 className="text-xs font-medium text-gray-600 mb-2">Status</h3>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(selectedVersion.status)}
                      <span className="text-sm text-gray-800 capitalize">{selectedVersion.status}</span>
                    </div>
                  </div>

                  {/* Signature Section */}
                  <div>
                    <h3 className="text-xs font-medium text-gray-600 mb-2">Signature</h3>
                    <div className="flex items-center gap-2">
                      <Shield size={16} className={selectedVersion.signed ? 'text-blue-500' : 'text-gray-400'} />
                      <span className="text-sm text-gray-800">{selectedVersion.signed ? 'Signed' : 'Not signed'}</span>
                    </div>
                    {selectedVersion.signed && selectedVersion.signedBy && (
                      <div className="text-xs text-gray-600 mt-1">
                        by {selectedVersion.signedBy}
                      </div>
                    )}
                  </div>

                  {/* Approvals */}
                  <div>
                    <h3 className="text-xs font-medium text-gray-600 mb-2">Approvals</h3>
                    <div className="text-sm">
                      <span className="font-medium">{selectedVersion.approvals}</span>
                      <span className="text-gray-600"> of {selectedVersion.approvalsRequired}</span>
                    </div>
                    {selectedVersionDetails.approvers && selectedVersionDetails.approvers.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {selectedVersionDetails.approvers.map((approver: any, idx: number) => (
                          <div key={idx} className="text-xs text-gray-600 flex items-center gap-2">
                            <CheckCircle size={12} className="text-green-500" />
                            {approver.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* File Tree */}
                  <div>
                    <h3 className="text-xs font-medium text-gray-600 mb-2">
                      Changed Files ({selectedVersionDetails.files?.length || 0})
                    </h3>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {selectedVersionDetails.files?.map((file: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-gray-700 py-1">
                          <FileText size={14} className={
                            file.changeType === 'added' ? 'text-green-500' :
                            file.changeType === 'deleted' ? 'text-red-500' :
                            'text-blue-500'
                          } />
                          <span className="truncate" title={file.filePath}>{file.filePath}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Changelog */}
                  {selectedVersionDetails.changelog && selectedVersionDetails.changelog.length > 0 && (
                    <div>
                      <h3 className="text-xs font-medium text-gray-600 mb-2">History</h3>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {selectedVersionDetails.changelog.map((entry: any, idx: number) => (
                          <div key={idx} className="text-xs text-gray-600 border-l-2 border-gray-300 pl-2">
                            <div className="font-medium">{entry.action}</div>
                            <div className="text-gray-500">by {entry.actor}</div>
                            <div className="text-gray-500">
                              {new Date(entry.timestamp).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Storage Info */}
                  {selectedVersion.totalSizeBytes && (
                    <div>
                      <h3 className="text-xs font-medium text-gray-600 mb-2">Storage</h3>
                      <div className="text-xs text-gray-600 space-y-1">
                        <div>Original: {(selectedVersion.totalSizeBytes / 1024).toFixed(2)} KB</div>
                        {selectedVersion.compressedSizeBytes && (
                          <div>Compressed: {(selectedVersion.compressedSizeBytes / 1024).toFixed(2)} KB</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="pt-4 border-t border-gray-200 space-y-2">
                    <button
                      onClick={() => handleViewDiff(selectedVersion)}
                      className="w-full px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                    >
                      <Eye size={16} />
                      View Diff
                    </button>
                    <button className="w-full px-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2">
                      <Download size={16} />
                      Download Bundle
                    </button>
                    {selectedVersion.signed && (
                      <button className="w-full px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2">
                        <Shield size={16} />
                        Verify Signature
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center text-gray-500 text-sm mt-8">
                Select a version to view details
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
