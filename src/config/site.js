// Shared by the app and the static SEO build; keep the public identity here.
const SITE = {
  name: '织流 AI',
  englishName: 'ZhiFlow',
  url: 'https://langchain.leheavengame.com/',
  title: '织流 AI（ZhiFlow）- AI 工作流可视化编排工具',
  description:
    '织流 AI（ZhiFlow）是一款 AI 工作流可视化编排工具，支持节点拖拽、自然语言生成工作流、文本、图片与视频模型配置及执行结果查看。访客可保存本地草稿，登录后可同步并运行工作流。',
  themeColor: '#174d3c',
  image: 'https://langchain.leheavengame.com/social-preview.png',
};

function getPageMetadata(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') {
    return { title: SITE.title, description: SITE.description, indexable: true };
  }
  let label = '页面未找到';
  if (path === '/login') label = '登录与注册';
  else if (path === '/workflows') label = '我的工作流';
  else if (/^\/workflows\/[^/]+\/edit$/.test(path)) label = '工作流编辑器';
  else if (path === '/executions') label = '执行记录';
  else if (/^\/executions\/[^/]+$/.test(path)) label = '执行详情';
  return {
    title: `${label} - ${SITE.name}（${SITE.englishName}）`,
    description: `${SITE.name}${label}。${label === '页面未找到' ? '返回首页，开始编排 AI 工作流。' : '编排、保存与管理你的 AI 工作流。'}`,
    indexable: false,
  };
}

function getStructuredData() {
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
        featureList: ['可视化节点编排', '自然语言生成工作流', '文本、图片与视频模型配置', '本地草稿与服务端保存', '执行结果查看'],
      },
    ],
  };
}

module.exports = { SITE, getPageMetadata, getStructuredData };
