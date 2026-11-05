import React from 'react';
import './TractorCard.css';
import { Tractor } from '../types';

interface TractorCardProps {
  tractor: Tractor;
  onViewDetails?: (tractor: Tractor) => void;
}

const TractorCard: React.FC<TractorCardProps> = ({ tractor, onViewDetails }) => {
  const formatPrice = (price: any) => {
    if (price === null || price === undefined || price === '0' || price === 0 || price === '') {
      return 'Contact for price';
    }

    const priceStr = String(price);

    // Handle price ranges like "5.16-5.32"
    if (priceStr.includes('-')) {
      const [min, max] = priceStr.split('-');
      const minPrice = parseFloat(min);
      const maxPrice = parseFloat(max);
      if (!isNaN(minPrice) && !isNaN(maxPrice)) {
        return `₹ ${minPrice} - ${maxPrice} Lakh*`;
      }
    }

    const numPrice = parseFloat(priceStr);
    if (isNaN(numPrice)) return 'Contact for price';

    // If it's a very large number (like from the DB directly), it might need formatting
    // But usually it's in Lakhs as per the UI
    return `₹ ${numPrice} Lakh*`;
  };

  const getImageUrl = (images?: string, image?: string) => {
    const imageSource = images || image;
    if (!imageSource) {
      // Use a default tractor image from Tractor Junction
      return 'https://assets.tractorjunction.com/tractor-junction/assets/images/upload/di-60-1631527166.webp?width=347&height=202';
    }
    const imageArray = imageSource.split(',');
    const firstImage = imageArray[0]?.trim();
    if (!firstImage) {
      return 'https://assets.tractorjunction.com/tractor-junction/assets/images/upload/di-60-1631527166.webp?width=347&height=202';
    }

    // If it's a full URL, return as is, otherwise construct the path
    if (firstImage.startsWith('http')) {
      return firstImage;
    }
    return `https://assets.tractorjunction.com/tractor-junction/assets/images/upload/${firstImage}?width=347&height=202`;
  };

  const getProductUrl = () => {
    const brandSlug = tractor.brand_slug || 'tractor';
    const modelSlug = tractor.model_name?.toLowerCase().replace(/\s+/g, '-') || 'model';
    return `https://www.tractorjunction.com/${brandSlug}-tractor/${modelSlug}`;
  };

  const handleViewDetails = () => {
    if (onViewDetails) {
      onViewDetails(tractor);
    }
  };

  return (
    <div className="tractor-card">
      <div className="tractor-card-image">
        <img
          src={getImageUrl(tractor.images, tractor.image)}
          alt={`${tractor.brand_name || 'Unknown'} ${tractor.model_name}`}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = 'https://assets.tractorjunction.com/tractor-junction/assets/images/upload/di-60-1631527166.webp?width=347&height=202';
          }}
        />
      </div>

      <div className="tractor-card-content">
        <div className="tractor-card-title">
          <a
            href={getProductUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="tractor-card-title-link"
          >
            {tractor.brand_name || 'Unknown'} {tractor.model_name}
          </a>
        </div>

        <div className="tractor-card-price">
          {formatPrice(tractor.price)}
        </div>

        <div className="tractor-card-emi">
          <span className="emi-text">For EMI </span>
          <a href={getProductUrl()} target="_blank" rel="noopener noreferrer" className="emi-link">Click Here</a>
        </div>

        <div className="tractor-card-actions">
          <button
            className="btn btn-primary"
            onClick={handleViewDetails}
          >
            Check Tractor Price
          </button>
        </div>
      </div>
    </div>
  );
};

export default TractorCard;
