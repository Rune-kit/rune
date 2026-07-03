const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const notes = [];

// GET /api/feedback — list all notes, newest first (contract: list-feedback)
app.get('/api/feedback', (req, res) => {
  const sorted = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(sorted);
});

const PORT = process.env.PORT || 3199;
app.listen(PORT, () => console.log(`feedback board on :${PORT}`));
