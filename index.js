const express = require('express');
const morgan = require('morgan');
const app = express();
const PORT = 3000;
const os = require('os');

app.use(express.json());
app.use(morgan('dev'));

app.get('/', (req, res) => {
    const networkInterfaces = os.networkInterfaces();

    let systemIP = 'IP not found';
    for (const interfaceName in networkInterfaces) {
        const iface = networkInterfaces[interfaceName];
        for (const alias of iface) {
            if (alias.family === 'IPv4' && !alias.internal) {
                systemIP = alias.address;
                break;
            }
        }
        if (systemIP !== 'IP not found') break;
    }

    console.log(`System IP: ${systemIP}`);
    res.json({ message: 'Welcome to Node App!', systemIP });
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