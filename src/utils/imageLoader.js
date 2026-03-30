/**
 * Utility functions for optimized image loading
 */

/**
 * Preload critical images to improve performance
 */
export const preloadCriticalImages = () => {
  // Create link elements for critical images to preload
  const imagesToPreload = [
    '/APEdge1.png',
    '/APEdge.png',
    '/fav.png'
  ];

  imagesToPreload.forEach(src => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;
    document.head.appendChild(link);
  });
};

/**
 * Lazy load images that are not immediately needed
 */
export const lazyLoadImage = (imageSrc, callback) => {
  const img = new Image();
  img.onload = () => {
    if (callback) callback(img);
  };
  img.src = imageSrc;
};