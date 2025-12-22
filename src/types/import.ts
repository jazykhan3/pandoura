/**
 * Task 3.5 - Import Review Screen Types
 * Defines all interfaces for the read-only import review functionality
 */

export type ImportWarningLevel = 'error' | 'warning' | 'info';

export interface ImportWarning {
  id: string;
  level: ImportWarningLevel;
  message: string;
  location?: {
    file?: string;
    line?: number;
    column?: number;
    object?: string;
  };
  category: 'type' | 'reference' | 'mapping' | 'metadata' | 'validation';
  timestamp: Date;
}

export interface StructureNode {
  id: string;
  name: string;
  type: 'program' | 'routine' | 'tag' | 'instruction' | 'type' | 'folder';
  children?: StructureNode[];
  metadata?: {
    lineCount?: number;
    complexity?: number;
    dataType?: string;
    scope?: string;
    [key: string]: any;
  };
  sourceLocation?: {
    file: string;
    line: number;
  };
  canonicalId?: string;
}

export interface SymbolInfo {
  id: string;
  name: string;
  type: string;
  category: 'POU' | 'Type' | 'Variable' | 'Instruction';
  dataType?: string;
  scope?: string;
  lineNumber?: number;
  sourceFile?: string;
  canonicalId?: string;
  metadata?: Record<string, any>;
}

export interface ImportSummary {
  totalObjects: number;
  programs: number;
  routines: number;
  tags: number;
  types: number;
  instructions: number;
  warnings: number;
  errors: number;
  duration: number;
  timestamp: Date;
}

export interface PreviewComparison {
  sourceFile: string;
  sourceContent: string;
  normalizedContent: string;
  diff?: DiffSection[];
}

export interface DiffSection {
  type: 'added' | 'removed' | 'unchanged' | 'modified';
  sourceLines?: number[];
  normalizedLines?: number[];
  content: string;
}

export interface ImportReviewData {
  summary: ImportSummary;
  structure: StructureNode[];
  symbols: SymbolInfo[];
  warnings: ImportWarning[];
  comparisons: PreviewComparison[];
  metadata: {
    vendor: string;
    projectName: string;
    version?: string;
    extractedAt: Date;
    normalizedAt: Date;
  };
}
