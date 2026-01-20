import { useState } from 'react'
import { usePromptEditor } from '../hooks/usePromptEditor'
import { CONTINUE_DEVELOPMENT_TEMPLATE, NEW_FEATURE_TEMPLATE, QA_TEMPLATE } from './PromptTemplates'
import type { PromptAction } from './PromptWorkspace'

interface PromptCanvasProps {
  action: PromptAction
  onClose: () => void
}

const actionTitles: Record<PromptAction, string> = {
  continue: 'Continue Development',
  feature: 'New Feature / Module',
  qa: 'QA Pass',
  master: 'Prompt Template (Master)'
}

function PromptCanvas({ action, onClose }: PromptCanvasProps) {
  return (
    <div className="panel prompt-canvas">
      <div className="prompt-canvas-header">
        <div>
          <p className="prompt-canvas-label">Active Prompt</p>
          <h2>{actionTitles[action]}</h2>
        </div>
        <button className="secondary" type="button" onClick={onClose}>
          Back to Monitoring
        </button>
      </div>
      {action === 'continue' && <ContinueSection />}
      {action === 'feature' && <FeatureSection />}
      {action === 'qa' && <QaSection />}
      {action === 'master' && <MasterPromptSection />}
    </div>
  )
}

function ContinueSection() {
  const template = useStoredTemplate('prompt-workspace:continue', CONTINUE_DEVELOPMENT_TEMPLATE)
  const { copyPrompt, message: copyMessage } = useCopyFeedback()
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const handleSave = () => {
    template.save()
    setSaveMessage('Template saved locally.')
    setTimeout(() => setSaveMessage(null), 2500)
  }

  return (
    <section className="prompt-section">
      <p>Share this prompt with your automation agent whenever you need it to resume active development.</p>
      <textarea
        className="prompt-textarea"
        rows={20}
        value={template.value}
        onChange={(event) => template.setValue(event.target.value)}
      />
      <div className="prompt-button-row">
        <button className="primary" type="button" onClick={() => copyPrompt(template.value)}>
          Copy Prompt
        </button>
        <button className="secondary" type="button" onClick={handleSave}>
          Save Template
        </button>
        <button className="secondary" type="button" onClick={template.reset}>
          Reset to Default
        </button>
      </div>
      {(copyMessage || saveMessage) && <p className="prompt-feedback">{copyMessage ?? saveMessage}</p>}
    </section>
  )
}

function FeatureSection() {
  const template = useStoredTemplate('prompt-workspace:feature', NEW_FEATURE_TEMPLATE)
  const [details, setDetails] = useState('')
  const [output, setOutput] = useState('')
  const { copyPrompt, message: copyMessage } = useCopyFeedback()
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const handleSave = () => {
    template.save()
    setSaveMessage('Feature template saved locally.')
    setTimeout(() => setSaveMessage(null), 2500)
  }

  const generate = () => {
    const finalPrompt = renderTemplate(template.value, {
      FEATURE_DETAILS: details.trim() || '[Add feature details to this section before sending.]'
    })
    setOutput(finalPrompt)
  }

  return (
    <section className="prompt-section">
      <p>Adjust the base template, describe the feature/module, then generate a copy-ready prompt.</p>
      <textarea
        className="prompt-textarea"
        rows={10}
        value={template.value}
        onChange={(event) => template.setValue(event.target.value)}
      />
      <div className="prompt-button-row">
        <button className="secondary" type="button" onClick={handleSave}>
          Save Template
        </button>
        <button className="secondary" type="button" onClick={template.reset}>
          Reset Template
        </button>
      </div>
      <textarea
        className="prompt-textarea"
        rows={6}
        placeholder="Describe the feature, risks, files, acceptance criteria..."
        value={details}
        onChange={(event) => setDetails(event.target.value)}
      />
      <button className="primary" type="button" onClick={generate}>
        Generate Prompt
      </button>
      {output && (
        <div className="prompt-output">
          <div className="prompt-output-header">
            <strong>Generated Prompt</strong>
            <button className="secondary" type="button" onClick={() => copyPrompt(output)}>
              Copy Text
            </button>
          </div>
          <textarea className="prompt-textarea" readOnly rows={10} value={output} />
        </div>
      )}
      {(copyMessage || saveMessage) && <p className="prompt-feedback">{copyMessage ?? saveMessage}</p>}
    </section>
  )
}

