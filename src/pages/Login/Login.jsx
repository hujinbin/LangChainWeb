import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FiArrowRight,
  FiGitBranch,
  FiZap,
  FiCheck,
  FiEye,
  FiEyeOff,
} from 'react-icons/fi';
import useAuthStore from '../../store/authStore';
import apiClient from '../../services/api';
import './Login.css';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    mobile: '',
    password: '',
    nickname: '',
    code: '',
  });
  const handleChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
    setError('');
  };

  const loadCaptcha = async () => {
    if (!/^1\d{10}$/.test(form.mobile)) {
      setError('请先输入正确的手机号');
      return;
    }
    setCaptchaLoading(true);
    setError('');
    try {
      const { data } = await apiClient.post('/api/user/getCode', {
        mobile: form.mobile,
      });
      if (data.code !== 200) throw new Error(data.msg || '获取验证码失败');
      const image =
        data.image ||
        (typeof data.data === 'string'
          ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data.data)}`
          : '');
      if (!image) throw new Error('未收到验证码图片，请重试');
      setCaptcha(image);
    } catch (err) {
      setError(err.message || '获取验证码失败');
    } finally {
      setCaptchaLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const { data } = await apiClient.post(
        isRegister ? '/api/user/register' : '/api/user/login',
        {
          mobile: form.mobile,
          password: form.password,
          ...(isRegister
            ? { nickname: form.nickname, code: form.code.trim().toLowerCase() }
            : {}),
        }
      );
      if (data.code !== 200) throw new Error(data.msg || '提交失败');
      if (isRegister) {
        setIsRegister(false);
        setCaptcha('');
        setMessage('注册成功，使用刚才的账号登录即可。');
      } else {
        if (!data.token) throw new Error('登录响应缺少凭据，请重试');
        login(data.data, data.token);
        const destination = location.state?.from;
        const returnPath = typeof destination === 'string' && destination.startsWith('/') && !destination.startsWith('//')
          ? destination : '/';
        navigate(returnPath, { state: location.state?.returnState });
      }
    } catch (err) {
      setError(
        err.response?.data?.msg || err.message || '连接失败，请稍后重试'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-story">
        <span className="login-story-label">
          <FiGitBranch /> FLOW / CREATIVE WORKSPACE
        </span>
        <div>
          <span className="eyebrow">MAKE ROOM FOR YOUR NEXT IDEA</span>
          <h1>
            连接灵感。
            <br />
            让创作<em>自然发生。</em>
          </h1>
          <p>
            从一个提示词开始，编排属于你的 AI 工作流。
            <br />
            文字、画面、短片，在同一张画布上发生。
          </p>
          <div className="login-story-features">
            {[
              'Flash 文本、图片与视频模型',
              '可视化节点编排与变量引用',
              '逐节点结果与执行记录',
            ].map((text) => (
              <span key={text}>
                <FiCheck /> {text}
              </span>
            ))}
          </div>
        </div>
        <span className="login-story-footer">
          <FiZap /> BUILT FOR THE WAY YOU CREATE
        </span>
      </section>
      <section className="login-form-area">
        <div className="login-form-card">
          <span className="eyebrow">YOUR WORKSPACE AWAITS</span>
          <h2>{isRegister ? '创建你的创作空间' : '欢迎回来'}</h2>
          <p className="login-form-subtitle">
            {isRegister
              ? '使用博客账号体系，开启 AI 工作流创作。'
              : '登录博客账号，继续你的工作流创作。'}
          </p>
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="notice" role="status">
              {message}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            {isRegister && (
              <div className="login-field">
                <label htmlFor="nickname">昵称</label>
                <input
                  id="nickname"
                  name="nickname"
                  autoComplete="nickname"
                  value={form.nickname}
                  onChange={handleChange}
                  placeholder="怎么称呼你"
                  required
                  maxLength={40}
                />
              </div>
            )}
            <div className="login-field">
              <label htmlFor="mobile">手机号</label>
              <input
                id="mobile"
                name="mobile"
                type="tel"
                autoComplete="username"
                pattern="1[0-9]{10}"
                maxLength={11}
                value={form.mobile}
                onChange={(event) => {
                  handleChange(event);
                  setCaptcha('');
                }}
                placeholder="请输入手机号"
                required
              />
            </div>
            <div className="login-field">
              <label htmlFor="password">密码</label>
              <div className="login-password">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={
                    isRegister ? 'new-password' : 'current-password'
                  }
                  value={form.password}
                  onChange={handleChange}
                  placeholder="请输入密码"
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>
            {isRegister && (
              <div className="login-field">
                <label htmlFor="code">图形验证码</label>
                <div className="login-captcha">
                  <input
                    id="code"
                    name="code"
                    value={form.code}
                    onChange={handleChange}
                    placeholder="输入图中字符"
                    required
                    maxLength={6}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={loadCaptcha}
                    disabled={captchaLoading}
                    aria-label="获取或刷新图形验证码"
                  >
                    {captcha ? (
                      <img src={captcha} alt="图形验证码，点击刷新" />
                    ) : captchaLoading ? (
                      '获取中'
                    ) : (
                      '获取验证码'
                    )}
                  </button>
                </div>
              </div>
            )}
            <button
              type="submit"
              className="btn btn-primary login-submit"
              disabled={loading}
            >
              {loading ? '正在提交…' : isRegister ? '创建账号' : '登录工作台'}
              <FiArrowRight />
            </button>
          </form>
          <div className="login-switch">
            <span>{isRegister ? '已经有账号了' : '还没有账号'}</span>
            <button
              disabled={loading}
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
                setMessage('');
                setCaptcha('');
              }}
            >
              {isRegister ? '去登录' : '立即注册'}
            </button>
          </div>
          <div className="login-guest">
            <span>或者先看看</span>
            <button
              className="btn btn-default"
              onClick={() => navigate('/workflows')}
            >
              进入访客空间 <FiArrowRight />
            </button>
            <p>访客可编排并保存本地草稿</p>
          </div>
        </div>
      </section>
    </main>
  );
}
