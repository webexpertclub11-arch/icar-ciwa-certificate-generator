import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb';

let cachedDb = null;

async function connectToMongo() {
    if (cachedDb) return cachedDb;

    const uri = process.env.monogdb_uri;
    if (!uri) throw new Error("monogdb_uri not found in env variables");

    const client = new MongoClient(uri, {
        serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
        }
    });

    await client.connect();
    const db = client.db('certificate_generator');
    cachedDb = db;
    return db;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const db = await connectToMongo();

        let { sql, args } = req.body;
        if (!sql) return res.status(200).json({ rows: [] });

        const rawSql = sql;
        sql = sql.replace(/\s+/g, ' ').trim().toUpperCase();
        args = args || [];

        if (sql.startsWith("CREATE TABLE") || sql.startsWith("ALTER TABLE") || sql.startsWith("DROP TABLE") || sql.startsWith("CREATE INDEX") || sql.startsWith("PRAGMA ")) {
            return res.status(200).json({ rows: [] });
        }

        if (sql === 'BULK_INSERT_PARTICIPANTS_MONGO') {
            const bulkOps = args.map(item => ({
                updateOne: {
                    filter: { serial_number: item.serialNumber },
                    update: {
                        $set: {
                            participant_id: String(item.id), name: item.name, serial_number: item.serialNumber,
                            institute_name: item.instituteName, atari_zone: item.atariZone, training_dates: item.trainingDates,
                            created_at: item.createdAt, id: String(item.id)
                        }
                    },
                    upsert: true
                }
            }));
            await db.collection('participants').bulkWrite(bulkOps);
            return res.status(200).json({ rows: [] });
        }

        if (sql.includes("SELECT * FROM PARTICIPANTS ORDER BY NAME ASC")) {
            const rows = await db.collection('participants').find().sort({ name: 1 }).toArray();
            return res.status(200).json({ rows });
        }
        if (sql.includes("INSERT OR REPLACE INTO PARTICIPANTS")) {
            await db.collection('participants').updateOne(
                { serial_number: args[2] },
                {
                    $set: {
                        participant_id: String(args[0]), name: args[1], serial_number: args[2],
                        institute_name: args[3], atari_zone: args[4], training_dates: args[5],
                        created_at: args[6], is_restricted: args[7] ? 1 : 0,
                        id: String(args[0])
                    }
                },
                { upsert: true }
            );
            return res.status(200).json({ rows: [] });
        }
        if (sql.includes("INSERT INTO PARTICIPANTS") && sql.includes("ON CONFLICT")) {
            await db.collection('participants').updateOne(
                { serial_number: args[2] },
                {
                    $set: {
                        participant_id: String(args[0]), name: args[1], serial_number: args[2],
                        institute_name: args[3], atari_zone: args[4], training_dates: args[5],
                        created_at: args[6], id: String(args[0])
                    }
                },
                { upsert: true }
            );
            return res.status(200).json({ rows: [] });
        }
        if (sql.startsWith("DELETE FROM PARTICIPANTS WHERE ID = ? OR SERIAL_NUMBER = ?")) {
            await db.collection('participants').deleteMany({
                $or: [{ id: String(args[0]) }, { participant_id: String(args[0]) }, { serial_number: args[1] }]
            });
            return res.status(200).json({ rows: [] });
        }
        if (sql.startsWith("DELETE FROM PARTICIPANTS WHERE SERIAL_NUMBER IN")) {
            await db.collection('participants').deleteMany({ serial_number: { $in: args } });
            return res.status(200).json({ rows: [] });
        }
        if (sql.startsWith("DELETE FROM PARTICIPANTS WHERE ID IN")) {
            const ids = args.map(String);
            await db.collection('participants').deleteMany({
                $or: [{ id: { $in: ids } }, { participant_id: { $in: ids } }]
            });
            return res.status(200).json({ rows: [] });
        }
        if (sql.startsWith("UPDATE PARTICIPANTS SET NAME = ?")) {
            await db.collection('participants').updateOne(
                { $or: [{ id: String(args[6]) }, { participant_id: String(args[6]) }, { serial_number: args[7] }] },
                {
                    $set: {
                        name: args[0], serial_number: args[1], institute_name: args[2],
                        atari_zone: args[3], training_dates: args[4], is_restricted: args[5] ? 1 : 0
                    }
                }
            );
            return res.status(200).json({ rows: [] });
        }

        if (sql.includes("INSERT OR REPLACE INTO CERTIFICATE_DOWNLOADS")) {
            await db.collection('certificate_downloads').updateOne(
                { serial_number: args[8] },
                {
                    $set: {
                        registered_name: args[0], certificate_name: args[1], salutation: args[2],
                        email: args[3], mobile: args[4], wp_no: args[5], kvk_name: args[6],
                        atari_zone: args[7], serial_number: args[8], is_locked: 0, download_time: args[9]
                    }
                },
                { upsert: true }
            );
            return res.status(200).json({ rows: [] });
        }
        if (sql.startsWith("SELECT * FROM CERTIFICATE_DOWNLOADS WHERE SERIAL_NUMBER = ? OR REGISTERED_NAME = ? ORDER BY DOWNLOAD_TIME DESC LIMIT 1")) {
            const rows = await db.collection('certificate_downloads')
                .find({ $or: [{ serial_number: args[0] }, { registered_name: args[1] }] })
                .sort({ download_time: -1 }).limit(1).toArray();
            return res.status(200).json({ rows });
        }
        if (sql.startsWith("UPDATE CERTIFICATE_DOWNLOADS SET REGISTERED_NAME = ?")) {
            await db.collection('certificate_downloads').updateOne(
                { serial_number: args[10] },
                {
                    $set: {
                        registered_name: args[0], certificate_name: args[1], salutation: args[2],
                        email: args[3], mobile: args[4], wp_no: args[5], kvk_name: args[6],
                        atari_zone: args[7], serial_number: args[8], is_locked: args[9] ? 1 : 0
                    }
                }
            );
            return res.status(200).json({ rows: [] });
        }
        if (sql.startsWith("UPDATE CERTIFICATE_DOWNLOADS SET IS_LOCKED = 0")) {
            await db.collection('certificate_downloads').updateMany(
                { $or: [{ serial_number: args[0] }, { registered_name: args[1] }] },
                { $set: { is_locked: 0 } }
            );
            return res.status(200).json({ rows: [] });
        }
        if (sql.startsWith("UPDATE CERTIFICATE_DOWNLOADS SET IS_LOCKED = 1")) {
            await db.collection('certificate_downloads').updateMany(
                { $or: [{ serial_number: args[0] }, { registered_name: args[1] }] },
                { $set: { is_locked: 1 } }
            );
            return res.status(200).json({ rows: [] });
        }
        if (sql.startsWith("DELETE FROM CERTIFICATE_DOWNLOADS WHERE SERIAL_NUMBER = ?")) {
            await db.collection('certificate_downloads').deleteMany(
                { $or: [{ serial_number: args[0] }, { registered_name: args[1] }] }
            );
            return res.status(200).json({ rows: [] });
        }
        if (sql.includes("SELECT * FROM CERTIFICATE_DOWNLOADS ORDER BY DOWNLOAD_TIME DESC")) {
            const rows = await db.collection('certificate_downloads').find().sort({ download_time: -1 }).toArray();
            const mappedRows = rows.map(r => ({ ...r, id: r._id.toString() }));
            return res.status(200).json({ rows: mappedRows });
        }

        if (sql.startsWith("SELECT ID, CATEGORY, SHORT_NAME, IS_ACTIVE, CREATED_AT, FULL_NAME FROM ORGANIZATIONS")) {
            let filter = { is_active: 1 };
            if (rawSql.includes("category = ?") && args.length > 0) {
                filter.category = args[0];
            }
            const rows = await db.collection('organizations').find(filter).sort({ category: 1, full_name: 1 }).toArray();
            const mappedRows = rows.map(r => ({ ...r, id: r._id.toString() }));
            return res.status(200).json({ rows: mappedRows });
        }
        if (sql.includes("INSERT INTO ORGANIZATIONS (CATEGORY, SHORT_NAME, IS_ACTIVE, FULL_NAME, CREATED_AT) VALUES (?, ?, 1, ?, ?)") || sql.includes("INSERT INTO ORGANIZATIONS (CATEGORY, SHORT_NAME, IS_ACTIVE, FULL_NAME, CREATED_AT)")) {
            await db.collection('organizations').insertOne({
                category: args[0], short_name: args[1], is_active: 1, full_name: args[2], created_at: args[3]
            });
            return res.status(200).json({ rows: [] });
        }
        if (sql.startsWith("DELETE FROM ORGANIZATIONS WHERE ID = ?")) {
            await db.collection('organizations').deleteOne({ _id: new ObjectId(args[0]) });
            return res.status(200).json({ rows: [] });
        }
        if (sql.startsWith("DELETE FROM ORGANIZATIONS WHERE ID IN")) {
            const objectIds = args.map(a => new ObjectId(a));
            await db.collection('organizations').deleteMany({ _id: { $in: objectIds } });
            return res.status(200).json({ rows: [] });
        }

        if (sql.includes("SELECT * FROM ADMIN_AUTH WHERE ROLE = 'SUPERADMIN'")) {
            const auth = await db.collection('admin_auth').findOne({ role: 'superadmin' });
            if (!auth) {
                const initPass = process.env.VITE_INITIAL_ADMIN_PASSWORD || 'secureadminpass123';
                await db.collection('admin_auth').insertOne({ role: 'superadmin', password_hash: initPass, updated_at: new Date() });
                return res.status(200).json({ rows: [{ password_hash: initPass }] });
            }
            return res.status(200).json({ rows: [auth] });
        }
        if (sql.includes("SELECT PASSWORD_HASH FROM ADMIN_AUTH WHERE ROLE = 'SUPERADMIN'")) {
            const auth = await db.collection('admin_auth').findOne({ role: 'superadmin' });
            if (!auth) {
                const initPass = process.env.VITE_INITIAL_ADMIN_PASSWORD || 'secureadminpass123';
                await db.collection('admin_auth').insertOne({ role: 'superadmin', password_hash: initPass, updated_at: new Date() });
                return res.status(200).json({ rows: [{ password_hash: initPass }] });
            }
            return res.status(200).json({ rows: [auth] });
        }
        if (sql.startsWith("UPDATE ADMIN_AUTH SET PASSWORD_HASH = ?")) {
            await db.collection('admin_auth').updateOne({ role: 'superadmin' }, { $set: { password_hash: args[0] } });
            return res.status(200).json({ rows: [] });
        }

        if (sql.includes("SELECT * FROM SYSTEM_CONFIG WHERE KEY = 'CERTIFICATE_SETTINGS'")) {
            const config = await db.collection('system_config').findOne({ key: 'certificate_settings' });
            return res.status(200).json({ rows: config ? [config] : [] });
        }
        if (sql.includes("INSERT OR REPLACE INTO SYSTEM_CONFIG") || sql.includes("INSERT INTO SYSTEM_CONFIG")) {
            await db.collection('system_config').updateOne(
                { key: 'certificate_settings' },
                { $set: { value: args[0], updated_at: new Date().toISOString() } },
                { upsert: true }
            );
            return res.status(200).json({ rows: [] });
        }

        if (sql.includes("INSERT INTO SUPPORT_TICKETS")) {
            await db.collection('support_tickets').insertOne({
                serial_number: args[0], registered_name: args[1], email: args[2],
                mobile: args[3], issue_description: args[4], status: 'pending', created_at: args[5]
            });
            return res.status(200).json({ rows: [] });
        }
        if (sql.includes("SELECT * FROM SUPPORT_TICKETS ORDER BY CREATED_AT DESC")) {
            const rows = await db.collection('support_tickets').find().sort({ created_at: -1 }).toArray();
            const mappedRows = rows.map(r => ({ ...r, id: r._id.toString() }));
            return res.status(200).json({ rows: mappedRows });
        }
        if (sql.startsWith("UPDATE SUPPORT_TICKETS SET STATUS = ? WHERE ID = ?")) {
            await db.collection('support_tickets').updateOne({ _id: new ObjectId(args[1]) }, { $set: { status: args[0] } });
            return res.status(200).json({ rows: [] });
        }

        if (sql.includes("INSERT INTO ORGANIZATIONS_TEMP")) {
            return res.status(200).json({ rows: [] });
        }

        console.warn("Unrecognized SQL:", sql);
        return res.status(200).json({ rows: [] });
    } catch (err) {
        console.error(`Error executing SQL:`, err);
        return res.status(500).json({ error: err.message });
    }
}
