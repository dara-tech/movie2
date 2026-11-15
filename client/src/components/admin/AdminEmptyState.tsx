import React from 'react';

interface AdminEmptyStateProps {
  icon?: React.ReactNode | React.ComponentType<any>;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode | React.ComponentType<any>;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode | React.ComponentType<any>;
  };
  className?: string;
}

export const AdminEmptyState: React.FC<AdminEmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className = '',
}) => {
  const renderIcon = (ic?: React.ReactNode | React.ComponentType<any>) => {
    if (!ic) return null;
    if (React.isValidElement(ic)) return ic;
    if (typeof ic === 'function' || typeof ic === 'object') {
      const IconComp = ic as React.ComponentType<any>;
      return <IconComp className="w-8 h-8 text-[var(--sys-cyan)]" size={32} />;
    }
    return ic;
  };

  return (
    <div className={`sys-empty-container ${className}`}>
      {icon && (
        <div className="sys-empty-icon-wrap">
          {renderIcon(icon)}
        </div>
      )}
      <h3 className="sys-empty-title">{title}</h3>
      {description && <p className="sys-empty-desc">{description}</p>}
      
      {(action || secondaryAction) && (
        <div className="sys-empty-actions">
          {action && (
            <button
              type="button"
              className="app-btn app-btn-primary app-btn-sm"
              onClick={action.onClick}
            >
              {action.icon && <span className="mr-1">{renderIcon(action.icon)}</span>}
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              className="app-btn app-btn-secondary app-btn-sm"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.icon && <span className="mr-1">{renderIcon(secondaryAction.icon)}</span>}
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminEmptyState;
