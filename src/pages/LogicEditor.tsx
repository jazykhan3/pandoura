import { useEffect, useState } from 'react'
import { MonacoEditor } from '../components/MonacoEditor'
import { Dialog } from '../components/Dialog'
import { InputDialog } from '../components/InputDialog'
import { useLogicStore } from '../store/enhancedLogicStore'
import { useSyncStore } from '../store/syncStore'
import { useSimulatorStore } from '../store/simulatorStore'
import { useTagStore } from '../store/tagStore'
import { logicApi } from '../services/api'
import { Save, Undo, Redo, Check, Code, Play, FolderOpen, FilePlus, CheckCircle, X, Zap, Settings } from 'lucide-react'

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
    loadAllFiles()
    loadTagDatabaseTags() // Load tags from database for autocomplete
  }, [loadAllFiles, loadTagDatabaseTags])

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
          await fetch('http://localhost:8000/api/sync/status')
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
      await createFile(fileName)
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

  // Removed unused handleLoadSample function

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Logic Editor</h1>
          <p className="text-sm text-neutral-600 mt-1">
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
        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col bg-white rounded-lg border border-neutral-200 overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-2 p-3 border-b border-neutral-200 bg-neutral-50 flex-wrap">
            <button
              onClick={handleCreateFileClick}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-neutral-300 text-neutral-800 rounded-md hover:bg-neutral-50 transition-colors"
              title="New File"
            >
              <FilePlus className="w-4 h-4" />
              New
            </button>
            
            <button
              onClick={() => setShowFileSelector(!showFileSelector)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-neutral-300 text-neutral-800 rounded-md hover:bg-neutral-50 transition-colors"
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
                  : 'bg-neutral-200 text-neutral-500 cursor-not-allowed'
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
                  ? 'bg-white border border-neutral-300 text-neutral-800 hover:bg-neutral-50'
                  : 'bg-neutral-100 border border-neutral-200 text-neutral-400 cursor-not-allowed'
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
                  ? 'bg-white border border-neutral-300 text-neutral-800 hover:bg-neutral-50'
                  : 'bg-neutral-100 border border-neutral-200 text-neutral-400 cursor-not-allowed'
              }`}
              title="Redo (Ctrl+Y)"
            >
              <Redo className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-neutral-300" />

            <button
              onClick={handleValidate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-neutral-300 text-neutral-800 rounded-md hover:bg-neutral-50 transition-colors"
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
                  ? 'bg-white border border-neutral-300 text-neutral-800 hover:bg-neutral-50'
                  : 'bg-neutral-100 border border-neutral-200 text-neutral-400 cursor-not-allowed'
              }`}
              title="Format Code"
            >
              <Code className="w-4 h-4" />
              Format
            </button>

            <div className="w-px h-6 bg-neutral-300" />

            <label className="flex items-center gap-2 text-sm text-neutral-700">
              Vendor:
              <select
                value={vendor}
                onChange={(e) => setVendor(e.target.value as typeof vendor)}
                className="px-2 py-1 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
              >
                <option value="neutral">Vendor-neutral</option>
                <option value="rockwell">Rockwell</option>
                <option value="siemens">Siemens</option>
                <option value="beckhoff">Beckhoff</option>
              </select>
            </label>

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
            <div className="absolute z-10 mt-14 ml-20 bg-white border border-neutral-300 rounded-md shadow-lg max-h-64 overflow-y-auto">
              {files.length > 0 ? (
                files.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => {
                      loadFile(file.id)
                      setShowFileSelector(false)
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-neutral-100 ${
                      currentFile?.id === file.id ? 'bg-neutral-50 font-medium' : ''
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
          <div className="px-4 py-1.5 bg-white border-b border-neutral-200 flex items-center gap-4 text-xs text-neutral-600">
            <div>UTF-8</div>
            <div>Structured Text (ST)</div>
            <div>Mode: {status.shadowOk ? 'Shadow' : 'Local'}</div>
            {validationResult && validationResult.errors.length > 0 && (
              <div className="text-amber-600">{validationResult.errors.length} issue(s)</div>
            )}
          </div>

          {/* Monaco Editor */}
          <div className="flex-1 min-h-0">
            {currentFile ? (
              <MonacoEditor
                value={unsavedChanges[currentFile.id] || currentFile.content}
                onChange={(content) => {
                  updateContent(content)
                }}
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
                onBreakpointToggle={toggleBreakpoint}
                currentLine={currentLine}
              />
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
          <div className="bg-white rounded-lg border border-neutral-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Change Preview</h3>
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
                                  <div className="font-mono text-green-800 bg-white p-1 rounded border">
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
                                  <div className="font-mono text-red-800 bg-white p-1 rounded border">
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
              <div className="text-xs text-neutral-500">No changes to preview</div>
            )}
          </div>

          {/* Validation Report */}
          <div className="bg-white rounded-lg border border-neutral-200 p-4 max-h-64 overflow-y-auto">
            <h3 className="font-semibold text-sm mb-3">Validation & Lint</h3>
            {validationResult && validationResult.errors.length > 0 ? (
              <div className="space-y-2">
                {validationResult.errors.map((error, i) => (
                  <div
                    key={i}
                    className={`text-xs p-2 rounded border ${
                      error.severity === 'error'
                        ? 'bg-red-50 border-red-200 text-red-800'
                        : error.severity === 'warning'
                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                        : 'bg-blue-50 border-blue-200 text-blue-800'
                    }`}
                  >
                    <div className="font-medium">Line {error.line}:{error.column}</div>
                    <div>{error.message}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-neutral-500">
                {validationResult ? '✓ No issues found' : 'Click Validate to check for issues'}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg border border-neutral-200 p-4">
            <h3 className="font-semibold text-sm mb-3">Quick Actions</h3>
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

              <button
                onClick={() => alert('Snapshot created (Milestone 3 feature)')}
                className="w-full px-3 py-2 text-sm bg-white border border-neutral-300 text-neutral-800 rounded-md hover:bg-neutral-50 transition-colors"
              >
                Create Snapshot
              </button>

              <button
                onClick={() => alert('Version creation (Milestone 3 feature)')}
                className="w-full px-3 py-2 text-sm bg-white border border-neutral-300 text-neutral-800 rounded-md hover:bg-neutral-50 transition-colors"
              >
                Create Version
              </button>
            </div>
          </div>

          {/* Tag Usage */}
          <div className="bg-white rounded-lg border border-neutral-200 p-4 max-h-64 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">
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
            <div className="text-xs text-neutral-600 space-y-1">
              {(() => {
                // Show ALL declared tags (both used and unused)
                if (usedTags.length === 0) {
                  return (
                    <div className="text-neutral-400 text-center py-4">
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
                    className={`group hover:text-[#FF6A00] cursor-pointer py-1 px-2 hover:bg-neutral-50 rounded border border-transparent hover:border-neutral-200 ${!tag.isUsed ? 'opacity-60' : ''}`}
                    title={`${tag.metadata?.description || tag.name}\nDeclared on line ${tag.declarationLine}\n${tag.isUsed ? `Used ${tag.usageCount} time(s)\nAll occurrences on lines: ${tag.lineNumbers.join(', ')}` : 'Not used in code'}\nType: ${tag.type}${tag.value ? `\nInitial Value: ${tag.value}` : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono font-semibold ${tag.isUsed ? 'text-blue-700' : 'text-neutral-500'}`}>{tag.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${tag.isUsed ? 'bg-blue-100 text-blue-700' : 'bg-neutral-100 text-neutral-500'}`}>{tag.usageCount}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs bg-neutral-100 text-neutral-600 px-1 rounded">{tag.type}</span>
                      </div>
                    </div>
                    <div className="mt-1 flex items-start justify-between text-xs gap-2">
                      <span className="text-neutral-500 flex-1 break-words">{tag.isUsed ? `Lines: ${tag.lineNumbers.join(', ')}` : `Line: ${tag.declarationLine} (declared, not used)`}</span>
                      {tag.value && <span className="text-neutral-400 font-mono flex-shrink-0">= {tag.value}</span>}
                    </div>
                    {tag.metadata?.description && (
                      <div className="mt-1 text-xs text-neutral-400 italic truncate">{tag.metadata.description}</div>
                    )}
                  </div>
                ))
              })()}
              <div className="text-neutral-400 text-xs mt-2 pt-2 border-t border-neutral-200">
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
            <div className="bg-white rounded-lg border border-neutral-200 p-4">
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
      <div className="mt-4 px-4 py-2 bg-neutral-100 rounded-md flex items-center justify-between text-xs text-neutral-600">
        <div className="flex items-center gap-4">
          <div>Connected to Shadow: <span className={status.connected ? 'text-green-600' : 'text-red-600'}>{status.connected ? 'Yes' : 'No'}</span></div>
          <div>Sync State: <span className="text-neutral-900">{isPushing ? 'Syncing' : 'Idle'}</span></div>
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
    </div>
  )
}
