import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface AdminPaginationProps {
  currentPage: number;
  totalItems?: number;
  pageSize?: number;
  totalPages?: number;
  itemsPerPage?: number;
  onPageChange: (page: number) => void;
  itemName?: string;
}

export const AdminPagination: React.FC<AdminPaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  totalPages: propTotalPages,
  itemsPerPage,
  onPageChange,
  itemName = 'entries',
}) => {
  const effectivePageSize = pageSize || itemsPerPage || 20;
  const totalPages = propTotalPages || (totalItems !== undefined ? Math.max(1, Math.ceil(totalItems / effectivePageSize)) : 1);
  const effectiveTotalItems = totalItems !== undefined ? totalItems : (totalPages * effectivePageSize);
  const startItem = effectiveTotalItems === 0 ? 0 : (currentPage - 1) * effectivePageSize + 1;
  const endItem = Math.min(currentPage * effectivePageSize, effectiveTotalItems);

  if (totalPages <= 1 && totalItems === 0) return null;

  return (
    <div className="admin-pagination-bar">
      <div className="pagination-info">
        Showing <span className="font-semibold text-[var(--sys-text)]">{startItem}</span> to{' '}
        <span className="font-semibold text-[var(--sys-text)]">{endItem}</span> of{' '}
        <span className="font-semibold text-[var(--sys-text)]">{effectiveTotalItems}</span> {itemName}
      </div>

      <div className="pagination-controls">
        {/* First Page */}
        <button
          type="button"
          className="pagination-btn"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          title="First page"
        >
          <ChevronsLeft size={14} />
        </button>

        {/* Previous Page */}
        <button
          type="button"
          className="pagination-btn"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          title="Previous page"
        >
          <ChevronLeft size={14} />
        </button>

        {/* Page Numbers */}
        <div className="pagination-pages">
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
            .map((page, idx, arr) => {
              const prev = arr[idx - 1];
              const isCurrent = currentPage === page;
              return (
                <React.Fragment key={page}>
                  {prev && page - prev > 1 && <span className="pagination-ellipsis">…</span>}
                  <button
                    type="button"
                    className={`pagination-page-number ${isCurrent ? 'active' : ''}`}
                    onClick={() => onPageChange(page)}
                  >
                    {page}
                  </button>
                </React.Fragment>
              );
            })}
        </div>

        {/* Next Page */}
        <button
          type="button"
          className="pagination-btn"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          title="Next page"
        >
          <ChevronRight size={14} />
        </button>

        {/* Last Page */}
        <button
          type="button"
          className="pagination-btn"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          title="Last page"
        >
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default AdminPagination;
