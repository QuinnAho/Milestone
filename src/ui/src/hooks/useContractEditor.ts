import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'

export function useContractEditor() {
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    axios
      .get('/api/contracts/current')
      .then((response) => setContent(response.data.content ?? ''))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load contract'))
  }, [])

  const mutation = useMutation({
    mutationFn: async (value: string) => {
      validateMachineSummary(value)
      await axios.post('/api/contracts/regenerate', { content: value })
    },
    onSuccess: () => {
      setError(null)
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to save contract')
    }
  })

  const save = () => {
    mutation.mutate(content)
  }

  return {
    content,
    setContent,
    save,
    isSaving: mutation.isPending,
    error
  }
}

function validateMachineSummary(text: string) {
  const lines = text.split(/\r?\n/)
  const jsonLine = lines.find((line) => line.trim().startsWith('{'))
  if (!jsonLine) {
    throw new Error('Machine Summary Block JSON is required at the top of the file.')
  }
  JSON.parse(jsonLine)
}
