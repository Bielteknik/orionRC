import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) {
    return null;
  }

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const getPageNumbers = () => {
    const pageNumbers = [];
    // Always show first page
    if (totalPages > 0) pageNumbers.push(1);

    // Ellipsis logic
    if (currentPage > 3) {
      pageNumbers.push('...');
    }

    // Pages around current page
    for (let i = currentPage - 1; i <= currentPage + 1; i++) {
      if (i > 1 && i < totalPages) {
        pageNumbers.push(i);
      }
    }

    // Ellipsis logic
    if (currentPage < totalPages - 2) {
      pageNumbers.push('...');
    }
    
    // Always show last page
    if (totalPages > 1) pageNumbers.push(totalPages);

    return [...new Set(pageNumbers)]; // Remove duplicates
  };


  return (
    <nav className="flex items-center justify-between border-t border-gray-200 px-4 py-3 sm:px-6 mt-4" aria-label="Pagination">
      <div className="flex-1 flex justify-between sm:justify-end">
        <button
          onClick={handlePrevious}
          disabled={currentPage === 1}
          className="relative inline-flex items-center rounded-md border border-gray-300 bg-primary px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Önceki
        </button>
        <div className="hidden sm:flex items-center mx-4">
            {getPageNumbers().map((page, index) =>
                 typeof page === 'number' ? (
                     <button
                        key={index}
                        onClick={() => onPageChange(page)}
                        className={`mx-1 px-4 py-2 text-sm font-medium rounded-md ${
                            currentPage === page
                            ? 'bg-accent text-white'
                            : 'bg-primary text-gray-700 hover:bg-gray-50'
                        }`}
                        aria-current={currentPage === page ? 'page' : undefined}
                     >
                        {page}
                     </button>
                 ) : (
                    <span key={index} className="px-4 py-2 text-sm font-medium text-gray-700">...</span>
                 )
            )}
        </div>
        <button
          onClick={handleNext}
          disabled={currentPage === totalPages}
          className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-primary px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Sonraki
        </button>
      </div>
    </nav>
  );
};

export default Pagination;