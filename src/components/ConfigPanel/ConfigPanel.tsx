import type {
  ConfigSchema,
  Parameters,
  SchemaField,
} from '../../types/workflow';
import type { KnowledgeBase } from '../../types/knowledge';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import useWorkflowStore from '../../store/workflowStore';
import { nodeAPI } from '../../services/api';
import { listKnowledgeBases } from '../../services/knowledgeApi';
import { DEFAULT_NODE_TYPES } from '../../constants/nodeTypes';
import './ConfigPanel.css';

const WHOLE_REFERENCE = /^\s*{{\s*[^{}]+\s*}}\s*$/;
const MODEL_TYPES = new Set(['llm', 'imageGeneration', 'videoGeneration']);
const PRIMARY_FIELDS = new Set(['model', 'prompt', 'systemPrompt', 'messages']);
const TASK_FIELDS = new Set(['videoId', 'waitForCompletion']);

function applyDefaults(
  schema: ConfigSchema | null,
  config: Parameters,
  type = ''
) {
  const next = { ...config };
  Object.entries(schema?.properties || {}).forEach(([key, field]) => {
    if (next[key] === undefined && field.default !== undefined) {
      next[key] = JSON.parse(JSON.stringify(field.default));
    }
    if (
      field.type === 'boolean' &&
      (next[key] === 'true' || next[key] === 'false')
    )
      next[key] = next[key] === 'true';
  });
  if (next.model === 'default' && schema?.properties?.model?.default)
    next.model = schema.properties.model.default;
  // 兼容已有参考图和首尾帧配置，避免添加默认模式后改变节点含义。
  if (type === 'videoGeneration' && !config.mode) {
    if (config.first_frame || config.last_frame) next.mode = 'keyframe';
    else if (
      Array.isArray(config.images) ? config.images.length : config.images
    )
      next.mode = 'reference';
  }
  return next;
}

function usesJSON(key: string, field: SchemaField) {
  return (
    field.format === 'json' ||
    field.type === 'object' ||
    (key === 'messages' && field.type === 'array')
  );
}

function displayValue(key: string, field: SchemaField, value: unknown) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (usesJSON(key, field)) return JSON.stringify(value, null, 2);
  if (Array.isArray(value)) return value.join('\n');
  return String(value);
}

