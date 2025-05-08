import React, { useState } from 'react';
import { useScheduledItemStore } from '../stores/scheduledItemStore';
import { ScheduledItem } from '../types/ScheduledItem';

const SchedulerPage: React.FC = () => {
  const items = useScheduledItemStore((state) => state.scheduledItems);
  const addItem = useScheduledItemStore((state) => state.addScheduledItem);
  const updateItem = useScheduledItemStore((state) => state.updateScheduledItem);
  const deleteItem = useScheduledItemStore((state) => state.deleteScheduledItem);

  const [isAdding, setIsAdding] = useState(false);
  const [newDescription, setNewDescription] = useState('');
  const [newType, setNewType] = useState<ScheduledItem['type']>('once');
  const [newSchedule, setNewSchedule] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState<ScheduledItem['type']>('once');
  const [editSchedule, setEditSchedule] = useState('');

  const handleAdd = () => {
    if (!newDescription.trim() || !newSchedule.trim()) return;
    addItem({ description: newDescription.trim(), type: newType, schedule: newSchedule.trim() });
    setNewDescription('');
    setNewType('once');
    setNewSchedule('');
    setIsAdding(false);
  };

  const startEdit = (item: ScheduledItem) => {
    setEditingId(item.id);
    setEditDescription(item.description);
    setEditType(item.type);
    setEditSchedule(item.schedule);
  };

  const handleUpdate = () => {
    if (!editingId) return;
    updateItem(editingId, { description: editDescription.trim(), type: editType, schedule: editSchedule.trim() });
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  return (
    <div className="scheduler-content h-full flex flex-col p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Scheduler</h2>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="px-3 py-1 bg-primary text-white rounded"
          >
            Add Schedule
          </button>
        )}
      </div>

      {isAdding && (
        <div className="mb-4 p-4 bg-card rounded border border-border space-y-2">
          <input
            type="text"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Description"
            className="w-full px-2 py-1 border rounded"
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as ScheduledItem['type'])}
            className="w-full px-2 py-1 border rounded"
          >
            <option value="once">Once</option>
            <option value="recurring">Recurring</option>
            <option value="interval">Interval</option>
            <option value="heartbeat">Heartbeat</option>
            <option value="runloop">Runloop</option>
          </select>
          <input
            type="text"
            value={newSchedule}
            onChange={(e) => setNewSchedule(e.target.value)}
            placeholder="Schedule (cron, ISO, or interval in seconds for runloop)"
            className="w-full px-2 py-1 border rounded"
          />
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setIsAdding(false)}
              className="px-3 py-1 border rounded"
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
        {items.length === 0 ? (
          <div className="text-center text-muted-foreground mt-4">
            No scheduled items
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="mb-2 p-3 bg-card rounded border border-border"
            >
              {editingId === item.id ? (
                <>
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full mb-1 px-2 py-1 border rounded"
                  />
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as ScheduledItem['type'])}
                    className="w-full mb-1 px-2 py-1 border rounded"
                  >
                    <option value="once">Once</option>
                    <option value="recurring">Recurring</option>
                    <option value="interval">Interval</option>
                    <option value="heartbeat">Heartbeat</option>
                    <option value="runloop">Runloop</option>
                  </select>
                  <input
                    type="text"
                    value={editSchedule}
                    onChange={(e) => setEditSchedule(e.target.value)}
                    placeholder="Schedule (cron, ISO, or interval in seconds for runloop)"
                    className="w-full mb-2 px-2 py-1 border rounded"
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={handleCancelEdit}
                      className="px-2 py-1 border rounded text-destructive"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpdate}
                      className="px-2 py-1 bg-primary text-white rounded"
                    >
                      Save
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-1">
                    <div className="font-medium">{item.description}</div>
                    <div className="flex space-x-2">
                      <button onClick={() => startEdit(item)} className="text-primary">
                        Edit
                      </button>
                      <button onClick={() => deleteItem(item.id)} className="text-destructive">
                        Delete
                      </button>
                      {item.status === 'active' ? (
                        <button
                          onClick={() => updateItem(item.id, { status: 'paused' })}
                          className="text-yellow-600"
                        >
                          Pause
                        </button>
                      ) : (
                        <button
                          onClick={() => updateItem(item.id, { status: 'active', nextRunTime: Date.now() })}
                          className="text-primary"
                        >
                          Resume
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground mb-1">
                    {item.type} | {item.schedule}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Next: {new Date(item.nextRunTime).toLocaleString()}
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SchedulerPage; 