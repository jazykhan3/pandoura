import { useEffect, useRef } from 'react'
import Editor from '@monaco-editor/react'
import type { editor } from 'monaco-editor'

type MonacoEditorProps = {
  value: string
  onChange: (value: string) => void
  onValidate?: (markers: editor.IMarker[]) => void
  breakpoints?: number[]
  onBreakpointToggle?: (line: number) => void
  currentLine?: number
  tags?: string[]
}

export function MonacoEditor({ 
  value, 
  onChange, 
  onValidate,
  breakpoints = [],
  onBreakpointToggle,
  currentLine,
  tags = [],
}: MonacoEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null)

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

    // Register tag autocomplete
    if (tags.length > 0) {
      monaco.languages.registerCompletionItemProvider('st', {
        provideCompletionItems: (model, position) => {
          const word = model.getWordUntilPosition(position)
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          }

          const suggestions = tags.map(tag => ({
            label: tag,
            kind: monaco.languages.CompletionItemKind.Variable,
            insertText: tag,
            range: range,
            documentation: `Tag: ${tag}`,
          }))

          return { suggestions }
        },
      })
    }

    // Add gutter click listener for breakpoints
    if (onBreakpointToggle) {
      editor.onMouseDown((e) => {
        const target = e.target
        if (target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
          const line = target.position?.lineNumber
          if (line) {
            onBreakpointToggle(line)
          }
        }
      })
    }

    // Add validation on change
    if (onValidate) {
      editor.onDidChangeModelContent(() => {
        const model = editor.getModel()
        if (model) {
          const markers = monaco.editor.getModelMarkers({ resource: model.uri })
          onValidate(markers)
        }
      })
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

