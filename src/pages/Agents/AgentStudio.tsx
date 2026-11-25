import { useLabels } from '../../store/languageStore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  FiArrowLeft,
  FiCheck,
  FiChevronDown,
  FiCloud,
  FiDownload,
  FiFilm,
  FiImage,
  FiLayers,
  FiPlay,
  FiRefreshCw,
  FiSave,
  FiSend,
  FiSquare,
  FiZap,
} from 'react-icons/fi';
import useAuthStore from '../../store/authStore';
import { agentAPI, downloadBlob } from '../../services/agentApi';
import SendToPublisher from '../../components/SendToPublisher';
import { storyboardResultDraft } from '../../publishing/resultDrafts';
import type {
  AgentCatalog,
  AgentDraft,
  AgentExportFormat,
  AgentProject,
  AgentScene,
  AgentSceneResult,
  AgentSettings,
} from '../../types/agent';
import { AgentMedia, errorMessage, isActive, statusLabel } from './AgentShared';
import './Agents.css';

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  maximum: number,
): string[] {
  const lines: string[] = [];
  let line = '';
  for (const character of Array.from(text)) {
    if (
      character === '\n' ||
      context.measureText(line + character).width > maximum
    ) {
      lines.push(line);
      line = character === '\n' ? '' : character;
    } else line += character;
  }
  if (line) lines.push(line);
  return lines;
}

async function exportComic(
  project: AgentProject,
  signal: AbortSignal,
): Promise<void> {
  if (!project.draft) throw new Error('请先设计漫画分镜');
  const frames: { image: ImageBitmap; caption: string; height: number }[] = [];
  try {
    for (const scene of project.draft.scenes) {
      const result = project.results.find(
        (item) => item.sceneId === scene.id && !item.stale,
      );
      if (!result?.imageUrl)
        throw new Error('请先完成全部漫画画面，再导出长图');
      const image = await createImageBitmap(
        await agentAPI.asset(result.imageUrl, signal),
      );
      frames.push({
        image,
        caption: scene.caption,
        height: Math.round((1000 * image.height) / image.width),
      });
      if (signal.aborted) throw new DOMException('导出已停止', 'AbortError');
    }
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height =
      180 + frames.reduce((sum, frame) => sum + frame.height + 140, 0);
    const context = canvas.getContext('2d');
    if (!context)
      throw new Error('当前浏览器暂不支持长图导出，请使用 HTML 或 ZIP');
    context.fillStyle = '#f4f6ec';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#193b2d';
    context.font = 'bold 46px "Microsoft YaHei", sans-serif';
    wrapCanvasText(context, project.draft.title, 980)
      .slice(0, 2)
      .forEach((line, index) => context.fillText(line, 45, 70 + index * 58));
    let y = 180;
    for (const frame of frames) {
      const captionTop = y + 43;
      context.fillStyle = 'white';
      context.fillRect(40, y, 1000, frame.height + 100);
      context.fillStyle = '#193b2d';
      context.font = '600 34px "Microsoft YaHei", sans-serif';
      wrapCanvasText(context, frame.caption, 920)
        .slice(0, 2)
        .forEach((line, index) =>
          context.fillText(line, 75, captionTop + index * 41),
        );
      context.drawImage(frame.image, 40, y + 100, 1000, frame.height);
      y += frame.height + 140;
    }
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) =>
          result ? resolve(result) : reject(new Error('长图生成失败')),
        'image/png',
      ),
    );
    if (!signal.aborted)
      downloadBlob(blob, `${project.draft.title || project.name}.png`);
  } finally {
    frames.forEach((frame) => frame.image.close());
  }
}

