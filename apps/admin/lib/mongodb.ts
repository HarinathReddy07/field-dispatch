import { MongoClient, Db, Collection } from 'mongodb';

const MONGODB_URI =
  process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/field_dispatch';
const DB_NAME = process.env.MONGODB_DB || 'field_dispatch';

interface GlobalMongo {
  _mongoClientPromise?: Promise<MongoClient>;
}

const globalWithMongo = globalThis as unknown as GlobalMongo;

let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  if (!globalWithMongo._mongoClientPromise) {
    const client = new MongoClient(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  const client = new MongoClient(MONGODB_URI, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 5000,
  });
  clientPromise = client.connect();
}

export async function getMongoDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(DB_NAME);
}

export interface MongoUser {
  id: string;
  code: string;
  email: string;
  name: string;
  role: 'REQUESTER' | 'TECHNICIAN' | 'ADMIN';
  passwordHash?: string;
  rating?: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

export interface MongoTechnician {
  userId: string;
  name: string;
  email: string;
  code: string;
  rating: number;
  availability: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
  serviceCategories: string[];
  location: {
    type: 'Point';
    coordinates: [number, number]; // [lon, lat]
  };
  lastSeenAt: Date;
  address?: string;
}

export interface MongoServiceRequest {
  id: string;
  requesterId: string;
  techId?: string | null;
  assetId: string;
  category: 'ELECTRICAL_INSPECTION' | 'MECHANICAL_INSPECTION';
  title: string;
  notes?: string;
  state:
    | 'DRAFT'
    | 'MATCHING'
    | 'ASSIGNED'
    | 'EN_ROUTE'
    | 'ON_SITE'
    | 'IN_PROGRESS'
    | 'PENDING_REVIEW'
    | 'APPROVED'
    | 'COMPLETED'
    | 'CANCELLED';
  quoteMinor: number;
  location: {
    lat: number;
    lon: number;
    address: string;
  };
  arrivalOtp?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 10 Customers (C1 - C10)
export const SEED_CUSTOMERS: Array<Omit<MongoUser, 'createdAt' | 'updatedAt'>> = [
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

// 10 Technicians (T1 - T10)
export const SEED_TECHNICIANS: Array<{
  user: Omit<MongoUser, 'createdAt' | 'updatedAt'>;
  profile: Omit<MongoTechnician, 'userId'>;
}> = [
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

// 10 Admins (A1 - A10)
export const SEED_ADMINS: Array<Omit<MongoUser, 'createdAt' | 'updatedAt'>> = [
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

/**
 * Initializes MongoDB indexes and seeds all role-based demo accounts (C1-C10, T1-T10, A1-A10)
 */
export async function initMongoAndSeed(): Promise<{ success: boolean; message: string }> {
  try {
    const db = await getMongoDb();

    // 1. Setup collections & indexes
    const usersCol: Collection<MongoUser> = db.collection('users');
    await usersCol.createIndex({ email: 1 }, { unique: true });
    await usersCol.createIndex({ code: 1 });
    await usersCol.createIndex({ role: 1 });

    const techCol: Collection<MongoTechnician> = db.collection('technicians');
    await techCol.createIndex({ userId: 1 }, { unique: true });
    await techCol.createIndex({ location: '2dsphere' });
    await techCol.createIndex({ availability: 1 });

    const reqCol: Collection<MongoServiceRequest> = db.collection('service_requests');
    await reqCol.createIndex({ requesterId: 1 });
    await reqCol.createIndex({ techId: 1 });
    await reqCol.createIndex({ state: 1 });

    // 2. Seed customers
    for (const c of SEED_CUSTOMERS) {
      await usersCol.updateOne(
        { email: c.email },
        { $set: { ...c, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true },
      );
    }

    // 3. Seed technicians
    for (const t of SEED_TECHNICIANS) {
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

    // 4. Seed admins
    for (const a of SEED_ADMINS) {
      await usersCol.updateOne(
        { email: a.email },
        { $set: { ...a, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true },
      );
    }

    return {
      success: true,
      message: 'MongoDB initialized and seeded with 30 role accounts (C1-C10, T1-T10, A1-A10).',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[MongoDB] Init/Seed warning:', msg);
    return { success: false, message: msg };
  }
}
