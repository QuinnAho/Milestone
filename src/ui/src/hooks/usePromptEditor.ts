import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import axios from 'axios'

interface PromptForm {
  id: string
  description: string
  body: string
  summaryFile: string
  summaryPurpose: string
}

const EMPTY_FORM: PromptForm = {
  id: '',
  description: '',
  body: '',
  summaryFile: 'ai/templates/prompt_template.json',
  summaryPurpose: ''
}

interface BlueprintPlaceholder {
  name: string
  description: string
  required?: boolean
  example?: string
  default?: string
}

export interface PromptBlueprintSummary {
  blueprint_id: string
  description: string
  agent?: string
  placeholders: BlueprintPlaceholder[]
}

export function usePromptEditor() {
  const [form, setForm] = useState<PromptForm>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    axios
      .get('/api/contracts/prompts')
      .then((response) => {
        const data = response.data
        setForm({
          id: data.id ?? '',
          description: data.description ?? '',
          body: data.body ?? '',
          summaryFile: data.summary?.file ?? 'ai/templates/prompt_template.json',
          summaryPurpose: data.summary?.purpose ?? ''
        })
      })
      .catch(() => {
        // Allow empty defaults
      })
  }, [])

  const blueprintQuery = useQuery<PromptBlueprintSummary[]>({
    queryKey: ['prompt-blueprints'],
    queryFn: async () => {
      const response = await axios.get<{ blueprints: PromptBlueprintSummary[] }>('/api/prompts/blueprints')
      return response.data.blueprints
    }
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.id || !form.description || !form.body) {
        throw new Error('Prompt ID, description, and body are required.')
      }
      try {
        JSON.parse(form.body)
      } catch {
        throw new Error('Prompt body must be valid JSON.')
      }
      await axios.post('/api/contracts/prompts', {
        id: form.id,
        description: form.description,
        body: form.body,
        summary: {
          file: form.summaryFile,
          purpose: form.summaryPurpose || 'Prompt template for local editor.'
        }
      })
    },
    onSuccess: () => setError(null),
    onError: (err: unknown) => setError(err instanceof Error ? err.message : 'Failed to save prompt')
  })

  const generateMutation = useMutation({
    mutationFn: async (payload: { blueprintId: string; variables: Record<string, string> }) => {
      const response = await axios.post('/api/prompts/generate', {
        blueprintId: payload.blueprintId,
        variables: payload.variables,
        persist: false
      })
      return response.data.prompt
    },
    onSuccess: (prompt) => {
      setForm((prev) => ({
        ...prev,
        id: prompt.id ?? prev.id,
        description: prompt.description ?? prev.description,
        body: prompt.body ?? prev.body,
        summaryFile: prompt.summary?.file ?? prev.summaryFile,
        summaryPurpose: prompt.summary?.purpose ?? prev.summaryPurpose
      }))
      setError(null)
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : 'Failed to generate prompt')
  })

  const updateField = (field: keyof PromptForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const blueprints = useMemo(() => blueprintQuery.data ?? [], [blueprintQuery.data])

  return {
    form,
    updateField,
    save: () => saveMutation.mutate(),
    isSaving: saveMutation.isPending,
    blueprints,
    isLoadingBlueprints: blueprintQuery.isLoading,
    generateFromBlueprint: (blueprintId: string, variables: Record<string, string>) =>
      generateMutation.mutate({ blueprintId, variables }),
    isGenerating: generateMutation.isPending,
    error
  }
}
