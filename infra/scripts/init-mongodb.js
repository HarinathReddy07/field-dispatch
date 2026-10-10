const path = require('path');
const { MongoClient } = require(path.resolve(__dirname, '../../apps/admin/node_modules/mongodb'));

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/field_dispatch';
const dbName = process.env.MONGODB_DB || 'field_dispatch';

async function seedMongo() {
  console.log(`Connecting to MongoDB at ${uri}...`);
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB successfully.');
    const db = client.db(dbName);

    // Collections
    const usersCol = db.collection('users');
    const techCol = db.collection('technicians');
    const reqCol = db.collection('service_requests');
    const auditCol = db.collection('audit_logs');

    // Create indexes
    await usersCol.createIndex({ email: 1 }, { unique: true });
    await usersCol.createIndex({ code: 1 });
    await usersCol.createIndex({ role: 1 });
    await techCol.createIndex({ userId: 1 }, { unique: true });
    await techCol.createIndex({ location: '2dsphere' });
    await techCol.createIndex({ availability: 1 });
    await reqCol.createIndex({ requesterId: 1 });
    await reqCol.createIndex({ techId: 1 });
    await reqCol.createIndex({ state: 1 });
    await auditCol.createIndex({ occurredAt: -1 });

    console.log('Indexes created successfully.');

    // Seed 10 Customers (C1 - C10)
    const customers = [
      {
        id: 'c-01',
        code: 'C1',
        email: 'requester1@dispatch.test',
        name: 'Ravi Requester',
        role: 'REQUESTER',
        rating: 4.8,
        status: 'ACTIVE',
      },
      {
        id: 'c-02',
        code: 'C2',
        email: 'requester2@dispatch.test',
        name: 'Rhea Requester',
        role: 'REQUESTER',
        rating: 4.9,
        status: 'ACTIVE',
      },
      {
        id: 'c-03',
        code: 'C3',
        email: 'requester3@dispatch.test',
        name: 'Rohan Requester',
        role: 'REQUESTER',
        rating: 4.7,
        status: 'ACTIVE',
      },
      {
        id: 'c-04',
        code: 'C4',
        email: 'requester4@dispatch.test',
        name: 'Priya Sharma',
        role: 'REQUESTER',
        rating: 4.6,
        status: 'ACTIVE',
      },
      {
        id: 'c-05',
        code: 'C5',
        email: 'requester5@dispatch.test',
        name: 'Vikram Mehta',
        role: 'REQUESTER',
        rating: 4.8,
        status: 'ACTIVE',
      },
      {
        id: 'c-06',
        code: 'C6',
        email: 'requester6@dispatch.test',
        name: 'Ananya Roy',
        role: 'REQUESTER',
        rating: 5.0,
        status: 'ACTIVE',
      },
      {
        id: 'c-07',
        code: 'C7',
        email: 'requester7@dispatch.test',
        name: 'Arjun Das',
        role: 'REQUESTER',
        rating: 4.5,
        status: 'ACTIVE',
      },
      {
        id: 'c-08',
        code: 'C8',
        email: 'requester8@dispatch.test',
        name: 'Meera Iyer',
        role: 'REQUESTER',
        rating: 4.9,
        status: 'ACTIVE',
      },
      {
        id: 'c-09',
        code: 'C9',
        email: 'requester9@dispatch.test',
        name: 'Sunil Verma',
        role: 'REQUESTER',
        rating: 4.7,
        status: 'ACTIVE',
      },
      {
        id: 'c-10',
        code: 'C10',
        email: 'requester10@dispatch.test',
        name: 'Kavita Reddy',
        role: 'REQUESTER',
        rating: 4.8,
        status: 'ACTIVE',
      },
    ];

    for (const c of customers) {
      await usersCol.updateOne(
        { email: c.email },
        { $set: { ...c, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true },
      );
    }
    console.log(`Seeded ${customers.length} customer accounts.`);

    // Seed 10 Technicians (T1 - T10)
    const technicians = [
      {
        user: {
          id: 't-01',
          code: 'T1',
          email: 'tech1@dispatch.test',
          name: 'Anil Kumar',
          role: 'TECHNICIAN',
          rating: 4.8,
          status: 'ACTIVE',
        },
        profile: {
          name: 'Anil Kumar',
          email: 'tech1@dispatch.test',
          code: 'T1',
          rating: 4.8,
          availability: 'AVAILABLE',
          serviceCategories: ['ELECTRICAL_INSPECTION', 'MECHANICAL_INSPECTION'],
          location: { type: 'Point', coordinates: [77.6068, 12.9756] },
          lastSeenAt: new Date(),
          address: 'MG Road Central, Bengaluru',
        },
      },
      {
        user: {
          id: 't-02',
          code: 'T2',
          email: 'tech2@dispatch.test',
          name: 'Bhavna Rao',
          role: 'TECHNICIAN',
          rating: 4.5,
          status: 'ACTIVE',
        },
        profile: {
          name: 'Bhavna Rao',
          email: 'tech2@dispatch.test',
          code: 'T2',
          rating: 4.5,
          availability: 'AVAILABLE',
          serviceCategories: ['ELECTRICAL_INSPECTION'],
          location: { type: 'Point', coordinates: [77.6408, 12.9784] },
          lastSeenAt: new Date(),
          address: 'Indiranagar 100ft Rd, Bengaluru',
        },
      },
      {
        user: {
          id: 't-03',
          code: 'T3',
          email: 'tech3@dispatch.test',
          name: 'Chetan Gowda',
          role: 'TECHNICIAN',
          rating: 4.9,
          status: 'ACTIVE',
        },
        profile: {
          name: 'Chetan Gowda',
          email: 'tech3@dispatch.test',
          code: 'T3',
          rating: 4.9,
          availability: 'AVAILABLE',
          serviceCategories: ['MECHANICAL_INSPECTION'],
          location: { type: 'Point', coordinates: [77.6245, 12.9352] },
          lastSeenAt: new Date(),
          address: 'Koramangala 4th Block, Bengaluru',
        },
      },
      {
        user: {
          id: 't-04',
          code: 'T4',
          email: 'tech4@dispatch.test',
          name: 'Divya Shetty',
          role: 'TECHNICIAN',
          rating: 4.2,
          status: 'ACTIVE',
        },
        profile: {
          name: 'Divya Shetty',
          email: 'tech4@dispatch.test',
          code: 'T4',
          rating: 4.2,
          availability: 'AVAILABLE',
          serviceCategories: ['ELECTRICAL_INSPECTION', 'MECHANICAL_INSPECTION'],
          location: { type: 'Point', coordinates: [77.5938, 12.925] },
          lastSeenAt: new Date(),
          address: 'Jayanagar 9th Block, Bengaluru',
        },
      },
      {
        user: {
          id: 't-05',
          code: 'T5',
          email: 'tech5@dispatch.test',
          name: 'Esha Nair',
          role: 'TECHNICIAN',
          rating: 3.9,
          status: 'ACTIVE',
        },
        profile: {
          name: 'Esha Nair',
          email: 'tech5@dispatch.test',
          code: 'T5',
          rating: 3.9,
          availability: 'AVAILABLE',
          serviceCategories: ['ELECTRICAL_INSPECTION', 'MECHANICAL_INSPECTION'],
          location: { type: 'Point', coordinates: [77.6389, 12.9116] },
          lastSeenAt: new Date(),
          address: 'HSR Layout Sector 2, Bengaluru',
        },
      },
      {
        user: {
          id: 't-06',
          code: 'T6',
          email: 'tech6@dispatch.test',
          name: 'Farhan Sheikh',
          role: 'TECHNICIAN',
          rating: 4.6,
          status: 'ACTIVE',
        },
        profile: {
          name: 'Farhan Sheikh',
          email: 'tech6@dispatch.test',
          code: 'T6',
          rating: 4.6,
          availability: 'BUSY',
          serviceCategories: ['ELECTRICAL_INSPECTION', 'MECHANICAL_INSPECTION'],
          location: { type: 'Point', coordinates: [77.75, 12.9698] },
          lastSeenAt: new Date(),
          address: 'Whitefield Tech Park, Bengaluru',
        },
      },
      {
        user: {
          id: 't-07',
          code: 'T7',
          email: 'tech7@dispatch.test',
          name: 'Gita Menon',
          role: 'TECHNICIAN',
          rating: 4.1,
          status: 'ACTIVE',
        },
        profile: {
          name: 'Gita Menon',
          email: 'tech7@dispatch.test',
          code: 'T7',
          rating: 4.1,
          availability: 'BUSY',
          serviceCategories: ['ELECTRICAL_INSPECTION'],
          location: { type: 'Point', coordinates: [77.5963, 13.1007] },
          lastSeenAt: new Date(),
          address: 'Yelahanka Satellite Town, Bengaluru',
        },
      },
      {
        user: {
          id: 't-08',
          code: 'T8',
          email: 'tech8@dispatch.test',
          name: 'Harish Patil',
          role: 'TECHNICIAN',
          rating: 3.6,
          status: 'ACTIVE',
        },
        profile: {
          name: 'Harish Patil',
          email: 'tech8@dispatch.test',
          code: 'T8',
          rating: 3.6,
          availability: 'AVAILABLE',
          serviceCategories: ['MECHANICAL_INSPECTION'],
          location: { type: 'Point', coordinates: [77.5646, 13.0035] },
          lastSeenAt: new Date(),
          address: 'Malleshwaram 8th Cross, Bengaluru',
        },
      },
      {
        user: {
          id: 't-09',
          code: 'T9',
          email: 'tech9@dispatch.test',
          name: 'Imran Qureshi',
          role: 'TECHNICIAN',
          rating: 4.7,
          status: 'ACTIVE',
        },
        profile: {
          name: 'Imran Qureshi',
          email: 'tech9@dispatch.test',
          code: 'T9',
          rating: 4.7,
          availability: 'AVAILABLE',
          serviceCategories: ['ELECTRICAL_INSPECTION', 'MECHANICAL_INSPECTION'],
          location: { type: 'Point', coordinates: [77.6101, 12.9344] },
          lastSeenAt: new Date(),
          address: 'BTM Layout 1st Stage, Bengaluru',
        },
      },
      {
        user: {
          id: 't-10',
          code: 'T10',
          email: 'tech10@dispatch.test',
          name: 'Jyoti Deshmukh',
          role: 'TECHNICIAN',
          rating: 4.8,
          status: 'ACTIVE',
        },
        profile: {
          name: 'Jyoti Deshmukh',
          email: 'tech10@dispatch.test',
          code: 'T10',
          rating: 4.8,
          availability: 'AVAILABLE',
          serviceCategories: ['ELECTRICAL_INSPECTION', 'MECHANICAL_INSPECTION'],
          location: { type: 'Point', coordinates: [77.5854, 12.9815] },
          lastSeenAt: new Date(),
          address: 'Seshadripuram Main, Bengaluru',
        },
      },
    ];

    for (const t of technicians) {
      await usersCol.updateOne(
        { email: t.user.email },
        { $set: { ...t.user, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true },
      );
      await techCol.updateOne(
        { userId: t.user.id },
        { $set: { ...t.profile, userId: t.user.id } },
        { upsert: true },
      );
    }
    console.log(`Seeded ${technicians.length} technician accounts with GeoJSON points.`);

    // Seed 10 Admins (A1 - A10)
    const admins = [
      {
        id: 'a-01',
        code: 'A1',
        email: 'admin@dispatch.test',
        name: 'Asha Admin',
        role: 'ADMIN',
        rating: 5.0,
        status: 'ACTIVE',
      },
      {
        id: 'a-02',
        code: 'A2',
        email: 'admin2@dispatch.test',
        name: 'Akash Director',
        role: 'ADMIN',
        rating: 5.0,
        status: 'ACTIVE',
      },
      {
        id: 'a-03',
        code: 'A3',
        email: 'admin3@dispatch.test',
        name: 'Ankita Operations',
        role: 'ADMIN',
        rating: 5.0,
        status: 'ACTIVE',
      },
      {
        id: 'a-04',
        code: 'A4',
        email: 'admin4@dispatch.test',
        name: 'Aditya Supervisor',
        role: 'ADMIN',
        rating: 5.0,
        status: 'ACTIVE',
      },
      {
        id: 'a-05',
        code: 'A5',
        email: 'admin5@dispatch.test',
        name: 'Alok Manager',
        role: 'ADMIN',
        rating: 5.0,
        status: 'ACTIVE',
      },
      {
        id: 'a-06',
        code: 'A6',
        email: 'admin6@dispatch.test',
        name: 'Aparna Controller',
        role: 'ADMIN',
        rating: 5.0,
        status: 'ACTIVE',
      },
      {
        id: 'a-07',
        code: 'A7',
        email: 'admin7@dispatch.test',
        name: 'Ayush Dispatcher',
        role: 'ADMIN',
        rating: 5.0,
        status: 'ACTIVE',
      },
      {
        id: 'a-08',
        code: 'A8',
        email: 'admin8@dispatch.test',
        name: 'Ashwin Analyst',
        role: 'ADMIN',
        rating: 5.0,
        status: 'ACTIVE',
      },
      {
        id: 'a-09',
        code: 'A9',
        email: 'admin9@dispatch.test',
        name: 'Archana Lead',
        role: 'ADMIN',
        rating: 5.0,
        status: 'ACTIVE',
      },
      {
        id: 'a-10',
        code: 'A10',
        email: 'admin10@dispatch.test',
        name: 'Abhay Security',
        role: 'ADMIN',
        rating: 5.0,
        status: 'ACTIVE',
      },
    ];

    for (const a of admins) {
      await usersCol.updateOne(
        { email: a.email },
        { $set: { ...a, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true },
      );
    }
    console.log(`Seeded ${admins.length} administrator accounts.`);

    // Seed sample dispatch requests in MongoDB
    const sampleReq = {
      id: 'req-demo-01',
      requesterId: 'c-01',
      techId: 't-01',
      assetId: 'GEN-BLR-0941',
      category: 'ELECTRICAL_INSPECTION',
      title: 'Emergency Generator Load Bank & Breaker Diagnostic',
      notes: 'Main distribution panel trip warning during scheduled load test. Priority dispatch.',
      state: 'IN_PROGRESS',
      quoteMinor: 45000,
      location: {
        lat: 12.9756,
        lon: 77.6068,
        address: '100 Feet Rd, Indiranagar, Bengaluru, Karnataka 560038',
      },
      arrivalOtp: '482910',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await reqCol.updateOne({ id: sampleReq.id }, { $set: sampleReq }, { upsert: true });
    console.log('Seeded sample active dispatch service request.');

    // Seed audit log
    await auditCol.insertOne({
      id: 'audit-init-01',
      actorRole: 'SYSTEM',
      action: 'MONGODB_SCHEMA_INITIALIZED',
      entityType: 'DATABASE',
      entityId: dbName,
      occurredAt: new Date(),
      metadata: { totalUsers: customers.length + technicians.length + admins.length },
    });

    console.log('✅ MongoDB database initialization and seeding completed successfully!');
  } finally {
    await client.close();
  }
}

seedMongo().catch((err) => {
  console.error('MongoDB seed error:', err);
  process.exit(1);
});
