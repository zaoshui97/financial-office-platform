/**
 * 会议详情（备用路由 /meetings/:id）
 *
 * 主要入口是 MeetingHub 的 detail tab → MeetingDetail.tsx。
 * 本文件保留供路由 /meetings/:id 兼容访问。
 */
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Spin, Empty } from 'antd';

const MeetingDetailAlt: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const mid = Number(id ?? 0);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  if (!mid) {
    return <Empty description="会议 ID 缺失" />;
  }

  return (
    <div style={{ padding: 24 }}>
      <Card title={`会议 #${mid}`} extra="详情（备用路由）">
        {loading ? (
          <Spin />
        ) : (
          <p>主要功能已迁至 <code>/meeting?tab=detail&amp;id={mid}</code></p>
        )}
      </Card>
    </div>
  );
};

export default MeetingDetailAlt;