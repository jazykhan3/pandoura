/**
 * Task 3.5 - Sample Import Review Data
 * Generates mock data for testing the Import Review Screen
 */

import type { 
  ImportReviewData, 
  StructureNode, 
  SymbolInfo, 
  ImportWarning 
} from '../types/import';

/**
 * Generates sample import review data for testing
 */
export function generateSampleImportData(): ImportReviewData {
  const now = new Date();
  const extractedAt = new Date(now.getTime() - 5000);

  return {
    summary: {
      totalObjects: 47,
      programs: 2,
      routines: 8,
      tags: 25,
      types: 5,
      instructions: 7,
      warnings: 3,
      errors: 0,
      duration: 245,
      timestamp: now
    },

    structure: generateSampleStructure(),
    symbols: generateSampleSymbols(),
    warnings: generateSampleWarnings(),
    comparisons: generateSampleComparisons(),

    metadata: {
      vendor: 'Rockwell Automation',
      projectName: 'ConveyorControl_Main',
      version: '32.01',
      extractedAt,
      normalizedAt: now
    }
  };
}

function generateSampleStructure(): StructureNode[] {
  return [
    {
      id: 'pan_1a2b3c4d5e6f7890',
      name: 'MainProgram',
      type: 'program',
      metadata: {
        lineCount: 342,
        complexity: 15,
        scope: 'global'
      },
      sourceLocation: {
        file: 'MainProgram.L5X',
        line: 1
      },
      children: [
        {
          id: 'pan_2b3c4d5e6f789012',
          name: 'MainRoutine',
          type: 'routine',
          metadata: {
            lineCount: 156,
            complexity: 8
          },
          sourceLocation: {
            file: 'MainProgram.L5X',
            line: 45
          },
          children: [
            {
              id: 'pan_3c4d5e6f78901234',
              name: 'ConveyorSpeed',
              type: 'tag',
              metadata: {
                dataType: 'DINT',
                scope: 'program'
              },
              sourceLocation: {
                file: 'MainProgram.L5X',
                line: 67
              }
            },
            {
              id: 'pan_4d5e6f7890123456',
              name: 'EmergencyStop',
              type: 'tag',
              metadata: {
                dataType: 'BOOL',
                scope: 'program'
              },
              sourceLocation: {
                file: 'MainProgram.L5X',
                line: 68
              }
            }
          ]
        },
        {
          id: 'pan_5e6f789012345678',
          name: 'SafetyRoutine',
          type: 'routine',
          metadata: {
            lineCount: 89,
            complexity: 12
          },
          sourceLocation: {
            file: 'MainProgram.L5X',
            line: 201
          }
        }
      ]
    },
    {
      id: 'pan_6f78901234567890',
      name: 'AlarmProgram',
      type: 'program',
      metadata: {
        lineCount: 124,
        complexity: 6,
        scope: 'global'
      },
      sourceLocation: {
        file: 'AlarmProgram.L5X',
        line: 1
      },
      children: [
        {
          id: 'pan_7890123456789012',
          name: 'AlarmHandler',
          type: 'routine',
          metadata: {
            lineCount: 67,
            complexity: 5
          },
          sourceLocation: {
            file: 'AlarmProgram.L5X',
            line: 23
          }
        }
      ]
    },
    {
      id: 'pan_8901234567890123',
      name: 'UserTypes',
      type: 'folder',
      children: [
        {
          id: 'pan_9012345678901234',
          name: 'ConveyorConfig',
          type: 'type',
          metadata: {
            dataType: 'UDT',
            lineCount: 15
          },
          sourceLocation: {
            file: 'UserTypes.L5X',
            line: 10
          }
        },
        {
          id: 'pan_0123456789012345',
          name: 'AlarmState',
          type: 'type',
          metadata: {
            dataType: 'UDT',
            lineCount: 8
          },
          sourceLocation: {
            file: 'UserTypes.L5X',
            line: 30
          }
        }
      ]
    }
  ];
}

