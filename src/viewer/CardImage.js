import React, { useState, useEffect, useRef } from 'react';

const CardImage = ({ src, alt, onLoad }) => {
  const [imageInfo, setImageInfo] = useState(null);
  const imgRef = useRef(null);

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete) {
      getImageInfo(img);
    }
  }, [src]);

  const getImageInfo = (img) => {
    const { naturalWidth, naturalHeight } = img;
    const resolution = `${naturalWidth}x${naturalHeight}`;
    if(!src) return;
    // Get file type from the src URL
    const fileType = src.split('.').pop().split('?')[0].toUpperCase();

    const info = { resolution, fileType };
    setImageInfo(info);
    if (onLoad) onLoad(info);
  };

  const handleLoad = () => {
    getImageInfo(imgRef.current);
  };

  return (
    <div className="card-image-container card-tile">
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        onLoad={handleLoad}
      />
      {imageInfo && (
        <div className="image-info">
          {imageInfo.resolution} {imageInfo.fileType}
        </div>
      )}
    </div>
  );
};

export default CardImage;