function SceneEditor({
  scene,
  result,
  comic,
  disabled,
  onChange,
  onRegenerate,
}: {
  scene: AgentScene;
  result?: AgentSceneResult;
  comic: boolean;
  disabled: boolean;
  onChange: (value: Partial<AgentScene>) => void;
  onRegenerate: () => void;
}): React.JSX.Element {
  const t = useLabels();
  return (
    <article className={`agent-scene-card ${comic ? 'comic' : 'life'}`}>
      <div className="agent-scene-top">
        <span>{scene.stage || scene.title || t("连续分镜", "Storyboard")}</span>
        <span
          className={
            result?.status === 'completed' && !result.stale ? 'done' : ''
          }
        >
          {result?.stale
            ? t("画面已变更，待重做", "Image changed. Regenerate to apply.")
            : result
              ? statusLabel(result.status)
              : t("等待生成", "Waiting")}
        </span>
      </div>
      {comic && (
        <p className="agent-comic-caption">
          {scene.caption || t("写一句和画面呼应的短文案", "Write a caption for this panel")}
        </p>
      )}
      <div className="agent-scene-media">
        <AgentMedia
          url={comic ? result?.imageUrl : result?.videoUrl || result?.imageUrl}
          video={!comic && (!result?.imageUrl || Boolean(result?.videoUrl))}
          alt={scene.title || scene.caption}
        />
      </div>
      <div className="agent-scene-fields">
        <label>
          {t("分镜标题", "Panel title")}
          <input
            aria-label={`${scene.id} 分镜标题`}
            value={scene.title}
            disabled={disabled}
            onChange={(event) => onChange({ title: event.target.value })}
            maxLength={120}
          />
        </label>
        {comic ? (
          <label>
            {t("画面文案", "Caption")} <small>{t("4–24 字", "4–24 characters")}</small>
            <input
              aria-label={`${scene.id} 画面文案`}
              value={scene.caption}
              disabled={disabled}
              maxLength={24}
              onChange={(event) => onChange({ caption: event.target.value })}
            />
          </label>
        ) : (
          <>
            <label>
              {t("人生阶段", "Life stage")}
              <input
                aria-label={`${scene.id} 人生阶段`}
                value={scene.stage}
                disabled={disabled}
                onChange={(event) => onChange({ stage: event.target.value })}
              />
            </label>
            <label>
              {t("旁白与字幕", "Narration and subtitles")}
              <textarea
                aria-label={`${scene.id} 旁白`}
                rows={3}
                value={scene.narration}
                disabled={disabled}
                maxLength={1000}
                onChange={(event) =>
                  onChange({ narration: event.target.value })
                }
              />
            </label>
            <label>
              {t("时长", "Duration")}
              <select
                aria-label={`${scene.id} 时长`}
                value={scene.durationSeconds}
                disabled={disabled}
                onChange={(event) =>
                  onChange({ durationSeconds: Number(event.target.value) })
                }
              >
                {Array.from({ length: 9 }, (_, index) => index + 4).map(
                  (seconds) => (
                    <option key={seconds} value={seconds}>
                      {seconds} {t("秒", "seconds")}
                    </option>
                  ),
                )}
              </select>
            </label>
          </>
        )}
        <details>
          <summary>{t("调整画面提示词", "Edit image prompt")}</summary>
          {(comic || scene.imagePrompt) && (
            <label>
              {t("图片描述", "Image description")}
              <textarea
                aria-label={`${scene.id} 图片提示词`}
                rows={4}
                disabled={disabled}
                value={scene.imagePrompt}
                maxLength={6000}
                onChange={(event) =>
                  onChange({ imagePrompt: event.target.value })
                }
              />
            </label>
          )}
          {!comic && (
            <label>
              {t("视频动作与镜头", "Video motion and framing")}
              <textarea
                aria-label={`${scene.id} 视频提示词`}
                rows={4}
                value={scene.videoPrompt}
                disabled={disabled}
                maxLength={6000}
                onChange={(event) =>
                  onChange({ videoPrompt: event.target.value })
                }
              />
            </label>
          )}
        </details>
        {result?.error && (
          <p className="agent-scene-error" role="alert">
            {errorMessage(new Error(result.error))}
          </p>
        )}
        {result?.videoId && (
          <small className="agent-task-note">{t("分镜任务已保存，可继续查询", "Storyboard job saved. You can check its progress.")}</small>
        )}
        <button
          type="button"
          className="btn btn-default"
          disabled={disabled}
          onClick={onRegenerate}
        >
          <FiRefreshCw />
          {comic ? t("重新绘制这一格", "Redraw panel") : t("重新生成这一镜", "Regenerate shot")}
        </button>
      </div>
    </article>
  );
}

