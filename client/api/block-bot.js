module.exports = (req, res) => {
  res.status(403).json({
    error: 'Access Denied',
    message: 'Automated scraping and bot scripts are blocked.'
  });
};
