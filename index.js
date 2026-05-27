const express = require('express');
const morgan = require('morgan');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(morgan('dev'));

// Endpoint 1: GET /
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to Node App!' });
});

// Endpoint 2: POST /users
app.post('/users', (req, res) => {
    const { name, email } = req.body;

    if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required' });
    }

    res.status(201).json({
        message: 'User created successfully',
        user: { name, email }
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});