import { useEffect, useRef, useState } from 'react'
import { Dialog } from './Dialog'
import { FileText, Tag as TagIcon, Code, Bell, Monitor } from 'lucide-react'
import type { Tag, TagDependency } from '../types'

interface DependencyGraphProps {
  isOpen: boolean
  onClose: () => void
  tag: Tag
  dependencies: TagDependency[]
  onNavigate?: (type: string, id: string) => void
}

interface GraphNode {
  id: string
  label: string
  type: 'tag' | 'routine' | 'file' | 'hmi' | 'alarm'
  x: number
  y: number
  color: string
}

interface GraphEdge {
  from: string
  to: string
  type: string
}

export function DependencyGraph({
  isOpen,
  onClose,
  tag,
  dependencies,
  onNavigate
}: DependencyGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [edges, setEdges] = useState<GraphEdge[]>([])
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)

  useEffect(() => {
    if (!isOpen) return

    // Build graph from dependencies
    const graphNodes: GraphNode[] = []
    const graphEdges: GraphEdge[] = []

    // Center tag node
    const centerNode: GraphNode = {
      id: tag.id,
      label: tag.name,
      type: 'tag',
      x: 400,
      y: 300,
      color: '#FF6A00'
    }
    graphNodes.push(centerNode)

    // Organize dependencies by type
    const groupedDeps = dependencies.reduce((acc, dep) => {
      const type = dep.dependencyType
      if (!acc[type]) acc[type] = []
      acc[type].push(dep)
      return acc
    }, {} as Record<string, TagDependency[]>)

    let angleStep = (Math.PI * 2) / Object.keys(groupedDeps).length
    let currentAngle = 0
    const radius = 200

    Object.entries(groupedDeps).forEach(([type, deps]) => {
      deps.forEach((dep, index) => {
        const subAngle = currentAngle + (index * 0.3 - deps.length * 0.15)
        const x = 400 + Math.cos(subAngle) * radius
        const y = 300 + Math.sin(subAngle) * radius

        const nodeId = `${type}_${dep.location.fileName}_${dep.location.lineNumber}`
        
        const node: GraphNode = {
          id: nodeId,
          label: `${dep.location.fileName}\nLine ${dep.location.lineNumber}`,
          type: mapDependencyType(type),
          x,
          y,
          color: getNodeColor(mapDependencyType(type))
        }
        
        graphNodes.push(node)
        graphEdges.push({
          from: tag.id,
          to: nodeId,
          type: dep.usageType
        })
      })
      
      currentAngle += angleStep
    })

    setNodes(graphNodes)
    setEdges(graphEdges)
  }, [isOpen, tag, dependencies])

  useEffect(() => {
    if (!canvasRef.current || nodes.length === 0) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw edges
    ctx.strokeStyle = '#CBD5E0'
    ctx.lineWidth = 2
    edges.forEach(edge => {
      const fromNode = nodes.find(n => n.id === edge.from)
      const toNode = nodes.find(n => n.id === edge.to)
      if (!fromNode || !toNode) return

      ctx.beginPath()
      ctx.moveTo(fromNode.x, fromNode.y)
      ctx.lineTo(toNode.x, toNode.y)
      ctx.stroke()

      // Draw arrow
      const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x)
      const arrowSize = 10
      ctx.fillStyle = '#CBD5E0'
      ctx.beginPath()
      ctx.moveTo(toNode.x - arrowSize * Math.cos(angle - Math.PI / 6), toNode.y - arrowSize * Math.sin(angle - Math.PI / 6))
      ctx.lineTo(toNode.x, toNode.y)
      ctx.lineTo(toNode.x - arrowSize * Math.cos(angle + Math.PI / 6), toNode.y - arrowSize * Math.sin(angle + Math.PI / 6))
      ctx.fill()
    })

    // Draw nodes
    nodes.forEach(node => {
      const isSelected = selectedNode?.id === node.id
      const isHovered = hoveredNode?.id === node.id
      const radius = isSelected || isHovered ? 35 : 30

      // Node circle
      ctx.fillStyle = node.color
      ctx.beginPath()
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2)
      ctx.fill()

      if (isSelected || isHovered) {
        ctx.strokeStyle = '#1F2937'
        ctx.lineWidth = 3
        ctx.stroke()
      }

      // Node icon (simplified - just first letter)
      ctx.fillStyle = 'white'
      ctx.font = 'bold 16px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const iconText = getNodeIcon(node.type)
      ctx.fillText(iconText, node.x, node.y)
    })
  }, [nodes, edges, selectedNode, hoveredNode])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Find clicked node
    const clickedNode = nodes.find(node => {
      const dx = x - node.x
      const dy = y - node.y
      return Math.sqrt(dx * dx + dy * dy) <= 30
    })

    if (clickedNode) {
      setSelectedNode(clickedNode)
      if (onNavigate && clickedNode.id !== tag.id) {
        // Extract info from node id and navigate
        onNavigate(clickedNode.type, clickedNode.id)
      }
    } else {
      setSelectedNode(null)
    }
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const hoveredNode = nodes.find(node => {
      const dx = x - node.x
      const dy = y - node.y
      return Math.sqrt(dx * dx + dy * dy) <= 30
    })

    setHoveredNode(hoveredNode || null)
    canvas.style.cursor = hoveredNode ? 'pointer' : 'default'
  }

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={`Dependency Graph: ${tag.name}`} size="large">
      <div className="p-6">
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            This graph shows all places where <strong>{tag.name}</strong> is referenced.
            Click on nodes to navigate to their locations.
          </p>
        </div>

        {/* Graph Canvas */}
        <div className="relative border rounded-lg bg-gray-50 mb-4">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasMouseMove}
            className="w-full"
          />
        </div>

        {/* Legend */}
        <div className="grid grid-cols-5 gap-4 mb-4">
          {[
            { type: 'tag', label: 'Tag', color: '#FF6A00', icon: TagIcon },
            { type: 'routine', label: 'Routine', color: '#3B82F6', icon: Code },
            { type: 'file', label: 'File', color: '#10B981', icon: FileText },
            { type: 'hmi', label: 'HMI', color: '#8B5CF6', icon: Monitor },
            { type: 'alarm', label: 'Alarm', color: '#EF4444', icon: Bell }
          ].map(item => {
            const Icon = item.icon
            return (
              <div key={item.type} className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: item.color }}
                >
                  <Icon size={12} className="text-white" />
                </div>
                <span className="text-sm text-gray-700">{item.label}</span>
              </div>
            )
          })}
        </div>

        {/* Selected Node Details */}
        {selectedNode && selectedNode.id !== tag.id && (
          <div className="border rounded-lg p-4 bg-white">
            <h4 className="font-semibold text-gray-900 mb-2">Selected Node</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Type:</span>
                <span className="font-medium">{selectedNode.type}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Location:</span>
                <span className="font-mono text-xs">{selectedNode.label}</span>
              </div>
            </div>
          </div>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-xs text-gray-600">Total References</p>
            <p className="text-2xl font-bold text-gray-900">{dependencies.length}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-xs text-gray-600">Routines</p>
            <p className="text-2xl font-bold text-gray-900">
              {new Set(dependencies.map(d => d.location.fileName)).size}
            </p>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-xs text-gray-600">Read Operations</p>
            <p className="text-2xl font-bold text-gray-900">
              {dependencies.filter(d => d.usageType === 'read').length}
            </p>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-xs text-gray-600">Write Operations</p>
            <p className="text-2xl font-bold text-gray-900">
              {dependencies.filter(d => d.usageType === 'write').length}
            </p>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </Dialog>
  )
}

function mapDependencyType(type: string): 'tag' | 'routine' | 'file' | 'hmi' | 'alarm' {
  if (type.includes('hmi')) return 'hmi'
  if (type.includes('alarm')) return 'alarm'
  if (type.includes('routine')) return 'routine'
  if (type.includes('file')) return 'file'
  return 'tag'
}

function getNodeColor(type: string): string {
  switch (type) {
    case 'tag': return '#FF6A00'
    case 'routine': return '#3B82F6'
    case 'file': return '#10B981'
    case 'hmi': return '#8B5CF6'
    case 'alarm': return '#EF4444'
    default: return '#6B7280'
  }
}

function getNodeIcon(type: string): string {
  switch (type) {
    case 'tag': return 'T'
    case 'routine': return 'R'
    case 'file': return 'F'
    case 'hmi': return 'H'
    case 'alarm': return 'A'
    default: return '?'
  }
}
