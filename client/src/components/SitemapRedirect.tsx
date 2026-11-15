import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiConfig from '../config/api';

const SitemapRedirect: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to backend sitemap endpoint
    // Use API config which handles dev/prod correctly
    const backendUrl = apiConfig.baseURL || 
      (process.env.NODE_ENV === 'development' 
        ? 'http://localhost:5001' 
        : 'https://movie-7zq4.onrender.com');
    
    window.location.href = `${backendUrl}/sitemaps.xml`;
  }, [navigate]);

  return null;
};

export default SitemapRedirect;

