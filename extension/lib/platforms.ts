export type TextField = 'title' | 'body' | 'tags';
export type MediaRole = 'image' | 'cover' | 'video';
type Selectors = Partial<Record<TextField | MediaRole, readonly string[]>>;
export interface Platform {
  id: string;
  name: string;
  url: string;
  editorUrl: string;
  origin: string;
  hosts: readonly string[];
  kind: 'article' | 'novel' | 'social';
  /** Recognizes the writing workspace, including hash routers. A matching editable control is still required. */
  editorPath: RegExp;
  selectors: Selectors;
}

const chapter = {
  title: ['input[name="chaptername"]', 'input[name="chapterName"]', 'input[placeholder*="章节名"]', 'input[placeholder*="章节标题"]'],
  body: ['textarea[name="chaptertext"]', 'textarea[name="chapterContent"]', '[contenteditable="true"][data-placeholder*="章节"]', '.chapter-editor [contenteditable="true"]'],
};
const chapterPath = /(?:chapter|write|editor|draft|manuscript|addcontent|newcontent|novelupdate)/i;
const composePath = /(?:edit|write|compose|creat(?:e|ion)|publish|post\/new|upload|content\/add|article\/add)/i;

function profile(id: string, name: string, url: string, kind: Platform['kind'], editorPath: RegExp,
  selectors: Selectors = {}, otherHosts: string[] = []): Platform {
  const { origin, hostname } = new URL(url);
  return { id, name, url, editorUrl: url, origin, hosts: [hostname, ...otherHosts], kind, editorPath, selectors };
}

export const platforms: readonly Platform[] = [
  profile('wechat', '微信公众号', 'https://mp.weixin.qq.com/', 'article', /cgi-bin\/appmsg(?:[?\/]|$)|cgi-bin\/operate_appmsg/i, {
    title: ['#title'], body: ['#js_editor[contenteditable="true"]', '#js_editor [contenteditable="true"]', '#ueditor_0'],
  }),
  profile('baijiahao', '百家号', 'https://baijiahao.baidu.com/builder/rc/edit', 'article', /\/builder\/.*(?:edit|publish|creat)/i, {
    title: ['.client_components_titleInput input', 'textarea[placeholder*="文章标题"]'], body: ['#ueditor_0', '.edui-editor-iframeholder iframe'],
  }),
  profile('toutiao', '头条号', 'https://mp.toutiao.com/profile_v4/graphic/publish', 'article', composePath, {
    title: ['.syl-editor-title input', 'textarea[placeholder*="标题"]'], body: ['.syl-editor-content [contenteditable="true"]', '.tiptap[contenteditable="true"]'],
  }),
  profile('dayu', '大鱼号', 'https://mp.dayu.com/', 'article', composePath, {
    title: ['input[name="articleTitle"]'], body: ['.edui-editor-iframeholder iframe', '#ueditor_0'],
  }),
  profile('penguin', '企鹅号', 'https://om.qq.com/', 'article', composePath, {
    title: ['input[placeholder*="文章标题"]'], body: ['.ql-editor[contenteditable="true"]', '.edui-editor-iframeholder iframe'],
  }),
  profile('netease', '网易号', 'https://mp.163.com/', 'article', composePath, {
    title: ['input[name="title"]'], body: ['.edui-editor-iframeholder iframe', '.ProseMirror[contenteditable="true"]'],
  }, ['dy.163.com']),
  profile('zhihu', '知乎', 'https://zhuanlan.zhihu.com/write', 'article', /\/write(?:[/?#]|$)|\/p\/[^/]+\/edit/i, {
    title: ['textarea.Input[placeholder*="标题"]', '.WriteIndex-titleInput textarea'], body: ['.DraftEditor-editorContainer [contenteditable="true"]'],
  }),
  profile('sohu', '搜狐号', 'https://mp.sohu.com/', 'article', composePath, {
    title: ['input[placeholder*="请输入标题"]'], body: ['.ql-editor[contenteditable="true"]', '#ueditor_0'],
  }),
  profile('qutoutiao', '趣头条', 'https://mp.qutoutiao.net/', 'article', composePath, {
    title: ['input[name="title"]'], body: ['.edui-editor-iframeholder iframe', '#ueditor_0'],
  }),
  profile('fanqie', '番茄小说', 'https://fanqienovel.com/writer/zone', 'novel', /\/main\/writer\/|\/writer\/(?:chapter|book|edit)/i, chapter),
  profile('jinjiang', '晋江文学城', 'https://my.jjwxc.net/', 'novel', /\/backend\//i, chapter),
  profile('qimao', '七猫', 'https://zuozhe.qimao.com/', 'novel', chapterPath, chapter),
  profile('qidian', '起点中文网', 'https://write.qq.com/', 'novel', chapterPath, chapter),
  profile('migu', '咪咕文学', 'https://www.cmread.com/wenxuenew/detail/count?defaults=1&count=1', 'novel',
    /\/wenxuenew\/.*(?:chapter|write|edit|draft|manuscript|sectionmanagement)/i, chapter),
  profile('channels', '微信视频号助手', 'https://channels.weixin.qq.com/platform', 'social', /\/platform\/.*(?:create|post|edit|upload)/i, {
    title: ['input[placeholder*="短标题"]'], body: ['[contenteditable="true"][data-placeholder*="描述"]'],
  }),
  profile('xiaohongshu', '小红书', 'https://creator.xiaohongshu.com/publish/publish', 'social', composePath, {
    title: ['.title-container input'], body: ['.tiptap[contenteditable="true"]', '.ql-editor[contenteditable="true"]'],
  }),
  profile('douyin', '抖音', 'https://creator.douyin.com/creator-micro/content/upload', 'social', /\/creator-micro\/.*(?:upload|publish|edit|content\/post\/(?:video|image))/i, {
    title: ['input[placeholder*="作品标题"]'], body: ['[contenteditable="true"][data-placeholder*="作品描述"]', '.public-DraftEditor-content[contenteditable="true"]'],
  }),
];

export function platformForUrl(value: string): Platform | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return undefined;
    return platforms.find(p => p.hosts.includes(url.hostname));
  } catch {
    return undefined;
  }
}

// An upload may open its details step via the History API. Never follow general edit
// or library routes: they can belong to a different, already published work.
const uploadSteps: Record<string, [RegExp, RegExp]> = {
  douyin: [/^\/creator-micro\/content\/upload\/?$/, /^\/creator-micro\/content\/(?:publish|post\/(?:video|image))\/?$/],
  xiaohongshu: [/^\/publish\/(?:upload|publish)\/?$/, /^\/publish\/publish\/?$/],
  channels: [/^\/platform\/post\/(?:upload|create)\/?$/, /^\/platform\/post\/create\/?$/],
};

export function uploadContinuesAt(platform: Platform, from: string, to: string): boolean {
  const steps = uploadSteps[platform.id];
  if (!steps || platformForUrl(to)?.id !== platform.id) return false;
  const source = new URL(from), next = new URL(to);
  if (source.origin !== next.origin || !steps[0].test(source.pathname) || !steps[1].test(next.pathname) ||
      source.hash !== next.hash) return false;
  for (const key of new Set([...source.searchParams.keys(), ...next.searchParams.keys()])) {
    if (/(?:draft|post|note|item|article|video|object)_?id$|^id$/i.test(key) && next.searchParams.get(key) !== source.searchParams.get(key)) return false;
  }
  return true;
}
