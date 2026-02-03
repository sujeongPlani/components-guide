import { useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { html as htmlLang } from '@codemirror/lang-html'
import { css as cssLang } from '@codemirror/lang-css'
import { javascript as jsLang } from '@codemirror/lang-javascript'

type Tab = 'html' | 'css' | 'js'

interface CodeEditorTabsProps {
  html: string
  css: string
  js: string
  onHtmlChange: (v: string) => void
  onCssChange: (v: string) => void
  onJsChange: (v: string) => void
}

const tabs: { id: Tab; label: string }[] = [
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'js', label: 'JS' },
]

export function CodeEditorTabs({
  html,
  css,
  js,
  onHtmlChange,
  onCssChange,
  onJsChange,
}: CodeEditorTabsProps) {
  const [active, setActive] = useState<Tab>('html')

  const value = active === 'html' ? html : active === 'css' ? css : js
  const onChange = active === 'html' ? onHtmlChange : active === 'css' ? onCssChange : onJsChange
  const extensions =
    active === 'html'
      ? [htmlLang()]
      : active === 'css'
        ? [cssLang()]
        : [jsLang({ jsx: false })]

  return (
    <div className="lg-code-tabs-wrap">
      <div className="lg-code-tabs-bar">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActive(id)}
            className={`lg-code-tab ${active === id ? 'lg-code-tab--active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="lg-code-tab-panel">
        <CodeMirror
          value={value}
          height="100%"
          extensions={extensions}
          onChange={onChange}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: true,
            indentOnInput: true,
            bracketMatching: true,
          }}
          style={{ height: '100%' }}
        />
      </div>
    </div>
  )
}
