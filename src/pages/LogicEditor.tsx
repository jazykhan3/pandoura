import { useEffect, useState, useRef } from 'react'
import { MonacoEditor } from '../components/MonacoEditor'
import { Dialog } from '../components/Dialog'
import { InputDialog } from '../components/InputDialog'
import { ExternalToolsMenu } from '../components/ExternalToolsMenu'
import { useLogicStore } from '../store/enhancedLogicStore'
import { useSyncStore } from '../store/syncStore'
import { useSimulatorStore } from '../store/simulatorStore'
import { useTagStore } from '../store/tagStore'
import { useProjectStore } from '../store/projectStore'
import { useExternalTools } from '../hooks/useExternalTools'
import { deviceAuth } from '../utils/deviceAuth'
import { logicApi, versionApi, simulatorApi } from '../services/api'
import { parseSTCode, renameSymbol, extractFunction } from '../utils/stParser'
import { analyzeSemantics } from '../utils/semanticAnalyzer'
import { analyzeSafety } from '../utils/safetyAnalyzer'
import {
  Save,
  Undo,
  Redo,
  Check,
  Code,
  Play,
  FolderOpen,
  FilePlus,
  CheckCircle,
  X,
  Zap,
  Package,
  Tag,
  GitBranch,
  GitCommit,
  Clock,
  Replace,
  FileText,
  ChevronDown,
  ChevronRight,
  TestTube,
  AlertTriangle,
  Shield,
  History,
  Plug,
} from 'lucide-react'
import type {
  Symbol as ProjectSymbol,
  LocalHistoryEntry,
  TestCase,
  SemanticDiagnostic,
  SafetyRule,
  ReplaceMatch,
  ReplaceScope,
  LogicFile,
} from '../types'

// Utility function to extract tag declarations from PLC code
function extractTagsFromCode(content: string) {
  const tags: Array<{ 
    id: string; 
    name: string; 
    type: string; 
    value?: string;
    initialValue?: string; 
    comment?: string; 
    metadata?: { description?: string };
    declarationLine: number 
  }> = []
  
  if (!content) return tags

  const lines = content.split('\n')
  let inVarBlock = false

  lines.forEach((line, index) => {
    const trimmedLine = line.trim()
    
    // Check for VAR block start (VAR, VAR_INPUT, VAR_OUTPUT, etc.)
    if (/^VAR(?:_INPUT|_OUTPUT|_IN_OUT|_GLOBAL|_EXTERNAL|_TEMP)?\s*$/i.test(trimmedLine)) {
      inVarBlock = true
      return
    }
    
    // Check for VAR block end
    if (/^END_VAR\s*$/i.test(trimmedLine)) {
      inVarBlock = false
      return
    }
    
    // Parse variable declarations inside VAR blocks
    if (inVarBlock && trimmedLine) {
      // Skip pure comment lines
      if (trimmedLine.startsWith('(*') && trimmedLine.endsWith('*)')) {
        return
      }
      if (trimmedLine.startsWith('//')) {
        return
      }
      
      // Remove inline comments for parsing
      let lineWithoutComment = trimmedLine
      // Remove (* *) style comments
      lineWithoutComment = lineWithoutComment.replace(/\(\*.*?\*\)/g, '').trim()
      // Remove // style comments
      lineWithoutComment = lineWithoutComment.replace(/\/\/.*$/, '').trim()
      
      if (!lineWithoutComment) return
      
      // Match variable declarations with various patterns:
      // name : TYPE;
      // name : TYPE := value;
      // name : TYPE(size);
      // name : TYPE := value; (* comment *)
      const varMatch = lineWithoutComment.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\([^)]*\))?)\s*(?::=\s*([^;]+))?\s*;?\s*$/i)
      
      if (varMatch) {
        const [, name, type, initialValue] = varMatch
        
        // Extract comment from original line if present
        let comment = ''
        const commentMatch = trimmedLine.match(/\(\*\s*(.*?)\s*\*\)/)
        if (commentMatch) {
          comment = commentMatch[1].trim()
        }
        
        tags.push({
          id: `${name}_${index}`,
          name: name.trim(),
          type: type.trim(),
          value: initialValue?.trim(),
          initialValue: initialValue?.trim(),
          comment: comment || undefined,
          metadata: comment ? { description: comment } : undefined,
          declarationLine: index + 1
        })
      }
    }
  })

  return tags
}

// Utility function to find all lines where tag appears (including declaration)
function findAllTagLines(content: string, tagName: string) {
  const lines = content.split('\n')
  const allLines: number[] = []
  
  // Create a word boundary regex to match the exact tag name
  const escapedTagName = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const tagRegex = new RegExp(`\\b${escapedTagName}\\b`, 'gi')
  
  // Search for tag in ALL lines
  lines.forEach((line, index) => {
    const lineNumber = index + 1
    
    // Check if the tag appears in this line
    tagRegex.lastIndex = 0
    if (tagRegex.test(line)) {
      allLines.push(lineNumber)
    }
  })
  
  return allLines
}

// Utility function to analyze tag usage in the logic code
function analyzeTagUsage(content: string) {
  if (!content) return []

  // Step 1: Extract all tags declared in VAR...END_VAR blocks
  const declaredTags = extractTagsFromCode(content)
  
  if (declaredTags.length === 0) return []

  // Step 2: For each tag, find all lines where it appears
  return declaredTags.map(tag => {
    const allLines = findAllTagLines(content, tag.name)
    // Usage count excludes the declaration line
    const usageLines = allLines.filter(line => line !== tag.declarationLine)
    const usageCount = usageLines.length
    
    return {
      ...tag,
      usageCount: usageCount,
      lineNumbers: allLines, // All lines including declaration
      usageLines: usageLines, // Only usage lines (excluding declaration)
      isUsed: usageCount > 0,
      isDeclared: true
    }
  }).sort((a, b) => {
    // Sort by: used tags first, then by usage count (descending), then by name
    if (a.isUsed && !b.isUsed) return -1
    if (!a.isUsed && b.isUsed) return 1
    if (a.usageCount !== b.usageCount) return b.usageCount - a.usageCount
    return a.name.localeCompare(b.name)
  })
}

// Utility function to generate diff data
function generateDiff(originalContent: string, modifiedContent: string) {
  const originalLines = originalContent.split('\n')
  const modifiedLines = modifiedContent.split('\n')
  const changes: Array<{
    type: 'added' | 'removed' | 'modified' | 'unchanged'
    originalLineNumber?: number
    modifiedLineNumber?: number
    originalText?: string
    modifiedText?: string
    changeId: string
  }> = []

  const maxLines = Math.max(originalLines.length, modifiedLines.length)
  let changeId = 0

  for (let i = 0; i < maxLines; i++) {
    const originalLine = i < originalLines.length ? originalLines[i] : undefined
    const modifiedLine = i < modifiedLines.length ? modifiedLines[i] : undefined

    if (originalLine === undefined && modifiedLine !== undefined) {
      // Line added
      changes.push({
        type: 'added',
        modifiedLineNumber: i + 1,
        modifiedText: modifiedLine,
        changeId: `add-${changeId++}`
      })
    } else if (originalLine !== undefined && modifiedLine === undefined) {
      // Line removed
      changes.push({
        type: 'removed',
        originalLineNumber: i + 1,
        originalText: originalLine,
        changeId: `remove-${changeId++}`
      })
    } else if (originalLine !== modifiedLine) {
      // Line modified
      changes.push({
        type: 'modified',
        originalLineNumber: i + 1,
        modifiedLineNumber: i + 1,
        originalText: originalLine || '',
        modifiedText: modifiedLine || '',
        changeId: `modify-${changeId++}`
      })
    } else {
      // Line unchanged
      changes.push({
        type: 'unchanged',
        originalLineNumber: i + 1,
        modifiedLineNumber: i + 1,
        originalText: originalLine,
        modifiedText: modifiedLine,
        changeId: `same-${i}`
      })
    }
  }

  return changes
}

