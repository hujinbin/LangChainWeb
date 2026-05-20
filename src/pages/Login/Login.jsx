import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    mobile: '',
    password: '',
    nickname: '',
    code: '',
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!form.mobile || !form.password) {
      setError('请输入手机号和密码');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: form.mobile, password: form.password }),
      });
      const data = await res.json();
      if (data.code === 200) {
        login(data.data, data.token);
        navigate('/');
      } else {
        setError(data.msg || '登录失败');
      }
    } catch (err) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!form.mobile || !form.password || !form.nickname) {
      setError('请填写所有必要信息');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: form.mobile,
          password: form.password,
          nickname: form.nickname,
          code: form.code,
        }),
      });
      const data = await res.json();
      if (data.code === 200) {
        setError('');
        setIsRegister(false);
        alert('注册成功，请登录');
      } else {
        setError(data.msg || '注册失败');
      }
    } catch (err) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestMode = () => {
    navigate('/');
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2 className="login-title">🚀 AI工作流平台</h2>
        <p className="login-subtitle">
          {isRegister ? '创建新账户' : '登录到您的账户'}
        </p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={isRegister ? handleRegister : handleLogin}>
          {isRegister && (
            <div className="form-group">
              <label>昵称</label>
              <input
                type="text"
                name="nickname"
                value={form.nickname}
                onChange={handleChange}
                placeholder="请输入昵称"
              />
            </div>
          )}

          <div className="form-group">
            <label>手机号</label>
            <input
              type="text"
              name="mobile"
              value={form.mobile}
              onChange={handleChange}
              placeholder="请输入手机号"
              maxLength={11}
            />
          </div>

          <div className="form-group">
            <label>密码</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="请输入密码"
            />
          </div>

          {isRegister && (
            <div className="form-group">
              <label>验证码</label>
              <input
                type="text"
                name="code"
                value={form.code}
                onChange={handleChange}
                placeholder="请输入短信验证码"
                maxLength={6}
              />
            </div>
          )}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? '处理中...' : isRegister ? '注册' : '登录'}
          </button>
        </form>

        <div className="login-footer">
          <button
            className="link-btn"
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
          >
            {isRegister ? '已有账户？去登录' : '没有账户？去注册'}
          </button>
          <button className="guest-btn" onClick={handleGuestMode}>
            游客模式体验
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