function QaSection() {
  const template = useStoredTemplate('prompt-workspace:qa', QA_TEMPLATE)
  const [scope, setScope] = useState('')
  const [output, setOutput] = useState('')
  const { copyPrompt, message: copyMessage } = useCopyFeedback()
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const handleSave = () => {
    template.save()
    setSaveMessage('QA template saved locally.')
    setTimeout(() => setSaveMessage(null), 2500)
  }

  const generate = () => {
    const finalPrompt = renderTemplate(template.value, {
      QA_SCOPE: scope.trim() || '[List the areas/files to validate before running this prompt.]'
    })
    setOutput(finalPrompt)
  }

  return (
    <section className="prompt-section">
      <p>Use this to produce deterministic QA instructions with your own scope annotations.</p>
      <textarea
        className="prompt-textarea"
        rows={10}
        value={template.value}
        onChange={(event) => template.setValue(event.target.value)}
      />
      <div className="prompt-button-row">
        <button className="secondary" type="button" onClick={handleSave}>
          Save Template
        </button>
        <button className="secondary" type="button" onClick={template.reset}>
          Reset Template
        </button>
      </div>
      <textarea
        className="prompt-textarea"
        rows={6}
        placeholder="List the areas/modules/logs you want QA to cover..."
        value={scope}
        onChange={(event) => setScope(event.target.value)}
      />
      <button className="primary" type="button" onClick={generate}>
        Generate Prompt
      </button>
      {output && (
        <div className="prompt-output">
          <div className="prompt-output-header">
            <strong>Generated Prompt</strong>
            <button className="secondary" type="button" onClick={() => copyPrompt(output)}>
              Copy Text
            </button>
          </div>
          <textarea className="prompt-textarea" readOnly rows={10} value={output} />
        </div>
      )}
      {(copyMessage || saveMessage) && <p className="prompt-feedback">{copyMessage ?? saveMessage}</p>}
    </section>
  )
}

function MasterPromptSection() {
  const { form, updateField, save, isSaving, error } = usePromptEditor()
  const { copyPrompt, message: copyMessage } = useCopyFeedback()

  return (
    <section className="prompt-section">
      <p>
        Revise the canonical master prompt. This is the base template every other prompt builder copies, so keep the
        JSON valid and descriptive.
      </p>
      <div className="prompt-meta-grid">
        <input
          placeholder="Prompt ID"
          value={form.id}
          onChange={(event) => updateField('id', event.target.value)}
        />
        <input
          placeholder="Description"
          value={form.description}
          onChange={(event) => updateField('description', event.target.value)}
        />
      </div>
      <textarea
        className="prompt-textarea"
        rows={18}
        placeholder='Prompt body JSON (e.g., {"steps": []})'
        value={form.body}
        onChange={(event) => updateField('body', event.target.value)}
      />
      <div className="prompt-meta-grid">
        <input
          placeholder="Summary file"
          value={form.summaryFile}
          onChange={(event) => updateField('summaryFile', event.target.value)}
        />
        <input
          placeholder="Summary purpose"
          value={form.summaryPurpose}
          onChange={(event) => updateField('summaryPurpose', event.target.value)}
        />
      </div>
      {error && <p className="prompt-feedback error">{error}</p>}
      <div className="prompt-button-row">
        <button className="primary" type="button" onClick={() => save()} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Master Prompt'}
        </button>
        <button className="secondary" type="button" onClick={() => copyPrompt(form.body)}>
          Copy Body
        </button>
      </div>
      {copyMessage && <p className="prompt-feedback">{copyMessage}</p>}
    </section>
  )
}

function useStoredTemplate(key: string, defaultValue: string) {
  const initial = typeof window !== 'undefined' ? window.localStorage.getItem(key) ?? defaultValue : defaultValue
  const [value, setValue] = useState(initial)

  const save = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, value)
    }
  }

  const reset = () => {
    setValue(defaultValue)
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key)
    }
  }

  return { value, setValue, save, reset }
}

function useCopyFeedback() {
  const [message, setMessage] = useState<string | null>(null)

  const copyPrompt = async (text: string) => {
    if (!text.trim()) {
      setMessage('Provide content before copying.')
      setTimeout(() => setMessage(null), 2500)
      return
    }
    if (navigator?.clipboard) {
      await navigator.clipboard.writeText(text)
      setMessage('Copied to clipboard.')
      setTimeout(() => setMessage(null), 2500)
    } else {
      setMessage('Clipboard not available in this environment.')
      setTimeout(() => setMessage(null), 2500)
    }
  }

  return { copyPrompt, message }
}

function renderTemplate(template: string, values: Record<string, string>) {
  return template.replace(/{{(\w+)}}/g, (_, key) => values[key] ?? `{{${key}}}`)
}

export default PromptCanvas
