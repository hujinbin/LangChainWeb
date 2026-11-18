import type { Execution, Workflow } from '../types/workflow';
import { normalizeExecution, normalizeWorkflow } from './api';
import { asRecord } from '../types/api';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEYS = {
  WORKFLOWS: 'local_workflows',
  EXECUTIONS: 'local_executions',
};

// 本地存储服务，支持游客模式下的工作流管理
const localStorageService = {
  // 获取工作流列表
  getWorkflows: (): Workflow[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.WORKFLOWS);
      const workflows: unknown = data ? JSON.parse(data) : [];
      return Array.isArray(workflows)
        ? workflows
            .filter((item) => item && typeof item === 'object')
            .map((item) => ({
              ...normalizeWorkflow(item),
              _source: 'local',
              isLocal: true,
            }))
        : [];
    } catch {
      return [];
    }
  },

  // 保存工作流
  saveWorkflow: (workflow: Workflow): Workflow => {
    const workflows = localStorageService.getWorkflows();
    const now = new Date().toISOString();
    const id = workflow.id || uuidv4();
    const index = workflows.findIndex((item) => item.id === id);
    // 返回持久化后的完整快照，来源标记供界面区分本地草稿。
    const saved: Workflow = {
      ...(index === -1 ? {} : workflows[index]),
      ...workflow,
      id,
      created_at: workflows[index]?.created_at || workflow.created_at || now,
      updated_at: now,
      _source: 'local',
      isLocal: true,
    };
    if (index === -1) workflows.push(saved);
    else workflows[index] = saved;

    localStorage.setItem(STORAGE_KEYS.WORKFLOWS, JSON.stringify(workflows));
    return saved;
  },

  // 获取单个工作流
  getWorkflow: (id: string): Workflow | null => {
    const workflows = localStorageService.getWorkflows();
    return workflows.find((w) => w.id === id) || null;
  },

  // 删除工作流
  deleteWorkflow: (id: string) => {
    const workflows = localStorageService.getWorkflows();
    const filtered = workflows.filter((w) => w.id !== id);
    localStorage.setItem(STORAGE_KEYS.WORKFLOWS, JSON.stringify(filtered));
  },

  // 切换工作流状态
  toggleWorkflow: (id: string): Workflow | undefined => {
    const workflows = localStorageService.getWorkflows();
    const workflow = workflows.find((w) => w.id === id);
    if (workflow) {
      workflow.status = workflow.status === 'active' ? 'inactive' : 'active';
      workflow.updated_at = new Date().toISOString();
      localStorage.setItem(STORAGE_KEYS.WORKFLOWS, JSON.stringify(workflows));
    }
    return workflow;
  },

  // 获取执行记录
  getExecutions: (): Execution[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.EXECUTIONS);
      const executions: unknown = data ? JSON.parse(data) : [];
      return Array.isArray(executions)
        ? executions.map((item) => ({
            ...normalizeExecution(item),
            isLocal: true,
            _source: 'local',
            simulated:
              typeof asRecord(item).simulated === 'boolean'
                ? Boolean(asRecord(item).simulated)
                : true,
          }))
        : [];
    } catch {
      return [];
    }
  },

  // 添加执行记录
  addExecution: (execution: Partial<Execution>): Execution => {
    const executions = localStorageService.getExecutions();
    const saved: Execution = {
      ...normalizeExecution(execution),
      id: uuidv4(),
      execute_time: new Date().toISOString(),
      isLocal: true,
      _source: 'local',
      simulated: execution.simulated ?? true,
    };
    executions.unshift(saved);
    // 只保留最近50条
    if (executions.length > 50) executions.length = 50;
    localStorage.setItem(STORAGE_KEYS.EXECUTIONS, JSON.stringify(executions));
    return saved;
  },
};

export default localStorageService;
