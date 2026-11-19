import { createsCycle, nodePorts, variableOptions } from './workflowNodes';
import type { WorkflowNode } from '../types/workflow';

const node = (id: string, type = 'jsonParse'): WorkflowNode => ({ id, type: 'custom', position: { x: 0, y: 0 }, data: { type, label: id, config: {} } });

test('变量选择只包含真正上游，保留完整对象和输入数组引用', () => {
  const options = variableOptions([node('a'), node('b'), node('c')], [{ id: 'a-b', source: 'a', target: 'b' }, { id: 'b-c', source: 'b', target: 'c' }], 'b', { rows: [1, 2] }, { brand: '品牌' });
  expect(options.map(option => option.path)).toEqual(expect.arrayContaining(['input.rows', 'variables.brand', 'nodes.a.output', 'nodes.a.output.value']));
  expect(options.some(option => option.path.startsWith('nodes.b') || option.path.startsWith('nodes.c'))).toBe(false);
});

test('选择器端口随分支ID变化，连线拒绝形成回路', () => {
  const selector = node('switch', 'selector');
  selector.data.config = { cases: [{ id: 'sales', value: '售前' }, { id: 'support', value: '售后' }], defaultBranch: 'other' };
  expect(nodePorts(selector.data, 'outputs').map(port => port.name)).toEqual(['sales', 'support', 'other']);
  const edges = [{ id: 'a-b', source: 'a', target: 'b' }, { id: 'b-c', source: 'b', target: 'c' }];
  expect(createsCycle(edges, 'c', 'a')).toBe(true);
  expect(createsCycle(edges, 'a', 'c')).toBe(false);
});
