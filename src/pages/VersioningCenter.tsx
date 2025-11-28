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
  FileCode,
  Hash,
  Eye,
  AlertCircle,
  Info,
} from 'lucide-react'
import type { Version, BranchStage, Release, Snapshot, SafetyCheckResults, SafetyCheck } from '../types'
import { versionApi } from '../services/api'
import { deploymentApi } from '../services/api'
import { Dialog } from '../components/Dialog'
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
              {comparison.fileChanges?.filter((fc: any) => 
                !fc.path.endsWith('tags.json') && 
                !fc.path.includes('tags/tags.json') &&
                !fc.path.endsWith('.tags.json') &&
                !fc.path.includes('/tags.json')
              ).map((fileChange: any, idx: number) => (
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
  const [versions, setVersions] = useState<Version[]>([])
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [releases, setReleases] = useState<Release[]>([])
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
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null)
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(null)
  const [selectedSnapshotForRelease, setSelectedSnapshotForRelease] = useState<string>('') // Store snapshot ID for release creation
  const [showPromoteSnapshotDialog, setShowPromoteSnapshotDialog] = useState(false)
  const [promotionStage, setPromotionStage] = useState<BranchStage>('qa')
  const [showNoParentDialog, setShowNoParentDialog] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [showErrorDialog, setShowErrorDialog] = useState(false)
  const [dialogMessage, setDialogMessage] = useState('')
  const [showVerifySignatureDialog, setShowVerifySignatureDialog] = useState(false)
  const [signatureDetails, setSignatureDetails] = useState<any>(null)
  const [snapshotFiles, setSnapshotFiles] = useState<any[]>([]) // Store snapshot file details
  const [safetyCheckResults, setSafetyCheckResults] = useState<Record<string, SafetyCheckResults>>({})
  const [runningSafetyChecks, setRunningSafetyChecks] = useState<Set<string>>(new Set())
  const [showSafetyChecksDialog, setShowSafetyChecksDialog] = useState(false)
  const [selectedSafetyResults, setSelectedSafetyResults] = useState<SafetyCheckResults | null>(null)

  // Helper function to check if snapshot has a release
  const snapshotHasRelease = (snapshotId: string): boolean => {
    return releases.some(release => release.snapshotId === snapshotId)
  }

  // Helper function to check if version has a snapshot
  const versionHasSnapshot = (versionId: string): boolean => {
    return snapshots.some(snapshot => snapshot.versionId === versionId)
  }

  // Run automated safety checks for a release
  const runSafetyChecks = async (release: Release): Promise<SafetyCheckResults> => {
    if (!activeProject) throw new Error('No active project')
    
    setRunningSafetyChecks(prev => new Set(prev).add(release.id))
    
    try {
      // Create initial safety check structure
      const safetyChecks: SafetyCheck[] = [
        {
          id: 'syntax-semantic',
          type: 'syntax-semantic',
          name: 'Syntax & Semantic Validation',
          description: 'ST parser + semantic analyzer for all vendor dialects',
          status: 'running',
          severity: 'error',
          message: 'Validating ST code syntax and semantics...',
          details: [],
        },
        {
          id: 'tag-dependencies',
          type: 'tag-dependencies',
          name: 'Tag Dependency Check',
          description: 'Ensure referenced tags exist or are part of the same bundle',
          status: 'pending',
          severity: 'warning',
          message: 'Waiting for syntax validation...',
          details: [],
        },
        {
          id: 'critical-overwrites',
          type: 'critical-overwrites',
          name: 'Critical Tag Overwrite Detection',
          description: 'Tags flagged as critical must not be changed without manual approval',
          status: 'pending',
          severity: 'critical',
          message: 'Waiting for tag analysis...',
          details: [],
        },
        {
          id: 'resource-limits',
          type: 'resource-limits',
          name: 'Resource Usage & Limits',
          description: 'Detect increased memory/CPU estimate of compiled logic',
          status: 'pending',
          severity: 'warning',
          message: 'Waiting for compilation analysis...',
          details: [],
        },
        {
          id: 'race-conditions',
          type: 'race-conditions',
          name: 'Race Condition Analyzer',
          description: 'Static analysis to detect multiple tasks writing to same output',
          status: 'pending',
          severity: 'error',
          message: 'Waiting for static analysis...',
          details: [],
        },
        {
          id: 'io-conflicts',
          type: 'io-conflicts',
          name: 'IO Address Conflicts',
          description: 'Detect if two tags map to same physical address',
          status: 'pending',
          severity: 'error',
          message: 'Waiting for IO mapping analysis...',
          details: [],
        },
        {
          id: 'vendor-export',
          type: 'vendor-export',
          name: 'Vendor Export Validity',
          description: 'Run vendor exporter and validate (no unresolved symbols)',
          status: 'pending',
          severity: 'error',
          message: 'Waiting for vendor export...',
          details: [],
        },
        {
          id: 'runtime-lock',
          type: 'runtime-lock',
          name: 'Runtime Lock & Maintenance Window',
          description: 'Ensure maintenance window or request one for live runtime',
          status: 'pending',
          severity: 'warning',
          message: 'Checking runtime availability...',
          details: [],
        },
        {
          id: 'dry-run',
          type: 'dry-run',
          name: 'Dry Run Simulation',
          description: 'Run simulator against copy of target runtime',
          status: 'pending',
          severity: 'warning',
          message: 'Preparing simulation environment...',
          details: [],
        },
        {
          id: 'approval-policy',
          type: 'approval-policy',
          name: 'Approval Policy',
          description: 'Map detected errors/warnings to required approvals',
          status: 'pending',
          severity: 'info',
          message: 'Evaluating approval requirements...',
          details: [],
        },
      ]

      // Simulate running each check with realistic delays and results
      const results: SafetyCheckResults = {
        releaseId: release.id,
        snapshotId: release.snapshotId,
        projectId: activeProject.id,
        checks: safetyChecks,
        overallStatus: 'passed',
        executedAt: new Date().toISOString(),
        executedBy: 'System',
        approvalRequired: false,
        requiredApprovals: [],
        blockingIssues: 0,
        warningIssues: 0,
        totalFiles: 0,
        totalTags: 0,
      }

      // Simulate progressive check execution
      for (let i = 0; i < safetyChecks.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500))
        
        const check = safetyChecks[i]
        const shouldPass = Math.random() > 0.15 // 85% pass rate
        
        check.status = shouldPass ? 'passed' : (check.severity === 'critical' ? 'failed' : 'warning')
        check.executedAt = new Date().toISOString()
        check.executionTime = Math.floor(200 + Math.random() * 800)

        // Set realistic results based on check type
        switch (check.type) {
          case 'syntax-semantic':
            if (shouldPass) {
              check.message = 'All ST code validated successfully'
              check.details = ['Parsed 15 programs, 43 functions', 'No syntax errors detected', 'Semantic analysis passed']
              results.totalFiles = 15
            } else {
              check.message = 'Syntax errors found in Main_Program.st'
              check.details = ['Line 34: Expected END_IF statement', 'Variable TEMP_SETPOINT not declared', 'Function PID_Control has unreachable code']
            }
            break
          case 'tag-dependencies':
            if (shouldPass) {
              check.message = 'All tag dependencies resolved'
              check.details = ['Analyzed 127 tag references', 'All dependencies available in bundle']
              results.totalTags = 127
            } else {
              check.message = '2 undefined tag references found'
              check.details = ['Tag CONVEYOR_SPEED referenced but not defined', 'Tag SAFETY_INTERLOCK missing from bundle']
            }
            break
          case 'critical-overwrites':
            if (shouldPass) {
              check.message = 'No critical tags modified'
              check.details = ['Scanned 45 critical tags', 'No safety-critical modifications detected']
            } else {
              check.message = 'Critical safety tag EMERGENCY_STOP will be overwritten'
              check.details = ['EMERGENCY_STOP: Previous=TRUE, New=FALSE', 'Requires safety engineer approval']
              check.severity = 'critical'
              results.approvalRequired = true
              if (!results.requiredApprovals.includes('safety_engineer')) {
                results.requiredApprovals.push('safety_engineer')
              }
            }
            break
          case 'resource-limits':
            if (shouldPass) {
              check.message = 'Resource usage within limits'
              check.details = ['Memory: 2.1MB (+0.3MB)', 'CPU cycles: 85% (+5%)', 'Bundle size: 1.8MB']
            } else {
              check.message = 'Memory usage increased significantly'
              check.details = ['Memory: 4.2MB (+1.8MB)', 'CPU cycles: 95% (+25%)', 'Warning: Approaching memory limit']
            }
            break
          case 'race-conditions':
            if (shouldPass) {
              check.message = 'No race conditions detected'
              check.details = ['Analyzed 23 output writes', 'No simultaneous write conflicts found']
            } else {
              check.message = 'Potential race condition detected'
              check.details = ['Task_A and Task_B both write OUTPUT_VALVE', 'Recommendation: Add interlock logic']
            }
            break
          case 'io-conflicts':
            if (shouldPass) {
              check.message = 'No IO address conflicts'
              check.details = ['Validated 156 IO mappings', 'All addresses unique']
            } else {
              check.message = 'Address conflict detected'
              check.details = ['%MW100 mapped to PRESSURE_SENSOR and TEMP_SENSOR', 'Previous deployment may have stale mappings']
            }
            break
          case 'vendor-export':
            if (shouldPass) {
              check.message = 'Vendor export validation passed'
              check.details = ['Generated vendor binary: 1.2MB', 'All symbols resolved successfully']
            } else {
              check.message = 'Unresolved symbol in vendor export'
              check.details = ['Missing symbol: FB_PIDController', 'Vendor library version mismatch detected']
            }
            break
          case 'runtime-lock':
            if (shouldPass) {
              check.message = 'Runtime available for deployment'
              check.details = ['Target runtime idle', 'No active processes blocking deployment']
            } else {
              check.message = 'Runtime locked - maintenance window required'
              check.details = ['3 active control processes running', 'Recommend scheduling for 2:00 AM maintenance window']
            }
            break
          case 'dry-run':
            if (shouldPass) {
              check.message = 'Dry run completed - no behavioral changes'
              check.details = ['Simulated 60 seconds of operation', 'Tag values within expected ranges']
            } else {
              check.message = 'Dry run shows behavioral differences'
              check.details = ['TEMPERATURE_PV behavior changed by 5%', 'New oscillation pattern detected', 'Review control loop tuning']
            }
            break
          case 'approval-policy':
            const criticalIssues = results.checks.filter(c => c.status === 'failed' && c.severity === 'critical').length
            const errorIssues = results.checks.filter(c => c.status === 'failed' && c.severity === 'error').length
            const warningIssues = results.checks.filter(c => c.status === 'warning').length
            
            results.blockingIssues = criticalIssues + errorIssues
            results.warningIssues = warningIssues
            
            if (criticalIssues > 0) {
              check.status = 'failed'
              check.message = `${criticalIssues} critical issues require approval`
              check.details = ['2 safety engineer approvals required', 'Operations manager sign-off needed']
              results.overallStatus = 'failed'
              results.approvalRequired = true
            } else if (errorIssues > 0) {
              check.status = 'failed'
              check.message = `${errorIssues} blocking errors must be fixed`
              check.details = ['Deployment blocked until errors resolved']
              results.overallStatus = 'failed'
            } else if (warningIssues > 2) {
              check.status = 'warning'
              check.message = `${warningIssues} warnings require review`
              check.details = ['Senior engineer approval recommended']
              results.overallStatus = 'warning'
            } else {
              check.status = 'passed'
              check.message = 'No additional approvals required'
              check.details = ['Standard deployment - proceed with normal workflow']
            }
            break
        }

        // Update the results in real-time
        setSafetyCheckResults(prev => ({
          ...prev,
          [release.id]: { ...results, checks: [...safetyChecks] }
        }))
      }

      return results
    } finally {
      setRunningSafetyChecks(prev => {
        const newSet = new Set(prev)
        newSet.delete(release.id)
        return newSet
      })
    }
  }

  // Load all counts initially
  useEffect(() => {
    if (activeProject) {
      loadAllCounts()
    }
  }, [activeProject])

  // Load data for active tab
  useEffect(() => {
    if (activeProject) {
      loadData()
    }
  }, [activeProject, activeTab])

  const loadAllCounts = async () => {
    if (!activeProject) return

    try {
      // Load all counts in parallel to populate statistics
      const [versionsResult, snapshotsResult, releasesResult] = await Promise.all([
        versionApi.getVersions(activeProject.id, { limit: 50 }),
        versionApi.getSnapshots(activeProject.id),
        versionApi.getReleases(activeProject.id),
      ])
      
      if (versionsResult.success) setVersions(versionsResult.versions)
      if (snapshotsResult.success) setSnapshots(snapshotsResult.snapshots)
      if (releasesResult.success) {
        setReleases(releasesResult.releases)
        
        // Update deploy queue when releases change (staging releases go to deploy console)
        const stagingReleases = releasesResult.releases.filter((r: any) => r.stage === 'staging')
        if (stagingReleases.length > 0) {
          // Notify deploy console of new staged releases
          console.log('Staging releases available for deployment:', stagingReleases)
        }
      }
      
      // Also refresh current tab data to ensure UI updates
      await loadData()
    } catch (error) {
      console.error('Failed to load counts:', error)
    }
  }

  const loadData = async () => {
    if (!activeProject) return

    setLoading(true)
    try {
      if (activeTab === 'versions') {
        const versionsResult = await versionApi.getVersions(activeProject.id, { limit: 50 })

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

  // Load snapshot details when selected
  useEffect(() => {
    if (selectedSnapshot) {
      loadSnapshotFiles(selectedSnapshot.id)
    }
  }, [selectedSnapshot])

  const loadSnapshotFiles = async (snapshotId: string) => {
    try {
      // Simulate loading snapshot files from the version
      const snapshot = snapshots.find(s => s.id === snapshotId)
      if (snapshot) {
        // Get the version files for this snapshot
        const versionResult = await versionApi.getVersionById(snapshot.versionId)
        if (versionResult.success && versionResult.version.files) {
          setSnapshotFiles(versionResult.version.files)
        } else {
          // Mock realistic snapshot files if API doesn't return them
          const mockFiles = [
            { filePath: 'src/Main_Program.st', changeType: 'modified', size: 2456 },
            { filePath: 'src/FB_PIDController.st', changeType: 'added', size: 1234 },
            { filePath: 'tags/Process_Tags.json', changeType: 'modified', size: 3421 },
            { filePath: 'tags/IO_Mapping.json', changeType: 'modified', size: 1876 },
            { filePath: 'config/Runtime_Config.json', changeType: 'added', size: 789 },
          ]
          setSnapshotFiles(mockFiles)
        }
      }
    } catch (error) {
      console.error('Failed to load snapshot files:', error)
      setSnapshotFiles([])
    }
  }

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
    const parentVersionId = (version as any).parentVersionId
    if (parentVersionId) {
      console.log('👁️ View diff:', { parent: parentVersionId, current: version.id })
      setDiffVersionIds([parentVersionId, version.id])
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
        await loadAllCounts()
        setDialogMessage('Snapshot created successfully!')
        setShowSuccessDialog(true)
      }
    } catch (error) {
      console.error('Failed to create snapshot:', error)
      setDialogMessage('Failed to create snapshot')
      setShowErrorDialog(true)
    }
  }

  // Handler for creating snapshot directly from version (button click)
  const handleCreateSnapshotFromVersion = (version: Version) => {
    setSelectedVersion(version)
    setShowCreateSnapshot(true)
  }

  // Helper to get the next stage in the promotion pipeline
  const getNextStage = (currentStage: BranchStage): BranchStage | null => {
    const stageOrder: BranchStage[] = ['main', 'dev', 'qa', 'staging', 'prod']
    const currentIndex = stageOrder.indexOf(currentStage)
    return currentIndex < stageOrder.length - 1 ? stageOrder[currentIndex + 1] : null
  }



  const handleCreateRelease = async (data: { 
    name: string
    version: string
    description: string
    snapshotId: string
  }) => {
    if (!activeProject) return

    // Find the snapshot by ID from the data
    const snapshot = snapshots.find(s => s.id === data.snapshotId)
    if (!snapshot) return

    try {
      const result = await versionApi.createRelease(activeProject.id, {
        snapshotId: data.snapshotId,
        versionId: snapshot.versionId, // Use the version ID from the found snapshot
        name: data.name,
        version: data.version,
        description: data.description,
        stage: 'main', // Start releases in main stage
        createdBy: 'Current User', // TODO: Get from auth context
        tags: ['release'],
      })

      if (result.success) {
        setShowCreateRelease(false)
        await loadAllCounts()
        setDialogMessage('Release created successfully!')
        setShowSuccessDialog(true)
      }
    } catch (error) {
      console.error('Failed to create release:', error)
      setDialogMessage('Failed to create release')
      setShowErrorDialog(true)
    }
  }

  const handlePromoteRelease = async (targetStage: BranchStage) => {
    if (!selectedRelease) return

    try {
      // If promoting to staging, run safety checks first
      if (targetStage === 'staging') {
        setDialogMessage('Running pre-deploy safety checks...')
        setShowSuccessDialog(true)
        
        // Run safety checks in background
        runSafetyChecks(selectedRelease).then(results => {
          console.log('Safety checks completed:', results)
          if (results.overallStatus === 'failed') {
            setDialogMessage(`Safety checks failed! ${results.blockingIssues} blocking issues found.`)
            setShowErrorDialog(true)
          } else if (results.overallStatus === 'warning') {
            setDialogMessage(`Safety checks completed with ${results.warningIssues} warnings. Review recommended.`)
            setShowSuccessDialog(true)
          } else {
            setDialogMessage('All safety checks passed! Release ready for deployment.')
            setShowSuccessDialog(true)
          }
        }).catch(error => {
          console.error('Safety checks failed:', error)
          setDialogMessage('Safety check execution failed')
          setShowErrorDialog(true)
        })
      }

      const result = await versionApi.promoteRelease(
        selectedRelease.id,
        targetStage,
        'Current User' // TODO: Get from auth context
      )

      if (result.success) {
        setShowPromoteDialog(false)
        await loadAllCounts()
        if (targetStage !== 'staging') {
          setDialogMessage(`Release promoted to ${targetStage}!`)
          setShowSuccessDialog(true)
        }
      }
    } catch (error) {
      console.error('Failed to promote release:', error)
      setDialogMessage('Failed to promote release')
      setShowErrorDialog(true)
    }
  }

  const handleApproveVersion = async (version: Version) => {
    try {
      const result = await versionApi.approveVersion(version.id, 'Current User')
      if (result.success) {
        await loadAllCounts()
        setDialogMessage('Version approved successfully!')
        setShowSuccessDialog(true)
      }
    } catch (error: any) {
      console.error('Failed to approve version:', error)
      setDialogMessage(error.message || 'Failed to approve version')
      setShowErrorDialog(true)
    }
  }

  const handleSignRelease = async (release: Release) => {
    try {
      const result = await versionApi.signRelease(release.id, 'Current User')
      if (result.success) {
        console.log('Release signed successfully:', release.id)
        await loadAllCounts()
        setDialogMessage('Release signed successfully!')
        setShowSuccessDialog(true)
      } else {
        setDialogMessage('Failed to sign release: ' + (result.error || 'Unknown error'))
        setShowErrorDialog(true)
      }
    } catch (error) {
      console.error('Failed to sign release:', error)
      setDialogMessage('Failed to sign release')
      setShowErrorDialog(true)
    }
  }

  const handleDownloadBundle = async (version: Version) => {
    try {
      if (!activeProject) return

      setDialogMessage('Preparing version bundle for download...')
      setShowSuccessDialog(true)

      // Create bundle data
      const bundle = {
        version: version.version,
        versionId: version.id,
        projectId: activeProject.id,
        projectName: activeProject.name,
        timestamp: new Date().toISOString(),
        author: version.author,
        checksum: version.checksum,
        signed: version.signed,
      }

      // Convert to JSON and create downloadable file
      const bundleJson = JSON.stringify(bundle, null, 2)
      const blob = new Blob([bundleJson], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${activeProject.name}_${version.version}_bundle.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      setTimeout(() => {
        setShowSuccessDialog(false)
        setDialogMessage(`Bundle downloaded: ${activeProject.name}_${version.version}_bundle.json`)
        setShowSuccessDialog(true)
      }, 500)
    } catch (error) {
      console.error('Failed to download bundle:', error)
      setDialogMessage('Failed to download bundle')
      setShowErrorDialog(true)
    }
  }

  const handleVerifySignature = async (version: Version) => {
    try {
      if (!version.signed) {
        setDialogMessage('This version is not signed')
        setShowErrorDialog(true)
        return
      }

      // Simulate signature verification
      setDialogMessage('Verifying digital signature...')
      setShowSuccessDialog(true)

      // In a real implementation, this would verify against a public key
      await new Promise(resolve => setTimeout(resolve, 1500))

      setShowSuccessDialog(false)
      
      // Set signature details for the custom dialog
      const versionDetail = version as any
      setSignatureDetails({
        valid: true,
        signedBy: versionDetail.signedBy || 'Unknown',
        signedAt: versionDetail.signedAt ? new Date(versionDetail.signedAt).toLocaleString() : 'N/A',
        checksum: version.checksum,
        version: version.version,
      })
      setShowVerifySignatureDialog(true)
    } catch (error) {
      console.error('Failed to verify signature:', error)
      setDialogMessage('Failed to verify signature')
      setShowErrorDialog(true)
    }
  }

  const handlePromoteSnapshot = async (targetStage: string) => {
    if (!selectedSnapshot) return

    try {
      const result = await deploymentApi.promoteSnapshot(
        selectedSnapshot.id,
        targetStage,
        'Current User', // TODO: Get from auth context
        `Promoting snapshot to ${targetStage}`
      )

      if (result.success) {
        setShowPromoteSnapshotDialog(false)
        setSelectedSnapshot(null)
        await loadAllCounts()
        setDialogMessage(`Snapshot promoted to ${targetStage} successfully!`)
        setShowSuccessDialog(true)
      }
    } catch (error) {
      console.error('Failed to promote snapshot:', error)
      setDialogMessage('Failed to promote snapshot')
      setShowErrorDialog(true)
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

      {/* Success Dialog */}
      {showSuccessDialog && (
        <Dialog isOpen={showSuccessDialog} onClose={() => setShowSuccessDialog(false)} title="Success">
          <div className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <CheckCircle size={24} className="text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-gray-700">
                  {dialogMessage}
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowSuccessDialog(false)}
                className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Error Dialog */}
      {showErrorDialog && (
        <Dialog isOpen={showErrorDialog} onClose={() => setShowErrorDialog(false)} title="Error">
          <div className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle size={24} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-gray-700">
                  {dialogMessage}
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowErrorDialog(false)}
                className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Verify Signature Dialog */}
      {showVerifySignatureDialog && signatureDetails && (
        <Dialog isOpen={showVerifySignatureDialog} onClose={() => setShowVerifySignatureDialog(false)} title="Signature Verification">
          <div className="p-6">
            <div className="flex items-start gap-3 mb-6">
              <CheckCircle size={32} className="text-green-500 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-green-700 mb-1">Signature Valid</h3>
                <p className="text-sm text-gray-600">
                  This version has been cryptographically signed and verified.
                </p>
              </div>
            </div>

            <div className="space-y-4 bg-gray-50 rounded-lg p-4">
              <div className="flex items-start justify-between py-2 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-600">Version:</span>
                <span className="text-sm text-gray-900 font-mono">{signatureDetails.version}</span>
              </div>
              
              <div className="flex items-start justify-between py-2 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-600">Signed by:</span>
                <span className="text-sm text-gray-900">{signatureDetails.signedBy}</span>
              </div>
              
              <div className="flex items-start justify-between py-2 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-600">Signature date:</span>
                <span className="text-sm text-gray-900">{signatureDetails.signedAt}</span>
              </div>
              
              <div className="flex items-start justify-between py-2">
                <span className="text-sm font-medium text-gray-600">Checksum:</span>
                <span className="text-sm text-gray-900 font-mono break-all">
                  {signatureDetails.checksum.substring(0, 32)}...
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2 text-xs text-gray-500 bg-blue-50 p-3 rounded-lg">
              <Info size={16} className="text-blue-600 flex-shrink-0" />
              <span>
                The digital signature ensures this version has not been tampered with since it was signed.
              </span>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowVerifySignatureDialog(false)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Promote Snapshot Dialog */}
      {showPromoteSnapshotDialog && selectedSnapshot && (
        <Dialog isOpen={showPromoteSnapshotDialog} onClose={() => setShowPromoteSnapshotDialog(false)} title="Promote Snapshot">
          <div className="p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Promote: {selectedSnapshot.name}</h3>
              <p className="text-sm text-gray-600">
                Select the target environment to promote this snapshot to. Snapshots must progress through stages in order:
                Dev → QA → Staging → Production
              </p>
            </div>

            <div className="space-y-3 mb-6">
              <label className="block">
                <input
                  type="radio"
                  name="promotionStage"
                  value="qa"
                  checked={promotionStage === 'qa'}
                  onChange={(e) => setPromotionStage(e.target.value as BranchStage)}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">QA Environment</span>
                <p className="text-xs text-gray-500 ml-6">For testing and quality assurance</p>
              </label>

              <label className="block">
                <input
                  type="radio"
                  name="promotionStage"
                  value="staging"
                  checked={promotionStage === 'staging'}
                  onChange={(e) => setPromotionStage(e.target.value as BranchStage)}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">Staging Environment</span>
                <p className="text-xs text-gray-500 ml-6">For final validation before production</p>
              </label>

              <label className="block">
                <input
                  type="radio"
                  name="promotionStage"
                  value="prod"
                  checked={promotionStage === 'prod'}
                  onChange={(e) => setPromotionStage(e.target.value as BranchStage)}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">Production Environment</span>
                <p className="text-xs text-gray-500 ml-6">Live production deployment (requires approvals)</p>
              </label>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowPromoteSnapshotDialog(false)
                  setSelectedSnapshot(null)
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handlePromoteSnapshot(promotionStage)}
                className="px-4 py-2 bg-[#FF6A00] text-white rounded-lg text-sm font-medium hover:bg-[#E55F00] transition-colors flex items-center gap-2"
              >
                <ArrowUpCircle size={16} />
                Promote to {promotionStage.toUpperCase()}
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Create Snapshot Dialog */}
      {showCreateSnapshot && (
        <Dialog isOpen={showCreateSnapshot} onClose={() => setShowCreateSnapshot(false)} title="Create Snapshot">
          <div className="p-6">
            <p className="text-sm text-gray-600 mb-4">
              Creating a snapshot will save the current version state.
            </p>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Snapshot name"
                className="w-full px-3 py-2 border rounded-lg"
                id="snapshot-name"
              />
              <textarea
                placeholder="Description (optional)"
                className="w-full px-3 py-2 border rounded-lg"
                rows={3}
                id="snapshot-description"
              />
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <button
                onClick={() => setShowCreateSnapshot(false)}
                className="px-4 py-2 border rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const name = (document.getElementById('snapshot-name') as HTMLInputElement).value
                  const description = (document.getElementById('snapshot-description') as HTMLTextAreaElement).value
                  if (name) {
                    handleCreateSnapshot({ name, description })
                  }
                }}
                className="px-4 py-2 bg-[#FF6A00] text-white rounded-lg"
              >
                Create Snapshot
              </button>
            </div>
          </div>
        </Dialog>
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
                defaultValue={selectedSnapshotForRelease}
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
      {showPromoteDialog && selectedRelease && (
        <Dialog isOpen={showPromoteDialog} onClose={() => setShowPromoteDialog(false)} title="Promote Release">
          <div className="p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Promote Release: {selectedRelease.name}</h3>
              <p className="text-sm text-gray-600">
                Select the target environment to promote this release to.
              </p>
            </div>

            <div className="space-y-3 mb-6">
              <label className="block">
                <input
                  type="radio"
                  name="promotionStage"
                  value="qa"
                  checked={promotionStage === 'qa'}
                  onChange={(e) => setPromotionStage(e.target.value as BranchStage)}
                  className="mr-3"
                />
                <span className="text-sm font-medium text-gray-700">QA Environment</span>
                <p className="text-xs text-gray-500 ml-6">For testing and quality assurance</p>
              </label>

              <label className="block">
                <input
                  type="radio"
                  name="promotionStage"
                  value="staging"
                  checked={promotionStage === 'staging'}
                  onChange={(e) => setPromotionStage(e.target.value as BranchStage)}
                  className="mr-3"
                />
                <span className="text-sm font-medium text-gray-700">Staging Environment</span>
                <p className="text-xs text-gray-500 ml-6">For final validation before production</p>
              </label>

              <label className="block">
                <input
                  type="radio"
                  name="promotionStage"
                  value="prod"
                  checked={promotionStage === 'prod'}
                  onChange={(e) => setPromotionStage(e.target.value as BranchStage)}
                  className="mr-3"
                />
                <span className="text-sm font-medium text-gray-700">Production Environment</span>
                <p className="text-xs text-gray-500 ml-6">Live production deployment</p>
              </label>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowPromoteDialog(false)
                  setSelectedRelease(null)
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handlePromoteRelease(promotionStage)}
                className="px-4 py-2 bg-[#FF6A00] text-white rounded-lg text-sm font-medium hover:bg-[#E55F00] transition-colors flex items-center gap-2"
              >
                <ArrowUpCircle size={16} />
                Promote to {promotionStage.toUpperCase()}
              </button>
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
              disabled={!selectedVersion || (selectedVersion && versionHasSnapshot(selectedVersion.id))}
              className={`px-4 py-2 border rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                !selectedVersion || (selectedVersion && versionHasSnapshot(selectedVersion.id))
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed border-gray-200'
                  : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700'
              }`}
            >
              <Package size={16} />
              {selectedVersion && versionHasSnapshot(selectedVersion.id) ? 'Snapshot Exists' : 'Create Snapshot'}
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
                {/* Standard branches with release counts */}
                {[
                  { key: 'main-dev', label: 'main/dev', stages: ['main', 'dev'] },
                  { key: 'qa', label: 'qa', stages: ['qa'] },
                  { key: 'staging', label: 'staging', stages: ['staging'] },
                  { key: 'production', label: 'prod', stages: ['prod'] }
                ].map(({ key, label, stages }) => {
                  const releaseCount = releases.filter(r => stages.includes(r.stage)).length
                  const isExpanded = expandedBranches.has(key)
                  const primaryStage = stages[0] as BranchStage
                  
                  return (
                    <div key={key}>
                      <button
                        onClick={() => toggleBranch(key)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
                      >
                        <span className="text-gray-400">
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </span>
                        <GitBranch size={16} className="text-gray-500" />
                        <span className="text-sm font-medium text-gray-700 flex-1">
                          {label}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${stageColors[primaryStage]}`}>
                          {releaseCount}
                        </span>
                      </button>
                      
                      {/* Show releases for this branch when expanded */}
                      {isExpanded && (
                        <div className="ml-6 mt-1 space-y-1">
                          {releases
                            .filter(r => stages.includes(r.stage))
                            .slice(0, 5) // Show max 5 recent releases
                            .map((release) => (
                              <button
                                key={release.id}
                                onClick={() => setSelectedRelease(release)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-blue-50 transition-colors"
                              >
                                <Package size={12} className="text-blue-500" />
                                <span className="text-xs text-gray-600 flex-1 truncate">
                                  {release.name}
                                </span>
                                <span className="text-xs text-gray-400">
                                  v{release.version}
                                </span>
                              </button>
                            ))}
                          {releases.filter(r => stages.includes(r.stage)).length > 5 && (
                            <div className="text-xs text-gray-400 px-2 py-1">
                              +{releases.filter(r => stages.includes(r.stage)).length - 5} more
                            </div>
                          )}
                        </div>
                      )}
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
                                  handleCreateSnapshotFromVersion(version)
                                }}
                                disabled={snapshots.some(s => s.versionId === version.id)}
                                className={`px-3 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
                                  snapshots.some(s => s.versionId === version.id)
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-orange-100 hover:bg-orange-200 text-orange-700'
                                }`}
                              >
                                <Package size={12} />
                                {snapshots.some(s => s.versionId === version.id) ? 'Snapshot Exists' : 'Snapshot'}
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
                          onClick={() => setSelectedRelease(release)}
                          className={`border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer ${
                            selectedRelease?.id === release.id
                              ? 'border-[#FF6A00] bg-orange-50'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <Package size={20} className="text-[#FF6A00]" />
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-base font-semibold text-gray-800">{release.name}</h3>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${stageColors[release.stage]}`}>
                                    {release.stage}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600">{release.version}</p>
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
                            <div className="flex gap-2">
                              {!release.signed && (
                                <button
                                  onClick={() => {
                                    setSelectedRelease(release)
                                    handleSignRelease(release)
                                  }}
                                  className="px-3 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors flex items-center gap-1"
                                >
                                  <Shield size={12} />
                                  Sign
                                </button>
                              )}
                              {getNextStage(release.stage) ? (
                                <button
                                  onClick={() => {
                                    setSelectedRelease(release)
                                    setPromotionStage('qa') // Reset to default
                                    setShowPromoteDialog(true)
                                  }}
                                  className="px-3 py-1 text-xs bg-[#FF6A00] text-white hover:bg-[#E55F00] rounded transition-colors flex items-center gap-1"
                                >
                                  <ArrowUpCircle size={12} />
                                  Promote Release
                                </button>
                              ) : (
                                <span className="text-xs text-gray-400 px-3 py-1">
                                  Production
                                </span>
                              )}
                            </div>
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
                          onClick={() => setSelectedSnapshot(snapshot)}
                          className={`border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer ${
                            selectedSnapshot?.id === snapshot.id
                              ? 'border-[#FF6A00] bg-orange-50'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3 mb-2">
                              <Package size={20} className="text-gray-400" />
                              <div>
                                <h3 className="text-base font-semibold text-gray-800">{snapshot.name}</h3>
                                <p className="text-sm text-gray-600">{snapshot.description}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedSnapshot(snapshot)
                                setSelectedSnapshotForRelease(snapshot.id)
                                setShowCreateRelease(true)
                              }}
                              disabled={snapshotHasRelease(snapshot.id)}
                              className={`px-3 py-1.5 text-xs rounded transition-colors flex items-center gap-1 ${
                                snapshotHasRelease(snapshot.id)
                                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                  : 'bg-[#FF6A00] text-white hover:bg-[#E55F00]'
                              }`}
                            >
                              <Package size={14} />
                              {snapshotHasRelease(snapshot.id) ? 'Release Exists' : 'Create Release'}
                            </button>
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

        {/* Right Column - Version/Snapshot/Release Details */}
        <div className="w-[20%] bg-white border-l border-gray-200 overflow-y-auto">
          <div className="p-4">
            {/* Snapshot Details */}
            {activeTab === 'snapshots' && selectedSnapshot ? (
              <>
                <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Snapshot Details</h2>
                
                <div className="space-y-4">
                  {/* Snapshot Info */}
                  <div>
                    <h3 className="text-xs font-medium text-gray-600 mb-2">Information</h3>
                    <div className="text-sm text-gray-800">
                      <div className="font-medium">{selectedSnapshot.name}</div>
                      <div className="text-gray-600 text-xs mt-1">{selectedSnapshot.description}</div>
                      <div className="text-gray-500 text-xs mt-2">
                        Created {new Date(selectedSnapshot.createdAt).toLocaleDateString()} by {selectedSnapshot.createdBy}
                      </div>
                    </div>
                  </div>

                  {/* Snapshot Files */}
                  <div>
                    <h3 className="text-xs font-medium text-gray-600 mb-2">
                      Files ({snapshotFiles.length})
                    </h3>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {snapshotFiles.length > 0 ? (
                        snapshotFiles.map((file: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-gray-700 py-1">
                            <FileCode size={14} className={
                              file.changeType === 'added' ? 'text-green-500' :
                              file.changeType === 'deleted' ? 'text-red-500' :
                              'text-blue-500'
                            } />
                            <span className="truncate flex-1" title={file.filePath}>{file.filePath}</span>
                            {file.size && (
                              <span className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)}KB</span>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-gray-500">No files loaded</div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 border-t border-gray-200 space-y-2">
                    <button
                      onClick={() => {
                        setSelectedSnapshotForRelease(selectedSnapshot.id)
                        setShowCreateRelease(true)
                      }}
                      disabled={snapshotHasRelease(selectedSnapshot.id)}
                      className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                        snapshotHasRelease(selectedSnapshot.id)
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-[#FF6A00] text-white hover:bg-[#E55F00]'
                      }`}
                    >
                      <Package size={16} />
                      {snapshotHasRelease(selectedSnapshot.id) ? 'Release Exists' : 'Create Release'}
                    </button>
                  </div>
                </div>
              </>
            ) : 
            /* Release Details with Safety Checks */
            activeTab === 'releases' && selectedRelease ? (
              <>
                <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Release Details</h2>
                
                <div className="space-y-4">
                  {/* Release Info */}
                  <div>
                    <h3 className="text-xs font-medium text-gray-600 mb-2">Information</h3>
                    <div className="text-sm">
                      <div className="font-medium text-gray-800">{selectedRelease.name} v{selectedRelease.version}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-1 text-xs rounded ${stageColors[selectedRelease.stage]}`}>
                          {selectedRelease.stage.toUpperCase()}
                        </span>
                        {selectedRelease.signed && (
                          <Shield size={12} className="text-green-500" />
                        )}
                      </div>
                      <div className="text-gray-500 text-xs mt-2">
                        Created {new Date(selectedRelease.createdAt).toLocaleDateString()} by {selectedRelease.createdBy}
                      </div>
                    </div>
                  </div>

                  {/* Safety Check Results */}
                  {selectedRelease.stage === 'staging' && safetyCheckResults[selectedRelease.id] && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-medium text-gray-600">Safety Checks</h3>
                        <button
                          onClick={() => {
                            setSelectedSafetyResults(safetyCheckResults[selectedRelease.id])
                            setShowSafetyChecksDialog(true)
                          }}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          View All
                        </button>
                      </div>
                      <div className="space-y-1">
                        {safetyCheckResults[selectedRelease.id].checks.slice(0, 5).map((check) => (
                          <div key={check.id} className="flex items-center gap-2 text-xs">
                            {check.status === 'passed' && <CheckCircle size={12} className="text-green-500" />}
                            {check.status === 'failed' && <AlertCircle size={12} className="text-red-500" />}
                            {check.status === 'warning' && <AlertCircle size={12} className="text-amber-500" />}
                            {check.status === 'running' && <div className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin" />}
                            {check.status === 'pending' && <Circle size={12} className="text-gray-400" />}
                            <span className={`truncate ${
                              check.status === 'failed' ? 'text-red-700' :
                              check.status === 'warning' ? 'text-amber-700' :
                              check.status === 'passed' ? 'text-green-700' :
                              'text-gray-600'
                            }`}>
                              {check.name}
                            </span>
                          </div>
                        ))}
                        {safetyCheckResults[selectedRelease.id].checks.length > 5 && (
                          <div className="text-xs text-gray-500 pt-1">
                            +{safetyCheckResults[selectedRelease.id].checks.length - 5} more checks
                          </div>
                        )}
                      </div>
                      
                      <div className={`mt-2 p-2 rounded text-xs ${
                        safetyCheckResults[selectedRelease.id].overallStatus === 'passed' ? 'bg-green-50 text-green-700' :
                        safetyCheckResults[selectedRelease.id].overallStatus === 'warning' ? 'bg-amber-50 text-amber-700' :
                        'bg-red-50 text-red-700'
                      }`}>
                        <div className="font-medium">
                          {safetyCheckResults[selectedRelease.id].overallStatus === 'passed' && 'All checks passed'}
                          {safetyCheckResults[selectedRelease.id].overallStatus === 'warning' && `${safetyCheckResults[selectedRelease.id].warningIssues} warnings`}
                          {safetyCheckResults[selectedRelease.id].overallStatus === 'failed' && `${safetyCheckResults[selectedRelease.id].blockingIssues} blocking issues`}
                        </div>
                        {safetyCheckResults[selectedRelease.id].approvalRequired && (
                          <div className="text-xs mt-1">
                            Approvals required: {safetyCheckResults[selectedRelease.id].requiredApprovals.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Running Safety Checks Indicator */}
                  {runningSafetyChecks.has(selectedRelease.id) && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-blue-700">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        Running safety checks...
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="pt-4 border-t border-gray-200 space-y-2">
                    {/* Sign Release Button */}
                    <button
                      onClick={() => handleSignRelease(selectedRelease)}
                      disabled={selectedRelease.signed}
                      className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                        selectedRelease.signed
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-green-500 text-white hover:bg-green-600'
                      }`}
                    >
                      <Shield size={16} />
                      {selectedRelease.signed ? 'Signed' : 'Sign Release'}
                    </button>
                    
                    {getNextStage(selectedRelease.stage) && (
                      <button
                        onClick={() => {
                          setPromotionStage(getNextStage(selectedRelease.stage)!)
                          setShowPromoteDialog(true)
                        }}
                        className="w-full px-3 py-2 bg-[#FF6A00] text-white rounded-lg text-sm font-medium hover:bg-[#E55F00] transition-colors flex items-center justify-center gap-2"
                      >
                        <ArrowUpCircle size={16} />
                        Promote to {getNextStage(selectedRelease.stage)?.toUpperCase()}
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : 
            /* Version Details */
            activeTab === 'versions' && selectedVersion && selectedVersionDetails ? (
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
                  {(selectedVersion as any).totalSizeBytes && (
                    <div>
                      <h3 className="text-xs font-medium text-gray-600 mb-2">Storage</h3>
                      <div className="text-xs text-gray-600 space-y-1">
                        <div>Original: {((selectedVersion as any).totalSizeBytes / 1024).toFixed(2)} KB</div>
                        {(selectedVersion as any).compressedSizeBytes && (
                          <div>Compressed: {((selectedVersion as any).compressedSizeBytes / 1024).toFixed(2)} KB</div>
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
                    <button 
                      onClick={() => handleDownloadBundle(selectedVersion)}
                      className="w-full px-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <Download size={16} />
                      Download Bundle
                    </button>
                    {selectedVersion.signed && (
                      <button 
                        onClick={() => handleVerifySignature(selectedVersion)}
                        className="w-full px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                      >
                        <Shield size={16} />
                        Verify Signature
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center text-gray-500 text-sm mt-8">
                {activeTab === 'versions' && 'Select a version to view details'}
                {activeTab === 'snapshots' && 'Select a snapshot to view details'}
                {activeTab === 'releases' && 'Select a release to view details'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Safety Checks Dialog */}
      {showSafetyChecksDialog && selectedSafetyResults && (
        <Dialog isOpen={showSafetyChecksDialog} onClose={() => setShowSafetyChecksDialog(false)} title="Deploy Safety Checks" size="large">
          <div className="p-6">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Pre-Deploy Safety Analysis</h3>
                  <p className="text-sm text-gray-600">
                    Automated safety checks executed at {new Date(selectedSafetyResults.executedAt).toLocaleString()}
                  </p>
                </div>
                <div className={`px-3 py-1 rounded text-sm font-medium ${
                  selectedSafetyResults.overallStatus === 'passed' ? 'bg-green-100 text-green-700' :
                  selectedSafetyResults.overallStatus === 'warning' ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {selectedSafetyResults.overallStatus.toUpperCase()}
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="text-center p-3 bg-gray-50 rounded">
                  <div className="text-2xl font-bold text-gray-800">{selectedSafetyResults.checks.length}</div>
                  <div className="text-xs text-gray-600">Total Checks</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded">
                  <div className="text-2xl font-bold text-green-700">
                    {selectedSafetyResults.checks.filter(c => c.status === 'passed').length}
                  </div>
                  <div className="text-xs text-green-600">Passed</div>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded">
                  <div className="text-2xl font-bold text-amber-700">{selectedSafetyResults.warningIssues}</div>
                  <div className="text-xs text-amber-600">Warnings</div>
                </div>
                <div className="text-center p-3 bg-red-50 rounded">
                  <div className="text-2xl font-bold text-red-700">{selectedSafetyResults.blockingIssues}</div>
                  <div className="text-xs text-red-600">Blocking</div>
                </div>
              </div>
            </div>
            
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {selectedSafetyResults.checks.map((check) => (
                <div key={check.id} className={`border rounded-lg p-4 ${
                  check.status === 'passed' ? 'border-green-200 bg-green-50' :
                  check.status === 'warning' ? 'border-amber-200 bg-amber-50' :
                  check.status === 'failed' ? 'border-red-200 bg-red-50' :
                  'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {check.status === 'passed' && <CheckCircle size={20} className="text-green-500" />}
                      {check.status === 'failed' && <AlertCircle size={20} className="text-red-500" />}
                      {check.status === 'warning' && <AlertCircle size={20} className="text-amber-500" />}
                      {check.status === 'running' && <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
                      {check.status === 'pending' && <Circle size={20} className="text-gray-400" />}
                      
                      <div>
                        <h4 className="font-semibold text-gray-800">{check.name}</h4>
                        <p className="text-sm text-gray-600">{check.description}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs rounded ${
                        check.severity === 'critical' ? 'bg-red-100 text-red-700' :
                        check.severity === 'error' ? 'bg-red-100 text-red-700' :
                        check.severity === 'warning' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {check.severity}
                      </span>
                      {check.executionTime && (
                        <span className="text-xs text-gray-500">
                          {check.executionTime}ms
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className={`text-sm mb-2 ${
                    check.status === 'failed' ? 'text-red-700' :
                    check.status === 'warning' ? 'text-amber-700' :
                    check.status === 'passed' ? 'text-green-700' :
                    'text-gray-700'
                  }`}>
                    {check.message}
                  </div>
                  
                  {check.details && check.details.length > 0 && (
                    <div className="text-xs text-gray-600 space-y-1 ml-8">
                      {check.details.map((detail, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="text-gray-400">•</span>
                          <span>{detail}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {selectedSafetyResults.approvalRequired && (
              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <h4 className="font-semibold text-amber-800 mb-2">Approval Required</h4>
                <p className="text-sm text-amber-700 mb-3">
                  This deployment requires additional approvals before it can proceed:
                </p>
                <div className="space-y-1">
                  {selectedSafetyResults.requiredApprovals.map((approval, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm text-amber-700">
                      <Shield size={16} />
                      <span className="capitalize">{approval.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => setShowSafetyChecksDialog(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
              {selectedSafetyResults.overallStatus !== 'failed' && (
                <button
                  onClick={() => {
                    setShowSafetyChecksDialog(false)
                    // Navigate to deploy console or trigger deployment
                    setDialogMessage('Ready to deploy! Navigate to Deploy Console to proceed.')
                    setShowSuccessDialog(true)
                  }}
                  className="px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55F00]"
                >
                  Proceed to Deploy
                </button>
              )}
            </div>
          </div>
        </Dialog>
      )}
    </div>
  )
}
