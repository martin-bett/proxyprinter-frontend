import { Star } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import Skeleton from '@mui/material/Skeleton';

const ApiRating = ({ conf, ratingChanged }) => {
  const [fingerprint, setFingerprint] = useState(null);
  const [config, setConfig] = useState({ ratingValue: 0, ratingCount: 0, averageRating: 0 });
  const [ratings, setRatings] = useState([]);
  const [currentRating, setCurrentRating] = useState({ scoreAvailability: 0, scoreQuality: 0, configId: -1 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (conf) {
      setConfig(conf);
      if (ratings.length > 0) {
        const rating = findRating(conf.id);
        if (rating) {
          setCurrentRating(rating);
        }
      }
    }
  }, [conf, ratings]);

  useEffect(() => {
    const initFingerprint = async () => {
      try {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        setFingerprint(result.visitorId);
      } catch (error) {
        console.error('Fehler beim Laden des Fingerprints:', error);
        setIsLoading(false);
      }
    };
    initFingerprint();
  }, []);

  useEffect(() => {
    const fetchRatings = async () => {
      if (!fingerprint) return;
      
      try {
        setIsLoading(true);
        const response = await fetch(`/api/ratings/get`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Fingerprint': fingerprint
          }
        });
        const data = await response.json();
        setRatings(data);
        if (conf) {
          const rating = data.find(r => r.configId === conf.id);
          if (rating) {
            setCurrentRating(rating);
          }
        }
      } catch (error) {
        console.error('Fehler beim Laden der Ratings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (fingerprint) {
      fetchRatings();
    }
  }, [fingerprint, conf?.id]);

  const findRating = (configId) => {
    return ratings.find(r => r.configId === configId) || { scoreAvailability: 0, scoreQuality: 0, configId };
  };

  const handleRating = async (configId, score, action) => {
    if (!fingerprint) return;

    try {
      setIsLoading(true);
      await fetch(`/api/configs/${configId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Fingerprint': fingerprint
        },
        body: JSON.stringify({ score, action })
      });

      const response = await fetch('/api/configs');
      const data = await response.json();
      ratingChanged(data);
      setConfig(data.find(conf => conf.id === configId));
      
      // Aktualisiere die Ratings nach dem Rating
      const ratingsResponse = await fetch(`/api/ratings/get`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Fingerprint': fingerprint
        }
      });
      const ratingsData = await ratingsResponse.json();
      setRatings(ratingsData);
    } catch (error) {
      console.error('Error rating config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!conf) {
    return null;
  }

  const RatingStars = ({ score, onRatingClick }) => {
    const [hoverScore, setHoverScore] = useState(0);
    
    return (
      <div className="is-flex is-align-items-center" style={{ gap: '1rem' }}>
        {[1, 2, 3, 4, 5].map(starScore => (
          <div 
            key={starScore}
            style={{ 
              cursor: 'pointer',
              width: '40px',
              height: '40px',
              position: 'relative'
            }}
            onClick={() => onRatingClick(starScore)}
            onMouseEnter={() => setHoverScore(starScore)}
            onMouseLeave={() => setHoverScore(0)}
          >
            <Star
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                transition: 'all 0.2s ease'
              }}
              stroke={starScore <= (hoverScore || score) ? '#3b82f6' : '#dbdbdb'}
              fill={starScore <= (hoverScore || score) ? '#3b82f6' : 'transparent'}
            />
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div>
        <Skeleton variant="text" width={200} height={30} />
        <Skeleton variant="text" width={200} height={30} />
      </div>
    );
  }

  return (
    <>
    <div className="rating-container">
    <button className="button" type="button" >
            Rating
    </button>
      <div className="is-flex is-justify-content-center" style={{ gap: '4rem' }}>
        <div className="is-flex is-flex-direction-column is-align-items-center" style={{ gap: '0.75rem' }}>
          <span className="is-size-5 has-text-grey">Availability</span>
          <RatingStars
            score={currentRating.scoreAvailability}
            onRatingClick={(score) => handleRating(config.id, score, 'availability')}
          />
        </div>
        <div className="is-flex is-flex-direction-column is-align-items-center" style={{ gap: '0.75rem' }}>
          <span className="is-size-5 has-text-grey">Quality</span>
          <RatingStars
            score={currentRating.scoreQuality}
            onRatingClick={(score) => handleRating(config.id, score, 'quality')}
          />
        </div>
      </div>
    </div>
    </>
  );
};

export default ApiRating;