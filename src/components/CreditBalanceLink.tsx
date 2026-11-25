import { useLabels } from '../store/languageStore';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiCreditCard } from 'react-icons/fi';
import { aiWorkflowAPI, WORKFLOW_CREDITS_CHANGED } from '../services/api';
import useAuthStore from '../store/authStore';
import { formatPoints } from './BillingUsage/BillingUsage';

export default function CreditBalanceLink({
  refreshKey,
  className = 'editor-credit-link',
}: {
  refreshKey?: string | boolean;
  className?: string;
}) {
  const t = useLabels();
  const { isLoggedIn, token } = useAuthStore();
  const [balance, setBalance] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener(WORKFLOW_CREDITS_CHANGED, refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener(WORKFLOW_CREDITS_CHANGED, refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setBalance(null);
    setFailed(false);
    if (!isLoggedIn) return;
    aiWorkflowAPI.credits({ signal: controller.signal }).then((response) => {
      if (!controller.signal.aborted) setBalance(response.data.account.balance);
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => controller.abort();
  }, [isLoggedIn, token, refreshKey, revision]);
  return (
    <Link to="/credits" className={className} title={t('查看工作流积分余额与计费规则', 'View your credit balance and billing rules')}>
      <FiCreditCard />
      {isLoggedIn
        ? balance !== null
          ? `${formatPoints(balance)} ${t('积分', 'credits')}`
          : failed
            ? t('查看积分', 'View credits')
            : t('积分读取中…', 'Loading credits…')
        : t('积分规则', 'Billing rules')}
    </Link>
  );
}
