const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  const TEXT_API_PORT = process.env.REACT_APP_TEXT_API_PORT || 16385;
  const IMAGE_API_PORT = process.env.REACT_APP_IMAGE_API_PORT || 3000;

  // Proxy requests to the text API
  app.use(
    '/text-api',
    createProxyMiddleware({
      target: `http://localhost:${TEXT_API_PORT}`, // Text API port from environment variable
      changeOrigin: true,
      pathRewrite: {
        '^/text-api': '', // Remove the /text-api prefix when forwarding requests
      },
      onError: (err, req, res) => {
        console.error('Proxy error:', err);
        res.writeHead(500, {
          'Content-Type': 'application/json',
        });
        res.end(JSON.stringify({ 
          error: 'Proxy Error', 
          message: 'Failed to connect to the text API. Is the service running?',
          details: err.message
        }));
      }
    })
  );

  // Proxy requests to the image API
  app.use(
    '/image-api',
    createProxyMiddleware({
      target: `http://localhost:${IMAGE_API_PORT}`, // Image API port from environment variable
      changeOrigin: true,
      pathRewrite: {
        '^/image-api': '', // Remove the /image-api prefix when forwarding requests
      },
      onError: (err, req, res) => {
        console.error('Proxy error:', err);
        res.writeHead(500, {
          'Content-Type': 'application/json',
        });
        res.end(JSON.stringify({ 
          error: 'Proxy Error', 
          message: 'Failed to connect to the image API. Is the service running?',
          details: err.message
        }));
      }
    })
  );
}; 