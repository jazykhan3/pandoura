import { useEffect, useRef } from 'react'
import Editor from '@monaco-editor/react'
import type { editor } from 'monaco-editor'

type Tag = {
  id: string
  name: string
  type: string
  value?: string | number | boolean | null
  metadata?: {
    description?: string
    units?: string
  }
}

type MonacoEditorProps = {
  value: string
  onChange: (value: string) => void
  markers?: editor.IMarker[]
  breakpoints?: number[]
  onBreakpointToggle?: (line: number) => void
  currentLine?: number
  tags?: Tag[]
  onFormat?: () => void
}

// Function to format Structured Text code
function formatStructuredText(text: string, options?: any): string {
  const lines = text.split('\n')
  const formatted: string[] = []
  let indentLevel = 0
  const indentSize = options?.tabSize || 2
  const indent = ' '.repeat(indentSize)
  
  const increaseIndentKeywords = ['VAR', 'VAR_INPUT', 'VAR_OUTPUT', 'VAR_IN_OUT', 'VAR_GLOBAL', 'IF', 'FOR', 'WHILE', 'REPEAT', 'CASE', 'PROGRAM', 'FUNCTION', 'FUNCTION_BLOCK']
  const decreaseIndentKeywords = ['END_VAR', 'END_IF', 'END_FOR', 'END_WHILE', 'END_REPEAT', 'END_CASE', 'END_PROGRAM', 'END_FUNCTION', 'END_FUNCTION_BLOCK']
  const neutralKeywords = ['ELSE', 'ELSIF', 'THEN', 'DO', 'OF']
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim()
    
    if (line === '') {
      formatted.push('')
      continue
    }
    
    // Check if this line should decrease indent
    const shouldDecreaseIndent = decreaseIndentKeywords.some(keyword => 
      line.toUpperCase().includes(keyword.toUpperCase())
    )
    
    if (shouldDecreaseIndent && indentLevel > 0) {
      indentLevel--
    }
    
    // Apply current indentation
    const indentedLine = indent.repeat(indentLevel) + line
    formatted.push(indentedLine)
    
    // Check if this line should increase indent
    const shouldIncreaseIndent = increaseIndentKeywords.some(keyword => 
      line.toUpperCase().includes(keyword.toUpperCase())
    )
    
    if (shouldIncreaseIndent) {
      indentLevel++
    }
  }
  
  return formatted.join('\n')
}

