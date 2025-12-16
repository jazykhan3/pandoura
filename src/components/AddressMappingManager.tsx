import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  X, 
  Download, 
  Upload, 
  AlertTriangle,
  CheckCircle,
  Search,
  Link as LinkIcon
} from 'lucide-react'
import { Dialog } from './Dialog'
import type { TagAlias } from '../types'

interface AddressMappingManagerProps {
  isOpen: boolean
  onClose: () => void
  tagId?: string
  tagName?: string
  onSave: (aliases: TagAlias[]) => void
}

export function AddressMappingManager({
  isOpen,
  onClose,
  tagId,
  tagName,
  onSave
}: AddressMappingManagerProps) {
  const [aliases, setAliases] = useState<TagAlias[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [conflicts, setConflicts] = useState<string[]>([])
  const [showAddForm, setShowAddForm] = useState(false)

  // New alias form state
  const [newAlias, setNewAlias] = useState('')
  const [newVendorAddress, setNewVendorAddress] = useState('')
  const [newDescription, setNewDescription] = useState('')

  useEffect(() => {
    if (isOpen && tagId) {
      loadAliases()
    }
  }, [isOpen, tagId])

  const loadAliases = async () => {
    // Mock data - replace with actual API call
    const mockAliases: TagAlias[] = [
      {
        id: '1',
        tagId: tagId || '',
        alias: 'TEMP_01',
        vendorAddress: '40001',
        description: 'Modbus register for temperature sensor 1'
      },
      {
        id: '2',
        tagId: tagId || '',
        alias: 'PRESSURE_SENSOR',
        vendorAddress: '40002',
        description: 'Main pressure transducer'
      }
    ]
    setAliases(mockAliases)
    detectConflicts(mockAliases)
  }

  const detectConflicts = (aliasData: TagAlias[]) => {
    const addresses = aliasData.map(a => a.vendorAddress).filter((addr): addr is string => !!addr)
    const duplicates = addresses.filter((addr, idx) => addresses.indexOf(addr) !== idx)
    setConflicts([...new Set(duplicates)])
  }

  const handleAddAlias = () => {
    if (!newAlias.trim()) return

    const newAliasObj: TagAlias = {
      id: `alias_${Date.now()}`,
      tagId: tagId || '',
      alias: newAlias.trim(),
      vendorAddress: newVendorAddress.trim(),
      description: newDescription.trim()
    }

    const updated = [...aliases, newAliasObj]
    setAliases(updated)
    detectConflicts(updated)
    
    // Reset form
    setNewAlias('')
    setNewVendorAddress('')
    setNewDescription('')
    setShowAddForm(false)
  }

  const handleUpdateAlias = (id: string, field: string, value: string) => {
    const updated = aliases.map(alias =>
      alias.id === id ? { ...alias, [field]: value } : alias
    )
    setAliases(updated)
    detectConflicts(updated)
  }

  const handleDeleteAlias = (id: string) => {
    const updated = aliases.filter(a => a.id !== id)
    setAliases(updated)
    detectConflicts(updated)
  }

  const handleSave = () => {
    onSave(aliases)
    onClose()
  }

  const handleExportCSV = () => {
    const csv = [
      ['Alias', 'Vendor Address', 'Description'],
      ...aliases.map(a => [a.alias, a.vendorAddress || '', a.description || ''])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `aliases_${tagName || 'export'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const rows = text.split('\n').map(row => row.split(','))
      
      // Skip header row
      const importedAliases: TagAlias[] = rows.slice(1)
        .filter(row => row[0]) // Skip empty rows
        .map((row, idx) => ({
          id: `imported_${Date.now()}_${idx}`,
          tagId: tagId || '',
          alias: row[0]?.trim() || '',
          vendorAddress: row[1]?.trim() || '',
          description: row[2]?.trim() || ''
        }))

      const updated = [...aliases, ...importedAliases]
      setAliases(updated)
      detectConflicts(updated)
    }
    reader.readAsText(file)
  }

  const filteredAliases = aliases.filter(alias =>
    alias.alias.toLowerCase().includes(searchTerm.toLowerCase()) ||
    alias.vendorAddress?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    alias.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const hasConflict = (vendorAddress?: string) => {
    return vendorAddress && conflicts.includes(vendorAddress)
  }

  return (
    <Dialog 
      isOpen={isOpen} 
      onClose={onClose} 
      title={`Address Mapping: ${tagName || 'Tag'}`} 
      size="large"
    >
      <div className="p-6 space-y-4">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search aliases or addresses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="flex gap-2 ml-4">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              title="Export to CSV"
            >
              <Download size={16} />
              Export
            </button>
            <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm cursor-pointer bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              <Upload size={16} />
              Import
              <input
                type="file"
                accept=".csv"
                onChange={handleImportCSV}
                className="hidden"
              />
            </label>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-3 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55F00] text-sm"
            >
              <Plus size={16} />
              Add Alias
            </button>
          </div>
        </div>

        {/* Conflict Warning */}
        {conflicts.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">Address Conflicts Detected</p>
                <p className="text-xs text-red-800 mt-1">
                  The following vendor addresses are mapped to multiple aliases: {conflicts.join(', ')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Add Alias Form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">New Alias</h3>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <input
                  type="text"
                  placeholder="Alias name *"
                  value={newAlias}
                  onChange={(e) => setNewAlias(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <input
                  type="text"
                  placeholder="Vendor address (e.g., 40001)"
                  value={newVendorAddress}
                  onChange={(e) => setNewVendorAddress(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <button
                onClick={handleAddAlias}
                disabled={!newAlias.trim()}
                className="w-full px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55F00] disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Add Alias
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Aliases Table */}
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 sticky top-0">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Alias</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Vendor Address</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Description</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700 w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAliases.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-500">
                      <LinkIcon size={48} className="mx-auto mb-2 text-gray-300" />
                      <p>No aliases defined yet</p>
                      <button
                        onClick={() => setShowAddForm(true)}
                        className="mt-2 text-sm text-[#FF6A00] hover:underline"
                      >
                        Add your first alias
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredAliases.map((alias) => (
                    <tr key={alias.id} className="border-b border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="py-3 px-4">
                        {editingId === alias.id ? (
                          <input
                            type="text"
                            value={alias.alias}
                            onChange={(e) => handleUpdateAlias(alias.id, 'alias', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        ) : (
                          <span className="font-medium">{alias.alias}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {editingId === alias.id ? (
                          <input
                            type="text"
                            value={alias.vendorAddress || ''}
                            onChange={(e) => handleUpdateAlias(alias.id, 'vendorAddress', e.target.value)}
                            className={`w-full px-2 py-1 border rounded text-sm font-mono ${
                              hasConflict(alias.vendorAddress) ? 'border-red-500' : ''
                            }`}
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <code className={`text-sm ${hasConflict(alias.vendorAddress) ? 'text-red-600' : ''}`}>
                              {alias.vendorAddress || '—'}
                            </code>
                            {hasConflict(alias.vendorAddress) && (
                              <AlertTriangle size={14} className="text-red-500" />
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {editingId === alias.id ? (
                          <input
                            type="text"
                            value={alias.description || ''}
                            onChange={(e) => handleUpdateAlias(alias.id, 'description', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        ) : (
                          <span className="text-gray-600">{alias.description || '—'}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          {editingId === alias.id ? (
                            <>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1.5 hover:bg-green-100 rounded text-green-600"
                                title="Save"
                              >
                                <CheckCircle size={16} />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1.5 hover:bg-gray-200 rounded"
                                title="Cancel"
                              >
                                <X size={16} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setEditingId(alias.id)}
                                className="p-1.5 hover:bg-blue-100 rounded text-blue-600"
                                title="Edit"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteAlias(alias.id)}
                                className="p-1.5 hover:bg-red-100 rounded text-red-600"
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Info */}
        <div className="flex items-center justify-between pt-4 border-t text-sm text-gray-600">
          <div className="flex items-center gap-4">
            <span>{aliases.length} alias{aliases.length !== 1 ? 'es' : ''}</span>
            {conflicts.length > 0 && (
              <span className="text-red-600 flex items-center gap-1">
                <AlertTriangle size={14} />
                {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55F00]"
            >
              <Save size={16} />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
