import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, ChevronDown, ChevronRight, GripVertical, Save } from 'lucide-react'
import { Dialog } from './Dialog'
import type { UserDefinedType, UDTMember } from '../types'

interface UDTEditorProps {
  isOpen: boolean
  onClose: () => void
  onSave: (udt: UserDefinedType) => void
  udt?: UserDefinedType // For editing existing UDT
}

export function UDTEditor({ isOpen, onClose, onSave, udt }: UDTEditorProps) {
  const [name, setName] = useState(udt?.name || '')
  const [description, setDescription] = useState(udt?.description || '')
  const [members, setMembers] = useState<UDTMember[]>(udt?.members || [])
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set())

  const addMember = (parentPath?: string) => {
    const newMember: UDTMember = {
      name: `Member${members.length + 1}`,
      type: 'BOOL',
      description: '',
      defaultValue: false
    }

    if (parentPath) {
      // Add as nested member
      const updateNested = (items: UDTMember[], path: string[]): UDTMember[] => {
        if (path.length === 0) return items
        const [current, ...rest] = path
        return items.map(item => 
          item.name === current
            ? { ...item, members: updateNested(item.members || [], rest).concat(newMember) }
            : item
        )
      }
      setMembers(updateNested(members, parentPath.split('.')))
    } else {
      setMembers([...members, newMember])
    }
  }

  const removeMember = (path: string) => {
    const pathParts = path.split('.')
    const removeNested = (items: UDTMember[], parts: string[]): UDTMember[] => {
      if (parts.length === 1) {
        return items.filter(item => item.name !== parts[0])
      }
      const [current, ...rest] = parts
      return items.map(item =>
        item.name === current
          ? { ...item, members: removeNested(item.members || [], rest) }
          : item
      )
    }
    setMembers(removeNested(members, pathParts))
  }

  const updateMember = (path: string, updates: Partial<UDTMember>) => {
    const pathParts = path.split('.')
    const updateNested = (items: UDTMember[], parts: string[]): UDTMember[] => {
      if (parts.length === 1) {
        return items.map(item =>
          item.name === parts[0] ? { ...item, ...updates } : item
        )
      }
      const [current, ...rest] = parts
      return items.map(item =>
        item.name === current
          ? { ...item, members: updateNested(item.members || [], rest) }
          : item
      )
    }
    setMembers(updateNested(members, pathParts))
  }

  const toggleExpand = (path: string) => {
    const newExpanded = new Set(expandedMembers)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedMembers(newExpanded)
  }

  const handleSave = () => {
    if (!name.trim()) {
      alert('UDT name is required')
      return
    }

    const udtData: UserDefinedType = {
      id: udt?.id || `udt_${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      members,
      createdAt: udt?.createdAt || new Date().toISOString(),
      createdBy: udt?.createdBy || 'system'
    }

    onSave(udtData)
  }

  const renderMember = (member: UDTMember, parentPath: string = '') => {
    const currentPath = parentPath ? `${parentPath}.${member.name}` : member.name
    const hasChildren = member.members && member.members.length > 0
    const isExpanded = expandedMembers.has(currentPath)

    return (
      <div key={currentPath} className="border-l-2 border-gray-300 dark:border-gray-600 pl-4 ml-2">
        <div className="flex items-center gap-2 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg px-3 mb-2">
          {hasChildren && (
            <button
              onClick={() => toggleExpand(currentPath)}
              className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          )}
          
          <GripVertical size={16} className="text-gray-400 dark:text-gray-500 cursor-move" />
          
          <input
            type="text"
            value={member.name}
            onChange={(e) => updateMember(currentPath, { name: e.target.value })}
            className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            placeholder="Member name"
          />
          
          <select
            value={member.type}
            onChange={(e) => updateMember(currentPath, { type: e.target.value as any })}
            className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="BOOL">BOOL</option>
            <option value="INT">INT</option>
            <option value="DINT">DINT</option>
            <option value="REAL">REAL</option>
            <option value="STRING">STRING</option>
            <option value="UDT">UDT</option>
            <option value="STRUCT">STRUCT</option>
            <option value="ARRAY">ARRAY</option>
          </select>

          {member.type === 'ARRAY' && (
            <input
              type="number"
              value={member.arraySize || 0}
              onChange={(e) => updateMember(currentPath, { arraySize: parseInt(e.target.value) })}
              className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="Size"
              min="0"
            />
          )}
          
          <input
            type="text"
            value={member.description || ''}
            onChange={(e) => updateMember(currentPath, { description: e.target.value })}
            className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            placeholder="Description"
          />
          
          <button
            onClick={() => addMember(currentPath)}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-blue-600 dark:text-blue-400"
            title="Add nested member"
          >
            <Plus size={16} />
          </button>
          
          <button
            onClick={() => removeMember(currentPath)}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-red-600 dark:text-red-400"
          >
            <Trash2 size={16} />
          </button>
        </div>

        {hasChildren && isExpanded && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="ml-4"
            >
              {member.members!.map(child => renderMember(child, currentPath))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    )
  }

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={udt ? 'Edit UDT' : 'Create New UDT'} size="large">
      <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
        {/* UDT Header */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              UDT Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="MotorUDT"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              rows={2}
              placeholder="Standard motor control structure with status and faults"
            />
          </div>
        </div>

        {/* Members Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Members ({members.length})
            </label>
            <button
              onClick={() => addMember()}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55F00] text-sm"
            >
              <Plus size={16} />
              Add Member
            </button>
          </div>

          <div className="space-y-2 border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-800">
            {members.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No members yet. Click "Add Member" to start building your UDT.
              </div>
            ) : (
              members.map(member => renderMember(member))
            )}
          </div>
        </div>

        {/* Preview Section */}
        {members.length > 0 && (
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Structure Preview
            </label>
            <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto font-mono">
              {`TYPE ${name}\nSTRUCT\n${renderStructPreview(members, 2)}\nEND_STRUCT\nEND_TYPE`}
            </pre>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 p-6 border-t">
        <button
          onClick={onClose}
          className="px-4 py-2 border rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55F00]"
        >
          <Save size={16} />
          {udt ? 'Update UDT' : 'Create UDT'}
        </button>
      </div>
    </Dialog>
  )
}

function renderStructPreview(members: UDTMember[], indent: number = 0): string {
  return members.map(member => {
    const spaces = ' '.repeat(indent)
    let line = `${spaces}${member.name} : ${member.type}`
    
    if (member.type === 'ARRAY' && member.arraySize) {
      line = `${spaces}${member.name} : ARRAY[0..${member.arraySize - 1}] OF ${member.baseType || 'BOOL'}`
    }
    
    if (member.members && member.members.length > 0) {
      line = `${spaces}${member.name} : STRUCT\n${renderStructPreview(member.members, indent + 2)}\n${spaces}END_STRUCT`
    }
    
    if (member.description) {
      line += ` // ${member.description}`
    }
    
    return line
  }).join(';\n') + ';'
}
