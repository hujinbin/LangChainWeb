import { aiWorkflowAPI } from '../../services/api';
import { customAgentAPI } from '../../services/customAgentApi';
import type { CustomAgent } from '../../types/customAgent';
import type { Workflow } from '../../types/workflow';

export type OutputCategory = 'text' | 'image' | 'video';
export type CategoryFilter = 'all' | OutputCategory;

function outputCategory(value: unknown): OutputCategory | undefined {
  return value === 'text' || value === 'image' || value === 'video' ? value : undefined;
}

export function presetCategory(id: string, declared?: unknown): OutputCategory {
  const category = outputCategory(declared);
  if (category) return category;
  if (id === 'cloud-comic') return 'image';
  if (id === 'life-story') return 'video';
  return 'text';
}

function mediaCapabilities(
  workflowIds: string[],
  workflows: Map<string, Workflow>,
  missing?: Set<string>,
): Set<OutputCategory> {
  const found = new Set<OutputCategory>();
  const seen = new Set<string>();
  const pending = [...workflowIds];
  while (pending.length) {
    const id = pending.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const workflow = workflows.get(id);
    if (!workflow) missing?.add(id);
    for (const node of workflow?.nodes || []) {
      const type = node.data?.type || node.type;
      if (type === 'imageGeneration' || type === 'imageEdit') found.add('image');
      if (type === 'videoGeneration') found.add('video');
      if (['subWorkflow', 'batch', 'loop'].includes(type)) {
        const child =
          node.parameters?.workflowId ?? node.data?.config?.workflowId ?? node.config?.workflowId;
        if (typeof child === 'string') pending.push(child);
      }
    }
  }
  return found;
}

// Older agents only have a text model and linked workflow IDs. Read the actual node
// definitions so names, avatars and prompts never imply a media capability.
export async function categorizedCustomAgents(keyword: string, signal: AbortSignal) {
  const agents: CustomAgent[] = [];
  let page = 1;
  while (!signal.aborted) {
    const result = await customAgentAPI.list({ page, pageSize: 100, keyword }, signal);
    agents.push(...result.items);
    if (!result.items.length || page * result.pageSize >= result.total) break;
    page++;
  }
  const workflows = new Map<string, Workflow>();
  const linked = agents
    .filter((agent) => !outputCategory(agent.outputType))
    .flatMap((agent) => agent.workflowIds || []);
  if (linked.length) {
    for (let index = 1; !signal.aborted; index++) {
      const { data } = await aiWorkflowAPI.list({ page: index }, { signal });
      const count = workflows.size;
      for (const workflow of data) {
        const id = workflow.id || workflow._id;
        if (id) workflows.set(id, workflow);
      }
      if (!data.length || workflows.size === count) break;
      const missing = new Set<string>();
      mediaCapabilities(linked, workflows, missing);
      if (!missing.size) break;
    }
  }
  return agents.map((agent) => {
    const declared = outputCategory(agent.outputType);
    const categories = declared
      ? new Set([declared])
      : mediaCapabilities(agent.workflowIds || [], workflows);
    if (!categories.size) categories.add('text');
    return { agent, categories };
  });
}
