import { useEffect, useState } from 'react'
import { MonacoEditor } from '../components/MonacoEditor'
import { useLogicStore } from '../store/logicStore'
import { useSyncStore } from '../store/syncStore'
import { useSimulatorStore } from '../store/simulatorStore'
import { useTagStore } from '../store/tagStore'
import { Save, Undo, Redo, Check, Code, Play, FolderOpen, FilePlus } from 'lucide-react'
import type { editor } from 'monaco-editor'

export function LogicEditor() {
  const {
    currentFile,
    files,
    isModified,
    isSaving,
    validationResult,
    vendor,
    loadAllFiles,
    loadFile,
    createFile,
    updateContent,
    saveFile,
    validate,
    setVendor,
  } = useLogicStore()

  const { pushToShadow, isPushing, status } = useSyncStore()
  const { run: runSimulator } = useSimulatorStore()
  const { tags, getTagNames } = useTagStore()

  const [showFileSelector, setShowFileSelector] = useState(false)
  const [showChangePreview, setShowChangePreview] = useState(false)
  const [editorMarkers, setEditorMarkers] = useState<editor.IMarker[]>([])

  useEffect(() => {
    loadAllFiles()
  }, [loadAllFiles])

  const handleSave = async () => {
    await saveFile()
  }

  const handleValidate = async () => {
    await validate()
  }

  const handleSendToShadow = async () => {
    if (!currentFile) return
    await saveFile()
    const success = await pushToShadow(currentFile.id)
    if (success) {
      alert('Logic sent to shadow runtime successfully!')
    }
  }

  const handleRunSimulator = async () => {
    if (!currentFile) return
    await runSimulator(currentFile.content)
    // Switch to simulator view (would be implemented with routing)
    alert('Simulator started! Check the Simulator panel.')
  }

  const handleCreateFile = async () => {
    const name = prompt('Enter file name:', 'New_Logic.st')
    if (name) {
      await createFile(name)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Logic Editor</h1>
          <p className="text-sm text-neutral-600 mt-1">
            {currentFile?.name || 'No file open'} 
            {isModified && ' • Modified'}
            {currentFile && (
              <span className="ml-2 text-xs text-neutral-500">
                Last saved: {new Date(currentFile.lastModified).toLocaleString()}
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
              onClick={handleCreateFile}
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
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-neutral-300 text-neutral-800 rounded-md hover:bg-neutral-50 transition-colors"
              title="Undo"
            >
              <Undo className="w-4 h-4" />
            </button>

            <button
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-neutral-300 text-neutral-800 rounded-md hover:bg-neutral-50 transition-colors"
              title="Redo"
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
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-neutral-300 text-neutral-800 rounded-md hover:bg-neutral-50 transition-colors"
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
              title="Run in Simulator"
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
          {showFileSelector && files.length > 0 && (
            <div className="absolute z-10 mt-14 ml-20 bg-white border border-neutral-300 rounded-md shadow-lg max-h-64 overflow-y-auto">
              {files.map((file) => (
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
              ))}
            </div>
          )}

          {/* Editor Status Bar */}
          <div className="px-4 py-1.5 bg-white border-b border-neutral-200 flex items-center gap-4 text-xs text-neutral-600">
            <div>UTF-8</div>
            <div>Structured Text (ST)</div>
            <div>Mode: {status.shadowOk ? 'Shadow' : 'Local'}</div>
            {editorMarkers.length > 0 && (
              <div className="text-amber-600">{editorMarkers.length} issue(s)</div>
            )}
          </div>

          {/* Monaco Editor */}
          <div className="flex-1 min-h-0">
            {currentFile ? (
              <MonacoEditor
                value={currentFile.content}
                onChange={updateContent}
                onValidate={setEditorMarkers}
                tags={getTagNames()}
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
            {isModified ? (
              <div className="text-xs text-neutral-600">
                File has unsaved changes
                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-amber-800">
                  Modified locally
                </div>
              </div>
            ) : (
              <div className="text-xs text-neutral-500">No changes</div>
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
              >
                {isPushing ? 'Pushing...' : 'Send to Shadow'}
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
            <h3 className="font-semibold text-sm mb-3">Tag Usage ({tags.length})</h3>
            <div className="text-xs text-neutral-600 space-y-1">
              {tags.slice(0, 10).map((tag) => (
                <div 
                  key={tag.id}
                  className="hover:text-[#FF6A00] cursor-pointer flex items-center justify-between py-1"
                  title={tag.metadata?.description || tag.name}
                >
                  <span className="font-mono">{tag.name}</span>
                  <span className="text-xs text-neutral-400">{tag.type}</span>
                </div>
              ))}
              {tags.length === 0 && (
                <div className="text-neutral-400 text-center py-4">No tags loaded</div>
              )}
              <div className="text-neutral-400 text-xs mt-2 pt-2 border-t border-neutral-200">
                Type tag names in editor for autocomplete
              </div>
            </div>
          </div>
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
    </div>
  )
}
