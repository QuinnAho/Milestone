export type PromptAction = 'continue' | 'feature' | 'qa' | 'master'

interface PromptWorkspaceProps {
  activeAction: PromptAction | null
  onSelect: (action: PromptAction) => void
}

const promptOptions: { key: PromptAction; title: string; description: string }[] = [
  {
    key: 'continue',
    title: 'Continue Development',
    description: 'Reload the rules + checklist context to resume active work with a copy-ready prompt.'
  },
  {
    key: 'feature',
    title: 'New Feature / Module',
    description: 'Draft a deterministic feature request prompt that merges the base template with your outline.'
  },
  {
    key: 'qa',
    title: 'QA Pass',
    description: 'Guide QA/UAT efforts by generating a validation prompt scoped to the areas you list.'
  },
  {
    key: 'master',
    title: 'Prompt Template (Master)',
    description: 'Adjust the base template that downstream prompts (feature/QA/continue) copy from.'
  }
]

function PromptWorkspace({ activeAction, onSelect }: PromptWorkspaceProps) {
  return (
    <div className="panel prompt-workspace">
      <div className="panel-header">
        <h3>Prompt Workspace</h3>
        <p className="prompt-workspace-subtitle">Select an action to open the prompt canvas.</p>
      </div>
      <div className="prompt-action-list">
        {promptOptions.map((option) => (
          <button
            key={option.key}
            className={`prompt-action ${activeAction === option.key ? 'is-active' : ''}`}
            type="button"
            onClick={() => onSelect(option.key)}
          >
            <div>
              <strong>{option.title}</strong>
              <p>{option.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default PromptWorkspace
