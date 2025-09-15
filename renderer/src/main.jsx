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
  const [isLoading, setIsLoading] = useState(false);
  const [milestoneName, setMilestoneName] = useState('');
  const [milestoneDescription, setMilestoneDescription] = useState('');
  const [availableMilestones, setAvailableMilestones] = useState([]);
  const [selectedMilestone, setSelectedMilestone] = useState('');

  const init = async () => {
    if (!repo) {
      alert('Please select a repository folder first.');
      return;
    }
    setIsLoading(true);
    try {
      await window.aidash.initRepo(repo);
      await refresh();
    } catch (error) {
      console.error('Failed to initialize repository:', error);
      alert('Failed to initialize repository. Please check the path and try again.');
    } finally {
      setIsLoading(false);
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

        // Automatically refresh after selecting folder
        setIsLoading(true);
        try {
          await refresh(selectedPath);
        } catch (error) {
          console.error('Failed to refresh repository data:', error);
          // Don't show alert for refresh errors as the repo might not be initialized yet
        } finally {
          setIsLoading(false);
        }
      } else {
        console.log('No folder selected');
      }
    } catch (error) {
      console.error('Error opening folder dialog:', error);
      alert('Error opening folder dialog: ' + error.message);
    }
  };
  const refresh = async (repoPath = repo) => {
    if (!repoPath) return;
    const s = await window.aidash.getStatus(repoPath);
    const b = await window.aidash.getBoard(repoPath);
    setStatus(s); setBoard(b);

    // Also load available milestones
    try {
      const milestones = await window.aidash.getAvailableMilestones(repoPath);
      setAvailableMilestones(milestones || []);
    } catch (error) {
      console.error('Failed to load milestones:', error);
    }
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
      const prompt = `TASK IMPLEMENTATION REQUEST

# Task Details
ID: ${task.id}
Title: ${task.title}
Description: ${task.description || 'No description provided'}
Status: ${task.status}

# Implementation Instructions

## 1. FIRST - Review Task Documentation
Read these files in the task directory ai/tasks/${task.id}/:
- README.md - Task overview and requirements
- spec.yaml - Technical specifications and acceptance criteria
- whitelist.txt - Files you are allowed to modify (if any)
- progress.ndjson - Previous implementation attempts and history

## 2. ANALYZE THE CODEBASE
Before making any changes:
- Understand the existing project structure
- Identify related files and dependencies
- Review similar implementations in the codebase
- Check for existing patterns and conventions

## 3. IMPLEMENT THE SOLUTION
- Follow the project's coding standards and architecture
- Make focused, minimal changes that achieve the task requirements
- Ensure backward compatibility unless specifically requested otherwise
- Add appropriate error handling and validation
- Include relevant comments for complex logic

## 4. TESTING & VALIDATION
- Test your implementation thoroughly
- Verify the solution meets all acceptance criteria
- Check for edge cases and error scenarios
- Ensure no existing functionality is broken

## 5. DOCUMENTATION
- Update relevant documentation if needed
- Add comments explaining complex implementation details
- Update the task's README.md with implementation notes

# IMPORTANT CONSTRAINTS
- Only modify files that are necessary for this specific task
- Do not refactor unrelated code unless explicitly requested
- Follow the existing code style and patterns
- If you encounter issues, document them in the task directory

BEGIN IMPLEMENTATION NOW.`;

      addTerminalOutput(`[AI] Starting implementation for task: ${task.title}`, 'info');

      // Add approval request and wait for user decision
      const approvalId = Date.now();
      const approvalPromise = new Promise((resolve) => {
        const approval = {
          id: approvalId,
          message: `AI wants to implement changes for task: ${task.title}`,
          type: 'file_change',
          resolve: resolve,
          task: task,
          prompt: prompt
        };
        setPendingApprovals(prev => [...prev, approval]);
      });

      // Wait for approval decision
      const approved = await approvalPromise;

      if (!approved) {
        addTerminalOutput(`[REJECTED] Implementation cancelled by user`, 'warning');
        return;
      }

      addTerminalOutput(`[APPROVED] Action approved`, 'success');

      const res = await window.aidash.runProviderStreaming(repo, {
        taskIdPath: task.id,
        provider: aiProvider,
        prompt: prompt,
        dry: false
      });

      addTerminalOutput(`## Task Implementation Complete`, 'success');
      addTerminalOutput(`I have successfully implemented ${task.id}. Here's what was accomplished:`, 'info');
      addTerminalOutput(`**✅ Task Completed**: ${task.title}`, 'success');

      if (res.changed && res.changed.length > 0) {
        addTerminalOutput(`**📍 Files Modified**: ${res.changed.join(', ')}`, 'info');
      }
      if (res.blocked && res.blocked.length > 0) {
        addTerminalOutput(`**🚫 Files Blocked**: ${res.blocked.join(', ')} (check whitelist.txt)`, 'warning');
      }

      addTerminalOutput(`**🔍 Validation**: Task requirements met and implementation completed`, 'success');
      setLog(JSON.stringify(res, null, 2));
      await refresh();
    } catch (error) {
      console.error('Failed to send to AI:', error);
      addTerminalOutput(`[ERROR] AI implementation failed: ${error.message}`, 'error');
      alert('Failed to send to AI: ' + error.message);
    }
  };

  const aiReview = async (task) => {
    try {
      const prompt = `TASK REVIEW & VALIDATION REQUEST

# Task Details
ID: ${task.id}
Title: ${task.title}
Description: ${task.description || 'No description provided'}
Status: ${task.status}

# Review Instructions

## 1. FIRST - Review Task Documentation
Check these files in ai/tasks/${task.id}/:
- README.md - Original requirements and any implementation notes
- spec.yaml - Technical specifications and acceptance criteria
- progress.ndjson - Implementation history and previous attempts
- whitelist.txt - Files that should have been modified

## 2. VERIFY IMPLEMENTATION COMPLETENESS
- Compare implementation against original task description
- Check that all acceptance criteria from spec.yaml are met
- Verify all required functionality is working
- Ensure no requirements were missed or partially implemented

## 3. CODE QUALITY REVIEW
- Check code follows project standards and patterns
- Verify proper error handling and edge cases
- Ensure code is maintainable and well-commented
- Look for potential bugs or security issues
- Validate performance considerations

## 4. TESTING & VALIDATION
- Run any existing tests to ensure nothing is broken
- Test the new functionality thoroughly
- Verify edge cases and error scenarios
- Check integration with existing features
- Validate user experience if applicable

## 5. DOCUMENTATION REVIEW
- Ensure implementation is properly documented
- Check that README.md has been updated with implementation details
- Verify code comments explain complex logic
- Update any relevant project documentation

## 6. FINAL ASSESSMENT
Provide a comprehensive summary including:
- What was implemented and how
- Whether all requirements are fully met
- Any issues found and fixes applied
- Recommendations for improvement
- Overall assessment: PASS/FAIL with reasoning

If any issues are found, fix them immediately. If the implementation is incomplete, continue the work to completion.

BEGIN REVIEW NOW.`;

      addTerminalOutput(`[REVIEW] Starting AI review for task: ${task.title}`, 'info');

      // Add approval request and wait for user decision
      const approvalId = Date.now();
      const approvalPromise = new Promise((resolve) => {
        const approval = {
          id: approvalId,
          message: `AI wants to run review commands for task: ${task.title}`,
          type: 'command_execution',
          resolve: resolve,
          task: task,
          prompt: prompt
        };
        setPendingApprovals(prev => [...prev, approval]);
      });

      // Wait for approval decision
      const approved = await approvalPromise;

      if (!approved) {
        addTerminalOutput(`[REJECTED] Review cancelled by user`, 'warning');
        return;
      }

      addTerminalOutput(`[APPROVED] Action approved`, 'success');

      const res = await window.aidash.runProviderStreaming(repo, {
        taskIdPath: task.id,
        provider: aiProvider,
        prompt: prompt,
        dry: false
      });

      addTerminalOutput(`[SUCCESS] AI review completed for task: ${task.title}`, 'success');
      if (res.changed && res.changed.length > 0) {
        addTerminalOutput(`[FILES] Changed during review: ${res.changed.join(', ')}`, 'info');
      }
      setLog(JSON.stringify(res, null, 2));
      await refresh();
    } catch (error) {
      console.error('Failed to run AI review:', error);
      addTerminalOutput(`[ERROR] AI review failed: ${error.message}`, 'error');
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
    setPendingApprovals(prev => {
      const approval = prev.find(a => a.id === approvalId);
      if (approval && approval.resolve) {
        approval.resolve(approved);
      }
      return prev.filter(a => a.id !== approvalId);
    });
    addTerminalOutput(`[${approved ? 'APPROVED' : 'REJECTED'}] Action ${approved ? 'approved' : 'rejected'}`, approved ? 'success' : 'warning');
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

  const packMilestone = async () => {
    if (!repo) {
      alert('Please select a repository first.');
      return;
    }

    if (!milestoneName.trim()) {
      alert('Please enter a milestone name.');
      return;
    }

    const doneTasks = board.columns['Done'] || [];
    if (doneTasks.length === 0) {
      alert('No completed tasks to pack into milestone.');
      return;
    }

    setIsLoading(true);
    addTerminalOutput(`[MILESTONE] Starting packing: ${milestoneName}`, 'info');

    try {
      const res = await window.aidash.packMilestone(repo, {
        name: milestoneName,
        description: milestoneDescription,
        tasks: doneTasks,
        provider: aiProvider
      });

      addTerminalOutput(`[SUCCESS] Milestone "${milestoneName}" packed successfully`, 'success');
      addTerminalOutput(`[FILES] Tasks moved to: ai/milestones/${milestoneName}`, 'info');
      if (res.documentationGenerated) {
        addTerminalOutput(`[DOCS] Documentation generated`, 'info');
      }

      setMilestoneName('');
      setMilestoneDescription('');
      await refresh();
      await loadAvailableMilestones();
    } catch (error) {
      console.error('Failed to pack milestone:', error);
      addTerminalOutput(`[ERROR] Failed to pack milestone: ${error.message}`, 'error');
      alert('Failed to pack milestone: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvailableMilestones = async () => {
    if (!repo) return;
    try {
      const milestones = await window.aidash.getAvailableMilestones(repo);
      setAvailableMilestones(milestones || []);
    } catch (error) {
      console.error('Failed to load milestones:', error);
    }
  };

  const loadMilestone = async () => {
    if (!selectedMilestone) {
      alert('Please select a milestone to load.');
      return;
    }

    setIsLoading(true);
    addTerminalOutput(`[MILESTONE] Loading: ${selectedMilestone}`, 'info');

    try {
      const res = await window.aidash.loadMilestone(repo, selectedMilestone);
      addTerminalOutput(`[SUCCESS] Milestone "${selectedMilestone}" loaded successfully`, 'success');
      addTerminalOutput(`[STATS] ${res.tasksLoaded} tasks restored to Done column`, 'info');

      await refresh();
      setSelectedMilestone('');
    } catch (error) {
      console.error('Failed to load milestone:', error);
      addTerminalOutput(`[ERROR] Failed to load milestone: ${error.message}`, 'error');
      alert('Failed to load milestone: ' + error.message);
    } finally {
      setIsLoading(false);
    }
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
            <div className="theme-icon moon-icon">
              <span className="icon-moon"></span>
            </div>
            <div className="theme-icon sun-icon">
              <span className="icon-sun"></span>
            </div>
          </div>
        </div>
      </button>

      <header className="mb-4">
        <div className="card">
          <div className="flex gap-2 items-center mb-3">
            <input
              placeholder="Repository path or click Browse to select folder"
              value={repo}
              onChange={e=>setRepo(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && repo.trim()) {
                  init();
                }
              }}
              style={{ flex: 1 }}
              disabled={isLoading}
            />
            {isLoading && (
              <div className="loading-spinner" title="Loading...">
                <div className="spinner"></div>
              </div>
            )}
            <button
              onClick={() => {
                console.log('Browse button clicked - event handler');
                browseFolder();
              }}
              className="button-secondary"
              disabled={isLoading}
            >
              Browse
            </button>
            <button onClick={init} disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Initialize'}
            </button>
            <button onClick={refresh} className="button-secondary" disabled={isLoading}>Refresh</button>
          </div>
          <div className="flex gap-2 items-center">
            <label htmlFor="ai-provider" className="ai-provider-label">AI Provider:</label>
            <select
              id="ai-provider"
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value)}
              className="ai-provider-dropdown-integrated"
            >
              <option value="claude">Claude</option>
              <option value="codex">Codex</option>
            </select>
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
                    {col === 'Done' && (board.columns?.['Done']?.length > 0 || availableMilestones.length > 0) && (
                      <div className="milestone-controls mb-3">
                        {board.columns?.['Done']?.length > 0 && (
                          <div className="pack-milestone-section">
                            <input
                              type="text"
                              placeholder="Milestone name (e.g., v1.0-auth-system)"
                              value={milestoneName}
                              onChange={(e) => setMilestoneName(e.target.value)}
                              className="milestone-input"
                              disabled={isLoading}
                            />
                            <textarea
                              placeholder="Milestone description (optional - helps AI generate better documentation)"
                              value={milestoneDescription}
                              onChange={(e) => setMilestoneDescription(e.target.value)}
                              className="milestone-description"
                              rows={2}
                              disabled={isLoading}
                            />
                            <button
                              onClick={packMilestone}
                              className="pack-milestone-btn"
                              disabled={isLoading || !milestoneName.trim()}
                              title="Pack all done tasks into milestone"
                            >
                              <span className="icon-archive"></span>
                              Pack Milestone
                            </button>
                          </div>
                        )}
                        {availableMilestones.length > 0 && (
                          <div className="load-milestone-section">
                            <select
                              value={selectedMilestone}
                              onChange={(e) => setSelectedMilestone(e.target.value)}
                              className="milestone-select"
                              disabled={isLoading}
                            >
                              <option value="">Select milestone to load</option>
                              {availableMilestones.map(milestone => (
                                <option key={milestone} value={milestone}>{milestone}</option>
                              ))}
                            </select>
                            <button
                              onClick={loadMilestone}
                              className="load-milestone-btn"
                              disabled={isLoading || !selectedMilestone}
                              title="Load milestone tasks back to Done column"
                            >
                              <span className="icon-folder-open"></span>
                              Load
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    <div>
                      {(board.columns?.[col]||[]).map(t => (
                        <div key={t.id} className="task-item">
                          <div className="task-id">{t.id}</div>
                          <div className="task-title">{t.title}</div>
                          {t.description && (
                            <div className="task-description">{t.description}</div>
                          )}
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
                                <span className="icon-cpu"></span>
                              </button>
                            )}
                            {col === 'Review' && (
                              <button
                                className="task-btn task-btn-review"
                                onClick={() => aiReview(t)}
                                title="AI Review"
                              >
                                <span className="icon-search"></span>
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
            <span className="icon-terminal"></span>
            <span>Terminal</span>
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

