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

// POST /api/feedback — create a note (contract: create-feedback)
app.post('/api/feedback', (req, res) => {
  const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
  if (!text) {
    return res.status(422).json({ error: 'note must not be empty' });
  }
  if (text.length > 500) {
    return res.status(422).json({ error: 'note too long' });
  }
  const note = {
    id: crypto.randomUUID(),
    text,
    createdAt: new Date().toISOString(),
  };
  notes.push(note);
  res.status(201).json(note);
});

const PORT = process.env.PORT || 3199;
app.listen(PORT, () => console.log(`feedback board on :${PORT}`));
