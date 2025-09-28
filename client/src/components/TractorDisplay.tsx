import React, { useState, useEffect } from 'react';
import TractorGrid from './TractorGrid';
import { Tractor } from '../types';

const TractorDisplay: React.FC = () => {
  const [tractors, setTractors] = useState<Tractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchTractors = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/tractors?page=${page}&limit=12`);
      const data = await response.json();
      
      if (data.success) {
        setTractors(data.data.tractors);
        setCurrentPage(data.data.pagination.currentPage);
        setTotalPages(data.data.pagination.totalPages);
        setTotalCount(data.data.pagination.totalCount);
      } else {
        setError(data.message || 'Failed to fetch tractors');
      }
    } catch (err) {
      setError('Network error: Failed to fetch tractors');
      console.error('Error fetching tractors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTractors();
  }, []);

  const handlePageChange = (page: number) => {
    fetchTractors(page);
  };

  const handleTractorClick = (tractor: Tractor) => {
    console.log('Tractor clicked:', tractor);
    // You can add more functionality here, like opening a detailed view
  };

  if (error) {
    return (
      <div className="error-container">
        <div className="error-icon">⚠️</div>
        <h3>Error Loading Tractors</h3>
        <p>{error}</p>
        <button 
          className="btn btn-primary"
          onClick={() => fetchTractors(currentPage)}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="tractor-display">
      <div className="tractor-display-header">
        <h2>Available Tractors</h2>
        <p>Showing {tractors.length} of {totalCount} tractors</p>
      </div>
      
      <TractorGrid 
        tractors={tractors}
        loading={loading}
        onViewDetails={handleTractorClick}
      />
      
      {!loading && tractors.length > 0 && (
        <div className="pagination">
          <button 
            className="btn btn-secondary"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          
          <span className="pagination-info">
            Page {currentPage} of {totalPages}
          </span>
          
          <button 
            className="btn btn-secondary"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default TractorDisplay;
