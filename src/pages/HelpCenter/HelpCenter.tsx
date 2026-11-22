import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiArrowRight,
  FiChevronDown,
  FiCopy,
  FiCheck,
  FiGitBranch,
  FiPlayCircle,
  FiSearch,
  FiSettings,
} from 'react-icons/fi';
import { SITE } from '../../config/site';
import './HelpCenter.css';

const QUICK_STEPS = [
  {
    icon: FiGitBranch,
    title: '创建第一个工作流',
    description: '从空白画布或模板开始，拖拽节点完成编排。',
    to: '/workflows',
    action: '前往工作流',
  },
  {
    icon: FiPlayCircle,
    title: '配置模型并运行',
    description: '为节点选择模型与提示词，保存后立即执行。',
    to: '/workflows',
    action: '查看我的工作流',
  },
  {
    icon: FiSettings,
    title: '维护账号与积分',
    description: '充值、修改资料、切换主题都在这里完成。',
    to: '/settings',
    action: '打开设置',
  },
];

const FAQS = [
  {
    q: '如何创建并运行一个工作流？',
    a: '在工作流页面点击新建，选择一个模板或空白画布，拖入开始、模型、结束等节点并连线。为模型节点配置提示词后保存，点击运行即可在执行记录中查看结果。',
    links: [
      { label: '去工作流', to: '/workflows' },
      { label: '执行记录', to: '/executions' },
    ],
  },
  {
    q: '积分如何充值？',
    a: '打开积分页点击「联系客服充值」，扫码添加客服微信，告知登录手机号与充值金额。客服充值到账后余额会自动更新，执行记录中也能看到积分流水。',
    links: [{ label: '打开积分页', to: '/credits' }],
  },
  {
    q: '积分不足会导致什么？',
    a: '当可用积分不足以覆盖一次执行时，运行会被拦截并提示余额不足。充值后重新运行即可，已产生的流水可以在积分页查看。',
    links: [{ label: '查看积分规则', to: '/credits' }],
  },
  {
    q: '执行失败了怎么排查？',
    a: '先打开执行记录查看失败节点与错误信息。常见原因包括模型 Key 未配置、输入参数为空、引用了不存在的资源，以及积分不足。修正后重新运行即可。',
    links: [{ label: '查看执行记录', to: '/executions' }],
  },
  {
    q: '如何修改昵称、头像或登录密码？',
    a: '点击右上角头像打开账号菜单，进入「设置」即可上传头像、修改昵称与登录密码。微信登录的账号可以直接设置新的登录密码。',
    links: [{ label: '前往设置', to: '/settings' }],
  },
  {
    q: '访客可以使用哪些功能？',
    a: '访客可以浏览首页、模板、帮助中心与积分规则；创建或保存工作流、执行工作流、管理知识库等操作需要先登录。',
    links: [{ label: '立即登录', to: '/login' }],
  },
  {
    q: '成就计划怎么点亮？',
    a: '成就会根据真实的账号、工作流数量、执行与成功次数、累计消耗积分、文章与粉丝数据自动计算，达到目标后自动点亮，无需手动领取。',
    links: [{ label: '查看成就计划', to: '/achievements' }],
  },
  {
    q: '如何联系开发者或反馈问题？',
    a: `加入 QQ 交流群 ${SITE.qqGroup}，或扫码添加客服微信反馈。描述问题时附上执行记录链接与错误信息，可以更快定位。`,
  },
];

export default function HelpCenter() {
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const filteredFaqs = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return FAQS;
    return FAQS.filter(
      (item) =>
        item.q.toLowerCase().includes(keyword) ||
        item.a.toLowerCase().includes(keyword)
    );
  }, [query]);

  const copyQqGroup = async () => {
    try {
      await navigator.clipboard.writeText(SITE.qqGroup);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="page-wrap help-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">HELP CENTER</span>
          <h1>帮助中心</h1>
          <p>从创建工作流到充值排障，常见问题都在这里。</p>
        </div>
        <label className="help-search">
          <FiSearch />
          <input
            type="search"
            value={query}
            placeholder="搜索问题，例如：充值 / 执行失败"
            aria-label="搜索问题"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </header>

      <section className="help-quick" aria-label="快速开始">
        {QUICK_STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <article className="surface help-step" key={step.title}>
              <span className="help-step-icon">
                <Icon />
              </span>
              <h2>{step.title}</h2>
              <p>{step.description}</p>
              <Link to={step.to}>
                {step.action} <FiArrowRight />
              </Link>
            </article>
          );
        })}
      </section>

      <section className="surface help-faq-section" aria-label="常见问题">
        <div className="section-heading">
          <div>
            <h2>常见问题</h2>
            <p>共 {filteredFaqs.length} 个问题</p>
          </div>
        </div>
        {filteredFaqs.length ? (
          <div className="help-faq-list">
            {filteredFaqs.map((item) => (
              <details className="help-faq" key={item.q}>
                <summary>
                  <span>{item.q}</span>
                  <FiChevronDown className="help-faq-caret" />
                </summary>
                <p>{item.a}</p>
                {item.links && (
                  <div className="help-faq-links">
                    {item.links.map((link) => (
                      <Link key={link.to} to={link.to}>
                        {link.label} <FiArrowRight />
                      </Link>
                    ))}
                  </div>
                )}
              </details>
            ))}
          </div>
        ) : (
          <p className="help-empty">
            没有匹配的问题，换个关键词试试，或直接联系客服。
          </p>
        )}
      </section>

      <section className="help-contact" aria-label="联系我们">
        <article className="surface help-contact-card">
          <h2>QQ 交流群</h2>
          <p>和开发者、创作者一起交流使用心得。</p>
          <strong>{SITE.qqGroup}</strong>
          <button type="button" className="btn btn-primary" onClick={copyQqGroup}>
            {copied ? <FiCheck /> : <FiCopy />}
            {copied ? '已复制群号' : '复制群号'}
          </button>
        </article>
        <article className="surface help-contact-card help-contact-qr">
          <div>
            <h2>联系客服</h2>
            <p>充值、退款或账号问题，扫码添加客服微信「流风绾月」。</p>
            <Link to="/credits" className="help-credit-link">
              查看积分与充值 <FiArrowRight />
            </Link>
          </div>
          <img
            src={`${process.env.PUBLIC_URL}/customer-service-qr.png`}
            alt="客服微信二维码"
          />
        </article>
      </section>
    </main>
  );
}
