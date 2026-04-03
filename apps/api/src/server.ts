import { createApp } from "./app.js";

const app = createApp();
const port = process.env.PORT || 10000;

app.listen(Number(port), '0.0.0.0', () => {
  console.log(`FinTrack API listening on ${port}`);
});
