require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const BUCKET = process.env.S3_BUCKET;

// GET presigned PUT URL for upload
app.get("/presign", async (req, res) => {
    const { filename, contentType } = req.query;
    if (!filename || !contentType) return res.status(400).json({ error: "filename and contentType required" });

    const key = `photos/${uuidv4()}-${filename}`;
    const command = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
    const url = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 min

    res.json({ url, key });
});

// GET all photos (list + presigned GET URLs)
app.get("/photos", async (req, res) => {
    const listCmd = new ListObjectsV2Command({ Bucket: BUCKET, Prefix: "photos/" });
    const { Contents = [] } = await s3.send(listCmd);

    const photos = await Promise.all(
        Contents.map(async (obj) => {
            const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: obj.Key }), { expiresIn: 3600 });
            return { key: obj.Key, url, lastModified: obj.LastModified };
        })
    );

    // newest first
    photos.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
    res.json(photos);
});

app.listen(process.env.PORT, () => console.log(`BE running on :${process.env.PORT}`));