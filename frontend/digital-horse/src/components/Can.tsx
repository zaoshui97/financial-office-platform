/**
 * <Can /> 组件 —— 按钮 / UI 片段级权限控制
 *
 * 用法：
 *   <Can resource="workitem" action="approve">
 *     <Button onClick={onApprove}>批准</Button>
 *   </Can>
 *
 *   <Can resource="user" action="delete" fallback={<Tag>只读</Tag>}>
 *     <Popconfirm>...删除...</Popconfirm>
 *   </Can>
 */

import React from 'react';
import { usePermission } from '@/hooks/usePermission';
import type { Resource, Action } from '@/types/permission';

interface CanProps {
  resource: Resource;
  action: Action;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const Can: React.FC<CanProps> = ({ resource, action, children, fallback = null }) => {
  const { can } = usePermission();
  if (!can(resource, action)) return <>{fallback}</>;
  return <>{children}</>;
};

export default Can;
