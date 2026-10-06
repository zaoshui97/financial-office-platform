/**
 * 钉钉扫码登录 Modal —— 仿真 OAuth 流程
 *
 * 流程：
 *   1. 弹出 Modal，左侧显示"二维码"（CSS 绘制的方块），右侧显示扫码说明
 *   2. 调用 loginWithQrCode() 仿真 2 秒后回调
 *   3. 拿到 DingtalkUserInfo 后：
 *      - 写入 userStore（同步现有用户体系）
 *      - 写入 localStorage（持久化连接态）
 *      - 触发 eventBus.dingtalk.connected
 *      - 提示成功，关闭 Modal，跳转 dashboard
 *
 * 真实对接时：把 loginWithQrCode 换成 dd.scanCode / dd.login 等钉钉开放能力。
 */

import React, { useEffect, useState } from 'react';
import { Modal, Button, Space, Typography, App, Spin, Divider } from 'antd';
import { CheckCircleFilled, QrcodeOutlined, MobileOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
  loginWithQrCode,
  saveDingtalkConnection,
  type DingtalkUserInfo,
} from '@/services/dingtalk';
import { eventBus } from '@/services/eventBus';
import { useUserStore } from '@/store/userStore';

const { Text, Title } = Typography;

export interface DingtalkQrLoginProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (info: DingtalkUserInfo) => void;
}

type Status = 'idle' | 'scanning' | 'scanned' | 'success' | 'error';

export const DingtalkQrLogin: React.FC<DingtalkQrLoginProps> = ({ open, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [status, setStatus] = useState<Status>('idle');
  const [userInfo, setUserInfo] = useState<DingtalkUserInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [countdown, setCountdown] = useState(60);

  const setUser = useUserStore((s) => s.setUser);
  const setToken = useUserStore((s) => s.setToken);

  useEffect(() => {
    if (!open) {
      // 重置状态
      setStatus('idle');
      setUserInfo(null);
      setErrorMsg('');
      setCountdown(60);
      return;
    }

    setStatus('scanning');

    const timer = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);

    loginWithQrCode({ timeoutMs: 60_000, simulateScan: true })
      .then((info) => {
        setUserInfo(info);
        setStatus('scanned');

        // 模拟确认过程
        setTimeout(() => {
          setStatus('success');
          // 写入 store
          setUser({
            id: `user-dt-${info.userid}`,
            username: info.userid,
            name: info.name,
            role: 'USER',
            department: info.mainDepartment,
            position: info.title,
            email: `${info.name}@apexis.com`,
            avatar: info.avatarUrl,
          });
          setToken(`dingtalk-mock-${info.unionId}`);

          saveDingtalkConnection({
            connected: true,
            corpId: 'sim_corp_apexis',
            appName: '睿枢 Apexis',
            userid: info.userid,
            unionId: info.unionId,
            connectedAt: new Date().toISOString(),
          });

          eventBus.emit('user.loggedIn', { userId: info.userid, method: 'dingtalk' });
          onSuccess?.(info);
          message.success(t('dingtalk.login.success', { name: info.name }));

          // 1.5s 后自动关闭
          setTimeout(() => {
            onClose();
            // 跳转到 dashboard（在 onClose 之后）
            window.location.hash = '#/dashboard';
          }, 1500);
        }, 1000);
      })
      .catch((err: Error) => {
        setStatus('error');
        setErrorMsg(err.message);
      });

    return () => {
      clearInterval(timer);
    };
  }, [open, onClose, onSuccess, setUser, setToken, message, t]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      style={{ width: 520, maxWidth: 'calc(100vw - 32px)' }}
      centered
      destroyOnHidden
      mask={{ closable: false }}
      title={
        <Space>
          <QrcodeOutlined style={{ color: '#1677FF', fontSize: 20 }} />
          <span>{t('dingtalk.login.title')}</span>
        </Space>
      }
    >
      <div style={{ display: 'flex', gap: 24, padding: '8px 0' }}>
        {/* 左侧：二维码占位（CSS 绘制） */}
        <div
          style={{
            width: 200,
            height: 200,
            background: '#fff',
            border: '2px solid #1677FF',
            borderRadius: 8,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {status === 'scanning' && (
            <>
              <QrcodeOutlined style={{ fontSize: 140, color: '#1677FF' }} />
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: 'linear-gradient(90deg, transparent, #1677FF, transparent)',
                  animation: 'qrScan 2s linear infinite',
                }}
              />
            </>
          )}
          {status === 'scanned' && (
            <Spin size="large" tip={t('dingtalk.login.confirming')} />
          )}
          {status === 'success' && (
            <CheckCircleFilled style={{ fontSize: 80, color: '#22A775' }} />
          )}
          {status === 'error' && (
            <Text type="danger">{errorMsg}</Text>
          )}
          <style>{`
            @keyframes qrScan {
              0% { transform: translateY(0); }
              50% { transform: translateY(196px); }
              100% { transform: translateY(0); }
            }
          `}</style>
        </div>

        {/* 右侧：说明 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Title level={5} style={{ marginTop: 0 }}>
            <MobileOutlined /> {t('dingtalk.login.scanTip')}
          </Title>
          <Text type="secondary" style={{ fontSize: 13, lineHeight: 1.7 }}>
            1. 打开手机<strong style={{ color: '#1677FF' }}>钉钉</strong><br />
            2. 点击右上角 <strong>+</strong> → 扫一扫<br />
            3. 对准左侧二维码即可登录
          </Text>

          <Divider style={{ margin: '14px 0' }} />

          {status === 'scanning' && (
            <Text style={{ fontSize: 12 }}>
              <span style={{ color: '#fa8c16' }}>●</span> {t('dingtalk.login.waiting', { seconds: countdown })}
            </Text>
          )}
          {status === 'scanned' && (
            <Text style={{ fontSize: 12 }}>
              <span style={{ color: '#22A775' }}>●</span> {t('dingtalk.login.scanned')}
            </Text>
          )}
          {status === 'success' && userInfo && (
            <div style={{ background: '#f6ffed', padding: 8, borderRadius: 6, border: '1px solid #b7eb8f' }}>
              <Text strong style={{ color: '#22A775', display: 'block' }}>
                ✓ {userInfo.name} · {userInfo.mainDepartment}
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {userInfo.jobNumber} · {userInfo.title}
              </Text>
            </div>
          )}
          {status === 'error' && (
            <Button size="small" danger onClick={() => setStatus('idle')}>
              {t('dingtalk.login.retry')}
            </Button>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: '#999' }}>
        {t('dingtalk.login.faq')}
      </div>
    </Modal>
  );
};

export default DingtalkQrLogin;
