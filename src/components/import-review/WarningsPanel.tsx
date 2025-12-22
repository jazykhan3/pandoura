/**
 * Task 3.5 - Warnings Panel Component
 * Displays import warnings, errors, and informational messages
 * Read-only, categorized, with severity indicators
 */

import { useState, useMemo } from 'react';
import { AlertTriangle, XCircle, Info, ChevronDown, ChevronRight, Filter } from 'lucide-react';
import type { ImportWarning, ImportWarningLevel } from '../../types/import';

interface WarningsPanelProps {
  warnings: ImportWarning[];
  onWarningSelect?: (warning: ImportWarning) => void;
  className?: string;
}

export function WarningsPanel({ warnings, onWarningSelect, className = '' }: WarningsPanelProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['error', 'warning']));
  const [selectedLevel, setSelectedLevel] = useState<ImportWarningLevel | 'all'>('all');

  // Group warnings by level
  const warningsByLevel = useMemo(() => {
    const grouped = {
      error: [] as ImportWarning[],
      warning: [] as ImportWarning[],
      info: [] as ImportWarning[]
    };
    
    warnings.forEach(warning => {
      grouped[warning.level].push(warning);
    });
    
    return grouped;
  }, [warnings]);

  // Filter by selected level
  const filteredWarnings = useMemo(() => {
    if (selectedLevel === 'all') return warnings;
    return warnings.filter(w => w.level === selectedLevel);
  }, [warnings, selectedLevel]);

  const toggleCategory = (level: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  };

  const errorCount = warningsByLevel.error.length;
  const warningCount = warningsByLevel.warning.length;
  const infoCount = warningsByLevel.info.length;

  return (
    <div className={`warnings-panel flex flex-col h-full ${className}`}>
      {/* Header with Counts */}
      <div className="warnings-header flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Import Warnings
          </h3>
          <div className="flex items-center gap-2">
            {errorCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded text-sm font-medium">
                <XCircle className="w-4 h-4" />
                {errorCount}
              </span>
            )}
            {warningCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded text-sm font-medium">
                <AlertTriangle className="w-4 h-4" />
                {warningCount}
              </span>
            )}
            {infoCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-sm font-medium">
                <Info className="w-4 h-4" />
                {infoCount}
              </span>
            )}
          </div>
        </div>

        {/* Level Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <select 
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value as ImportWarningLevel | 'all')}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Levels</option>
            <option value="error">Errors Only</option>
            <option value="warning">Warnings Only</option>
            <option value="info">Info Only</option>
          </select>
        </div>
      </div>

      {/* Warnings List */}
      {filteredWarnings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
          <Info className="w-12 h-12 mb-3 opacity-50" />
          <p className="text-lg font-medium">No warnings to display</p>
          <p className="text-sm">The import completed without issues</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto space-y-1">
          {/* Errors Section */}
          {warningsByLevel.error.length > 0 && (selectedLevel === 'all' || selectedLevel === 'error') && (
            <WarningCategory
              level="error"
              warnings={warningsByLevel.error}
              isExpanded={expandedCategories.has('error')}
              onToggle={() => toggleCategory('error')}
              onWarningClick={onWarningSelect}
            />
          )}

          {/* Warnings Section */}
          {warningsByLevel.warning.length > 0 && (selectedLevel === 'all' || selectedLevel === 'warning') && (
            <WarningCategory
              level="warning"
              warnings={warningsByLevel.warning}
              isExpanded={expandedCategories.has('warning')}
              onToggle={() => toggleCategory('warning')}
              onWarningClick={onWarningSelect}
            />
          )}

          {/* Info Section */}
          {warningsByLevel.info.length > 0 && (selectedLevel === 'all' || selectedLevel === 'info') && (
            <WarningCategory
              level="info"
              warnings={warningsByLevel.info}
              isExpanded={expandedCategories.has('info')}
              onToggle={() => toggleCategory('info')}
              onWarningClick={onWarningSelect}
            />
          )}
        </div>
      )}
    </div>
  );
}

interface WarningCategoryProps {
  level: ImportWarningLevel;
  warnings: ImportWarning[];
  isExpanded: boolean;
  onToggle: () => void;
  onWarningClick?: (warning: ImportWarning) => void;
}

function WarningCategory({ level, warnings, isExpanded, onToggle, onWarningClick }: WarningCategoryProps) {
  const { icon, bgClass, textClass, borderClass } = getLevelStyles(level);

  return (
    <div className="warning-category">
      {/* Category Header */}
      <div 
        className={`flex items-center gap-2 px-3 py-2 ${bgClass} ${borderClass} border-l-4 cursor-pointer hover:opacity-80 transition-opacity`}
        onClick={onToggle}
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        {icon}
        <span className={`font-medium ${textClass} capitalize`}>
          {level}s ({warnings.length})
        </span>
      </div>

      {/* Category Warnings */}
      {isExpanded && (
        <div className="pl-4 space-y-1 mt-1">
          {warnings.map(warning => (
            <WarningItem 
              key={warning.id} 
              warning={warning} 
              onClick={onWarningClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface WarningItemProps {
  warning: ImportWarning;
  onClick?: (warning: ImportWarning) => void;
}

function WarningItem({ warning, onClick }: WarningItemProps) {
  const { bgClass, textClass } = getLevelStyles(warning.level);

  return (
    <div 
      className={`warning-item p-3 ${bgClass} rounded-lg cursor-pointer hover:opacity-80 transition-opacity`}
      onClick={() => onClick?.(warning)}
    >
      <div className="flex items-start gap-3">
        <div className={`flex-1 ${textClass}`}>
          <p className="text-sm font-medium mb-1">{warning.message}</p>
          
          {warning.location && (
            <div className="text-xs opacity-75 space-y-0.5">
              {warning.location.file && (
                <div>File: {warning.location.file}</div>
              )}
              {warning.location.line && (
                <div>Line: {warning.location.line}</div>
              )}
              {warning.location.object && (
                <div>Object: {warning.location.object}</div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 mt-2">
            <span className="px-2 py-0.5 bg-white/50 dark:bg-black/20 rounded text-xs font-medium">
              {warning.category}
            </span>
            <span className="text-xs opacity-60">
              {warning.timestamp.toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function getLevelStyles(level: ImportWarningLevel) {
  switch (level) {
    case 'error':
      return {
        icon: <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />,
        bgClass: 'bg-red-50 dark:bg-red-900/20',
        textClass: 'text-red-700 dark:text-red-300',
        borderClass: 'border-red-500'
      };
    case 'warning':
      return {
        icon: <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />,
        bgClass: 'bg-yellow-50 dark:bg-yellow-900/20',
        textClass: 'text-yellow-700 dark:text-yellow-300',
        borderClass: 'border-yellow-500'
      };
    case 'info':
      return {
        icon: <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
        bgClass: 'bg-blue-50 dark:bg-blue-900/20',
        textClass: 'text-blue-700 dark:text-blue-300',
        borderClass: 'border-blue-500'
      };
  }
}
