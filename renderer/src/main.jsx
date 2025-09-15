import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/theme.css';

function CircularProgress({ percentage, status }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getStatusClass = () => {
    if (percentage >= 80) return 'success';
    if (percentage >= 50) return 'warning';
    return 'danger';
  };

  return (
    <div className="progress-circle">
      <svg>
        <circle
          className="circle-bg"
          cx="30"
          cy="30"
          r={radius}
        />
        <circle
          className={`circle-progress ${getStatusClass()}`}
          cx="30"
          cy="30"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <div className="progress-text">{percentage}%</div>
    </div>
  );
}

function Home() {
  const [repo, setRepo] = useState('');
  const [status, setStatus] = useState(null);
  const [board, setBoard] = useState(null);
  const [taskId, setTaskId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [log, setLog] = useState('');
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [isTerminalExpanded, setIsTerminalExpanded] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [aiProvider, setAiProvider] = useState('claude');

  const init = async () => {
    if (!repo) {
      alert('Please select a repository folder first.');
      return;
    }
    try {
      await window.aidash.initRepo(repo);
      await refresh();
    } catch (error) {
      console.error('Failed to initialize repository:', error);
      alert('Failed to initialize repository. Please check the path and try again.');
    }
  };

  const browseFolder = async () => {
    try {
      console.log('Browse button clicked');
      console.log('window.aidash:', window.aidash);
      console.log('Available methods:', Object.keys(window.aidash || {}));
      console.log('window.electronAPI:', window.electronAPI);
      console.log('window object keys:', Object.keys(window));

      // Wait a bit for the API to potentially load
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('After wait - window.aidash:', window.aidash);

      if (!window.aidash) {
        alert('Electron API not available. Please restart the application.');
        return;
      }

      if (!window.aidash.openFolder) {
        alert('Folder picker not available. Please type the path manually or restart the application.');
        return;
      }

      const selectedPath = await window.aidash.openFolder();
      console.log('Selected path:', selectedPath);
      if (selectedPath) {
        setRepo(selectedPath);
        console.log('Repository path set to:', selectedPath);
      } else {
        console.log('No folder selected');
      }
    } catch (error) {
      console.error('Error opening folder dialog:', error);
      alert('Error opening folder dialog: ' + error.message);
    }
  };
  const refresh = async () => {
    if (!repo) return;
    const s = await window.aidash.getStatus(repo);
    const b = await window.aidash.getBoard(repo);
    setStatus(s); setBoard(b);
  };
  const create = async () => {
    await window.aidash.createTask(repo, { id: taskId, title, description });
    setTaskId(''); setTitle(''); setDescription('');
    await refresh();
  };
  const qa = async () => {
    const res = await window.aidash.runQA(repo, ['build','test','lint']);
    setLog(JSON.stringify(res, null, 2));
    await refresh();
  };

  const moveTask = async (taskId, newStatus) => {
    try {
      // Optimistically update the UI first
      if (board && board.columns) {
        const updatedBoard = { ...board };
        const updatedColumns = { ...updatedBoard.columns };

        // Find and remove the task from its current column
        let taskToMove = null;
        for (const [columnName, tasks] of Object.entries(updatedColumns)) {
          const taskIndex = tasks.findIndex(t => t.id === taskId);
          if (taskIndex !== -1) {
            taskToMove = tasks[taskIndex];
            updatedColumns[columnName] = tasks.filter(t => t.id !== taskId);
            break;
          }
        }

        // Add the task to the new column with updated status
        if (taskToMove) {
          taskToMove.status = newStatus;
          if (!updatedColumns[newStatus]) updatedColumns[newStatus] = [];
          updatedColumns[newStatus].push(taskToMove);

          // Update the board state immediately
          updatedBoard.columns = updatedColumns;
          setBoard(updatedBoard);
        }
      }

      // Then make the API call
      await window.aidash.changeTaskStatus(repo, taskId, newStatus);

      // Refresh to ensure consistency (this will overwrite our optimistic update with server state)
      await refresh();
    } catch (error) {
      console.error('Failed to move task:', error);
      alert('Failed to move task: ' + error.message);
      // Refresh to revert the optimistic update
      await refresh();
    }
  };

  const getNextStatus = (currentStatus) => {
    const statusFlow = ['Backlog', 'In Progress', 'Review', 'Done'];
    const currentIndex = statusFlow.indexOf(currentStatus);
    return currentIndex < statusFlow.length - 1 ? statusFlow[currentIndex + 1] : null;
  };

  const getPrevStatus = (currentStatus) => {
    const statusFlow = ['Backlog', 'In Progress', 'Review', 'Done'];
    const currentIndex = statusFlow.indexOf(currentStatus);
    return currentIndex > 0 ? statusFlow[currentIndex - 1] : null;
  };

  const sendToAI = async (task) => {
    try {
      const prompt = `Task: ${task.title}
Description: ${task.description}

Please implement this task. Look at the current codebase structure and implement the requested changes. Focus on:
- Understanding the existing code patterns
- Following the current architecture
- Making clean, maintainable changes
- Ensuring compatibility with existing functionality`;

      addTerminalOutput(`🤖 Starting AI implementation for task: ${task.title}`, 'info');

      // Add approval for file changes
      const approvalId = Date.now();
      setPendingApprovals(prev => [...prev, {
        id: approvalId,
        message: `AI wants to implement changes for task: ${task.title}`,
        type: 'file_change'
      }]);

      const res = await window.aidash.runProviderStreaming(repo, {
        taskIdPath: task.id,
        provider: aiProvider,
        prompt: prompt,
        dry: false
      });

      addTerminalOutput(`✅ AI implementation completed for task: ${task.title}`, 'success');
      if (res.changed && res.changed.length > 0) {
        addTerminalOutput(`📁 Files changed: ${res.changed.join(', ')}`, 'info');
      }
      if (res.blocked && res.blocked.length > 0) {
        addTerminalOutput(`🚫 Files blocked: ${res.blocked.join(', ')}`, 'warning');
      }
      setLog(JSON.stringify(res, null, 2));
      await refresh();
    } catch (error) {
      console.error('Failed to send to AI:', error);
      addTerminalOutput(`❌ AI implementation failed: ${error.message}`, 'error');
      alert('Failed to send to AI: ' + error.message);
    }
  };

  const aiReview = async (task) => {
    try {
      const prompt = `Task: ${task.title}
Description: ${task.description}

Please review the implementation of this task. Check:
- Ensure the feature is fully implemented according to the description
- Run any available tests to verify functionality
- Check for code quality and best practices
- Verify the implementation works as expected
- Make any necessary fixes or improvements

Provide a summary of what was implemented and whether it meets the requirements.`;

      addTerminalOutput(`🔍 Starting AI review for task: ${task.title}`, 'info');

      // Add approval for running review commands
      const approvalId = Date.now();
      setPendingApprovals(prev => [...prev, {
        id: approvalId,
        message: `AI wants to run review commands for task: ${task.title}`,
        type: 'command_execution'
      }]);

      const res = await window.aidash.runProviderStreaming(repo, {
        taskIdPath: task.id,
        provider: aiProvider,
        prompt: prompt,
        dry: false
      });

      addTerminalOutput(`✅ AI review completed for task: ${task.title}`, 'success');
      if (res.changed && res.changed.length > 0) {
        addTerminalOutput(`📁 Files changed during review: ${res.changed.join(', ')}`, 'info');
      }
      setLog(JSON.stringify(res, null, 2));
      await refresh();
    } catch (error) {
      console.error('Failed to run AI review:', error);
      addTerminalOutput(`❌ AI review failed: ${error.message}`, 'error');
      alert('Failed to run AI review: ' + error.message);
    }
  };

  const addTerminalOutput = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const newEntry = {
      id: Date.now(),
      timestamp,
      message,
      type
    };
    setTerminalOutput(prev => [...prev, newEntry]);
    if (!isTerminalExpanded) {
      setIsTerminalExpanded(true);
    }
  };

  const clearTerminal = () => {
    setTerminalOutput([]);
  };

  const approveAction = (approvalId, approved) => {
    setPendingApprovals(prev => prev.filter(a => a.id !== approvalId));
    addTerminalOutput(`${approved ? '✅ Approved' : '❌ Rejected'} action`, approved ? 'success' : 'warning');
  };

  const toggleTheme = () => {
    setIsDarkTheme(!isDarkTheme);
    document.body.setAttribute('data-theme', !isDarkTheme ? 'dark' : 'light');
  };

  useEffect(() => {
    document.body.setAttribute('data-theme', isDarkTheme ? 'dark' : 'light');

    // Set up AI output listener
    const handleAIOutput = (output) => {
      const timestamp = new Date().toLocaleTimeString();
      const newEntry = {
        id: Date.now() + Math.random(),
        timestamp,
        message: output.data.trim(),
        type: output.type === 'stderr' ? 'error' : 'info'
      };
      setTerminalOutput(prev => [...prev, newEntry]);
      if (!isTerminalExpanded) {
        setIsTerminalExpanded(true);
      }
    };

    if (window.aidash && window.aidash.onAIOutput) {
      window.aidash.onAIOutput(handleAIOutput);
    }

    return () => {
      if (window.aidash && window.aidash.removeAIOutputListener) {
        window.aidash.removeAIOutputListener(handleAIOutput);
      }
    };
  }, [isTerminalExpanded]);

  const calculateCompletionPercentage = () => {
    if (!board || !board.columns) return 0;

    const allTasks = Object.values(board.columns).flat();
    const totalTasks = allTasks.length;

    if (totalTasks === 0) return 100;

    const doneTasks = (board.columns['Done'] || []).length;
    const reviewTasks = (board.columns['Review'] || []).length;

    // Consider Review tasks as 50% complete
    const completionScore = doneTasks + (reviewTasks * 0.5);
    return Math.round((completionScore / totalTasks) * 100);
  };

  return (
    <div className="p-4" style={{ minHeight: '100vh' }}>
      <button
        className="theme-toggle"
        onClick={toggleTheme}
        title={`Switch to ${isDarkTheme ? 'light' : 'dark'} theme`}
      >
        <div className="theme-icon-container">
          <div className={`theme-icon-scroll ${isDarkTheme ? 'dark' : 'light'}`}>
            <div className="theme-icon moon-icon">🌙</div>
            <div className="theme-icon sun-icon">☀️</div>
          </div>
        </div>
      </button>

      <div className="ai-provider-selector">
        <label htmlFor="ai-provider">AI Provider:</label>
        <select
          id="ai-provider"
          value={aiProvider}
          onChange={(e) => setAiProvider(e.target.value)}
          className="ai-provider-dropdown"
        >
          <option value="claude">Claude</option>
          <option value="codex">Codex</option>
          <option value="openai">OpenAI</option>
        </select>
      </div>

      <header className="mb-4">
        <h1 className="mb-3">AI Task Dashboard</h1>
        <div className="card">
          <div className="flex gap-2 items-center">
            <input
              placeholder="Repository path or click Browse to select folder"
              value={repo}
              onChange={e=>setRepo(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              onClick={() => {
                console.log('Browse button clicked - event handler');
                browseFolder();
              }}
              className="button-secondary"
            >
              Browse
            </button>
            <button onClick={init}>Initialize</button>
            <button onClick={refresh} className="button-secondary">Refresh</button>
          </div>
          {status && (
            <div className="mt-3 flex items-center">
              <CircularProgress
                percentage={calculateCompletionPercentage()}
                status={status.overall}
              />
              <div className="flex flex-column">
                <div className="flex items-center">
                  <span className={`status-indicator ${
                    status.overall === 'good' ? 'status-success' :
                    status.overall === 'warning' ? 'status-warning' : 'status-danger'
                  }`}></span>
                  <strong>Status:</strong> <span className="ml-2">{status.overall}</span>
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                  {status.explain}
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <div className="card-header">
            <h3 className="m-0">Task Management</h3>
          </div>

          <div className="mb-4">
            <h4 className="mb-2" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600 }}>CREATE NEW TASK</h4>
            <div className="flex gap-2 items-center mb-2">
              <input
                placeholder="Task ID (e.g., FEAT-0001)"
                value={taskId}
                onChange={e=>setTaskId(e.target.value)}
                style={{ width: 180 }}
              />
              <input
                placeholder="Task title"
                value={title}
                onChange={e=>setTitle(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>
            <div className="flex gap-2 items-center">
              <textarea
                rows={3}
                placeholder="Task description - this will be used as the prompt for Claude/OpenAI to implement the task..."
                value={description}
                onChange={e=>setDescription(e.target.value)}
                style={{ flex: 1, resize: 'vertical' }}
              />
              <button onClick={create}>Add Task</button>
            </div>
          </div>

          {board && (
            <div>
              <h4 className="mb-3" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600 }}>KANBAN BOARD</h4>
              <div className="grid grid-cols-4 gap-3">
                {['Backlog','In Progress','Review','Done'].map(col => (
                  <div key={col} className="board-column">
                    <h4>{col}</h4>
                    <div>
                      {(board.columns?.[col]||[]).map(t => (
                        <div key={t.id} className="task-item">
                          <div className="task-id">{t.id}</div>
                          <div className="task-title">{t.title}</div>
                          <div className="task-actions">
                            {getPrevStatus(col) && (
                              <button
                                className="task-btn task-btn-back"
                                onClick={() => moveTask(t.id, getPrevStatus(col))}
                                title={`Move to ${getPrevStatus(col)}`}
                              >
                                ←
                              </button>
                            )}
                            {getNextStatus(col) && (
                              <button
                                className="task-btn task-btn-forward"
                                onClick={() => moveTask(t.id, getNextStatus(col))}
                                title={`Move to ${getNextStatus(col)}`}
                              >
                                →
                              </button>
                            )}
                            {col === 'In Progress' && (
                              <button
                                className="task-btn task-btn-ai"
                                onClick={() => sendToAI(t)}
                                title="Send to AI for implementation"
                              >
                                🤖
                              </button>
                            )}
                            {col === 'Review' && (
                              <button
                                className="task-btn task-btn-review"
                                onClick={() => aiReview(t)}
                                title="AI Review"
                              >
                                🔍
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {(!board.columns?.[col] || board.columns[col].length === 0) && (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>
                          No tasks
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="m-0">Quality Assurance</h3>
          </div>

          <div className="mb-4">
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
              Run build, test, and lint checks to ensure code quality and project health.
            </p>

            <button onClick={qa} className="button-secondary">Run QA Checks</button>
          </div>

          {log && (
            <div>
              <h4 className="mb-2" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600 }}>QA RESULTS</h4>
              <pre className="terminal" style={{ maxHeight: 300, overflow: 'auto' }}>{log}</pre>
            </div>
          )}
        </div>
      </div>

      {/* Terminal/Shell Interface */}
      <div className={`terminal-container ${isTerminalExpanded ? 'expanded' : 'collapsed'}`}>
        <div className="terminal-header" onClick={() => setIsTerminalExpanded(!isTerminalExpanded)}>
          <div className="terminal-title">
            <span>🖥️ AI Terminal</span>
            <span className="terminal-badge">{terminalOutput.length}</span>
          </div>
          <div className="terminal-controls">
            <button onClick={(e) => { e.stopPropagation(); clearTerminal(); }} className="terminal-btn">Clear</button>
            <button className="terminal-btn">{isTerminalExpanded ? '▼' : '▲'}</button>
          </div>
        </div>

        {isTerminalExpanded && (
          <div className="terminal-content">
            <div className="terminal-output">
              {terminalOutput.length === 0 ? (
                <div className="terminal-empty">Terminal ready - AI output will appear here...</div>
              ) : (
                terminalOutput.map(entry => (
                  <div key={entry.id} className={`terminal-line terminal-${entry.type}`}>
                    <span className="terminal-timestamp">[{entry.timestamp}]</span>
                    <span className="terminal-message">{entry.message}</span>
                  </div>
                ))
              )}
            </div>

            {pendingApprovals.length > 0 && (
              <div className="terminal-approvals">
                <div className="approval-header">Pending Approvals:</div>
                {pendingApprovals.map(approval => (
                  <div key={approval.id} className="approval-item">
                    <span className="approval-message">{approval.message}</span>
                    <div className="approval-buttons">
                      <button
                        onClick={() => approveAction(approval.id, true)}
                        className="approval-btn approve"
                      >
                        ✅ Approve
                      </button>
                      <button
                        onClick={() => approveAction(approval.id, false)}
                        className="approval-btn reject"
                      >
                        ❌ Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Home />);

