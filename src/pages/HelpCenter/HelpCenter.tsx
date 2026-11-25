import { useLabels, type Labels } from '../../store/languageStore';
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

const quickSteps = (t: Labels) => [
  {
    icon: FiGitBranch,
    title: t('创建第一个工作流', "Create a workflow"),
    description: t('从空白画布或模板开始，拖拽节点完成编排。', "Start with a blank canvas or template, then connect nodes."),
    to: '/workflows',
    action: t('前往工作流', "Go to workflows"),
  },
  {
    icon: FiPlayCircle,
    title: t('配置模型并运行', "Set up a model and run it"),
    description: t('为节点选择模型与提示词，保存后立即执行。', "Choose a model and prompt for your node. Save the workflow and run it."),
    to: '/workflows',
    action: t('查看我的工作流', "View my workflows"),
  },
  {
    icon: FiSettings,
    title: t('维护账号与积分', "Manage your account"),
    description: t('充值、修改资料、切换主题都在这里完成。', "Change your profile, sign-in details and theme."),
    to: '/settings',
    action: t('打开设置', "Open settings"),
  },
];

const getFaqs = (t: Labels) => [
  {
    q: t('如何创建并运行一个工作流？', "How do I create and run a workflow?"),
    a: t('在工作流页面点击新建，选择一个模板或空白画布，拖入开始、模型、结束等节点并连线。为模型节点配置提示词后保存，点击运行即可在执行记录中查看结果。', "Create a workflow from a template or blank canvas. Connect a trigger, model and output node, set the model prompt, then save and run. Open Runs to review the result."),
    links: [
      { label: t('去工作流', "Go to workflows"), to: '/workflows' },
      { label: t('执行记录', "Run history"), to: '/executions' },
    ],
  },
  {
    q: t('积分如何充值？', "How do I add credits?"),
    a: t('打开积分页点击「联系客服充值」，扫码添加客服微信，告知登录手机号与充值金额。客服充值到账后余额会自动更新，执行记录中也能看到积分流水。', "On the Credits page, select Contact support and scan the WeChat code. Provide your account phone number and the top-up amount. The balance and ledger show completed transactions."),
    links: [{ label: t('打开积分页', "Open credits"), to: '/credits' }],
  },
  {
    q: t('积分不足会导致什么？', "What happens if I run out of credits?"),
    a: t('当可用积分不足以覆盖一次执行时，运行会被拦截并提示余额不足。充值后重新运行即可，已产生的流水可以在积分页查看。', "When the balance cannot cover a run, the platform stops the operation. Add credits and try again. Previous transactions remain in the ledger."),
    links: [{ label: t('查看积分规则', "View credits"), to: '/credits' }],
  },
  {
    q: t('执行失败了怎么排查？', "How do I troubleshoot a failed run?"),
    a: t('先打开执行记录查看失败节点与错误信息。常见原因包括模型 Key 未配置、输入参数为空、引用了不存在的资源，以及积分不足。修正后重新运行即可。', "Open Runs and inspect the failed node and its error. Check model credentials, required input, referenced resources and your balance, then try again."),
    links: [{ label: t('查看执行记录', "View runs"), to: '/executions' }],
  },
  {
    q: t('如何修改昵称、头像或登录密码？', "How can I change my profile or password?"),
    a: t('点击右上角头像打开账号菜单，进入「设置」即可上传头像、修改昵称与登录密码。微信登录的账号可以直接设置新的登录密码。', "Open Settings from your account menu to update your avatar, display name or password. WeChat users can set a new password."),
    links: [{ label: t('前往设置', "Open settings"), to: '/settings' }],
  },
  {
    q: t('访客可以使用哪些功能？', "What can guests do?"),
    a: t('访客可以浏览模板、查看帮助和积分规则，也可以创建并保存本地工作流草稿。登录后可同步工作流、调用模型与管理知识库。', "Guests can browse templates, read help and billing rules, and create and save local workflow drafts. Sign in to sync workflows, run models or manage knowledge bases."),
    links: [{ label: t('立即登录', "Sign in"), to: '/login' }],
  },
  {
    q: t('成就计划怎么点亮？', "How do I earn achievements?"),
    a: t('成就会根据真实的账号、工作流数量、执行与成功次数、累计消耗积分、文章与粉丝数据自动计算，达到目标后自动点亮，无需手动领取。', "Your account and creation statistics determine achievements, including workflows, successful runs, credits spent, articles and followers. Achievements unlock automatically."),
    links: [{ label: t('查看成就计划', "View achievements"), to: '/achievements' }],
  },
  {
    q: t('如何联系开发者或反馈问题？', "How do I send feedback?"),
    a: t(`加入 QQ 交流群 ${SITE.qqGroup}，或扫码添加客服微信反馈。描述问题时附上执行记录链接与错误信息，可以更快定位。`, `Join QQ group ${SITE.qqGroup} or scan the WeChat support code. Include the run link and error message when reporting an issue.`),
  },
];

export default function HelpCenter() {
  const t = useLabels();
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const filteredFaqs = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const faqs = getFaqs(t);
    if (!keyword) return faqs;
    return faqs.filter(
      (item) =>
        item.q.toLowerCase().includes(keyword) ||
        item.a.toLowerCase().includes(keyword)
    );
  }, [query, t]);

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
          <h1>{t("帮助中心", "Help center")}</h1>
          <p>{t("从创建工作流到充值排障，常见问题都在这里。", "Find answers about workflows, credits and troubleshooting.")}</p>
        </div>
        <label className="help-search">
          <FiSearch />
          <input
            type="search"
            value={query}
            placeholder={t("搜索问题，例如：充值 / 执行失败", "Search for a topic, such as credits or failed runs")}
            aria-label={t("搜索问题", "Search questions")}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </header>

      <section className="help-quick" aria-label={t("快速开始", "Quick start")}>
        {quickSteps(t).map((step) => {
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

      <section className="surface help-faq-section" aria-label={t("常见问题", "Frequently asked questions")}>
        <div className="section-heading">
          <div>
            <h2>{t("常见问题", "Frequently asked questions")}</h2>
            <p>{t("共", "Total")} {filteredFaqs.length} {t("个问题", "questions")}</p>
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
            {t("没有匹配的问题，换个关键词试试，或直接联系客服。", "No matches. Try another keyword or contact support.")}
          </p>
        )}
      </section>

      <section className="help-contact" aria-label={t("联系我们", "Contact us")}>
        <article className="surface help-contact-card">
          <h2>{t("QQ 交流群", "QQ group")}</h2>
          <p>{t("和开发者、创作者一起交流使用心得。", "Discuss workflows with developers and other creators.")}</p>
          <strong>{SITE.qqGroup}</strong>
          <button type="button" className="btn btn-primary" onClick={copyQqGroup}>
            {copied ? <FiCheck /> : <FiCopy />}
            {copied ? t("已复制群号", "Group number copied") : t("复制群号", "Copy group number")}
          </button>
        </article>
        <article className="surface help-contact-card help-contact-qr">
          <div>
            <h2>{t("联系客服", "Contact support")}</h2>
            <p>{t("充值、退款或账号问题，扫码添加客服微信「流风绾月」。", "Scan to contact 流风绾月 on WeChat for top-ups, refunds or account issues.")}</p>
            <Link to="/credits" className="help-credit-link">
              {t("查看积分与充值", "View credits and top-ups")} <FiArrowRight />
            </Link>
          </div>
          <img
            src={`${process.env.PUBLIC_URL}/customer-service-qr.png`}
            alt={t("客服微信二维码", "WeChat support QR code")}
          />
        </article>
      </section>
    </main>
  );
}