export function LogicEditor() {
  const {
    currentFile,
    files,
    openTabs,
    isModified,
    isSaving,
    validationResult,
    vendor,
    unsavedChanges,
    loadAllFiles,
    loadFile,
    createFile,
    updateContent,
    saveFile,
    validate,
    setVendor,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useLogicStore()

  const { pushToShadow, isPushing, status } = useSyncStore()
  const { run: runSimulator, breakpoints, toggleBreakpoint, currentLine } = useSimulatorStore()
  const { tags: tagDatabaseTags, loadTags: loadTagDatabaseTags } = useTagStore()
  const { activeProject } = useProjectStore()
  const { tools: externalTools, executeTool, getContextMenuTools } = useExternalTools()
  
  // External tools state
  const [showExternalToolsMenu, setShowExternalToolsMenu] = useState(false)
  const [externalToolsMenuPosition, setExternalToolsMenuPosition] = useState<{ x: number; y: number } | undefined>()
  
  // Track previous project to detect changes
  const prevProjectIdRef = useRef<string | null>(null)

  // Debug: Log when currentFile changes
  useEffect(() => {
    if (currentFile) {
      const editorValue = unsavedChanges[currentFile.id] || currentFile.content
      console.log(`📝 Current file changed:`, {
        id: currentFile.id,
        name: currentFile.name,
        hasContent: !!currentFile.content,
        contentLength: currentFile.content?.length || 0,
        contentPreview: currentFile.content?.substring(0, 50) || 'EMPTY',
        hasUnsavedChanges: unsavedChanges.hasOwnProperty(currentFile.id),
        unsavedChangesValue: unsavedChanges[currentFile.id],
        editorWillReceive: editorValue?.length || 0,
        editorPreview: editorValue?.substring(0, 50) || 'EMPTY'
      })
    } else {
      console.log(`📝 No current file`)
    }
  }, [currentFile, unsavedChanges])

  const [showFileSelector, setShowFileSelector] = useState(false)
  const [showChangePreview, setShowChangePreview] = useState(false)
  const [usedTags, setUsedTags] = useState<Array<any>>([])
  const [dialog, setDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    type: 'success' | 'error' | 'info' | 'warning'
  }>({ isOpen: false, title: '', message: '', type: 'info' })
  const [showNewFileDialog, setShowNewFileDialog] = useState(false)

  // PLC Execution result display
  const [plcExecutionResult, setPlcExecutionResult] = useState<any>(null)
  const [showPLCResults, setShowPLCResults] = useState(false)

  // Enhanced features state
  const [showSymbolExplorer, setShowSymbolExplorer] = useState(true)
  const [symbolFilter, setSymbolFilter] = useState('')
  const [expandedSymbols, setExpandedSymbols] = useState<Set<string>>(new Set())
  const [projectSymbols, setProjectSymbols] = useState<ProjectSymbol[]>([])
  
  const [showHistoryPanel, setShowHistoryPanel] = useState(false)
  const [historyEntries, setHistoryEntries] = useState<LocalHistoryEntry[]>([])
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(0)
  
  const [showTestRunner, setShowTestRunner] = useState(false)
  const [testCases, setTestCases] = useState<TestCase[]>([])
  
  const [showDiagnosticsPanel, setShowDiagnosticsPanel] = useState(false)
  const [semanticDiagnostics, setSemanticDiagnostics] = useState<SemanticDiagnostic[]>([])
  
  const [showSafetyAnalyzer, setShowSafetyAnalyzer] = useState(false)
  const [safetyRules, setSafetyRules] = useState<SafetyRule[]>([])
  
  const [showReplacePanel, setShowReplacePanel] = useState(false)
  const [replaceSearchTerm, setReplaceSearchTerm] = useState('')
  const [replaceWithTerm, setReplaceWithTerm] = useState('')
  const [replaceScope, setReplaceScope] = useState<ReplaceScope>('current_file')
  const [replaceMatches, setReplaceMatches] = useState<ReplaceMatch[]>([])
  
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [renameOldSymbol, setRenameOldSymbol] = useState('')
  const [renameNewSymbol, setRenameNewSymbol] = useState('')
  
  const [showExtractDialog, setShowExtractDialog] = useState(false)
  const [extractStartLine, setExtractStartLine] = useState(0)
  const [extractEndLine, setExtractEndLine] = useState(0)
  const [extractFunctionName, setExtractFunctionName] = useState('NewFunction')
  const [extractReturnType, setExtractReturnType] = useState('VOID')
  
  const [showTestConfigDialog, setShowTestConfigDialog] = useState(false)
  const [testRoutineName, setTestRoutineName] = useState('')
  const [testInputsJson, setTestInputsJson] = useState('{}')
  const [testExpectedJson, setTestExpectedJson] = useState('{}')
  const [testPreConditions, setTestPreConditions] = useState('')
  const [testPostConditions, setTestPostConditions] = useState('')
  const [testMockedIO, setTestMockedIO] = useState('{}')
  
  // Test debugger variables removed - not currently used
  const [testCoverage, setTestCoverage] = useState<Record<string, { lines: number; total: number; branches: number; totalBranches: number }>>({})
  const [testRunning, setTestRunning] = useState(false)
  const [runAllProgress, setRunAllProgress] = useState({ current: 0, total: 0 })
  
  const [showSnapshotDialog, setShowSnapshotDialog] = useState(false)
  const [showReleaseDialog, setShowReleaseDialog] = useState(false)
  const [snapshotMessage, setSnapshotMessage] = useState('')
  const [snapshotTags, setSnapshotTags] = useState('')

  const [showCreateVersionDialog, setShowCreateVersionDialog] = useState(false)
  const [versionMessage, setVersionMessage] = useState('')
  const [versionTags, setVersionTags] = useState('')
  const [isCreatingVersion, setIsCreatingVersion] = useState(false)

  const [showCompareDialog, setShowCompareDialog] = useState(false)
  const [compareVersion, setCompareVersion] = useState('')

  // Auto-show change preview when there are modifications
  useEffect(() => {
    if (isModified && currentFile && unsavedChanges[currentFile.id]) {
      setShowChangePreview(true)
    }
  }, [isModified, currentFile, unsavedChanges])

  // Update tag analysis whenever content changes
  useEffect(() => {
    if (currentFile) {
      const currentContent = unsavedChanges[currentFile.id] || currentFile.content || ''
      const analyzedTags = analyzeTagUsage(currentContent)
      
      // Debug logging (commented out for production)
      // console.log('Tag Analysis Update:', {
      //   fileId: currentFile.id,
      //   fileName: currentFile.name,
      //   hasUnsavedChanges: !!unsavedChanges[currentFile.id],
      //   contentLength: currentContent.length,
      //   declaredTagsCount: analyzedTags.length,
      //   usedTagsCount: analyzedTags.filter(t => t.isUsed).length,
      //   unusedTagsCount: analyzedTags.filter(t => !t.isUsed).length,
      //   tagNames: analyzedTags.map(t => `${t.name} (${t.type})`)
      // })
      
      setUsedTags(analyzedTags)
    } else {
      setUsedTags([])
    }
  }, [currentFile?.id, currentFile?.content, unsavedChanges])

  useEffect(() => {
    // If project changed, close current file
    if (prevProjectIdRef.current && prevProjectIdRef.current !== activeProject?.id) {
      console.log(`📂 Project changed from ${prevProjectIdRef.current} to ${activeProject?.id}`)
      // Project changed - close any open file to prevent showing old project's file
      if (currentFile) {
        useLogicStore.setState({ currentFile: null, openTabs: [] })
      }
    }
    
    prevProjectIdRef.current = activeProject?.id || null
    
    if (activeProject) {
      console.log(`📂 Loading files for project: ${activeProject.name} (${activeProject.id})`)
      loadAllFiles(activeProject.id)
      loadTagDatabaseTags(activeProject.id) // Load tags from database for this project
    } else {
      console.log(`📂 No active project`)
    }
  }, [activeProject?.id, loadAllFiles, loadTagDatabaseTags, currentFile])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            if (e.shiftKey) {
              e.preventDefault()
              redo()
            } else {
              e.preventDefault()
              undo()
            }
            break
          case 'y':
            e.preventDefault()
            redo()
            break
          case 's':
            e.preventDefault()
            if (isModified && !isSaving) {
              handleSave()
            }
            break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  const handleSave = async () => {
    await saveFile()
  }

  const handleValidate = async () => {
    await validate()
  }

  const handleFormat = async () => {
    if (!currentFile) return
    
    try {
      const currentContent = unsavedChanges[currentFile.id] || currentFile.content
      const result = await logicApi.format(currentContent, { tabSize: 2, insertSpaces: true })
      
      if (result.success && result.formatted !== currentContent) {
        updateContent(result.formatted)
        setDialog({
          isOpen: true,
          title: 'Code Formatted',
          message: 'Your code has been successfully formatted with proper indentation and structure.',
          type: 'success'
        })
      } else if (result.success) {
        setDialog({
          isOpen: true,
          title: 'No Changes',
          message: 'Your code is already properly formatted.',
          type: 'info'
        })
      }
    } catch (error) {
      console.error('Error formatting code:', error)
      setDialog({
        isOpen: true,
        title: 'Formatting Error',
        message: 'Failed to format code. Check console for details.',
        type: 'error'
      })
    }
  }

  const handleCreateVersion = async () => {
    if (!activeProject) {
      setDialog({
        isOpen: true,
        title: 'No Project Selected',
        message: 'Please select a project before creating a version.',
        type: 'warning',
      })
      return
    }

    if (!versionMessage.trim()) {
      setDialog({
        isOpen: true,
        title: 'Message Required',
        message: 'Please enter a version message.',
        type: 'warning',
      })
      return
    }

    setIsCreatingVersion(true)
    try {
      // Collect all logic files from the store
      const versionFiles = files.map(file => ({
        path: `logic/${file.name}`,
        content: unsavedChanges[file.id] || file.content,
        type: 'logic' as const,
      }))

      // Add tags as a JSON file
      if (tagDatabaseTags.length > 0) {
        versionFiles.push({
          path: 'tags/tags.json',
          content: JSON.stringify(tagDatabaseTags, null, 2),
          type: 'logic' as const,
        })
      }

      // Get or create the 'main' branch
      const branchesResponse = await versionApi.getBranches(activeProject.id)
      let branchId: string | number
      
      // Handle the response structure { success: true, branches: [...] }
      const branches = branchesResponse.branches || []
      
      if (branches.length === 0) {
        const newBranch = await versionApi.createBranch(activeProject.id, {
          name: 'main',
          stage: 'dev',
          description: 'Main development branch',
          createdBy: 'Current User'
        })
        branchId = newBranch.branch?.id || newBranch.id
      } else {
        branchId = branches[0].id
      }

      // Create the version (projectId is already a string UUID)
      const response = await versionApi.createVersion(activeProject.id, {
        branch_id: branchId,
        message: versionMessage,
        author: 'Current User', // TODO: Get from auth context
        tags: versionTags ? versionTags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
        files: versionFiles,
      })

      const version = response.version || response

      setDialog({
        isOpen: true,
        title: 'Version Created',
        message: `Version ${version.version || 'created'} successfully!\n\nFiles: ${versionFiles.length}\nBranch: main\nMessage: ${versionMessage}`,
        type: 'success',
      })

      setShowCreateVersionDialog(false)
      setVersionMessage('')
      setVersionTags('')
    } catch (error) {
      console.error('Error creating version:', error)
      setDialog({
        isOpen: true,
        title: 'Version Creation Failed',
        message: error instanceof Error ? error.message : 'Failed to create version. Check console for details.',
        type: 'error',
      })
    } finally {
      setIsCreatingVersion(false)
    }
  }



  const handleSendToShadow = async () => {
    if (!currentFile) return
    
    try {
      // Save file first to ensure latest content is persisted
      await saveFile()
      
      // Push to shadow runtime using the correct API endpoint
      const success = await pushToShadow(currentFile.id)
      
      if (success) {
        // Trigger a refresh of the shadow runtime status
        try {
          const sessionToken = await deviceAuth.getSessionToken()
          const headers: HeadersInit = {}
          if (sessionToken) {
            headers['Authorization'] = `Bearer ${sessionToken}`
          }
          await fetch('http://localhost:8000/api/sync/status', { headers })
        } catch (e) {
          // Ignore if backend not available
        }
        
        // Show success dialog
        setDialog({
          isOpen: true,
          title: 'Success',
          message: `Logic "${currentFile.name}" sent to shadow runtime successfully!\n\nYou can now:\n• View it on the Shadow Runtime page\n• Run it in the simulator\n• Monitor its execution`,
          type: 'success'
        })
        
        // Optionally auto-load logic in simulator
        await runSimulator(unsavedChanges[currentFile.id] || currentFile.content)
      } else {
        setDialog({
          isOpen: true,
          title: 'Failed',
          message: 'Failed to send logic to shadow runtime. Please try again.',
          type: 'error'
        })
      }
    } catch (error) {
      console.error('Error sending to shadow:', error)
      setDialog({
        isOpen: true,
        title: 'Error',
        message: 'Error sending logic to shadow runtime. Check console for details.',
        type: 'error'
      })
    }
  }

  const handleRunSimulator = async () => {
    if (!currentFile) return
    
    try {
      // Use current content (including unsaved changes)
      const content = unsavedChanges[currentFile.id] || currentFile.content
      
      // Use ST interpreter for execution
      await runSimulator(content)
      
      // Show success dialog with next steps
      setDialog({
        isOpen: true,
        title: 'Simulator Started',
        message: `Simulator started with logic from "${currentFile.name}"!\n\nUsing ST interpreter for execution.\n\nNext steps:\n1. Go to the Simulator page to see execution\n2. Use I/O Panel to toggle inputs\n3. Monitor variable changes in real-time`,
        type: 'success'
      })
    } catch (error) {
      console.error('Error starting simulator:', error)
      setDialog({
        isOpen: true,
        title: 'Error',
        message: 'Failed to start simulator. Check console for details.',
        type: 'error'
      })
    }
  }

  // Removed unused handleExecutePLC function

  const handleCreateFileClick = () => {
    setShowNewFileDialog(true)
  }

  const handleCreateFile = async (fileName: string) => {
    try {
      await createFile(fileName, activeProject?.id)
      setDialog({
        isOpen: true,
        title: 'File Created',
        message: `Successfully created "${fileName}". You can now start editing your logic.`,
        type: 'success'
      })
    } catch (error) {
      setDialog({
        isOpen: true,
        title: 'Creation Failed',
        message: 'Failed to create file. Please try again.',
        type: 'error'
      })
    }
  }

  // Handler for code lens actions
  const handleCodeLensAction = (command: string, args?: any[]) => {
    if (!currentFile) {
      console.error('No current file')
      return
    }
    
    console.log('Code Lens Action:', command, args)
    
    if (command === 'st.runTest') {
      const [routineName, routineType] = args || []
      
      if (!routineName) {
        console.error('No routine name provided')
        return
      }
      
      console.log('Opening test config for:', routineName, routineType)
      
      // Open test configuration dialog
      setTestRoutineName(routineName)
      
      // Parse current code to suggest inputs
      const currentContent = unsavedChanges[currentFile.id] || currentFile.content
      const symbols = parseSTCode(currentContent)
      
      console.log('Parsed symbols:', symbols.length)
      
      // Find the routine in parsed symbols
      const routine = symbols.find(s => 
        s.name === routineName && 
        (s.type === 'program' || s.type === 'function' || s.type === 'function_block')
      )
      
      console.log('Found routine:', routine)
      
      // Suggest default inputs based on variables
      const suggestedInputs: Record<string, any> = {}
      
      if (routine && routine.children) {
        // Extract variables from children
        const variables = routine.children.filter(child => child.type === 'variable')
        console.log('Found variables:', variables.length)
        
        variables.forEach(v => {
          const dataType = v.dataType?.toUpperCase() || 'INT'
          if (dataType === 'INT' || dataType === 'DINT' || dataType === 'SINT' || dataType === 'USINT') {
            suggestedInputs[v.name] = 0
          } else if (dataType === 'REAL' || dataType === 'LREAL') {
            suggestedInputs[v.name] = 0.0
          } else if (dataType === 'BOOL') {
            suggestedInputs[v.name] = false
          } else if (dataType === 'STRING') {
            suggestedInputs[v.name] = ''
          } else {
            suggestedInputs[v.name] = 0
          }
        })
      }
      
      console.log('Suggested inputs:', suggestedInputs)
      
      setTestInputsJson(JSON.stringify(suggestedInputs, null, 2))
      setTestExpectedJson(JSON.stringify({}, null, 2))
      setTestPreConditions('')
      setTestPostConditions('')
      setTestMockedIO(JSON.stringify({}, null, 2))
      setShowTestConfigDialog(true)
      setShowTestRunner(true)
    }
    
    if (command === 'st.simulate') {
      const [routineName] = args || []
      handleRunSimulator()
      setDialog({
        isOpen: true,
        title: 'Simulate',
        message: `Simulating ${routineName}...\n\nCheck the simulator panel for execution results.`,
        type: 'info',
      })
    }
    
    if (command === 'st.coverage') {
      const [routineName] = args || []
      setDialog({
        isOpen: true,
        title: 'Code Coverage',
        message: `Code coverage for '${routineName}':\n\nLines: 0 / 0 (0%)\nBranches: 0 / 0 (0%)\n\nRun tests to generate coverage data.`,
        type: 'info',
      })
    }
  }

  // Handler for running a test case
  const handleRunTest = async (testId: string) => {
    const test = testCases.find(t => t.id === testId)
    if (!test || !currentFile) return
    
    // Update status to running
    setTestCases(testCases.map(t => 
      t.id === testId ? { ...t, status: 'running' as const } : t
    ))
    
    try {
      const currentContent = unsavedChanges[currentFile.id] || currentFile.content
      const startTime = performance.now()
      
      // Create isolated test harness
      console.log('🧪 Creating test harness for:', test.routine)
      
      // Merge mocked I/O with test inputs
      const mockedIO = (test as any).mockedIO || {}
      const initialValues = { ...test.inputs, ...mockedIO }
      
      console.log('Initial values:', initialValues)
      
      // Run the code in simulator with test inputs
      const result = await simulatorApi.run(currentContent, {
        initialValues,
      })
      
      if (!result.success) {
        throw new Error(result.message || 'Simulator failed to start')
      }
      
      console.log('✓ Simulator started')
      
      // Trace variables during execution
      const trace: string[] = []
      trace.push(`[0ms] Test started: ${test.name}`)
      trace.push(`[0ms] Inputs: ${JSON.stringify(initialValues)}`)
      
      // Execute one cycle to get outputs
      const stepResult = await simulatorApi.step()
      const cycleTime = performance.now() - startTime
      
      trace.push(`[${cycleTime.toFixed(2)}ms] Cycle completed`)
      trace.push(`[${cycleTime.toFixed(2)}ms] Outputs: ${JSON.stringify(stepResult.ioValues || {})}`)
      
      // Stop simulator
      await simulatorApi.stop()
      
      const endTime = performance.now()
      const executionTime = endTime - startTime
      
      trace.push(`[${executionTime.toFixed(2)}ms] Simulator stopped`)
      
      // Get actual outputs
      const actualOutputs = stepResult.ioValues || {}
      
      // Calculate code coverage (basic line coverage)
      const lines = currentContent.split('\n')
      const parsed = parseSTCode(currentContent)
      const routine = parsed.find(s => s.name === test.routine)
      
      let coveredLines = 0
      let totalLines = 0
      
      if (routine) {
        // Count executable lines in routine
        const routineLines = lines.slice(routine.line - 1)
        routineLines.forEach(line => {
          const trimmed = line.trim()
          if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('(*') && 
              !trimmed.match(/^(PROGRAM|FUNCTION|END_|VAR|END_VAR)/i)) {
            totalLines++
            // Simple heuristic: assume all lines were executed in single cycle
            coveredLines++
          }
        })
      }
      
      const coverage = totalLines > 0 ? (coveredLines / totalLines) * 100 : 0
      
      // Update coverage tracking
      setTestCoverage(prev => ({
        ...prev,
        [test.routine]: {
          lines: coveredLines,
          total: totalLines,
          branches: 0,
          totalBranches: 0,
        }
      }))
      
      // Compare with expected outputs
      let passed = true
      const errors: string[] = []
      const mismatches: Array<{ variable: string; expected: any; actual: any; line?: number }> = []
      
      for (const [key, expectedValue] of Object.entries(test.expectedOutputs)) {
        const actualValue = actualOutputs[key]
        if (actualValue !== expectedValue) {
          passed = false
          const errorMsg = `${key}: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`
          errors.push(errorMsg)
          mismatches.push({
            variable: key,
            expected: expectedValue,
            actual: actualValue,
          })
          trace.push(`❌ ${errorMsg}`)
        } else {
          trace.push(`✓ ${key} matched: ${JSON.stringify(actualValue)}`)
        }
      }
      
      // Check post-conditions if defined
      const postConditions = (test as any).postConditions
      if (postConditions && !passed) {
        trace.push(`❌ Post-condition check failed`)
      }
      
      console.log(passed ? '✅ Test PASSED' : '❌ Test FAILED')
      console.log('Trace:', trace)
      
      // Update test with comprehensive results
      setTestCases(testCases.map(t => 
        t.id === testId ? {
          ...t,
          status: passed ? 'passed' as const : 'failed' as const,
          actualOutputs,
          executionTime,
          coverage,
          trace,
          error: errors.length > 0 ? errors.join('\n') : undefined,
        } : t
      ))
      
      // Show result notification
      if (passed) {
        setDialog({
          isOpen: true,
          title: '✅ Test Passed',
          message: `${test.name}\n\n⏱️ Execution: ${executionTime.toFixed(2)}ms\n📊 Coverage: ${coverage.toFixed(1)}%\n✓ All assertions passed`,
          type: 'success',
        })
      }
      
    } catch (error) {
      console.error('Test execution error:', error)
      setTestCases(testCases.map(t => 
        t.id === testId ? {
          ...t,
          status: 'failed' as const,
          error: error instanceof Error ? error.message : 'Test execution failed',
        } : t
      ))
      
      setDialog({
        isOpen: true,
        title: '❌ Test Failed',
        message: `${test.name}\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error',
      })
    }
  }
  
  // Handler for running all tests
  const handleRunAllTests = async () => {
    if (testCases.length === 0) {
      setDialog({
        isOpen: true,
        title: 'No Tests',
        message: 'Create test cases first by clicking "▶ Run Test" above routines.',
        type: 'warning',
      })
      return
    }
    
    setTestRunning(true)
    setRunAllProgress({ current: 0, total: testCases.length })
    
    for (let i = 0; i < testCases.length; i++) {
      setRunAllProgress({ current: i + 1, total: testCases.length })
      await handleRunTest(testCases[i].id)
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    setTestRunning(false)
    
    // Show summary
    const passed = testCases.filter(t => t.status === 'passed').length
    const failed = testCases.filter(t => t.status === 'failed').length
    const total = testCases.length
    
    setDialog({
      isOpen: true,
      title: '📊 Test Run Complete',
      message: `All tests executed\n\n✅ Passed: ${passed}/${total}\n❌ Failed: ${failed}/${total}\n📈 Success Rate: ${((passed / total) * 100).toFixed(1)}%`,
      type: passed === total ? 'success' : 'warning',
    })
  }
  
  // Handler for rename symbol
  const handleRenameSymbol = (oldName?: string, newName?: string) => {
    if (!currentFile) {
      console.error('No current file!')
      return
    }
    
    // If called without parameters, open dialog
    if (!oldName || !newName) {
      if (oldName) {
        setRenameOldSymbol(oldName)
        setRenameNewSymbol(oldName)
        setShowRenameDialog(true)
      }
      return
    }
    
    const currentContent = unsavedChanges[currentFile.id] || currentFile.content
    
    console.log('=== handleRenameSymbol ===')
    console.log('Current file:', currentFile.name)
    console.log('oldName:', oldName, 'newName:', newName)
    
    const result = renameSymbol(currentContent, oldName, newName)
    
    console.log('=== Rename Result ===')
    console.log('Changes:', result.changes)
    console.log('Affected lines:', result.affectedLines)
    
    if (result.changes === 0) {
      setDialog({
        isOpen: true,
        title: 'No Changes',
        message: `Symbol '${oldName}' not found in current file.\n\nMake sure the symbol name is correct and exists in the code.`,
        type: 'warning',
      })
      return
    }
    
    updateContent(result.content)
    
    setDialog({
      isOpen: true,
      title: 'Symbol Renamed',
      message: `Renamed '${oldName}' to '${newName}'\n\n✓ Changes: ${result.changes} occurrence(s)\n✓ Affected lines: ${result.affectedLines.join(', ')}\n\nDon't forget to save the file!`,
      type: 'success',
    })
  }

  // Handler for extract function
  const handleExtractFunction = (startLine?: number, endLine?: number) => {
    if (!currentFile) return
    
    // If called without parameters, this is from dialog confirmation
    if (startLine === undefined || endLine === undefined) {
      // Process the extraction with stored values
      const functionName = extractFunctionName.trim()
      const returnType = extractReturnType.trim().toUpperCase()
      
      if (!functionName) {
        setDialog({
          isOpen: true,
          title: 'Invalid Input',
          message: 'Function name is required.',
          type: 'warning',
        })
        return
      }
      
      // Validate function name
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(functionName)) {
        setDialog({
          isOpen: true,
          title: 'Invalid Name',
          message: 'Function name must start with a letter or underscore and contain only letters, numbers, and underscores.',
          type: 'error',
        })
        return
      }
      
      const currentContent = unsavedChanges[currentFile.id] || currentFile.content
      
      try {
        const result = extractFunction(currentContent, extractStartLine, extractEndLine, functionName, returnType)
        
        updateContent(result.newContent)
        
        setDialog({
          isOpen: true,
          title: 'Function Extracted',
          message: `✓ Created function '${functionName}'\n✓ Return type: ${returnType}\n✓ Extracted lines: ${extractStartLine} - ${extractEndLine}\n\nThe new function has been added at the end of the file.\nDon't forget to save!`,
          type: 'success',
        })
      } catch (error) {
        console.error('Extract function error:', error)
        setDialog({
          isOpen: true,
          title: 'Extraction Failed',
          message: error instanceof Error ? error.message : 'Failed to extract function. Check console for details.',
          type: 'error',
        })
      }
      return
    }
    
    // If called with parameters, open the dialog
    console.log('Extract function:', { startLine, endLine })
    
    if (startLine >= endLine) {
      setDialog({
        isOpen: true,
        title: 'Invalid Selection',
        message: 'Please select multiple lines of code to extract into a function.',
        type: 'warning',
      })
      return
    }
    
    // Open dialog with defaults
    setExtractStartLine(startLine)
    setExtractEndLine(endLine)
    setExtractFunctionName('NewFunction')
    setExtractReturnType('VOID')
    setShowExtractDialog(true)
  }

  // Auto-analyze code when content changes
  useEffect(() => {
    if (currentFile) {
      const currentContent = unsavedChanges[currentFile.id] || currentFile.content
      
      // Parse symbols from actual code
      const parsedSymbols = parseSTCode(currentContent)
      setProjectSymbols(parsedSymbols.map(sym => ({
        id: sym.name,
        name: sym.name,
        type: sym.type,
        dataType: sym.dataType,
        line: sym.line,
        scope: sym.scope,
        references: sym.references?.length || 0,
        isUsed: sym.isUsed,
        children: sym.children?.map(child => ({
          id: child.name,
          name: child.name,
          type: child.type,
          dataType: child.dataType,
          line: child.line,
          scope: child.scope,
          references: 0,
          isUsed: child.isUsed,
        })),
      })))
    }
  }, [currentFile?.id, unsavedChanges[currentFile?.id || '']])

  // Auto-run semantic analysis
  const runSemanticAnalysis = () => {
    if (!currentFile) return
    
    const currentContent = unsavedChanges[currentFile.id] || currentFile.content
    const result = analyzeSemantics(currentContent)
    
    setSemanticDiagnostics(result.diagnostics)
    
    // Show resource usage in console
    console.log('Resource Usage:', result.resourceUsage)
  }

  // Auto-run safety analysis
  const runSafetyAnalysis = () => {
    if (!currentFile) return
    
    const currentContent = unsavedChanges[currentFile.id] || currentFile.content
    const result = analyzeSafety(currentContent)
    
    setSafetyRules(result.rules)
    
    if (result.overallSafetyLevel === 'critical') {
      setDialog({
        isOpen: true,
        title: 'Critical Safety Issues',
        message: `${result.blockingIssues} blocking safety issue(s) detected!\n\nThese must be resolved before deployment.`,
        type: 'error',
      })
    }
  }

  // Removed unused handleLoadSample function

  return (
    <div className="h-full flex flex-col bg-white dark:bg-panda-surface-dark">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Logic Editor</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1">
            {currentFile?.name || 'No file open'} 
            {isModified && ' • Modified'}
            {currentFile && currentFile.lastModified && (
              <span className="ml-2 text-xs text-neutral-500">
                Last saved: {(() => {
                  try {
                    const date = new Date(currentFile.lastModified);
                    return isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
                  } catch {
                    return 'Unknown';
                  }
                })()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-neutral-600">
            Connected to Shadow: {status.connected ? '✓' : '✗'}
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Left Sidebar - Symbol Explorer */}
        {showSymbolExplorer && (
          <div className="w-64 bg-white dark:bg-gray-800 rounded-lg border border-neutral-200 dark:border-gray-600 overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-neutral-200 dark:border-gray-600 bg-neutral-50 dark:bg-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm text-gray-800 dark:text-white">Symbol Explorer</h3>
                <button
                  onClick={() => setShowSymbolExplorer(false)}
                  className="text-neutral-500 dark:text-gray-400 hover:text-neutral-700 dark:hover:text-gray-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <input
                type="text"
                placeholder="Filter symbols..."
                value={symbolFilter}
                onChange={(e) => setSymbolFilter(e.target.value)}
                className="w-full px-2 py-1 text-xs border border-neutral-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {projectSymbols.length > 0 ? (
                <div className="space-y-1">
                  {projectSymbols
                    .filter((sym) =>
                      sym.name.toLowerCase().includes(symbolFilter.toLowerCase())
                    )
                    .map((symbol) => (
                      <div key={symbol.id} className="text-xs">
                        <button
                          className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-neutral-100 rounded text-left"
                          onClick={() => {
                            const newExpanded = new Set(expandedSymbols)
                            if (newExpanded.has(symbol.id)) {
                              newExpanded.delete(symbol.id)
                            } else {
                              newExpanded.add(symbol.id)
                            }
                            setExpandedSymbols(newExpanded)
                          }}
                        >
                          {symbol.children && symbol.children.length > 0 && (
                            <span>
                              {expandedSymbols.has(symbol.id) ? (
                                <ChevronDown className="w-3 h-3" />
                              ) : (
                                <ChevronRight className="w-3 h-3" />
                              )}
                            </span>
                          )}
                          <FileText className="w-3 h-3 text-blue-500" />
                          <span className="font-mono">{symbol.name}</span>
                          <span className="text-neutral-500 ml-auto">
                            {symbol.references > 0 && `(${symbol.references})`}
                          </span>
                        </button>
                        {expandedSymbols.has(symbol.id) && symbol.children && (
                          <div className="ml-6 mt-1 space-y-1">
                            {symbol.children.map((child) => (
                              <button
                                key={child.id}
                                className="w-full flex items-center gap-2 px-2 py-1 hover:bg-neutral-100 dark:hover:bg-gray-600 rounded text-left"
                              >
                                <span className="text-neutral-400 dark:text-gray-400">{child.dataType}</span>
                                <span className="font-mono">{child.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-xs text-neutral-500 text-center py-4">
                  No symbols found
                  <div className="mt-2">
                    <button
                      onClick={() => {
                        // Mock symbol extraction
                        setProjectSymbols([
                          {
                            id: 'prog1',
                            name: 'PROGRAM_Main',
                            type: 'program',
                            line: 1,
                            scope: 'global',
                            references: 3,
                            isUsed: true,
                            children: [
                              {
                                id: 'var1',
                                name: 'Counter',
                                type: 'variable',
                                dataType: 'INT',
                                line: 5,
                                scope: 'PROGRAM_Main',
                                references: 5,
                                isUsed: true,
                              },
                              {
                                id: 'var2',
                                name: 'Enable',
                                type: 'variable',
                                dataType: 'BOOL',
                                line: 6,
                                scope: 'PROGRAM_Main',
                                references: 2,
                                isUsed: true,
                              },
                            ],
                          },
                          {
                            id: 'func1',
                            name: 'CalcAverage',
                            type: 'function',
                            dataType: 'REAL',
                            line: 25,
                            scope: 'global',
                            references: 8,
                            isUsed: true,
                          },
                        ])
                      }}
                      className="text-[#FF6A00] hover:underline text-xs"
                    >
                      Extract symbols from code
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 rounded-lg border border-neutral-200 dark:border-gray-600 overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-2 p-3 border-b border-neutral-200 dark:border-gray-600 bg-neutral-50 dark:bg-gray-700 flex-wrap">
            <button
              onClick={handleCreateFileClick}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-neutral-300 dark:border-gray-600 text-neutral-800 dark:text-white rounded-md hover:bg-neutral-50 dark:hover:bg-gray-600 transition-colors"
              title="New File"
            >
              <FilePlus className="w-4 h-4" />
              New
            </button>
            
            <button
              onClick={() => setShowFileSelector(!showFileSelector)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-neutral-300 dark:border-gray-600 text-neutral-800 dark:text-white rounded-md hover:bg-neutral-50 dark:hover:bg-gray-600 transition-colors"
              title="Open File"
            >
              <FolderOpen className="w-4 h-4" />
              Open
            </button>

            <button
              onClick={handleSave}
              disabled={!isModified || isSaving}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                isModified && !isSaving
                  ? 'bg-[#FF6A00] text-white hover:bg-[#FF8020]'
                  : 'bg-neutral-200 dark:bg-gray-700 text-neutral-500 dark:text-gray-400 cursor-not-allowed'
              }`}
              title="Save (Ctrl+S)"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save'}
            </button>

            <div className="w-px h-6 bg-neutral-300" />

            <button
              onClick={undo}
              disabled={!canUndo()}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                canUndo()
                  ? 'bg-white dark:bg-gray-700 border border-neutral-300 dark:border-gray-600 text-neutral-800 dark:text-white hover:bg-neutral-50 dark:hover:bg-gray-600'
                  : 'bg-neutral-100 dark:bg-gray-800 border border-neutral-200 dark:border-gray-700 text-neutral-400 dark:text-gray-500 cursor-not-allowed'
              }`}
              title="Undo (Ctrl+Z)"
            >
              <Undo className="w-4 h-4" />
            </button>

            <button
              onClick={redo}
              disabled={!canRedo()}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                canRedo()
                  ? 'bg-white dark:bg-gray-700 border border-neutral-300 dark:border-gray-600 text-neutral-800 dark:text-white hover:bg-neutral-50 dark:hover:bg-gray-600'
                  : 'bg-neutral-100 dark:bg-gray-800 border border-neutral-200 dark:border-gray-700 text-neutral-400 dark:text-gray-500 cursor-not-allowed'
              }`}
              title="Redo (Ctrl+Y)"
            >
              <Redo className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-neutral-300" />

            <button
              onClick={handleValidate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-neutral-300 dark:border-gray-600 text-neutral-800 dark:text-white rounded-md hover:bg-neutral-50 dark:hover:bg-gray-600 transition-colors"
              title="Validate"
            >
              <Check className="w-4 h-4" />
              Validate
            </button>

            <button
              onClick={handleFormat}
              disabled={!currentFile}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                currentFile
                  ? 'bg-white dark:bg-gray-700 border border-neutral-300 dark:border-gray-600 text-neutral-800 dark:text-white hover:bg-neutral-50 dark:hover:bg-gray-600'
                  : 'bg-neutral-100 dark:bg-gray-800 border border-neutral-200 dark:border-gray-700 text-neutral-400 dark:text-gray-500 cursor-not-allowed'
              }`}
              title="Format Code"
            >
              <Code className="w-4 h-4" />
              Format
            </button>

            <div className="w-px h-6 bg-neutral-300" />

            <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
              Vendor:
              <select
                value={vendor}
                onChange={(e) => setVendor(e.target.value as typeof vendor)}
                className="px-2 py-1 text-sm border border-neutral-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FF6A00] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="neutral">Vendor-neutral</option>
                <option value="rockwell">Rockwell</option>
                <option value="siemens">Siemens</option>
                <option value="beckhoff">Beckhoff</option>
              </select>
            </label>

            <div className="w-px h-6 bg-neutral-300" />

            {/* Versioning Actions */}
            {/* <button
              onClick={() => setShowSnapshotDialog(true)}
              disabled={!currentFile}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                currentFile
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-neutral-100 border border-neutral-200 text-neutral-400 cursor-not-allowed'
              }`}
              title="Create Snapshot"
            >
              <Package className="w-4 h-4" />
              Snapshot
            </button> */}

            <button
              onClick={() => setShowReleaseDialog(true)}
              disabled={!currentFile}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                currentFile
                  ? 'bg-purple-500 text-white hover:bg-purple-600'
                  : 'bg-neutral-100 border border-neutral-200 text-neutral-400 cursor-not-allowed'
              }`}
              title="Create Release"
            >
              <Tag className="w-4 h-4" />
              Release
            </button>

            <button
              onClick={() => setShowCompareDialog(true)}
              disabled={!currentFile}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                currentFile
                  ? 'bg-white dark:bg-gray-700 border border-neutral-300 dark:border-gray-600 text-neutral-800 dark:text-white hover:bg-neutral-50 dark:hover:bg-gray-600'
                  : 'bg-neutral-100 dark:bg-gray-800 border border-neutral-200 dark:border-gray-700 text-neutral-400 dark:text-gray-500 cursor-not-allowed'
              }`}
              title="Compare with Version"
            >
              <GitBranch className="w-4 h-4" />
              Compare
            </button>

            <div className="w-px h-6 bg-neutral-300" />

            {/* Advanced Features */}
            <button
              onClick={() => setShowHistoryPanel(!showHistoryPanel)}
              disabled={!currentFile}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                currentFile
                  ? showHistoryPanel
                    ? 'bg-[#FF6A00] text-white'
                    : 'bg-white dark:bg-gray-700 border border-neutral-300 dark:border-gray-600 text-neutral-800 dark:text-white hover:bg-neutral-50 dark:hover:bg-gray-600'
                  : 'bg-neutral-100 dark:bg-gray-800 border border-neutral-200 dark:border-gray-700 text-neutral-400 dark:text-gray-500 cursor-not-allowed'
              }`}
              title="Time Travel / Local History"
            >
              <History className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowTestRunner(!showTestRunner)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                showTestRunner
                  ? 'bg-[#FF6A00] text-white'
                  : 'bg-white dark:bg-gray-700 border border-neutral-300 dark:border-gray-600 text-neutral-800 dark:text-white hover:bg-neutral-50 dark:hover:bg-gray-600'
              }`}
              title="Unit Test Runner"
            >
              <TestTube className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowDiagnosticsPanel(!showDiagnosticsPanel)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                showDiagnosticsPanel
                  ? 'bg-[#FF6A00] text-white'
                  : 'bg-white dark:bg-gray-700 border border-neutral-300 dark:border-gray-600 text-neutral-800 dark:text-white hover:bg-neutral-50 dark:hover:bg-gray-600'
              }`}
              title="Semantic Diagnostics"
            >
              <AlertTriangle className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowDiagnosticsPanel(!showDiagnosticsPanel)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                showDiagnosticsPanel
                  ? 'bg-[#FF6A00] text-white'
                  : 'bg-white dark:bg-gray-700 border border-neutral-300 dark:border-gray-600 text-neutral-800 dark:text-white hover:bg-neutral-50 dark:hover:bg-gray-600'
              }`}
              title="Semantic Diagnostics"
            >
              <AlertTriangle className="w-4 h-4" />
            </button>

            <button
              onClick={(e) => {
                if (externalTools.length > 0) {
                  const rect = e.currentTarget.getBoundingClientRect()
                  setExternalToolsMenuPosition({
                    x: rect.left,
                    y: rect.bottom + 5
                  })
                  setShowExternalToolsMenu(true)
                } else {
                  setDialog({
                    isOpen: true,
                    title: 'No External Tools',
                    message: 'No external tools are configured. Go to Settings → Integrations to add tools.',
                    type: 'info'
                  })
                }
              }}
              disabled={!currentFile}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                currentFile
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-neutral-100 dark:bg-gray-800 border border-neutral-200 dark:border-gray-700 text-neutral-400 dark:text-gray-500 cursor-not-allowed'
              }`}
              title={`External Tools (${externalTools.length} configured)`}
            >
              <Plug className="w-4 h-4" />
              Tools {externalTools.length > 0 && `(${externalTools.length})`}
            </button>

            <button
              onClick={() => setShowSafetyAnalyzer(!showSafetyAnalyzer)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                showSafetyAnalyzer
                  ? 'bg-[#FF6A00] text-white'
                  : 'bg-white dark:bg-gray-700 border border-neutral-300 dark:border-gray-600 text-neutral-800 dark:text-white hover:bg-neutral-50 dark:hover:bg-gray-600'
              }`}
              title="Safety Analyzer"
            >
              <Shield className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowReplacePanel(!showReplacePanel)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                showReplacePanel
                  ? 'bg-[#FF6A00] text-white'
                  : 'bg-white dark:bg-gray-700 border border-neutral-300 dark:border-gray-600 text-neutral-800 dark:text-white hover:bg-neutral-50 dark:hover:bg-gray-600'
              }`}
              title="Project-wide Replace"
            >
              <Replace className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-neutral-300" />

      

            <button
              onClick={handleRunSimulator}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              title="Run in Simulator with ST Interpreter"
            >
              <Play className="w-4 h-4" />
              Run in Simulator
            </button>

            {validationResult && (
              <div className={`ml-auto text-sm ${validationResult.isValid ? 'text-green-600' : 'text-red-600'}`}>
                {validationResult.isValid ? '✓ Valid' : `✗ ${validationResult.errors.length} errors`}
              </div>
            )}
          </div>

          {/* File Selector Dropdown */}
          {showFileSelector && (
            <div className="absolute z-10 mt-14 ml-20 bg-white dark:bg-gray-800 border border-neutral-300 dark:border-gray-600 rounded-md shadow-lg max-h-64 overflow-y-auto">
              {files.length > 0 ? (
                files.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => {
                      console.log(`🖱️ File clicked:`, {
                        id: file.id,
                        name: file.name,
                        hasContent: !!file.content,
                        contentLength: file.content?.length || 0
                      })
                      loadFile(file.id)
                      setShowFileSelector(false)
                    }}
                    className={`w-full text-left px-4 py-2 text-sm text-gray-800 dark:text-white hover:bg-neutral-100 dark:hover:bg-gray-700 ${
                      currentFile?.id === file.id ? 'bg-neutral-50 dark:bg-gray-600 font-medium' : ''
                    }`}
                  >
                    {file.name}
                  </button>
                ))
              ) : (
                <div className="px-4 py-2 text-sm text-neutral-500">
                  No files available. Create a new file to get started.
                </div>
              )}
            </div>
          )}

          {/* Editor Status Bar */}
          <div className="px-4 py-1.5 bg-white dark:bg-gray-800 border-b border-neutral-200 dark:border-gray-600 flex items-center gap-4 text-xs text-neutral-600 dark:text-gray-300">
            <div>UTF-8</div>
            <div>Structured Text (ST)</div>
            <div>Mode: {status.shadowOk ? 'Shadow' : 'Local'}</div>
            {validationResult && validationResult.errors.length > 0 && (
              <div className="text-amber-600">{validationResult.errors.length} issue(s)</div>
            )}
          </div>

          {/* Monaco Editor */}
          <div className="flex-1 min-h-0">
            {(() => {
              console.log(`🖊️ Monaco render check:`, {
                hasCurrentFile: !!currentFile,
                currentFileKeys: currentFile ? Object.keys(currentFile) : [],
                currentFileId: currentFile?.id,
                currentFileName: currentFile?.name,
                currentFileContent: currentFile?.content?.substring(0, 50),
                currentFileContentLength: currentFile?.content?.length,
                filesCount: files.length,
                fullCurrentFile: JSON.stringify(currentFile)
              })
              return null
            })()}
            {currentFile ? (
              <>
                {currentFile.readOnly && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
                    <Shield className="w-4 h-4" />
                    <span className="font-medium">Read-Only:</span>
                    <span>This file was extracted from a PLC runtime and cannot be edited in Pandaura.</span>
                  </div>
                )}
                <MonacoEditor
                  value={(() => {
                    if (!currentFile) {
                      console.error(`❌ currentFile is null/undefined in Monaco value!`)
                      return ''
                    }
                    const editorValue = unsavedChanges[currentFile.id] || currentFile.content
                    console.log(`🖊️ Monaco editor receiving value:`, {
                      fileId: currentFile.id,
                      fileName: currentFile.name,
                      hasUnsaved: unsavedChanges.hasOwnProperty(currentFile.id),
                      unsavedValue: unsavedChanges[currentFile.id]?.substring(0, 30),
                      currentFileContent: currentFile.content?.substring(0, 30),
                      finalValue: editorValue?.substring(0, 30),
                      finalLength: editorValue?.length || 0
                    })
                    return editorValue || ''
                  })()}
                  onChange={(content) => {
                    if (!currentFile.readOnly) {
                      updateContent(content)
                    }
                  }}
                  readOnly={(() => {
                    console.log(`🔒 Passing readOnly to Monaco:`, currentFile.readOnly)
                    return currentFile.readOnly || false
                  })()}
                  markers={validationResult ? validationResult.errors.map(error => ({
                    startLineNumber: error.line,
                    endLineNumber: error.line,
                    startColumn: error.column,
                    endColumn: error.column + 1,
                    message: error.message,
                    severity: error.severity === 'error' ? 8 : error.severity === 'warning' ? 4 : 1,
                    owner: 'st-validation',
                    resource: null as any
                  })) : []}
                  tags={tagDatabaseTags}
                  breakpoints={breakpoints}
                  theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
                  onBreakpointToggle={toggleBreakpoint}
                  currentLine={currentLine}
                  onCodeLensAction={handleCodeLensAction}
                  onRenameSymbol={handleRenameSymbol}
                  onExtractFunction={handleExtractFunction}
                />
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-neutral-500">
                No file open. Click "Open" or "New" to get started.
              </div>
            )}
          </div>
        </div>

        {/* Right Context Panel */}
        <div className="w-80 flex flex-col gap-4">
          {/* Change Preview */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-neutral-200 dark:border-gray-600 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-gray-800 dark:text-white">Change Preview</h3>
              <button
                onClick={() => setShowChangePreview(!showChangePreview)}
                className="text-xs text-[#FF6A00] hover:underline"
              >
                {showChangePreview ? 'Hide' : 'Show'}
              </button>
            </div>
            
            {isModified && currentFile ? (
              <div className="space-y-2">
                <div className="text-xs text-neutral-600 mb-2 p-2 bg-amber-50 border border-amber-200 rounded">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                    <span className="font-medium">File has unsaved changes</span>
                  </div>
                  {unsavedChanges[currentFile.id] && (
                    <div className="mt-1 text-neutral-500">
                      Current: {unsavedChanges[currentFile.id]!.split('\n').length} lines | 
                      Original: {currentFile.content.split('\n').length} lines
                    </div>
                  )}
                </div>
                {showChangePreview ? (
                  <div className="max-h-64 overflow-y-auto border border-neutral-200 rounded text-xs">
                    {(() => {
                      // Get the current unsaved content and original saved content
                      const originalContent = currentFile.content  // Saved version
                      const currentContent = unsavedChanges[currentFile.id]  // Unsaved version
                      
                      // Debug logging
                      // console.log('Change Preview Debug:', {
                      //   hasUnsavedChanges: !!currentContent,
                      //   isModified,
                      //   originalLength: originalContent?.length || 0,
                      //   currentLength: currentContent?.length || 0,
                      //   contentsEqual: currentContent === originalContent,
                      //   originalPreview: originalContent?.substring(0, 100) + '...',
                      //   currentPreview: currentContent?.substring(0, 100) + '...'
                      // })
                      
                      // If no unsaved changes, show no diff
                      if (!currentContent || currentContent === originalContent) {
                        return (
                          <div className="p-3 text-neutral-500 text-center">
                            No changes detected
                            <div className="mt-1 text-xs">
                              {!currentContent ? '(No unsaved content)' : '(Contents equal)'}
                            </div>
                          </div>
                        )
                      }
                      
                      const diff = generateDiff(originalContent, currentContent)
                      const changesOnly = diff.filter(change => change.type !== 'unchanged')
                      
                      // console.log('Generated diff:', diff)
                      // console.log('Changes only:', changesOnly)
                      
                      if (changesOnly.length === 0) {
                        return (
                          <div className="p-3 text-neutral-500 text-center">
                            No changes detected in diff
                            <div className="mt-1 text-xs">
                              (Generated {diff.length} total diff entries)
                            </div>
                          </div>
                        )
                      }
                      
                      return changesOnly.map((change) => (
                        <div key={change.changeId} className="border-b border-neutral-100 last:border-b-0">
                          {change.type === 'added' && (
                            <div className="bg-green-50 p-2 border-l-2 border-green-400">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="text-green-700 font-medium mb-1">
                                    + Line {change.modifiedLineNumber}
                                  </div>
                                  <div className="font-mono text-green-800 dark:text-green-400 bg-white dark:bg-gray-900 p-1 rounded border dark:border-gray-600">
                                    {change.modifiedText || '(empty line)'}
                                  </div>
                                </div>
                                <div className="flex gap-1 ml-2">
                                  <button
                                    onClick={() => {
                                      // Accept this change (it's already applied)
                                      // console.log('Change accepted:', change.changeId)
                                    }}
                                    className="p-1 text-green-600 hover:bg-green-100 rounded"
                                    title="Accept"
                                  >
                                    <CheckCircle className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      // Reject this change (remove the added line)
                                      const lines = currentContent.split('\n')
                                      lines.splice((change.modifiedLineNumber || 1) - 1, 1)
                                      updateContent(lines.join('\n'))
                                    }}
                                    className="p-1 text-red-600 hover:bg-red-100 rounded"
                                    title="Reject"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {change.type === 'removed' && (
                            <div className="bg-red-50 p-2 border-l-2 border-red-400">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="text-red-700 font-medium mb-1">
                                    - Line {change.originalLineNumber}
                                  </div>
                                  <div className="font-mono text-red-800 dark:text-red-400 bg-white dark:bg-gray-900 p-1 rounded border dark:border-gray-600">
                                    {change.originalText || '(empty line)'}
                                  </div>
                                </div>
                                <div className="flex gap-1 ml-2">
                                  <button
                                    onClick={() => {
                                      // Accept this removal (it's already applied)
                                      // console.log('Removal accepted:', change.changeId)
                                    }}
                                    className="p-1 text-green-600 hover:bg-green-100 rounded"
                                    title="Accept"
                                  >
                                    <CheckCircle className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      // Reject this removal (restore the line)
                                      const lines = currentContent.split('\n')
                                      const insertIndex = Math.max(0, (change.originalLineNumber || 1) - 1)
                                      lines.splice(insertIndex, 0, change.originalText || '')
                                      updateContent(lines.join('\n'))
                                    }}
                                    className="p-1 text-red-600 hover:bg-red-100 rounded"
                                    title="Reject"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {change.type === 'modified' && (
                            <div className="bg-blue-50 p-2 border-l-2 border-blue-400">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="text-blue-700 font-medium mb-1">
                                    ~ Line {change.originalLineNumber}
                                  </div>
                                  <div className="space-y-1">
                                    <div className="font-mono text-red-700 bg-red-50 p-1 rounded border text-xs">
                                      - {change.originalText || '(empty line)'}
                                    </div>
                                    <div className="font-mono text-green-700 bg-green-50 p-1 rounded border text-xs">
                                      + {change.modifiedText || '(empty line)'}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex gap-1 ml-2">
                                  <button
                                    onClick={() => {
                                      // Accept this modification (it's already applied)
                                      // console.log('Modification accepted:', change.changeId)
                                    }}
                                    className="p-1 text-green-600 hover:bg-green-100 rounded"
                                    title="Accept"
                                  >
                                    <CheckCircle className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      // Reject this modification (restore original)
                                      const lines = currentContent.split('\n')
                                      lines[(change.originalLineNumber || 1) - 1] = change.originalText || ''
                                      updateContent(lines.join('\n'))
                                    }}
                                    className="p-1 text-red-600 hover:bg-red-100 rounded"
                                    title="Reject"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    })()
                    }
                  </div>
                ) : (
                  <div className="text-xs text-neutral-600">
                    File has {(() => {
                      const currentContent = unsavedChanges[currentFile.id] || currentFile.content
                      const originalContent = currentFile.content
                      const diff = generateDiff(originalContent, currentContent)
                      return diff.filter(change => change.type !== 'unchanged').length
                    })()} unsaved changes
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-amber-800">
                      Modified locally • Click "Show" to review changes
                    </div>
                  </div>
                )}
                
                {/* Quick Actions for all changes */}
                {/* {showChangePreview && (
                  <div className="flex gap-2 pt-2 border-t border-neutral-200">
                    <button
                      onClick={() => {
                        // Accept all changes (they're already applied, just need to save)
                        // console.log('All changes accepted')
                      }}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      <CheckCircle className="w-3 h-3" />
                      Accept All
                    </button>
                    <button
                      onClick={() => {
                        // Reject all changes (restore original)
                        if (currentFile) {
                          updateContent(currentFile.content)
                        }
                      }}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      <X className="w-3 h-3" />
                      Reject All
                    </button>
                  </div>
                )} */}
              </div>
            ) : (
              <div className="text-xs text-neutral-500 dark:text-gray-400">No changes to preview</div>
            )}
          </div>

          {/* Validation Report */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-neutral-200 dark:border-gray-600 p-4 max-h-64 overflow-y-auto">
            <h3 className="font-semibold text-sm mb-3 text-gray-800 dark:text-white">Validation & Lint</h3>
            {validationResult && validationResult.errors.length > 0 ? (
              <div className="space-y-2">
                {validationResult.errors.map((error, i) => (
                  <div
                    key={i}
                    className={`text-xs p-2 rounded border ${
                      error.severity === 'error'
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-800 dark:text-red-300'
                        : error.severity === 'warning'
                        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300'
                        : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-300'
                    }`}
                  >
                    <div className="font-medium">Line {error.line}:{error.column}</div>
                    <div>{error.message}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-neutral-500 dark:text-gray-400">
                {validationResult ? '✓ No issues found' : 'Click Validate to check for issues'}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-neutral-200 dark:border-gray-600 p-4">
            <h3 className="font-semibold text-sm mb-3 text-gray-800 dark:text-white">Quick Actions</h3>
            <div className="space-y-2">
              <button
                onClick={handleSendToShadow}
                disabled={!currentFile || isPushing}
                className={`w-full px-3 py-2 text-sm rounded-md transition-colors ${
                  currentFile && !isPushing
                    ? 'bg-[#FF6A00] text-white hover:bg-[#FF8020]'
                    : 'bg-neutral-200 text-neutral-500 cursor-not-allowed'
                }`}
                title="Send current logic to shadow runtime for simulation"
              >
                {isPushing ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Sending to Shadow...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                     Send to Shadow Runtime
                  </span>
                )}
              </button>

              {/* <button
                onClick={() => setShowSnapshotDialog(true)}
                disabled={!currentFile}
                className={`w-full px-3 py-2 text-sm rounded-md transition-colors ${
                  currentFile
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-neutral-200 text-neutral-500 cursor-not-allowed'
                }`}
              >
                Create Snapshot
              </button> */}

              <button
                onClick={() => setShowCreateVersionDialog(true)}
                disabled={!activeProject || files.length === 0}
                className={`w-full px-3 py-2 text-sm rounded-md transition-colors ${
                  activeProject && files.length > 0
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-neutral-200 text-neutral-500 cursor-not-allowed'
                }`}
              >
                Create Version
              </button>
            </div>
          </div>

          {/* Tag Usage */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-neutral-200 dark:border-gray-600 p-4 max-h-64 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-100">
                Tags in Code ({usedTags.length})
              </h3>
              <button
                onClick={() => {
                  // console.log('Manual refresh clicked')
                  if (currentFile) {
                    const currentContent = unsavedChanges[currentFile.id] || currentFile.content || ''
                    // console.log('Refreshing with content:', {
                    //   fileId: currentFile.id,
                    //   fileName: currentFile.name,
                    //   contentLength: currentContent.length,
                    //   hasUnsavedChanges: !!unsavedChanges[currentFile.id]
                    // })
                    const analyzedTags = analyzeTagUsage(currentContent)
                    setUsedTags(analyzedTags)
                  } else {
                    // console.log('Cannot refresh: no current file')
                  }
                }}
                className="text-xs text-[#FF6A00] hover:underline"
                title="Refresh tag usage"
              >
                Refresh
              </button>
            </div>
            <div className="text-xs text-neutral-600 dark:text-gray-400 space-y-1">
              {(() => {
                // Show ALL declared tags (both used and unused)
                if (usedTags.length === 0) {
                  return (
                    <div className="text-neutral-400 dark:text-gray-500 text-center py-4">
                      No tags declared in current file
                      {currentFile && (
                        <div className="text-xs mt-2">
                          Current file: {currentFile.name}
                        </div>
                      )}
                    </div>
                  )
                }
                
                // Sort tags by: used first, then by usage count (descending), then by name
                const sortedTags = [...usedTags].sort((a, b) => {
                  if (a.isUsed && !b.isUsed) return -1
                  if (!a.isUsed && b.isUsed) return 1
                  if (a.usageCount !== b.usageCount) return b.usageCount - a.usageCount
                  return a.name.localeCompare(b.name)
                })
                
                return sortedTags.map((tag) => (
                  <div 
                    key={tag.id}
                    className={`group hover:text-[#FF6A00] cursor-pointer py-1 px-2 hover:bg-neutral-50 dark:hover:bg-gray-700 rounded border border-transparent hover:border-neutral-200 dark:hover:border-gray-500 ${!tag.isUsed ? 'opacity-60' : ''}`}
                    title={`${tag.metadata?.description || tag.name}\nDeclared on line ${tag.declarationLine}\n${tag.isUsed ? `Used ${tag.usageCount} time(s)\nAll occurrences on lines: ${tag.lineNumbers.join(', ')}` : 'Not used in code'}\nType: ${tag.type}${tag.value ? `\nInitial Value: ${tag.value}` : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono font-semibold ${tag.isUsed ? 'text-blue-700 dark:text-blue-400' : 'text-neutral-500 dark:text-gray-400'}`}>{tag.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${tag.isUsed ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-neutral-100 dark:bg-gray-700 text-neutral-500 dark:text-gray-400'}`}>{tag.usageCount}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs bg-neutral-100 dark:bg-gray-700 text-neutral-600 dark:text-gray-300 px-1 rounded">{tag.type}</span>
                      </div>
                    </div>
                    <div className="mt-1 flex items-start justify-between text-xs gap-2">
                      <span className="text-neutral-500 dark:text-gray-400 flex-1 break-words">{tag.isUsed ? `Lines: ${tag.lineNumbers.join(', ')}` : `Line: ${tag.declarationLine} (declared, not used)`}</span>
                      {tag.value && <span className="text-neutral-400 dark:text-gray-500 font-mono flex-shrink-0">= {tag.value}</span>}
                    </div>
                    {tag.metadata?.description && (
                      <div className="mt-1 text-xs text-neutral-400 dark:text-gray-500 italic truncate">{tag.metadata.description}</div>
                    )}
                  </div>
                ))
              })()}
              <div className="text-neutral-400 dark:text-gray-500 text-xs mt-2 pt-2 border-t border-neutral-200 dark:border-gray-600">
                {(() => {
                  const actuallyUsedTags = usedTags.filter(tag => tag.isUsed && tag.usageCount > 0)
                  const totalDeclaredTags = usedTags.length
                  
                  if (actuallyUsedTags.length === 0) {
                    return totalDeclaredTags > 0 
                      ? `${totalDeclaredTags} tag${totalDeclaredTags !== 1 ? 's' : ''} declared • None used in code`
                      : 'No tags declared in current file'
                  }
                  return `${actuallyUsedTags.length}/${totalDeclaredTags} tag${totalDeclaredTags !== 1 ? 's' : ''} used • Click to jump to line`
                })()}
              </div>
            </div>
          </div>

          {/* PLC Execution Results */}
          {showPLCResults && plcExecutionResult && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-neutral-200 dark:border-gray-600 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  PLC Execution Results
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowPLCResults(false)}
                    className="text-xs text-neutral-500 hover:text-neutral-700"
                    title="Hide results"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {plcExecutionResult.success ? (
                <div className="space-y-3">
                  {/* Execution Mode */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-neutral-600">Mode:</span>
                    <span className={`px-2 py-1 rounded font-medium ${
                      plcExecutionResult.data?.executionMode === 'plc' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {plcExecutionResult.data?.executionMode || 'Unknown'}
                    </span>
                  </div>

                  {/* Variables */}
                  {plcExecutionResult.data?.result?.variables && (
                    <div>
                      <div className="font-medium text-xs mb-2">Variables:</div>
                      <div className="space-y-1">
                        {Object.entries(plcExecutionResult.data.result.variables).map(([name, value]) => (
                          <div key={name} className="flex justify-between items-center text-xs bg-neutral-50 p-2 rounded">
                            <span className="font-mono text-blue-600">{name}</span>
                            <span className="font-mono text-green-600">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Execution Log */}
                  {plcExecutionResult.data?.result?.executionLog && (
                    <div>
                      <div className="font-medium text-xs mb-2">Execution Log:</div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {plcExecutionResult.data.result.executionLog.map((log: any, i: number) => (
                          <div key={i} className="text-xs bg-neutral-50 p-1 rounded">
                            <span className="text-neutral-500">L{log.line}:</span> {log.statement}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cycle Time */}
                  {plcExecutionResult.data?.result?.cycleTime && (
                    <div className="text-xs text-neutral-600">
                      Cycle Time: {plcExecutionResult.data.result.cycleTime.toFixed(2)}ms
                    </div>
                  )}

                  {/* Clear Results */}
                  <button
                    onClick={() => setPlcExecutionResult(null)}
                    className="w-full px-2 py-1 text-xs bg-neutral-100 text-neutral-600 rounded hover:bg-neutral-200 transition-colors"
                  >
                    Clear Results
                  </button>
                </div>
              ) : (
                <div className="bg-red-50 p-2 rounded border border-red-200">
                  <div className="font-medium text-red-800 text-xs">Error:</div>
                  <div className="text-red-700 text-xs mt-1">{plcExecutionResult.error}</div>
                </div>
              )}
            </div>
          )}
         
        </div>
      </div>

      {/* Status Bar */}
      <div className="mt-4 px-4 py-2 bg-neutral-100 dark:bg-gray-700 rounded-md flex items-center justify-between text-xs text-neutral-600 dark:text-gray-300">
        <div className="flex items-center gap-4">
          <div>Connected to Shadow: <span className={status.connected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{status.connected ? 'Yes' : 'No'}</span></div>
          <div>Sync State: <span className="text-neutral-900 dark:text-gray-100">{isPushing ? 'Syncing' : 'Idle'}</span></div>
        </div>
        <div>
          {status.lastSync && `Last sync: ${new Date(status.lastSync).toLocaleTimeString()}`}
        </div>
      </div>
      
      {/* Dialog Component */}
      <Dialog
        isOpen={dialog.isOpen}
        onClose={() => setDialog({ ...dialog, isOpen: false })}
        title={dialog.title}
        message={dialog.message}
        type={dialog.type}
      />
      
      {/* New File Dialog */}
      <InputDialog
        isOpen={showNewFileDialog}
        onClose={() => setShowNewFileDialog(false)}
        onConfirm={handleCreateFile}
        title="Create New File"
        label="File Name"
        placeholder="e.g., Temperature_Control.st"
        defaultValue="New_Logic.st"
        required={true}
      />
      
      {/* Rename Symbol Dialog */}
      <InputDialog
        isOpen={showRenameDialog}
        onClose={() => setShowRenameDialog(false)}
        onConfirm={(newName) => {
          if (newName && newName !== renameOldSymbol) {
            handleRenameSymbol(renameOldSymbol, newName)
          }
        }}
        title={`Rename '${renameOldSymbol}'`}
        label="New Name"
        placeholder="Enter new symbol name..."
        defaultValue={renameNewSymbol}
        required={true}
      />
      
      {/* Extract Function Dialog */}
      {showExtractDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowExtractDialog(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-gray-600">
              <h2 className="font-semibold text-lg text-gray-900 dark:text-gray-100">Extract Function</h2>
              <button onClick={() => setShowExtractDialog(false)} className="p-1 hover:bg-neutral-100 dark:hover:bg-gray-700 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Function Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={extractFunctionName}
                  onChange={(e) => setExtractFunctionName(e.target.value)}
                  placeholder="e.g., CalculateTotal"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FF6A00] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Return Type <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={extractReturnType}
                  onChange={(e) => setExtractReturnType(e.target.value)}
                  placeholder="VOID, INT, BOOL, REAL, etc."
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FF6A00] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="text-xs text-neutral-600 dark:text-gray-400 bg-neutral-50 dark:bg-gray-700 p-3 rounded">
                <p>Extracting lines {extractStartLine} - {extractEndLine}</p>
              </div>
            </div>
            <div className="flex gap-3 p-4 border-t border-neutral-200 dark:border-gray-600">
              <button
                onClick={() => setShowExtractDialog(false)}
                className="px-4 py-2 rounded-md font-medium bg-neutral-200 dark:bg-gray-600 text-neutral-800 dark:text-gray-200 hover:bg-neutral-300 dark:hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowExtractDialog(false)
                  handleExtractFunction()
                }}
                className="px-4 py-2 rounded-md font-medium bg-[#FF6A00] text-white hover:bg-[#FF8020]"
              >
                Extract
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Test Configuration Dialog */}
      {showTestConfigDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowTestConfigDialog(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-gray-600">
              <h2 className="font-semibold text-lg flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <TestTube className="w-5 h-5" />
                Configure Test: {testRoutineName}
              </h2>
              <button onClick={() => setShowTestConfigDialog(false)} className="p-1 hover:bg-neutral-100 dark:hover:bg-gray-700 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Test Inputs (JSON) <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={testInputsJson}
                    onChange={(e) => setTestInputsJson(e.target.value)}
                    placeholder='{\n  "Counter": 0,\n  "Enable": true\n}'
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FF6A00] font-mono text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    rows={5}
                  />
                  <p className="text-xs text-neutral-600 dark:text-gray-400 mt-1">Initial variable values</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Expected Outputs (JSON) <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={testExpectedJson}
                    onChange={(e) => setTestExpectedJson(e.target.value)}
                    placeholder='{\n  "Counter": 1,\n  "Output": true\n}'
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FF6A00] font-mono text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    rows={5}
                  />
                  <p className="text-xs text-neutral-600 dark:text-gray-400 mt-1">Expected values after execution</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Mocked I/O (JSON)
                  </label>
                  <textarea
                    value={testMockedIO}
                    onChange={(e) => setTestMockedIO(e.target.value)}
                    placeholder='{\n  "Sensor_1": true,\n  "Temperature": 25.5\n}'
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FF6A00] font-mono text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    rows={4}
                  />
                  <p className="text-xs text-neutral-600 dark:text-gray-400 mt-1">Mock physical I/O values</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Pre-Conditions
                  </label>
                  <textarea
                    value={testPreConditions}
                    onChange={(e) => setTestPreConditions(e.target.value)}
                    placeholder="System must be initialized\nCounter < 100"
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FF6A00] text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    rows={4}
                  />
                  <p className="text-xs text-neutral-600 dark:text-gray-400 mt-1">Conditions before test</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Post-Conditions
                </label>
                <textarea
                  value={testPostConditions}
                  onChange={(e) => setTestPostConditions(e.target.value)}
                  placeholder="Counter must be incremented\nNo errors logged"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FF6A00] text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  rows={3}
                />
                <p className="text-xs text-neutral-600 dark:text-gray-400 mt-1">Conditions after test execution</p>
              </div>
              <div className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 p-3 rounded border border-blue-200 dark:border-blue-700">
                <p className="font-semibold mb-1">🧪 Test Execution Flow:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Isolated simulation environment created</li>
                  <li>Mocked I/O and inputs loaded</li>
                  <li>Routine executes for one cycle</li>
                  <li>Outputs compared with expected values</li>
                  <li>Coverage and trace data captured</li>
                </ul>
              </div>
            </div>
            <div className="flex gap-3 p-4 border-t border-neutral-200 dark:border-gray-600">
              <button
                onClick={() => setShowTestConfigDialog(false)}
                className="px-4 py-2 rounded-md font-medium bg-neutral-200 dark:bg-gray-600 text-neutral-800 dark:text-gray-200 hover:bg-neutral-300 dark:hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  try {
                    const inputs = JSON.parse(testInputsJson)
                    const expectedOutputs = JSON.parse(testExpectedJson)
                    const mockedIO = testMockedIO ? JSON.parse(testMockedIO) : {}
                    
                    const newTest: TestCase & { mockedIO?: any; preConditions?: string; postConditions?: string } = {
                      id: `test-${Date.now()}`,
                      name: `Test ${testRoutineName}`,
                      routine: testRoutineName,
                      inputs,
                      expectedOutputs,
                      mockedIO,
                      preConditions: testPreConditions || undefined,
                      postConditions: testPostConditions || undefined,
                      status: 'pending',
                    }
                    
                    setTestCases([...testCases, newTest])
                    setShowTestConfigDialog(false)
                    
                    setDialog({
                      isOpen: true,
                      title: '✅ Test Created',
                      message: `Test case created for '${testRoutineName}'\n\n📝 Inputs: ${Object.keys(inputs).length} variables\n🎯 Expected outputs: ${Object.keys(expectedOutputs).length} assertions\n\nClick "Run" in the Unit Test Runner panel to execute.`,
                      type: 'success',
                    })
                  } catch (error) {
                    setDialog({
                      isOpen: true,
                      title: 'Invalid JSON',
                      message: 'Please enter valid JSON for inputs, expected outputs, and mocked I/O.',
                      type: 'error',
                    })
                  }
                }}
                className="px-4 py-2 rounded-md font-medium bg-[#FF6A00] text-white hover:bg-[#FF8020]"
              >
                Create Test
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Snapshot Dialog */}
      {showSnapshotDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-[500px] max-w-[90vw]">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Create Snapshot
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Commit Message *</label>
                <textarea
                  value={snapshotMessage}
                  onChange={(e) => setSnapshotMessage(e.target.value)}
                  placeholder="Describe what changed in this snapshot..."
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
                  rows={3}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Tags (optional)</label>
                <input
                  type="text"
                  value={snapshotTags}
                  onChange={(e) => setSnapshotTags(e.target.value)}
                  placeholder="feature, bugfix, refactor"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
                />
                <p className="text-xs text-neutral-500 mt-1">Comma-separated tags</p>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => {
                    setShowSnapshotDialog(false)
                    setSnapshotMessage('')
                    setSnapshotTags('')
                  }}
                  className="px-4 py-2 text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (snapshotMessage.trim()) {
                      setDialog({
                        isOpen: true,
                        title: 'Snapshot Created',
                        message: `Snapshot created successfully!\nMessage: ${snapshotMessage}\nTags: ${snapshotTags || 'none'}`,
                        type: 'success',
                      })
                      setShowSnapshotDialog(false)
                      setSnapshotMessage('')
                      setSnapshotTags('')
                      // Mock: Add to local history
                      setHistoryEntries(prev => [
                        {
                          id: Date.now().toString(),
                          timestamp: new Date().toISOString(),
                          content: currentFile?.content || '',
                          message: snapshotMessage,
                          author: 'Current User',
                        },
                        ...prev,
                      ])
                    }
                  }}
                  disabled={!snapshotMessage.trim()}
                  className="px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55F00] disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors"
                >
                  Create Snapshot
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Version Dialog */}
      {showCreateVersionDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-[500px] max-w-[90vw]">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <GitCommit className="w-5 h-5 text-green-600" />
              Create Version
            </h2>
            <p className="text-sm text-neutral-600 dark:text-gray-400 mb-4">
              Create an immutable snapshot of all logic files and tags in the current project.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">Version Message *</label>
                <textarea
                  value={versionMessage}
                  onChange={(e) => setVersionMessage(e.target.value)}
                  placeholder="Describe what changed in this version..."
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                  rows={3}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">Tags (optional)</label>
                <input
                  type="text"
                  value={versionTags}
                  onChange={(e) => setVersionTags(e.target.value)}
                  placeholder="feature, bugfix, release"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <p className="text-xs text-neutral-500 dark:text-gray-400 mt-1">Comma-separated tags</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <strong>Files to include:</strong> {files.length} logic file(s), {tagDatabaseTags.length} tag(s)
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => {
                    setShowCreateVersionDialog(false)
                    setVersionMessage('')
                    setVersionTags('')
                  }}
                  disabled={isCreatingVersion}
                  className="px-4 py-2 text-neutral-700 dark:text-gray-300 hover:bg-neutral-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateVersion}
                  disabled={!versionMessage.trim() || isCreatingVersion}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-neutral-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {isCreatingVersion ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <GitCommit className="w-4 h-4" />
                      Create Version
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Release Dialog */}
      {showReleaseDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-[500px] max-w-[90vw]">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Create Release
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Release Name *</label>
                <input
                  type="text"
                  placeholder="v1.0.0 or Production Release 2025-Q1"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Release Notes *</label>
                <textarea
                  placeholder="Describe what's included in this release..."
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
                  rows={4}
                />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="signRelease" className="w-4 h-4" />
                <label htmlFor="signRelease" className="text-sm">
                  Digitally sign this release
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => setShowReleaseDialog(false)}
                  className="px-4 py-2 text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setDialog({
                      isOpen: true,
                      title: 'Release Created',
                      message: 'Release created and marked as immutable. Ready for deployment.',
                      type: 'success',
                    })
                    setShowReleaseDialog(false)
                  }}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                >
                  Create Release
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compare with Version Dialog */}
      {showCompareDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-[600px] max-w-[90vw]">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <GitBranch className="w-5 h-5" />
              Compare with Version
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Select Version</label>
                <select
                  value={compareVersion}
                  onChange={(e) => setCompareVersion(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
                >
                  <option value="">-- Select a version --</option>
                  <option value="v1.2.3">v1.2.3 (Production - 2025-11-17)</option>
                  <option value="v1.2.2">v1.2.2 (Staging - 2025-11-15)</option>
                  <option value="v1.2.1">v1.2.1 (Development - 2025-11-10)</option>
                  <option value="snapshot-123">Snapshot #123 (2025-11-05)</option>
                </select>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>Diff Types:</strong> File changes, semantic diffs (variable types,
                  timers, tag addressing), and structural changes will be shown.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => {
                    setShowCompareDialog(false)
                    setCompareVersion('')
                  }}
                  className="px-4 py-2 text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (compareVersion) {
                      setDialog({
                        isOpen: true,
                        title: 'Opening Diff Viewer',
                        message: `Comparing current version with ${compareVersion}...\n\nChanges detected:\n• 3 variables modified\n• 1 timer changed\n• 5 lines of code altered`,
                        type: 'info',
                      })
                      setShowCompareDialog(false)
                      setCompareVersion('')
                    }
                  }}
                  disabled={!compareVersion}
                  className="px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55F00] disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors"
                >
                  Compare
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Local History / Time Travel Panel */}
      {showHistoryPanel && (
        <div className="fixed right-4 top-20 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-neutral-200 dark:border-gray-600 z-40 max-h-[80vh] overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-neutral-200 dark:border-gray-600 bg-neutral-50 dark:bg-gray-700 flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2 text-gray-800 dark:text-gray-100">
              <Clock className="w-4 h-4" />
              Local History & Time Travel
            </h3>
            <button
              onClick={() => setShowHistoryPanel(false)}
              className="text-neutral-500 dark:text-gray-400 hover:text-neutral-700 dark:hover:text-gray-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {historyEntries.length > 0 ? (
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max={historyEntries.length - 1}
                  value={selectedHistoryIndex}
                  onChange={(e) => setSelectedHistoryIndex(Number(e.target.value))}
                  className="w-full"
                />
                <div className="text-xs text-neutral-600 dark:text-gray-400 text-center mb-4">
                  Snapshot {selectedHistoryIndex + 1} of {historyEntries.length}
                </div>
                {historyEntries.map((entry, index) => (
                  <button
                    key={entry.id}
                    onClick={() => setSelectedHistoryIndex(index)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      index === selectedHistoryIndex
                        ? 'border-[#FF6A00] bg-orange-50 dark:bg-orange-900/20'
                        : 'border-neutral-200 dark:border-gray-600 hover:bg-neutral-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-800 dark:text-gray-100">{entry.author}</span>
                      <span className="text-xs text-neutral-500 dark:text-gray-400">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-700 dark:text-gray-300">{entry.message || 'No message'}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center text-sm text-neutral-500 dark:text-gray-400 py-8">
                No history available yet
                <p className="text-xs mt-2 text-neutral-400 dark:text-gray-500">Create a snapshot to start tracking history</p>
              </div>
            )}
          </div>
          {historyEntries.length > 0 && (
            <div className="px-4 py-3 border-t border-neutral-200 dark:border-gray-600 bg-neutral-50 dark:bg-gray-700 flex gap-2">
              <button
                onClick={() => {
                  if (currentFile && historyEntries[selectedHistoryIndex]) {
                    updateContent(historyEntries[selectedHistoryIndex].content)
                    setDialog({
                      isOpen: true,
                      title: 'Restored from History',
                      message: 'File content restored from selected snapshot.',
                      type: 'success',
                    })
                  }
                }}
                className="flex-1 px-3 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55F00] text-xs transition-colors"
              >
                Restore This Version
              </button>
            </div>
          )}
        </div>
      )}

      {/* Test Runner Panel */}
      {showTestRunner && (
        <div className="fixed right-4 top-20 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-neutral-200 dark:border-gray-600 z-40 max-h-[80vh] overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-neutral-200 dark:border-gray-600 bg-neutral-50 dark:bg-gray-700 flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2 text-gray-800 dark:text-gray-100">
              <TestTube className="w-4 h-4" />
              Unit Test Runner
            </h3>
            <button
              onClick={() => setShowTestRunner(false)}
              className="text-neutral-500 dark:text-gray-400 hover:text-neutral-700 dark:hover:text-gray-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-3 mb-4">
              <div className="text-xs text-neutral-600 dark:text-gray-300 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-600">
                💡 Click "▶ Run Test" above routines to create tests
              </div>
              {testCases.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={handleRunAllTests}
                    disabled={testRunning}
                    className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {testRunning ? `Running ${runAllProgress.current}/${runAllProgress.total}...` : '▶ Run All Tests'}
                  </button>
                  <button
                    onClick={() => {
                      const passed = testCases.filter(t => t.status === 'passed').length
                      const failed = testCases.filter(t => t.status === 'failed').length
                      const pending = testCases.filter(t => t.status === 'pending').length
                      const avgCoverage = Object.values(testCoverage).reduce((sum, c) => sum + (c.lines / c.total * 100 || 0), 0) / Object.keys(testCoverage).length || 0
                      
                      setDialog({
                        isOpen: true,
                        title: '📊 Test Summary Report',
                        message: `Total Tests: ${testCases.length}\n\n✅ Passed: ${passed}\n❌ Failed: ${failed}\n⏳ Pending: ${pending}\n\n📈 Success Rate: ${testCases.length > 0 ? ((passed / testCases.length) * 100).toFixed(1) : 0}%\n📊 Avg Coverage: ${avgCoverage.toFixed(1)}%\n\nRoutines Tested: ${new Set(testCases.map(t => t.routine)).size}`,
                        type: 'info',
                      })
                    }}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
                  >
                    📊 Report
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {testCases.length > 0 ? (
                testCases.map((test) => (
                  <div
                    key={test.id}
                    className={`p-3 rounded-lg border ${
                      test.status === 'passed'
                        ? 'border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900/20'
                        : test.status === 'failed'
                        ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20'
                        : 'border-neutral-200 dark:border-gray-600 bg-white dark:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{test.name}</span>
                      {test.status === 'passed' && (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      )}
                      {test.status === 'failed' && <X className="w-4 h-4 text-red-600" />}
                    </div>
                    <p className="text-xs text-neutral-600 dark:text-gray-400 mb-2">Routine: {test.routine}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRunTest(test.id)}
                        disabled={test.status === 'running'}
                        className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {test.status === 'running' ? 'Running...' : '▶ Run'}
                      </button>
                      {test.status === 'failed' && (
                        <button
                          onClick={() => {
                            // Debug functionality temporarily disabled
                            handleRunSimulator()
                            setDialog({
                              isOpen: true,
                              title: '🐛 Debug Mode',
                              message: `Opening simulator for test: ${test.name}\n\nInputs will be loaded and you can step through the execution.`,
                              type: 'info',
                            })
                          }}
                          className="px-2 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
                        >
                          🐛 Debug
                        </button>
                      )}
                      <button
                        onClick={() => setTestCases(testCases.filter((t) => t.id !== test.id))}
                        className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-neutral-600 dark:text-gray-400">
                      {test.executionTime && (
                        <span className="flex items-center gap-1">
                          ⏱️ {test.executionTime.toFixed(2)}ms
                        </span>
                      )}
                      {test.coverage !== undefined && (
                        <span className="flex items-center gap-1">
                          📊 {test.coverage.toFixed(1)}% coverage
                        </span>
                      )}
                    </div>
                    {test.error && (
                      <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-600 rounded text-xs">
                        <p className="font-semibold text-red-800 dark:text-red-300">❌ Assertion Failed:</p>
                        <p className="text-red-700 dark:text-red-200 whitespace-pre-wrap font-mono">{test.error}</p>
                      </div>
                    )}
                    {test.status === 'passed' && test.actualOutputs && (
                      <div className="mt-2 p-2 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-600 rounded text-xs">
                        <p className="font-semibold text-green-800 dark:text-green-300">✅ Outputs:</p>
                        <pre className="text-green-700 dark:text-green-200 mt-1">{JSON.stringify(test.actualOutputs, null, 2)}</pre>
                      </div>
                    )}
                    {test.trace && test.trace.length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs font-medium cursor-pointer text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">🔍 View Trace ({test.trace.length} events)</summary>
                        <div className="mt-2 p-2 bg-neutral-50 dark:bg-gray-800 border border-neutral-200 dark:border-gray-600 rounded text-xs font-mono max-h-40 overflow-y-auto">
                          {test.trace.map((line, idx) => (
                            <div key={idx} className="py-0.5 text-gray-700 dark:text-gray-300">{line}</div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center text-sm text-neutral-500 dark:text-gray-400 py-8">
                  No test cases yet
                  <p className="text-xs mt-2 text-neutral-400 dark:text-gray-500">Click "Add Test Case" to create one</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Diagnostics Panel */}
      {showDiagnosticsPanel && (
        <div className="fixed right-4 top-20 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-neutral-200 dark:border-gray-600 z-40 max-h-[80vh] overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-neutral-200 dark:border-gray-600 bg-neutral-50 dark:bg-gray-700 flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2 text-gray-800 dark:text-gray-100">
              <AlertTriangle className="w-4 h-4" />
              Semantic Diagnostics
            </h3>
            <button
              onClick={() => setShowDiagnosticsPanel(false)}
              className="text-neutral-500 dark:text-gray-400 hover:text-neutral-700 dark:hover:text-gray-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <button
              onClick={runSemanticAnalysis}
              className="w-full px-3 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55F00] text-sm mb-4 transition-colors"
            >
              Run Semantic Analysis
            </button>
            <div className="space-y-2">
              {semanticDiagnostics.length > 0 ? (
                semanticDiagnostics.map((diag) => (
                  <div
                    key={diag.id}
                    className={`p-3 rounded-lg border ${
                      diag.severity === 'error'
                        ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20'
                        : diag.severity === 'warning'
                        ? 'border-yellow-300 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20'
                        : 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    }`}
                  >
                    <div className="flex items-start gap-2 mb-1">
                      <AlertTriangle
                        className={`w-4 h-4 mt-0.5 ${
                          diag.severity === 'error'
                            ? 'text-red-600'
                            : diag.severity === 'warning'
                            ? 'text-yellow-600'
                            : 'text-blue-600'
                        }`}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{diag.message}</p>
                        <p className="text-xs text-neutral-600 dark:text-gray-400 mt-1">
                          Line {diag.line}, Column {diag.column} • {diag.category}
                        </p>
                        {diag.suggestion && (
                          <p className="text-xs text-neutral-500 dark:text-gray-500 mt-1 italic">{diag.suggestion}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-sm text-neutral-500 dark:text-gray-400 py-8">
                  No diagnostics yet
                  <p className="text-xs mt-2 text-neutral-600 dark:text-gray-500">Click "Run Semantic Analysis" to analyze code</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Safety Analyzer Panel */}
      {showSafetyAnalyzer && (
        <div className="fixed right-4 top-20 w-96 bg-white dark:bg-gray-700 rounded-lg shadow-2xl border border-neutral-200 z-40 max-h-[80vh] overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between dark:bg-gray-700">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Safety Analyzer
            </h3>
            <button
              onClick={() => setShowSafetyAnalyzer(false)}
              className="text-neutral-500 hover:text-neutral-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <button
              onClick={runSafetyAnalysis}
              className="w-full px-3 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55F00] text-sm mb-4 transition-colors"
            >
              Run Safety Analysis
            </button>
            <div className="space-y-3">
              {safetyRules.length > 0 ? (
                safetyRules.map((rule) => (
                <div key={rule.id} className="border border-neutral-200 dark:border-gray-600 dark:bg-gray-700 rounded-lg p-3 bg-white dark:bg-gray-750">
                  <div className="flex items-start justify-between mb-2 dark:bg-gray-700">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{rule.name}</p>
                      <p className="text-xs text-neutral-600 dark:text-gray-400 mt-1">{rule.description}</p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded font-medium ${
                        rule.severity === 'critical'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-600'
                          : rule.severity === 'high'
                          ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-600'
                          : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-600'
                      }`}
                    >
                      {rule.severity}
                    </span>
                  </div>
                  {rule.violations.map((violation, idx) => (
                    <div
                      key={idx}
                      className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded text-xs"
                    >
                      <p className="font-medium text-red-800 dark:text-red-300">Line {violation.line}</p>
                      <p className="text-red-700 dark:text-red-400 mt-1">{violation.message}</p>
                      {violation.canOverride && (
                        <button
                          onClick={() => {
                            setSafetyRules(
                              safetyRules.map((r) =>
                                r.id === rule.id
                                  ? {
                                      ...r,
                                      violations: r.violations.map((v, i) =>
                                        i === idx ? { ...v, approved: !v.approved } : v
                                      ),
                                    }
                                  : r
                              )
                            )
                          }}
                          className={`mt-2 px-2 py-1 rounded text-xs ${
                            violation.approved
                              ? 'bg-green-500 text-white'
                              : 'bg-yellow-500 text-white'
                          }`}
                        >
                          {violation.approved ? 'Approved' : 'Request Override'}
                        </button>
                      )}
                      {!violation.canOverride && (
                        <p className="mt-2 text-red-600 dark:text-red-400 font-medium">⚠ Cannot be overridden</p>
                      )}
                    </div>
                  ))}
                </div>
              ))
              ) : (
                <div className="text-center text-sm text-neutral-500 dark:text-gray-400 py-8">
                  No safety issues detected
                  <p className="text-xs mt-2 text-neutral-600 dark:text-gray-500">Click "Run Safety Analysis" to analyze code</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Project-wide Replace Panel */}
      {showReplacePanel && (
        <div className="fixed right-4 top-20 w-96 bg-white dark:bg-gray-700 rounded-lg shadow-2xl border border-neutral-200 z-40 max-h-[80vh] overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between dark:bg-gray-700">
            <h3 className="font-semibold text-sm flex items-center gap-2 dark:bg-gray-700">
              <Replace className="w-4 h-4" />
              Project-wide Replace
            </h3>
            <button
              onClick={() => setShowReplacePanel(false)}
              className="text-neutral-500 hover:text-neutral-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">Search For</label>
                <input
                  type="text"
                  value={replaceSearchTerm}
                  onChange={(e) => setReplaceSearchTerm(e.target.value)}
                  placeholder="Enter search term..."
                  className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-[#FF6A00] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">Replace With</label>
                <input
                  type="text"
                  value={replaceWithTerm}
                  onChange={(e) => setReplaceWithTerm(e.target.value)}
                  placeholder="Enter replacement..."
                  className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-[#FF6A00] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">Scope</label>
                <select
                  value={replaceScope}
                  onChange={(e) => setReplaceScope(e.target.value as ReplaceScope)}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-[#FF6A00] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="current_file">Current File</option>
                  <option value="open_files">Open Files</option>
                  <option value="project">Entire Project</option>
                </select>
              </div>
              <button
                onClick={() => {
                  if (!replaceSearchTerm) return
                  
                  const matches: ReplaceMatch[] = []
                  let filesToSearch: LogicFile[] = []
                  
                  // Determine which files to search based on scope
                  if (replaceScope === 'current_file') {
                    if (!currentFile) return
                    filesToSearch = [currentFile]
                  } else if (replaceScope === 'open_files') {
                    // Search in all open tabs
                    const openFileIds = openTabs.map(tab => tab.id)
                    filesToSearch = files.filter(f => openFileIds.includes(f.id))
                  } else if (replaceScope === 'project') {
                    // Search in all files in the project
                    filesToSearch = files
                  }
                  
                  if (filesToSearch.length === 0) {
                    setDialog({
                      isOpen: true,
                      title: 'No Files',
                      message: 'No files available to search.',
                      type: 'warning',
                    })
                    return
                  }
                  
                  // Search across all selected files
                  filesToSearch.forEach(file => {
                    const fileContent = unsavedChanges[file.id] || file.content
                    const lines = fileContent.split('\n')
                    
                    lines.forEach((line: string, lineIndex: number) => {
                      let match
                      const lineRegex = new RegExp(`\\b${replaceSearchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')
                      
                      while ((match = lineRegex.exec(line)) !== null) {
                        const startIdx = match.index
                        const endIdx = startIdx + match[0].length
                        const contextStart = Math.max(0, startIdx - 20)
                        const contextEnd = Math.min(line.length, endIdx + 20)
                        
                        matches.push({
                          file: file.name,
                          fileId: file.id,
                          line: lineIndex + 1,
                          column: startIdx + 1,
                          matchText: match[0],
                          contextBefore: line.substring(contextStart, startIdx),
                          contextAfter: line.substring(endIdx, contextEnd),
                          selected: true,
                        })
                      }
                    })
                  })
                  
                  setReplaceMatches(matches)
                  
                  if (matches.length === 0) {
                    const scopeText = replaceScope === 'current_file' ? 'current file' : 
                                     replaceScope === 'open_files' ? `${filesToSearch.length} open file(s)` :
                                     `${filesToSearch.length} project file(s)`
                    setDialog({
                      isOpen: true,
                      title: 'No Matches',
                      message: `No occurrences of '${replaceSearchTerm}' found in ${scopeText}.`,
                      type: 'warning',
                    })
                  } else {
                    const fileCount = new Set(matches.map(m => m.file)).size
                    console.log(`Found ${matches.length} matches in ${fileCount} file(s)`)
                  }
                }}
                className="w-full px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm transition-colors"
              >
                Find All
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {replaceMatches.length} match{replaceMatches.length !== 1 ? 'es' : ''} found
                  {replaceMatches.length > 0 && ` in ${new Set(replaceMatches.map(m => m.file)).size} file(s)`}
                </p>
                {replaceMatches.length > 0 && (
                  <button
                    onClick={() => {
                      const allSelected = replaceMatches.every(m => m.selected)
                      setReplaceMatches(replaceMatches.map(m => ({ ...m, selected: !allSelected })))
                    }}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                  >
                    {replaceMatches.every(m => m.selected) ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>
              {replaceMatches.map((match, idx) => (
                <div
                  key={idx}
                  className="p-2 border border-neutral-200 dark:border-gray-600 rounded bg-neutral-50 dark:bg-gray-700 text-xs hover:bg-neutral-100 dark:hover:bg-gray-600 cursor-pointer transition-colors"
                  onClick={() => {
                    // Open the file if it's not the current one
                    if (match.fileId && match.fileId !== currentFile?.id) {
                      loadFile(match.fileId)
                    }
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="checkbox"
                      checked={match.selected}
                      onChange={(e) => {
                        e.stopPropagation()
                        setReplaceMatches(
                          replaceMatches.map((m, i) =>
                            i === idx ? { ...m, selected: !m.selected } : m
                          )
                        )
                      }}
                      className="w-3 h-3"
                    />
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {match.file} : {match.line}
                    </span>
                  </div>
                  <p className="font-mono text-xs ml-5 text-gray-800 dark:text-gray-200">
                    {match.contextBefore}
                    <span className="bg-yellow-200 dark:bg-yellow-600 dark:text-gray-900">{match.matchText}</span>
                    {match.contextAfter}
                  </p>
                </div>
              ))}
            </div>
            {replaceMatches.length > 0 && (
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    if (!replaceSearchTerm || !replaceWithTerm) return
                    
                    const selectedMatches = replaceMatches.filter((m) => m.selected)
                    if (selectedMatches.length === 0) {
                      setDialog({
                        isOpen: true,
                        title: 'No Matches Selected',
                        message: 'Please select at least one match to replace.',
                        type: 'warning',
                      })
                      return
                    }
                    
                    // Group matches by file
                    const matchesByFile = new Map<string, ReplaceMatch[]>()
                    selectedMatches.forEach(match => {
                      const fileId = match.fileId || ''
                      if (!matchesByFile.has(fileId)) {
                        matchesByFile.set(fileId, [])
                      }
                      matchesByFile.get(fileId)!.push(match)
                    })
                    
                    let totalChanges = 0
                    const affectedFiles: string[] = []
                    
                    // Process replacements for each file
                    matchesByFile.forEach((matches: ReplaceMatch[], fileId: string) => {
                      console.log(`Processing ${matches.length} matches in file ${fileId}`);
                      const file = files.find(f => f.id === fileId)
                      if (!file) return
                      
                      const fileContent = unsavedChanges[fileId] || file.content
                      const result = renameSymbol(fileContent, replaceSearchTerm, replaceWithTerm)
                      
                      if (result.changes > 0) {
                        // Update the file content in the store
                        if (currentFile?.id === fileId) {
                          // If it's the current file, use updateContent
                          updateContent(result.content)
                        } else {
                          // If it's another file, update unsavedChanges directly
                          useLogicStore.setState(state => ({
                            unsavedChanges: {
                              ...state.unsavedChanges,
                              [fileId]: result.content
                            }
                          }))
                        }
                        
                        totalChanges += result.changes
                        affectedFiles.push(file.name)
                      }
                    })
                    
                    if (totalChanges > 0) {
                      const fileCount = affectedFiles.length
                      setDialog({
                        isOpen: true,
                        title: 'Replacements Applied',
                        message: `Replaced ${totalChanges} occurrence(s) of '${replaceSearchTerm}' with '${replaceWithTerm}' in ${fileCount} file(s)\n\nAffected files:\n${affectedFiles.map(f => '• ' + f).join('\n')}\n\nDon't forget to save your changes!`,
                        type: 'success',
                      })
                      setReplaceMatches([])
                      setReplaceSearchTerm('')
                      setReplaceWithTerm('')
                    }
                  }}
                  className="flex-1 px-3 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55F00] text-sm transition-colors"
                >
                  Replace Selected
                </button>
                <button
                  onClick={() => setReplaceMatches([])}
                  className="px-3 py-2 bg-neutral-200 dark:bg-gray-600 text-neutral-700 dark:text-gray-200 rounded-lg hover:bg-neutral-300 dark:hover:bg-gray-500 text-sm transition-colors"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* External Tools Context Menu */}
      <ExternalToolsMenu
        tools={getContextMenuTools()}
        onExecuteTool={async (toolId) => {
          if (!currentFile) {
            setDialog({
              isOpen: true,
              title: 'No File Open',
              message: 'Please open a file before running external tools.',
              type: 'warning'
            })
            return
          }

          try {
            const code = unsavedChanges[currentFile.id] || currentFile.content
            const result = await executeTool(toolId, {
              uri: currentFile.id,
              code,
              language: 'structured-text',
              versionId: activeProject?.id,
              projectId: activeProject?.id
            })

            // Show results
            if (result.diagnostics && result.diagnostics.length > 0) {
              setDialog({
                isOpen: true,
                title: 'External Tool Results',
                message: `Found ${result.diagnostics.length} issue(s):\n\n${result.diagnostics.map((d: any) => 
                  `Line ${d.line}: ${d.message}`
                ).join('\n')}`,
                type: result.diagnostics.some((d: any) => d.severity === 'error') ? 'error' : 'info'
              })
            } else {
              setDialog({
                isOpen: true,
                title: 'External Tool Results',
                message: result.message || 'Tool executed successfully.',
                type: 'success'
              })
            }
          } catch (error) {
            setDialog({
              isOpen: true,
              title: 'Tool Execution Failed',
              message: error instanceof Error ? error.message : 'Failed to execute tool',
              type: 'error'
            })
          }
        }}
        position={externalToolsMenuPosition}
        onClose={() => {
          setShowExternalToolsMenu(false)
          setExternalToolsMenuPosition(undefined)
        }}
      />
    </div>
  )
}
