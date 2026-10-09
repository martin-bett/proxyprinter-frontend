import { Star } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Skeleton from '@mui/material/Skeleton';
import { Config } from '../../service/ApiFactory';
import { useAuth } from '../../service/auth/auth';

interface Rating {
  configId: number;
  scoreAvailability: number;
  scoreQuality: number;
}

interface ApiRatingProps {
  conf: Config | null;
  ratingChanged: (configs: Config[]) => void;
}

/** Eigene Bewertung einer Config, nur angemeldet (eine pro Konto). */
const ApiRating: React.FC<ApiRatingProps> = ({ conf, ratingChanged }) => {
  const { t } = useTranslation();
  const auth = useAuth();
  const loggedIn = !!auth.email;
  const [config, setConfig] = useState<Config | (Pick<Config, 'ratingValue' | 'ratingCount' | 'averageRating'> & { id?: number })>({ ratingValue: 0, ratingCount: 0, averageRating: 0 });
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [currentRating, setCurrentRating] = useState<Rating>({ scoreAvailability: 0, scoreQuality: 0, configId: -1 });
  const [isLoading, setIsLoading] = useState(false);

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
    const fetchRatings = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/ratings/get`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
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
        console.error('Error loading the ratings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (loggedIn) {
      fetchRatings();
    } else {
      setRatings([]);
      setCurrentRating({ scoreAvailability: 0, scoreQuality: 0, configId: -1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn, conf?.id]);

  const findRating = (configId: number): Rating => {
    return ratings.find(r => r.configId === configId) || { scoreAvailability: 0, scoreQuality: 0, configId };
  };

  const handleRating = async (configId: number, score: number, action: 'availability' | 'quality') => {
    if (!loggedIn) return;

    try {
      setIsLoading(true);
      await fetch(`/api/configs/${configId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score, action })
      });

      const response = await fetch('/api/configs');
      const data: Config[] = await response.json();
      ratingChanged(data);
      const updatedConfig = data.find(c => c.id === configId);
      if (updatedConfig) setConfig(updatedConfig);

      // Aktualisiere die Ratings nach dem Rating
      const ratingsResponse = await fetch(`/api/ratings/get`, {
        headers: { 'Content-Type': 'application/json' },
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
    const shown = loggedIn ? (hoverScore || score) : 0;

    return (
      <div className="is-flex is-align-items-center" style={{ gap: '1rem' }}>
        {[1, 2, 3, 4, 5].map(starScore => (
          <div
            key={starScore}
            style={{
              cursor: loggedIn ? 'pointer' : 'default',
              width: '40px',
              height: '40px',
              position: 'relative'
            }}
            onClick={() => loggedIn && onRatingClick(starScore)}
            onMouseEnter={() => loggedIn && setHoverScore(starScore)}
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
                stroke: starScore <= shown ? 'var(--rating)' : 'var(--border)',
                fill: starScore <= shown ? 'var(--rating)' : 'transparent'
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
    <div className="rating-container" title={loggedIn ? undefined : t('rating.loginToRate')}>
      <div className="rating-title">{t('rating.title')}</div>
      <div className="is-flex is-justify-content-center" style={{ gap: '4rem' }}>
        <div className="is-flex is-flex-direction-column is-align-items-center" style={{ gap: '0.75rem' }}>
          <span className="rating-label">{t('rating.availability')}</span>
          <RatingStars
            score={currentRating.scoreAvailability}
            onRatingClick={(score) => config.id !== undefined && handleRating(config.id, score, 'availability')}
          />
        </div>
        <div className="is-flex is-flex-direction-column is-align-items-center" style={{ gap: '0.75rem' }}>
          <span className="rating-label">{t('rating.quality')}</span>
          <RatingStars
            score={currentRating.scoreQuality}
            onRatingClick={(score) => config.id !== undefined && handleRating(config.id, score, 'quality')}
          />
        </div>
      </div>
      {!loggedIn && <p className="help has-text-centered">{t('rating.loginToRate')}</p>}
    </div>
    </>
  );
};

export default ApiRating;
