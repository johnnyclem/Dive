import React, { useEffect, useState } from 'react'

/**
 * WorkflowControls
 * Minimal controls for "Watch Me Flow" recording feature.
 * Sends IPC messages to the main process to start/stop/save a browser workflow.
 */
const WorkflowControls: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false)
  const [showSave, setShowSave] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [paramString, setParamString] = useState('')

  // Listen for status updates from main process
  useEffect(() => {
    const handler = (_event: unknown, msg: { status: string }) => {
      if (msg.status === 'recording_started') setIsRecording(true)
      if (msg.status === 'recording_stopped') setIsRecording(false)
    }
    window.electron?.ipcRenderer.on('WORKFLOW_STATUS_UPDATE', handler)
    return () => {
      window.electron?.ipcRenderer.off('WORKFLOW_STATUS_UPDATE', handler)
    }
  }, [])

  const startRecording = () => {
    window.electron?.ipcRenderer.send('WORKFLOW_START_RECORDING')
  }

  const stopRecording = () => {
    window.electron?.ipcRenderer.send('WORKFLOW_STOP_RECORDING')
    setShowSave(true)
  }

  const saveWorkflow = async () => {
    if (!name.trim()) return
    // parse parameters string: lines of "key:description"
    const params: Record<string, { description?: string; type?: string }> = {}
    paramString.split('\n').forEach(line => {
      const trimmed = line.trim()
      if (!trimmed) return
      const [key, ...rest] = trimmed.split(':')
      if (!key) return
      params[key.trim()] = { description: rest.join(':').trim(), type: 'string' }
    })
    await window.electron?.ipcRenderer.invoke('WORKFLOW_SAVE', {
      name,
      description,
      parameters: params,
    })
    setShowSave(false)
    setName('')
    setDescription('')
    setParamString('')
  }

  // Hide the BrowserView while the save modal is open so the overlay isn't obscured by it
  useEffect(() => {
    // When `showSave` becomes true we hide the BrowserView, and restore it once the modal closes
    window.electron?.ipcRenderer.send('BROWSER_SET_VISIBILITY', !showSave)
  }, [showSave])

  return (
    <div className="flex items-center space-x-1">
      {isRecording ? (
        <button onClick={stopRecording} className="px-2 py-1 text-xs bg-red-600 text-white rounded">Stop</button>
      ) : (
        <button onClick={startRecording} className="px-2 py-1 text-xs bg-red-500 text-white rounded">Rec</button>
      )}

      {showSave && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-4 rounded shadow-md w-80">
            <h3 className="text-lg mb-2">Save Workflow</h3>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="w-full mb-2 p-1 border rounded"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={3}
              className="w-full mb-3 p-1 border rounded"
            />
            <textarea
              value={paramString}
              onChange={(e) => setParamString(e.target.value)}
              placeholder="Parameters (one per line: key:description)"
              rows={3}
              className="w-full mb-3 p-1 border rounded"
            />
            <div className="flex justify-end space-x-2">
              <button onClick={() => setShowSave(false)} className="px-2 py-1 border rounded">Cancel</button>
              <button onClick={saveWorkflow} className="px-2 py-1 bg-blue-600 text-white rounded">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WorkflowControls 