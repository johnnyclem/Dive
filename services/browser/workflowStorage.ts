import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import logger from '../utils/logger';
import { Workflow } from './puppeteerManager';

class WorkflowStorage {
  private storagePath: string;
  private workflows: Record<string, Workflow> = {};
  
  constructor() {
    // Use the app's user data directory for storing workflows
    this.storagePath = path.join(app.getPath('userData'), 'workflows.json');
    this.loadWorkflows();
  }
  
  private loadWorkflows() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const data = fs.readFileSync(this.storagePath, 'utf-8');
        this.workflows = JSON.parse(data);
        logger.info(`Loaded ${Object.keys(this.workflows).length} workflows from storage`);
      } else {
        logger.info('No workflow storage file found, starting fresh');
        this.workflows = {};
      }
    } catch (error) {
      logger.error('Error loading workflows from storage:', error);
      this.workflows = {};
    }
  }
  
  private saveWorkflows() {
    try {
      fs.writeFileSync(this.storagePath, JSON.stringify(this.workflows, null, 2), 'utf-8');
      logger.info(`Saved ${Object.keys(this.workflows).length} workflows to storage`);
      return true;
    } catch (error) {
      logger.error('Error saving workflows to storage:', error);
      return false;
    }
  }
  
  saveWorkflow(workflow: Workflow): boolean {
    if (!workflow || !workflow.id) {
      logger.error('Cannot save workflow: missing ID');
      return false;
    }
    
    this.workflows[workflow.id] = workflow;
    return this.saveWorkflows();
  }
  
  getWorkflow(id: string): Workflow | null {
    return this.workflows[id] || null;
  }
  
  getAllWorkflows(): Workflow[] {
    return Object.values(this.workflows);
  }
  
  deleteWorkflow(id: string): boolean {
    if (!this.workflows[id]) {
      logger.warn(`Workflow with ID ${id} not found for deletion`);
      return false;
    }
    
    delete this.workflows[id];
    return this.saveWorkflows();
  }
  
  updateWorkflow(id: string, updates: Partial<Workflow>): boolean {
    const workflow = this.workflows[id];
    if (!workflow) {
      logger.warn(`Workflow with ID ${id} not found for update`);
      return false;
    }
    
    this.workflows[id] = { ...workflow, ...updates };
    return this.saveWorkflows();
  }
}

// Create a singleton instance
const workflowStorage = new WorkflowStorage();
export default workflowStorage; 