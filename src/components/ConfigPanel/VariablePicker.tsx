import React, { useMemo, useState } from 'react';
import type { VariableOption } from '../../utils/workflowNodes';

export default function VariablePicker({ options, onChoose, onClose }: { options: VariableOption[]; onChoose: (value: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => options.filter(option => `${option.group} ${option.label} ${option.path}`.toLowerCase().includes(query.toLowerCase())), [options, query]);
  return <div className="cfg-variable-picker" aria-label="选择输入变量">
    <div className="cfg-variable-picker-header"><strong>选择变量</strong><button type="button" onClick={onClose} aria-label="关闭变量选择">×</button></div>
    <input autoFocus className="cfg-input" aria-label="搜索变量" placeholder="搜索输入或上游输出" value={query} onChange={event => setQuery(event.target.value)} />
    <div className="cfg-variable-options">{filtered.map(option => <button type="button" key={option.path} onClick={() => onChoose(`{{${option.path}}}`)}><span>{option.group} · {option.label}</span><code>{option.path}</code></button>)}{!filtered.length && <p>暂无匹配变量。可先连接上游节点，或在参数中手动填写路径。</p>}</div>
    <p className="cfg-description">仅展示上游节点；完整引用保留对象、数组和数字类型。</p>
  </div>;
}
