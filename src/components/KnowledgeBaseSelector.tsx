import React, { useState } from 'react';
import { useKnowledgeBase } from '../contexts/KnowledgeBaseContext';
import { Select, Button, Modal, Input, message } from 'antd';
import { DatabaseOutlined, PlusOutlined } from '@ant-design/icons';
import './KnowledgeBaseSelector.css';

const { Option } = Select;

const KnowledgeBaseSelector: React.FC = () => {
  const { 
    knowledgeBases, 
    activeKnowledgeBase, 
    setActiveKnowledgeBase, 
    refreshKnowledgeBases,
    isLoading
  } = useKnowledgeBase();

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newBaseName, setNewBaseName] = useState('');
  const [newBaseDescription, setNewBaseDescription] = useState('');

  const handleChange = (kbId: string) => {
    const selectedKb = knowledgeBases.find(kb => kb.id === kbId);
    if (selectedKb) {
      setActiveKnowledgeBase(selectedKb);
    }
  };

  const showCreateModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsModalVisible(true);
  };

  const handleCreateBase = async () => {
    if (!newBaseName.trim()) {
      message.error('Please enter a name for the knowledge base');
      return;
    }

    try {
      await window.electron.ipcRenderer.invoke(
        'knowledge:add',
        newBaseName,
        newBaseDescription || undefined
      );
      
      await refreshKnowledgeBases();
      setIsModalVisible(false);
      setNewBaseName('');
      setNewBaseDescription('');
      message.success('Knowledge base created successfully');
    } catch (err) {
      console.error('Failed to create knowledge base:', err);
      message.error('Failed to create knowledge base');
    }
  };

  return (
    <div className="knowledge-base-selector">
      <Select
        value={activeKnowledgeBase?.id}
        onChange={handleChange}
        style={{ width: 180 }}
        loading={isLoading}
        placeholder="Select knowledge base"
        suffixIcon={<DatabaseOutlined />}
        dropdownRender={(menu) => (
          <div>
            {menu}
            <div style={{ 
              padding: '8px', 
              borderTop: '1px solid #e8e8e8', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center' 
            }}>
              <Button 
                icon={<PlusOutlined />} 
                size="small" 
                type="text"
                onClick={showCreateModal}
              >
                New Knowledge Base
              </Button>
            </div>
          </div>
        )}
      >
        {knowledgeBases.map(kb => (
          <Option key={kb.id} value={kb.id}>
            {kb.name}
          </Option>
        ))}
      </Select>

      <Modal 
        title="Create New Knowledge Base" 
        open={isModalVisible}
        onOk={handleCreateBase}
        onCancel={() => setIsModalVisible(false)}
        confirmLoading={isLoading}
      >
        <Input
          placeholder="Knowledge Base Name"
          value={newBaseName}
          onChange={(e) => setNewBaseName(e.target.value)}
          style={{ marginBottom: 16 }}
        />
        <Input.TextArea
          placeholder="Description (optional)"
          value={newBaseDescription}
          onChange={(e) => setNewBaseDescription(e.target.value)}
        />
      </Modal>
    </div>
  );
};

export default KnowledgeBaseSelector; 