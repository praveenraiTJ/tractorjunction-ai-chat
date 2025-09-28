import React, { useState } from 'react';
import TractorCard from './TractorCard';
import './TractorCard.css';
import { Tractor, TractorGridProps } from '../types';

const TractorGrid: React.FC<TractorGridProps> = ({ 
  tractors, 
  loading = false, 
  onViewDetails 
}) => {
  const [selectedTractor, setSelectedTractor] = useState<Tractor | null>(null);

  const handleTractorClick = (tractor: Tractor) => {
    setSelectedTractor(tractor);
    if (onViewDetails) {
      onViewDetails(tractor);
    }
  };

  if (loading) {
    return (
      <div className="tractors-grid">
        {[...Array(6)].map((_, index) => (
          <div key={index} className="tractor-card-skeleton">
            <div className="skeleton-image"></div>
            <div className="skeleton-content">
              <div className="skeleton-title"></div>
              <div className="skeleton-price"></div>
              <div className="skeleton-specs">
                <div className="skeleton-spec"></div>
                <div className="skeleton-spec"></div>
                <div className="skeleton-spec"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tractors.length === 0) {
    return (
      <div className="no-tractors">
        <div className="no-tractors-icon">🚜</div>
        <h3>No Tractors Found</h3>
        <p>Try adjusting your search criteria or browse our available tractors.</p>
      </div>
    );
  }

  return (
    <>
      <div className="tractors-grid">
        {tractors.map((tractor) => (
          <TractorCard
            key={tractor.id}
            tractor={tractor}
            onViewDetails={handleTractorClick}
          />
        ))}
      </div>
      
      {selectedTractor && (
        <div className="tractor-modal-overlay" onClick={() => setSelectedTractor(null)}>
          <div className="tractor-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close"
              onClick={() => setSelectedTractor(null)}
            >
              ×
            </button>
            <TractorCard
              tractor={selectedTractor}
              onViewDetails={() => setSelectedTractor(null)}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default TractorGrid;
