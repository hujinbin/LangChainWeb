import type { NodePort, Parameters, WorkflowEdge, WorkflowNode, WorkflowNodeData } from '../types/workflow';
import { DEFAULT_NODE_TYPES } from '../constants/nodeTypes';

export const nodePorts = (data: WorkflowNodeData, direction: 'inputs' | 'outputs'): NodePort[] => {
  if (direction === 'outputs' && ['selector', 'intentRecognition'].includes(data.type)) {
    const rows = data.config[data.type === 'selector' ? 'cases' : 'categories'];
    const ports = Array.isArray(rows) ? rows.flatMap((row: unknown) => {
      if (!row || typeof row !== 'object' || !('id' in row) || typeof row.id !== 'string') return [];
      return [{ name: row.id, type: 'any', label: 'name' in row && typeof row.name === 'string' ? row.name : row.id }];
    }) : [];
    const fallback = typeof data.config.defaultBranch === 'string' ? data.config.defaultBranch : 'default';
    return [...ports.filter(port => port.name !== fallback), { name: fallback, type: 'any', label: '其他' }];
  }
  const meta = DEFAULT_NODE_TYPES.find(item => item.type === data.type);
  const ports = data[direction] || meta?.[direction];
  if (ports) return ports;
  const enabled = direction === 'inputs' ? data.hasInput !== false : data.hasOutput !== false;
  return enabled ? [{ name: 'main', type: 'any' }] : [];
};

export const portLabel = (port: NodePort) => port.label || ({ true: '满足', false: '不满足', default: '其他', main: '结果' }[port.name] || port.name);
export const isBaseNode = (node: Pick<WorkflowNode, 'id' | 'data'>) => (node.id === 'workflow-start' && node.data.type === 'manualTrigger') || (node.id === 'workflow-end' && node.data.type === 'response');

export function upstreamNodes(nodes: WorkflowNode[], edges: WorkflowEdge[], selectedId: string): WorkflowNode[] {
  const ancestors = new Set<string>();
  const queue = [selectedId];
  while (queue.length) {
    const id = queue.shift();
    edges.filter(edge => edge.target === id).forEach(edge => {
      if (edge.source !== selectedId && !ancestors.has(edge.source)) { ancestors.add(edge.source); queue.push(edge.source); }
    });
  }
  return nodes.filter(node => ancestors.has(node.id));
}

export const createsCycle = (edges: WorkflowEdge[], source: string, target: string) => {
  const visited = new Set<string>();
  const pending = [target];
  while (pending.length) {
    const id = pending.pop()!;
    if (id === source) return true;
    if (visited.has(id)) continue;
    visited.add(id);
    edges.filter(edge => edge.source === id).forEach(edge => pending.push(edge.target));
  }
  return false;
};

export interface VariableOption { path: string; label: string; group: string; }
export function variableOptions(nodes: WorkflowNode[], edges: WorkflowEdge[], id: string, input: Parameters = {}, variables: Parameters = {}): VariableOption[] {
  const result: VariableOption[] = [];
  const addObject = (prefix: string, value: Parameters, group: string, depth = 0) => {
    Object.entries(value).slice(0, 40).forEach(([key, child]) => {
      if (!/^[\w-]+$/.test(key)) return;
      const path = `${prefix}.${key}`;
      result.push({ path, label: key, group });
      if (depth < 1 && child && typeof child === 'object' && !Array.isArray(child)) addObject(path, child as Parameters, group, depth + 1);
    });
  };
  result.push({ path: 'input', label: '完整输入', group: '运行输入' });
  const start = nodes.find(node => ['manualTrigger', 'input', 'webhookTrigger'].includes(node.data.type));
  const inputSchema = start?.data.config.inputSchema as { properties?: Parameters } | undefined;
  addObject('input', { ...Object.fromEntries(Object.keys(inputSchema?.properties || {}).map(key => [key, undefined])), ...input }, '运行输入');
  addObject('variables', variables, '全局变量');
  upstreamNodes(nodes, edges, id).forEach(node => {
    const meta = DEFAULT_NODE_TYPES.find(item => item.type === node.data.type);
    const group = node.data.label || node.id;
    const prefix = `nodes.${node.id}.output`;
    result.push({ path: prefix, label: '完整输出', group });
    const schema = node.data.outputSchema || meta?.outputSchema;
    const fallback = ['llm', 'promptOptimize', 'textProcess'].includes(node.data.type) ? ['text'] : ['imageGeneration', 'imageEdit'].includes(node.data.type) ? ['urls', 'images'] : ['jsonParse', 'jsonGet'].includes(node.data.type) ? ['value'] : ['code', 'response', 'output'].includes(node.data.type) ? ['result'] : [];
    [...new Set([...Object.keys(schema?.properties || {}), ...Object.keys(node.data.outputMapping || {}), ...fallback])].forEach(key => result.push({ path: `${prefix}.${key}`, label: key, group }));
  });
  return result;
}
