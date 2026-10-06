/**
 * BatchComplianceScanPanel —— 批量合规回扫
 *
 * 场景：合规专员在月底 / 季末对历史研报、工单文本做批量回扫，
 *       生成"合规体检报告"矩阵。
 *
 * 演示模式：从 store / mock 取出多条文本，依次过沙箱引擎，输出表格 + 摘要
 * 真实对接：fetch('/api/sandbox/batch', { texts })
 */

import React, { useState } from 'react';
import {
  Card,
  Button,
  Table,
  Tag,
  Space,
  Typography,
  Progress,
  Statistic,
  Row,
  Col,
  App,
  Alert,
  Empty,
} from 'antd';
import {
  ScanOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { runSandboxCheck, type SandboxResult } from '@/services/sandbox/sandboxEngine';
import type { MeetingWorkItem } from '@/store/meetingWorkItemStore';

const { Text, Title } = Typography;

interface BatchScanPanelProps {
  /** 待扫描的工单列表（演示模式下用 meetingWorkItems） */
  source: MeetingWorkItem[];
  /** 标题 */
  title?: string;
}

interface ScanRow {
  key: string;
  workItemId: string;
  title: string;
  assignee: string;
  text: string;
  result?: SandboxResult;
  status: 'pending' | 'running' | 'done' | 'error';
}

export const BatchComplianceScanPanel: React.FC<BatchScanPanelProps> = ({
  source,
  title = '批量合规回扫',
}) => {
  const { message } = App.useApp();
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);

  const startScan = async () => {
    if (source.length === 0) {
      message.warning('暂无可扫描的工单');
      return;
    }
    const initialRows: ScanRow[] = source.map((w) => ({
      key: w.id,
      workItemId: w.id,
      title: w.title,
      assignee: w.assignee,
      text: w.text,
      status: 'pending',
    }));
    setRows(initialRows);
    setScanning(true);
    setProgress(0);

    let pass = 0;
    let fail = 0;
    let blocked = 0;

    for (let i = 0; i < initialRows.length; i++) {
      const row = initialRows[i];
      setRows((prev) =>
        prev.map((r) => (r.key === row.key ? { ...r, status: 'running' } : r))
      );
      // 模拟异步
      await new Promise((r) => setTimeout(r, 300 + Math.random() * 300));
      try {
        const result = runSandboxCheck(row.text);
        if (result.blocked) blocked++;
        else if (result.passed) pass++;
        else fail++;
        setRows((prev) =>
          prev.map((r) =>
            r.key === row.key ? { ...r, status: 'done', result } : r
          )
        );
      } catch {
        setRows((prev) =>
          prev.map((r) => (r.key === row.key ? { ...r, status: 'error' } : r))
        );
      }
      setProgress(Math.round(((i + 1) / initialRows.length) * 100));
    }

    setScanning(false);
    message.success(
      `批量回扫完成：通过 ${pass} / 警告 ${fail} / 阻断 ${blocked}`
    );
  };

  const exportCsv = () => {
    if (rows.length === 0) return;
    const header = '工单ID,标题,负责人,评分,是否通过,是否阻断,问题数\n';
    const data = rows
      .map((r) => {
        if (!r.result) return `${r.workItemId},"${r.title}",${r.assignee},-,--,--,0`;
        return `${r.workItemId},"${r.title.replace(/"/g, '""')}",${r.assignee},${r.result.score.toFixed(1)},${r.result.passed ? '通过' : '不通过'},${r.result.blocked ? '阻断' : '正常'},${r.result.issues.length}`;
      })
      .join('\n');
    const csv = '\ufeff' + header + data;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-batch-scan-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const passCount = rows.filter((r) => r.result?.passed && !r.result?.blocked).length;
  const failCount = rows.filter((r) => r.result && !r.result.passed && !r.result.blocked).length;
  const blockCount = rows.filter((r) => r.result?.blocked).length;

  return (
    <Card
      title={
        <Space>
          <ScanOutlined />
          <span>{title}</span>
          <Tag color="blue">演示模式</Tag>
        </Space>
      }
      extra={
        <Space>
          <Button
            type="primary"
            icon={<ScanOutlined />}
            loading={scanning}
            onClick={startScan}
            disabled={source.length === 0}
          >
            开始回扫（{source.length} 条）
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={exportCsv}
            disabled={rows.length === 0 || scanning}
          >
            导出 CSV
          </Button>
        </Space>
      }
      size="small"
    >
      {rows.length === 0 && (
        <Empty description="点击「开始回扫」启动批量合规检测" />
      )}

      {scanning && (
        <div style={{ marginBottom: 12 }}>
          <Progress percent={progress} status="active" />
        </div>
      )}

      {rows.length > 0 && (
        <>
          <Row gutter={12} style={{ marginBottom: 12 }}>
            <Col span={8}>
              <Statistic
                title="通过"
                value={passCount}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#3f8600' }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="警告"
                value={failCount}
                prefix={<ExclamationCircleOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="阻断"
                value={blockCount}
                prefix={<CloseCircleOutlined />}
                valueStyle={{ color: '#cf1322' }}
              />
            </Col>
          </Row>

          {blockCount > 0 && (
            <Alert
              type="error"
              showIcon
              message={`发现 ${blockCount} 条阻断级违规`}
              description="建议立即人工复核，对应工单可能需要驳回或重新发起合规改写。"
              style={{ marginBottom: 12 }}
            />
          )}

          <Table
            size="small"
            pagination={false}
            dataSource={rows}
            columns={[
              { title: '工单', dataIndex: 'title', ellipsis: true, width: '40%' },
              { title: '负责人', dataIndex: 'assignee', width: 100 },
              {
                title: '状态',
                dataIndex: 'status',
                width: 100,
                render: (status: ScanRow['status']) => {
                  const map = {
                    pending: { color: 'default', text: '等待' },
                    running: { color: 'processing', text: '检测中' },
                    done: { color: 'success', text: '完成' },
                    error: { color: 'error', text: '失败' },
                  } as const;
                  const m = map[status];
                  return <Tag color={m.color}>{m.text}</Tag>;
                },
              },
              {
                title: '评分',
                width: 80,
                render: (_, r) =>
                  r.result ? (
                    <Text strong style={{ color: r.result.passed ? '#3f8600' : '#cf1322' }}>
                      {r.result.score.toFixed(1)}
                    </Text>
                  ) : (
                    '-'
                  ),
              },
              {
                title: '阻断',
                width: 80,
                render: (_, r) =>
                  r.result?.blocked ? <Tag color="error">是</Tag> : r.result ? <Tag color="success">否</Tag> : '-',
              },
              {
                title: '问题',
                width: 80,
                render: (_, r) => (r.result ? r.result.issues.length : '-'),
              },
            ]}
          />
        </>
      )}
    </Card>
  );
};

export default BatchComplianceScanPanel;
