import express from 'express';

const app = express();
const port = Number(process.env.PORT) || 3000;

app.get('/hello', (_req, res) => {
  res.json({ message: 'Hello, world!' });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
