/* eslint-disable testing-library/no-node-access -- 页面元信息写入 document.head，需要直接检查标签与去重结果。 */
import { fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router-dom';
import PageMetadata from './PageMetadata';
import { SITE } from '../config/site';

test('导航到编辑器移除首页收录信息，回首页恢复且没有重复标签', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <PageMetadata />
      <Link to="/workflows/private-id/edit?local=true">编辑</Link>
      <Link to="/">首页</Link>
    </MemoryRouter>
  );
  expect(document.title).toBe(SITE.title);
  expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', SITE.url);
  expect(document.querySelector('#site-schema')).not.toBeNull();
  fireEvent.click(screen.getByText('编辑'));
  expect(document.title).toContain('工作流编辑器');
  expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
  expect(document.querySelector('link[rel="canonical"]')).toBeNull();
  expect(document.querySelector('#site-schema')).toBeNull();
  expect(document.querySelector('meta[property="og:url"]')).toBeNull();
  fireEvent.click(screen.getByText('首页'));
  expect(document.title).toBe(SITE.title);
  expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'index, follow, max-image-preview:large');
  expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
  expect(document.querySelectorAll('#site-schema')).toHaveLength(1);
});

test.each(['/login', '/executions/123', '/not-found'])(
  '%s 直接打开时禁止收录', (pathname) => {
    render(<MemoryRouter initialEntries={[pathname]}><PageMetadata /></MemoryRouter>);
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
    expect(document.querySelector('#site-schema')).toBeNull();
  }
);
