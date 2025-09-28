import React from 'react';
import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  Box,
  Chip,
  Button,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  OpenInNew as OpenInNewIcon,
  Favorite as FavoriteIcon,
  Share as ShareIcon,
  LocalGasStation as FuelIcon,
  Speed as SpeedIcon,
  Build as BuildIcon,
} from '@mui/icons-material';
import { Fade } from '@mui/material';

interface Product {
  tractor_id: string;
  brand: string;
  model: string;
  price?: number;
  engine_power?: string;
  fuel_type?: string;
  transmission?: string;
  category?: string;
  description?: string;
  specifications?: any;
  features?: any;
  images?: string[];
  similarity_score?: number;
}

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const formatPrice = (price?: number) => {
    if (!price) return 'Contact for price';
    return `₹${price.toLocaleString('en-IN')}`;
  };

  const handleViewDetails = () => {
    // Open product details in new tab
    const url = `https://www.tractorjunction.com/tractors/${product.tractor_id}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `${product.brand} ${product.model}`,
        text: `Check out this ${product.brand} ${product.model} tractor`,
        url: `https://www.tractorjunction.com/tractors/${product.tractor_id}`,
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(
        `https://www.tractorjunction.com/tractors/${product.tractor_id}`
      );
    }
  };

  const getFeatureChips = () => {
    const features = [];
    
    if (product.engine_power) {
      features.push(
        <Chip
          key="power"
          icon={<SpeedIcon />}
          label={product.engine_power}
          size="small"
          variant="outlined"
          color="primary"
        />
      );
    }
    
    if (product.fuel_type) {
      features.push(
        <Chip
          key="fuel"
          icon={<FuelIcon />}
          label={product.fuel_type}
          size="small"
          variant="outlined"
          color="secondary"
        />
      );
    }
    
    if (product.transmission) {
      features.push(
        <Chip
          key="transmission"
          icon={<BuildIcon />}
          label={product.transmission}
          size="small"
          variant="outlined"
          color="default"
        />
      );
    }

    return features;
  };

  return (
    <Fade in timeout={600}>
      <Card
        sx={{
          maxWidth: 400,
          borderRadius: 2,
          boxShadow: 2,
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: 4,
            transform: 'translateY(-2px)',
          },
        }}
      >
        {product.images && product.images.length > 0 && (
          <CardMedia
            component="img"
            height="200"
            image={product.images[0]}
            alt={`${product.brand} ${product.model}`}
            sx={{
              objectFit: 'cover',
              background: 'linear-gradient(45deg, #f5f5f5 30%, #e0e0e0 90%)',
            }}
          />
        )}

        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Typography variant="h6" component="h3" sx={{ fontWeight: 600, color: 'primary.main' }}>
              {product.brand}
            </Typography>
            {product.similarity_score && (
              <Chip
                label={`${Math.round((1 - product.similarity_score) * 100)}% match`}
                size="small"
                color="success"
                variant="outlined"
              />
            )}
          </Box>

          <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 1, color: 'text.primary' }}>
            {product.model}
          </Typography>

          {product.category && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {product.category}
            </Typography>
          )}

          <Typography variant="h6" color="success.main" sx={{ fontWeight: 600, mb: 2 }}>
            {formatPrice(product.price)}
          </Typography>

          {product.description && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mb: 2,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {product.description}
            </Typography>
          )}

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
            {getFeatureChips()}
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleViewDetails}
              startIcon={<OpenInNewIcon />}
              sx={{ borderRadius: 2 }}
            >
              View Details
            </Button>

            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="Add to favorites">
                <IconButton size="small" color="error">
                  <FavoriteIcon />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Share">
                <IconButton size="small" color="primary" onClick={handleShare}>
                  <ShareIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Fade>
  );
};

export default ProductCard;
