// backend/index.js
require("dotenv").config();

const app = require("./app");

const PORT = Number(process.env.PORT || 3001);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`✅ Marincop backend running on http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
});