export default function AgentStudio(): React.JSX.Element {
  const t = useLabels();
  const { id = '' } = useParams<{ id: string }>();
  const loggedIn = useAuthStore((state) => state.isLoggedIn);
  const [project, setProject] = useState<AgentProject | null>(null);
  const [catalog, setCatalog] = useState<AgentCatalog | null>(null);
  const [draft, setDraft] = useState<AgentDraft | null>(null);
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [name, setName] = useState('');
  const [brief, setBrief] = useState('');
  const [command, setCommand] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<'storyboard' | 'preview'>('storyboard');
  const [exporting, setExporting] = useState(false);
  const [directorOpen, setDirectorOpen] = useState(true);
  const designController = useRef<AbortController | null>(null);
  const sessionController = useRef<AbortController | null>(null);
  const active = project?.id === id && isActive(project.job?.status);
  const disabled = busy || active || exporting;
  const comic = project?.agentId === 'cloud-comic';
  const designed =
    project?.job?.kind === 'design' && project.job.status === 'completed';
  const dirty = Boolean(
    project &&
    (name !== project.name ||
      brief !== project.brief ||
      JSON.stringify(settings) !== JSON.stringify(project.settings) ||
      JSON.stringify(draft) !== JSON.stringify(project.draft)),
  );
  const apply = useCallback((value: AgentProject) => {
    setProject(value);
    setDraft(value.draft);
    setSettings(value.settings);
    setName(value.name);
    setBrief(value.brief);
  }, []);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!loggedIn) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const [value, available] = await Promise.all([
          agentAPI.get(id, signal),
          agentAPI.catalog(signal),
        ]);
        if (!signal?.aborted) {
          apply(value);
          setDirectorOpen(!value.draft);
          setCatalog(available);
        }
      } catch (failure) {
        if (!signal?.aborted) setError(errorMessage(failure));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [id, loggedIn, apply],
  );
  useEffect(() => {
    const controller = new AbortController();
    sessionController.current = controller;
    setProject(null);
    setBusy(false);
    setExporting(false);
    setNotice('');
    setCommand('');
    setTab('storyboard');
    void load(controller.signal);
    return () => {
      controller.abort();
      designController.current?.abort();
      designController.current = null;
    };
  }, [load]);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    let pending = false;
    const timer = setInterval(() => {
      if (pending) return;
      pending = true;
      agentAPI
        .status(id, controller.signal)
        .then(async (status) => {
          if (controller.signal.aborted) return;
          if (!isActive(status.job?.status)) {
            const complete = await agentAPI.get(id, controller.signal);
            if (!controller.signal.aborted) apply(complete);
          } else
            setProject((value) =>
              value
                ? {
                    ...value,
                    job: status.job,
                    results: status.results,
                    output: status.output,
                  }
                : value,
            );
        })
        .catch((failure) => {
          if (!controller.signal.aborted) setError(errorMessage(failure));
        })
        .finally(() => {
          pending = false;
        });
    }, 2000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [active, id, apply]);
  const persist = async (signal: AbortSignal): Promise<AgentProject> => {
    if (!project || !settings) throw new Error(t("请先等待作品加载完成", "Wait for the project to load"));
    if (!dirty) return project;
    const updated = await agentAPI.update(id, {
      name,
      brief,
      settings,
      draft,
      revision: project.revision,
    });
    if (signal.aborted) throw new DOMException(t("请求已停止", "Request stopped"), 'AbortError');
    apply(updated);
    return updated;
  };
  const save = async () => {
    const session = sessionController.current;
    if (!session || session.signal.aborted) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await persist(session.signal);
      if (!session.signal.aborted) setNotice(t("修改已保存", "Changes saved"));
    } catch (failure) {
      if (!session.signal.aborted) setError(errorMessage(failure));
    } finally {
      if (!session.signal.aborted) setBusy(false);
    }
  };
  const design = async () => {
    const session = sessionController.current;
    if (!session || session.signal.aborted) return;
    const message = command.trim() || brief.trim();
    if (!message) {
      setError(t("先写一个想创作的主题或调整要求", "Enter a story idea or revision request"));
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    const controller = new AbortController();
    designController.current = controller;
    try {
      await persist(controller.signal);
      if (controller.signal.aborted) return;
      const designed = await agentAPI.design(id, message, controller.signal);
      if (controller.signal.aborted) return;
      apply(designed);
      setDirectorOpen(false);
      setCommand('');
      setNotice(t("分镜已更新，可以逐格调整后再开始生成", "Storyboard updated. Review the panels before generating."));
      setTab('storyboard');
    } catch (failure) {
      if (!controller.signal.aborted) setError(errorMessage(failure));
    } finally {
      if (designController.current === controller) {
        designController.current = null;
        if (!session.signal.aborted) {
          if (controller.signal.aborted)
            setNotice(t("已停止本次构思，当前分镜已保留", "Planning stopped. Your current storyboard is saved."));
          setBusy(false);
        }
      }
    }
  };
  const run = async (sceneId?: string) => {
    const session = sessionController.current;
    if (!session || session.signal.aborted) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await persist(session.signal);
      if (session.signal.aborted) return;
      const running = await agentAPI.run(
        id,
        sceneId ? { sceneId, regenerate: true } : {},
      );
      if (!session.signal.aborted) apply(running);
    } catch (failure) {
      if (!session.signal.aborted) setError(errorMessage(failure));
    } finally {
      if (!session.signal.aborted) setBusy(false);
    }
  };
  const cancel = async () => {
    const session = sessionController.current;
    if (!session || session.signal.aborted) return;
    setBusy(true);
    setError('');
    try {
      const cancelled = await agentAPI.cancel(id);
      if (session.signal.aborted) return;
      apply(cancelled);
      setNotice(t("停止请求已提交，已完成素材会保留", "Stop requested. Completed assets will be kept."));
    } catch (failure) {
      if (!session.signal.aborted) setError(errorMessage(failure));
    } finally {
      if (!session.signal.aborted) setBusy(false);
    }
  };
  const exportFile = async (format: AgentExportFormat | 'comic' | 'video') => {
    const session = sessionController.current;
    if (!project || !session || session.signal.aborted) return;
    setExporting(true);
    setError('');
    try {
      const latest = dirty ? await persist(session.signal) : project;
      if (session.signal.aborted) return;
      if (format === 'comic') await exportComic(latest, session.signal);
      else if (format === 'video') {
        if (!latest.output.videoUrl) throw new Error(t("请先完成视频合成", "Finish assembling the video first"));
        const blob = await agentAPI.asset(
          latest.output.videoUrl,
          session.signal,
        );
        if (!session.signal.aborted)
          downloadBlob(blob, `${latest.draft?.title || name}.mp4`);
      } else {
        const blob = await agentAPI.export(id, format);
        if (!session.signal.aborted)
          downloadBlob(
            blob,
            `${latest.draft?.title || name}.${format === 'markdown' ? 'md' : format}`,
          );
      }
    } catch (failure) {
      if (!session.signal.aborted) setError(errorMessage(failure));
    } finally {
      if (!session.signal.aborted) setExporting(false);
    }
  };
  const editScene = (sceneId: string, changes: Partial<AgentScene>) =>
    setDraft((value) =>
      value
        ? {
            ...value,
            scenes: value.scenes.map((scene) =>
              scene.id === sceneId ? { ...scene, ...changes } : scene,
            ),
          }
        : value,
    );
  const editSetting = <K extends keyof AgentSettings>(
    key: K,
    value: AgentSettings[K],
  ) =>
    setSettings((current) =>
      current ? { ...current, [key]: value } : current,
    );
  if (!loggedIn)
    return (
      <main className="agent-page">
        <Link to="/agents">
          <FiArrowLeft /> {t("返回智能体", "Back to agents")}
        </Link>
        <div className="agent-empty">
          <h1>{t("登录后进入创作工作室", "Sign in to open the studio")}</h1>
          <Link className="btn btn-primary" to="/login">
            {t("前往登录", "Sign in")}
          </Link>
        </div>
      </main>
    );
  if (loading)
    return (
      <main className="agent-page agent-empty" role="status">
        {t("正在打开创作工作室…", "Opening studio…")}
      </main>
    );
  if (!project || !settings)
    return (
      <main className="agent-page">
        <p className="agent-error" role="alert">
          {error || t("作品暂时无法读取", "Could not load this project")}
        </p>
        <button className="btn btn-primary" onClick={() => void load()}>
          {t("重新读取", "Reload")}
        </button>
        <Link to="/agents">{t("返回作品列表", "Back to projects")}</Link>
      </main>
    );
  const completed = project.results.filter(
    (result) =>
      result.status === 'completed' && !result.stale && !result.orphaned,
  ).length;
  const publishingDraft = !dirty && !active && !busy ? storyboardResultDraft(project) : null;
  return (
    <main className="agent-studio">
      <header className="agent-studio-header">
        <div>
          <Link className="agent-back" to="/agents">
            <FiArrowLeft /> {t("我的智能体", "My agents")}
          </Link>
          <div className="agent-studio-title">
            {comic ? <FiCloud /> : <FiFilm />}
            <input
              aria-label={t("作品名称", "Project name")}
              value={name}
              maxLength={120}
              disabled={disabled}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <small>
            {comic ? t("云朵漫画工作室", "Cloud Comic studio") : t("人生副本工作室", "Life Story studio")} <span>·</span>{' '}
            {dirty ? t("有未保存的修改", "Unsaved changes") : t("修改已保存", "Changes saved")}
          </small>
        </div>
        <div className="agent-studio-actions">
          <button
            className="btn btn-default"
            disabled={disabled || !dirty}
            onClick={() => void save()}
          >
            <FiSave /> {t("保存", "Save")}
          </button>
          {active ? (
            <button
              className="btn btn-default"
              disabled={busy || project.job?.status === 'cancelling'}
              onClick={() => void cancel()}
            >
              <FiSquare /> {t("停止生成", "Stop generation")}
            </button>
          ) : (
            <button
              className="btn btn-primary"
              disabled={busy || !draft}
              onClick={() => void run()}
            >
              <FiPlay />
              {project.results.length
                ? t("继续生成 / 合成", "Resume generation / assembly")
                : comic
                  ? t("生成漫画画面", "Generate comic panels")
                  : t("生成分镜视频", "Generate video shots")}
            </button>
          )}
        </div>
      </header>
      {error && (
        <div className="agent-error" role="alert">
          {error}
          <button onClick={() => setError('')} aria-label={t("关闭错误提示", "Dismiss error")}>
            ×
          </button>
        </div>
      )}
      {notice && (
        <p className="agent-notice" role="status">
          <FiCheck />
          {notice}
        </p>
      )}
      <div className="agent-studio-layout">
        <button
          type="button"
          className="agent-director-toggle"
          aria-expanded={directorOpen}
          aria-controls="agent-director"
          onClick={() => setDirectorOpen((value) => !value)}
        >
          <FiZap /> {t("创作设置与对话", "Creative settings and chat")}
          <FiChevronDown className={directorOpen ? 'is-open' : ''} />
        </button>
        <aside
          id="agent-director"
          aria-label={t("创作设置与对话", "Creative settings and chat")}
          className={`agent-director ${directorOpen ? 'is-open' : ''}`}
        >
          <div className="agent-panel-title">
            <FiZap />
            <h2>{t("创作导演", "Story director")}</h2>
          </div>
          <label>
            {t("这次想讲什么故事？", "What story would you like to tell?")}
            <textarea
              aria-label={t("创作主题", "Story idea")}
              rows={4}
              value={brief}
              disabled={disabled}
              maxLength={8000}
              placeholder={
                comic
                  ? t("例如：周一上班，想认真工作的小云朵被各种小事打断，最后学会给自己喘口气。", "For example, on Monday a little cloud tries to work, gets interrupted and learns to pause.")
                  : t("例如：程序员的一生，从写出第一行代码，到中年转身，再到重新找到生活。", "For example, follow a programmer from their first line of code to a midlife change of career.")
              }
              onChange={(event) => setBrief(event.target.value)}
            />
          </label>
          <div className="agent-settings-row">
            <label>
              {t("分镜数量", "Number of panels")}
              <select
                aria-label={t("分镜数量", "Number of panels")}
                disabled={disabled || Boolean(draft)}
                value={settings.sceneCount}
                onChange={(event) =>
                  editSetting('sceneCount', Number(event.target.value))
                }
              >
                {Array.from(
                  { length: comic ? 3 : 20 },
                  (_, index) => index + (comic ? 3 : 1),
                ).map((count) => (
                  <option key={count} value={count}>
                    {count} {comic ? t("格", "panels") : t("镜", "shots")}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("画面比例", "Aspect ratio")}
              <select
                aria-label={t("画面比例", "Aspect ratio")}
                disabled={disabled}
                value={settings.aspectRatio}
                onChange={(event) =>
                  editSetting('aspectRatio', event.target.value)
                }
              >
                {(comic
                  ? ['3:4', '1:1', '4:3', '16:9', '9:16']
                  : ['16:9', '9:16', '4:3', '1:1', '3:4', '21:9']
                ).map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>
          {draft && (
            <small className="agent-help">
              {t("分镜数量已随草稿确定。可以逐镜修改，或新建作品尝试其他长度。", "The draft sets the panel count. Edit individual shots or start another project for a different length.")}
            </small>
          )}
          {!comic && (
            <div className="agent-settings-row">
              <label>
                {t("每镜时长", "Shot duration")}
                <select
                  aria-label={t("默认分镜时长", "Default shot duration")}
                  disabled={disabled}
                  value={settings.durationSeconds}
                  onChange={(event) =>
                    editSetting('durationSeconds', Number(event.target.value))
                  }
                >
                  {Array.from({ length: 9 }, (_, index) => index + 4).map(
                    (value) => (
                      <option key={value} value={value}>
                        {value} {t("秒", "seconds")}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <div className="agent-duration">
                <b>
                  {draft
                    ? draft.scenes.reduce(
                        (sum, scene) => sum + scene.durationSeconds,
                        0,
                      )
                    : settings.durationSeconds * settings.sceneCount}
                </b>
                <span>{t("预计成片秒数", "Estimated video length in seconds")}</span>
              </div>
            </div>
          )}
          <label>
            {t("文本模型", "Text model")}
            <select
              aria-label={t("文本模型", "Text model")}
              value={settings.textModel}
              disabled={disabled}
              onChange={(event) => editSetting('textModel', event.target.value)}
            >
              {(catalog?.models.text || [settings.textModel]).map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          {(comic || settings.generateSceneImages) && (
            <>
              <label>
                {t("图片模型", "Image model")}
                <select
                  aria-label={t("图片模型", "Image model")}
                  value={settings.imageModel}
                  disabled={disabled}
                  onChange={(event) =>
                    editSetting('imageModel', event.target.value)
                  }
                >
                  {(catalog?.models.image || [settings.imageModel]).map(
                    (value) => (
                      <option key={value}>{value}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                {t("图片规格", "Image size")}
                <select
                  aria-label={t("图片规格", "Image size")}
                  disabled={disabled}
                  value={settings.imageSize}
                  onChange={(event) =>
                    editSetting('imageSize', event.target.value)
                  }
                >
                  {['1K', '2K', '3K', '4K'].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
            </>
          )}
          {!comic && (
            <>
              <label>
                {t("视频模型", "Video model")}
                <select
                  aria-label={t("视频模型", "Video model")}
                  disabled={disabled}
                  value={settings.videoModel}
                  onChange={(event) =>
                    editSetting('videoModel', event.target.value)
                  }
                >
                  {(catalog?.models.video || [settings.videoModel]).map(
                    (value) => (
                      <option key={value}>{value}</option>
                    ),
                  )}
                </select>
              </label>
              <label className="agent-check">
                <input
                  type="checkbox"
                  checked={settings.generateSceneImages}
                  disabled={disabled}
                  onChange={(event) =>
                    editSetting('generateSceneImages', event.target.checked)
                  }
                />{' '}
                {t("先生成每镜参考图", "Generate reference images first")}
              </label>
            </>
          )}
          <div className="agent-conversation" aria-label={t("分镜设计对话", "Storyboard chat")}>
            {project.messages.slice(-6).map((message, index) => (
              <p key={index} className={message.role}>
                <small>{message.role === 'user' ? t("我的要求", "My brief") : t("智能体", "Agent")}</small>
                {message.content}
              </p>
            ))}
          </div>
          <label>
            {t("对话调整", "Revision request")}
            <textarea
              aria-label={t("对话调整", "Revision request")}
              rows={3}
              disabled={disabled}
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              placeholder={
                draft
                  ? t("例如：第三格更有反差，结尾温暖一点。", "For example, make panel three more surprising and the ending warmer.")
                  : t("补充风格、人物或情绪要求，也可以直接使用上方主题。", "Describe a style, character or mood, or start with the story idea above.")
              }
            />
          </label>
          <button
            className="btn btn-primary agent-design-button"
            disabled={disabled || (!brief.trim() && !command.trim())}
            onClick={() => void design()}
          >
            <FiSend />
            {busy ? t("正在处理…", "Working…") : draft ? t("按要求调整分镜", "Revise storyboard") : t("开始设计分镜", "Plan storyboard")}
          </button>
          {busy && designController.current && (
            <button
              className="btn btn-default"
              onClick={() => designController.current?.abort()}
            >
              {t("停止本次构思", "Stop planning")}
            </button>
          )}
        </aside>
        <section className="agent-workspace">
          <div className="agent-workspace-bar">
            <div
              role="tablist"
              aria-label={t("工作室视图", "Studio view")}
              onKeyDown={(event) => {
                if (
                  !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                const next =
                  event.key === 'Home'
                    ? 'storyboard'
                    : event.key === 'End'
                      ? 'preview'
                      : tab === 'storyboard'
                        ? 'preview'
                        : 'storyboard';
                setTab(next);
                document.getElementById(`agent-tab-${next}`)?.focus();
              }}
            >
              <button
                role="tab"
                id="agent-tab-storyboard"
                aria-controls="agent-view-panel"
                aria-selected={tab === 'storyboard'}
                tabIndex={tab === 'storyboard' ? 0 : -1}
                onClick={() => setTab('storyboard')}
              >
                <FiLayers /> {t("分镜编辑", "Edit storyboard")}
              </button>
              <button
                role="tab"
                id="agent-tab-preview"
                aria-controls="agent-view-panel"
                aria-selected={tab === 'preview'}
                tabIndex={tab === 'preview' ? 0 : -1}
                onClick={() => setTab('preview')}
              >
                <FiImage /> {t("作品预览", "Preview")}
              </button>
            </div>
            <span>
              {designed
                ? `${draft?.scenes.length ?? settings.sceneCount} 个分镜`
                : `${completed} / ${draft?.scenes.length ?? settings.sceneCount} ${comic ? t("格", "panels") : t("镜", "shots")}完成`}
            </span>
          </div>
          {project.job && (
            <div
              className={`agent-job ${active ? 'active' : ''}`}
              role="status"
            >
              <div>
                <span className={active ? 'agent-live' : ''}>
                  {designed
                    ? t("分镜设计已完成", "Storyboard ready")
                    : statusLabel(project.job.status)}
                </span>
                <span>
                  {designed
                    ? t("可逐镜调整后生成", "Review individual shots before generating")
                    : project.job.currentSceneId
                      ? `当前：${project.job.currentSceneId}`
                      : statusLabel(project.job.stage)}
                </span>
                <b>{Math.round(Number(project.job.progress) || 0)}%</b>
              </div>
              <progress
                max="100"
                value={project.job.progress || 0}
                aria-label={t("生成进度", "Generation progress")}
              />
              {project.job.error && (
                <p role="alert">{errorMessage(new Error(project.job.error))}</p>
              )}
            </div>
          )}
          <div
            role="tabpanel"
            id="agent-view-panel"
            aria-labelledby={`agent-tab-${tab}`}
          >
            {!draft ? (
              <div className="agent-canvas-empty">
                <span>{comic ? <FiCloud /> : <FiFilm />}</span>
                <h2>{t("每个故事，都从一句话开始。", "Start with one sentence.")}</h2>
                <p>
                  {t("在左侧写下主题，让智能体为你设计连续分镜。", "Enter a topic on the left to plan a sequence of shots.")}
                  <br />
                  {t("确认每一格，再开始生成画面。", "Review each panel before generating the images.")}
                </p>
                <div>
                  <span>{t("01 描述想法", "01 Describe an idea")}</span>
                  <i />
                  <span>{t("02 调整分镜", "02 Edit storyboard")}</span>
                  <i />
                  <span>{t("03 生成作品", "03 Generate project")}</span>
                </div>
              </div>
            ) : tab === 'storyboard' ? (
              <>
                <div className="agent-draft-overview">
                  <label>
                    {t("作品标题", "Project title")}
                    <input
                      aria-label={t("分镜作品标题", "Storyboard title")}
                      disabled={disabled}
                      value={draft.title}
                      onChange={(event) =>
                        setDraft({ ...draft, title: event.target.value })
                      }
                    />
                  </label>
                  <div>
                    <label>
                      {t("固定人物设定", "Character continuity")}
                      <textarea
                        aria-label={t("人物设定", "Character notes")}
                        rows={2}
                        disabled={disabled}
                        value={draft.character}
                        onChange={(event) =>
                          setDraft({ ...draft, character: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      {t("画面风格", "Visual style")}
                      <textarea
                        aria-label={t("画面风格", "Visual style")}
                        rows={2}
                        disabled={disabled}
                        value={draft.style}
                        onChange={(event) =>
                          setDraft({ ...draft, style: event.target.value })
                        }
                      />
                    </label>
                  </div>
                </div>
                <div className="agent-storyboard-grid">
                  {draft.scenes.map((scene, index) => (
                    <div key={scene.id} className="agent-scene-column">
                      <span className="agent-scene-number">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <SceneEditor
                        scene={scene}
                        result={project.results.find(
                          (item) => item.sceneId === scene.id,
                        )}
                        comic={comic}
                        disabled={disabled}
                        onChange={(changes) => editScene(scene.id, changes)}
                        onRegenerate={() => void run(scene.id)}
                      />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="agent-final-preview">
                <header>
                  <span className="agent-eyebrow">YOUR ORIGINAL STORY</span>
                  <h2>{draft.title}</h2>
                  <p>{draft.summary}</p>
                </header>
                {comic ? (
                  <div className="agent-comic-preview">
                    {draft.scenes.map((scene) => (
                      <article key={scene.id}>
                        <h3>{scene.caption}</h3>
                        <AgentMedia
                          url={
                            project.results.find(
                              (item) => item.sceneId === scene.id,
                            )?.imageUrl
                          }
                          alt={scene.caption}
                        />
                      </article>
                    ))}
                  </div>
                ) : project.output.videoUrl ? (
                  <>
                    <AgentMedia
                      url={project.output.videoUrl}
                      video
                      alt={draft.title}
                    />
                    <p>
                      {t("成片约", "Final length about")}{' '}
                      {project.output.durationSeconds ??
                        draft.scenes.reduce(
                          (sum, scene) => sum + scene.durationSeconds,
                          0,
                        )}{' '}
                      {t("秒 · 已合成字幕与分镜音轨", "s · Subtitles and shot audio included")}
                    </p>
                  </>
                ) : (
                  <div className="agent-empty">
                    <FiFilm />
                    <h3>{t("完整视频将在这里出现", "Your assembled video will appear here")}</h3>
                    <p>
                      {t("先完成全部分镜。合成失败时，已生成的分镜与任务仍会保留，可以继续合成。", "Complete all shots first. If assembly fails, generated shots and jobs are kept for another attempt.")}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          {draft && (
            <footer className="agent-export-bar">
              <div>
                <FiDownload />
                <span>
                  {t("导出作品", "Export")} <small>{t("随时保存草稿与素材", "Save drafts and assets")}</small>
                </span>
              </div>
              <div>
                {publishingDraft && <SendToPublisher draft={publishingDraft} />}
                {comic && (
                  <button
                    className="btn btn-primary"
                    disabled={active || busy || exporting}
                    onClick={() => void exportFile('comic')}
                  >
                    {t("漫画长图 PNG", "Comic strip PNG")}
                  </button>
                )}
                {!comic && project.output.videoUrl && (
                  <button
                    className="btn btn-primary"
                    disabled={disabled}
                    onClick={() => void exportFile('video')}
                  >
                    {t("下载完整视频", "Download video")}
                  </button>
                )}
                {(
                  ['html', 'markdown', 'json', 'zip'] as AgentExportFormat[]
                ).map((format) => (
                  <button
                    key={format}
                    className="btn btn-default"
                    disabled={active || busy || exporting}
                    onClick={() => void exportFile(format)}
                  >
                    {format === 'zip' ? t("素材包 ZIP", "Asset bundle ZIP") : format.toUpperCase()}
                  </button>
                ))}
              </div>
            </footer>
          )}
        </section>
      </div>
    </main>
  );
}
