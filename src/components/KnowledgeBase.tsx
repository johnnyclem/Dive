import React, { useState, useEffect, ChangeEvent, MouseEvent } from 'react'
import { Button, Input, List, Modal, message, Space } from 'antd'
import { PlusOutlined, FileTextOutlined, CheckCircleOutlined } from '@ant-design/icons'
import './KnowledgeBase.css'

// Add type declarations for the window.electron object
declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        invoke(channel: string, ...args: unknown[]): Promise<unknown>
      }
    }
  }
}

interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Document {
  id: string;
  name: string;
  path: string;
  content: string;
  dateAdded: Date;
}

interface ImportResult {
  filePath?: string
  error?: string
}

interface ProcessResult {
  success?: boolean
  chunks?: number
  error?: string
}

export const KnowledgeBase: React.FC = () => {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [selectedBase, setSelectedBase] = useState<KnowledgeBase | null>(null)
  const [activeBaseId, setActiveBaseId] = useState<string | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [newBaseName, setNewBaseName] = useState('')
  const [newBaseDescription, setNewBaseDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    loadKnowledgeBases()
    loadActiveKnowledgeBase()
  }, [])

  useEffect(() => {
    if (selectedBase) {
      loadDocuments(selectedBase.id)
    }
  }, [selectedBase])

  const loadKnowledgeBases = async () => {
    setIsLoading(true)
    try {
      const bases = await window.electron.ipcRenderer.invoke('knowledge:list') as KnowledgeBase[]
      setKnowledgeBases(bases)
    } catch (err) {
      console.error('Failed to load knowledge bases:', err)
      message.error('Failed to load knowledge bases. Please check the console for details.')
    } finally {
      setIsLoading(false)
    }
  }

  const loadDocuments = async (baseId: string) => {
    setIsLoading(true)
    try {
      const docs = await window.electron.ipcRenderer.invoke('knowledge:get-documents', baseId) as Document[]
      setDocuments(docs)
    } catch (err) {
      console.error('Failed to load documents:', err)
      message.error('Failed to load documents. Please check the console for details.')
    } finally {
      setIsLoading(false)
    }
  }

  const loadActiveKnowledgeBase = async () => {
    try {
      const activeId = await window.electron.ipcRenderer.invoke('knowledge:get-active') as string | null
      setActiveBaseId(activeId)
    } catch (err) {
      console.error('Failed to load active knowledge base:', err)
    }
  }

  const handleCreateBase = async () => {
    if (!newBaseName.trim()) {
      message.error('Please enter a name for the knowledge base')
      return
    }

    setIsLoading(true)
    try {
      await window.electron.ipcRenderer.invoke(
        'knowledge:add',
        newBaseName,
        newBaseDescription || undefined
      )
      
      await loadKnowledgeBases()
      setIsModalVisible(false)
      setNewBaseName('')
      setNewBaseDescription('')
      message.success('Knowledge base created successfully')
    } catch (err) {
      console.error('Failed to create knowledge base:', err)
      message.error('Failed to create knowledge base. Please check the console for details.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleImportDocument = async (baseId: string) => {
    setIsLoading(true)
    try {
      const result = await window.electron.ipcRenderer.invoke('document:show-open-dialog', baseId) as ImportResult
      
      if (result.error) {
        message.error(result.error)
        return
      }

      if (result.filePath) {
        const processResult = await window.electron.ipcRenderer.invoke('document:process', result.filePath, baseId) as ProcessResult
        
        if (processResult.error) {
          message.error(processResult.error)
          return
        }

        message.success(`Document imported successfully: ${processResult.chunks} chunks processed`)
        loadDocuments(baseId)
      }
    } catch (err) {
      console.error('Failed to import document:', err)
      message.error('Failed to import document. Please check the console for details.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleActivateBase = async (baseId: string) => {
    setIsLoading(true)
    try {
      if (activeBaseId === baseId) {
        // Deactivate if clicking on the already active base
        await window.electron.ipcRenderer.invoke('knowledge:set-active', null)
        setActiveBaseId(null)
        message.success('Knowledge base deactivated')
      } else {
        // Activate a new knowledge base
        await window.electron.ipcRenderer.invoke('knowledge:set-active', baseId)
        setActiveBaseId(baseId)
        message.success('Knowledge base activated')
      }
    } catch (err) {
      console.error('Failed to activate knowledge base:', err)
      message.error('Failed to activate knowledge base. Please check the console for details.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="knowledge-base-container">
      <div className="knowledge-base-header">
        <h2>Knowledge Bases</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsModalVisible(true)}
          loading={isLoading}
        >
          New Knowledge Base
        </Button>
      </div>

      <div className="knowledge-base-content">
        <div className="knowledge-base-list">
          <List
            loading={isLoading}
            dataSource={knowledgeBases}
            renderItem={(base: KnowledgeBase) => (
              <List.Item
                className={`${selectedBase?.id === base.id ? 'selected' : ''} ${activeBaseId === base.id ? 'active' : ''}`}
                onClick={() => setSelectedBase(base)}
              >
                <List.Item.Meta
                  title={
                    <span>
                      {base.name}
                      {activeBaseId === base.id && (
                        <CheckCircleOutlined style={{ color: '#52c41a', marginLeft: '8px' }} />
                      )}
                    </span>
                  }
                  description={base.description}
                />
                <Space>
                  <Button
                    type={activeBaseId === base.id ? "default" : "primary"}
                    onClick={(e: MouseEvent) => {
                      e.stopPropagation()
                      handleActivateBase(base.id)
                    }}
                    loading={isLoading}
                  >
                    {activeBaseId === base.id ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    type="primary"
                    icon={<FileTextOutlined />}
                    onClick={(e: MouseEvent) => {
                      e.stopPropagation()
                      handleImportDocument(base.id)
                    }}
                    loading={isLoading}
                  >
                    Import Document
                  </Button>
                </Space>
              </List.Item>
            )}
          />
        </div>

        {selectedBase && (
          <div className="knowledge-base-documents">
            <h3>Documents in {selectedBase.name}</h3>
            <List
              loading={isLoading}
              dataSource={documents}
              renderItem={(doc: Document) => (
                <List.Item>
                  <List.Item.Meta
                    title={doc.name}
                    description={<span>Added: {new Date(doc.dateAdded).toLocaleString()}</span>}
                  />
                </List.Item>
              )}
            />
          </div>
        )}
      </div>

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
          onChange={(e: ChangeEvent<HTMLInputElement>) => setNewBaseName(e.target.value)}
          style={{ marginBottom: 16 }}
        />
        <Input.TextArea
          placeholder="Description (optional)"
          value={newBaseDescription}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNewBaseDescription(e.target.value)}
        />
      </Modal>
    </div>
  )
} 