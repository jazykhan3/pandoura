/**
 * Task 3.5 - Import Review Screen
 * Main screen component that provides transparency during PLC import
 * Features:
 * - Structure Tree: Hierarchical view of imported objects
 * - Symbol Summary: Categorized list of all symbols
 * - Warnings Panel: Errors, warnings, and info messages
 * - Preview Comparison: Side-by-side source vs normalized view
 * - Read-Only: No configuration changes allowed
 */

import { useState } from 'react';
import { 
  FileText, 
  List, 
  AlertTriangle, 
  Eye, 
  CheckCircle, 
  XCircle,
  Clock,
  Database
} from 'lucide-react';
import { Card } from '../Card';
import { StructureTree } from './StructureTree';
import { SymbolSummary } from './SymbolSummary';
import { WarningsPanel } from './WarningsPanel';
import { PreviewComparison } from './PreviewComparison';
import type { 
  ImportReviewData, 
  StructureNode, 
  SymbolInfo, 
  ImportWarning,
  PreviewComparison as PreviewComparisonType
} from '../../types/import';

interface ImportReviewScreenProps {
  data: ImportReviewData;
  onClose?: () => void;
  onAccept?: () => void;
  onReject?: () => void;
}

type ActiveTab = 'structure' | 'symbols' | 'warnings' | 'preview';

export function ImportReviewScreen({ data, onClose, onAccept, onReject }: ImportReviewScreenProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('structure');
  const [selectedNode, setSelectedNode] = useState<StructureNode | null>(null);
  const [selectedComparison, setSelectedComparison] = useState<PreviewComparisonType>(
    data.comparisons[0] || null
  );

  const hasErrors = data.warnings.some(w => w.level === 'error');
  const hasWarnings = data.warnings.some(w => w.level === 'warning');

  const handleNodeSelect = (node: StructureNode) => {
    setSelectedNode(node);
    // Find corresponding comparison if available
    if (node.sourceLocation) {
      const comparison = data.comparisons.find(c => 
        c.sourceFile === node.sourceLocation?.file
      );
      if (comparison) {
        setSelectedComparison(comparison);
        setActiveTab('preview');
      }
    }
  };

  const handleSymbolSelect = (symbol: SymbolInfo) => {
    // Find corresponding comparison
    if (symbol.sourceFile) {
      const comparison = data.comparisons.find(c => c.sourceFile === symbol.sourceFile);
      if (comparison) {
        setSelectedComparison(comparison);
        setActiveTab('preview');
      }
    }
  };

  const handleWarningSelect = (warning: ImportWarning) => {
    // Find corresponding comparison
    if (warning.location?.file) {
      const comparison = data.comparisons.find(c => 
        c.sourceFile === warning.location?.file
      );
      if (comparison) {
        setSelectedComparison(comparison);
        setActiveTab('preview');
      }
    }
  };

  return (
    <div className="import-review-screen h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="import-review-header bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
              <FileText className="w-7 h-7 text-blue-500" />
              Import Review
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {data.metadata.vendor} • {data.metadata.projectName} 
              {data.metadata.version && ` • v${data.metadata.version}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {onReject && (
              <button
                onClick={onReject}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Reject
              </button>
            )}
            {onAccept && (
              <button
                onClick={onAccept}
                disabled={hasErrors}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  hasErrors
                    ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
                title={hasErrors ? 'Cannot accept import with errors' : 'Accept import'}
              >
                Accept Import
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              >
                Close
              </button>
            )}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-5 gap-4 mt-4">
          <StatCard
            icon={<Database className="w-5 h-5 text-blue-500" />}
            label="Total Objects"
            value={data.summary.totalObjects}
          />
          <StatCard
            icon={<FileText className="w-5 h-5 text-purple-500" />}
            label="POUs"
            value={data.summary.programs + data.summary.routines}
          />
          <StatCard
            icon={<List className="w-5 h-5 text-green-500" />}
            label="Symbols"
            value={data.symbols.length}
          />
          <StatCard
            icon={hasErrors ? <XCircle className="w-5 h-5 text-red-500" /> : <CheckCircle className="w-5 h-5 text-green-500" />}
            label="Status"
            value={hasErrors ? 'Errors' : hasWarnings ? 'Warnings' : 'OK'}
            valueColor={hasErrors ? 'text-red-600 dark:text-red-400' : hasWarnings ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}
          />
          <StatCard
            icon={<Clock className="w-5 h-5 text-gray-500" />}
            label="Duration"
            value={`${data.summary.duration}ms`}
          />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tabs-nav bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6">
        <div className="flex gap-1">
          <TabButton
            active={activeTab === 'structure'}
            onClick={() => setActiveTab('structure')}
            icon={<FileText className="w-4 h-4" />}
            label="Structure"
            badge={data.structure.length}
          />
          <TabButton
            active={activeTab === 'symbols'}
            onClick={() => setActiveTab('symbols')}
            icon={<List className="w-4 h-4" />}
            label="Symbols"
            badge={data.symbols.length}
          />
          <TabButton
            active={activeTab === 'warnings'}
            onClick={() => setActiveTab('warnings')}
            icon={<AlertTriangle className="w-4 h-4" />}
            label="Warnings"
            badge={data.warnings.length}
            badgeColor={hasErrors ? 'bg-red-500' : hasWarnings ? 'bg-yellow-500' : 'bg-gray-400'}
          />
          <TabButton
            active={activeTab === 'preview'}
            onClick={() => setActiveTab('preview')}
            icon={<Eye className="w-4 h-4" />}
            label="Preview"
            badge={data.comparisons.length}
          />
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden p-6">
        <Card className="h-full p-6">
          {activeTab === 'structure' && (
            <StructureTree
              nodes={data.structure}
              onNodeSelect={handleNodeSelect}
              selectedNodeId={selectedNode?.id}
              className="h-full"
            />
          )}

          {activeTab === 'symbols' && (
            <SymbolSummary
              symbols={data.symbols}
              onSymbolSelect={handleSymbolSelect}
              className="h-full"
            />
          )}

          {activeTab === 'warnings' && (
            <WarningsPanel
              warnings={data.warnings}
              onWarningSelect={handleWarningSelect}
              className="h-full"
            />
          )}

          {activeTab === 'preview' && selectedComparison && (
            <PreviewComparison
              comparison={selectedComparison}
              className="h-full"
            />
          )}
        </Card>
      </div>

      {/* Footer Notice */}
      <div className="import-review-footer bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="flex items-center justify-between text-sm">
          <div className="text-gray-600 dark:text-gray-400">
            <strong className="text-amber-600 dark:text-amber-400">Read-Only Mode:</strong> 
            {' '}This screen is for review purposes only. No configuration changes can be made here.
          </div>
          <div className="text-gray-500 dark:text-gray-500 text-xs">
            Extracted: {data.metadata.extractedAt.toLocaleString()} • 
            Normalized: {data.metadata.normalizedAt.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  valueColor?: string;
}

function StatCard({ icon, label, value, valueColor = 'text-gray-900 dark:text-gray-100' }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
      <div className="flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{label}</p>
        <p className={`text-lg font-semibold ${valueColor} truncate`}>{value}</p>
      </div>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  badgeColor?: string;
}

function TabButton({ 
  active, 
  onClick, 
  icon, 
  label, 
  badge, 
  badgeColor = 'bg-gray-400' 
}: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
        active
          ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20'
          : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
      {badge !== undefined && (
        <span className={`px-2 py-0.5 ${badgeColor} text-white text-xs font-semibold rounded-full`}>
          {badge}
        </span>
      )}
    </button>
  );
}
