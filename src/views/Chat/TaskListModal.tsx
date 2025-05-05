/* Remove any explicit any disabling */
import React, { useState, useEffect } from 'react';

interface AgentTask {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  sequence: number;
  resultSummary?: string;
  failReason?: string;
}

const TaskListModal: React.FC = () => {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newDesc, setNewDesc] = useState('');

  const fetchTasks = async () => {
    try {
      const list: AgentTask[] = await window.electron.tasks.list('all');
      setTasks(list);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleAdd = async () => {
    if (!newDesc.trim()) return;
    await window.electron.tasks.add(newDesc.trim());
    setNewDesc('');
    setIsAdding(false);
    fetchTasks();
  };

  const handleComplete = async (id: string) => {
    await window.electron.tasks.complete(id);
    fetchTasks();
  };

  const handleFail = async (id: string) => {
    await window.electron.tasks.fail(id, 'Deleted by user');
    fetchTasks();
  };

  return (
    <div className="task-list-content h-full flex flex-col p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Task List</h2>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="px-3 py-1 bg-primary text-white rounded"
          >
            Add Task
          </button>
        )}
      </div>

      {isAdding && (
        <div className="mb-4 p-4 bg-card rounded border border-border space-y-2">
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="New task description"
            className="w-full px-2 py-1 border rounded"
          />
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setIsAdding(false)}
              className="px-3 py-1 border rounded text-destructive"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              className="px-3 py-1 bg-primary text-white rounded"
            >
              Save
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {tasks.length === 0 ? (
          <div className="text-center text-muted-foreground mt-4">
            No tasks available
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className="mb-2 p-3 bg-card rounded border border-border flex justify-between items-center"
            >
              <div>
                <div
                  className={`font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}
                >
                  {task.description}
                </div>
                <div className="text-sm text-muted-foreground">
                  {task.status.replace('_', ' ')}
                </div>
              </div>

              <div className="flex space-x-2">
                {task.status !== 'completed' && (
                  <button onClick={() => handleComplete(task.id)} className="text-primary">
                    Complete
                  </button>
                )}
                <button onClick={() => handleFail(task.id)} className="text-destructive">
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TaskListModal;