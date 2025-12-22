/**
 * Task 3.5 - Structure Tree Component
 * Displays hierarchical structure of imported PLC program
 * Read-only, expandable/collapsible tree view
 */

import { useState } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FileCode, 
  Tag as TagIcon, 
  Boxes, 
  Code, 
  Settings 
} from 'lucide-react';
import type { StructureNode } from '../../types/import';

interface StructureTreeProps {
  nodes: StructureNode[];
  onNodeSelect?: (node: StructureNode) => void;
  selectedNodeId?: string;
  className?: string;
}

export function StructureTree({ 
  nodes, 
  onNodeSelect, 
  selectedNodeId,
  className = '' 
}: StructureTreeProps) {
  return (
    <div className={`structure-tree ${className}`}>
      {nodes.map(node => (
        <TreeNode 
          key={node.id} 
          node={node} 
          onSelect={onNodeSelect}
          selectedId={selectedNodeId}
          level={0}
        />
      ))}
    </div>
  );
}

interface TreeNodeProps {
  node: StructureNode;
  onSelect?: (node: StructureNode) => void;
  selectedId?: string;
  level: number;
}

function TreeNode({ node, onSelect, selectedId, level }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2); // Auto-expand first 2 levels
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = node.id === selectedId;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
  };

  const handleSelect = () => {
    if (onSelect) {
      onSelect(node);
    }
  };

  const icon = getNodeIcon(node.type);
  const paddingLeft = level * 20 + 8;

  return (
    <div className="tree-node">
      <div 
        className={`tree-node-content flex items-center gap-2 py-2 px-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors ${
          isSelected ? 'bg-blue-50 dark:bg-blue-900/30 border-l-2 border-blue-500' : ''
        }`}
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={handleSelect}
      >
        {/* Expand/Collapse Icon */}
        <div className="w-4 h-4 flex items-center justify-center" onClick={handleToggle}>
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            )
          ) : (
            <span className="w-4" />
          )}
        </div>

        {/* Node Icon */}
        <div className="w-4 h-4">
          {icon}
        </div>

        {/* Node Label */}
        <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">
          {node.name}
        </span>

        {/* Metadata Badges */}
        <div className="flex items-center gap-2 text-xs">
          {node.metadata?.lineCount && (
            <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
              {node.metadata.lineCount} lines
            </span>
          )}
          {node.metadata?.complexity && node.metadata.complexity > 10 && (
            <span className="px-2 py-0.5 bg-yellow-200 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300 rounded">
              C:{node.metadata.complexity}
            </span>
          )}
          {node.metadata?.dataType && (
            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded font-mono">
              {node.metadata.dataType}
            </span>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="tree-node-children">
          {node.children!.map(child => (
            <TreeNode 
              key={child.id} 
              node={child} 
              onSelect={onSelect}
              selectedId={selectedId}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getNodeIcon(type: StructureNode['type']) {
  const iconClass = "w-4 h-4";
  
  switch (type) {
    case 'program':
      return <FileCode className={`${iconClass} text-blue-500`} />;
    case 'routine':
      return <Code className={`${iconClass} text-purple-500`} />;
    case 'tag':
      return <TagIcon className={`${iconClass} text-green-500`} />;
    case 'type':
      return <Boxes className={`${iconClass} text-orange-500`} />;
    case 'instruction':
      return <Settings className={`${iconClass} text-gray-500`} />;
    case 'folder':
      return <Folder className={`${iconClass} text-yellow-500`} />;
    default:
      return <FileCode className={`${iconClass} text-gray-500`} />;
  }
}
