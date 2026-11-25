import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  FiArrowDown,
  FiBookOpen,
  FiChevronRight,
  FiSearch,
  FiShield,
} from 'react-icons/fi';
import { PARTNER_PATH, API_BASE_URL } from '../../config/runtime';
import { useLanguage, useLabels } from '../../store/languageStore';
import './Developer.css';

interface Section {
  id: string;
  title: string;
  html: string;
}
export default function ApiDocs({ standalone = false }: { standalone?: boolean }) {
  const language = useLanguage((state) => state.language);
  const chooseLanguage = useLanguage((state) => state.choose);
  const t = useLabels();
  const [params] = useSearchParams();
  const [sections, setSections] = useState<Section[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setError(false);
    setSections([]);
    setQuery('');
    fetch('/api-reference/' + language + '.json', { signal: abort.signal })
      .then((res) => {
        if (!res.ok) throw Error();
        return res.json();
      })
      .then((data: Section[]) => {
        if (!abort.signal.aborted) setSections(data);
      })
      .catch(() => {
        if (!abort.signal.aborted) setError(true);
      });
    return () => abort.abort();
  }, [language, revision]);
  const selected =
    sections.find((row) => row.id === params.get('section')) || sections[0];
  const search = query.trim().toLowerCase();
  const results = sections.filter((row) =>
    (row.title + row.html.replace(/<[^>]*>/g, ' '))
      .toLowerCase()
      .includes(search)
  );
  return (
    <main className="developer-page">
      <header className="developer-title">
        <div>
          <span className="dev-breadcrumb">
            <FiBookOpen /> {t('开发者中心', 'Developer center')}
          </span>
          <h1>{t('API 文档', 'API documentation')}</h1>
        </div>
        <div className="dev-actions">
          <button type="button" className="btn btn-default" onClick={() => chooseLanguage(language === 'zh' ? 'en' : 'zh')}>
            {language === 'zh' ? 'English' : '简体中文'}
          </button>
          {standalone && <a className="btn btn-default" href={PARTNER_PATH}>
            <FiShield /> {t('代理商后台', 'Partner console')}
          </a>}
          <a
            className="btn btn-default"
            href="/api-reference/openapi.yaml"
            download
          >
            <FiArrowDown /> OpenAPI 3.1
          </a>
        </div>
      </header>
      <div className="doc-layout">
        <aside className="doc-menu">
          <label className="dev-search">
            <FiSearch />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t(
                '搜索接口、权限或错误码',
                'Search endpoints or errors'
              )}
              aria-label={t('搜索文档', 'Search docs')}
            />
          </label>
          <nav aria-label={t('文档目录', 'Contents')}>
            {results.map((row) => (
              <Link
                key={row.id}
                aria-current={row === selected ? 'page' : undefined}
                to={'?section=' + row.id}
              >
                {row.title}
                <FiChevronRight />
              </Link>
            ))}
          </nav>
          {!!sections.length && !results.length && (
            <p>{t('没有匹配的章节', 'No matching sections')}</p>
          )}
          {!standalone && <a className="doc-admin" href={PARTNER_PATH}>
            <FiShield /> {t('代理商后台', 'Partner console')}
          </a>}
        </aside>
        <article className="doc-article">
          {error ? (
            <div role="alert">
              {t('文档加载失败。', 'Could not load documentation.')}{' '}
              <button
                className="btn btn-default"
                onClick={() => setRevision((v) => v + 1)}
              >
                {t('重试', 'Retry')}
              </button>
            </div>
          ) : selected ? (
            <>
              <h2>{selected.title}</h2>
              <div
                className="doc-copy"
                dangerouslySetInnerHTML={{ __html: selected.html }}
              />
              {selected.id === 'overview' && (
                <>
                  <h3>{t('本站 API 根地址', 'API base URL')}</h3>
                  <code className="doc-base-url">
                    {
                      new URL(
                        (API_BASE_URL || '') + '/api/open/v1',
                        window.location.origin
                      ).href
                    }
                  </code>
                  <div className="doc-chapters">
                    {sections.slice(1, 5).map((row) => (
                      <Link to={'?section=' + row.id} key={row.id}>
                        {row.title}
                        <FiChevronRight />
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <p role="status">{t('正在读取文档…', 'Loading documentation…')}</p>
          )}
        </article>
      </div>
    </main>
  );
}