function isURL(value: unknown, httpsOnly = false) {
  if (typeof value !== 'string') return false;
  if (WHOLE_REFERENCE.test(value)) return true;
  try {
    const url = new URL(value);
    return (
      (httpsOnly
        ? url.protocol === 'https:'
        : ['https:', 'http:'].includes(url.protocol)) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function validateConfig(
  schema: ConfigSchema | null,
  draft: Parameters,
  type = ''
) {
  const values = { ...draft };
  const errors: Record<string, string> = {};
  const properties = schema?.properties || {};
  const required = new Set(schema?.required || []);

  Object.entries(properties).forEach(([key, field]) => {
    const inactiveVideoReference =
      type === 'videoGeneration' &&
      draft.mode &&
      ((key === 'images' && draft.mode !== 'reference') ||
        (['first_frame', 'last_frame'].includes(key) &&
          draft.mode !== 'keyframe'));
    if (inactiveVideoReference) return;
    let value = draft[key];
    if (value === '' && field.enum?.includes('')) return;
    if (value === '' || value === undefined || value === null) {
      delete values[key];
      return;
    }
    if (
      typeof value === 'string' &&
      WHOLE_REFERENCE.test(value) &&
      key !== 'model' &&
      !field.enum
    )
      return;
    if (usesJSON(key, field)) {
      if (typeof value === 'string') {
        if (!value.trim()) {
          delete values[key];
          return;
        }
        try {
          value = JSON.parse(value);
        } catch {
          errors[key] = 'JSON 格式有误，请检查引号、逗号和括号。';
          return;
        }
      }
      if (field.type === 'array' && !Array.isArray(value))
        errors[key] = '请填写 JSON 数组。';
      if (
        field.type === 'object' &&
        (!value || typeof value !== 'object' || Array.isArray(value))
      )
        errors[key] = '请填写 JSON 对象。';
      if (key === 'messages' && Array.isArray(value) && !value.length)
        errors[key] = '消息列表至少包含一条消息，或清空后使用提示词。';
      if (
        key === 'messages' &&
        Array.isArray(value) &&
        value.some(
          (message: unknown) =>
            !message ||
            typeof message !== 'object' ||
            Array.isArray(message) ||
            !('role' in message) ||
            !['system', 'user', 'assistant'].includes(String(message.role)) ||
            !(
              'content' in message &&
              (typeof message.content === 'string' ||
                Array.isArray(message.content))
            )
        )
      )
        errors[key] =
          '每条消息需包含 role 和 content，请使用 system、user 或 assistant 角色。';
    } else if (field.type === 'array') {
      if (typeof value === 'string')
        value = value
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean);
      if (!Array.isArray(value))
        errors[key] = '请逐行填写地址，或填写完整的变量引用。';
      else if (key === 'images') {
        if (value.length > (field.maxItems || 5))
          errors[key] = '最多可填写 5 张参考图片。';
        else if (value.some((item) => !isURL(item, type === 'videoGeneration')))
          errors[key] =
            type === 'videoGeneration'
              ? '视频参考图需要 HTTPS 地址，或完整的变量引用。'
              : '请填写有效的图片 URL，或完整的变量引用。';
      }
    } else if (field.type === 'number' || field.type === 'integer') {
      const numericValue = Number(value);
      value = numericValue;
      if (!Number.isFinite(numericValue)) errors[key] = '请填写有效数字。';
      else if (field.type === 'integer' && !Number.isInteger(numericValue))
        errors[key] = '请填写整数。';
      else if (field.minimum !== undefined && numericValue < field.minimum)
        errors[key] = `最小值为 ${field.minimum}。`;
      else if (field.maximum !== undefined && numericValue > field.maximum)
        errors[key] = `最大值为 ${field.maximum}。`;
    } else if (field.type === 'boolean' && typeof value !== 'boolean') {
      errors[key] = '请选择开启或关闭。';
    }
    if (
      field.enum &&
      ((typeof value !== 'string' &&
        typeof value !== 'number' &&
        typeof value !== 'boolean') ||
        !field.enum.includes(value))
    )
      errors[key] =
        key === 'model' ? '请选择目录中的 Flash 模型。' : '请选择有效选项。';
    if (
      key === 'model' &&
      MODEL_TYPES.has(type) &&
      (typeof value !== 'string' || !value.endsWith('-flash'))
    )
      errors[key] = '请选择目录中的 Flash 模型。';
    if (
      typeof value === 'string' &&
      field.maxLength &&
      Array.from(value).length > field.maxLength
    )
      errors[key] = `最多可填写 ${field.maxLength} 个字符。`;
    values[key] = value;
  });

  const hasMessages =
    (typeof values.messages === 'string' &&
      WHOLE_REFERENCE.test(values.messages)) ||
    (Array.isArray(values.messages) && values.messages.length > 0);
  const existingVideo =
    type === 'videoGeneration' && Boolean(String(values.videoId || '').trim());
  required.forEach((key) => {
    if (key === 'prompt' && (hasMessages || existingVideo)) return;
    const value = values[key];
    if (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && !value.trim()) ||
      (Array.isArray(value) && !value.length)
    )
      errors[key] = '请填写此项。';
  });
  if (type === 'llm' && !hasMessages && !String(values.prompt || '').trim())
    errors.prompt = '填写提示词，或在消息列表中提供输入。';
  if (
    (type === 'imageGeneration' ||
      (type === 'videoGeneration' && !existingVideo)) &&
    !String(values.prompt || '').trim()
  )
    errors.prompt = '请描述你想生成的内容。';
  if (type === 'videoGeneration' && !existingVideo) {
    if (
      values.mode === 'reference' &&
      !(Array.isArray(values.images) ? values.images.length : values.images)
    )
      errors.images = '参考图模式需要至少一张图片。';
    if (values.mode === 'keyframe' && !values.first_frame && !values.last_frame)
      errors.first_frame = '请填写首帧或尾帧图片。';
    ['first_frame', 'last_frame'].forEach((key) => {
      if (
        (!values.mode || values.mode === 'keyframe') &&
        values[key] &&
        !isURL(values[key], true)
      )
        errors[key] = '请填写 HTTPS 图片地址，或完整的变量引用。';
    });
    if (
      !values.mode &&
      (values.first_frame || values.last_frame) &&
      (Array.isArray(values.images) ? values.images.length : values.images)
    )
      errors.images = '参考图和首尾帧请选择其中一种。';
  }
  // 隐藏的其他模式参数只保留在草稿，保存时不混入当前请求。
  if (type === 'videoGeneration') {
    if (values.mode && values.mode !== 'reference') delete values.images;
    if (values.mode && values.mode !== 'keyframe') {
      delete values.first_frame;
      delete values.last_frame;
    }
  }
  return { values, errors };
}

const ConfigPanel = () => {
  const { selectedNode, updateNode, isConfigPanelOpen, toggleConfigPanel } =
    useWorkflowStore();
  const [nodeConfig, setNodeConfig] = useState<Parameters>({});
  const [nodeName, setNodeName] = useState('');
  const [schema, setSchema] = useState<ConfigSchema | null>(null);
  const [loading, setLoading] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [attempted, setAttempted] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeError, setKnowledgeError] = useState('');
  const [knowledgeReload, setKnowledgeReload] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const nodeId = selectedNode?.id;
  const nodeData = selectedNode?.data;
  const type = nodeData?.type || '';
  const metadata = DEFAULT_NODE_TYPES.find((node) => node.type === type);

  useEffect(() => {
    if (nodeId === undefined || !isConfigPanelOpen) return;
    let active = true;
    const nodeType = nodeData?.type || '';
    const initial = nodeData?.config || {};
    const localSchema = DEFAULT_NODE_TYPES.find(
      (node) => node.type === nodeType
    )?.config_schema || { properties: {}, required: [] };
    setNodeName(nodeData?.label || '');
    setNodeConfig(applyDefaults(localSchema, initial, nodeType));
    setSchema(localSchema);
    setTouched({});
    setAttempted(false);
    setFallback(false);
    setLoading(true);
    // 节点切换后丢弃旧响应，防止慢请求覆盖当前节点草稿。
    nodeAPI
      .getNodeSchema(nodeType)
      .then((response) => {
        if (!active) return;
        const nextSchema = response.data?.properties
          ? response.data
          : localSchema;
        setSchema(nextSchema);
        setNodeConfig(applyDefaults(nextSchema, initial, nodeType));
        setFallback(!response.data?.properties);
      })
      .catch(() => {
        if (active) setFallback(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [nodeId, nodeData, isConfigPanelOpen]);

  useEffect(() => {
    if (type !== 'knowledgeRetrieval' || !isConfigPanelOpen) return;
    let active = true;
    const controller = new AbortController();
    setKnowledgeLoading(true);
    setKnowledgeError('');
    setKnowledgeBases([]);
    listKnowledgeBases({}, { signal: controller.signal })
      .then((bases) => {
        if (active)
          setKnowledgeBases(bases.filter((base) => base.enabled !== false));
      })
      .catch(() => {
        if (active) setKnowledgeError('知识库列表加载失败，请重试。');
      })
      .finally(() => {
        if (active) setKnowledgeLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [type, nodeId, isConfigPanelOpen, knowledgeReload]);

  const validation = useMemo(() => {
    const result = validateConfig(schema, nodeConfig, type);
    if (type === 'knowledgeRetrieval') {
      if (knowledgeLoading) result.errors.datasetId = '正在加载知识库。';
      else if (knowledgeError) result.errors.datasetId = knowledgeError;
      else if (
        result.values.datasetId &&
        !knowledgeBases.some((base) => base.id === result.values.datasetId)
      )
        result.errors.datasetId = '请选择当前账号已启用的知识库。';
    }
    return result;
  }, [
    schema,
    nodeConfig,
    type,
    knowledgeBases,
    knowledgeLoading,
    knowledgeError,
  ]);
  const properties = schema?.properties || {};
  const updateField = (key: string, value: unknown) => {
    setNodeConfig((current) => ({ ...current, [key]: value }));
    setTouched((current) => ({ ...current, [key]: true }));
  };
  const closePanel = () => {
    if (isConfigPanelOpen) toggleConfigPanel();
  };
  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAttempted(true);
    if (
      !selectedNode ||
      loading ||
      (type === 'knowledgeRetrieval' && knowledgeLoading)
    )
      return;
    if (!nodeName.trim() || Object.keys(validation.errors).length) {
      formRef.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
      return;
    }
    updateNode(selectedNode.id, {
      data: {
        ...selectedNode.data,
        label: nodeName.trim(),
        config: validation.values,
      },
    });
    closePanel();
  };

  const renderField = ([key, field]: [string, SchemaField]) => {
    if (!selectedNode) return null;
    const mode = nodeConfig.mode;
    if (
      type === 'videoGeneration' &&
      mode &&
      ((key === 'images' && mode !== 'reference') ||
        (['first_frame', 'last_frame'].includes(key) && mode !== 'keyframe'))
    )
      return null;
    const value = nodeConfig[key];
    const json = usesJSON(key, field);
    const error = validation.errors[key];
    const visibleError = Boolean(
      error &&
        (touched[key] ||
          attempted ||
          (key === 'datasetId' && (value || knowledgeError)) ||
          (key === 'model' && value) ||
          (json && String(value || '').trim()))
    );
    const id = `cfg-${selectedNode.id}-${key}`;
    const common = {
      id,
      'aria-invalid': Boolean(error),
      'aria-describedby': `${id}-help${visibleError ? ` ${id}-error` : ''}`,
    };
    let control;
    if (type === 'knowledgeRetrieval' && key === 'datasetId') {
      control = (
        <div className="cfg-select-wrap">
          <select
            {...common}
            className="cfg-select"
            value={displayValue(key, field, value)}
            disabled={knowledgeLoading || Boolean(knowledgeError)}
            onChange={(event) => updateField(key, event.target.value)}
          >
            <option value="" disabled>
              {knowledgeLoading ? '正在加载知识库…' : '请选择知识库'}
            </option>
            {Boolean(value) &&
              !knowledgeBases.some((base) => base.id === value) && (
                <option value={displayValue(key, field, value)} disabled>
                  原知识库不可用，请重新选择
                </option>
              )}
            {knowledgeBases.map((base) => (
              <option key={base.id} value={base.id}>
                {base.name}
              </option>
            ))}
          </select>
          {knowledgeError && (
            <button
              type="button"
              className="cfg-cancel"
              onClick={() => setKnowledgeReload((current) => current + 1)}
            >
              重试加载知识库
            </button>
          )}
        </div>
      );
    } else if (field.type === 'boolean') {
      control = (
        <label className="cfg-switch" htmlFor={id}>
          <input
            {...common}
            type="checkbox"
            checked={value === true}
            onChange={(event) => updateField(key, event.target.checked)}
          />
          <span className="cfg-switch-track" aria-hidden="true" />
          <span className="cfg-switch-state">
            {value === true ? '已开启' : '已关闭'}
          </span>
        </label>
      );
    } else if (field.enum || (key === 'model' && MODEL_TYPES.has(type))) {
      const choices = (field.enum || []).filter(
        (option): option is string | number =>
          (typeof option === 'string' || typeof option === 'number') &&
          (key !== 'model' || String(option).endsWith('-flash'))
      );
      control = (
        <div className="cfg-select-wrap">
          <select
            {...common}
            className="cfg-select"
            value={displayValue(key, field, value)}
            onChange={(event) => updateField(key, event.target.value)}
          >
            {!choices.some(
              (option) => String(option) === String(value ?? '')
            ) && (
              <option value={displayValue(key, field, value)} disabled>
                {value ? `当前选项不可用 · ${value}` : '请选择'}
              </option>
            )}
            {choices.map((option) => (
              <option key={option} value={option}>
                {field.enumNames?.[field.enum?.indexOf(option) ?? -1] || option}
              </option>
            ))}
          </select>
        </div>
      );
    } else if (json || field.type === 'array' || field.format === 'textarea') {
      let placeholder = field.description || '支持 {{input.question}} 等变量';
      if (json)
        placeholder =
          key === 'messages'
            ? '[{"role":"user","content":"{{input.question}}"}]'
            : '填写 JSON，或完整的变量引用';
      else if (field.type === 'array')
        placeholder = '每行一个图片 URL\n或 {{nodes.image-1.output.urls}}';
      control = (
        <textarea
          {...common}
          className={`cfg-textarea${json ? ' cfg-code' : ''}`}
          value={displayValue(key, field, value)}
          onChange={(event) => updateField(key, event.target.value)}
          rows={json || key === 'prompt' ? 5 : 3}
          spellCheck={!json}
          placeholder={placeholder}
        />
      );
    } else {
      const numeric = field.type === 'number' || field.type === 'integer';
      control = (
        <input
          {...common}
          className="cfg-input"
          type={numeric ? 'number' : 'text'}
          value={displayValue(key, field, value)}
          onChange={(event) => updateField(key, event.target.value)}
          min={field.minimum}
          max={field.maximum}
          step={field.type === 'integer' ? 1 : numeric ? 0.1 : undefined}
          placeholder={field.description || ''}
        />
      );
    }
    const fieldLabels: Record<string, string> = {
      array: 'URL / 变量',
      boolean: '开关',
      integer: '数值',
      number: '数值',
    };
    const defaultDescriptions: Record<string, string> = {
      images: '逐行填写地址，整值变量会保留数组类型。',
      videoId: '填写已有任务 ID 可继续查询。',
      messages: '留空时使用提示词。',
    };
    return (
      <div
        className={`cfg-field${visibleError ? ' cfg-field-error' : ''}`}
        key={key}
      >
        <div className="cfg-field-heading">
          <label className="cfg-label" htmlFor={id}>
            {field.title || key}
            {schema?.required?.includes(key) && (
              <span className="cfg-required" aria-hidden="true">
                *
              </span>
            )}
          </label>
          <span className="cfg-field-type">
            {json ? 'JSON' : fieldLabels[field.type || ''] || ''}
          </span>
        </div>
        {control}
        <p className="cfg-description" id={`${id}-help`}>
          {type === 'knowledgeRetrieval' &&
          key === 'datasetId' &&
          !knowledgeLoading &&
          !knowledgeError &&
          !knowledgeBases.length
            ? '还没有已启用的知识库，请先在知识库中创建资料。'
            : field.description || defaultDescriptions[key] || ''}
        </p>
        {visibleError && (
          <p className="cfg-error" id={`${id}-error`} role="alert">
            {error}
          </p>
        )}
      </div>
    );
  };

  if (!isConfigPanelOpen || !selectedNode) return null;
  const entries = Object.entries(properties);
  const groups = MODEL_TYPES.has(type)
    ? [
        {
          title: '模型与输入',
          subtitle: '连接想法与生成能力',
          fields: entries.filter(([key]) => PRIMARY_FIELDS.has(key)),
        },
        {
          title: '生成设置',
          subtitle: '调整本节点的输出',
          fields: entries.filter(
            ([key]) => !PRIMARY_FIELDS.has(key) && !TASK_FIELDS.has(key)
          ),
        },
        {
          title: '任务控制',
          subtitle: '等待结果或复用已有任务',
          fields: entries.filter(([key]) => TASK_FIELDS.has(key)),
        },
      ]
    : [{ title: '运行参数', subtitle: '', fields: entries }];

  return (
    <aside className="cfg-panel" aria-label="节点配置">
      <header className="cfg-header">
        <div>
          <span className="cfg-eyebrow">节点配置</span>
          <h3>{metadata?.name || type || '配置节点'}</h3>
        </div>
        <button
          className="cfg-close"
          type="button"
          onClick={closePanel}
          aria-label="关闭节点配置"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="m5 5 10 10M15 5 5 15" />
          </svg>
        </button>
      </header>
      <form className="cfg-form" onSubmit={handleSave} noValidate ref={formRef}>
        <div className="cfg-body">
          <section className="cfg-identity">
            <div className="cfg-node-meta">
              <span className="cfg-node-badge">{metadata?.icon || '◇'}</span>
              <div>
                <span className="cfg-node-type">{type}</span>
                <span className="cfg-node-id" title={selectedNode.id}>
                  #{selectedNode.id}
                </span>
              </div>
            </div>
            <label className="cfg-label" htmlFor="cfg-node-name">
              节点名称
            </label>
            <input
              id="cfg-node-name"
              className="cfg-input"
              value={nodeName}
              onChange={(event) => setNodeName(event.target.value)}
              placeholder="为这个步骤起个名字"
              aria-invalid={!nodeName.trim()}
            />
            {attempted && !nodeName.trim() && (
              <p className="cfg-error" role="alert">
                请输入节点名称。
              </p>
            )}
          </section>
          <details className="cfg-variable-guide">
            <summary>
              <span>使用变量引用</span>
              <span className="cfg-variable-symbol">{'{{ }}'}</span>
            </summary>
            <p>在参数中连接运行输入或上游结果。</p>
            <code>{'{{input.question}}'}</code>
            <code>{'{{variables.brand}}'}</code>
            <code>{'{{nodes.llm-1.output.text}}'}</code>
            <p>完整引用会保留数组、对象等原值类型。</p>
          </details>
          {fallback && (
            <div className="cfg-notice" role="status">
              模型目录暂不可用，已加载预设参数。
            </div>
          )}
          {loading ? (
            <div className="cfg-loading" role="status">
              <span />
              正在加载节点参数…
            </div>
          ) : (
            groups.map(
              (group) =>
                group.fields.length > 0 && (
                  <section className="cfg-section" key={group.title}>
                    <div className="cfg-section-heading">
                      <h4>{group.title}</h4>
                      <p>{group.subtitle}</p>
                    </div>
                    {group.fields.map(renderField)}
                  </section>
                )
            )
          )}
          {!loading && !entries.length && (
            <div className="cfg-empty">
              <span>✓</span>
              <h4>准备就绪</h4>
              <p>该节点按工作流输入执行，可直接保存。</p>
            </div>
          )}
        </div>
        <footer className="cfg-footer">
          <p>应用到当前节点后，保存工作流即可生效。</p>
          <div className="cfg-footer-actions">
            <button className="cfg-cancel" type="button" onClick={closePanel}>
              取消
            </button>
            <button
              className="cfg-save"
              type="submit"
              disabled={
                loading || (type === 'knowledgeRetrieval' && knowledgeLoading)
              }
            >
              <svg viewBox="0 0 18 18" aria-hidden="true">
                <path d="m4 9 3 3 7-7" />
              </svg>
              保存配置
            </button>
          </div>
        </footer>
      </form>
    </aside>
  );
};

export default ConfigPanel;
