import { ReportHandler } from 'web-vitals';

const reportWebVitals = (onPerfEntry?: ReportHandler) => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      // Log performance metrics to console in development
      const logMetric = (metric: any) => {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Performance] ${metric.name}:`, {
            value: `${metric.value.toFixed(2)}${metric.name === 'CLS' ? '' : 'ms'}`,
            rating: metric.rating,
            delta: metric.delta,
            id: metric.id
          });
        }
        if (onPerfEntry) {
          onPerfEntry(metric);
        }
      };

      getCLS(logMetric);
      getFID(logMetric);
      getFCP(logMetric);
      getLCP(logMetric);
      getTTFB(logMetric);
    });
  }
};

export default reportWebVitals;
