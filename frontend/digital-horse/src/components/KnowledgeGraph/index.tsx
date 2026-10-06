import React, { useState, useRef, useEffect } from 'react';
import { Card, Tag, Space, Typography, Tooltip, Button, Empty, Segmented } from 'antd';
import {
  ApartmentOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  ReloadOutlined,
  FullscreenOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

interface GraphNode {
  id: string;
  label: string;
  category: 'doc' | 'concept' | 'person' | 'project' | 'regulation';
  size?: number;
  description?: string;
}

interface GraphLink {
  source: string;
  target: string;
  relation: string;
  strength?: number;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface KnowledgeGraphProps {
  data: GraphData;
}

// 类别颜色（用纯色，不用 gradient）
const CATEGORY_COLORS: Record<GraphNode['category'], string> = {
  doc: '#1a56db',
  concept: '#22A775',
  person: '#C9A459',
  project: '#722ED1',
  regulation: '#D64045',
};

const CATEGORY_LABELS: Record<GraphNode['category'], string> = {
  doc: '文档',
  concept: '概念',
  person: '人员',
  project: '项目',
  regulation: '法规',
};

// 模拟力导向布局（轻量实现，避免引入第三方）
function layoutGraph(data: GraphData, width: number, height: number) {
  const { nodes, links } = data;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.35;

  // 按类别分组，环形布局
  const categories = Object.keys(CATEGORY_LABELS) as GraphNode['category'][];
  const categoryGroups: Record<string, GraphNode[]> = {};
  nodes.forEach((n) => {
    if (!categoryGroups[n.category]) categoryGroups[n.category] = [];
    categoryGroups[n.category].push(n);
  });

  const positioned: Record<string, { x: number; y: number }> = {};
  categories.forEach((cat, ci) => {
    const groupNodes = categoryGroups[cat] || [];
    const angle = (ci / categories.length) * Math.PI * 2;
    const groupCenterX = centerX + Math.cos(angle) * radius;
    const groupCenterY = centerY + Math.sin(angle) * radius;

    groupNodes.forEach((node, ni) => {
      const subAngle = (ni / Math.max(groupNodes.length, 1)) * Math.PI * 2;
      const subRadius = 40 + Math.min(groupNodes.length, 4) * 12;
      positioned[node.id] = {
        x: groupCenterX + Math.cos(subAngle) * subRadius,
        y: groupCenterY + Math.sin(subAngle) * subRadius,
      };
    });
  });

  return positioned;
}

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    const updateDimensions = () => {
      if (svgRef.current?.parentElement) {
        const rect = svgRef.current.parentElement.getBoundingClientRect();
        setDimensions({
          width: Math.max(rect.width, 400),
          height: Math.max(Math.min(rect.width * 0.6, 600), 400),
        });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const positions = layoutGraph(data, dimensions.width, dimensions.height);

  const visibleNodes =
    filter === 'all' ? data.nodes : data.nodes.filter((n) => n.category === filter);
  const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
  const visibleLinks = data.links.filter(
    (l) => visibleNodeIds.has(l.source) && visibleNodeIds.has(l.target)
  );

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 2));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.5));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleNodeClick = (node: GraphNode) => {
    console.log('Click node:', node);
  };

  if (!data.nodes.length) {
    return <Empty description="暂无图谱数据" />;
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* 控制栏 */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          right: 16,
          display: 'flex',
          justifyContent: 'space-between',
          zIndex: 10,
        }}
      >
        <Segmented
          value={filter}
          onChange={(v) => setFilter(v as string)}
          options={[
            { label: '全部', value: 'all' },
            ...Object.entries(CATEGORY_LABELS).map(([k, v]) => ({
              label: v,
              value: k,
            })),
          ]}
        />
        <Space>
          <Tooltip title="放大">
            <Button
              icon={<ZoomInOutlined />}
              onClick={handleZoomIn}
              size="small"
            />
          </Tooltip>
          <Tooltip title="缩小">
            <Button
              icon={<ZoomOutOutlined />}
              onClick={handleZoomOut}
              size="small"
            />
          </Tooltip>
          <Tooltip title="重置">
            <Button
              icon={<ReloadOutlined />}
              onClick={handleReset}
              size="small"
            />
          </Tooltip>
        </Space>
      </div>

      {/* 图例 */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          background: 'rgba(255,255,255,0.95)',
          padding: 12,
          borderRadius: 6,
          border: '1px solid #e5e7eb',
          zIndex: 10,
        }}
      >
        <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
          图例
        </Text>
        <Space orientation="vertical" size={4}>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <Space key={key}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: CATEGORY_COLORS[key as GraphNode['category']],
                  display: 'inline-block',
                }}
              />
              <Text style={{ fontSize: 12 }}>{label}</Text>
            </Space>
          ))}
        </Space>
      </div>

      {/* 节点详情 */}
      {hoveredNode && (
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            background: 'rgba(255,255,255,0.98)',
            padding: 12,
            borderRadius: 6,
            border: '1px solid #e5e7eb',
            minWidth: 200,
            maxWidth: 280,
            zIndex: 10,
          }}
        >
          {(() => {
            const node = data.nodes.find((n) => n.id === hoveredNode);
            if (!node) return null;
            return (
              <div>
                <Space style={{ marginBottom: 6 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: CATEGORY_COLORS[node.category],
                      display: 'inline-block',
                    }}
                  />
                  <Text strong>{node.label}</Text>
                </Space>
                <div>
                  <Tag color="default" style={{ fontSize: 11 }}>
                    {CATEGORY_LABELS[node.category]}
                  </Tag>
                </div>
                {node.description && (
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
                    {node.description}
                  </Text>
                )}
              </div>
            );
          })()}
        </div>
      )}

      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{
          background: '#f9fafb',
          cursor: 'grab',
          borderRadius: 6,
        }}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* 连线 */}
          {visibleLinks.map((link, i) => {
            const sourcePos = positions[link.source];
            const targetPos = positions[link.target];
            if (!sourcePos || !targetPos) return null;
            const isHighlighted =
              hoveredNode === link.source || hoveredNode === link.target;
            return (
              <g key={i}>
                <line
                  x1={sourcePos.x}
                  y1={sourcePos.y}
                  x2={targetPos.x}
                  y2={targetPos.y}
                  stroke={isHighlighted ? '#1a56db' : '#d1d5db'}
                  strokeWidth={isHighlighted ? 2 : 1}
                  opacity={isHighlighted ? 1 : 0.5}
                />
                <text
                  x={(sourcePos.x + targetPos.x) / 2}
                  y={(sourcePos.y + targetPos.y) / 2 - 4}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#6b7280"
                  style={{
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}
                >
                  {link.relation}
                </text>
              </g>
            );
          })}

          {/* 节点 */}
          {visibleNodes.map((node) => {
            const pos = positions[node.id];
            if (!pos) return null;
            const isHovered = hoveredNode === node.id;
            const color = CATEGORY_COLORS[node.category];
            return (
              <g
                key={node.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => handleNodeClick(node)}
                style={{ cursor: 'pointer' }}
              >
                {/* 节点外圈（高亮时） */}
                {isHovered && (
                  <circle
                    r={node.size ? node.size + 6 : 26}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    opacity={0.3}
                  />
                )}
                {/* 节点 */}
                <circle
                  r={node.size || 20}
                  fill={color}
                  opacity={isHovered ? 1 : 0.85}
                />
                {/* 节点文字 */}
                <text
                  y={node.size ? node.size + 16 : 36}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={500}
                  fill="#1f2937"
                  style={{
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}
                >
                  {node.label.length > 8 ? node.label.slice(0, 8) + '…' : node.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* 统计 */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          background: 'rgba(255,255,255,0.95)',
          padding: '6px 12px',
          borderRadius: 4,
          border: '1px solid #e5e7eb',
          fontSize: 12,
        }}
      >
        <Space>
          <ApartmentOutlined style={{ color: '#6b7280' }} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {visibleNodes.length} 节点 / {visibleLinks.length} 关系
          </Text>
        </Space>
      </div>
    </div>
  );
};

// 默认演示数据（金融行业知识图谱）
export const DEMO_GRAPH_DATA: GraphData = {
  nodes: [
    // 文档
    { id: 'd1', label: '差旅费管理办法', category: 'doc', description: '公司差旅费报销标准与流程', size: 24 },
    { id: 'd2', label: '销售合同 V2.1', category: 'doc', description: '与某某基金签订的销售合同' },
    { id: 'd3', label: 'Q3 财务报告', category: 'doc', description: '2026 Q3 财务分析报告' },
    { id: 'd4', label: '员工手册', category: 'doc', description: '公司员工行为规范' },

    // 概念
    { id: 'c1', label: '差旅报销', category: 'concept' },
    { id: 'c2', label: '分成比例', category: 'concept' },
    { id: 'c3', label: '回款风险', category: 'concept' },
    { id: 'c4', label: '财务合规', category: 'concept' },
    { id: 'c5', label: '风险管理', category: 'concept' },

    // 人员
    { id: 'p1', label: '张三', category: 'person', description: '技术部 / 超级管理员' },
    { id: 'p2', label: '李四', category: 'person', description: '财务部 / 部门管理员' },
    { id: 'p3', label: '王五', category: 'person', description: '合规部 / 部门管理员' },

    // 项目
    { id: 'pr1', label: 'AI 助手 V2', category: 'project', description: 'AI 智能助手升级项目' },
    { id: 'pr2', label: '某某基金合作', category: 'project', description: '与某某基金的销售合作项目' },

    // 法规
    { id: 'r1', label: '金融监管新规', category: 'regulation', description: '2024 年最新金融监管政策' },
    { id: 'r2', label: '合同法', category: 'regulation' },
  ],
  links: [
    // 文档 - 概念
    { source: 'd1', target: 'c1', relation: '说明' },
    { source: 'd1', target: 'c4', relation: '规范' },
    { source: 'd2', target: 'c2', relation: '约定' },
    { source: 'd2', target: 'c3', relation: '涉及' },
    { source: 'd3', target: 'c4', relation: '反映' },
    { source: 'd4', target: 'c4', relation: '规范' },

    // 文档 - 人员
    { source: 'd1', target: 'p2', relation: '维护' },
    { source: 'd2', target: 'p3', relation: '审核' },

    // 文档 - 项目
    { source: 'd2', target: 'pr2', relation: '项目文档' },
    { source: 'd3', target: 'pr1', relation: '项目文档' },

    // 文档 - 法规
    { source: 'd2', target: 'r2', relation: '依据' },
    { source: 'd4', target: 'r1', relation: '依据' },

    // 人员 - 项目
    { source: 'p1', target: 'pr1', relation: '负责' },
    { source: 'p3', target: 'pr2', relation: '参与' },

    // 概念 - 法规
    { source: 'c3', target: 'r1', relation: '依据' },
    { source: 'c4', target: 'r1', relation: '依据' },
    { source: 'c5', target: 'r1', relation: '相关' },

    // 跨概念关联
    { source: 'c2', target: 'c3', relation: '影响' },
    { source: 'c1', target: 'c4', relation: '属于' },

    // 人员关联
    { source: 'p1', target: 'p2', relation: '协作' },
    { source: 'p2', target: 'p3', relation: '协作' },
  ],
};

export default KnowledgeGraph;