function generateSampleSymbols(): SymbolInfo[] {
  return [
    {
      id: 'pan_1a2b3c4d5e6f7890',
      name: 'MainProgram',
      type: 'Program',
      category: 'POU',
      scope: 'global',
      lineNumber: 1,
      sourceFile: 'MainProgram.L5X',
      canonicalId: 'pan_1a2b3c4d5e6f7890',
      metadata: { complexity: 15, lineCount: 342 }
    },
    {
      id: 'pan_2b3c4d5e6f789012',
      name: 'MainRoutine',
      type: 'Routine',
      category: 'POU',
      scope: 'program',
      lineNumber: 45,
      sourceFile: 'MainProgram.L5X',
      canonicalId: 'pan_2b3c4d5e6f789012',
      metadata: { complexity: 8, lineCount: 156 }
    },
    {
      id: 'pan_3c4d5e6f78901234',
      name: 'ConveyorSpeed',
      type: 'Variable',
      category: 'Variable',
      dataType: 'DINT',
      scope: 'program',
      lineNumber: 67,
      sourceFile: 'MainProgram.L5X',
      canonicalId: 'pan_3c4d5e6f78901234'
    },
    {
      id: 'pan_4d5e6f7890123456',
      name: 'EmergencyStop',
      type: 'Variable',
      category: 'Variable',
      dataType: 'BOOL',
      scope: 'program',
      lineNumber: 68,
      sourceFile: 'MainProgram.L5X',
      canonicalId: 'pan_4d5e6f7890123456'
    },
    {
      id: 'pan_9012345678901234',
      name: 'ConveyorConfig',
      type: 'UserDefinedType',
      category: 'Type',
      dataType: 'UDT',
      scope: 'global',
      lineNumber: 10,
      sourceFile: 'UserTypes.L5X',
      canonicalId: 'pan_9012345678901234',
      metadata: { memberCount: 5 }
    },
    {
      id: 'pan_0123456789012345',
      name: 'AlarmState',
      type: 'UserDefinedType',
      category: 'Type',
      dataType: 'UDT',
      scope: 'global',
      lineNumber: 30,
      sourceFile: 'UserTypes.L5X',
      canonicalId: 'pan_0123456789012345',
      metadata: { memberCount: 3 }
    },
    {
      id: 'pan_inst_123456',
      name: 'TON',
      type: 'Timer',
      category: 'Instruction',
      lineNumber: 123,
      sourceFile: 'MainProgram.L5X',
      canonicalId: 'pan_inst_123456'
    },
    {
      id: 'pan_inst_234567',
      name: 'CTU',
      type: 'Counter',
      category: 'Instruction',
      lineNumber: 156,
      sourceFile: 'MainProgram.L5X',
      canonicalId: 'pan_inst_234567'
    }
  ];
}

function generateSampleWarnings(): ImportWarning[] {
  const now = new Date();
  
  return [
    {
      id: 'warn_1',
      level: 'warning',
      message: 'Unresolved type reference detected in ConveyorConfig',
      location: {
        file: 'UserTypes.L5X',
        line: 15,
        object: 'ConveyorConfig'
      },
      category: 'type',
      timestamp: new Date(now.getTime() - 3000)
    },
    {
      id: 'warn_2',
      level: 'info',
      message: 'Using default value for optional parameter in MainRoutine',
      location: {
        file: 'MainProgram.L5X',
        line: 89,
        object: 'MainRoutine'
      },
      category: 'metadata',
      timestamp: new Date(now.getTime() - 2000)
    },
    {
      id: 'warn_3',
      level: 'warning',
      message: 'Cross-reference mapping incomplete for external module',
      location: {
        file: 'MainProgram.L5X',
        line: 234,
        object: 'ExternalCall'
      },
      category: 'reference',
      timestamp: new Date(now.getTime() - 1000)
    }
  ];
}

function generateSampleComparisons() {
  return [
    {
      sourceFile: 'MainProgram.L5X',
      sourceContent: `PROGRAM MainProgram
  VAR
    ConveyorSpeed : DINT := 0;
    EmergencyStop : BOOL := FALSE;
    SystemReady : BOOL := FALSE;
  END_VAR
  
  IF EmergencyStop THEN
    ConveyorSpeed := 0;
    SystemReady := FALSE;
  ELSE
    SystemReady := TRUE;
  END_IF
END_PROGRAM`,
      normalizedContent: `{
  "id": "pan_1a2b3c4d5e6f7890",
  "type": "Program",
  "name": "MainProgram",
  "variables": [
    {
      "id": "pan_3c4d5e6f78901234",
      "name": "ConveyorSpeed",
      "dataType": "DINT",
      "initialValue": 0,
      "scope": "program"
    },
    {
      "id": "pan_4d5e6f7890123456",
      "name": "EmergencyStop",
      "dataType": "BOOL",
      "initialValue": false,
      "scope": "program"
    }
  ],
  "routines": ["pan_2b3c4d5e6f789012"],
  "metadata": {
    "lineCount": 342,
    "complexity": 15,
    "sourceLocation": {
      "file": "MainProgram.L5X",
      "line": 1
    }
  }
}`,
      diff: [
        { type: 'removed' as const, sourceLines: [1, 2, 3], content: 'PROGRAM MainProgram\n  VAR\n    ConveyorSpeed : DINT := 0;' },
        { type: 'added' as const, normalizedLines: [1, 2, 3], content: '{\n  "id": "pan_1a2b3c4d5e6f7890",\n  "type": "Program",' },
        { type: 'modified' as const, sourceLines: [8, 9], normalizedLines: [12, 13], content: 'IF EmergencyStop THEN' }
      ]
    }
  ];
}
