'use strict';

const path = require('path');
require('dotenv').config();

const express = require('express');
const { RtcTokenBuilder, RtcRole } = require('agora-token');

const APP_ID = (process.env.AGORA_APP_ID || '').trim();
const APP_CERTIFICATE = (process.env.AGORA_APP_CERTIFICATE || '').trim();
const TOKEN_API_SECRET = (process.env.TOKEN_API_SECRET || '').trim();
const PORT = parseInt(process.env.PORT || '3000', 10);

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

function tokenAuth(req, res, next) {
    if (!TOKEN_API_SECRET) return next();
    const key =
        req.get('x-api-key') ||
        (req.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (key !== TOKEN_API_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

app.get('/api/config', (req, res) => {
    const tokenServiceEnabled = Boolean(APP_ID && APP_CERTIFICATE);
    if (!APP_ID) {
        return res.json({
            appId: '',
            tokenServiceEnabled: false,
            message: 'Set AGORA_APP_ID (and AGORA_APP_CERTIFICATE for token generation).',
        });
    }
    res.json({
        appId: APP_ID,
        tokenServiceEnabled,
        message: tokenServiceEnabled
            ? 'RTC tokens can be generated on the server.'
            : 'App ID is set; add AGORA_APP_CERTIFICATE to enable /api/rtc-tokens.',
    });
});

app.post('/api/rtc-tokens', tokenAuth, (req, res) => {
    if (!APP_ID || !APP_CERTIFICATE) {
        return res.status(503).json({
            error: 'Server is missing AGORA_APP_ID or AGORA_APP_CERTIFICATE',
        });
    }

    const body = req.body || {};
    const channelName = typeof body.channelName === 'string' ? body.channelName.trim() : '';
    if (!channelName) {
        return res.status(400).json({ error: 'channelName is required' });
    }
    if (channelName.length > 64) {
        return res.status(400).json({ error: 'channelName is too long' });
    }

    let sendUid = Number(body.sendUid);
    let recvUid = Number(body.recvUid);
    if (!Number.isInteger(sendUid) || sendUid < 0 || sendUid > 0xffffffff) {
        sendUid = Math.floor(Math.random() * 100000) + 100000;
    }
    if (!Number.isInteger(recvUid) || recvUid < 0 || recvUid > 0xffffffff) {
        recvUid = Math.floor(Math.random() * 100000) + 200000;
    }
    if (sendUid === recvUid) {
        recvUid = (recvUid + 50000) >>> 0;
    }

    const tokenExpireSeconds = Math.min(
        Math.max(parseInt(body.tokenExpireSeconds, 10) || 3600, 60),
        86400
    );
    const privilegeExpireSeconds = Math.min(
        Math.max(parseInt(body.privilegeExpireSeconds, 10) || tokenExpireSeconds, 60),
        86400
    );

    try {
        const sendingToken = RtcTokenBuilder.buildTokenWithUid(
            APP_ID,
            APP_CERTIFICATE,
            channelName,
            sendUid,
            RtcRole.PUBLISHER,
            tokenExpireSeconds,
            privilegeExpireSeconds
        );
        const receivingToken = RtcTokenBuilder.buildTokenWithUid(
            APP_ID,
            APP_CERTIFICATE,
            channelName,
            recvUid,
            RtcRole.SUBSCRIBER,
            tokenExpireSeconds,
            privilegeExpireSeconds
        );

        res.json({
            appId: APP_ID,
            channelName,
            sendUid,
            recvUid,
            sendingToken,
            receivingToken,
        });
    } catch (err) {
        console.error('RtcTokenBuilder error:', err);
        res.status(500).json({ error: 'Failed to build token' });
    }
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
    if (!APP_ID) console.warn('Warning: AGORA_APP_ID is not set.');
    if (!APP_CERTIFICATE) console.warn('Warning: AGORA_APP_CERTIFICATE is not set (token API disabled).');
    if (TOKEN_API_SECRET) console.log('TOKEN_API_SECRET is set; clients must send X-API-Key.');
});
