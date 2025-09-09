// src/index.ts

import app from './app'; // Import the configured app

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});