import React, { useState } from 'react';
import type { SchemaField } from '../../types/workflow';

export default function InputSchemaEditor({ value, onChange }: { value: unknown; onChange: (value: SchemaField) => void }) {
  const schema: SchemaField = value && typeof value === 'object' ? value as SchemaField : { type: 'object', properties: {}, required: [] };
  const [error, setError] = useState('');
  const rows = Object.entries(schema.properties || {});
  const commit = (properties: Record<string, SchemaField>, required = schema.required || []) => { setError(''); onChange({ ...schema, type: 'object', properties, required }); };
  const patch = (key: string, update: Partial<SchemaField>) => commit({ ...schema.properties, [key]: { ...schema.properties?.[key], ...update } });
  const add = () => { let index = rows.length + 1; while (schema.properties?.[`input${index}`]) index += 1; commit({ ...schema.properties, [`input${index}`]: { type: 'string' } }); };
  return <div className="cfg-input-schema">
    {rows.map(([key, field], index) => <div className="cfg-input-definition" key={key}>
      <div className="cfg-mapping-row"><input className="cfg-input" aria-label={`输入变量名称 ${index + 1}`} defaultValue={key} onBlur={event => {
        const next = event.target.value.trim();
        if (next === key) return;
        if (!/^[A-Za-z_][\w-]*$/.test(next) || schema.properties?.[next]) { setError('变量名需以字母或下划线开头，且不能重复。'); event.target.value = key; return; }
        commit(Object.fromEntries(rows.map(([name, item]) => [name === key ? next : name, item])), (schema.required || []).map(name => name === key ? next : name));
      }} /><select className="cfg-select" aria-label={`${key} 数据类型`} value={field.type || 'string'} onChange={event => patch(key, { type: event.target.value, default: undefined })}>{['string', 'number', 'boolean', 'object', 'array'].map(type => <option key={type} value={type}>{({ string: '文本', number: '数字', boolean: '布尔', object: '对象', array: '数组' } as Record<string, string>)[type]}</option>)}</select></div>
      <div className="cfg-mapping-row"><input key={`${key}-${field.type}`} className="cfg-input" aria-label={`${key} 默认值`} placeholder="可选默认值" defaultValue={field.default === undefined ? '' : typeof field.default === 'string' ? field.default : JSON.stringify(field.default)} onBlur={event => {
        event.target.setCustomValidity('');
        const text = event.target.value;
        if (!text) { patch(key, { default: undefined }); return; }
        try { const parsed = field.type === 'string' ? text : JSON.parse(text); if ((field.type === 'number' && typeof parsed !== 'number') || (field.type === 'boolean' && typeof parsed !== 'boolean') || (field.type === 'array' && !Array.isArray(parsed)) || (field.type === 'object' && (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)))) throw new Error(); patch(key, { default: parsed }); }
        catch { const message = `${key} 的默认值需要符合所选数据类型。`; setError(message); event.target.setCustomValidity(message); }
      }} /><label className="cfg-required-toggle"><input type="checkbox" checked={(schema.required || []).includes(key)} onChange={event => commit(schema.properties || {}, event.target.checked ? [...(schema.required || []), key] : (schema.required || []).filter(name => name !== key))} />必填</label><button type="button" className="cfg-link-button" aria-label={`删除输入变量 ${key}`} onClick={() => commit(Object.fromEntries(rows.filter(([name]) => name !== key)), (schema.required || []).filter(name => name !== key))}>删除</button></div>
    </div>)}
    {!rows.length && <p className="cfg-description">尚未声明输入变量。添加后可设置类型、默认值与必填项。</p>}
    <button type="button" className="cfg-cancel" onClick={add}>＋ 添加输入变量</button>
    {error && <p className="cfg-error" role="alert">{error}</p>}
  </div>;
}
