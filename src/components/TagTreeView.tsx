import { useState, useMemo } from 'react'
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FolderOpen,
  Box,
  Tag as TagIcon,
  Circle,
  Settings,
  AlertCircle,
  Lock,
  CheckCircle
} from 'lucide-react'
import type { Tag } from '../types'

type TagTreeViewProps = {
  tags: Tag[]
  searchTerm: string
  regexSearch: boolean
  onTagSelect: (tag: Tag) => void
  onTagEdit: (tag: Tag) => void
  onAddressMapping?: (tag: Tag) => void
  onValidationRules?: (tag: Tag) => void
  selectedTagId?: string
}

export function TagTreeView({ 
  tags, 
  searchTerm, 
  regexSearch,
  onTagSelect, 
  onTagEdit,
  onAddressMapping,
  onValidationRules,
  selectedTagId
}: TagTreeViewProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  // Build tree structure from tags
  const treeStructure = useMemo(() => {
    const tree: Record<string, any> = {}
    
    tags.forEach(tag => {
      // Build path: Area > Equipment > Routine > Tag
      const parts: Array<{ type: string; name: string }> = []
      if (tag.area) parts.push({ type: 'area', name: tag.area })
      if (tag.equipment) parts.push({ type: 'equipment', name: tag.equipment })
      if (tag.routine) parts.push({ type: 'routine', name: tag.routine })
      
      let current = tree
      parts.forEach((part, idx) => {
        const key = `${part.type}:${part.name}`
        if (!current[key]) {
          current[key] = {
            id: key,
            type: part.type,
            name: part.name,
            children: {},
            tags: [],
            path: parts.slice(0, idx + 1).map(p => p.name).join(' / ')
          }
        }
        current = current[key].children
      })
      
      // Add tag to the final level
      const parentKey = parts.length > 0 ? `${parts[parts.length - 1].type}:${parts[parts.length - 1].name}` : 'root'
      if (parts.length > 0) {
        let parent = tree
        parts.forEach(part => {
          const key = `${part.type}:${part.name}`
          parent = parent[key].children
        })
        if (!tree[parentKey]) {
          tree[parentKey] = { children: {}, tags: [] }
        }
        let targetNode = tree
        parts.forEach((part, idx) => {
          const key = `${part.type}:${part.name}`
          if (idx < parts.length - 1) {
            targetNode = targetNode[key].children
          } else {
            if (!targetNode[key].tags) targetNode[key].tags = []
            targetNode[key].tags.push(tag)
          }
        })
      } else {
        // Root level tags
        if (!tree['root']) {
          tree['root'] = { id: 'root', type: 'root', name: 'Root Tags', children: {}, tags: [] }
        }
        tree['root'].tags.push(tag)
      }
    })
    
    return tree
  }, [tags])

  // Filter tree based on search
  const filteredTree = useMemo(() => {
    if (!searchTerm) return treeStructure
    
    const matchesSearch = (tag: Tag): boolean => {
      if (regexSearch) {
        try {
          const regex = new RegExp(searchTerm, 'i')
          const fullPath = [tag.area, tag.equipment, tag.routine, tag.name]
            .filter(Boolean)
            .join('/')
          return regex.test(fullPath) || regex.test(tag.name)
        } catch {
          return tag.name.toLowerCase().includes(searchTerm.toLowerCase())
        }
      } else {
        const term = searchTerm.toLowerCase()
        return Boolean(
          tag.name.toLowerCase().includes(term) ||
          tag.area?.toLowerCase().includes(term) ||
          tag.equipment?.toLowerCase().includes(term) ||
          tag.routine?.toLowerCase().includes(term) ||
          tag.metadata?.description?.toLowerCase().includes(term)
        )
      }
    }

    const filterNode = (node: any): any | null => {
      if (!node) return null
      
      const matchingTags = node.tags?.filter(matchesSearch) || []
      const filteredChildren: Record<string, any> = {}
      
      Object.keys(node.children || {}).forEach(key => {
        const child = filterNode(node.children[key])
        if (child) {
          filteredChildren[key] = child
        }
      })
      
      if (matchingTags.length > 0 || Object.keys(filteredChildren).length > 0) {
        return {
          ...node,
          tags: matchingTags,
          children: filteredChildren
        }
      }
      
      return null
    }

    const filtered: Record<string, any> = {}
    Object.keys(treeStructure).forEach(key => {
      const node = filterNode(treeStructure[key])
      if (node) {
        filtered[key] = node
        // Auto-expand matching nodes
        if (searchTerm) {
          setExpandedNodes(prev => new Set([...prev, node.id]))
        }
      }
    })
    
    return filtered
  }, [treeStructure, searchTerm, regexSearch])

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId)
      } else {
        newSet.add(nodeId)
      }
      return newSet
    })
  }

  const getNodeIcon = (type: string, isExpanded: boolean) => {
    switch (type) {
      case 'area':
        return isExpanded ? <FolderOpen size={16} className="text-blue-500" /> : <Folder size={16} className="text-blue-500" />
      case 'equipment':
        return <Box size={16} className="text-purple-500" />
      case 'routine':
        return <Settings size={16} className="text-green-500" />
      case 'root':
        return <Folder size={16} className="text-gray-500" />
      default:
        return <Circle size={8} className="text-gray-400" />
    }
  }

  const getTagStatusIcon = (tag: Tag) => {
    if (tag.requiresApproval) return <Lock size={12} className="text-red-500" />
    if (tag.lifecycle === 'deprecated') return <AlertCircle size={12} className="text-amber-500" />
    if (tag.lifecycle === 'active') return <CheckCircle size={12} className="text-green-500" />
    return null
  }

  const getTagTypeColor = (type: string) => {
    switch (type) {
      case 'BOOL': return 'bg-blue-100 text-blue-700'
      case 'INT':
      case 'DINT': return 'bg-purple-100 text-purple-700'
      case 'REAL':
      case 'LREAL': return 'bg-green-100 text-green-700'
      case 'STRING': return 'bg-amber-100 text-amber-700'
      case 'UDT': return 'bg-pink-100 text-pink-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const highlightMatch = (text: string) => {
    if (!searchTerm) return text
    
    try {
      if (regexSearch) {
        const regex = new RegExp(`(${searchTerm})`, 'gi')
        const parts = text.split(regex)
        return parts.map((part, i) => {
          const testRegex = new RegExp(searchTerm, 'gi')
          return testRegex.test(part) ? <mark key={i} className="bg-yellow-200 font-semibold">{part}</mark> : part
        })
      } else {
        const index = text.toLowerCase().indexOf(searchTerm.toLowerCase())
        if (index === -1) return text
        
        const before = text.slice(0, index)
        const match = text.slice(index, index + searchTerm.length)
        const after = text.slice(index + searchTerm.length)
        
        return (
          <>
            {before}
            <mark className="bg-yellow-200 font-semibold">{match}</mark>
            {after}
          </>
        )
      }
    } catch {
      return text
    }
  }

  const renderNode = (node: any, level: number = 0): React.ReactElement => {
    const isExpanded = expandedNodes.has(node.id)
    const hasChildren = Object.keys(node.children || {}).length > 0
    const hasTags = (node.tags || []).length > 0
    const isSelected = selectedNodeId === node.id
    
    return (
      <div key={node.id} className="select-none">
        {/* Node Header */}
        <div
          className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
            isSelected ? 'bg-[#FF6A00] bg-opacity-10 border-l-2 border-[#FF6A00]' : 'hover:bg-gray-100'
          }`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
          onClick={() => {
            if (hasChildren || hasTags) {
              toggleNode(node.id)
            }
            setSelectedNodeId(node.id)
          }}
        >
          {/* Expand/Collapse Icon */}
          {(hasChildren || hasTags) ? (
            isExpanded ? (
              <ChevronDown size={16} className="text-gray-500 flex-shrink-0" />
            ) : (
              <ChevronRight size={16} className="text-gray-500 flex-shrink-0" />
            )
          ) : (
            <div className="w-4" />
          )}
          
          {/* Node Icon */}
          {getNodeIcon(node.type, isExpanded)}
          
          {/* Node Name */}
          <span className="text-sm font-medium text-gray-800 flex-1">
            {highlightMatch(node.name)}
          </span>
          
          {/* Tag Count */}
          {hasTags && (
            <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
              {node.tags.length}
            </span>
          )}
        </div>
        
        {/* Children */}
        {isExpanded && (
          <div>
            {/* Child Nodes */}
            {Object.values(node.children || {}).map((child: any) => 
              renderNode(child, level + 1)
            )}
            
            {/* Tags */}
            {node.tags?.map((tag: Tag) => (
              <div
                key={tag.id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors group ${
                  selectedTagId === tag.id 
                    ? 'bg-[#FF6A00] bg-opacity-20 border-l-2 border-[#FF6A00]' 
                    : 'hover:bg-blue-50'
                }`}
                style={{ paddingLeft: `${(level + 1) * 20 + 8}px` }}
                onClick={() => onTagSelect(tag)}
                onDoubleClick={() => onTagEdit(tag)}
              >
                <TagIcon size={14} className="text-[#FF6A00] flex-shrink-0" />
                
                <span className="text-sm text-gray-800 flex-1 font-mono">
                  {highlightMatch(tag.name)}
                </span>
                
                {/* Tag Type Badge */}
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getTagTypeColor(tag.type)}`}>
                  {tag.type}
                </span>
                
                {/* Tag Status Icon */}
                {getTagStatusIcon(tag)}
                
                {/* UDT Indicator */}
                {tag.udtType && (
                  <span className="text-xs text-purple-600 font-medium">
                    {tag.udtType}
                  </span>
                )}
                
                {/* Quick Actions (visible on hover) */}
                <div className="hidden group-hover:flex items-center gap-1">
                  {onAddressMapping && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onAddressMapping(tag)
                      }}
                      className="p-1 hover:bg-blue-100 rounded text-blue-600"
                      title="Address Mapping"
                    >
                      <Settings size={12} />
                    </button>
                  )}
                  {onValidationRules && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onValidationRules(tag)
                      }}
                      className="p-1 hover:bg-green-100 rounded text-green-600"
                      title="Validation Rules"
                    >
                      <CheckCircle size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-4 bg-white">
      {Object.keys(filteredTree).length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <TagIcon size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm">
            {searchTerm ? 'No tags match your search' : 'No tags in hierarchy'}
          </p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {Object.values(filteredTree).map((node: any) => renderNode(node, 0))}
        </div>
      )}
    </div>
  )
}