export function MonacoEditor({ 
  value, 
  onChange, 
  markers = [],
  breakpoints = [],
  onBreakpointToggle,
  currentLine,
  tags = [],
  onFormat,
}: MonacoEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null)
  
  // Expose format function to parent
  useEffect(() => {
    if (onFormat && editorRef.current && monacoRef.current) {
      const formatDocument = () => {
        editorRef.current?.getAction('editor.action.formatDocument')?.run()
      }
      // Store the format function on the ref for external access
      (editorRef.current as any).formatDocument = formatDocument
    }
  }, [onFormat])

  // Update markers when they change
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      const model = editorRef.current.getModel()
      if (model) {
        monacoRef.current.editor.setModelMarkers(model, 'st-validator', markers)
      }
    }
  }, [markers])

  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      // Update decorations for breakpoints
      const decorations = breakpoints.map(line => ({
        range: new monacoRef.current!.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: 'breakpoint-line',
          glyphMarginClassName: 'breakpoint-glyph',
        },
      }))

      // Add current line highlight
      if (currentLine) {
        decorations.push({
          range: new monacoRef.current!.Range(currentLine, 1, currentLine, 1),
          options: {
            isWholeLine: true,
            className: 'current-execution-line',
            glyphMarginClassName: '',
          },
        })
      }

      editorRef.current.deltaDecorations([], decorations)
    }
  }, [breakpoints, currentLine])

  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      // Update validation markers
      const model = editorRef.current.getModel()
      if (model) {
        monacoRef.current.editor.setModelMarkers(model, 'st-validation', markers)
      }
    }
  }, [markers])

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor | null, monaco: typeof import('monaco-editor') | null) => {
    if (!editor || !monaco) return
    editorRef.current = editor
    monacoRef.current = monaco

    // Register Structured Text language
    monaco.languages.register({ id: 'st' })

    // Define ST syntax highlighting
    monaco.languages.setMonarchTokensProvider('st', {
      keywords: [
        'PROGRAM', 'END_PROGRAM', 'FUNCTION', 'END_FUNCTION', 'FUNCTION_BLOCK', 'END_FUNCTION_BLOCK',
        'VAR', 'END_VAR', 'VAR_INPUT', 'VAR_OUTPUT', 'VAR_IN_OUT', 'VAR_GLOBAL', 'VAR_TEMP',
        'IF', 'THEN', 'ELSIF', 'ELSE', 'END_IF', 
        'CASE', 'OF', 'END_CASE',
        'FOR', 'TO', 'BY', 'DO', 'END_FOR',
        'WHILE', 'END_WHILE',
        'REPEAT', 'UNTIL', 'END_REPEAT',
        'RETURN', 'EXIT',
        'AND', 'OR', 'NOT', 'XOR', 'MOD',
        'TRUE', 'FALSE',
      ],
      typeKeywords: [
        'BOOL', 'INT', 'DINT', 'REAL', 'LREAL', 'STRING', 'TIME', 'DATE', 'TOD', 'DT',
        'SINT', 'USINT', 'UINT', 'UDINT', 'LINT', 'ULINT', 'BYTE', 'WORD', 'DWORD', 'LWORD',
      ],
      operators: [
        ':=', '=', '<>', '<', '>', '<=', '>=',
        '+', '-', '*', '/', '**',
      ],
      tokenizer: {
        root: [
          [/\(\*[\s\S]*?\*\)/, 'comment'],
          [/\/\/.*$/, 'comment'],
          
          [/[a-zA-Z_]\w*/, {
            cases: {
              '@keywords': 'keyword',
              '@typeKeywords': 'type',
              '@default': 'identifier',
            },
          }],

          [/\d+\.\d+/, 'number.float'],
          [/\d+/, 'number'],
          
          [/"([^"\\]|\\.)*$/, 'string.invalid'],
          [/"/, 'string', '@string'],
          
          [/'([^'\\]|\\.)*$/, 'string.invalid'],
          [/'/, 'string', '@string_single'],
        ],
        
        string: [
          [/[^\\"]+/, 'string'],
          [/"/, 'string', '@pop'],
        ],
        
        string_single: [
          [/[^\\']+/, 'string'],
          [/'/, 'string', '@pop'],
        ],
      },
    })

    // Register completion provider for tags (for ST language)
    monaco.languages.registerCompletionItemProvider('st', {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position)
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        }

        // Check if tags are available
        if (!tags || tags.length === 0) {
          return {
            suggestions: [{
              label: 'No tags synced from Tag Database',
              kind: monaco.languages.CompletionItemKind.Text,
              detail: 'Go to Tag Database page and click "Sync to Shadow"',
              documentation: {
                value: '**No Tags Available**\n\nTo use tag autocomplete:\n1. Go to Tag Database page\n2. Import or create tags\n3. Click "Sync to Shadow" button\n4. Tags will appear here as suggestions'
              },
              insertText: '',
              range: range,
              sortText: 'zzz',
            }]
          }
        }

        // Only show tag suggestions when tags exist
        const suggestions = tags.map(tag => ({
          label: tag.name,
          kind: monaco.languages.CompletionItemKind.Variable,
          detail: `${tag.type} Tag`,
          documentation: {
            value: `**${tag.name}** (${tag.type})\n\n${tag.metadata?.description || 'No description available'}\n\n${tag.metadata?.units ? `Units: ${tag.metadata.units}` : ''}${tag.value !== undefined ? `\nCurrent Value: ${tag.value}` : ''}`
          },
          insertText: tag.name,
          range: range,
          sortText: `0${tag.name}`, // Prioritize tags in autocomplete
        }))

        return { suggestions }
      }
    })

    // Define ST theme
    monaco.editor.defineTheme('st-theme', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: '0000FF', fontStyle: 'bold' },
        { token: 'type', foreground: '0000FF' },
        { token: 'comment', foreground: '008000', fontStyle: 'italic' },
        { token: 'string', foreground: 'A31515' },
        { token: 'number', foreground: '098658' },
        { token: 'identifier', foreground: '000000' },
      ],
      colors: {
        'editor.foreground': '#000000',
        'editor.background': '#FFFFFF',
        'editorLineNumber.foreground': '#237893',
        'editor.selectionBackground': '#ADD6FF',
        'editor.lineHighlightBackground': '#F5F5F5',
      },
    })

    monaco.editor.setTheme('st-theme')

    // Register document formatting provider
    monaco.languages.registerDocumentFormattingEditProvider('st', {
      provideDocumentFormattingEdits: (model, options) => {
        const fullRange = model.getFullModelRange()
        const text = model.getValue()
        const formattedText = formatStructuredText(text, options)
        
        return [{
          range: fullRange,
          text: formattedText
        }]
      }
    })


    // Add gutter click listener for breakpoints
    if (onBreakpointToggle) {
      editor.onMouseDown((e) => {
        const target = e.target
        if (target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN || 
            target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS) {
          const line = target.position?.lineNumber
          if (line) {
            onBreakpointToggle(line)
          }
        }
      })
    }

    // Set validation markers when provided
    const model = editor.getModel()
    if (model && markers.length > 0) {
      monaco.editor.setModelMarkers(model, 'st-validation', markers)
    } else if (model) {
      monaco.editor.setModelMarkers(model, 'st-validation', [])
    }

    // Add custom CSS for breakpoints and current line
    const style = document.createElement('style')
    style.textContent = `
      .breakpoint-glyph {
        background: #FF6A00;
        width: 10px !important;
        height: 10px;
        border-radius: 50%;
        margin-left: 5px;
        margin-top: 5px;
      }
      .breakpoint-line {
        background: rgba(255, 106, 0, 0.1);
      }
      .current-execution-line {
        background: rgba(255, 255, 0, 0.3);
      }
    `
    document.head.appendChild(style)
  }

  return (
    <Editor
      height="100%"
      language="st"
      value={value}
      onChange={(value) => onChange(value || '')}
      onMount={handleEditorDidMount}
      options={{
        minimap: { enabled: true },
        fontSize: 14,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        glyphMargin: true,
        folding: true,
        lineDecorationsWidth: 10,
        lineNumbersMinChars: 4,
        renderLineHighlight: 'all',
        scrollbar: {
          vertical: 'visible',
          horizontal: 'visible',
        },
      }}
    />
  )
}

