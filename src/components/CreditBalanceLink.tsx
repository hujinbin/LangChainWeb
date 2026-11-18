import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiCreditCard } from 'react-icons/fi';
import { aiWorkflowAPI, WORKFLOW_CREDITS_CHANGED } from '../services/api';
import useAuthStore from '../store/authStore';
import { formatPoints } from './BillingUsage/BillingUsage';

export default function CreditBalanceLink({ refreshKey }: { refreshKey?: string | boolean }) {
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
    <Link to="/credits" className="editor-credit-link" title="查看工作流积分余额与计费规则">
      <FiCreditCard />
      {isLoggedIn ? balance !== null ? `${formatPoints(balance)} 积分` : failed ? '查看积分' : '积分读取中…' : '积分规则'}
    </Link>
  );
}
