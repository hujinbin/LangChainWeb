import { RUNTIME_CONFIG } from './runtime';

// Shared by the app and the static SEO build; keep the public identity here.
const DEFAULT_SITE = {
  name: '织流 AI',
  englishName: 'ZhiFlow',
  url: 'https://langchain.leheavengame.com/',
  title: '织流 AI（ZhiFlow）- AI 工作流可视化编排工具',
  description:
    '织流 AI（ZhiFlow）是一款 AI 工作流可视化编排工具，支持节点拖拽、自然语言生成工作流、文本、图片与视频模型配置及执行结果查看。访客可保存本地草稿，登录后可同步并运行工作流。',
  themeColor: '#174d3c',
  image: 'https://langchain.leheavengame.com/social-preview.png',
  qqGroup: '749076211',
  logoUrl: '',
  helpUrl: '',
};

const runtimeBrand = {
  name:
    typeof RUNTIME_CONFIG.brandName === 'string'
      ? RUNTIME_CONFIG.brandName.trim()
      : '',
  logoUrl:
    typeof RUNTIME_CONFIG.logoUrl === 'string'
      ? RUNTIME_CONFIG.logoUrl.trim()
      : '',
  helpUrl:
    typeof RUNTIME_CONFIG.helpUrl === 'string'
      ? RUNTIME_CONFIG.helpUrl.trim()
      : '',
  qqGroup:
    typeof RUNTIME_CONFIG.qqGroup === 'string'
      ? RUNTIME_CONFIG.qqGroup.trim()
      : '',
};

// 运行时配置只作为首屏兜底，后端站点配置接口返回后会覆盖这里的品牌信息。
export const SITE = {
  ...DEFAULT_SITE,
  name: runtimeBrand.name || DEFAULT_SITE.name,
  logoUrl: runtimeBrand.logoUrl,
  helpUrl: runtimeBrand.helpUrl,
  qqGroup: runtimeBrand.qqGroup || DEFAULT_SITE.qqGroup,
};

export function getPageMetadata(pathname: string) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') {
    return {
      title: SITE.title,
      description: SITE.description,
      indexable: true,
    };
  }
  let label = '页面未找到';
  if (path === '/login') label = '登录与注册';
  else if (path === '/workflows') label = '我的工作流';
  else if (/^\/workflows\/[^/]+\/edit$/.test(path)) label = '工作流编辑器';
  else if (path === '/executions') label = '执行记录';
  else if (path === '/credits') label = '工作流积分';
  else if (path === '/profile') label = '个人主页';
  else if (path === '/settings') label = '设置';
  else if (path === '/achievements') label = '成就计划';
  else if (path === '/docs') label = 'API 文档';
  else if (path === '/usage') label = '用量总览';
  else if (path === '/help') label = '帮助中心';
  else if (/^\/executions\/[^/]+$/.test(path)) label = '执行详情';
  else if (path === '/knowledge') label = '知识库';
  else if (/^\/knowledge\/[^/]+$/.test(path)) label = '知识库详情';
  else if (path === '/agents') label = '智能体工作台';
  else if (path === '/agents/custom/new') label = '创建智能体';
  else if (/^\/agents\/custom\/[^/]+$/.test(path)) label = '智能体编辑器';
  else if (/^\/agents\/[^/]+$/.test(path)) label = '智能体创作';
  return {
    title: `${label} - ${SITE.name}（${SITE.englishName}）`,
    description: `${SITE.name}${label}。${path.startsWith('/knowledge') ? '管理文档、预览分段并测试知识检索。' : path.startsWith('/agents') ? '设计分镜、生成云朵漫画与人生视频，并导出创作成果。' : label === '页面未找到' ? '返回首页，开始编排 AI 工作流。' : '编排、保存与管理你的 AI 工作流。'}`,
    indexable: false,
  };
}

export function getStructuredData() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE.url}#website`,
        url: SITE.url,
        name: SITE.name,
        alternateName: SITE.englishName,
        inLanguage: 'zh-CN',
        description: SITE.description,
      },
      {
        '@type': 'WebApplication',
        '@id': `${SITE.url}#application`,
        name: SITE.name,
        alternateName: SITE.englishName,
        url: SITE.url,
        description: SITE.description,
        applicationCategory: 'ProductivityApplication',
        operatingSystem: 'Web',
        browserRequirements: 'Requires JavaScript',
        inLanguage: 'zh-CN',
        image: SITE.image,
        featureList: [
          '可视化节点编排',
          '自然语言生成工作流',
          '文本、图片与视频模型配置',
          '本地草稿与服务端保存',
          '执行结果查看',
        ],
      },
    ],
  };
}
