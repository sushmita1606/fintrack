const port = process.env.PORT || 10000;

// '0.0.0.0' is mandatory on Render to accept public traffic
app.listen(Number(port), '0.0.0.0', () => {
  console.log(`FinTrack API listening on ${port}`);
});
