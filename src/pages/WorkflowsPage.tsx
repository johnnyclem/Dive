import React, { useEffect, useState } from 'react'

interface WorkflowStep {
  action: string
  payload: Record<string, unknown>
  timestamp: number
}

interface Workflow {
  id: string
  name: string
  description?: string
  createdAt: number
  steps: WorkflowStep[]
  parameters?: Record<string, { description?: string; type?: string }>
}

interface ExecutionStatus {
  workflowId: string
  status: 'started' | 'step_completed' | 'completed' | 'error' | 'cancelled'
  currentStep?: number
  totalSteps?: number
  message?: string
  stepAction?: string
}

const WorkflowsPage: React.FC = () => {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(false)
  const [execStatus, setExecStatus] = useState<ExecutionStatus | null>(null)
  const [paramModal, setParamModal] = useState<{
    open: boolean
    wf?: Workflow
    values: Record<string, string>
  }>({ open: false, values: {} })
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; wf?: Workflow }>({ open: false })
  const [expandedWorkflowId, setExpandedWorkflowId] = useState<string | null>(null)

  const refresh = async () => {
    setLoading(true)
    const raw = await window.electron?.ipcRenderer.invoke('WORKFLOW_LIST')
    const list = (raw as Workflow[]) ?? []
    setWorkflows(list)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
    const handler = (_e: unknown, status: ExecutionStatus) => {
      setExecStatus(status)
      // On completion/error/cancel, hide the browser view
      if (['completed', 'error', 'cancelled'].includes(status.status)) {
        window.electron?.ipcRenderer.send('BROWSER_SET_VISIBILITY', false)
      }
    }
    window.electron?.ipcRenderer.on('WORKFLOW_EXECUTION_STATUS', handler)
    return () => {
      window.electron?.ipcRenderer.off('WORKFLOW_EXECUTION_STATUS', handler)
    }
  }, [])

  const runWorkflow = (wf: Workflow) => {
    // Collapse any expanded view when running a new one
    setExpandedWorkflowId(null)
    if (wf.parameters && Object.keys(wf.parameters).length) {
      setParamModal({ open: true, wf, values: {} })
    } else {
      window.electron?.ipcRenderer.send('WORKFLOW_EXECUTE_REQUEST', wf.id)
    }
  }

  const cancelRun = () => {
    if (execStatus?.workflowId) {
      window.electron?.ipcRenderer.send('WORKFLOW_CANCEL_REQUEST', execStatus.workflowId)
    }
  }

  const submitParams = () => {
    if (!paramModal.wf) return
    window.electron?.ipcRenderer.send('WORKFLOW_EXECUTE_REQUEST', {
      workflowId: paramModal.wf.id,
      params: paramModal.values,
    })
    setParamModal({ open: false, values: {} })
  }

  const updateParam = (key: string, value: string) => {
    setParamModal(prev => ({ ...prev, values: { ...prev.values, [key]: value } }))
  }

  const deleteWorkflow = async (id: string) => {
    await window.electron?.ipcRenderer.invoke('WORKFLOW_DELETE', id)
    setConfirmDelete({ open: false })
    refresh()
  }

  const toggleExpand = (id: string) => {
    setExpandedWorkflowId(prev => (prev === id ? null : id))
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Workflows</h1>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">Name</th>
              <th className="p-2">Created</th>
              <th className="p-2">Steps</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {workflows.map(wf => (
              <React.Fragment key={wf.id}>
                <tr className="hover:bg-muted/10">
                  <td className="p-2 align-top">
                    <div className="font-medium">{wf.name}</div>
                    <div className="text-sm text-muted-foreground">{wf.description}</div>
                  </td>
                  <td className="p-2 align-top whitespace-nowrap">{new Date(wf.createdAt).toLocaleString()}</td>
                  <td className="p-2 align-top text-center">{wf.steps.length}</td>
                  <td className="p-2 space-x-1 align-top whitespace-nowrap">
                    <button onClick={() => runWorkflow(wf)} className="px-2 py-1 text-xs bg-primary text-white rounded">Run</button>
                    <button onClick={() => setConfirmDelete({ open: true, wf })} className="px-2 py-1 text-xs bg-red-600 text-white rounded">Delete</button>
                    <button onClick={() => toggleExpand(wf.id)} className="px-1 py-1 text-xs border rounded hover:bg-muted">
                      {expandedWorkflowId === wf.id ? '▼' : '▶'}
                    </button>
                  </td>
                </tr>
                {/* Expanded Steps View */}
                {expandedWorkflowId === wf.id && (
                  <tr className="bg-muted/5">
                    <td colSpan={4} className="p-0">
                      <div className="p-2">
                        <h4 className="text-sm font-medium mb-1">Steps:</h4>
                        <ul className="list-decimal list-inside text-sm space-y-1">
                          {wf.steps.map((step, index) => {
                            const isExecuting = execStatus?.workflowId === wf.id && execStatus?.currentStep === index + 1;
                            const payloadString = Object.entries(step.payload)
                              .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
                              .join(', ');
                            return (
                              <li
                                key={index}
                                className={`p-1 rounded ${isExecuting ? 'bg-blue-100 dark:bg-blue-900 font-semibold' : ''}`}
                              >
                                <span className="font-mono text-xs mr-1">{step.action}</span>
                                <span className="text-xs text-muted-foreground">({payloadString})</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}

      {/* Execution progress */}
      {execStatus && (
        <div className="fixed bottom-4 right-4 bg-background border shadow-md rounded p-3 w-72 z-40">
          <div className="font-medium mb-1">Running workflow…</div>
          <div className="text-sm mb-2">
            {execStatus.status === 'step_completed' && (
              <span>
                Step {execStatus.currentStep}/{execStatus.totalSteps}: {execStatus.stepAction}
              </span>
            )}
            {execStatus.status === 'started' && <span>Started…</span>}
            {execStatus.status === 'completed' && <span>Completed!</span>}
            {execStatus.status === 'error' && <span className="text-red-600">Error: {execStatus.message}</span>}
            {execStatus.status === 'cancelled' && <span className="text-yellow-600">Cancelled</span>}
          </div>
          {execStatus.status === 'error' || execStatus.status === 'completed' || execStatus.status === 'cancelled' ? (
            <button onClick={() => setExecStatus(null)} className="text-xs underline">Dismiss</button>
          ) : (
            <button onClick={cancelRun} className="px-2 py-1 text-xs bg-red-500 text-white rounded">Cancel</button>
          )}
        </div>
      )}

      {/* Parameter Modal */}
      {paramModal.open && paramModal.wf && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-background p-4 rounded shadow-md w-96">
            <h3 className="text-lg mb-3">Run {paramModal.wf.name}</h3>
            {Object.entries(paramModal.wf.parameters || {}).map(([key, meta]) => (
              <div key={key} className="mb-2">
                <label className="block text-sm mb-1">{key}</label>
                <input
                  value={paramModal.values[key] || ''}
                  onChange={(e) => updateParam(key, e.target.value)}
                  placeholder={meta.description || ''}
                  className="w-full p-1 border rounded"
                />
              </div>
            ))}
            <div className="flex justify-end space-x-2 mt-4">
              <button onClick={() => setParamModal({ open: false, values: {} })} className="px-2 py-1 border rounded">Cancel</button>
              <button onClick={submitParams} className="px-2 py-1 bg-primary text-white rounded">Run</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {confirmDelete.open && confirmDelete.wf && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-background p-4 rounded shadow-md w-80">
            <h3 className="text-lg mb-3">Delete workflow?</h3>
            <p className="text-sm mb-4">Are you sure you want to delete "{confirmDelete.wf.name}"?</p>
            <div className="flex justify-end space-x-2">
              <button onClick={() => setConfirmDelete({ open: false })} className="px-2 py-1 border rounded">Cancel</button>
              <button onClick={() => deleteWorkflow(confirmDelete.wf!.id)} className="px-2 py-1 bg-red-600 text-white rounded">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WorkflowsPage 