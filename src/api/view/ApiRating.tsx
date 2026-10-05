import { Star } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import Skeleton from '@mui/material/Skeleton';
import { Config } from '../../service/ApiFactory';

interface Rating {
  configId: number;
  scoreAvailability: number;
  scoreQuality: number;
}

interface ApiRatingProps {
  conf: Config | null;
  ratingChanged: (configs: Config[]) => void;
}

const ApiRating: React.FC<ApiRatingProps> = ({ conf, ratingChanged }) => {
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [config, setConfig] = useState<Config | (Pick<Config, 'ratingValue' | 'ratingCount' | 'averageRating'> & { id?: number })>({ ratingValue: 0, ratingCount: 0, averageRating: 0 });
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [currentRating, setCurrentRating] = useState<Rating>({ scoreAvailability: 0, scoreQuality: 0, configId: -1 });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        const data: Rating[] = await response.json();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint, conf?.id]);

  const findRating = (configId: number): Rating => {
    return ratings.find(r => r.configId === configId) || { scoreAvailability: 0, scoreQuality: 0, configId };
  };

  const handleRating = async (configId: number, score: number, action: 'availability' | 'quality') => {
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
      const data: Config[] = await response.json();
      ratingChanged(data);
      const updatedConfig = data.find(c => c.id === configId);
      if (updatedConfig) setConfig(updatedConfig);

      // Aktualisiere die Ratings nach dem Rating
      const ratingsResponse = await fetch(`/api/ratings/get`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Fingerprint': fingerprint
        }
      });
      const ratingsData: Rating[] = await ratingsResponse.json();
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

  const RatingStars: React.FC<{ score: number; onRatingClick: (score: number) => void }> = ({ score, onRatingClick }) => {
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
                transition: 'all 0.2s ease',
                stroke: starScore <= (hoverScore || score) ? 'var(--rating)' : 'var(--border)',
                fill: starScore <= (hoverScore || score) ? 'var(--rating)' : 'transparent'
              }}
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
      <div className="rating-title">Rating</div>
      <div className="is-flex is-justify-content-center" style={{ gap: '4rem' }}>
        <div className="is-flex is-flex-direction-column is-align-items-center" style={{ gap: '0.75rem' }}>
          <span className="rating-label">Availability</span>
          <RatingStars
            score={currentRating.scoreAvailability}
            onRatingClick={(score) => config.id !== undefined && handleRating(config.id, score, 'availability')}
          />
        </div>
        <div className="is-flex is-flex-direction-column is-align-items-center" style={{ gap: '0.75rem' }}>
          <span className="rating-label">Quality</span>
          <RatingStars
            score={currentRating.scoreQuality}
            onRatingClick={(score) => config.id !== undefined && handleRating(config.id, score, 'quality')}
          />
        </div>
      </div>
    </div>
    </>
  );
};

export default ApiRating;
