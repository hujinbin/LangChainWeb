import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEYS = {
  WORKFLOWS: 'local_workflows',
  EXECUTIONS: 'local_executions',
};

// 本地存储服务，支持游客模式下的工作流管理
const localStorageService = {
  // 获取工作流列表
  getWorkflows: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.WORKFLOWS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  // 保存工作流
  saveWorkflow: (workflow) => {
    const workflows = localStorageService.getWorkflows();
    const now = new Date().toISOString();

    if (workflow.id) {
      // 更新
      const index = workflows.findIndex(w => w.id === workflow.id);
      if (index !== -1) {
        workflows[index] = { ...workflows[index], ...workflow, updated_at: now };
      } else {
        workflows.push({ ...workflow, created_at: now, updated_at: now });
      }
    } else {
      // 新建
      workflow.id = uuidv4();
      workflow.created_at = now;
      workflow.updated_at = now;
      workflows.push(workflow);
    }

    localStorage.setItem(STORAGE_KEYS.WORKFLOWS, JSON.stringify(workflows));
    return workflow;
  },

  // 获取单个工作流
  getWorkflow: (id) => {
    const workflows = localStorageService.getWorkflows();
    return workflows.find(w => w.id === id) || null;
  },

  // 删除工作流
  deleteWorkflow: (id) => {
    const workflows = localStorageService.getWorkflows();
    const filtered = workflows.filter(w => w.id !== id);
    localStorage.setItem(STORAGE_KEYS.WORKFLOWS, JSON.stringify(filtered));
  },

  // 切换工作流状态
  toggleWorkflow: (id) => {
    const workflows = localStorageService.getWorkflows();
    const workflow = workflows.find(w => w.id === id);
    if (workflow) {
      workflow.status = workflow.status === 'active' ? 'inactive' : 'active';
      workflow.updated_at = new Date().toISOString();
      localStorage.setItem(STORAGE_KEYS.WORKFLOWS, JSON.stringify(workflows));
    }
    return workflow;
  },

  // 获取执行记录
  getExecutions: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.EXECUTIONS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  // 添加执行记录
  addExecution: (execution) => {
    const executions = localStorageService.getExecutions();
    execution.id = uuidv4();
    execution.execute_time = new Date().toISOString();
    executions.unshift(execution);
    // 只保留最近50条
    if (executions.length > 50) executions.length = 50;
    localStorage.setItem(STORAGE_KEYS.EXECUTIONS, JSON.stringify(executions));
    return execution;
  },
};

export default localStorageService;
