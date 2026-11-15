import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SITE, getPageMetadata, getStructuredData } from '../config/site';

function setMeta(attribute, key, content) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

export default function PageMetadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    const metadata = getPageMetadata(pathname);
    document.title = metadata.title;
    setMeta('name', 'description', metadata.description);
    setMeta('name', 'robots', metadata.indexable ? 'index, follow, max-image-preview:large' : 'noindex, follow');
    setMeta('property', 'og:title', metadata.title);
    setMeta('property', 'og:description', metadata.description);
    setMeta('property', 'og:site_name', SITE.name);
    setMeta('name', 'twitter:title', metadata.title);
    setMeta('name', 'twitter:description', metadata.description);

    // Account, editor and execution pages are not public search results.
    document.head.querySelectorAll('link[rel="canonical"], #site-schema, meta[property="og:url"]')
      .forEach((element) => element.remove());
    if (metadata.indexable) {
      const canonical = document.createElement('link');
      canonical.rel = 'canonical';
      canonical.href = SITE.url;
      document.head.appendChild(canonical);
      setMeta('property', 'og:url', SITE.url);
      const schema = document.createElement('script');
      schema.id = 'site-schema';
      schema.type = 'application/ld+json';
      schema.textContent = JSON.stringify(getStructuredData());
      document.head.appendChild(schema);
    }
  }, [pathname]);
  return null;
}
