require("dotenv").config();
const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
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

// ─── Swagger Setup ───────────────────────────────────────────────
const swaggerSpec = swaggerJsdoc({
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Gallery API",
            version: "1.0.0",
            description: "S3 presigned URL based photo gallery",
        },
        servers: [{ url: `http://localhost:${process.env.PORT}` }],
    },
    apis: ["./index.js"],
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
// ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /presign:
 *   get:
 *     summary: Get a presigned PUT URL to upload a photo to S3
 *     parameters:
 *       - in: query
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         example: myphoto.jpg
 *       - in: query
 *         name: contentType
 *         required: true
 *         schema:
 *           type: string
 *         example: image/jpeg
 *     responses:
 *       200:
 *         description: Presigned URL and S3 key
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                   example: https://bucket.s3.amazonaws.com/photos/uuid-myphoto.jpg?...
 *                 key:
 *                   type: string
 *                   example: photos/uuid-myphoto.jpg
 *       400:
 *         description: Missing filename or contentType
 */
app.get("/presign", async (req, res) => {
    const { filename, contentType } = req.query;
    if (!filename || !contentType)
        return res.status(400).json({ error: "filename and contentType required" });

    const key = `photos/${uuidv4()}-${filename}`;
    const command = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
    const url = await getSignedUrl(s3, command, { expiresIn: 300 });

    res.json({ url, key });
});

/**
 * @swagger
 * /photos:
 *   get:
 *     summary: Get all uploaded photos with presigned GET URLs
 *     responses:
 *       200:
 *         description: List of photos sorted newest first
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   key:
 *                     type: string
 *                     example: photos/uuid-myphoto.jpg
 *                   url:
 *                     type: string
 *                     example: https://bucket.s3.amazonaws.com/photos/uuid-myphoto.jpg?...
 *                   lastModified:
 *                     type: string
 *                     format: date-time
 */
app.get("/photos", async (req, res) => {
    const listCmd = new ListObjectsV2Command({ Bucket: BUCKET, Prefix: "photos/" });
    const { Contents = [] } = await s3.send(listCmd);

    const photos = await Promise.all(
        Contents.map(async (obj) => {
            const url = await getSignedUrl(
                s3,
                new GetObjectCommand({ Bucket: BUCKET, Key: obj.Key }),
                { expiresIn: 3600 }
            );
            return { key: obj.Key, url, lastModified: obj.LastModified };
        })
    );

    photos.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
    res.json(photos);
});

app.listen(process.env.PORT, () => {
    console.log(`BE running on :${process.env.PORT}`);
    console.log(`Swagger docs → http://localhost:${process.env.PORT}/docs`);
});