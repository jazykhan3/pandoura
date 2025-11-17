import { useState } from 'react'
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
} from 'lucide-react'
import type { Version, Branch, BranchStage } from '../types'

// Mock data for development
const mockBranches: Branch[] = [
  { id: '1', name: 'main', stage: 'main', createdAt: '2025-01-01', createdBy: 'system', isDefault: true },
  { id: '2', name: 'development', stage: 'dev', createdAt: '2025-01-10', createdBy: 'admin', parentBranch: '1', isDefault: false },
  { id: '3', name: 'qa-testing', stage: 'qa', createdAt: '2025-02-15', createdBy: 'admin', parentBranch: '2', isDefault: false },
  { id: '4', name: 'staging', stage: 'staging', createdAt: '2025-03-01', createdBy: 'admin', parentBranch: '3', isDefault: false },
  { id: '5', name: 'production', stage: 'prod', createdAt: '2025-01-01', createdBy: 'admin', parentBranch: '4', isDefault: false },
]

const mockVersions: Version[] = [
  {
    id: 'v1',
    version: 'v1.2.3',
    author: 'John Doe',
    timestamp: '2025-11-17T10:30:00',
    filesChanged: 5,
    checksum: 'a3f5c8e9',
    status: 'released',
    signed: true,
    approvals: 3,
    approvalsRequired: 3,
    linkedDeploys: 2,
    branch: 'main',
    stage: 'prod',
    message: 'Production release with critical fixes',
    tags: ['stable', 'hotfix'],
  },
  {
    id: 'v2',
    version: 'v1.2.4-rc1',
    author: 'Jane Smith',
    timestamp: '2025-11-16T14:20:00',
    filesChanged: 8,
    checksum: 'b7d2a1f4',
    status: 'staged',
    signed: false,
    approvals: 2,
    approvalsRequired: 3,
    linkedDeploys: 0,
    branch: 'staging',
    stage: 'staging',
    message: 'Release candidate for next version',
    tags: ['rc'],
  },
  {
    id: 'v3',
    version: 'v1.3.0-dev',
    author: 'Bob Johnson',
    timestamp: '2025-11-15T09:00:00',
    filesChanged: 12,
    checksum: 'c9e4f2b8',
    status: 'draft',
    signed: false,
    approvals: 0,
    approvalsRequired: 3,
    linkedDeploys: 0,
    branch: 'development',
    stage: 'dev',
    message: 'New features in development',
  },
]

const stageColors: Record<BranchStage, string> = {
  main: 'text-purple-600 bg-purple-50',
  dev: 'text-blue-600 bg-blue-50',
  qa: 'text-yellow-600 bg-yellow-50',
  staging: 'text-orange-600 bg-orange-50',
  prod: 'text-green-600 bg-green-50',
}

export function VersioningCenter() {
  const [selectedProject, setSelectedProject] = useState('Default Project')
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set(['1']))
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null)
  const [activeTab, setActiveTab] = useState<'versions' | 'releases' | 'snapshots'>('versions')

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

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6A00] focus:border-transparent"
            >
              <option>Default Project</option>
              <option>Project Alpha</option>
              <option>Project Beta</option>
            </select>
            <h1 className="text-2xl font-semibold text-gray-800">Versioning Center</h1>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2">
              <GitBranch size={16} />
              Create Branch
            </button>
            <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2">
              <GitMerge size={16} />
              Merge
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
            
            {/* Branch Tree */}
            <div className="space-y-1">
              {mockBranches.map((branch) => {
                const isExpanded = expandedBranches.has(branch.id)
                const hasChildren = mockBranches.some((b) => b.parentBranch === branch.id)

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

            {/* Quick Actions */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h3 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Quick Actions</h3>
              <div className="space-y-1">
                <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#FF6A00] hover:text-white transition-colors text-left text-sm text-gray-700">
                  <Package size={16} />
                  Create Snapshot
                </button>
                <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#FF6A00] hover:text-white transition-colors text-left text-sm text-gray-700">
                  <Tag size={16} />
                  Create Release
                </button>
                <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#FF6A00] hover:text-white transition-colors text-left text-sm text-gray-700">
                  <Tag size={16} />
                  Tag Release
                </button>
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

          {/* Versions List */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-3">
              {mockVersions.map((version) => (
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
                        <p className="text-sm text-gray-600">{version.message}</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${stageColors[version.stage]}`}>
                      {version.stage}
                    </span>
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
                      {version.checksum}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex gap-2 text-xs text-gray-600">
                      <span>Approvals: {version.approvals}/{version.approvalsRequired}</span>
                      <span>•</span>
                      <span>Deploys: {version.linkedDeploys}</span>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors">
                        Diff
                      </button>
                      <button className="px-3 py-1 text-xs bg-[#FF6A00] text-white hover:bg-[#E55F00] rounded transition-colors flex items-center gap-1">
                        <ArrowUpCircle size={12} />
                        Promote
                      </button>
                      <button className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors flex items-center gap-1">
                        <RotateCcw size={12} />
                        Rollback
                      </button>
                      <button className="px-3 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors flex items-center gap-1">
                        <Package size={12} />
                        Release
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
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Version Details */}
        <div className="w-[20%] bg-white border-l border-gray-200 overflow-y-auto">
          <div className="p-4">
            {selectedVersion ? (
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
                  </div>

                  {/* File Tree */}
                  <div>
                    <h3 className="text-xs font-medium text-gray-600 mb-2">Changed Files ({selectedVersion.filesChanged})</h3>
                    <div className="space-y-1">
                      {[...Array(selectedVersion.filesChanged)].map((_, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-gray-700 py-1">
                          <FileText size={14} className="text-gray-400" />
                          <span>file_{i + 1}.st</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 border-t border-gray-200 space-y-2">
                    <button className="w-full px-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2">
                      <Download size={16} />
                      Download Bundle
                    </button>
                    <button className="w-full px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2">
                      <Shield size={16} />
                      Verify Signature
                    </button>
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
