import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
  return (
    <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded-md ${className}`} />
  );
};

export const TableRowSkeleton = () => (
    <tr>
        <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
        <td className="px-6 py-4"><Skeleton className="h-4 w-32" /></td>
        <td className="px-6 py-4"><Skeleton className="h-4 w-20" /></td>
        <td className="px-6 py-4"><Skeleton className="h-4 w-20" /></td>
        <td className="px-6 py-4"><Skeleton className="h-4 w-16" /></td>
        <td className="px-6 py-4"><Skeleton className="h-4 w-16" /></td>
    </tr>
);