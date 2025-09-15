"use client";
import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_AIDASH_API || 'http://localhost:4000/api';

export default function Runs() {
  const [path, setPath] = useState('');
  const [task, setTask] = useState('');
  const [provider, setProvider] = useState('claude');
  const [prompt, setPrompt] = useState('');
  const [dry, setDry] = useState(true);
  const [result, setResult] = useState(null);

  const doRun = async () => {
    const r = await fetch(`${API}/run`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ path, taskIdPath: task, provider, prompt, dry }) });
    const j = await r.json();
    setResult(j);
  };

  return (
    <div>
      <h1>Run Prompt</h1>
      <div style={{ display: 'grid', gap: 8, maxWidth: 800 }}>
        <input placeholder="Local repo path" value={path} onChange={(e)=>setPath(e.target.value)} />
        <input placeholder="Task IdPath (e.g., FEAT-0001/PR1)" value={task} onChange={(e)=>setTask(e.target.value)} />
        <div>
          <label>Provider: </label>
          <select value={provider} onChange={(e)=>setProvider(e.target.value)}>
            <option value="claude">Claude (Anthropic)</option>
            <option value="openai">OpenAI</option>
          </select>
          <label style={{ marginLeft: 12 }}>
            <input type="checkbox" checked={dry} onChange={(e)=>setDry(e.target.checked)} /> Dry run
          </label>
        </div>
        <textarea placeholder="Prompt" value={prompt} onChange={(e)=>setPrompt(e.target.value)} rows={8} />
        <button onClick={doRun}>Run</button>
      </div>
      {result && (
        <div style={{ marginTop: 16 }}>
          <h3>Result</h3>
          <pre style={{ background: '#f5f5f5', padding: 10 }}>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

